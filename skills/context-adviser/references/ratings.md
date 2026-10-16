# Rating a proposal

Give every proposal 1–5 stars on each axis below, in its `ratings`
(`ease`, `safety`, `savings`), as numbers. The overall rating shown on the
report is the rounded average of the three, **but never above the quality
stars** (`safety`): a proposal that costs quality stays low however much it
saves. Quality comes first, but it is a balance: a small loss for a large
saving can still rate well, and a proposal that costs more quality is still
listed, low, so the user keeps it in mind. The report folds proposals under 3
stars until the user opens them.

| Stars | Ease of use (`ease`) | Quality kept (`safety`) | Savings (`savings`) |
|---|---|---|---|
| 5 | Set up once, then it works with no attention | No loss of quality, speed or context expected (removing waste) | Touches 30% or more of cost |
| 4 | Set up once, with an occasional check | A small loss the user rarely notices (e.g. compacting at 500k instead of 1M tokens) | 20–30% |
| 3 | A small routine at natural points, or a setup that needs some upkeep | A loss that shows in some tasks and is easy to undo | 10–20% |
| 2 | The user must remember it often | Lower quality in everyday work (e.g. a smaller model or lower effort by default) | 5–10% |
| 1 | The user must remember it every time | Risks the quality of the work | Under 5%, or no clear link to the numbers |

Base `savings` on the share of cost the proposal touches in the linked view,
and say that share in the detail. Rate from these definitions, not from a
general impression, so the same proposal gets the same stars each time.
