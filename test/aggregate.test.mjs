import assert from 'node:assert/strict';
import test from 'node:test';
import {collect, createCache, localDay, projectOf} from '../lib/aggregate.mjs';
import {callCost, summaryCost} from '../lib/prices.mjs';
import {toolKey} from '../lib/transcripts.mjs';
import {assistant, result, tempDir, user, writeTranscript} from './helpers.mjs';

const NOW = Date.parse('2026-10-16T12:00:00');
const at = minutes => new Date(Date.parse('2026-10-16T09:00:00') + minutes * 60000).toISOString();

test('tool keys group similar uses', () => {
  const bash = command => toolKey({name: 'Bash', input: {command}});
  assert.equal(bash('cd /x && FOO=1 git status'), 'bash git status');
  assert.equal(bash('npm run check 2>&1 | tail'), 'bash npm run check');
  assert.equal(bash('node scripts/build.mjs --fast'), 'bash node build.mjs');
  // Inline Python is named by what it does.
  assert.equal(bash("python3 - <<'EOF'\np='a';s=open(p).read()\nopen(p,'w').write(s.replace('x','y'))\nEOF"), 'bash python3 (edit files)');
  assert.equal(bash("python3 - <<'EOF'\np='docs/a.md';s=open(p).read()\nopen(p,'w').write(s.replace('x','y'))\nEOF"), 'bash python3 (edit .md)');
  assert.equal(bash('.venv/bin/python tools/x.py;'), 'bash python3 x.py');
  assert.equal(bash("S=1 python3 - <<EOF\nopen('new.md','w').write('x')\nEOF"), 'bash python3 (write .md)');
  assert.equal(bash("cd x && python3 - <<'EOF'\nfor l in open('/u/.claude/projects/a.jsonl'): pass\nEOF"), 'bash python3 (read transcripts)');
  assert.equal(bash("python3 -c 'import json; print(json.load(open(\"a.json\")))'"), 'bash python3 (read data)');
  assert.equal(bash('python3 -I scripts/run.py --x'), 'bash python3 run.py');
  assert.equal(bash("python3 - <<'EOF'\nimport re\nfor m in re.finditer('x', open('a.html').read()): print(m)\nEOF"), 'bash python3 (read files)');
  assert.equal(bash("python3 - <<'EOF'\nimport math\nprint(math.pi)\nEOF"), 'bash python3 (uses math)');
  assert.equal(bash("python3 -c 'print(1)'"), 'bash python3 (other)');
  assert.equal(bash("git status; python3 - <<'EOF'\nprint(1)\nEOF"), 'bash git status');
  assert.equal(bash("'/a/runtime/chill' connection reply --event 4"), 'bash chill connection reply');
  // Text in a heredoc is not a command.
  assert.equal(bash("python3 - <<'EOF'\nprint('runtime/chill connection inbox')\nEOF"), 'bash python3 (other)');
  assert.equal(bash("cat > a.json <<EOF\n{\"run\": \"chill goal show\"}\nEOF\necho done"), 'bash cat (write)');
  assert.equal(bash("head -2 out.txt; '/a/runtime/chill' connection inbox"), 'bash chill connection inbox');
  // Only a step that runs chill is a chill call; a path inside another command is not.
  assert.equal(bash('pgrep -fl "/a/runtime/chill.mjs connection wait" | wc -l'), 'bash pgrep');
  assert.equal(bash("C='/a b/runtime/chill'; \"$C\" goal show --id 4"), 'bash chill goal show');
  assert.equal(bash("PORT=1 X='/d' '/opt/node' '/a/runtime/chill.mjs' monitor result --id 1"), 'bash chill monitor result');
  assert.equal(bash("chill() { node /a/chill.mjs \"$@\"; }\nchill goal review --id 1"), 'bash chill goal review');
  // A script's subcommand is kept; paths and flags are not.
  assert.equal(bash('node tools/agent-play.mjs sequence --steps 3'), 'bash node agent-play.mjs sequence');
  assert.equal(bash('node tools/agent-play.mjs ./level.json'), 'bash node agent-play.mjs');
  assert.equal(bash('python3 tool.py export out.csv'), 'bash python3 tool.py export');
  // Other tools with subcommands keep them; common commands do not.
  assert.equal(bash('uloop compile --project x'), 'bash uloop compile');
  assert.equal(bash('grep foo file.txt'), 'bash grep');
  assert.equal(bash('cca summary --tool read'), 'bash cca summary');
  assert.equal(bash("cat > notes.md <<'EOF'\nhi\nEOF"), 'bash cat (write)');
  assert.equal(bash('cat a.txt 2>/dev/null'), 'bash cat');
  assert.equal(bash('tee out.log'), 'bash tee (write)');
  assert.equal(bash('for f in *; do grep x $f; done'), 'bash grep');
  assert.equal(toolKey({name: 'mcp__Claude_Browser__navigate'}), 'mcp Browser.navigate');
  assert.equal(toolKey({name: 'Read'}), 'read');
});

