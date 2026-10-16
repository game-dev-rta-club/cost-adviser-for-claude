import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {promisify} from 'node:util';
import {addChange, readChanges, removeChange} from '../lib/changes.mjs';
import {assistant, tempDir, writeTranscript} from './helpers.mjs';
import {createViewer, reportLink} from '../lib/viewer.mjs';
import {checkAdvice} from '../lib/advice.mjs';

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

test('cli: build writes one HTML with the data, reusing unchanged transcripts', async () => {
  const home = await tempDir(), root = await tempDir(), env = {CCA_HOME: home};
  const file = await writeTranscript(root, 'p/s.jsonl', [
    assistant({id: 'm', at: new Date().toISOString(), output: 10, tools: [{id: 't', name: 'Bash', input: {command: 'echo "</script><b>x"; ls'}}]}),
  ]);
  const first = (await cca(['build', '--transcripts', root], env)).stdout;
  assert.match(first, /1 calls from 1 transcripts .*read 1 changed files, reused 0/);
  const html = await fs.readFile(path.join(home, 'report.html'), 'utf8');
  assert.match(html, /<title>Context Adviser For Claude<\/title>/);
  assert.match(html, /window\.CCA=\{/);
  assert.doesNotMatch(html, /cca:data|cca:app|src="data\.js"/);
  // Text from transcripts can never close the data script early.
  assert.equal(html.match(/<\/script>/g).length, 2);
  assert.match((await cca(['build', '--transcripts', root], env)).stdout, /read 0 changed files, reused 1/);
  await fs.appendFile(file, JSON.stringify(assistant({id: 'm2', at: new Date().toISOString(), output: 5})) + '\n');
  assert.match((await cca(['build', '--transcripts', root], env)).stdout, /2 calls .*read 1 changed files/);
  // Recording a change rebuilds the HTML so the tag shows at once.
  const today = new Date().toLocaleDateString('sv-SE');
  assert.match((await cca(['mark', 'add', today, 'Try this', '--transcripts', root], env)).stdout, /Recorded[\s\S]*Wrote/);
  assert.match(await fs.readFile(path.join(home, 'report.html'), 'utf8'), /"changes":\[\{"date":"[\d-]+","label":"Try this"\}\]/);
  // A broken cache only costs a full read.
  await fs.writeFile(path.join(home, 'cache.json'), '{broken');
  assert.match((await cca(['build', '--transcripts', root], env)).stdout, /read 1 changed files, reused 0/);
});

test('links describe one view, and the viewer only sends the built report', async () => {
  assert.equal(reportLink('http://127.0.0.1:7319/', {}), 'http://127.0.0.1:7319/');
  assert.equal(reportLink('http://h/', {project: 'my app', tool: '(final reply)', focus: 'tools', other: 'x'}),
    'http://h/#project=my%20app&tool=%28final%20reply%29&focus=tools');
  const home = await tempDir(), file = path.join(home, 'report.html');
  const server = createViewer(file);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;
  try {
    assert.equal((await fetch(url)).status, 404);
    await fs.writeFile(file, '<title>Context Adviser For Claude</title>');
    const page = await fetch(url);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Context Adviser/);
    assert.equal((await fetch(url + 'report.html')).status, 404);
    assert.equal((await fetch(url + '../cache.json')).status, 404);
    assert.equal((await fetch(url, {method: 'POST'})).status, 405);
  } finally { server.close(); }
});

test('advice: notes are checked, embedded in the report, and can be cleared', async () => {
  assert.throws(() => checkAdvice({}), /notes/);
  assert.throws(() => checkAdvice({notes: [{finding: 'x'}]}), /title is required/);
  assert.throws(() => checkAdvice({notes: [{title: 'x', source: 'javascript:alert(1)'}]}), /http/);
  assert.throws(() => checkAdvice({notes: [{title: 'x', link: {evil: '1'}}]}), /not a link option/);
  const ok = checkAdvice({title: 'Week', notes: [{title: ' Long context ', finding: 'f', advice: 'a', source: 'https://example.com', link: {tool: 'bash cat', date: ''}}]});
  assert.deepEqual(ok.notes[0], {title: 'Long context', finding: 'f', advice: 'a', options: [], source: 'https://example.com', link: {tool: 'bash cat'}});
  assert.deepEqual(checkAdvice({notes: [{title: 'x', options: [{title: ' New conversation ', detail: 'd'}, {title: 'Summarize'}]}]}).notes[0].options,
    [{title: 'New conversation', detail: 'd', ratings: {}}, {title: 'Summarize', detail: undefined, ratings: {}}]);
  assert.throws(() => checkAdvice({notes: [{title: 'x', options: [{detail: 'd'}]}]}), /options\[0\]\.title is required/);
  assert.throws(() => checkAdvice({notes: [{title: 'x', options: 'a'}]}), /must be a list/);
  assert.deepEqual(checkAdvice({notes: [{title: 'x', options: [{title: 'o', ratings: {ease: 'A', safety: 'B', savings: 'A'}}]}]}).notes[0].options[0].ratings, {ease: 'A', safety: 'B', savings: 'A'});
  assert.throws(() => checkAdvice({notes: [{title: 'x', options: [{title: 'o', ratings: {ease: 'D'}}]}]}), /must be A, B or C/);
  assert.throws(() => checkAdvice({notes: [{title: 'x', options: [{title: 'o', ratings: {cost: 'A'}}]}]}), /not a rating/);

  const home = await tempDir(), root = await tempDir(), env = {CCA_HOME: home};
  await writeTranscript(root, 'p/s.jsonl', [assistant({id: 'm', at: new Date().toISOString(), output: 10})]);
  const file = path.join(home, 'notes.json');
  await fs.writeFile(file, JSON.stringify({title: 'Week', notes: [{title: '</script><b>x', finding: 'f'}]}));
  assert.match((await cca(['advise', file, '--transcripts', root], env)).stdout, /Saved 1 notes[\s\S]*#note=1/);
  const html = await fs.readFile(path.join(home, 'report.html'), 'utf8');
  assert.match(html, /"advice":\{"title":"Week"/);
  assert.equal(html.match(/<\/script>/g).length, 2);
  await fs.writeFile(file, '{"notes": [{}]}');
  await assert.rejects(cca(['advise', file, '--transcripts', root], env), e => e.code === 2 && /title is required/.test(e.stderr));
  await cca(['advise', '--clear', '--transcripts', root], env);
  assert.match(await fs.readFile(path.join(home, 'report.html'), 'utf8'), /"advice":null/);
});
