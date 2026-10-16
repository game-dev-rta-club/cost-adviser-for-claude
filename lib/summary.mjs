// A compact read of collected data for an agent: this window against the one
// before it, where the cost went, and each recorded change before vs after.
import {localDay} from './aggregate.mjs';

// Ratios from a small sample mislead; below these they are left out.
export const MIN_ACTIVE_MS = 10 * 60000;
export const MIN_CALLS = 10;

export function totals(rows) {
  const t = {calls: 0, cost: 0, activeMs: 0, ctx: 0, subCalls: 0, tokens: {cacheRead: 0, cacheWrite: 0, input: 0, output: 0}};
  for (const r of rows) {
    for (const k of ['calls', 'cost', 'activeMs', 'ctx', 'subCalls']) t[k] += r[k] || 0;
    for (const k in t.tokens) t.tokens[k] += r.tokens?.[k] || 0;
  }
  const enough = t.activeMs >= MIN_ACTIVE_MS && t.calls >= MIN_CALLS;
  const inputs = t.tokens.cacheRead + t.tokens.cacheWrite + t.tokens.input;
  const ratios = enough ? {
    costPerHour: t.cost / (t.activeMs / 3600000),
    costPerCall: t.cost / t.calls,
    avgContext: t.ctx / t.calls,
    cacheHitRate: inputs ? t.tokens.cacheRead / inputs : 0,
    subagentCallShare: t.subCalls / t.calls,
  } : null;
  return {calls: t.calls, cost: t.cost, activeMs: t.activeMs, subCalls: t.subCalls, ratios};
}

const dayOffset = (day, n) => { const d = new Date(`${day}T00:00`); d.setDate(d.getDate() + n); return localDay(d.getTime()); };
const between = (rows, from, to) => rows.filter(r => r.day >= from && r.day <= to);
const change = (now, before) => (now == null || before == null || before === 0) ? null : now / before - 1;
// Shares change by percentage points, not by a ratio of ratios.
export const POINTS = new Set(['cacheHitRate', 'subagentCallShare']);

function compare(now, before) {
  const out = {};
  for (const k of ['cost', 'calls', 'activeMs']) out[k] = change(now[k], before[k]);
  if (now.ratios && before.ratios) for (const k in now.ratios) out[k] = POINTS.has(k) ? now.ratios[k] - before.ratios[k] : change(now.ratios[k], before.ratios[k]);
  return out;
}

function top(rows, keyOf, limit) {
  const map = new Map();
  for (const r of rows) {
    const k = keyOf(r), t = map.get(k) || {cost: 0, count: 0, rows: []};
    t.cost += r.cost; t.count += r.count ?? r.calls ?? 0; t.rows.push(r);
    map.set(k, t);
  }
  return [...map.entries()].sort((a, b) => b[1].cost - a[1].cost).slice(0, limit);
}

export function summarize(data, {days = 7, project = null, changes = [], today = localDay(Date.now())} = {}) {
  const pick = r => !project || r.project === project;
  const daily = data.daily.filter(pick), from = dayOffset(today, -(days - 1)), prevFrom = dayOffset(from, -days), prevTo = dayOffset(from, -1);
  const current = totals(between(daily, from, today)), previous = totals(between(daily, prevFrom, prevTo));
  const tools = data.tools.filter(r => pick(r) && r.day >= from && r.day <= today);
  const toolCost = tools.reduce((s, r) => s + r.cost, 0);
  const sessions = data.sessions.filter(r => pick(r) && r.day >= from && r.day <= today);
  // Each change: the same number of days before it and from it on.
  const effects = changes.filter(c => c.date > dayOffset(today, -data.days) && c.date <= today).map(c => {
    const span = Math.min(days, Math.max(1, Math.round((Date.parse(`${today}T00:00`) - Date.parse(`${c.date}T00:00`)) / 86400000) + 1));
    const after = totals(between(daily, c.date, dayOffset(c.date, span - 1)));
    const before = totals(between(daily, dayOffset(c.date, -span), dayOffset(c.date, -1)));
    return {...c, days: span, before, after, change: compare(after, before)};
  });
  return {
    window: {from, to: today, days}, previousWindow: {from: prevFrom, to: prevTo}, project: project || 'all',
    current, previous, change: compare(current, previous),
    tools: top(tools, r => r.tool, 10).map(([tool, t]) => ({tool, cost: t.cost, share: toolCost ? t.cost / toolCost : 0, uses: t.count})),
    sessions: top(sessions, r => r.session, 5).map(([session, t]) => ({session, title: t.rows[0].title, project: t.rows[0].project,
      sub: t.rows[0].sub, cost: t.cost, calls: t.count, activeMs: t.rows.reduce((s, r) => s + r.activeMs, 0)})),
    changes: effects,
    thresholds: {minActiveMinutes: MIN_ACTIVE_MS / 60000, minCalls: MIN_CALLS},
  };
}

