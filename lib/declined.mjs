// Options the user decided against, with why, so an agent does not propose
// them again. A declined option stays out of advice until it is removed.
import fs from 'node:fs/promises';
import path from 'node:path';
import {writeAtomic} from './cache.mjs';
import {localDay} from './aggregate.mjs';

export const declinedFile = dir => path.join(dir, 'declined.json');

export async function readDeclined(dir) {
  try {
    const list = JSON.parse(await fs.readFile(declinedFile(dir), 'utf8'));
    return Array.isArray(list) ? list.filter(d => typeof d?.option === 'string') : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new Error(`Cannot read ${declinedFile(dir)}: ${error.message}`);
  }
}

const save = (dir, list) => writeAtomic(declinedFile(dir), JSON.stringify(list, null, 2) + '\n');

export async function addDeclined(dir, option, reason = '', today = localDay(Date.now())) {
  option = option?.trim();
  if (!option) throw new Error('An option is required.');
  const list = (await readDeclined(dir)).filter(d => d.option !== option);
  list.push({date: today, option, reason: reason.trim()});
  await save(dir, list);
  return list;
}

export async function removeDeclined(dir, option) {
  const list = await readDeclined(dir), kept = list.filter(d => d.option !== option?.trim());
  if (kept.length === list.length) return false;
  await save(dir, kept);
  return true;
}
