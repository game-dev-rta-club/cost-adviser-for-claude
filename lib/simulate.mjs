// Replay recent conversations as if one change had been in place, and compare
// the cost: what a proposal would have saved on the user's own numbers.
import {callCost, callPrice, summaryCost} from './prices.mjs';
import {matchesTool} from './tooltree.mjs';

// Tool results are counted in characters; a sample of large results grew the
// context by about one token per 2.75 characters.
export const RESULT_CHARS_PER_TOKEN = 2.75;
// Used when no conversation compacted, so there is nothing to measure.
const FALLBACK_AFTER_COMPACT = 60000;

const contextOf = c => c.input + c.cacheWrite + c.cacheRead;
// A tool or group as the summary names it, e.g. "read" or "bash cat".
const inTool = (key, tools) => !tools?.length || [].concat(tools).some(tool => matchesTool(key, tool));
const average = list => list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0;

// What compaction looks like across all conversations: the length it starts
// at, the context left after it and the summary's size.
export function compactionProfile(transcripts) {
  const after = [], summary = [];
  for (const t of transcripts) for (const c of t.calls) if (c.compact) {
    after.push(contextOf(c));
    if (c.compact.summaryChars) summary.push(c.compact.summaryChars);
  }
  return {after: average(after) || FALLBACK_AFTER_COMPACT, summaryChars: average(summary)};
}

// Replay one conversation call by call. Each call reads the context so far
// from the cache and writes what was added since the call before; output is
// unchanged. A change can keep only a share of what tool results add
// (`toolResults`), of every tool or only of the tools or groups in `tool`, or compact
// earlier (`compactAt`, in tokens). The conversation
// compacts when its context reaches the length it compacted at before (or
// `compactAt` when lower) and then restarts from the size it had after its own
// compactions (or the usual size across conversations).
export function replay(calls, profile, {compactAt = Infinity, toolResults = 1, tool = null} = {}) {
  const compacted = calls.filter(c => c.compact?.preTokens);
  const limit = Math.min(compacted.length ? average(compacted.map(c => c.compact.preTokens)) : Infinity, compactAt);
  const after = Math.min(average(compacted.map(contextOf)) || profile.after, limit / 2);
  let cost = 0, compactions = 0, context = null;
  // Writes the replay adds are priced like this conversation's own writes.
  const written = calls.reduce((n, c) => n + c.cacheWrite, 0), write1h = written ? calls.reduce((n, c) => n + (c.cacheWrite1h || 0), 0) / written : 0;
  calls.forEach((c, i) => {
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
        if (!c.compact) {
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
  });
  return {cost, compactions};
}

// Replay every conversation with and without the change.
export function simulate(transcripts, change) {
  const profile = compactionProfile(transcripts);
  const result = {conversations: 0, calls: 0, recorded: 0, base: 0, changed: 0, compactions: {recorded: 0, base: 0, changed: 0}, compactedAt: 0};
  const starts = [];
  for (const t of transcripts) {
    if (!t.calls.length) continue;
    const base = replay(t.calls, profile), changed = replay(t.calls, profile, change);
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
