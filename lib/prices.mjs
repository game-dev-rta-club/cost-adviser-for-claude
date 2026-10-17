// List prices in USD per million tokens, by model, from the pricing page
// (read 2026-10-17): https://platform.claude.com/docs/en/about-claude/pricing
// `read` is the cache hit price as a share of input. The first pattern that
// matches the model id wins, so a newer version comes before its family.
export const PRICES_URL = 'https://platform.claude.com/docs/en/about-claude/pricing';
export const PRICES_READ_ON = '2026-10-17';
export const PRICES = [
  {model: 'fable-5-1', match: /(fable|mythos)-5-1/, input: 10, output: 50, read: 0.025},
  {model: 'fable-5', match: /(fable|mythos)-5/, input: 10, output: 50, read: 0.1},
  {model: 'opus-5-5', match: /opus-5-5/, input: 4, output: 20, read: 0.05, fast: {input: 8, output: 40}},
  {model: 'opus-5', match: /opus-5/, input: 5, output: 25, read: 0.1, fast: {input: 10, output: 50}},
  {model: 'opus-4-5 to 4-8', match: /opus-4-[5-8]/, input: 5, output: 25, read: 0.1, fast: {input: 10, output: 50}},
  {model: 'opus-4, 4-1', match: /opus-4/, input: 15, output: 75, read: 0.1},
  {model: 'sonnet-5-5', match: /sonnet-5-5/, input: 2, output: 10, read: 0.05},
  {model: 'sonnet-5', match: /sonnet-5/, input: 2, output: 10, read: 0.1},
  {model: 'sonnet-4', match: /sonnet/, input: 3, output: 15, read: 0.1},
  // Haiku 5.5 costs more for prompts over 100,000 tokens.
  {model: 'haiku-5-5', match: /haiku-5-5/, input: 0.1, output: 0.5, read: 0.1, long: {over: 100000, input: 0.5, output: 2.5}},
  {model: 'haiku-4', match: /haiku/, input: 1, output: 5, read: 0.1},
];
// A model the table does not know is priced as the newest Opus.
const FALLBACK = PRICES.find(p => p.model === 'opus-5-5');
// Cache writes: 1.25x input for the 5-minute cache, 2x for the 1-hour cache.
export const WRITE_5M = 1.25, WRITE_1H = 2;

// Per-token prices for one call: input, output, cache read and cache write.
// `prompt` is the prompt's length (for long-prompt prices), `speed` "fast"
// for fast mode, `write1h` the share of cache writes that went to the 1-hour cache.
export function priceFor(model = '', {prompt = 0, speed = null, write1h = 0} = {}) {
  const p = PRICES.find(x => x.match.test(model)) || FALLBACK;
  const base = speed === 'fast' && p.fast ? p.fast : p.long && prompt > p.long.over ? p.long : p;
  const write = WRITE_5M + (WRITE_1H - WRITE_5M) * write1h;
  return {input: base.input, output: base.output, cacheRead: base.input * p.read, cacheWrite: base.input * write};
}

const promptOf = c => (c.input || 0) + (c.cacheWrite || 0) + (c.cacheRead || 0);
export const callPrice = c => priceFor(c.model, {prompt: promptOf(c), speed: c.speed, write1h: c.cacheWrite ? (c.cacheWrite1h || 0) / c.cacheWrite : c.write1h || 0});

// A compaction reuses the conversation's cache: it reads the whole
// conversation at the cache price and writes the summary as output.
// https://claude.com/blog/lessons-from-building-claude-code-prompt-caching-is-everything
// The summary's token count is estimated from its length.
export const CHARS_PER_TOKEN = 4;
export function summaryCost({model, preTokens = 0, summaryChars = 0, speed = null}) {
  const p = priceFor(model, {prompt: preTokens, speed});
  return (preTokens * p.cacheRead + summaryChars / CHARS_PER_TOKEN * p.output) / 1e6;
}

// Cost of one call, split the same way the Web shows it.
export function callCost(c) {
  const p = callPrice(c);
  const cost = {
    cacheRead: (c.cacheRead || 0) * p.cacheRead / 1e6,
    cacheWrite: (c.cacheWrite || 0) * p.cacheWrite / 1e6,
    input: (c.input || 0) * p.input / 1e6,
    output: (c.output || 0) * p.output / 1e6,
  };
  return {...cost, total: cost.cacheRead + cost.cacheWrite + cost.input + cost.output};
}
