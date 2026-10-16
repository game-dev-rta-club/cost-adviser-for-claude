import assert from 'node:assert/strict';
import {execFile, spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {promisify} from 'node:util';
import {addChange, readChanges, removeChange} from '../lib/changes.mjs';
import {assistant, tempDir, writeTranscript} from './helpers.mjs';

const run = promisify(execFile), cli = new URL('../bin/cca.mjs', import.meta.url).pathname;
const cca = (args, env) => run(process.execPath, [cli, ...args], {env: {...process.env, ...env}});

test('changes are recorded once, sorted and removable', async () => {
  const dir = await tempDir();
  assert.deepEqual(await readChanges(dir), []);
  await addChange(dir, '2026-10-16', ' Fewer calls ');
  assert.equal((await addChange(dir, '2026-10-16', 'Fewer calls')).added, false);
  await addChange(dir, '2026-10-12', 'Subagents');
  assert.deepEqual((await readChanges(dir)).map(c => c.date), ['2026-10-12', '2026-10-16']);
  await assert.rejects(addChange(dir, '2026-1-1', 'x'), /YYYY-MM-DD/);
  await assert.rejects(addChange(dir, '2026-10-16', ' '), /label/);
  assert.equal((await removeChange(dir, '2026-10-12', 'Subagents')).removed, true);
  assert.equal((await removeChange(dir, '2026-10-12', 'Subagents')).removed, false);
  await fs.writeFile(path.join(dir, 'changes.json'), '{broken');
  await assert.rejects(readChanges(dir), /Cannot read/);
});

test('cli: mark, summary, collect and errors', async () => {
  const home = await tempDir(), root = await tempDir(), env = {CCA_HOME: home};
  const now = new Date();
  await writeTranscript(root, 'p/s.jsonl', [assistant({id: 'm', at: now.toISOString(), output: 10, cwd: '/w/demo'})]);
  assert.match((await cca(['help'])).stdout, /Usage: cca/);
  const today = now.toLocaleDateString('sv-SE');
  assert.match((await cca(['mark', 'add', today, 'First', 'change'], env)).stdout, /Recorded/);
  assert.deepEqual(JSON.parse((await cca(['mark', 'list', '--json'], env)).stdout), [{date: today, label: 'First change'}]);
  const summary = JSON.parse((await cca(['summary', '--json', '--transcripts', root], env)).stdout);
  assert.equal(summary.current.calls, 1);
  assert.equal(summary.changes[0].label, 'First change');
  const out = path.join(home, 'data.json');
  await cca(['collect', '--transcripts', root, '--out', out], env);
  assert.equal(JSON.parse(await fs.readFile(out, 'utf8')).daily[0].project, 'demo');
  await assert.rejects(cca(['nope'], env), e => e.code === 2 && /unknown command/.test(e.stderr));
  await assert.rejects(cca(['summary', '--days', '0'], env), e => e.code === 2 && /--days/.test(e.stderr));
  await assert.rejects(cca(['mark', 'remove', today, 'Missing'], env), e => e.code === 2);
});

test('cli: serve shows the Web view with live data', async () => {
  const home = await tempDir(), root = await tempDir();
  await writeTranscript(root, 'p/s.jsonl', [assistant({id: 'm', at: new Date().toISOString(), output: 10})]);
  const server = spawn(process.execPath, [cli, 'serve', '--port', '0', '--transcripts', root], {env: {...process.env, CCA_HOME: home}});
  try {
    const [chunk] = await once(server.stdout, 'data');
    const url = String(chunk).match(/http:\/\/127\.0\.0\.1:\d+\//)[0];
    const page = await fetch(url);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Context Adviser For Claude/);
    const data = await (await fetch(url + 'data.js')).text();
    assert.match(data, /^window\.CCA=\{/);
    assert.match(data, /"calls":1/);
    assert.deepEqual(await (await fetch(url + 'changes.json')).json(), []);
    assert.equal((await fetch(url + 'secret')).status, 404);
    assert.equal((await fetch(url + 'app.js', {method: 'POST'})).status, 405);
  } finally {
    server.kill();
  }
});
