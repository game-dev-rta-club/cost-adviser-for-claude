import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import test from 'node:test';
import {promisify} from 'node:util';
import {replay, RESULT_CHARS_PER_TOKEN, simulate} from '../lib/simulate.mjs';
import {assistant, result, tempDir, writeTranscript} from './helpers.mjs';

const run = promisify(execFile), cli = new URL('../bin/cca.mjs', import.meta.url).pathname;
const profile = {after: 1000, summaryChars: 4000};
// A conversation whose context grows by `step` tokens a call; tool results
// make up `results` of each step.
const growing = (n, step, results = 0, model = 'claude-opus-5-5') => Array.from({length: n}, (_, i) => ({
  ts: i, model, input: 0, cacheWrite: step, cacheRead: i * step, output: 10,
  tools: [{result: results * RESULT_CHARS_PER_TOKEN}],
}));

test('replay: no change gives back the same cost either way', () => {
  const calls = growing(20, 1000, 600);
  assert.deepEqual(replay(calls, profile), replay(calls, profile, {}));
  const r = simulate([{calls}], {});
  assert.equal(r.cut, 0);
  assert.equal(r.calls, 20);
});

test('replay: shorter tool results save on later calls of a conversation that never compacts', () => {
  const calls = growing(20, 1000, 600), base = replay(calls, profile).cost;
  const shorter = replay(calls, profile, {toolResults: 0.5}).cost, none = replay(calls, profile, {toolResults: 0}).cost;
  assert.ok(shorter < base && none < shorter);
  // Never more than tool results are worth: the rest of the growth stays.
  assert.ok(replay(growing(20, 1000, 0), profile, {toolResults: 0}).cost === replay(growing(20, 1000, 0), profile).cost);
});

test('replay: an earlier compaction length compacts more and reads less', () => {
  const calls = growing(60, 10000);
  const base = replay(calls, profile), early = replay(calls, profile, {compactAt: 200000});
  assert.equal(base.compactions, 0);
  assert.ok(early.compactions >= 2);
  assert.ok(early.cost < base.cost);
});

test('replay: a conversation compacts again at the length it compacted at before', () => {
  const calls = growing(30, 10000);
  calls[10] = {...calls[10], cacheRead: 0, cacheWrite: 20000, compact: {preTokens: 100000, summaryChars: 4000}};
  for (let i = 11; i < 30; i++) calls[i] = {...calls[i], cacheRead: 20000 + (i - 11) * 10000};
  const base = replay(calls, profile), shorter = replay(calls, profile, {toolResults: 0});
  assert.ok(base.compactions >= 2);
  assert.equal(shorter.compactions, base.compactions, 'no tool results here, so nothing changes');
});

test('cli: simulate prints both costs and checks its options', async () => {
  const home = await tempDir(), root = await tempDir(), env = {...process.env, CCA_HOME: home};
  const at = i => new Date(Date.now() - (30 - i) * 60000).toISOString();
  const entries = [];
  for (let i = 0; i < 30; i++) {
    entries.push(assistant({id: `m${i}`, at: at(i), cacheWrite: 3000, cacheRead: i * 3000, output: 20, tools: [{id: `t${i}`, name: 'Read', input: {file_path: '/a'}}]}));
    entries.push(result(`t${i}`, 'x'.repeat(5000)));
  }
  await writeTranscript(root, 'p/s.jsonl', entries);
  const sim = args => run(process.execPath, [cli, 'simulate', '--transcripts', root, ...args], {env});
  const json = JSON.parse((await sim(['--tool-results', '0.5', '--json'])).stdout);
  assert.equal(json.calls, 30);
  assert.ok(json.cut > 0 && json.changed < json.base);
  assert.match((await sim(['--compact-at', '50000'])).stdout, /Cost: \$[\d.,]+ → \$[\d.,]+, [\d.]+% (less|more)\nCompactions: 0 → [1-9]/);
  await assert.rejects(sim([]), e => e.code === 2 && /give a change/.test(e.stderr));
  await assert.rejects(sim(['--tool-results', '2']), e => e.code === 2 && /share from 0 to 1/.test(e.stderr));
  await assert.rejects(sim(['--compact-at', '10']), e => e.code === 2 && /--compact-at/.test(e.stderr));
});
