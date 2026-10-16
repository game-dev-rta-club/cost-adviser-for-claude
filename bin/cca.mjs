#!/usr/bin/env node
// Context Adviser For Claude: measure what Claude Code conversations cost.
import {execFile} from 'node:child_process';
import fs from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {checkAdvice, clearAdvice, readAdvice, saveAdvice} from '../lib/advice.mjs';
import {addChange, readChanges, removeChange} from '../lib/changes.mjs';
import {dataDir, transcriptRoot} from '../lib/paths.mjs';
import {buildReport, collectCached, readTranscriptsCached, reportFile} from '../lib/report.mjs';
import {addDeclined, readDeclined, removeDeclined} from '../lib/declined.mjs';
import {formatSummary, summarize} from '../lib/summary.mjs';
import {localDay, projectOf} from '../lib/aggregate.mjs';
import {simulate} from '../lib/simulate.mjs';
import {createViewer, DEFAULT_PORT, LINK_KEYS, reportLink, viewerRunning} from '../lib/viewer.mjs';

const HELP = `Context Adviser For Claude

Usage: cca <command> [options]

Commands:
  build                 Collect and write the Web view as one HTML file
                        (~/.context-adviser-for-claude/report.html). --open opens it.
  serve                 Show the built report at http://127.0.0.1:7319 so links to it
                        can be clicked. It only sends the file; run build to update it.
  link [options]        Print a link that opens the report on one item and highlights it:
                        --project --period day|3d|7d|week|month --date YYYY-MM-DD
                        --metrics totals.cost,stats.ctx --tool NAME --session ID
                        --focus totals|stats|profile|cost-type|cost-model|tools|sessions
                        --item ROW (a row of cost-type or cost-model)
  advise <file.json>    Replace the improvement proposals listed under the projects
                        (the report is rebuilt). A proposal keeps its dates while
                        its content stays the same. --clear removes them.
                        {"proposals": [{"id", "action", "detail", "news", "project",
                         "ratings": {"ease","safety","savings": 1-5 stars},
                         "source": "https://...", "link": {<link options>}}]}
  summary               Print this period against the one before: each day, cost by
                        model, tool use as a tree, top sessions, and each recorded
                        change before vs after. --tool NAME adds that tool or group
                        (e.g. "bash chill") by day, with the uses that cost most.
  simulate              Replay the recent conversations as if a change had been in
                        place, and print the cost with and without it.
                        --compact-at <tokens>: compaction starts at this length.
                        --tool-results <share>: tool results keep this share of
                        their size (0.7 = 30% shorter). Give one or both.
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
  --days <n>            Days to read. build/collect: 30. summary/simulate: 7 (summary also the 7 before).
  --project <name>      summary/simulate: one project only.
  --json                summary/simulate/mark list/decline list: print JSON.
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
      'compact-at': {type: 'string'}, 'tool-results': {type: 'string'},
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

if (!command || command === 'help' || command === '--help' || command === '-h' || values.help) console.log(HELP);
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
    if (values.clear) { await clearAdvice(home); console.log('Proposals removed.'); }
    else {
      if (!positionals[0]) fail('give the proposals file: cca advise proposals.json');
      const {advice, changes} = checkAdvice(JSON.parse(await fs.readFile(positionals[0], 'utf8')), await readAdvice(home), localDay(Date.now()));
      await saveAdvice(home, advice);
      console.log(`Saved ${advice.proposals.length} proposals.`);
      for (const [k, ids] of Object.entries(changes)) if (ids.length) console.log(`  ${k}: ${ids.join(', ')}`);
    }
  } catch (error) { fail(error.message); }
  await build(30);
  if (!values.clear) console.log(`Open: http://127.0.0.1:${DEFAULT_PORT}/${await viewerRunning(DEFAULT_PORT) ? '' : '  (start "cca serve" first)'}`);
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
} else if (command === 'simulate') {
  const change = {};
  if (values['compact-at'] !== undefined) change.compactAt = count(values['compact-at'], 0, 'compact-at', 1000);
  if (values['tool-results'] !== undefined) {
    const share = Number(values['tool-results']);
    if (!(share >= 0 && share <= 1)) fail('--tool-results must be a share from 0 to 1, e.g. 0.7 for 30% shorter.');
    change.toolResults = share;
  }
  if (!Object.keys(change).length) fail('give a change to replay: --compact-at <tokens> and/or --tool-results <share>.');
  // The same days as the summary: today and the days before it, from midnight.
  const days = count(values.days, 7, 'days'), to = localDay(Date.now()), start = new Date(`${to}T00:00`);
  start.setDate(start.getDate() - (days - 1));
  const from = localDay(start.getTime());
  const transcripts = (await readTranscriptsCached({root, dataDir: home, days, since: start.getTime()})).filter(t => !values.project || projectOf(t.cwd) === values.project);
  const r = simulate(transcripts, change);
  const usd = v => `$${v.toLocaleString('en-US', {maximumFractionDigits: v < 100 ? 2 : 0})}`;
  if (values.json) console.log(JSON.stringify({window: {from, to, days}, project: values.project || null, change, ...r}, null, 2));
  else console.log([
    `Replayed ${r.calls.toLocaleString('en-US')} calls in ${r.conversations} conversations, ${from} to ${to} (${values.project || 'all projects'}).`,
    r.compactedAt ? `The conversations compacted at about ${r.compactedAt.toLocaleString('en-US')} tokens on average (${r.compactions.recorded} compactions recorded).` : `No conversation compacted in these days.`,
    `Change: ${[change.compactAt && `compaction starts at ${change.compactAt.toLocaleString('en-US')} tokens`, change.toolResults !== undefined && `tool results keep ${Math.round(change.toolResults * 100)}% of their size`].filter(Boolean).join('; ')}`,
    `Replayed cost: ${usd(r.base)} → ${usd(r.changed)}, ${Math.abs(r.cut * 100).toFixed(1)}% ${r.cut >= 0 ? 'less' : 'more'}`,
    `Replayed compactions: ${r.compactions.base} → ${r.compactions.changed}`,
    `The percentage compares the replay without and with the change. The replay is an estimate, so its cost without the change (${usd(r.base)}) differs from the recorded cost of the same calls (${usd(r.recorded)}): it leaves out cache rebuilds, such as a conversation reread after the cache expired, which the change does not affect.`,
    `It compares against the conversations as they ran. If the setting changed during these days, use --days to cover only the days since.`,
  ].join('\n'));
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
