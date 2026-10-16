// Notes an agent writes about the data. They are shown on the report next to
// the items they point at, so the reader does not switch between windows.
import fs from 'node:fs/promises';
import path from 'node:path';
import {writeAtomic} from './cache.mjs';
import {LINK_KEYS} from './viewer.mjs';

export const adviceFile = dir => path.join(dir, 'advice.json');
const text = (v, name, i) => {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'string') throw new Error(`notes[${i}].${name} must be text.`);
  return v.trim();
};

// Keep only what the page understands, and refuse what it could not show safely.
export function checkAdvice(input) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.notes)) throw new Error('Advice needs a "notes" list.');
  const notes = input.notes.map((n, i) => {
    if (!n || typeof n !== 'object') throw new Error(`notes[${i}] must be an object.`);
    const title = text(n.title, 'title', i);
    if (!title) throw new Error(`notes[${i}].title is required.`);
    const source = text(n.source, 'source', i);
    if (source && !/^https?:\/\//.test(source)) throw new Error(`notes[${i}].source must be an http(s) URL.`);
    const link = {};
    for (const [k, v] of Object.entries(n.link || {})) {
      if (!LINK_KEYS.includes(k)) throw new Error(`notes[${i}].link.${k} is not a link option (${LINK_KEYS.join(', ')}).`);
      if (v !== undefined && v !== null && v !== '') link[k] = String(v);
    }
    // Options are shown one by one, so the reader can pick between them.
    if (n.options !== undefined && !Array.isArray(n.options)) throw new Error(`notes[${i}].options must be a list.`);
    const options = (n.options || []).map((o, j) => {
      const t = text(o?.title, `options[${j}].title`, i);
      if (!t) throw new Error(`notes[${i}].options[${j}].title is required.`);
      return {title: t, detail: text(o.detail, `options[${j}].detail`, i)};
    });
    return {title, finding: text(n.finding, 'finding', i), advice: text(n.advice, 'advice', i), options, source, link};
  });
  return {title: typeof input.title === 'string' ? input.title.trim() : undefined, createdAt: new Date().toISOString(), notes};
}

export async function readAdvice(dir) {
  try { return JSON.parse(await fs.readFile(adviceFile(dir), 'utf8')); } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new Error(`Cannot read ${adviceFile(dir)}: ${error.message}`);
  }
}

export const saveAdvice = (dir, advice) => writeAtomic(adviceFile(dir), JSON.stringify(advice, null, 2) + '\n');
export const clearAdvice = dir => fs.rm(adviceFile(dir), {force: true});
