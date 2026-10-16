import assert from 'node:assert/strict';
import test from 'node:test';
import {formatSummary, summarize, totals} from '../lib/summary.mjs';

const row = (day, {calls = 100, cost = 10, activeMs = 3600000, subCalls = 0, cacheRead = 900, input = 100} = {}) => ({
  day, project: 'app', calls, cost, activeMs, ctx: calls * 1000, subCalls,
  tokens: {cacheRead, cacheWrite: 0, input, output: 10}});

test('ratios are left out below ten minutes or ten calls', () => {
  assert.equal(totals([row('2026-10-16', {calls: 9})]).ratios, null);
  assert.equal(totals([row('2026-10-16', {activeMs: 9 * 60000})]).ratios, null);
  const t = totals([row('2026-10-16', {calls: 10, cost: 5, activeMs: 30 * 60000, subCalls: 2})]);
  assert.equal(t.ratios.costPerHour, 10);
  assert.equal(t.ratios.costPerCall, 0.5);
  assert.equal(t.ratios.cacheHitRate, 0.9);
  assert.equal(t.ratios.subagentCallShare, 0.2);
});

test('summary compares windows, and each change before and after', () => {
  const data = {days: 30, daily: [
    row('2026-10-12', {cost: 20}), row('2026-10-13', {cost: 20}),
    row('2026-10-14', {cost: 10, subCalls: 10}), row('2026-10-15', {cost: 10, subCalls: 30}),
    {...row('2026-10-15'), project: 'other'},
  ], tools: [
    {day: '2026-10-15', project: 'app', tool: 'bash git status', count: 3, cost: 6},
    {day: '2026-10-14', project: 'app', tool: 'read', count: 9, cost: 2},
    {day: '2026-10-10', project: 'app', tool: 'old', count: 1, cost: 99},
  ], sessions: [
    {day: '2026-10-15', project: 'app', session: 's1', title: 'Fix', sub: false, calls: 5, cost: 4, activeMs: 60000},
  ]};
  const s = summarize(data, {days: 2, project: 'app', today: '2026-10-15', changes: [{date: '2026-10-14', label: 'Use subagents'}, {date: '2026-01-01', label: 'Too old'}]});
  assert.deepEqual(s.window, {from: '2026-10-14', to: '2026-10-15', days: 2});
  assert.equal(s.current.cost, 20);
  assert.equal(s.previous.cost, 40);
  assert.equal(s.change.cost, -0.5);
  // Shares move by percentage points.
  assert.ok(Math.abs(s.change.subagentCallShare - 0.2) < 1e-9);
  assert.deepEqual(s.tools.map(t => t.tool), ['bash git status', 'read']);
  assert.equal(s.tools[0].share, 0.75);
  assert.equal(s.changes.length, 1);
  assert.equal(s.changes[0].days, 2);
  assert.equal(s.changes[0].change.costPerHour, -0.5);
  const text = formatSummary(s);
  assert.match(text, /Cost \$20\.00 \(-50%\)/);
  assert.match(text, /Subagent calls 20% \(\+20\.0pt\)/);
  assert.match(text, /2026-10-14 Use subagents — 2 days each side; before: 200 calls, 2\.0h active/);
  assert.match(text, /Previous period: \$40\.00, 200 calls, 2\.0h active\n/);
  assert.match(text, /Compacting \$0\.00 0%, 0× \(–, partly estimated\)/);
  const withCompact = totals([{...row('2026-10-16', {cost: 10}), output: 1, cacheRead: 7, compactions: 2, compactSummary: 1.5, compactRebuild: 0.5}]);
  assert.deepEqual(withCompact.split, {input: 7, output: 1, compacting: 2, compactions: 2});
});
