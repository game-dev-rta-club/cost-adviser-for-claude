// Read Claude Code transcripts into plain calls. One assistant message can be
// written several times while it streams; its usage is counted once.
// Compaction (summarizing a long conversation) is not written as a call: only
// a boundary with the size before it, then the summary. The first call after
// it carries what is known about it, so its cost can be estimated.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const NOT_A_TITLE = /^<|^Caveat|command-name|^This session is being continued|^Stop hook feedback|^chill-agent watcher|^\[Request interrupted/;
// An image in a tool result is counted as this many characters.
const IMAGE_CHARS = 6400;

export async function listTranscripts(root, since) {
  const out = [];
  async function walk(dir) {
    let entries;
    try { entries = await fs.promises.readdir(dir, {withFileTypes: true}); } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return;
      throw error;
    }
    for (const entry of entries) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (entry.name.endsWith('.jsonl')) {
        const stat = await fs.promises.stat(file);
        if (stat.mtimeMs >= since) out.push({file, mtimeMs: stat.mtimeMs, size: stat.size});
      }
    }
  }
  await walk(root);
  return out.sort((a, b) => a.file.localeCompare(b.file));
}

// The command or tool a call used, grouped so that similar uses add up.
const SKIP = new Set(['cd', 'source', 'export', 'echo', 'for', 'while', 'if', 'then', 'do', 'done', 'fi', 'set', 'sleep', 'true', 'printf', 'test', '[', '']);
const CHILL = /runtime\/chill'?|\/chill-agent\.mjs|\bchill (goal|connection|monitor)/;
// An inline Python script (python3 - <<EOF, python3 -c) is named by what it
// does, so its cost can be told apart from other scripts.
const WRITES = /open\([^)]*['"][wa]b?['"]|write_text|write_bytes|\.write\(|json\.dump\(|shutil\.(copy|move)|os\.(remove|rename|unlink)/;
// Edits and writes also name the kind of file, from the first file path in it.
const COMMON = new Set(['sys', 'os', 're', 'json', 'pathlib', 'glob', 'collections', 'time', 'typing', 'import', 'as']);
export function pythonKind(script) {
  if (WRITES.test(script)) {
    const ext = script.match(/['"][^'"\s]*\.([a-z][a-z0-9]{0,4})['"]/i)?.[1]?.toLowerCase();
    return `${/\.replace\(|re\.sub\(|\bedit\(/.test(script) ? 'edit' : 'write'} ${ext ? `.${ext}` : 'files'}`;
  }
  if (/\.claude\/projects|\.jsonl\b/.test(script)) return 'read transcripts';
  if (/json\.load|plistlib|csv\.|sqlite3/.test(script)) return 'read data';
  if (/open\(|read_text|read_bytes/.test(script)) return 'read files';
  if (/subprocess/.test(script)) return 'run commands';
  // Anything else is named by the first module it imports, so new kinds of
  // work get their own row without a rule for each.
  const modules = [...script.matchAll(/^\s*(?:import|from)\s+([\w, ]+)/gm)].flatMap(m => m[1].split(/[\s,]+/)).filter(m => m && !COMMON.has(m));
  return modules.length ? `uses ${modules[0]}` : 'other';
}
export function toolKey(tool) {
  if (tool.name === 'Bash') {
    const command = String(tool.input?.command || '').trim();
    if (CHILL.test(command)) {
      const m = command.match(/\b(goal|connection|monitor|settings)\s+([a-z-]+)/);
      return `bash chill${m ? ` ${m[1]} ${m[2]}` : ''}`;
    }
    // The first command that does real work, past cd/source/for and variable assignments.
    const py = command.match(/(?:^|[\s;&|(])((?:[^\s;&|()]*\/)?python3?)((?:\s+-[A-Za-z]+)*)(?:\s+([^\s;&|)"']+))?/);
    if (py) {
      const flags = py[2].trim().split(/\s+/), arg = py[3] || '';
      const inline = flags.includes('-c') || arg === '-' || arg.startsWith('<') || !arg;
      // Only when Python is the first command that does real work.
      const start = py.index + py[0].indexOf(py[1]);
      const before = command.slice(0, start).split(/&&|\|\||;|\n/).map(p => p.trim().replace(/^(\w+=\S*\s*)+/, '').split(/\s+/)[0]).filter(w => w && !SKIP.has(path.basename(w)));
      if (!before.length) return inline ? `bash python3 (${pythonKind(command.slice(start))})` : `bash python3 ${path.basename(arg)}`;
    }
    for (const part of command.split(/&&|\|\||;|\||\n|\bdo\b|\bthen\b/)) {
      const words = part.trim().replace(/^(\w+=\S*\s*)+/, '').split(/\s+/);
      if (/^\w+=/.test(words[0] || '')) continue;
      const first = path.basename((words[0] || '').replace(/^["']|["']$/g, ''));
      if (SKIP.has(first)) continue;
      const next = words[1];
      if (['git', 'npm', 'gh', 'npx'].includes(first) && next && !next.startsWith('-')) return `bash ${first} ${first === 'npm' && next === 'run' ? `run ${words[2] || ''}`.trim() : next}`;
      if (first === 'node' && next && !next.startsWith('-')) return `bash ${first} ${path.basename(next)}`;
      return `bash ${first}`;
    }
    return 'bash (other)';
  }
  if (tool.name.startsWith('mcp__')) {
    const parts = tool.name.split('__');
    return `mcp ${parts[1].replace(/^Claude_/, '')}.${parts.slice(2).join('_')}`;
  }
  return tool.name.toLowerCase();
}

// A short line that lets a person find the use again in the transcript.
export function toolLabel(tool) {
  const input = tool.input || {};
  if (tool.name === 'Bash') return (input.description ? `${input.description} — ` : '') + String(input.command || '').replace(/\s+/g, ' ').slice(0, 160);
  const detail = input.file_path || input.pattern || input.url || input.description;
  return detail ? `${tool.name}: ${detail}` : tool.name;
}

function resultChars(content) {
  if (typeof content === 'string') return content.length;
  if (!Array.isArray(content)) return 0;
  return content.reduce((n, block) => n + (block?.type === 'text' ? (block.text || '').length : block?.type === 'image' ? IMAGE_CHARS : 0), 0);
}

function promptText(message) {
  const content = message?.content;
  if (typeof content === 'string') return content;
  return Array.isArray(content) ? content.find(x => x?.type === 'text')?.text : null;
}

export async function readTranscript(file, since = 0) {
  const sub = file.split(path.sep).includes('subagents');
  // A subagent keeps its own row, named after the conversation that started it.
  const base = path.basename(file, '.jsonl');
  const session = sub ? `${path.basename(path.dirname(path.dirname(file)))}/${base}` : base;
  const calls = new Map(), uses = new Map(), hooks = [];
  let cwd = null, title = null, customTitle = null, compact = null, lastCompact = null;
  const lines = readline.createInterface({input: fs.createReadStream(file), crlfDelay: Infinity});
  for await (const line of lines) {
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (entry.cwd) cwd ??= entry.cwd;
    if (entry.type === 'custom-title' && entry.customTitle) customTitle = entry.customTitle;
    // Text a hook adds to the conversation; it is read again on every later call.
    if (entry.type === 'attachment' && entry.attachment?.type === 'hook_additional_context' && entry.timestamp) {
      const a = entry.attachment, ts = Date.parse(entry.timestamp);
      const chars = [].concat(a.content ?? []).reduce((n, x) => n + (typeof x === 'string' ? x.length : 0), 0);
      if (ts >= since && chars) hooks.push({id: entry.uuid || `${ts}`, ts, event: a.hookEvent || a.hookName || '(hook)', chars});
      continue;
    }
    if (entry.type === 'system' && entry.subtype === 'compact_boundary') {
      const meta = entry.compactMetadata || {};
      compact = lastCompact = {trigger: meta.trigger || 'auto', preTokens: meta.preTokens || 0, summaryChars: 0};
      continue;
    }
    if (entry.type === 'user' && entry.isCompactSummary && lastCompact && !lastCompact.summaryChars) {
      const content = entry.message?.content;
      lastCompact.summaryChars = typeof content === 'string' ? content.length : resultChars(content);
      continue;
    }
    if (entry.type === 'user') {
      const text = !title && promptText(entry.message);
      if (text && !NOT_A_TITLE.test(text.trim())) title = text.trim().replace(/\s+/g, ' ').slice(0, 70);
      if (Array.isArray(entry.message?.content)) for (const block of entry.message.content) {
        if (block?.type === 'tool_result' && uses.has(block.tool_use_id)) uses.get(block.tool_use_id).result = resultChars(block.content);
      }
    }
    if (entry.type !== 'assistant' || !entry.message?.usage || !entry.timestamp || entry.message.model === '<synthetic>') continue;
    const ts = Date.parse(entry.timestamp);
    if (!(ts >= since)) continue;
    const id = entry.message.id || entry.requestId || `${ts}`, usage = entry.message.usage;
    let call = calls.get(id);
    if (!call) {
      call = {id, ts, model: entry.message.model || '', effort: entry.effort || (sub ? '(subagent)' : '(none)'),
        input: usage.input_tokens || 0, cacheWrite: usage.cache_creation_input_tokens || 0,
        cacheRead: usage.cache_read_input_tokens || 0, output: usage.output_tokens || 0, tools: []};
      if (compact) { call.compact = compact; compact = null; }
      calls.set(id, call);
    } else call.output = Math.max(call.output, usage.output_tokens || 0);
    for (const block of entry.message.content || []) {
      if (block?.type !== 'tool_use' || uses.has(block.id)) continue;
      const use = {key: toolKey(block), label: toolLabel(block), result: 0};
      call.tools.push(use);
      uses.set(block.id, use);
    }
  }
  return {file, session, sub, cwd, title: customTitle || title || '(untitled)',
    calls: [...calls.values()].sort((a, b) => a.ts - b.ts), hooks};
}

// A resumed or forked conversation copies the earlier messages into its own
// file. Count each request once, in the conversation that has it first: the
// one that started earliest, then the one left untouched longest.
export function dropCopies(transcripts) {
  const seen = new Set(), kept = new Map();
  const order = [...transcripts].sort((a, b) => (a.calls[0]?.ts ?? Infinity) - (b.calls[0]?.ts ?? Infinity) || (a.mtimeMs ?? 0) - (b.mtimeMs ?? 0) || a.file.localeCompare(b.file));
  for (const t of order) kept.set(t, t.calls.filter(c => {
    if (!c.id) return true;
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  }));
  // Hook text is copied the same way; keep it where it was first seen.
  const hookSeen = new Set(), hooks = new Map();
  for (const t of order) hooks.set(t, (t.hooks || []).filter(h => !hookSeen.has(h.id) && hookSeen.add(h.id)));
  return transcripts.map(t => ({...t, calls: kept.get(t), hooks: hooks.get(t)}));
}
