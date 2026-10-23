# Reference

Every `cca` command, and how the numbers are counted. Each command also prints its own part with `cca <command> --help`.

## Commands

| Command | What it does |
|---|---|
| `cca build [--days 30] [--out FILE] [--open]` | Write the report: totals and stats over time (including compacting per active hour), the cost profile, tools and sessions. |
| `cca summary [--days 7 | --since DATE [--until DATE]] [--full-days] [--project NAME] [--tool NAME]… [--json]` | The report as text, for a person or an agent: this period against the one before, each day, cost by model, cost by project with its folder, calls by action as a tree, top sessions, text added by hooks, days when the largest context jumped, and each recorded change before vs after (with the day a verdict is due). `--full-days` leaves out the partial today (7 days become 6). `--tool` prints only one tool or group (e.g. `"bash chill"`; repeat it to add several up) by day, with cost and uses per active hour, each part's share of each day, and its costliest examples. |
| `cca decline add "<option>" --reason "<why>"` / `remove` / `list` | Record an option the user decided against. The summary lists them, and the skill never proposes them again. |
| `cca serve [--port 7319]` | Show the built report at http://127.0.0.1:7319, so links to it can be clicked from other pages. The Reload button at the top right of the page builds it again from the latest conversations (30 days), as `cca build` does. |
| `cca link [--project P] [--period day\|3d\|7d\|month] [--date DAY] [--metrics stats.ctx,…] [--tool NAME] [--session ID] [--focus …] [--item ROW]` | Print a link that opens the report on one item and highlights it. |
| `cca advise proposals.json` / `cca advise --clear` | Replace the improvement proposals listed under the projects: overall stars (the geometric mean, to one decimal place, of 1–5 stars on upkeep, quality kept and savings; a slider sets the lowest rating shown, ★3 at first), a short title and two or three lines on the problem and its fix, and details that open in a card at the lower right while the related view is highlighted (`#proposal=ID` opens one directly; `cca advise` prints that link for each proposal, `--port` sets its port). A proposal keeps its dates while its content stays the same, so only what changed is marked New or Updated. |
| `cca simulate [--compact-at TOKENS] [--tool-results SHARE [--tool NAME]…] [--delegate MIN[-MAX]] [--days 7 | --since DATE] [--full-days] [--project NAME] [--json]` | Replay the recent conversations call by call as if a change had been in place, and print the cost with and without it: compaction starting at another length, or tool results keeping a share of their size (0.7 = 30% shorter), of every tool or only the tools given with `--tool` (repeat it for several), or each run of MIN to MAX tool calls in a row in a main conversation handed to a fresh agent (the most it could save, since it assumes every such run can be handed over). `--since` starts at a day (for the days since a setting changed); `--full-days` leaves out the partial today (7 days become 6). It warns when the largest context jumped inside the days. An estimate, used to rate how much a proposal would save. |
| `cca mark add 2026-10-16 "Fewer chill calls" --detail "..."` | Record the day a change went in. It appears as an up arrow on the charts; hovering or clicking the arrow shows the label (its title, 30 characters at most) and the detail. The report is rebuilt. Adding the same label on the same day again replaces its detail. |
| `cca mark list` / `cca mark remove DATE "LABEL"` | List or remove recorded changes. |
| `cca collect [--days 30] [--out data.json]` | The collected data as JSON, for the same days as the summary (counted back from today at midnight). |

By default `cca` reads this machine's transcripts and the folders listed in
`~/.cost-adviser-for-claude/sources.json`, such as copies of another machine's `~/.claude/projects`:
`{"machine": "MacBookPro", "transcripts": [{"machine": "MacMini", "dir": "~/remote-logs/MacMini/.claude/projects"}]}`.
Each session then carries its machine, and the summary adds the cost by machine.
`--transcripts DIR` reads only the folders it names (give it more than once for
several). Recorded changes, the
report and a cache of read transcripts are kept in `~/.cost-adviser-for-claude`
(set `CCA_HOME` to move it). Deleting `cache.json` only costs one full read.

## How numbers are counted

- **Cost** uses list prices per model from the [pricing page](https://platform.claude.com/docs/en/about-claude/pricing), as read on the date in `lib/prices.mjs`: cache hits, 5-minute and 1-hour cache writes, fast mode and long Haiku prompts each at their own price.
  A message written several times while it streams is counted once. For a
  subscription, this is what the same use would cost at API prices.
- **Active time** adds the gaps between calls in one conversation, each capped
  at 5 minutes.
- **Compacting** is not logged as a call. Its summary is estimated: the
  conversation before it (`preTokens`) read at the cache price, plus the
  summary's length / 4 as output. The cache write of the first call after it is
  measured and counted as compacting, not input. Calls by action shows it as
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

