# Sample proposals

Proposals that often fit, each with what you see when it applies and how it
rates by [ratings.md](ratings.md). `ease` and `safety` are fixed here;
`savings` follows the share you measure. They are samples: rate a new kind of
proposal by the same signs, check every setting against its current docs, and
leave out what the user declined.

## Waste: the same work with fewer or smaller calls (quality 5)

| Proposal | You see | ease | safety | savings |
|---|---|---|---|---|
| Make one command do the work of a repeated series (a CLI that is polled, or a status check before every step) | One command group takes a large share in Tool Use, with many uses and short output | 4 | 5 | by share |
| Make a tool return less (limit flags, a summary instead of the full list, reading the part of a file needed) | A tool with a high result size per use; the same large file read again and again | 4 | 5 | by share |
| Shorten text the user's own hooks or skills add to every call, or add it only when it changed | The same added context in every call; a large fixed instruction in each conversation | 4 | 5 | by share of the added text |
| Turn off MCP servers a project never uses | Tools from a server that never appear in Tool Use | 5 | 5 | usually 1 |

## Context length (quality 4 and below)

| Proposal | You see | ease | safety | savings |
|---|---|---|---|---|
| Compact at 500k instead of 1M tokens (`"autoCompactWindow": 500000`) | Calls above 500k tokens take a clear share of cost | 5 | 4 | share of the calls above 500k |
| Start a new conversation when switching to unrelated work | One conversation runs for many hours across several tasks | 2 | 4 | share of that conversation's later calls |
| Compact at 200k (`"autoCompactWindow": 200000`) | Most cost is in calls above 200k tokens | 5 | 2 | share of the calls above 200k |

## Model and effort (quality 3 and below)

| Proposal | You see | ease | safety | savings |
|---|---|---|---|---|
| A subagent on a lighter model for searching and reading | Search and read tools take a large share | 3 | 3 | share of those tools |
| A smaller model by default (`"model": "sonnet"`) | One large model takes most of the cost | 5 | 2 | share of that model's cost |
| Lower effort by default (`"effortLevel": "medium"`) | Output takes a clear share of cost | 5 | 2 | share of output cost |

Overall stars, for example: a repeated command at a 25% share rates
5·4·4 → 4; compacting at 500k with calls above 500k at 33% rates 5·4·5 → 4;
a smaller model at 80% rates 5·2·5 → 2 (capped by quality).
