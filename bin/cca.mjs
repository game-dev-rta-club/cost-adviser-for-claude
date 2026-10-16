#!/usr/bin/env node
// Context Adviser For Claude: measure what Claude Code conversations cost.
import {execFile} from 'node:child_process';
import fs from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {checkAdvice, clearAdvice, readAdvice, saveAdvice} from '../lib/advice.mjs';
import {addChange, readChanges, removeChange} from '../lib/changes.mjs';
import {dataDir, transcriptRoot} from '../lib/paths.mjs';
import {buildReport, collectCached, reportFile} from '../lib/report.mjs';
import {addDeclined, readDeclined, removeDeclined} from '../lib/declined.mjs';
import {formatSummary, summarize} from '../lib/summary.mjs';
import {createViewer, DEFAULT_PORT, LINK_KEYS, reportLink, viewerRunning} from '../lib/viewer.mjs';

const HELP = `Context Adviser For Claude

Usage: cca <command> [options]

Commands:
  build                 Collect and write the Web view as one HTML file
                        (~/.context-adviser-for-claude/report.html). --open opens it.
  serve                 Show the built report at http://127.0.0.1:7319 so links to it
                        can be clicked. It only sends the file; run build to update it.
  link [options]        Print a link that opens the report on one item and highlights it:
                        --project --period day|3d|week|month --date YYYY-MM-DD
                        --metrics totals.cost,stats.ctx --tool NAME --session ID
                        --focus totals|stats|profile|cost-type|cost-model|tools|sessions
                        --item ROW (a row of cost-type or cost-model)
  advise <file.json>    Show an agent's notes on the report, each next to the item it
                        points at (the report is rebuilt). --clear removes them.
                        {"title": "...", "notes": [{"title", "finding", "advice",
                         "source": "https://...", "link": {<link options>}}]}
  summary               Print this period against the one before: each day, cost by
                        model, tool use as a tree, top sessions, and each recorded
                        change before vs after. --tool NAME adds that tool or group
                        (e.g. "bash chill") by day, with the uses that cost most.
  collect               Write the collected data as JSON.
  mark add <date> <label>     Record the day a change went in (YYYY-MM-DD).
  mark remove <date> <label>  Remove a recorded change.
                              Both rebuild the HTML when it exists.
  mark list                   List recorded changes.
  decline add <option> --reason <why>  Record an option the user decided
                              against, so advice does not propose it again.
  decline remove <option>     Allow it again.
  decline list                List declined options.

Options:
  --days <n>            Days to read. build/collect: 30. summary: 7 (and the 7 before).
  --project <name>      summary: one project only.
  --json                summary/mark list/decline list: print JSON.
  --reason <text>       decline add: why the option was declined.
  --out <file>          build: write the HTML here. collect: write JSON here instead of standard output.
  --open                build/link: open it in the default browser.
  --port <n>            serve/link: port (default 7319).
  --transcripts <dir>   Read transcripts here (default: $CLAUDE_CONFIG_DIR/projects or ~/.claude/projects).

Recorded changes, the HTML and a cache of read transcripts are kept in
$CCA_HOME (default ~/.context-adviser-for-claude). Only changed transcripts are read again.
Prices are provisional list prices; see lib/prices.mjs.`;

const fail = message => { console.error(`cca: ${message}\nRun "cca help" for usage.`); process.exit(2); };

function options(args) {
  try {
    return parseArgs({args, allowPositionals: true, options: {
      days: {type: 'string'}, project: {type: 'string'}, json: {type: 'boolean'}, open: {type: 'boolean'}, port: {type: 'string'}, clear: {type: 'boolean'}, reason: {type: 'string'},
      period: {type: 'string'}, date: {type: 'string'}, metrics: {type: 'string'}, tool: {type: 'string'}, session: {type: 'string'}, focus: {type: 'string'}, item: {type: 'string'},
      out: {type: 'string'}, transcripts: {type: 'string'}, help: {type: 'boolean', short: 'h'},
    }});
  } catch (error) { fail(error.message); }
}

function count(value, fallback, name, min = 1) {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min) fail(`--${name} must be a whole number of at least ${min}.`);
  return n;
}

async function build(days, out) {
  const r = await buildReport({root, dataDir: home, days, out});
  console.log(`Wrote ${r.file}\n${r.calls} calls from ${r.files} transcripts in ${(r.ms / 1000).toFixed(1)}s (read ${r.read} changed files, reused ${r.reused})`);
  return r;
}

// Keep the default HTML in step with recorded changes.
async function rebuildIfBuilt() {
  try { await fs.access(reportFile(home)); } catch { return; }
  await build(30);
}

