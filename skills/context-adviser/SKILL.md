---
name: context-adviser
description: Review what Claude Code conversations cost and propose the next step. Runs the cca CLI, reads the numbers against basic principles, and writes up to three findings as notes on the report, each next to the item it is about. Use for /context-adviser or a scheduled cost review.
---

# Context Adviser

Review Claude Code cost and leave the findings on the report itself, so the
reader sees each note next to the data. The only writes are the report, the
notes (`cca advise`) and, when the user agrees, `cca mark add`.

1. **Refresh.** Run `cca build`, then `cca summary` (add `--project NAME`
   when asked). It has what the report shows: totals against the previous
   period, each day, cost by model, tool use as a tree, sessions and recorded
   changes. To follow one tool or group over the days, add
   `--tool "bash chill"`. Use `--json` when you need exact numbers. If `cca`
   is missing, say so and stop.
2. **Read.** Follow [reading.md](references/reading.md): find at most three
   signals, each with its numbers, period and sample size.
3. **Explain.** Match each signal to a principle in
   [principles.md](references/principles.md), with its source.
4. **Check past changes.** For each recorded change, judge it with
   [measuring.md](references/measuring.md). A verdict can be a note too.
5. **Write the notes.** Save a JSON file and run `cca advise FILE`. If it says
   nothing is serving the report, start `cca serve` in the background.

```json
{
  "title": "This week (10/12–10/16)",
  "notes": [{
    "title": "Short headline",
    "finding": "What is happening here: the numbers, their share of cost, and what they suggest. A short paragraph.",
    "advice": "The principle, and why it fits these numbers. One or two sentences.",
    "options": [
      {"title": "One way to apply it", "detail": "What it means in practice, and when it suits."},
      {"title": "Another way", "detail": "How it differs, and when to pick it instead."}
    ],
    "source": "https://… (the principle's source)",
    "link": {"period": "week", "date": "2026-10-16", "tool": "bash grep"}
  }]
}
```

`link` takes the `cca link` options (project, period, date, metrics, tool,
session, focus, item); reading.md says which fits each signal. **The numbers in
a note must be the ones the linked view shows**: the report shows one period at
a time, so quote that period's numbers, not the summary's window.

Give each note two or three `options`: different ways to apply the principle,
each in its own entry, so the user can compare and choose. Say what each one
suits; do not rank them unless the numbers favor one.

Write the notes in the user's language. Give them room: a few sentences each is
fine, and a blank line starts a new paragraph.

6. **Reply briefly.** One line per note, plus the link to the first note
   (`http://127.0.0.1:7319/#note=1`), what changed since the previous period
   (or why it cannot be compared), and up to three next steps with the number
   to watch and when. Offer to record a step's start with
   `cca mark add YYYY-MM-DD "short name"`.

## Do not

- Prescribe a specific product, setting value or tool. State the principle and
  let the user choose the means; specifics go stale.
- Claim a cause the numbers do not show. Say "suggests", and name the
  alternative explanation (a different mix of work, model or project).
- Judge a change on too little data. Follow measuring.md.
