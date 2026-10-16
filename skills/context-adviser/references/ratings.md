# Rating a proposal

Give every proposal 1–5 stars on each axis below, in its `ratings`
(`ease`, `safety`, `savings`), as numbers. The overall rating shown on the
report is the rounded average of the three, **but never above the quality
stars** (`safety`): a proposal that costs quality stays low however much it
saves. Quality comes first, but it is a balance: a small loss for a large
saving can still rate well, and a proposal that costs more quality is still
listed, low, so the user keeps it in mind. The report folds proposals under 3
stars until the user opens them.

Rate from what you see, using the signs below, not from a general impression,
so the same proposal gets the same stars each time.
[catalog.md](catalog.md) has sample proposals already rated this way.

## Ease of use (`ease`)

| Stars | When | Signs |
|---|---|---|
| 5 | Set up once, then it works with no attention | One settings key or one line in a file |
| 4 | Set up once, with an occasional check | A one-time change to the user's own tool, hook or skill; a value to revisit when the numbers move |
| 3 | Some upkeep, or a small routine at natural points | A setting per project; a step at the start or end of a task |
| 2 | The user must remember it often | A habit such as starting a new conversation when switching tasks |
| 1 | The user must remember it every time | A step before each request |

## Quality kept (`safety`)

| Stars | When | Signs |
|---|---|---|
| 5 | No loss of quality, speed or context | Removes waste: the same model, effort and context get the same work done with fewer or smaller calls |
| 4 | A small loss the user rarely notices | Compacting at 500k instead of 1M tokens; trimming tool output that is rarely read in full |
| 3 | A loss that shows in some tasks, easy to undo | A lighter model for one kind of subtask (such as searching); compacting well before the work fills the window |
| 2 | Lower quality in everyday work | A smaller model or lower effort by default; compacting at 200k |
| 1 | Risks the work | Turning off checks, tests or tools the work relies on |

## Savings (`savings`)

| Stars | Share of cost the proposal touches, in the linked view |
|---|---|
| 5 | 30% or more |
| 4 | 20–30% |
| 3 | 10–20% |
| 2 | 5–10% |
| 1 | Under 5%, or no clear link to the numbers |

Measure the share the proposal touches (for example, the cost of calls above
500k tokens for a compaction window of 500k), say that share in the detail, and
remember the saving itself is smaller than the share.
