// Build the Web view as one HTML file with the data inside, so opening it and
// switching views never waits for collection.
import fs from 'node:fs/promises';
import path from 'node:path';
import {collect} from './aggregate.mjs';
import {listTranscripts} from './transcripts.mjs';
import {loadCache, saveCache, writeAtomic} from './cache.mjs';
import {readChanges} from './changes.mjs';
import {readAdvice} from './advice.mjs';

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
  // A shorter window must not evict older transcripts; only deleted ones go.
  const present = new Set((await listTranscripts(root, 0)).map(t => t.file));
  for (const file of cache.keys()) if (!present.has(file)) cache.delete(file);
  await saveCache(dataDir, cache);
  return data;
}

// The transcripts themselves, read through the same cache, for a replay.
// `since` is a timestamp; calls before it are left out.
export async function readTranscriptsCached({root, dataDir, days, since}) {
  await collectCached({root, dataDir, days: days + 1});
  return [...(await loadCache(dataDir)).values()]
    .map(({transcript}) => ({...transcript, calls: transcript.calls.filter(c => c.ts >= since)}))
    .filter(t => t.calls.length);
}

export async function buildReport({root, dataDir, days = 30, out = reportFile(dataDir)}) {
  const started = Date.now();
  const [data, changes, advice] = await Promise.all([collectCached({root, dataDir, days}), readChanges(dataDir), readAdvice(dataDir)]);
  await writeAtomic(out, await renderReport({...data, changes, advice}));
  return {file: out, calls: data.calls, files: data.files, read: data.read, reused: data.reused, ms: Date.now() - started};
}