const usd = v => `$${v.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
const hrs = ms => `${(ms / 3600000).toFixed(1)}h`;
const pct = v => v == null ? '–' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(0)}%`;
const pt = v => v == null ? '–' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}pt`;
const share = v => `${(v * 100).toFixed(0)}%`;
const tok = v => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : `${Math.round(v)}`;
const RATIOS = [['costPerHour', 'Cost / active hour', v => `${usd(v)}/h`], ['costPerCall', 'Cost / call', usd],
  ['avgContext', 'Avg context', tok], ['cacheHitRate', 'Cache hit rate', share], ['subagentCallShare', 'Subagent calls', share]];

function block(t, diff) {
  const lines = [`  Cost ${usd(t.cost)} (${pct(diff?.cost)})  Calls ${t.calls} (${pct(diff?.calls)})  Active ${hrs(t.activeMs)} (${pct(diff?.activeMs)})`];
  if (!t.ratios) lines.push('  Ratios: not enough use to compare.');
  else lines.push('  ' + RATIOS.map(([k, name, f]) => `${name} ${f(t.ratios[k])}${diff ? ` (${(POINTS.has(k) ? pt : pct)(diff[k])})` : ''}`).join('  '));
  return lines;
}

export function formatSummary(s) {
  const out = [`Context Adviser For Claude — ${s.window.from} to ${s.window.to} (${s.window.days} days), project: ${s.project}`,
    `Change is against ${s.previousWindow.from} to ${s.previousWindow.to}. Ratios need ${s.thresholds.minActiveMinutes} min and ${s.thresholds.minCalls} calls.`, '',
    'Totals', ...block(s.current, s.change),
    `  Previous period: ${usd(s.previous.cost)}, ${s.previous.calls} calls, ${hrs(s.previous.activeMs)} active${s.previous.ratios ? '' : ' (too little to compare ratios)'}`,
    '', 'Top tools by cost'];
  for (const t of s.tools) out.push(`  ${usd(t.cost).padStart(10)} ${share(t.share).padStart(4)}  ${String(t.uses).padStart(5)} uses  ${t.tool}`);
  out.push('', 'Top sessions by cost');
  for (const t of s.sessions) out.push(`  ${usd(t.cost).padStart(10)}  ${String(t.calls).padStart(5)} calls  ${hrs(t.activeMs).padStart(6)}  ${t.project}  ${t.title}${t.sub ? ' (subagent)' : ''}  [${t.session}]`);
  if (s.changes.length) {
    out.push('', 'Recorded changes (same number of days before and after)');
    for (const c of s.changes) out.push(`  ${c.date} ${c.label} — ${c.days} day${c.days === 1 ? '' : 's'} each side; before: ${c.before.calls} calls, ${hrs(c.before.activeMs)} active`, ...block(c.after, c.change));
  }
  return out.join('\n');
}
