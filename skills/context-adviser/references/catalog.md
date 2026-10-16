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
| Make a tool return less (limit flags, a summary instead of the full list, reading the part of a file needed) | A tool with a high result size per use; the same large file read again and again | 3 | 5 | by cut (`g × U` in ratings.md; usually 1–2) |
| Shorten text the user's own hooks or skills add to every call, or add it only when it changed | The same added context in every call; a large fixed instruction in each conversation | 3 | 5 | by cut (`g × U` in ratings.md; usually 1) |
| Turn off MCP servers a project never uses | Tools from a server that never appear in Tool Use | 5 | 5 | 1 |

## Context length

| Proposal | You see | ease | safety | savings |
|---|---|---|---|---|
| Compact at half the model's window (`autoCompactWindow` = window / 2) | Calls above half the window take a clear share of cost | 5 | 4 | by cut |
| Start a new conversation when switching to unrelated work | One conversation runs for many hours across several tasks | 1 | 4 | by cut |
| Below half the window, one step of window / 20 down, then watch | The setting is already at half or below; the last step has run for some days without more retries, rework or confusion after compaction | 5 | 3 | by cut |
| Compact far below half in one go | Most cost is in calls far below half the window | 5 | 1 | by cut |

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
3·5·1 → 2.5; trimming tool results by 30% (about a 2% cut) rates 3·5·2 → 3.1;
a smaller model with a 30% cut rates 5·1·5 → 2.9; one step from 500k to 450k
(about a 4.7% cut) rates 5·3·3 → 3.6.

The window grows with new models, so these steps follow its size, not a fixed
number of tokens: down to half the window in one go, then window / 20 a step.
For a 1M-token window: 500k, then 450k, 400k, 350k and so on. For a 2M window:
1M, then 900k, 800k. Read the window of the model in use from its docs.

Below half the window, propose one step at a time. Each run proposes
the next step only when the last one, recorded with `cca mark add`, shows no
more retries, rework or confusion after compaction; otherwise it proposes
going back up a step. The risk builds up with every step, so a step keeps
quality 3 however well the last one went: it stays on the list without looking
urgent.
