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
   is missing, say so and stop. The summary ends with the options the user
   declined and the notes already shown; both limit what you write.
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
      {"title": "A concrete action, e.g. set autoCompactWindow to 200000",
       "action": "The conclusion in one line: exactly what to do, e.g. Add \"autoCompactWindow\": 200000 to ~/.claude/settings.json",
       "detail": "Exactly where and what to change (file, key, value or text to add), what it does to these numbers, and how to tell if the value should move.",
       "source": "https://… (the docs page for that setting or feature)",
       "ratings": {"ease": "A", "safety": "B", "savings": "A"}},
      {"title": "Another way", "detail": "How it differs, and when to pick it instead.",
       "ratings": {"ease": "B", "safety": "A", "savings": "A"}}
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
each in its own entry, so the user can compare and choose. **Each option is a
concrete action that is enough on its own**: the setting, file, skill or
subagent to change and what to put there (a key and value, a line to add).
Before naming a setting or feature, open its current docs page and check the
name and accepted values; put that page in the option's `source`. Never invent
a setting. Start each option with `action`: the conclusion in one line, so the
user knows what to do without reading the rest. A value is a starting point: say what to watch to tune it. Say what
each option suits. Rate each option with [ratings.md](references/ratings.md) and leave out
any option rated C on an axis; prefer options that work once set up over ones
the user must remember each time.

Write the notes in the user's language. Give them room: a few sentences each is
fine, and a blank line starts a new paragraph.

6. **Reply briefly.** One line per note, plus the link to the first note
   (`http://127.0.0.1:7319/#note=1`), what changed since the previous period
   (or why it cannot be compared), and up to three next steps with the number
   to watch and when. Offer to record a step's start with
   `cca mark add YYYY-MM-DD "short name"`.

**Respect what the user decided.** Never propose a declined option or a close
variant of it; work within the reason given. When the user turns an option
down, record it: `cca decline add "<option>" --reason "<why>"`.

**Only write what is new.** Leave a note out when it repeats one already shown
without new numbers or a new option, or when every good option for it was
declined. If nothing is new, do not run `cca advise`; say there is nothing new
and keep the reply to a line.

## Do not

- Give vague advice ("keep conversations short"). Turn the principle into an
  action the user can take now, checked against the current docs.
- Claim a cause the numbers do not show. Say "suggests", and name the
  alternative explanation (a different mix of work, model or project).
- Judge a change on too little data. Follow measuring.md.
