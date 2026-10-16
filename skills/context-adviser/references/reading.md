# Reading the numbers

Cost = cost per call × number of calls. Start by asking which of the two moved.
P1–P6 are the principles in [principles.md](principles.md).
Compare a number with the previous period or with its own history, not with a
fixed target; use the ratios (per hour, per call) because totals follow how
much work there was.

| Look at | A signal when | Points to | Link (`cca link …`) |
|---|---|---|---|
| Cost / call and Avg context | Both rise together | Conversations carry more context. P1, P2 | `--metrics stats.ctx,stats.perCall --date DAY` |
| Calls (with Active time) | Calls rise faster than active time, or one session takes most calls | More round trips per piece of work. P4 | `--metrics totals.calls,totals.activeMs` |
| Top tools | One tool or command takes a large and growing share of cost | Repeated calls of the same kind; its examples show what. P4, P5 | `--tool NAME` |
| `(text only)` share | Large share of cost with no tool | Long replies or long thinking in a long context. P1, P6 | `--tool "(text only)"` |
| Cache hit rate | Drops against its own history | Something is rebuilding the cache. P3 | `--metrics stats.cacheHit` |
| Cost by type: Cache write | Grows as a share | Same as above: rebuilds after breaks or changes mid-conversation. P3 | `--focus cost-type --item "Cache write"` |
| Top sessions | One long-running session dominates cost and active time | One conversation does many tasks. P2 | `--session ID` |
| Subagent calls | Moves after a delegation change | Whether delegation happens at all; judge cost with P5 | `--metrics stats.subShare` |
| Compacting / active hour, and Cost by type: Compacting | Grows after a change that shortens or splits conversations, or one session compacts again and again | The cost of summarizing, paid instead of carrying the long context. Weigh it against the input it saved. P1, P2 | `--metrics stats.compactPerHour` or `--focus cost-type --item Compacting` |
| Cost by model | The mix shifts | A mix change can explain a cost change by itself; rule it out first | `--focus cost-model` |

Add `--project NAME` when the signal belongs to one project. The report shows
Profile, Tool Use and Sessions for one period at a time (the latest day unless
told otherwise), so add `--period week --date DAY` to match the summary's
week, or `--date DAY` for a single day. A link opens the report on that item
and highlights it.

Compacting is partly estimated: the summary request is not logged, so its
cost is worked out from the conversation size before it (read from the cache)
and the summary's length. The cache write right after it is measured. Say
"about" when quoting it.

A ratio missing from the summary means the period had too little use (under 10
minutes or 10 calls). Say so instead of reading it as zero.

Before naming a signal, filter by project: one busy project can move the total.
