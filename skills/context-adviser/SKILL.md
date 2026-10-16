---
name: context-adviser
description: Review what Claude Code conversations cost and keep a list of improvement proposals on the report. Runs the cca CLI, reads the numbers against basic principles, and updates the proposals listed under the projects, each with an overall star rating from three rated axes, the action to take and its details. Use for /context-adviser or a scheduled cost review.
---

# Context Adviser

Review Claude Code cost and keep the improvement proposals on the report up to
date. The report lists them under the projects, best first, each with stars,
the action in one line and the details. The only writes are the report, the
proposals (`cca advise`), and, when the user agrees, `cca mark add` and
`cca decline add`.

1. **Refresh.** Run `cca build`, then `cca summary` (add `--project NAME`
   when asked). It has what the report shows: totals against the previous
   period, each day, cost by model, tool use as a tree, sessions and recorded
   changes. To follow one tool or group over the days, add
   `--tool "bash chill"`. Use `--json` when you need exact numbers. If `cca`
   is missing, say so and stop. The summary ends with the options the user
   declined and the proposals now shown.
2. **Read.** Follow [reading.md](references/reading.md): find the signals,
   each with its numbers, period and sample size.
3. **Explain.** Match each signal to a principle in
   [principles.md](references/principles.md), with its source, and to the
   sample proposals in [catalog.md](references/catalog.md).
4. **Check past changes.** For each recorded change, judge it with
   [measuring.md](references/measuring.md); its verdict goes in the `news` of
   the proposal it came from. The adviser keeps no stages: each run looks at
   the numbers as they are.
5. **Update the proposals.** Start from the proposals now shown and write the
   whole list again to a JSON file, then run `cca advise FILE`. If it says
   nothing is serving the report, start `cca serve` in the background.

```json
{"proposals": [{
  "id": "sonnet-for-routine-projects",
  "action": "The conclusion in one line: exactly what to do, e.g. Add \"model\": \"sonnet\" to .claude/settings.json of projects with routine work",
  "detail": "Why: the numbers, their share of cost and the principle. Exactly where and what to change, what it should do to these numbers, and how to tell if it worked. A blank line starts a new paragraph.",
  "news": "Optional, one or two lines: what is worth noticing since the last run, with the numbers and date. Leave it out when nothing moved.",
  "project": "Optional: the project it is for; leave it out when it is for all",
  "ratings": {"ease": 5, "safety": 3, "savings": 5},
  "source": "https://… (the docs page for the setting or feature)",
  "link": {"period": "week", "date": "2026-10-16", "focus": "cost-model"}
}]}
```

**Keep the list, change only what moved.** Use the same `id` for the same
proposal every run. Leave a proposal as it is when its numbers and advice still
hold: it then keeps its dates, and the report marks only what changed as New or
Updated. Update its detail when the numbers moved, put what is worth noticing
in `news`, add a proposal for a new finding, and drop one that no longer
applies or that the user carried out and you judged. `cca advise` prints what
was added, updated, kept and removed.

**Each proposal is one concrete action that is enough on its own**: the
setting, file, skill or subagent to change and what to put there (a key and
value, a line to add). Before naming a setting or feature, open its current
docs page and check the name and accepted values; put that page in `source`.
Never invent a setting. A value is a starting point: say what to watch to tune
it. Rate each proposal 1–5 stars on each axis with
[ratings.md](references/ratings.md); the overall stars are their average to
one decimal place, capped by the quality stars. Look first for waste: cost that buys
nothing (repeated checks, oversized tool output, cache rebuilds, text the
user's own hooks and skills add to every call), which keeps quality whole.
Proposals that trade quality for cost are still listed, rated low.

`link` takes the `cca link` options (project, period, date, metrics, tool,
session, focus, item); reading.md says which fits each signal. **The numbers in
a proposal must be the ones the linked view shows**: the report shows one
period at a time, so quote that period's numbers, not the summary's window.

Write the proposals in the user's language.

6. **Reply briefly.** One line per proposal that is new or changed (or "no
   change" when nothing moved), the report link (`http://127.0.0.1:7319/`),
   and what to watch next and when. Offer to record a step's start with
   `cca mark add YYYY-MM-DD "short name"`.

**Respect what the user decided.** Never propose a declined option or a close
variant of it; work within the reason given. When the user turns an option
down, record it with `cca decline add "<option>" --reason "<why>"`, and drop it
from the list.

## Do not

- Give vague advice ("keep conversations short"). Turn the principle into an
  action the user can take now, checked against the current docs.
- Claim a cause the numbers do not show. Say "suggests", and name the
  alternative explanation (a different mix of work, model or project).
- Judge a change on too little data. Follow measuring.md.
