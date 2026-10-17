---
name: cost-adviser
description: Review what Claude Code conversations cost and keep a list of improvement proposals on the report. Runs the cca CLI, reads the numbers against basic principles, and updates the proposals listed under the projects, each with an overall star rating from three rated axes, the action to take and its details. Use for /cost-adviser or a scheduled cost review.
---

# Cost Adviser

**The goal:** help the user spend less on Claude Code without losing quality.
Keep a short list of proposals on the report. Each is a problem the numbers
show now and one concrete fix, rated so the user can weigh it. Keep the list
steady: from one run to the next it changes only where the numbers or the
facts did, so that a change on the report means something.

The only writes are the proposals (`cca advise`) and, when the user agrees,
`cca mark add` and `cca decline add`.

## Steps

1. **Look.** Run `cca build`, then `cca summary`. Its options narrow the view:
   `--full-days` (leave out today, which is partial), `--tool NAME` (one tool
   or group from the tree; repeat to add several), `--since`/`--until`,
   `--project`, `--json`. Read the settings in effect: `~/.claude/settings.json`
   and each project's `.claude/settings.json` and `.claude/settings.local.json`.
   Launch flags win over them; count those of the running sessions with
   `ps -axo command | grep -oE -- '--(model|effort|autocompact)[= ][^ ]+' | sort | uniq -c`
   (their path also shows the Claude Code version that is running).
   This review is in the data too, as a subagent of the session running it.
2. **Find the problems.** Read the signals with
   [reading.md](references/reading.md), explain each with a principle in
   [principles.md](references/principles.md), and match it to a sample in
   [catalog.md](references/catalog.md). Look first for fewer calls: every call
   reads the whole conversation again, so cutting repeated calls saves far
   more than making each one smaller.
3. **Judge past changes** with [measuring.md](references/measuring.md): the
   recorded ones, and those the summary spots (Context jumps, Mix shifts). The
   summary says when a verdict is due. Offer `cca mark add` for one that is not
   recorded.
4. **Update the list** and save it with `cca advise FILE` (below). Start
   `cca serve` in the background if it says nothing is serving the report.
5. **Reply briefly** in the user's language: what changed in the list, each
   change's verdict or the day it is due, the report link
   (`http://127.0.0.1:7319/`), and what to watch next.

## A good proposal

- **A problem the numbers show now**, on full days, that the action would act
  on for at least 1% of the cost. Smaller ones go in the reply.
- **One action that is enough on its own**: the setting or file and what to
  put there. Check it against the current docs and name the page for each
  claim; a claim stays unless a page says otherwise. Never invent a setting,
  and do not propose one already in place (say so if it is in place but not
  taking effect).
- **Within what the user decided.** Never propose a declined option or a close
  variant; stay within the reason given ("about 500k is fine"). When the
  numbers show the user chose something on purpose, ask before proposing to
  undo it. Record a new refusal with `cca decline add`.
- **Rated** 1–5 on upkeep (`ease`), quality kept (`safety`) and savings with
  [ratings.md](references/ratings.md), starting from the closest catalog
  sample. Measure savings with `cca simulate` when the proposal changes the
  compaction length or the size of tool results.
- **Reproducible.** Quote full-day numbers, each with the cca command and
  days it came from, preferably one command rather than arithmetic by hand,
  so the next run can measure it the same way and today's partial numbers do
  not drift it.

## Keeping the list steady

- Use the same `id` for the same proposal. Measure each one again, and keep it
  exactly as written, `news` included, while its numbers move less than about
  a tenth (about a point for shares under 10%) and its facts and reasoning
  hold. Otherwise change only what moved, and say what in `news`.
- When a change is about what a proposal targets and there are fewer than 2
  full days since, wait: keep the rating and say in `news` until when. If the
  problem is already under 1% since the change, drop it; the change dealt
  with it.
- When the user has carried a fix out, drop it if the problem is gone, or turn
  it into the next step. Never keep "keep doing this".
- When the summary says cca's prices or counting changed, measure again; that
  alone does not make an update.
- Write in the language the proposals are in, unless the user asks otherwise.

```json
{"proposals": [{
  "id": "compact-at-half-window",
  "title": "Up to 40 characters, e.g. Compact long conversations at half the window",
  "summary": "Up to 200 characters: the problem now and the fix. The list shows only the title and this.",
  "action": "One line, e.g. Add \"autoCompactWindow\": 500000 to ~/.claude/settings.json",
  "detail": "Why (the numbers, their share of cost, the principle), exactly what to change, what it should do to the numbers and how to tell. A blank line starts a paragraph.",
  "news": "Optional, up to 300 characters: what moved since the last run, with the numbers and the date.",
  "project": "Optional: the project it is for",
  "ratings": {"ease": 5, "safety": 4, "savings": 5},
  "source": "https://… (the docs page for the setting or feature)",
  "link": {"period": "7d", "date": "2026-10-16", "focus": "cost-model"}
}]}
```

`link` opens the report on the view the numbers come from (the `cca link`
options; reading.md says which fits). Copy the current list from
`cca summary --json`; `cca advise` works out the stars and dates and ignores
them in the file.

## Do not

- Give vague advice ("keep conversations short").
- Claim a cause the numbers do not show. Say "suggests", and name the other
  explanation.
- Judge a change on too little data.