function openFile(file) {
  const [cmd, args] = process.platform === 'darwin' ? ['open', [file]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', file]] : ['xdg-open', [file]];
  execFile(cmd, args, error => { if (error) console.error(`cca: could not open ${file}: ${error.message}`); });
}

const [command, ...rest] = process.argv.slice(2);
const {values, positionals} = options(rest);
const root = values.transcripts || transcriptRoot(), home = dataDir();

if (!command || command === 'help' || values.help) console.log(HELP);
else if (command === 'build') {
  const report = await build(count(values.days, 30, 'days'), values.out);
  if (values.open) openFile(report.file);
} else if (command === 'serve') {
  const port = count(values.port, DEFAULT_PORT, 'port', 0), server = createViewer(reportFile(home));
  server.on('error', error => fail(error.code === 'EADDRINUSE' ? `port ${port} is in use (is cca serve already running?).` : error.message));
  server.listen(port, '127.0.0.1', () => console.log(`Report: http://127.0.0.1:${server.address().port}/ (Ctrl+C to stop)`));
} else if (command === 'link') {
  const port = count(values.port, DEFAULT_PORT, 'port');
  const url = reportLink(`http://127.0.0.1:${port}/`, Object.fromEntries(LINK_KEYS.map(k => [k, values[k]])));
  console.log(url);
  if (!await viewerRunning(port)) console.error(`cca: nothing is serving the report on port ${port}; start "cca serve" to make the link work.`);
  if (values.open) openFile(url);
} else if (command === 'advise') {
  try {
    if (values.clear) { await clearAdvice(home); console.log('Notes removed.'); }
    else {
      if (!positionals[0]) fail('give the notes file: cca advise notes.json');
      const advice = checkAdvice(JSON.parse(await fs.readFile(positionals[0], 'utf8')));
      await saveAdvice(home, advice);
      console.log(`Saved ${advice.notes.length} notes.`);
    }
  } catch (error) { fail(error.message); }
  await build(30);
  if (!values.clear) console.log(`Open: http://127.0.0.1:${DEFAULT_PORT}/#note=1${await viewerRunning(DEFAULT_PORT) ? '' : '  (start "cca serve" first)'}`);
} else if (command === 'collect') {
  const data = await collectCached({root, dataDir: home, days: count(values.days, 30, 'days')});
  const json = JSON.stringify(data) + '\n';
  if (values.out) { await fs.writeFile(values.out, json); console.error(`Wrote ${data.calls} calls from ${data.files} transcripts to ${values.out}`); }
  else process.stdout.write(json);
} else if (command === 'summary') {
  const days = count(values.days, 7, 'days'), changes = await readChanges(home);
  // Enough history for the previous window and for every recorded change.
  const data = await collectCached({root, dataDir: home, days: Math.max(days * 2, 30)});
  const [declined, advice] = await Promise.all([readDeclined(home), readAdvice(home)]);
  const summary = summarize(data, {days, project: values.project || null, changes, tool: values.tool || null, declined, advice});
  console.log(values.json ? JSON.stringify(summary, null, 2) : formatSummary(summary));
} else if (command === 'mark') {
  const [action, date, ...words] = positionals, label = words.join(' ');
  try {
    if (action === 'list' || !action) {
      const list = await readChanges(home);
      console.log(values.json ? JSON.stringify(list, null, 2) : list.map(c => `${c.date}  ${c.label}`).join('\n') || 'No changes recorded.');
    } else if (action === 'add') {
      const {added} = await addChange(home, date, label);
      console.log(added ? `Recorded: ${date} ${label.trim()}` : `Already recorded: ${date} ${label.trim()}`);
      if (added) await rebuildIfBuilt();
    } else if (action === 'remove') {
      const {removed} = await removeChange(home, date, label);
      if (!removed) fail(`no change "${label.trim()}" on ${date}.`);
      console.log(`Removed: ${date} ${label.trim()}`);
      await rebuildIfBuilt();
    } else fail(`unknown mark action "${action}".`);
  } catch (error) { fail(error.message); }
} else if (command === 'decline') {
  const [action, ...words] = positionals, option = words.join(' ');
  try {
    if (action === 'list' || !action) {
      const list = await readDeclined(home);
      console.log(values.json ? JSON.stringify(list, null, 2) : list.map(d => `${d.date}  ${d.option}${d.reason ? ` — ${d.reason}` : ''}`).join('\n') || 'No options declined.');
    } else if (action === 'add') {
      await addDeclined(home, option, values.reason || '');
      console.log(`Declined: ${option.trim()}`);
    } else if (action === 'remove') {
      if (!await removeDeclined(home, option)) fail(`no declined option "${option.trim()}".`);
      console.log(`Allowed again: ${option.trim()}`);
    } else fail(`unknown decline action "${action}".`);
  } catch (error) { fail(error.message); }
} else fail(`unknown command "${command}".`);
