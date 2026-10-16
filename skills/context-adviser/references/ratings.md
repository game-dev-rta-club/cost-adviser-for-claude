# Rating a proposal

Give every proposal 1–5 stars on each axis below, in its `ratings`
(`ease`, `safety`, `savings`), as numbers. The overall rating shown on the
report is the average of the three to one decimal place (for example
3.7), **but never above the quality stars** (`safety`): a proposal that costs quality stays low however much it
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
| 4 | Not used: a proposal needs either no upkeep (5) or some (3) | — |
| 3 | Needs upkeep, or a small routine at natural points | A change to the user's own tool, hook or skill that must be kept up; a setting per project; a step at the start or end of a task |
| 2 | The user must remember it often | A habit such as starting a new conversation when switching tasks |
| 1 | The user must remember it every time | A step before each request |

## Quality kept (`safety`)

| Stars | When | Signs |
|---|---|---|
| 5 | No loss of quality, speed or context | Removes waste: the same model, effort and context get the same work done with fewer or smaller calls |
| 4 | Affected in theory, but not noticeably | Compacting at 500k instead of 1M tokens; trimming tool output that is rarely read in full |
| 3 | Some kinds of work may lose quality | A lighter model for one kind of subtask (such as searching); compacting well before the work fills the window |
| 2 | Lower quality in everyday work | A smaller model or lower effort by default; compacting at 200k |
| 1 | Risks the work | Turning off checks, tests or tools the work relies on |

## Savings (`savings`)

| Stars | Expected cut in total cost |
|---|---|
| 5 | 20% or more |
| 4 | 10–20% |
| 3 | 5–10% |
| 2 | 3–5% |
| 1 | Under 3%, or no clear link to the numbers |

Estimate the cut from the share the proposal touches in the linked view and how
much of it goes away (for example, half of a 26% command share is a 13% cut).
Say both numbers in the detail. Even a small cut is worth proposing when the
setup costs little: the overall rating weighs the two.
