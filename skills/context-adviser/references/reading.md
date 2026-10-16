# Reading the numbers

Cost = cost per call × number of calls. Start by asking which of the two moved.
P1–P6 are the principles in [principles.md](principles.md).
Compare a number with the previous period or with its own history, not with a
fixed target; use the ratios (per hour, per call) because totals follow how
much work there was.

| Look at | A signal when | Points to |
|---|---|---|
| Cost / call and Avg context | Both rise together | Conversations are carrying more context. P1, P2 |
| Calls (with Active time) | Calls rise faster than active time, or one session takes most calls | More round trips per piece of work. P4 |
| Top tools | One tool or command takes a large and growing share of cost | Repeated calls of the same kind; check its examples in the report. P4, P5 |
| `(text only)` share | Large share of cost with no tool | Long replies or long thinking in a long context. P1, P6 |
| Cache hit rate | Drops against its own history | Something is rebuilding the cache. P3 |
| Cost by type: Cache write | Grows as a share | Same as above: rebuilds after breaks or changes mid-conversation. P3 |
| Top sessions | One long-running session dominates cost and active time | One conversation is doing many tasks. P2 |
| Subagent calls | Moves after a delegation change | Whether delegation happens at all; judge cost with P5 |
| Cost by model | The mix shifts | A mix change can explain a cost change by itself; rule it out first |

A ratio missing from the summary means the period had too little use (under 10
minutes or 10 calls). Say so instead of reading it as zero.

Before naming a signal, filter by project: one busy project can move the total.
