// Keep read transcripts on disk, so a later run reads only what changed.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createCache} from './aggregate.mjs';

// Bump when the shape of a read transcript changes.
export const VERSION = 15;
// What changed in how calls are read or named, for the note in the summary.
export const DATA_CHANGES = {
  12: 'heredoc text no longer decides a command\'s group (python writing a file that mentions chill is not a chill call)',
  13: 'scripts and other CLIs keep their subcommand (bash node tool.mjs run, bash uloop compile)',
  14: '"cat > file" and tee count as "(write)", not as reads',
  15: 'a chill call is a step that runs chill; a chill path inside another command (pgrep -f "…chill.mjs connection wait") no longer counts',
};
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
