// A compact read of collected data for an agent: this window against the one
// before it, where the cost went, and each recorded change before vs after.
import {localDay} from './aggregate.mjs';
import {tokens, toolTree, treeLines} from './tooltree.mjs';

// Ratios from a small sample mislead; below these they are left out.
export const MIN_ACTIVE_MS = 10 * 60000;
export const MIN_CALLS = 10;

export function totals(rows) {
  const t = {calls: 0, cost: 0, activeMs: 0, ctx: 0, subCalls: 0, compactions: 0, input: 0, output: 0, compacting: 0, cacheRead: 0, cacheWrite: 0,
    tokens: {cacheRead: 0, cacheWrite: 0, input: 0, output: 0}};
  for (const r of rows) {
    for (const k of ['calls', 'cost', 'activeMs', 'ctx', 'subCalls', 'compactions']) t[k] += r[k] || 0;
    t.input += (r.cacheRead || 0) + (r.cacheWrite || 0) + (r.input || 0);
    t.output += r.output || 0;
    t.cacheRead += r.cacheRead || 0; t.cacheWrite += r.cacheWrite || 0;
    t.compacting += (r.compactSummary || 0) + (r.compactRebuild || 0);
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
    compactingPerHour: t.compacting / (t.activeMs / 3600000),
  } : null;
  // Where the cost went. Compacting is partly estimated (see prices.mjs).
  // Input includes the cache: reading it and writing to it.
  const split = {input: t.input, cacheRead: t.cacheRead, cacheWrite: t.cacheWrite, output: t.output, compacting: t.compacting, compactions: t.compactions};
  return {calls: t.calls, cost: t.cost, activeMs: t.activeMs, subCalls: t.subCalls, split, ratios};
}

const dayOffset = (day, n) => { const d = new Date(`${day}T00:00`); d.setDate(d.getDate() + n); return localDay(d.getTime()); };
const between = (rows, from, to) => rows.filter(r => r.day >= from && r.day <= to);
const change = (now, before) => (now == null || before == null || before === 0) ? null : now / before - 1;
// Shares change by percentage points, not by a ratio of ratios.
export const POINTS = new Set(['cacheHitRate', 'subagentCallShare']);

