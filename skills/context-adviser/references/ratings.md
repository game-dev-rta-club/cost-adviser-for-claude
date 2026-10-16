# Rating a proposal

Give every proposal 1–5 stars on each axis below, in its `ratings`
(`ease`, `safety`, `savings`), as numbers. The overall rating shown on the
report is their geometric mean to one decimal place (for example 3.7), so one
weak axis pulls the whole down. Proposals that cost quality are listed too, so
the user can weigh them; the report folds those under 3 stars until the user
opens them.

Rate from what you see, using the signs below, not from a general impression,
so the same proposal gets the same stars each time.
[catalog.md](catalog.md) has sample proposals already rated this way.

## Ease of use (`ease`)

| Stars | When | Signs |
|---|---|---|
| 5 | Set up once; only a check at big events, such as a model update | One settings key or one line in a file; a one-time change to a setting that should be reviewed after a model update |
| 4 | Not used | — |
| 3 | Needs tuning for each project or kind of task | A change to the user's own tool, hook or skill for one workflow; a setting per project; a subagent for one kind of task |
| 2 | Not done after one setup: needs frequent tuning, regular upkeep or growing | A value or list that must be adjusted as the work changes |
| 1 | The user must think about it every time | A habit such as starting a new conversation when switching tasks; a step before each request |

## Quality kept (`safety`)

| Stars | When | Signs |
|---|---|---|
| 5 | No loss of quality, speed or context | Removes waste: the same model, effort and context get the same work done with fewer or smaller calls |
| 4 | Affected in theory, but not noticeably | Compacting at 500k instead of 1M tokens; trimming tool output that is rarely read in full |
| 3 | Some kinds of work may lose quality | A lighter model for one kind of subtask (such as searching) |
| 2 | Some kinds of work lose quality | Compacting at 200k |
| 1 | Everyday work loses quality | Lower effort or a smaller model for all work; turning off checks, tests or tools the work relies on |

## Savings (`savings`)

| Stars | Expected cut in total cost |
|---|---|
| 5 | 10% or more |
| 4 | 5–10% |
| 3 | 3–5% |
| 2 | 1–3% |
| 1 | Under 1%, or no clear link to the numbers |

Estimate the cut from the share the proposal touches in the linked view and how
much of it goes away (for example, half of a 26% command share is a 13% cut).
Say both numbers in the detail. A 10% cut is already large. Even a small cut is
worth proposing when the setup costs little: the overall rating weighs the two.

Do not overrate making the context smaller. With automatic compaction, a
conversation's context moves between about 20% and 100% of the window and
settles near 60% on average, whatever is added on each call. Shorter text that
hooks, skills or MCP tools add to every call barely changes that average; it
touches only cache writes and compaction a little, usually well under 1% in
all. Rate such proposals 1 for savings unless the numbers show otherwise.
