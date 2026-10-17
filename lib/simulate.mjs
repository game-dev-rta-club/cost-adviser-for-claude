// Replay recent conversations as if one change had been in place, and compare
// the cost: what a proposal would have saved on the user's own numbers.
import {callCost, callPrice, summaryCost} from './prices.mjs';
import {matchesTool} from './tooltree.mjs';

// Tool results are counted in characters; a sample of large results grew the
// context by about one token per 2.75 characters.
export const RESULT_CHARS_PER_TOKEN = 2.75;
// Used when no conversation compacted, so there is nothing to measure.
const FALLBACK_AFTER_COMPACT = 60000;
// Used when there are no subagents to measure: the context a fresh agent
// starts with, of which the part already in the cache (the instructions and
// tools subagents share), and the size of the report it hands back, in tokens.
export const FALLBACK_FRESH = {start: 43000, cached: 32000, report: 1500};

const contextOf = c => c.input + c.cacheWrite + c.cacheRead;
// A tool or group as the summary names it, e.g. "read" or "bash cat".
const inTool = (key, tools) => !tools?.length || [].concat(tools).some(tool => matchesTool(key, tool));
const average = list => list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0;

// What compaction looks like across all conversations: the length it starts
// at, the context left after it and the summary's size. Also what a subagent
// looks like: the context it starts with and the size of its report.
export function compactionProfile(transcripts) {
  const after = [], summary = [], starts = [], cached = [], reports = [];
  for (const t of transcripts) {
    if (t.sub && t.calls.length) { starts.push(contextOf(t.calls[0])); cached.push(t.calls[0].cacheRead); }
    for (const c of t.calls) {
      for (const u of c.tools) if (u.key === 'agent' && u.result) reports.push(u.result / RESULT_CHARS_PER_TOKEN);
      if (!c.compact) continue;
      after.push(contextOf(c));
      if (c.compact.summaryChars) summary.push(c.compact.summaryChars);
    }
  }
  return {after: average(after) || FALLBACK_AFTER_COMPACT, summaryChars: average(summary),
    fresh: starts.length ? {start: Math.round(average(starts)), cached: Math.round(average(cached)), report: Math.round(average(reports)) || FALLBACK_FRESH.report, measured: true} : FALLBACK_FRESH};
}

// Runs of calls in a row that each use a tool (the work between two replies),
// whose length is from `min` to `max`, as start index -> end index. A run that
// compacts or restarts inside is left out.
function delegatedRuns(calls, {min, max}) {
  const runs = new Map();
  let start = null;
  const close = end => {
    const n = end - start + 1, run = calls.slice(start, end + 1);
    if (n >= min && n <= max && !run.some((c, k) => c.compact || (k && contextOf(c) < contextOf(run[k - 1]) / 2))) runs.set(start, end);
    start = null;
  };
  calls.forEach((c, i) => { if (c.tools.length) start ??= i; else if (start !== null) close(i - 1); });
  if (start !== null) close(calls.length - 1);
  return runs;
}

// The same run done by a fresh agent: it starts at `fresh.start` tokens, of
// which `fresh.cached` are read from the cache, and grows as the run did, with
// the same output.
function freshCost(run, fresh, write1h) {
  const base = contextOf(run[0]);
  let cost = 0, context = null;
  for (const c of run) {
    const p = callPrice({...c, write1h}), ctx = fresh.start + Math.max(0, contextOf(c) - base);
    cost += context === null ? (fresh.cached * p.cacheRead + (ctx - fresh.cached) * p.cacheWrite) / 1e6 : (context * p.cacheRead + Math.max(ctx - context, 0) * p.cacheWrite) / 1e6;
    cost += c.output * p.output / 1e6;
    context = Math.max(ctx, context ?? 0);
  }
  return cost;
}