function compare(now, before) {
  const out = {};
  for (const k of ['cost', 'calls', 'activeMs']) out[k] = change(now[k], before[k]);
  for (const k of ['input', 'cacheRead', 'cacheWrite', 'output', 'compacting', 'compactions']) out[k] = change(now.split[k], before.split[k]);
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

const dayList = (from, to) => { const out = []; for (let d = from; d <= to; d = dayOffset(d, 1)) out.push(d); return out; };
const inTool = (r, tool) => r.tool === tool || tokens(r.tool).some(t => t.id === tool);

export function summarize(data, {days = 7, project = null, changes = [], today = localDay(Date.now()), tool = null, declined = [], advice = null} = {}) {
  const pick = r => !project || r.project === project;
  const daily = data.daily.filter(pick), from = dayOffset(today, -(days - 1)), prevFrom = dayOffset(from, -days), prevTo = dayOffset(from, -1);
  const current = totals(between(daily, from, today)), previous = totals(between(daily, prevFrom, prevTo));
  const tools = data.tools.filter(r => pick(r) && r.day >= from && r.day <= today);
  const toolCost = tools.reduce((s, r) => s + r.cost, 0);
  // The same views the report has: each day, cost by model and effort, and
  // tool use as a tree whose groups add up.
  const byDay = dayList(from, today).map(day => {
    const rows = daily.filter(r => r.day === day), t = totals(rows), models = {};
    for (const r of rows) for (const [name, v] of Object.entries(r.byModelEffort || {})) models[name] = (models[name] || 0) + v.cost;
    return {day, ...t, models: Object.entries(models).sort((a, b) => b[1] - a[1]).map(([name, cost]) => ({name, cost, share: t.cost ? cost / t.cost : 0}))};
  });
  const models = {};
  for (const r of between(daily, from, today)) for (const [name, v] of Object.entries(r.byModelEffort || {})) {
    const m = models[name] ||= {name, cost: 0, calls: 0}; m.cost += v.cost; m.calls += v.calls;
  }
  const window = between(daily, from, today), windowCost = window.reduce((s, r) => s + r.cost, 0);
  // One tool or group in detail: each day, and the uses that cost most.
  let toolDetail = null;
  if (tool) {
    const rows = tools.filter(r => inTool(r, tool));
    toolDetail = {tool, days: byDay.map(d => {
      const day = rows.filter(r => r.day === d.day), cost = day.reduce((s, r) => s + r.cost, 0), uses = day.reduce((s, r) => s + r.count, 0);
      const all = tools.filter(r => r.day === d.day).reduce((s, r) => s + r.cost, 0);
      const hours = d.ratios ? d.activeMs / 3600000 : null;
      return {day: d.day, cost, uses, share: all ? cost / all : 0, perActiveHour: hours ? cost / hours : null, usesPerActiveHour: hours ? uses / hours : null};
    }), examples: rows.flatMap(r => data.examples?.[`${r.day}|${r.project}|${r.tool}`] || []).sort((a, b) => b.cost - a.cost).slice(0, 8)};
  }
  const sessions = data.sessions.filter(r => pick(r) && r.day >= from && r.day <= today);
  // Each project's cost and the folder its settings are in.
  const projects = {};
  for (const r of sessions) {
    const p = projects[r.project] ||= {project: r.project, folder: r.folder || null, cost: 0, calls: 0};
    p.cost += r.cost; p.calls += r.calls; p.folder ||= r.folder || null;
  }
  // Each change: the same number of days before it and from it on.
  const effects = changes.filter(c => c.date > dayOffset(today, -data.days) && c.date <= today).map(c => {
    const span = Math.min(days, Math.max(1, Math.round((Date.parse(`${today}T00:00`) - Date.parse(`${c.date}T00:00`)) / 86400000) + 1));
    const after = totals(between(daily, c.date, dayOffset(c.date, span - 1)));
    const before = totals(between(daily, dayOffset(c.date, -span), dayOffset(c.date, -1)));
    return {...c, days: span, before, after, change: compare(after, before), includesToday: dayOffset(c.date, span - 1) === today};
  });
  if (toolDetail) {
    // The tool around each recorded change, and its parts one level down.
    const allTools = data.tools.filter(pick), hoursIn = (a, b) => between(daily, a, b).reduce((s, r) => s + r.activeMs, 0) / 3600000;
    const side = (a, b) => {
      const rows = allTools.filter(r => r.day >= a && r.day <= b), mine = rows.filter(r => inTool(r, tool)), hours = hoursIn(a, b);
      const cost = mine.reduce((s, r) => s + r.cost, 0), all = rows.reduce((s, r) => s + r.cost, 0), uses = mine.reduce((s, r) => s + r.count, 0);
      return {cost, uses, share: all ? cost / all : 0, usesPerActiveHour: hours * 3600000 >= MIN_ACTIVE_MS ? uses / hours : null};
    };
    toolDetail.changes = effects.map(e => ({date: e.date, label: e.label, days: e.days, includesToday: e.includesToday,
      before: side(dayOffset(e.date, -e.days), dayOffset(e.date, -1)), after: side(e.date, dayOffset(e.date, e.days - 1))}));
    const parts = new Map(), hours = current.activeMs / 3600000;
    for (const r of tools.filter(r => inTool(r, tool))) {
      const ts = tokens(r.tool), i = ts.findIndex(t => t.id === tool), id = i < 0 || i === ts.length - 1 ? r.tool : ts[i + 1].id;
      const p = parts.get(id) || {id, cost: 0, uses: 0}; p.cost += r.cost; p.uses += r.count; parts.set(id, p);
    }
    toolDetail.parts = [...parts.values()].sort((a, b) => b.cost - a.cost).slice(0, 10).map(p => ({...p, usesPerActiveHour: current.ratios ? p.uses / hours : null}));
  }
  return {
    window: {from, to: today, days}, asOf: data.generatedAt, previousWindow: {from: prevFrom, to: prevTo}, project: project || 'all',
    current, previous, change: compare(current, previous),
    byDay,
    models: Object.values(models).sort((a, b) => b.cost - a.cost).map(m => ({...m, share: windowCost ? m.cost / windowCost : 0})),
    projects: Object.values(projects).sort((a, b) => b.cost - a.cost).map(p => ({...p, share: windowCost ? p.cost / windowCost : 0})),
    toolTree: treeLines(toolTree(tools)),
    toolDetail,
    tools: top(tools, r => r.tool, 10).map(([tool, t]) => ({tool, cost: t.cost, share: toolCost ? t.cost / toolCost : 0, uses: t.count})),
    sessions: top(sessions, r => r.session, 5).map(([session, t]) => ({session, title: t.rows[0].title, project: t.rows[0].project,
      sub: t.rows[0].sub, cost: t.cost, calls: t.count, activeMs: t.rows.reduce((s, r) => s + r.activeMs, 0)})),
    changes: effects,
    // What the user already decided, and the proposals now shown, so advice
    // neither repeats a declined option nor rewrites what has not changed.
    declined,
    proposals: advice?.proposals || [],
    thresholds: {minActiveMinutes: MIN_ACTIVE_MS / 60000, minCalls: MIN_CALLS},
  };
}

const usd = v => `$${v.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
// Long paths hide the command: the home folder becomes ~ and long hashes are cut.
const HOME = process.env.HOME || '';
const shortLabel = s => (HOME ? s.split(HOME).join('~') : s).replace(/\b([0-9a-f]{8})[0-9a-f]{12,}\b/g, '$1…');
const localTime = iso => { const d = new Date(iso), p = n => String(n).padStart(2, '0'); return `${localDay(d.getTime())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const hrs = ms => `${(ms / 3600000).toFixed(1)}h`;
const pct = v => v == null ? '–' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(0)}%`;
const pt = v => v == null ? '–' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}pt`;
const share = v => `${(v * 100).toFixed(0)}%`;
const tok = v => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : `${Math.round(v)}`;
const RATIOS = [['costPerHour', 'Cost / active hour', v => `${usd(v)}/h`], ['costPerCall', 'Cost / call', usd],
  ['avgContext', 'Avg context', tok], ['cacheHitRate', 'Cache hit rate', share], ['subagentCallShare', 'Subagent calls', share],
  ['compactingPerHour', 'Compacting / active hour', v => `${usd(v)}/h`]];

function block(t, diff) {
  const lines = [`  Cost ${usd(t.cost)} (${pct(diff?.cost)})  Calls ${t.calls} (${pct(diff?.calls)})  Active ${hrs(t.activeMs)} (${pct(diff?.activeMs)})`];
  const s = t.split, of = v => t.cost ? share(v / t.cost) : '0%';
  lines.push(`  Input ${usd(s.input)} ${of(s.input)} (${pct(diff?.input)}), of which cache read ${usd(s.cacheRead)} ${of(s.cacheRead)} (${pct(diff?.cacheRead)}) and cache write ${usd(s.cacheWrite)} ${of(s.cacheWrite)} (${pct(diff?.cacheWrite)})`);
  lines.push(`  Output ${usd(s.output)} ${of(s.output)} (${pct(diff?.output)})  Compacting ${usd(s.compacting)} ${of(s.compacting)}, ${s.compactions}× (${pct(diff?.compacting)}, partly estimated)`);
  if (!t.ratios) lines.push('  Ratios: not enough use to compare.');
  else lines.push('  ' + RATIOS.map(([k, name, f]) => `${name} ${f(t.ratios[k])}${diff ? ` (${(POINTS.has(k) ? pt : pct)(diff[k])})` : ''}`).join('  '));
  return lines;
}

function toolLines(d) {
  const out = ['', `Tool "${d.tool}" by day`, '  day           cost   uses  share     $/h  uses/h'];
  for (const x of d.days) out.push(`  ${x.day} ${usd(x.cost).padStart(10)} ${String(x.uses).padStart(6)} ${share(x.share).padStart(6)} ${(x.perActiveHour == null ? '–' : usd(x.perActiveHour)).padStart(7)} ${(x.usesPerActiveHour == null ? '–' : x.usesPerActiveHour.toFixed(0)).padStart(7)}`);
  if (d.parts?.length > 1) {
    out.push('  Its parts over the whole window:');
    for (const x of d.parts) out.push(`  ${usd(x.cost).padStart(10)} ${String(x.uses).padStart(6)} uses ${(x.usesPerActiveHour == null ? '–' : x.usesPerActiveHour.toFixed(1)).padStart(6)}/h  ${x.id}`);
  }
  for (const c of d.changes || []) {
    const f = s => `${s.usesPerActiveHour == null ? '–' : s.usesPerActiveHour.toFixed(1)} uses/h, ${share(s.share)} of tool cost`;
    out.push(`  Around "${c.label}" (${c.date}, ${c.days} day${c.days === 1 ? '' : 's'} each side): before ${f(c.before)}; after ${f(c.after)}${c.includesToday ? ' (the after side includes today, which is partial)' : ''}`);
  }
  // Turns that end with a reply (and compactions) keep no examples.
  out.push(d.examples.length ? '  Examples, by cost (local time):' : '  No examples: turns that end with a reply, and compactions, keep none.');
  for (const e of d.examples) out.push(`  ${usd(e.cost).padStart(8)}  ${localTime(e.at)}  ${shortLabel(e.label).slice(0, 160)}`);
  return out;
}

export function formatSummary(s) {
  const out = [`Context Adviser For Claude — ${s.window.from} to ${s.window.to} (${s.window.days} days${s.asOf ? `, read at ${localTime(s.asOf)}` : ''}), project: ${s.project}`,
    `Change is against ${s.previousWindow.from} to ${s.previousWindow.to}. Ratios need ${s.thresholds.minActiveMinutes} min and ${s.thresholds.minCalls} calls.`];
  // With --tool, only that tool: the rest is the plain summary.
  if (s.toolDetail) return [...out, ...toolLines(s.toolDetail), '', 'Run without --tool for the whole summary.'].join('\n');
  out.push('',
    'Totals', ...block(s.current, s.change),
    `  Previous period: ${usd(s.previous.cost)}, ${s.previous.calls} calls, ${hrs(s.previous.activeMs)} active${s.previous.ratios ? '' : ' (too little to compare ratios)'}`,
    '', 'By day (ratios left out under 10 min or 10 calls)',
    '  day           cost  calls  active      $/h  context  $/call  cache  compact/h');
  for (const d of s.byDay) {
    const r = d.ratios, cell = (v, f, w) => (r ? f(v) : '–').padStart(w);
    out.push(`  ${d.day} ${usd(d.cost).padStart(10)} ${String(d.calls).padStart(6)} ${hrs(d.activeMs).padStart(7)} ${cell(r?.costPerHour, usd, 8)} ${cell(r?.avgContext, tok, 8)} ${cell(r?.costPerCall, usd, 7)} ${cell(r?.cacheHitRate, share, 6)} ${cell(r?.compactingPerHour, usd, 10)}`);
  }
  out.push('', 'Cost by model · effort');
  for (const m of s.models) out.push(`  ${usd(m.cost).padStart(10)} ${share(m.share).padStart(4)}  ${String(m.calls).padStart(6)} calls  ${m.name}`);
  out.push('  By day:');
  for (const d of s.byDay) if (d.models.length) out.push(`  ${d.day}  ${d.models.slice(0, 3).map(m => `${m.name} ${share(m.share)}`).join(', ')}`);
  out.push('', 'Cost by project (settings are in the folder\'s .claude/)');
  for (const p of s.projects) out.push(`  ${usd(p.cost).padStart(10)} ${share(p.share).padStart(4)}  ${String(p.calls).padStart(6)} calls  ${p.project}${p.folder ? `  ${p.folder}` : ''}`);
  out.push('', 'Tool use as a tree (a group adds up its children; biggest 8, then 5 per group, 3 levels)');
  for (const t of s.toolTree) out.push(`  ${usd(t.cost).padStart(10)} ${share(t.share).padStart(4)} ${String(t.uses).padStart(6)} uses  ${'  '.repeat(t.depth - 1)}${t.id}${t.groups ? ` [${t.groups}]` : ''}`);
  out.push('', 'Top sessions by cost');
  for (const t of s.sessions) out.push(`  ${usd(t.cost).padStart(10)}  ${String(t.calls).padStart(5)} calls  ${hrs(t.activeMs).padStart(6)}  ${t.project}  ${t.title}${t.sub ? ' (subagent)' : ''}  [${t.session}]`);
  if (s.changes.length) {
    out.push('', 'Recorded changes (same number of days before and after)');
    for (const c of s.changes) out.push(`  ${c.date} ${c.label} — ${c.days} day${c.days === 1 ? '' : 's'} each side${c.includesToday ? ' (after includes today, partial)' : ''}; before: ${c.before.calls} calls, ${hrs(c.before.activeMs)} active`, ...block(c.after, c.change));
  }
  if (s.declined?.length) {
    out.push('', 'Declined options (do not propose these or close variants again)');
    for (const d of s.declined) out.push(`  ${d.date}  ${d.option}${d.reason ? ` — ${d.reason}` : ''}`);
  }
  if (s.proposals?.length) {
    out.push('', 'Proposals now shown (keep the id; change one only when the numbers or the advice moved)');
    for (const p of s.proposals) {
      out.push(`  ${p.id}  ★${p.stars}  ${p.title || p.action}${p.project ? `  [${p.project}]` : ''}  (since ${p.since}, updated ${p.updated})`);
      if (p.news) out.push(`    news: ${p.news}`);
    }
  }
  return out.join('\n');
}
