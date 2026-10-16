# Sample proposals

Proposals that often fit, each with what you see when it applies and how it
rates by [ratings.md](ratings.md). `ease` and `safety` are fixed here;
`savings` follows the cut you estimate from the numbers. They are samples: rate
a new kind of proposal by the same signs, check every setting against its
current docs, and leave out what the user declined.

## Waste: the same work with fewer or smaller calls (quality 5)

| Proposal | You see | ease | safety | savings |
|---|---|---|---|---|
| Make one command do the work of a repeated series (a CLI that is polled, or a status check before every step) | One command group takes a large share in Tool Use, with many uses and short output | 3 | 5 | by cut |
| Make a tool return less (limit flags, a summary instead of the full list, reading the part of a file needed) | A tool with a high result size per use; the same large file read again and again | 3 | 5 | by cut |
| Shorten text the user's own hooks or skills add to every call, or add it only when it changed | The same added context in every call; a large fixed instruction in each conversation | 3 | 5 | 1 (see ratings.md) |
| Turn off MCP servers a project never uses | Tools from a server that never appear in Tool Use | 5 | 5 | 1 |

## Context length

| Proposal | You see | ease | safety | savings |
|---|---|---|---|---|
| Compact at 500k instead of 1M tokens (`"autoCompactWindow": 500000`) | Calls above 500k tokens take a clear share of cost | 5 | 4 | by cut |
| Start a new conversation when switching to unrelated work | One conversation runs for many hours across several tasks | 1 | 4 | by cut |
| Compact at 200k (`"autoCompactWindow": 200000`) | Most cost is in calls above 200k tokens | 5 | 2 | by cut |

## Model and effort

| Proposal | You see | ease | safety | savings |
|---|---|---|---|---|
| A subagent on a lighter model for searching and reading | Search and read tools take a large share | 3 | 3 | by cut |
| Lower effort for all work (`"effortLevel": "medium"`) | Output takes a clear share of cost | 5 | 1 | by cut |
| Lower effort only for some tasks, chosen each time | Output takes a clear share, and some tasks are routine | 1 | 3 | by cut |
| A smaller model by default (`"model": "sonnet"`) | One large model takes most of the cost | 5 | 1 | by cut |

Overall stars, for example: halving a command that takes 26% of cost (a 13%
cut) rates 3·5·5 → 4.2; compacting at 500k when calls above it take 33% of
cost (about a 10% cut) rates 5·4·5 → 4.6; shortening added text rates
3·5·1 → 2.5; a smaller model with a 30% cut rates 5·1·5 → 2.9.
