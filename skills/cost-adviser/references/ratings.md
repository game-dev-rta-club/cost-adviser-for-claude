# How to rate a proposal

Every proposal gets from one to five stars on each of three axes: upkeep,
quality kept, and savings. In the proposals file they are `ratings.ease`,
`ratings.safety` and `ratings.savings`, as whole numbers. The overall rating is
the geometric mean of the three: multiply the three numbers together, take the
cube root, and round to one decimal place. `cca advise` works it out. Because
the numbers are multiplied, one weak axis pulls the overall rating down even
when the other two are high. A proposal that costs quality may still be listed
so that the user can weigh it; the report shows ★3 and above at first, and the
user can move a slider to see the rest.

Rate by the descriptions below and by the sample proposals in
[catalog.md](catalog.md), not by a general impression, so that the same
proposal gets the same stars every time. For a new kind of proposal, find the
closest sample and rate it the same way.

## Upkeep (`ease`)

How little attention the proposal needs once it is in place. The less upkeep,
the more stars.

- **5 stars:** Set it once and it keeps working. It only needs a look at big
  events, such as a new model.
- **4 stars:** It works across many different projects with almost no tuning.
- **3 stars:** It has to be tuned for each project or each kind of task.
- **2 stars:** It is not finished after one setup. It needs frequent tuning, or
  regular care as the work changes.
- **1 star:** The user has to think about it every time.

## Quality kept (`safety`)

How well the work keeps its quality and speed.

- **5 stars:** Nothing is lost. The proposal only removes waste: the same
  model, at the same effort, does the same work with fewer or smaller calls.
- **4 stars:** It affects the work in theory, but not enough to notice.
- **3 stars:** Some kinds of work may lose quality.
- **2 stars:** Some kinds of work lose quality.
- **1 star:** Everyday work loses quality, or the change is large and nobody
  can tell what it will do.

## Savings (`savings`)

How much the proposal is expected to cut the user's total cost, estimated from
their recent numbers.

- **5 stars:** 10% or more. A 10% cut is already large.
- **4 stars:** 5% to 10%.
- **3 stars:** 2% to 5%.
- **2 stars:** 1% to 2%.
- **1 star:** Under 1%, or no clear link to the numbers.

When the proposal changes the compaction length or the size of tool results,
measure the cut with `cca simulate` instead of estimating it. It replays the
user's recent conversations call by call as if the change had been in place:

```sh
cca simulate --compact-at 500000      # compaction starts at 500,000 tokens
cca simulate --tool-results 0.7       # tool results 30% shorter
cca simulate --tool-results 0.7 --tool read --tool "bash cat"   # only these
```

A proposal that shortens only some tools' results must name each of them with
`--tool` in one run (a group works too, e.g. `"bash cat"`); shortening every
result overstates it, and adding up separate runs misses how they interact
through compaction. A result under 1% either way is within what the replay
can tell apart: read it as no clear effect, savings 1 star. Rate from full
days: add `--full-days`, which ends the replay at yesterday, since a partial
today moves the result as the day fills. Use the 7 days, except when the
compaction length changed inside them: it shapes every replay, so then every
replay covers only the full days since the change (`--days` with
`--full-days`). When that leaves fewer than 2 full days, keep the savings
rating the proposal has, say in `news` that it is waiting for more days, and
rate it again once there are 2. A short window under 2% reads as no clear
effect. Shorter results
can even come out a little more expensive over a few days, because they move
where each conversation stands between compactions when it ends; read that as
no clear effect too.

Add `--project NAME` for a proposal about one project, and `--days N` to change
the window (7 days by default, the same days as the summary). The replay
compares against the conversations as they ran, not against the current
setting: it prints the length they really compacted at. If the setting changed
during the window, cover only the days since (see above); for one step down
from the current compaction length, give the length after the step. The
replay leaves out cache rebuilds (a conversation reread after the cache
expired), so its cost is below the recorded cost; rate by the percentage, not
by the dollar amounts. For other proposals, estimate the cut from the share of
cost the proposal touches and how much of it goes away: halving a command that
takes 26% of the cost cuts about 13%.

### Fewer tool calls save far more than smaller ones

Every tool call makes the model read the whole conversation again. So cost
grows with the number of calls, almost in proportion. A call with a short
result is still expensive when it is repeated many times. Proposals that cut
the number of calls are usually the ones that save the most.

### Making the context smaller saves little

The context window is the largest number of tokens a model can read in one
call. When a conversation reaches the compaction length, Claude Code summarizes
it and continues from the summary. In a conversation that compacts, the context
rises from about a fifth of the compaction length to all of it, again and
again, so on average each call reads about 60% of that length, whatever each
call adds. Adding less to the context only delays the next compaction; each
call still reads about as much. Only conversations that end before they ever
compact read less on every later call.

So estimate such a proposal like this, when `cca simulate` does not cover it:
the share of context growth that goes away, multiplied by the share of cost in
conversations that never compact. For example, if tool results are 30% of the
context growth and the proposal makes them 30% shorter, 9% of the growth goes
away; if conversations that never compact are 28% of the cost, the cut is about
9% × 28%, or 2.5%. Replaying a real week of conversations gave 2.1% for this
case.
