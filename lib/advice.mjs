// Improvement proposals an agent keeps for the user. The report lists them under
// the projects; each run of the adviser rewrites the list, and an item keeps its
// dates while its content stays the same, so the reader sees what is new.
import fs from 'node:fs/promises';
import path from 'node:path';
import {writeAtomic} from './cache.mjs';
import {LINK_KEYS} from './viewer.mjs';

export const adviceFile = dir => path.join(dir, 'advice.json');
// Each proposal gets 1–5 stars on these (criteria: the skill's ratings.md).
// `safety` is how well the work keeps its quality.
export const RATINGS = ['ease', 'safety', 'savings'];
// The overall rating is the average of the three to one decimal place, but
// never above the quality stars: a proposal that costs quality stays low
// however much it saves.
export const stars = ratings => Math.min(ratings.safety, Math.round(RATINGS.reduce((s, k) => s + ratings[k], 0) / RATINGS.length * 10) / 10);
const CONTENT = ['action', 'detail', 'news', 'project', 'source'];

const text = (v, name, i) => {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'string') throw new Error(`proposals[${i}].${name} must be text.`);
  return v.trim() || undefined;
};

// Keep only what the page understands, and refuse what it could not show safely.
function checkProposal(p, i) {
  if (!p || typeof p !== 'object') throw new Error(`proposals[${i}] must be an object.`);
  const id = text(p.id, 'id', i);
  if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error(`proposals[${i}].id is required: a short slug like "sonnet-for-routine-work", kept the same across runs.`);
  const action = text(p.action, 'action', i);
  if (!action) throw new Error(`proposals[${i}].action is required: what to do, in one line.`);
  const ratings = {};
  for (const k of RATINGS) {
    const v = p.ratings?.[k];
    if (!Number.isInteger(v) || v < 1 || v > 5) throw new Error(`proposals[${i}].ratings.${k} must be 1 to 5 stars.`);
    ratings[k] = v;
  }
  for (const k of Object.keys(p.ratings || {})) if (!RATINGS.includes(k)) throw new Error(`proposals[${i}].ratings.${k} is not a rating (${RATINGS.join(', ')}).`);
  const source = text(p.source, 'source', i);
  if (source && !/^https?:\/\//.test(source)) throw new Error(`proposals[${i}].source must be an http(s) URL.`);
  const link = {};
  for (const [k, v] of Object.entries(p.link || {})) {
    if (!LINK_KEYS.includes(k)) throw new Error(`proposals[${i}].link.${k} is not a link option (${LINK_KEYS.join(', ')}).`);
    if (v !== undefined && v !== null && v !== '') link[k] = String(v);
  }
  return {id, action, detail: text(p.detail, 'detail', i), news: text(p.news, 'news', i), project: text(p.project, 'project', i), ratings, source, link};
}

const same = (a, b) => CONTENT.every(k => a[k] === b[k]) && RATINGS.every(k => a.ratings[k] === b.ratings[k]) && JSON.stringify(a.link) === JSON.stringify(b.link);

// The new list replaces the old one. A proposal with the same id and content
// keeps its dates; a changed one is marked updated today.
export function checkAdvice(input, previous = null, today) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.proposals)) throw new Error('Advice needs a "proposals" list.');
  const before = new Map((previous?.proposals || []).map(p => [p.id, p]));
  const seen = new Set(), changes = {added: [], updated: [], kept: [], removed: []};
  const proposals = input.proposals.map((raw, i) => {
    const p = checkProposal(raw, i), old = before.get(p.id);
    if (seen.has(p.id)) throw new Error(`proposals[${i}].id "${p.id}" is used twice.`);
    seen.add(p.id);
    const unchanged = old && same(p, old);
    changes[!old ? 'added' : unchanged ? 'kept' : 'updated'].push(p.id);
    return {...p, stars: stars(p.ratings), since: old?.since || today, updated: unchanged ? old.updated : today};
  });
  for (const id of before.keys()) if (!seen.has(id)) changes.removed.push(id);
  return {advice: {updatedAt: new Date().toISOString(), proposals}, changes};
}

export async function readAdvice(dir) {
  try {
    const advice = JSON.parse(await fs.readFile(adviceFile(dir), 'utf8'));
    // Notes from before the proposals list are not shown any more.
    return Array.isArray(advice?.proposals) ? advice : null;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new Error(`Cannot read ${adviceFile(dir)}: ${error.message}`);
  }
}

export const saveAdvice = (dir, advice) => writeAtomic(adviceFile(dir), JSON.stringify(advice, null, 2) + '\n');
export const clearAdvice = dir => fs.rm(adviceFile(dir), {force: true});
