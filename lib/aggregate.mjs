// Turn transcripts into the rows the Web and the summary read:
// day × project totals, tool uses, sessions and a few examples per tool.
import path from 'node:path';
import {dropCopies, listTranscripts, readTranscript} from './transcripts.mjs';
import {callCost, callPrice, PRICES, PRICES_READ_ON, PRICES_URL, summaryCost} from './prices.mjs';
import {RESULT_CHARS_PER_TOKEN} from './simulate.mjs';

// Gaps between calls longer than this are not counted as active time.
export const ACTIVE_GAP_MS = 5 * 60000;
const EXAMPLES = 5;

export const localDay = ts => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// A worktree counts as its main checkout; temporary folders share one name.
export function projectOf(cwd) {
  if (!cwd) return '(unknown)';
  if (/^\/(private\/)?tmp\//.test(cwd) || /^\/var\/folders\//.test(cwd)) return '(temp)';
  return path.basename(cwd.split('/.claude/worktrees/')[0]);
}

const round = v => Math.round(v * 10000) / 10000;
const get = (map, key, make) => { let v = map.get(key); if (!v) map.set(key, v = make()); return v; };
// Cost is split three ways: input (cacheRead, cacheWrite, input), output and
// compacting (the estimated summary, and rewriting the cache after it).
const emptyDay = (day, project) => ({day, project, calls: 0, cost: 0, cacheRead: 0, cacheWrite: 0, input: 0, output: 0,
  compactions: 0, compactSummary: 0, compactRebuild: 0,
  tokens: {cacheRead: 0, cacheWrite: 0, input: 0, output: 0}, ctx: 0, maxCtx: 0, activeMs: 0, subCalls: 0, subCost: 0,
  byModel: {}, byEffort: {}, byModelEffort: {}});

// Reading is the slow part; unchanged files are reused between collections.
// A cache maps a transcript path to {mtimeMs, size, transcript}.
export function createCache() { return new Map(); }

export async function collect({root, days = 30, now = Date.now(), cache = null} = {}) {
  const since = now - days * 86400000;
  const daily = new Map(), tools = new Map(), sessions = new Map(), examples = new Map(), hooks = new Map();
  let callCount = 0, fileCount = 0, reused = 0, read = 0;
  const transcripts = [];
  for (const {file, mtimeMs, size} of await listTranscripts(root, since)) {
    const hit = cache?.get(file);
    let transcript = hit && hit.mtimeMs === mtimeMs && hit.size === size ? hit.transcript : null;
    if (transcript) reused++;
    else {
      read++;
      // Cached transcripts keep every call; the window is applied below.
      transcript = await readTranscript(file, cache ? 0 : since);
      cache?.set(file, {mtimeMs, size, transcript});
    }
    transcripts.push({...transcript, mtimeMs});
  }
  for (const transcript of dropCopies(transcripts)) {
    const calls = transcript.calls.filter(c => c.ts >= since);
    if (!calls.length) continue;
    fileCount++;
    const {session, sub, title} = transcript, project = projectOf(transcript.cwd);
    // Hook text: written to the cache once, then read on every later call
    // until the conversation compacts.
    for (const h of transcript.hooks || []) {
      if (h.ts < since) continue;
      const tokens = h.chars / RESULT_CHARS_PER_TOKEN;
      let cost = 0, reads = 0;
      for (const c of calls) {
        if (c.ts < h.ts) continue;
        if (reads && c.compact) break;
        const p = callPrice(c);
        cost += tokens * (reads ? p.cacheRead : p.cacheWrite) / 1e6; reads++;
      }
      const day = localDay(h.ts), r = get(hooks, `${day}|${project}|${h.event}`, () => ({day, project, hook: h.event, count: 0, chars: 0, cost: 0}));
      r.count++; r.chars += h.chars; r.cost += cost;
    }
    // The project's own folder, where its settings live.
    const folder = transcript.cwd ? transcript.cwd.split('/.claude/worktrees/')[0] : null;
    let last = null;
    for (const call of calls) {
      callCount++;
      const cost = callCost(call), day = localDay(call.ts), ctx = call.input + call.cacheWrite + call.cacheRead;
      // The first call after a compaction writes the new, short conversation
      // to the cache; that write belongs to the compaction.
      const summary = call.compact ? summaryCost({model: call.model, ...call.compact}) : 0, rebuild = call.compact ? cost.cacheWrite : 0;
      cost.cacheWrite -= rebuild; cost.total += summary; cost.compact = summary + rebuild;
      const gap = last === null ? 0 : Math.min(call.ts - last, ACTIVE_GAP_MS);
      last = call.ts;
      const row = get(daily, `${day}|${project}`, () => emptyDay(day, project));
      row.calls++; row.cost += cost.total; row.ctx += ctx; row.maxCtx = Math.max(row.maxCtx, ctx); row.activeMs += gap;
      if (sub) { row.subCalls++; row.subCost += cost.total; }
      for (const k of ['cacheRead', 'cacheWrite', 'input', 'output']) { row[k] += cost[k]; row.tokens[k] += call[k]; }
      if (call.compact) { row.compactions++; row.compactSummary += summary; row.compactRebuild += rebuild; }
      const model = call.model.replace(/^claude-/, '');
      for (const [field, name] of [['byModel', model], ['byEffort', call.effort], ['byModelEffort', `${model} · ${call.effort}`]]) {
        const m = row[field][name] ||= {cost: 0, calls: 0};
        m.cost += cost.total; m.calls++;
      }
      const s = get(sessions, `${day}|${project}|${session}`, () => ({day, project, folder, session, title, sub, calls: 0, cost: 0, maxCtx: 0, activeMs: 0, first: call.ts, last: call.ts}));
      s.calls++; s.cost += cost.total; s.activeMs += gap; s.maxCtx = Math.max(s.maxCtx, ctx); s.last = call.ts;
      // A call's cost is shared equally among the tools it asked for. A call
      // with no tool ends the turn: it is the final reply.
      // compacting has its own row.
      const uses = call.tools.length ? call.tools : [{key: '(final reply)', label: '', result: 0}];
      const share = (cost.total - cost.compact) / uses.length;
      const parts = uses.map(use => [use, share]);
      if (call.compact) parts.push([{key: '(compacting)', label: '', result: 0}, cost.compact]);
      for (const [use, part] of parts) {
        // By session too, so the report can show one session's actions.
        const k = `${day}|${project}|${use.key}`;
        const t = get(tools, `${k}|${session}`, () => ({day, project, session, tool: use.key, count: 0, resultChars: 0, cost: 0}));
        t.count++; t.resultChars += use.result; t.cost += part;
        if (use.key.startsWith('(')) continue;
        const list = get(examples, k, () => []);
        // A call that wrote most of its context to the cache again (the cache
        // had expired) costs far more than the tool itself.
        list.push({at: new Date(call.ts).toISOString(), session, label: use.label, result: use.result, ctx, cost: share,
          ...(call.cacheWrite > ctx / 2 && ctx > 20000 ? {rebuild: true} : {})});
        if (list.length > EXAMPLES * 2) { list.sort((a, b) => b.result - a.result); list.length = EXAMPLES; }
      }
    }
  }
  const ex = {};
  for (const [k, list] of examples) ex[k] = list.sort((a, b) => b.result - a.result).slice(0, EXAMPLES).map(e => ({...e, cost: round(e.cost)}));
  const money = r => ({...r, cost: round(r.cost)});
  return {
    generatedAt: new Date(now).toISOString(), days, prices: {url: PRICES_URL, readOn: PRICES_READ_ON, models: PRICES.map(({match, ...p}) => p)}, files: fileCount, calls: callCount, read, reused,
    daily: [...daily.values()].map(r => ({...r, cost: round(r.cost), subCost: round(r.subCost), cacheRead: round(r.cacheRead),
      cacheWrite: round(r.cacheWrite), input: round(r.input), output: round(r.output),
      compactSummary: round(r.compactSummary), compactRebuild: round(r.compactRebuild)})),
    tools: [...tools.values()].map(money),
    sessions: [...sessions.values()].map(money),
    hooks: [...hooks.values()].map(money),
    examples: ex,
  };
}
