// Build the Web view as one HTML file with the data inside, so opening it and
// switching views never waits for collection.
import fs from 'node:fs/promises';
import path from 'node:path';
import {collect} from './aggregate.mjs';
import {loadCache, saveCache, writeAtomic} from './cache.mjs';
import {readChanges} from './changes.mjs';

const WEB = new URL('../web/', import.meta.url);
export const reportFile = dir => path.join(dir, 'report.html');

// Data goes inside a <script>; "<" is escaped so no text can close it early.
const script = code => `<script>${code}</script>`;
// (U+2028/2029 are valid inside JS strings since ES2019.)
const embed = value => JSON.stringify(value).replace(/</g, '\\u003c');

export async function renderReport(data) {
  const [page, app] = await Promise.all([fs.readFile(new URL('index.html', WEB), 'utf8'), fs.readFile(new URL('app.js', WEB), 'utf8')]);
  if (!page.includes('<!--cca:data-->') || !page.includes('<!--cca:app-->')) throw new Error('web/index.html is missing its data or app marker.');
  return page.replace('<!--cca:data-->', () => script(`window.CCA=${embed(data)};`)).replace('<!--cca:app-->', () => script(app.replace(/<\/script/gi, '<\\/script')));
}

// Collect with the disk cache: used by build, mark and summary alike.
export async function collectCached({root, dataDir, days}) {
  const cache = await loadCache(dataDir);
  const data = await collect({root, days, cache});
  await saveCache(dataDir, cache);
  return data;
}

export async function buildReport({root, dataDir, days = 30, out = reportFile(dataDir)}) {
  const started = Date.now();
  const [data, changes] = await Promise.all([collectCached({root, dataDir, days}), readChanges(dataDir)]);
  await writeAtomic(out, await renderReport({...data, changes}));
  return {file: out, calls: data.calls, files: data.files, read: data.read, reused: data.reused, ms: Date.now() - started};
}
