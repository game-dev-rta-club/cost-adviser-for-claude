---
name: context-adviser
description: Review what Claude Code conversations cost and propose the next step. Runs the cca CLI, reads the numbers against basic principles, and suggests up to three changes with how to measure them, each with a link to the place in the report. Use for /context-adviser or a scheduled cost review.
---

# Context Adviser

Read-only review of Claude Code cost. The only writes are `cca build` (the
report) and, when the user agrees, `cca mark add`.

1. **Refresh.** Run `cca build`, then `cca summary --json` (add
   `--project NAME` when asked). If `cca` is missing, say so and stop.
2. **Read.** Follow [reading.md](references/reading.md): find at most three
   signals, each with its numbers, period and sample size.
3. **Link.** For each signal, run `cca link` with the options reading.md gives,
   so the reader lands on that item with it highlighted. If `cca link` says
   nothing is serving the report, start `cca serve` in the background.
4. **Explain.** Match each signal to a principle in
   [principles.md](references/principles.md). Cite the principle's source.
5. **Check past changes.** For each recorded change, judge it with
   [measuring.md](references/measuring.md).
6. **Propose.** Up to three next steps. For each: the principle it applies,
   which number should move and which way, and when to look again. Offer to
   record the day it starts with `cca mark add YYYY-MM-DD "short name"`.

## Report

Keep it short. One block per signal, in this shape:

```text
[Item name](link)
- What is happening here, with the numbers and how much of the cost it carries.
- Recommended response: the principle, in a sentence (source URL).
```

Then:

- What changed since the previous period, in one or two lines (or why it
  cannot be compared).
- Each past change: the verdict, or "too early" with what is missing.
- Next steps, each with the number to watch and when.

## Do not

- Prescribe a specific product, setting value or tool. State the principle and
  let the user choose the means; specifics go stale.
- Claim a cause the numbers do not show. Say "suggests", and name the
  alternative explanation (a different mix of work, model or project).
- Judge a change on too little data. Follow measuring.md.
