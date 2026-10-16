---
name: context-adviser
description: Check what Claude Code conversations cost and whether a recorded change helped, using the cca CLI. Use when asked to review usage cost, find heavy tools or sessions, or record a cost-saving change.
---

# Context Adviser

1. Run `cca summary` (add `--days N` or `--project NAME` when asked). Use
   `--json` when you need exact numbers.
2. Report only what the numbers show:
   - The largest changes against the previous period.
   - Tools or sessions that take an unusual share of the cost.
   - For each recorded change, the same-length periods before and after.
   Say when a ratio is missing because the period had too little use.
3. Point the user to the place to confirm it: `cca serve`, then the project,
   period, tool or session you named.
4. When the user starts a cost-saving change, record its day with
   `cca mark add YYYY-MM-DD "short name"`.

Do not treat one short period as proof; say how many days and calls a
comparison rests on.
