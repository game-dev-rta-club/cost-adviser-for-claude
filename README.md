# Context Adviser For Claude

Measure what Claude Code conversations cost, find where the cost goes, and check
whether a change made things cheaper. It reads the transcripts Claude Code
already keeps (`~/.claude/projects`). Nothing is sent anywhere.

Requires Node.js 20 or later. No dependencies.

```sh
npm link            # puts cca on your PATH (or run node bin/cca.mjs)
cca build --open    # write the report and open it
```

The report is one HTML file with the data inside
(`~/.context-adviser-for-claude/report.html`), so it opens at once and needs
no server. Run `cca build` again to bring it up to date; only transcripts that
changed since the last run are read again.

## Commands

| Command | What it does |
|---|---|
| `cca build [--days 30] [--out FILE] [--open]` | Write the report: totals and stats over time (including compacting per active hour), the cost profile, tools and sessions. |
| `cca summary [--days 7] [--project NAME] [--tool NAME] [--json]` | The report as text, for a person or an agent: this period against the one before, each day, cost by model, tool use as a tree, top sessions, and each recorded change before vs after. `--tool` adds one tool or group (e.g. `"bash chill"`) by day with its costliest examples. |
| `cca decline add "<option>" --reason "<why>"` / `remove` / `list` | Record an option the user decided against. The summary lists them, and the skill never proposes them again. |
| `cca serve [--port 7319]` | Show the built report at http://127.0.0.1:7319, so links to it can be clicked from other pages. It only sends the file. |
| `cca link [--project P] [--period day\|week\|month] [--date DAY] [--metrics stats.ctx,…] [--tool NAME] [--session ID] [--focus …] [--item ROW]` | Print a link that opens the report on one item and highlights it. |
| `cca advise proposals.json` / `cca advise --clear` | Replace the improvement proposals listed under the projects: overall stars (the geometric mean, to one decimal place, of 1–5 stars on upkeep, quality kept and savings; proposals under 3 stars are folded), the action in one line, and details that open in a card at the lower right while the related view is highlighted (`#proposal=ID` opens one directly). A proposal keeps its dates while its content stays the same, so only what changed is marked New or Updated. |
| `cca simulate [--compact-at TOKENS] [--tool-results SHARE] [--days 7] [--project NAME] [--json]` | Replay the recent conversations call by call as if a change had been in place, and print the cost with and without it: compaction starting at another length, or tool results keeping a share of their size (0.7 = 30% shorter). An estimate, used to rate how much a proposal would save. |
| `cca mark add 2026-10-16 "Fewer chill calls"` | Record the day a change went in. It appears as a ⭐ tag on the charts; the report is rebuilt. |
| `cca mark list` / `cca mark remove DATE "LABEL"` | List or remove recorded changes. |
| `cca collect [--days 30] [--out data.json]` | The collected data as JSON. |

`--transcripts DIR` reads another transcript folder. Recorded changes, the
report and a cache of read transcripts are kept in `~/.context-adviser-for-claude`
(set `CCA_HOME` to move it). Deleting `cache.json` only costs one full read.

## The /context-adviser skill

`skills/context-adviser` lets an agent run the review: it refreshes the report,
reads the summary, explains what it sees with basic principles, and keeps the
list of improvement proposals on the report up to date, each rated and with
how to measure it. Run it whenever you like; each run looks at the numbers as
they are.

```sh
ln -s "$PWD/skills/context-adviser" ~/.claude/skills/context-adviser
```

- `references/reading.md`: where to look in the results.
- `references/principles.md`: the principles, each with its source.
- `references/measuring.md`: how to judge whether a change helped.
- `references/ratings.md`: how a proposal is rated.
- `references/catalog.md`: sample proposals, already rated.

### How proposals are rated

Each proposal is rated from one to five stars on three axes: upkeep (how little
attention it needs once it is in place), quality kept (how well the work keeps
its quality), and savings (how much it is expected to cut your total cost,
estimated from your recent conversations). The overall rating multiplies the
three and takes the cube root, so one weak axis pulls it down. Proposals under
three stars are folded until you open them.

The references stay at the level of principles on purpose, so they do not go
stale when tools and settings change.

## How numbers are counted

- **Cost** uses provisional list prices per model family (`lib/prices.mjs`).
  Cache reads cost 0.1× input and cache writes 1.25× input. A message written
  several times while it streams is counted once.
- **Active time** adds the gaps between calls in one conversation, each capped
  at 5 minutes.
- **Compacting** is not logged as a call. Its summary is estimated: the
  conversation before it (`preTokens`) read at the cache price, plus the
  summary's length / 4 as output. The cache write of the first call after it is
  measured and counted as compacting, not input. Tool Use shows it as
  `(compacting)`.
- **Tool cost**: a call's cost is shared equally among the tools it asked for.
  An inline Python script (`python3 - <<EOF`, `python3 -c`) is named by what it
  does: `(edit .md)`, `(write .json)`, `(read files)`, `(read data)`,
  `(read transcripts)`, `(run commands)`; anything else by its first uncommon
  import, e.g. `(uses PIL)`. New file types and libraries get their own row
  without a new rule.
  A call that uses no tool is "(final reply)": the reply that ends a turn,
  written after reading the whole conversation.
- **Subagent calls** are calls from subagent transcripts, as a share of all calls.
- **Cache hit rate** is cache reads as a share of all input tokens.
- **Ratios** (cost per hour, per call, average context, the shares) are left
  out for periods with under 10 minutes of activity or under 10 calls.
- **A change's effect**: `summary` compares the same number of days before the
  change and from it on (at most `--days`).

## Development

```sh
npm run check
```
