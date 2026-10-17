// Keep read transcripts on disk, so a later run reads only what changed.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createCache} from './aggregate.mjs';

// Bump when the shape of a read transcript changes.
const VERSION = 9;
export const cacheFile = dir => path.join(dir, 'cache.json');

export async function loadCache(dir) {
  try {
    const saved = JSON.parse(await fs.readFile(cacheFile(dir), 'utf8'));
    if (saved?.version === VERSION && saved.files && typeof saved.files === 'object') return new Map(Object.entries(saved.files));
  } catch (error) {
    // A missing or broken cache only costs one full read.
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
  }
  return createCache();
}

export async function writeAtomic(file, text) {
  await fs.mkdir(path.dirname(file), {recursive: true});
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, text);
  await fs.rename(tmp, file);
}

export const saveCache = (dir, cache) => writeAtomic(cacheFile(dir), JSON.stringify({version: VERSION, files: Object.fromEntries(cache)}));