test('projects: worktrees join their checkout and temporary folders share a name', () => {
  assert.equal(projectOf('/Users/me/dev/app/.claude/worktrees/x'), 'app');
  assert.equal(projectOf('/private/tmp/scratch'), '(temp)');
  assert.equal(projectOf(null), '(unknown)');
});

test('collect counts each call once and splits its cost', async () => {
  const root = await tempDir();
  const first = {id: 'm1', at: at(0), input: 1000, cacheWrite: 2000, cacheRead: 10000, output: 10, tools: [{id: 't1', name: 'Bash', input: {command: 'git status'}}, {id: 't2', name: 'Read', input: {file_path: '/a'}}]};
  await writeTranscript(root, '-work-app/s1.jsonl', [
    {type: 'custom-title', customTitle: 'Fix login'},
    user('Please fix login'),
    assistant(first),
    // The same message again while it streams, with the final output count.
    assistant({...first, output: 300}),
    result('t1', 'x'.repeat(50)),
    result('t2', [{type: 'text', text: 'abc'}, {type: 'image'}]),
    assistant({id: 'm2', at: at(2), input: 10, cacheRead: 5000, output: 20}),
    // A long pause counts only five minutes of active time.
    assistant({id: 'm3', at: at(60), input: 10, cacheRead: 5000, output: 20}),
    assistant({id: 'm4', at: at(61), model: '<synthetic>', output: 5}),
    'not json',
  ]);
  await writeTranscript(root, '-work-app/s1/subagents/agent-a.jsonl', [
    assistant({id: 'a1', at: at(3), model: 'claude-haiku-5-5', effort: null, input: 100, output: 50}),
  ]);
  const data = await collect({root, days: 30, now: NOW});
  assert.equal(data.calls, 4);
  const [row] = data.daily;
  assert.equal(row.day, localDay(Date.parse(at(0))));
  assert.equal(row.project, 'app');
  assert.equal(row.calls, 4);
  assert.equal(row.subCalls, 1);
  assert.equal(row.tokens.output, 300 + 20 + 20 + 50);
  assert.equal(row.activeMs, (2 + 5) * 60000);
  const expected = [callCost({model: 'claude-opus-5-5', input: 1000, cacheWrite: 2000, cacheRead: 10000, output: 300}),
    callCost({model: 'claude-opus-5-5', input: 10, cacheRead: 5000, output: 20}), callCost({model: 'claude-opus-5-5', input: 10, cacheRead: 5000, output: 20}),
    callCost({model: 'claude-haiku-5-5', input: 100, output: 50})].reduce((s, c) => s + c.total, 0);
  assert.ok(Math.abs(row.cost - expected) < 1e-3);
  assert.deepEqual(Object.keys(row.byModelEffort).sort(), ['haiku-5-5 · (subagent)', 'opus-5-5 · high']);
  // Rows are kept per session; add them up per tool.
  const tools = {};
  for (const t of data.tools) { const a = tools[t.tool] ||= {count: 0, resultChars: 0, sessions: new Set()}; a.count += t.count; a.resultChars += t.resultChars; a.sessions.add(t.session); }
  assert.equal(tools['(final reply)'].sessions.size, 2, 'the main conversation and its subagent');
  assert.equal(tools['bash git status'].count, 1);
  assert.equal(tools['bash git status'].resultChars, 50);
  assert.equal(tools.read.resultChars, 3 + 6400);
  assert.equal(tools['(final reply)'].count, 3);
  const main = data.sessions.find(s => s.session === 's1');
  assert.equal(main.title, 'Fix login');
  assert.equal(main.calls, 3);
  assert.equal(data.sessions.find(s => s.sub).session, 's1/agent-a');
  assert.equal(data.examples[`${row.day}|app|bash git status`][0].label, 'git status');
});

test('collect skips old calls and reuses unchanged transcripts', async () => {
  const root = await tempDir();
  await writeTranscript(root, 'p/s.jsonl', [
    assistant({id: 'old', at: '2026-08-01T09:00:00Z', output: 5}),
    assistant({id: 'new', at: at(0), output: 5}),
  ]);
  const cache = createCache();
  assert.equal((await collect({root, days: 7, now: NOW, cache})).calls, 1);
  assert.equal(cache.size, 1);
  assert.equal((await collect({root, days: 7, now: NOW, cache})).calls, 1);
  assert.equal((await collect({root: `${root}/missing`, days: 7, now: NOW})).calls, 0);
});

