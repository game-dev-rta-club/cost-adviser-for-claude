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
  assert.match(html, /<title>Cost Adviser For Claude<\/title>/);
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
    await fs.writeFile(file, '<title>Cost Adviser For Claude</title>');
    const page = await fetch(url);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Cost Adviser/);
    assert.equal((await fetch(url + 'report.html')).status, 404);
    assert.equal((await fetch(url + '../cache.json')).status, 404);
    assert.equal((await fetch(url, {method: 'POST'})).status, 405);
  } finally { server.close(); }
});

test('advice: proposals are checked, keep their dates while unchanged, and show in the report', async () => {
  const AB = {ease: 5, safety: 3, savings: 5};
  const one = p => checkAdvice({proposals: [{id: 'x', title: 'T', summary: 'S', action: 'Do x', ratings: AB, ...p}]}, null, '2026-10-16');
  assert.throws(() => checkAdvice({}), /proposals/);
  assert.throws(() => one({id: 'Bad Id'}), /id is required/);
  assert.throws(() => one({action: ''}), /action is required/);
  assert.throws(() => one({title: ''}), /title is required/);
  assert.throws(() => one({title: 'x'.repeat(41)}), /keep it to 40/);
  assert.throws(() => one({summary: ''}), /summary is required/);
  assert.throws(() => one({summary: 'x'.repeat(201)}), /keep it to 200/);
  assert.throws(() => one({ratings: {ease: 6, safety: 4, savings: 4}}), /must be 1 to 5 stars/);
  assert.throws(() => one({ratings: {ease: 'A', safety: 4, savings: 4}}), /must be 1 to 5 stars/);
  assert.throws(() => one({ratings: {...AB, cost: 4}}), /not a rating/);
  assert.throws(() => one({source: 'javascript:alert(1)'}), /http/);
  assert.throws(() => one({link: {evil: '1'}}), /not a link option/);
  assert.throws(() => checkAdvice({proposals: [{id: 'x', title: 'T', summary: 'S', action: 'a', ratings: AB}, {id: 'x', title: 'T', summary: 'S', action: 'b', ratings: AB}]}), /used twice/);
  const first = one({action: ' Use Sonnet ', detail: 'd', source: 'https://example.com', link: {tool: 'bash cat', date: ''}});
  assert.deepEqual(first.advice.proposals[0], {id: 'x', title: 'T', summary: 'S', action: 'Use Sonnet', detail: 'd', news: undefined, project: undefined, ratings: AB, source: 'https://example.com', link: {tool: 'bash cat'}, stars: 4.2, since: '2026-10-16', updated: '2026-10-16'});
  // The overall rating is the geometric mean to one decimal place.
  assert.equal(one({ratings: {ease: 3, safety: 4, savings: 3}}).advice.proposals[0].stars, 3.3, 'to one decimal place');
  assert.equal(one({ratings: {ease: 5, safety: 5, savings: 4}}).advice.proposals[0].stars, 4.6);
  assert.equal(one({ratings: {ease: 3, safety: 5, savings: 4}}).advice.proposals[0].stars, 3.9);
  assert.equal(one({ratings: {ease: 5, safety: 1, savings: 5}}).advice.proposals[0].stars, 2.9, 'one weak axis pulls it down');
  // A later run: the same content keeps its dates, a change is marked, a gone id is listed.
  const prev = checkAdvice({proposals: [{id: 'same', title: 'T', summary: 'S', action: 'a', ratings: AB}, {id: 'moved', title: 'T', summary: 'S', action: 'b', ratings: AB}, {id: 'gone', title: 'T', summary: 'S', action: 'c', ratings: AB}]}, null, '2026-10-15').advice;
  const next = checkAdvice({proposals: [{id: 'same', title: 'T', summary: 'S', action: 'a', ratings: AB}, {id: 'moved', title: 'T', summary: 'S', action: 'b', news: '82% → 80%', ratings: AB}, {id: 'new', title: 'T', summary: 'S', action: 'd', ratings: AB}]}, prev, '2026-10-16');
  assert.deepEqual(next.changes, {added: ['new'], updated: ['moved'], kept: ['same'], removed: ['gone']});
  assert.deepEqual(next.advice.proposals.map(p => [p.id, p.since, p.updated]), [['same', '2026-10-15', '2026-10-15'], ['moved', '2026-10-15', '2026-10-16'], ['new', '2026-10-16', '2026-10-16']]);

  const home = await tempDir(), root = await tempDir(), env = {CCA_HOME: home};
  await writeTranscript(root, 'p/s.jsonl', [assistant({id: 'm', at: new Date().toISOString(), output: 10})]);
  const file = path.join(home, 'proposals.json');
  await fs.writeFile(file, JSON.stringify({proposals: [{id: 'x', title: 'T', summary: 'S', action: '</script><b>x', ratings: AB}]}));
  const saved = (await cca(['advise', file, '--transcripts', root, '--port', '7400'], env)).stdout;
  assert.match(saved, /Saved 1 proposals\.\n  added: x/);
  assert.match(saved, /★4\.2 T \[new\]\n    http:\/\/127\.0\.0\.1:7400\/#proposal=x\n/);
  const html = await fs.readFile(path.join(home, 'report.html'), 'utf8');
  assert.match(html, /"advice":\{"updatedAt":/);
  assert.equal(html.match(/<\/script>/g).length, 2);
  assert.match((await cca(['summary', '--transcripts', root], env)).stdout, /Proposals now shown[\s\S]*x  ★4.2  T/);
  await fs.writeFile(file, '{"proposals": [{}]}');
  await assert.rejects(cca(['advise', file, '--transcripts', root], env), e => e.code === 2 && /id is required/.test(e.stderr));
  await cca(['advise', '--clear', '--transcripts', root], env);
  assert.match(await fs.readFile(path.join(home, 'report.html'), 'utf8'), /"advice":null/);
});

test('declined options are kept, shown in the summary, and can be allowed again', async () => {
  const home = await tempDir(), root = await tempDir(), env = {CCA_HOME: home};
  await writeTranscript(root, 'p/s.jsonl', [assistant({id: 'm', at: new Date().toISOString(), output: 10})]);
  assert.match((await cca(['decline', 'add', 'autoCompactWindow 200k', '--reason', 'quality drops'], env)).stdout, /Declined: autoCompactWindow 200k/);
  await cca(['decline', 'add', 'autoCompactWindow 200k', '--reason', 'quality drops at 200k'], env);
  const list = JSON.parse((await cca(['decline', 'list', '--json'], env)).stdout);
  assert.deepEqual(list.map(d => [d.option, d.reason]), [['autoCompactWindow 200k', 'quality drops at 200k']]);
  const text = (await cca(['summary', '--transcripts', root], env)).stdout;
  assert.match(text, /Declined options[\s\S]*autoCompactWindow 200k — quality drops at 200k/);
  assert.match((await cca(['decline', 'remove', 'autoCompactWindow 200k'], env)).stdout, /Allowed again/);
  await assert.rejects(cca(['decline', 'remove', 'nope'], env), e => e.code === 2 && /no declined option/.test(e.stderr));
  assert.doesNotMatch((await cca(['summary', '--transcripts', root], env)).stdout, /Declined options/);
});

test('cli: simulate --since starts at a day, and --full-days ends at yesterday', async () => {
  const home = await tempDir(), root = await tempDir(), env = {CCA_HOME: home};
  const now = new Date(), day = n => { const d = new Date(now); d.setDate(d.getDate() + n); return d; };
  await writeTranscript(root, 'p/s.jsonl', [-3, -1, 0].map(n => assistant({id: `m${n}`, at: day(n).toISOString(), cacheRead: 1000, output: 10, cwd: '/w/demo'})));
  const sim = async args => JSON.parse((await cca(['simulate', '--tool-results', '0.5', '--json', '--transcripts', root, ...args], env)).stdout);
  const since = day(-1).toLocaleDateString('sv-SE');
  assert.equal((await sim(['--since', since])).calls, 2);
  const full = await sim(['--since', since, '--full-days']);
  assert.equal(full.calls, 1);
  assert.equal(full.window.from, since);
  assert.equal(full.window.to, since);
  await assert.rejects(cca(['simulate', '--tool-results', '0.5', '--since', since, '--days', '2', '--transcripts', root], env), /--since or --days/);
});

test('cli: a command\'s --help prints only that command and its options', async () => {
  const {execFile} = await import('node:child_process'), {promisify} = await import('node:util');
  const cli = new URL('../bin/cca.mjs', import.meta.url).pathname;
  const {stdout} = await promisify(execFile)(process.execPath, [cli, 'simulate', '--help']);
  assert.match(stdout, /^Usage: cca simulate/);
  assert.match(stdout, /--delegate/);
  assert.match(stdout, /--project <name>/);
  assert.doesNotMatch(stdout, /mark add|--reason/);
});
