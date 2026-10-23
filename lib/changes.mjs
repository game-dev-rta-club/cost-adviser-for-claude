// The days cost-saving changes went in, so charts and summaries can mark them.
import fs from 'node:fs/promises';
import path from 'node:path';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
// The label is the change's title, a few words; what the change was in full
// goes in the detail. Both show when its arrow on the charts is hovered or clicked.
export const MAX_LABEL = 30;

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

// Adding a change already recorded on that day replaces its detail.
export async function addChange(dir, date, label, detail = '') {
  label = check(date, label);
  detail = detail.trim();
  if ([...label].length > MAX_LABEL) throw new Error(`The label is the change's title: keep it to ${MAX_LABEL} characters or fewer, and put the rest in --detail.`);
  const list = await readChanges(dir), entry = {date, label, ...(detail && {detail})};
  const old = list.find(c => c.date === date && c.label === label);
  if (old && (old.detail || '') === detail) return {added: false, updated: false, list};
  return {added: !old, updated: !!old, list: await writeChanges(dir, [...list.filter(c => c !== old), entry])};
}

export async function removeChange(dir, date, label) {
  label = check(date, label);
  const list = await readChanges(dir), kept = list.filter(c => !(c.date === date && c.label === label));
  if (kept.length === list.length) return {removed: false, list};
  return {removed: true, list: await writeChanges(dir, kept)};
}
