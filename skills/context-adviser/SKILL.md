---
name: context-adviser
description: Review what Claude Code conversations cost and propose the next step. Runs the cca CLI, reads the numbers against basic principles, and suggests up to three changes with how to measure them. Use for /context-adviser or a scheduled cost review.
---

# Context Adviser

Read-only review of Claude Code cost. The only writes are `cca build` (the
report) and, when the user agrees, `cca mark add`.

1. **Refresh.** Run `cca build`, then `cca summary --json` (add
   `--project NAME` when asked). If `cca` is missing, say so and stop.
2. **Read.** Follow [reading.md](references/reading.md): find at most three
   signals, each with its numbers, period and sample size.
3. **Explain.** Match each signal to a principle in
   [principles.md](references/principles.md). Cite the principle's source.
4. **Check past changes.** For each recorded change, judge it with
   [measuring.md](references/measuring.md).
5. **Propose.** Up to three next steps. For each: the principle it applies,
   which number should move and which way, and when to look again. Offer to
   record the day it starts with `cca mark add YYYY-MM-DD "short name"`.

## Report

Keep it short:

- What changed since the previous period, in one or two lines.
- Each signal: the number, what it suggests, the principle and its source.
- Each past change: the verdict, or "too early" with what is missing.
- Next steps.
- Where to confirm: the report file `cca build` printed, and which project,
  period, tool or session to open.

## Do not

- Prescribe a specific product, setting value or tool. State the principle and
  let the user choose the means; specifics go stale.
- Claim a cause the numbers do not show. Say "suggests", and name the
  alternative explanation (a different mix of work, model or project).
- Judge a change on too little data. Follow measuring.md.
