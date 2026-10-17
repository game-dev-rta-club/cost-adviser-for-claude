---
name: cost-adviser
description: Review what Claude Code conversations cost and keep a list of improvement proposals on the report. Runs the cca CLI, reads the numbers against basic principles, and updates the proposals listed under the projects, each with an overall star rating from three rated axes, the action to take and its details. Use for /cost-adviser or a scheduled cost review.
---

# Cost Adviser

Review Claude Code cost and keep the improvement proposals on the report up to
date. The report lists them under the projects, best first, each with stars,
the action in one line and the details. The only writes are the report, the
proposals (`cca advise`), and, when the user agrees, `cca mark add` and
`cca decline add`.

1. **Refresh.** Run `cca build`, then `cca summary` (add `--project NAME`
   when asked). It has what the report shows: totals against the previous
   period, each day, cost by model, calls by action as a tree, sessions and recorded
   changes. `--tool "bash chill"` prints only that tool or group, day by day.
   Use `--json` when you need exact numbers. If `cca` is missing, say so and
   stop. The summary ends with the options the user declined and the
   proposals now shown (id, stars and action; `--json` has every field, which
   step 5 needs). `cca collect --days 7` gives the raw rows by day, project,
   tool and session for the same days, when the summary is not enough. Today
   is still going, so its numbers are partial and grow between commands; each
   output says when it read the data.

   Then read the settings in effect: `~/.claude/settings.json`, and in each
   project's folder `.claude/settings.json` and `.claude/settings.local.json`,
   including settings per model and the `env` entries. The summary's sessions
   show each project's folder. Settings files are not all that is in effect:
   a session can be started with its own model or effort (launch flags, such
   as `--model` and `--effort` in `ps`, or `/model` inside it), and those win. A proposal about a setting starts from its
   current value. The conversation running this review is in the data too.
   When it is a subagent of a longer session, only the subagent's rows are the
   review; the rest is the user's work. Say which session it is when it is
   among the top sessions.
2. **Read.** Follow [reading.md](references/reading.md): find the signals,
   each with its numbers, period and sample size.
3. **Explain.** Match each signal to a principle in
   [principles.md](references/principles.md), with its source, and to the
   sample proposals in [catalog.md](references/catalog.md).
4. **Check past changes.** For each recorded change, judge it with
   [measuring.md](references/measuring.md); its verdict goes in the reply
   (step 6), not in the proposals. Look for changes nobody recorded too: a
   jump in the largest context in By day (a new compaction length), or a
   shift in the model or effort mix. Name its first day and offer
   `cca mark add`. The adviser keeps no stages: each run looks
   at the numbers as they are.
5. **Update the proposals.** Start from the proposals now shown and write the
   whole list again to a JSON file, then run `cca advise FILE`. If it says
   nothing is serving the report, start `cca serve` in the background.

```json
{"proposals": [{
  "id": "compact-at-half-window",
  "title": "A short name for the problem and its fix, up to 40 characters, e.g. Compact long conversations at half the window",
  "summary": "Two or three lines, up to 200 characters: the problem the numbers show now and the fix. The list shows only the title and this; the rest opens on a click.",
  "action": "Exactly what to do, in one line, e.g. Add \"autoCompactWindow\": 500000 to ~/.claude/settings.json",
  "detail": "Why: the numbers, their share of cost and the principle. Exactly where and what to change, what it should do to these numbers, and how to tell if it worked. A blank line starts a new paragraph.",
  "news": "Optional, one or two lines: what is worth noticing since the last run, with the numbers and date. Keep it as it is on a kept proposal; replace or drop it when the proposal is updated.",
  "project": "Optional: the project it is for; leave it out when it is for all",
  "ratings": {"ease": 5, "safety": 4, "savings": 5},
  "source": "https://… (the docs page for the setting or feature)",
  "link": {"period": "7d", "date": "2026-10-16", "focus": "cost-model"}
}]}
```

