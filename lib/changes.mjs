// The days cost-saving changes went in, so charts and summaries can mark them.
import fs from 'node:fs/promises';
import path from 'node:path';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const changesFile = dir => path.join(dir, 'changes.json');

export async function readChanges(dir) {
  try {
    const list = JSON.parse(await fs.readFile(changesFile(dir), 'utf8'));
    return Array.isArray(list) ? list.filter(c => DATE.test(c?.date) && typeof c.label === 'string') : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new Error(`Cannot read ${changesFile(dir)}: ${error.message}`);
  }
}

async function writeChanges(dir, list) {
  await fs.mkdir(dir, {recursive: true});
  const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
  const file = changesFile(dir), tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(sorted, null, 2) + '\n');
  await fs.rename(tmp, file);
  return sorted;
}

function check(date, label) {
  if (!DATE.test(date || '') || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) throw new Error(`Date must be YYYY-MM-DD: ${date ?? ''}`);
  if (!label?.trim()) throw new Error('A label is required.');
  return label.trim();
}

export async function addChange(dir, date, label) {
  label = check(date, label);
  const list = await readChanges(dir);
  if (list.some(c => c.date === date && c.label === label)) return {added: false, list};
  return {added: true, list: await writeChanges(dir, [...list, {date, label}])};
}

export async function removeChange(dir, date, label) {
  label = check(date, label);
  const list = await readChanges(dir), kept = list.filter(c => !(c.date === date && c.label === label));
  if (kept.length === list.length) return {removed: false, list};
  return {removed: true, list: await writeChanges(dir, kept)};
}