test('compaction is split out: the estimated summary and the cache write after it', async () => {
  const root = await tempDir();
  await writeTranscript(root, 'p/s.jsonl', [
    assistant({id: 'm1', at: at(0), cacheRead: 400000, output: 100, tools: [{id: 't1', name: 'Read'}]}),
    {type: 'system', subtype: 'compact_boundary', timestamp: at(1), compactMetadata: {trigger: 'auto', preTokens: 400000, postTokens: 15000}},
    {type: 'user', isCompactSummary: true, message: {role: 'user', content: 'x'.repeat(8000)}},
    assistant({id: 'm2', at: at(2), model: '<synthetic>', output: 1}),
    assistant({id: 'm3', at: at(3), cacheRead: 40000, cacheWrite: 30000, output: 50}),
    assistant({id: 'm4', at: at(4), cacheRead: 70000, cacheWrite: 500, output: 50}),
  ]);
  const data = await collect({root, days: 30, now: NOW});
  const [row] = data.daily;
  const summary = summaryCost({model: 'claude-opus-5-5', preTokens: 400000, summaryChars: 8000});
  const rebuild = callCost({model: 'claude-opus-5-5', cacheWrite: 30000}).total;
  assert.ok(Math.abs(summary - (400000 * 4 * 0.05 + 2000 * 20) / 1e6) < 1e-9);
  assert.equal(row.compactions, 1);
  assert.ok(Math.abs(row.compactSummary - summary) < 1e-3);
  assert.ok(Math.abs(row.compactRebuild - rebuild) < 1e-3);
  // Input, output and compacting add up to the cost; nothing is counted twice.
  const parts = row.cacheRead + row.cacheWrite + row.input + row.output + row.compactSummary + row.compactRebuild;
  assert.ok(Math.abs(parts - row.cost) < 1e-3);
  const tools = Object.fromEntries(data.tools.map(t => [t.tool, t]));
  assert.ok(Math.abs(tools['(compacting)'].cost - summary - rebuild) < 1e-3);
  assert.ok(Math.abs(data.tools.reduce((s, t) => s + t.cost, 0) - row.cost) < 1e-3);
});

test('a cache write after the cache expired is counted apart; a new conversation\'s start and a compaction are not', async () => {
  const root = await tempDir();
  await writeTranscript(root, 'p/s.jsonl', [
    assistant({id: 'm1', at: at(0), cacheRead: 30000, cacheWrite: 10000, output: 10}),
    assistant({id: 'm2', at: at(1), cacheRead: 40000, cacheWrite: 2000, output: 10}),
    // Back after a long break: the whole conversation is written again.
    assistant({id: 'm3', at: at(90), cacheWrite: 42000, output: 10}),
  ]);
  const [row] = (await collect({root, days: 30, now: NOW})).daily;
  assert.ok(Math.abs(row.cacheExpired - callCost({model: 'claude-opus-5-5', cacheWrite: 42000}).total) < 1e-3);
});

test('hook text is counted once and costs a write, then a read per later call until compaction', async () => {
  const root = await tempDir();
  const hook = (uuid, minute) => ({type: 'attachment', uuid, timestamp: at(minute), attachment: {type: 'hook_additional_context', content: ['x'.repeat(2750)], hookEvent: 'PostToolUse'}});
  const entries = [
    assistant({id: 'm1', at: at(0), cacheRead: 1000, output: 10}),
    hook('h1', 1),
    assistant({id: 'm2', at: at(2), cacheRead: 1000, output: 10}),
    assistant({id: 'm3', at: at(3), cacheRead: 1000, output: 10}),
    {type: 'system', subtype: 'compact_boundary', timestamp: at(4), compactMetadata: {trigger: 'auto', preTokens: 3000}},
    assistant({id: 'm4', at: at(5), cacheRead: 1000, output: 10}),
  ];
  await writeTranscript(root, 'p/a.jsonl', entries);
  // A resumed copy repeats the same entries; they count once.
  await writeTranscript(root, 'p/b.jsonl', entries);
  const data = await collect({root, days: 30, now: NOW});
  assert.equal(data.hooks.length, 1);
  const [h] = data.hooks;
  assert.equal(h.hook, 'PostToolUse');
  assert.equal(h.count, 1);
  assert.equal(h.chars, 2750);
  // 1000 tokens: written once on m2, read on m3, gone after the compaction.
  assert.ok(Math.abs(h.cost - (1000 * 4 * 1.25 + 1000 * 4 * 0.05) / 1e6) < 1e-4);
});

test('prices follow the pricing page: per model, 1-hour cache writes, fast mode and long Haiku prompts', () => {
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  // Opus 5.5: $4 in, $20 out, cache hits 0.05x; a 1-hour write is 2x input.
  assert.ok(near(callCost({model: 'claude-opus-5-5', input: 1e6, cacheRead: 1e6, output: 1e6}).total, 4 + 0.2 + 20));
  assert.ok(near(callCost({model: 'claude-opus-5-5', cacheWrite: 1e6, cacheWrite1h: 1e6}).total, 8));
  assert.ok(near(callCost({model: 'claude-opus-5-5', cacheWrite: 1e6}).total, 5));
  assert.ok(near(callCost({model: 'claude-opus-5-5', output: 1e6, speed: 'fast'}).total, 40));
  // A newer version is not priced as its family.
  assert.ok(near(callCost({model: 'claude-sonnet-5-5', input: 1e6, cacheRead: 1e6}).total, 2 + 0.1));
  assert.ok(near(callCost({model: 'claude-sonnet-4-6', input: 1e6, cacheRead: 1e6}).total, 3 + 0.3));
  assert.ok(near(callCost({model: 'claude-opus-4-1-20250805', output: 1e6}).total, 75));
  assert.ok(near(callCost({model: 'claude-haiku-5-5', input: 1e5}).total, 0.01));
  assert.ok(near(callCost({model: 'claude-haiku-5-5', input: 2e5}).total, 0.1));
});
