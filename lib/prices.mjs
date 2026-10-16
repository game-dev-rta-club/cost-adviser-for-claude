// Provisional list prices in USD per million tokens, by model family.
// Cache reads cost 0.1x input and cache writes (5-minute) 1.25x input.
export const PRICES = {
  opus: {input: 5, output: 25},
  sonnet: {input: 3, output: 15},
  haiku: {input: 1, output: 5},
};
export const CACHE_READ = 0.1;
export const CACHE_WRITE = 1.25;

export function priceFor(model = '') {
  if (/sonnet/.test(model)) return PRICES.sonnet;
  if (/haiku/.test(model)) return PRICES.haiku;
  return PRICES.opus;
}

// A compaction reuses the conversation's cache: it reads the whole
// conversation at the cache price and writes the summary as output.
// https://claude.com/blog/lessons-from-building-claude-code-prompt-caching-is-everything
// The summary's token count is estimated from its length.
export const CHARS_PER_TOKEN = 4;
export function summaryCost({model, preTokens = 0, summaryChars = 0}) {
  const p = priceFor(model);
  return (preTokens * p.input * CACHE_READ + summaryChars / CHARS_PER_TOKEN * p.output) / 1e6;
}

// Cost of one call, split the same way the Web shows it.
export function callCost({model, input = 0, cacheWrite = 0, cacheRead = 0, output = 0}) {
  const p = priceFor(model);
  const cost = {
    cacheRead: cacheRead * p.input * CACHE_READ / 1e6,
    cacheWrite: cacheWrite * p.input * CACHE_WRITE / 1e6,
    input: input * p.input / 1e6,
    output: output * p.output / 1e6,
  };
  return {...cost, total: cost.cacheRead + cost.cacheWrite + cost.input + cost.output};
}
