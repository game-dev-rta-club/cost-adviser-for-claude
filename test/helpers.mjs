import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const tempDir = () => fs.mkdtemp(path.join(os.tmpdir(), 'cca-test-'));

// One assistant message as Claude Code writes it.
export function assistant({id, at, model = 'claude-opus-5-5', effort = 'high', input = 0, cacheWrite = 0, cacheRead = 0, output = 0, tools = [], cwd = '/work/app'}) {
  return {type: 'assistant', timestamp: at, cwd, effort, requestId: `req-${id}`,
    message: {id, model, usage: {input_tokens: input, cache_creation_input_tokens: cacheWrite, cache_read_input_tokens: cacheRead, output_tokens: output},
      content: tools.map(t => ({type: 'tool_use', id: t.id, name: t.name, input: t.input || {}}))}};
}

export const user = (text, cwd = '/work/app') => ({type: 'user', cwd, message: {role: 'user', content: text}});
export const result = (toolUseId, content) => ({type: 'user', message: {role: 'user', content: [{type: 'tool_result', tool_use_id: toolUseId, content}]}});

export async function writeTranscript(root, rel, entries) {
  const file = path.join(root, rel);
  await fs.mkdir(path.dirname(file), {recursive: true});
  await fs.writeFile(file, entries.map(e => typeof e === 'string' ? e : JSON.stringify(e)).join('\n') + '\n');
  return file;
}
