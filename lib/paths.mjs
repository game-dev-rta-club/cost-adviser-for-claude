import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// Claude Code keeps one JSONL transcript per conversation under <config>/projects.
export function transcriptRoot(env = process.env) {
  const config = env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  return path.join(config, 'projects');
}

// Our own small state (the recorded changes) lives apart from Claude's files.
export function dataDir(env = process.env) {
  return env.CCA_HOME || path.join(os.homedir(), '.cost-adviser-for-claude');
}

// Where to read transcripts: this machine's, then the folders listed in
// $CCA_HOME/sources.json, e.g. copies of another machine's transcripts:
// {"machine": "MacBookPro", "transcripts": [{"machine": "MacMini", "dir": "~/remote-logs/MacMini/.claude/projects"}]}
// Each is named after its machine, so the summary can tell them apart.
export async function transcriptSources(dir, env = process.env) {
  let config;
  try { config = JSON.parse(await fs.readFile(path.join(dir, 'sources.json'), 'utf8')); } catch (error) {
    if (error.code === 'ENOENT') return [{dir: transcriptRoot(env), machine: null}];
    throw new Error(`could not read ${path.join(dir, 'sources.json')}: ${error.message}`);
  }
  const home = p => p.replace(/^~(?=\/|$)/, os.homedir());
  return [{dir: transcriptRoot(env), machine: config.machine || os.hostname().replace(/\.local$/, '')},
    ...(config.transcripts || []).map(t => ({dir: home(t.dir), machine: t.machine || t.dir}))];
}
