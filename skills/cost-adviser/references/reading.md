# Reading the numbers

Cost = cost per call × number of calls. Start by asking which of the two moved.
P1–P6 are the principles in [principles.md](principles.md).
Compare a number with the previous period or with its own history, not with a
fixed target. When the previous period had little use (the summary leaves out
its ratios, or the totals change by several times), compare day by day within
the window instead; use the ratios (per hour, per call) because totals follow how
much work there was.

| Look at | A signal when | Points to | Link (`cca link …`) |
|---|---|---|---|
| Cost / call and Avg context | Both rise together | Conversations carry more context. P1, P2 | `--metrics stats.ctx,stats.perCall --date DAY` |
| Calls (with Active time) | Calls rise faster than active time, or one session takes most calls | More round trips per piece of work. P4 | `--metrics totals.calls,totals.activeMs` |
| Top tools | One tool or command takes a large and growing share of cost | Repeated calls of the same kind; its examples show what. P4, P5 | `--tool NAME` (a group works too, e.g. `--tool "bash chill"`) |
| `(final reply)` share | Large share of cost in calls that use no tool (the reply that ends each turn) | Many turns back to the user, each reading a long context. P1, P2 | `--tool "(final reply)"` |
| Cache hit rate | Drops against its own history | Something is rebuilding the cache. P3 | `--metrics stats.cacheHit` |
| Cache write (summary Totals, "of which cache write") | Grows as a share | Same as above: rebuilds after breaks or changes mid-conversation. P3 | `--focus cost-type --item "Cache write"` |
| Top sessions | One long-running session dominates cost and active time | One conversation does many tasks. P2 | `--session ID` |
| Subagent calls | Moves after a delegation change | Whether delegation happens at all; judge cost with P5 | `--metrics stats.subShare` |
| Compacting / active hour, and Cost by type: Compacting | Grows after a change that shortens or splits conversations, or one session compacts again and again | The cost of summarizing, paid instead of carrying the long context. Weigh it against the input it saved. P1, P2 | `--metrics stats.compactPerHour` or `--focus cost-type --item Compacting` |
| Cost by model | The mix shifts | A mix change can explain a cost change by itself; rule it out first | `--focus cost-model` |

Add `--project NAME` when the signal belongs to one project. The report shows
Profile, Sessions and Calls by action for one period at a time (the latest day unless
told otherwise), so add `--period 7d --date DAY` to match the summary's 7
days (counted back from the build day), `--period 3d` for the last three days,
or `--date DAY` for a single day. A link opens the report on that item
and highlights it. Calls by action is a tree (each call's cost goes to the
tools it asked for, its final reply, or compacting): commands that share leading words add
up (bash › chill › connection › reply), so compare groups as well as leaves.
A group can hold work the proposal does not touch: `bash cat` has `bash cat (write)`
for files written with `cat >`, and `bash python3` has edits and writes. Quote
the leaves the proposal acts on; `--tool "bash cat (itself)"` is the group's own
uses alone, and `--tool` refuses a name no call has.
Sessions lists each project and its sessions; picking one narrows Calls by
action to it, which shows what one project or one conversation spent on.

Compacting is partly estimated: the summary request is not logged, so its
cost is worked out from the conversation size before it (read from the cache)
and the summary's length. The cache write right after it is measured. Say
"about" when quoting it.

The summary's "By day" table shows whether a change in a total is one day or a
trend; read it before calling something a trend. `cca summary --tool NAME`
gives one tool or group by day (cost, uses, share, per active hour) with its
costliest examples, which is how to check a tool-level change.

A ratio missing from the summary means the period had too little use (under 10
minutes or 10 calls). Say so instead of reading it as zero.

Before naming a signal, filter by project: one busy project can move the total.

A signal with no sample in catalog.md and no way to measure it (one session
taking most of the cost, a large final-reply share) goes in the reply as an
observation, not as a proposal. Setting keys are on the settings reference
page (https://code.claude.com/docs/en/settings-reference); it is long, so look for the
key by name.