**Keep the list, change only what moved.** Use the same `id` for the same
proposal every run. Leave a proposal that is still to do as it is when its
numbers and advice still hold. Judge a window that includes today on its full days; today only
confirms. A number holds unless it moved by more than about a tenth (for a
percentage under 10%, by more than about a point) or changed the rating; small
drift, such as from today being partial, is not a change. Reasoning that the
numbers no longer support is a change too. It
then keeps its dates, and the report marks only what changed as New or
Updated. Copy the proposals from `cca summary --json`; `stars`, `since` and
`updated` are worked out by `cca advise` and can stay or go. Update its detail when the numbers moved, put what is worth noticing
in `news`, add a proposal for a new finding, and drop one that no longer
applies. **Each proposal is a problem the numbers show now and the fix for
it.** When the user has carried a fix out, judge it in step 4 from the
recorded change (offer `cca mark add` if its start was not recorded). On the
next run after a fix is carried out, never keep it as "keep doing this": if
the problem is gone, drop the proposal; if it remains, rewrite it as the next
step for it (for example, a command still takes a large share after its first cut);
do not list a fix as if it were still to do. Then look for further problems:
go through the signals and every sample in catalog.md again, not only the
proposals now shown, and add each one that fits. `cca advise` prints what was added, updated, kept and
removed.

**Each proposal is one concrete action that is enough on its own**: the
setting, file, skill or subagent to change and what to put there (a key and
value, a line to add). Before naming a setting or feature, open its current
docs page and check the name, the accepted values, which models it applies to
and what overrides it (a choice made inside a session can override the
settings file); put that page in `source`. When no docs page confirms a claim,
leave it out or say it is not confirmed. Do not propose a setting that is
already in place; when it is in place but the numbers show it is not taking
effect, say that instead.
Never invent a setting. A value is a starting point: say what to watch to tune
it. Rate each proposal 1–5 stars on each axis (upkeep is `ease`, quality kept is
`safety`) with [ratings.md](references/ratings.md), starting from the closest sample in
[catalog.md](references/catalog.md); the overall stars are their geometric
mean to one decimal place. When a proposal changes the compaction length or
the size of tool results, measure its savings with `cca simulate` rather than
estimating them. Look first for fewer calls: every call reads the whole
conversation again, so cutting repeated calls saves far more than making each
one smaller. Proposals that trade quality for cost are still listed, so the
user can weigh them.

`link` takes the `cca link` options (project, period, date, metrics, tool,
session, focus, item); reading.md says which fits each signal. Use
`period: 7d` with today's date for the summary's 7 days. **Numbers the
linked view shows must match it** when they are written: the report shows one
period at a time, so quote that period's numbers, not another window's. A kept
proposal keeps its numbers while they hold (see above), even if the view now
shows a slightly different value. Numbers the view cannot
show (before and after a change, one project's share) say where they come from.
For every number in the detail, name the command and days it came from (for
example `cca summary --tool "bash cat"`, 10/11–10/17), so the next run can
work it out the same way and tell a real move from a different method.

Write the proposals in the language the user asks for. Without a request, keep
the language of the proposals now shown, or use the user's language for a
first list. When the language changes, rewrite every proposal and say so once
in its `news`.

6. **Reply briefly.** One line per proposal that is new or changed (or "no
   change" when nothing moved), the verdict on each recorded change (or when
   to look again), the report link (`http://127.0.0.1:7319/`), and what to
   watch next and when. Offer to record a step's start with
   `cca mark add YYYY-MM-DD "short name"`.

**Respect what the user decided.** Never propose a declined option or a close
variant of it; work within the reason given, and when the reason sets a limit
(for example "about 500k is fine"), stay within it. When the numbers show the
user changed something on purpose (a setting, the model or the effort), do not
propose undoing it without asking about it in the detail. When the user turns an option
down, record it with `cca decline add "<option>" --reason "<why>"`, and drop it
from the list.

## Do not

- Give vague advice ("keep conversations short"). Turn the principle into an
  action the user can take now, checked against the current docs.
- Claim a cause the numbers do not show. Say "suggests", and name the
  alternative explanation (a different mix of work, model or project).
- Judge a change on too little data. Follow measuring.md.