// Replay one conversation call by call. Each call reads the context so far
// from the cache and writes what was added since the call before; output is
// unchanged. A change can keep only a share of what tool results add
// (`toolResults`), of every tool or only of the tools or groups in `tool`, or compact
// earlier (`compactAt`, in tokens). The conversation
// compacts when its context reaches the length it compacted at before (or
// `compactAt` when lower) and then restarts from the size it had after its own
// compactions (or the usual size across conversations). With `delegate`
// ({min, max}), each run of that many tool calls in a row goes to a fresh
// agent: the call that starts it writes the brief, and the conversation then
// grows only by the agent's report.
export function replay(calls, profile, {compactAt = Infinity, toolResults = 1, tool = null, delegate = null} = {}) {
  const compacted = calls.filter(c => c.compact?.preTokens);
  const limit = Math.min(compacted.length ? average(compacted.map(c => c.compact.preTokens)) : Infinity, compactAt);
  const after = Math.min(average(compacted.map(contextOf)) || profile.after, limit / 2);
  let cost = 0, compactions = 0, context = null;
  // Writes the replay adds are priced like this conversation's own writes.
  const written = calls.reduce((n, c) => n + c.cacheWrite, 0), write1h = written ? calls.reduce((n, c) => n + (c.cacheWrite1h || 0), 0) / written : 0;
  const runs = delegate ? delegatedRuns(calls, delegate) : new Map();
  let handed = -1, reported = false, delegated = 0;
  calls.forEach((c, i) => {
    if (i <= handed) return;
    const p = callPrice({...c, write1h}), ctx = contextOf(c);
    if (context === null) {
      context = ctx;
      cost += (c.input * p.input + c.cacheWrite * p.cacheWrite + c.cacheRead * p.cacheRead) / 1e6;
    } else {
      const before = contextOf(calls[i - 1]);
      if (!c.compact && ctx < before / 2) {
        // A cleared or restarted conversation starts again the same way.
        context = ctx;
        cost += ctx * p.cacheWrite / 1e6;
      } else {
        let added = 0;
        if (reported) added = profile.fresh.report;
        else if (!c.compact) {
          const grew = Math.max(ctx - before, 0);
          const results = calls[i - 1].tools.reduce((n, t) => n + (inTool(t.key, tool) ? t.result || 0 : 0), 0) / RESULT_CHARS_PER_TOKEN;
          added = grew - (1 - toolResults) * Math.min(results, grew);
        }
        if (context + added >= limit) {
          compactions++;
          cost += summaryCost({model: c.model, preTokens: context, summaryChars: profile.summaryChars}) + after * p.cacheWrite / 1e6;
          context = after;
        } else {
          cost += (context * p.cacheRead + added * p.cacheWrite) / 1e6;
          context += added;
        }
      }
    }
    cost += c.output * p.output / 1e6;
    reported = false;
    if (runs.has(i)) {
      handed = runs.get(i);
      cost += freshCost(calls.slice(i, handed + 1), profile.fresh, write1h);
      delegated += handed - i + 1;
      reported = true;
    }
  });
  return {cost, compactions, runs: runs.size, delegated};
}

// Replay every conversation with and without the change.
export function simulate(transcripts, change) {
  const profile = compactionProfile(transcripts);
  const result = {conversations: 0, calls: 0, recorded: 0, base: 0, changed: 0, compactions: {recorded: 0, base: 0, changed: 0}, compactedAt: 0};
  if (change.delegate) result.delegated = {runs: 0, calls: 0, fresh: profile.fresh};
  const starts = [];
  for (const t of transcripts) {
    if (!t.calls.length) continue;
    // Only a main conversation hands work to a fresh agent.
    const base = replay(t.calls, profile), changed = replay(t.calls, profile, t.sub ? {...change, delegate: null} : change);
    if (result.delegated) { result.delegated.runs += changed.runs; result.delegated.calls += changed.delegated; }
    result.conversations++; result.calls += t.calls.length;
    for (const c of t.calls) {
      result.recorded += callCost(c).total + (c.compact ? summaryCost({model: c.model, ...c.compact}) : 0);
      if (c.compact) { result.compactions.recorded++; if (c.compact.preTokens) starts.push(c.compact.preTokens); }
    }
    result.base += base.cost; result.changed += changed.cost;
    result.compactions.base += base.compactions; result.compactions.changed += changed.compactions;
  }
  // The length the conversations really compacted at, on average.
  result.compactedAt = Math.round(average(starts));
  result.lastCall = transcripts.reduce((m, t) => t.calls.reduce((n, c) => Math.max(n, c.ts), m), 0) || null;
  result.cut = result.base ? (result.base - result.changed) / result.base : 0;
  return result;
}
