#!/usr/bin/env node
// Context Adviser For Claude: measure what Claude Code conversations cost.
import fs from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {collect} from '../lib/aggregate.mjs';
import {addChange, readChanges, removeChange} from '../lib/changes.mjs';
import {dataDir, transcriptRoot} from '../lib/paths.mjs';
import {createServer} from '../lib/server.mjs';
import {formatSummary, summarize} from '../lib/summary.mjs';

const HELP = `Context Adviser For Claude

Usage: cca <command> [options]

Commands:
  serve                 Show the Web view (http://127.0.0.1:7319 by default).
  summary               Print this period against the one before, top tools and
                        sessions, and each recorded change before vs after.
  collect               Write the collected data as JSON.
  mark add <date> <label>     Record the day a change went in (YYYY-MM-DD).
  mark remove <date> <label>  Remove a recorded change.
  mark list                   List recorded changes.

Options:
  --days <n>            Days to read. serve/collect: 30. summary: 7 (and the 7 before).
  --project <name>      summary: one project only.
  --json                summary/mark list: print JSON.
  --port <n>            serve: port (default 7319). 0 picks a free one.
  --out <file>          collect: write here instead of standard output.
  --transcripts <dir>   Read transcripts here (default: $CLAUDE_CONFIG_DIR/projects or ~/.claude/projects).

Recorded changes are kept in $CCA_HOME/changes.json (default ~/.context-adviser-for-claude).
Prices are provisional list prices; see lib/prices.mjs.`;

const fail = message => { console.error(`cca: ${message}\nRun "cca help" for usage.`); process.exit(2); };

function options(args) {
  try {
    return parseArgs({args, allowPositionals: true, options: {
      days: {type: 'string'}, project: {type: 'string'}, json: {type: 'boolean'}, port: {type: 'string'},
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

const [command, ...rest] = process.argv.slice(2);
const {values, positionals} = options(rest);
const root = values.transcripts || transcriptRoot(), home = dataDir();

if (!command || command === 'help' || values.help) console.log(HELP);
else if (command === 'serve') {
  const port = count(values.port, 7319, 'port', 0), days = count(values.days, 30, 'days');
  const server = createServer({root, dataDir: home, days});
  server.on('error', error => fail(error.code === 'EADDRINUSE' ? `port ${port} is in use; try --port 0.` : error.message));
  server.listen(port, '127.0.0.1', () => console.log(`Context Adviser For Claude: http://127.0.0.1:${server.address().port}/ (last ${days} days; Ctrl+C to stop)`));
} else if (command === 'collect') {
  const data = await collect({root, days: count(values.days, 30, 'days')});
  const json = JSON.stringify(data) + '\n';
  if (values.out) { await fs.writeFile(values.out, json); console.error(`Wrote ${data.calls} calls from ${data.files} transcripts to ${values.out}`); }
  else process.stdout.write(json);
} else if (command === 'summary') {
  const days = count(values.days, 7, 'days'), changes = await readChanges(home);
  // Enough history for the previous window and for every recorded change.
  const data = await collect({root, days: Math.max(days * 2, 30)});
  const summary = summarize(data, {days, project: values.project || null, changes});
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
    } else if (action === 'remove') {
      const {removed} = await removeChange(home, date, label);
      if (!removed) fail(`no change "${label.trim()}" on ${date}.`);
      console.log(`Removed: ${date} ${label.trim()}`);
    } else fail(`unknown mark action "${action}".`);
  } catch (error) { fail(error.message); }
} else fail(`unknown command "${command}".`);
