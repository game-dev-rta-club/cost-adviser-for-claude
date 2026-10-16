import os from 'node:os';
import path from 'node:path';

// Claude Code keeps one JSONL transcript per conversation under <config>/projects.
export function transcriptRoot(env = process.env) {
  const config = env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  return path.join(config, 'projects');
}

// Our own small state (the recorded changes) lives apart from Claude's files.
export function dataDir(env = process.env) {
  return env.CCA_HOME || path.join(os.homedir(), '.context-adviser-for-claude');
}
