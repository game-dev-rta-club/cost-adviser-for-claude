# Context Adviser For Claude

Measure what Claude Code conversations cost, find where the cost goes, and check
whether a change made things cheaper. It reads the transcripts Claude Code
already keeps (`~/.claude/projects`). Nothing is sent anywhere.

Requires Node.js 20 or later. No dependencies.

```sh
npm link            # or run node bin/cca.mjs directly
cca serve           # open http://127.0.0.1:7319
```

## Commands

| Command | What it does |
|---|---|
| `cca serve [--days 30] [--port 7319]` | The Web view: totals and stats over time, the cost profile, tools and sessions. Reload to read new transcripts. |
| `cca summary [--days 7] [--project NAME] [--json]` | This period against the one before, top tools and sessions, and each recorded change before vs after. For a person or an agent. |
| `cca mark add 2026-10-16 "Fewer chill calls"` | Record the day a change went in. It appears as a ⭐ tag on the charts. |
| `cca mark list` / `cca mark remove DATE "LABEL"` | List or remove recorded changes. |
| `cca collect [--days 30] [--out data.json]` | The collected data as JSON. |

`--transcripts DIR` reads another transcript folder. Recorded changes are kept
in `~/.context-adviser-for-claude/changes.json` (set `CCA_HOME` to move it).

## How numbers are counted

- **Cost** uses provisional list prices per model family (`lib/prices.mjs`).
  Cache reads cost 0.1× input and cache writes 1.25× input. A message written
  several times while it streams is counted once.
- **Active time** adds the gaps between calls in one conversation, each capped
  at 5 minutes.
- **Tool cost**: a call's cost is shared equally among the tools it asked for.
  Calls without a tool are "(text only)".
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
