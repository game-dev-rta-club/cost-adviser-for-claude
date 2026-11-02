# Sample proposals

These proposals often fit. Rate them by [ratings.md](ratings.md). Upkeep is
fixed for each one, and so is quality, except that the share of conversations
a proposal touches decides between 3 and 2 stars. Savings depends on the
user's numbers; the savings and shares of conversations given here come
from one real week, except where
they are marked as estimates. Do not propose anything the user has declined; the
summary lists declined proposals. Check the name and value of every setting
against its current documentation before proposing it.

Cost is the number of calls × what each call reads on average × the price per
token, plus the cache written again after it expires. So the samples come
under four angles; go through each, since a problem under one angle does not
show under another:

- **A. Fewer calls.** Every call reads the whole conversation again, so this
  usually saves the most.
- **B. Less read per call, on average.** Two ways: keep the conversation
  small, or move the calls out of it, so that tool use a long conversation
  would do is done by an agent that starts with little context.
- **C. A lower price.** A cheaper model or less thinking.
- **D. The cache kept.** Less written again after a break.

## A. Fewer calls

### 1. Combine a command that is called many times into fewer calls

**Propose it when** the same command, or the same check, is called many times
and takes a large share of the cost: for example, a status check before every
step, or asking again and again until something finishes. `cca summary --tool`
shows its parts (a script's subcommands too, e.g. `bash node tool.mjs run`);
when the repeated part cannot be named from them, mention the signal in the
reply instead of proposing.

**Ratings:** upkeep 3 stars, because the tool has to be changed to fit that
workflow; quality 5 stars, because the same work is done with fewer calls;
savings 5 stars in the example week, where halving a command that took 26% of
the cost cut 13%. **Overall: 4.2.**

### 2. Give the agent one call that shows what now takes several lookups

**Propose it when** reading and searching take a large share of the cost
(`cca summary --tool read --tool "bash grep" --tool "bash cat (itself)" …`
with the lookup tools the tree shows) and the same kind of lookup comes back
again and again: finding where something is defined, the layout of a folder,
the state of the work. Ways to do it include a code intelligence plugin (the
LSP tool goes to definitions and references directly), a short map of the
project the agent reads first, and a script that prints the whole state at
once.

**Ratings:** upkeep 3 stars; quality 5 stars; savings 3 stars, an estimate:
one call instead of three, for a third of lookups that take 19% of the cost,
cuts about 4%. **Overall: 3.6.**

## B. Less read per call, on average

**Keep the conversation small**

### 3. Make tool results smaller

**Propose it when** a tool returns large results each time, or the same large
file is read again and again. Ways to do it include a limit on the number of
results, a summary instead of a full list, and reading only the part of a file
that is needed.

**Ratings:** upkeep 3 stars; quality 5 stars; savings 3 stars in the example
week, where `cca simulate --tool-results 0.7` (results 30% shorter) cut 2.1%
(see "Making the context smaller saves little" in ratings.md).
**Overall: 3.6.**

### 4. Shorten the text the user's own hooks or skills add to every call

**Propose it when** the same text is added to every call, or a large fixed
instruction is loaded in every conversation. Adding the text only when it has
changed works too. The summary's "Text added by hooks" shows each hook's
count, average length and estimated share of cost by day; text a skill or
CLAUDE.md loads is not in it.

**Ratings:** upkeep 3 stars; quality 5 stars; savings 1 star, usually under 1%
for the reason in "Making the context smaller saves little". **Overall: 2.5.**

### 5. Start compaction at half of the context window

**Propose it when** calls that read more than half of the context window take a
clear share of the cost. The setting is `autoCompactWindow`; set it to half of
the context window of the model in use, read from the model's documentation.
For a model with a one-million-token window, that is 500,000.

**Ratings:** upkeep 5 stars, though it should be checked again when the model
changes; quality 3 or 2 stars by the share of conversations that reach half
of the window, which the replay below prints, because a summary drops detail;
savings 5 stars in the example week, where
`cca simulate --compact-at 500000` (from one million) cut about 12%, even after
counting the extra compactions. **Overall: 4.2 with quality 3 stars, 3.7 with
2.**

### 6. Below half of the context window, lower the compaction length by one step

**Propose it when** the compaction length is already at half of the context
window or lower (read `autoCompactWindow` in the user's settings). One step is one twentieth of the context window: for a
one-million-token window, 500,000 to 450,000, then 450,000 to 400,000, and so
on. Context windows differ between models and grow with new ones, so work out
the step from the window of the model in use, read from its documentation.

Propose one step at a time, never a large cut at once. Nobody knows where the
work starts to suffer, and the adviser cannot see whether quality dropped. So
say plainly, when proposing it, that a lower compaction length may lower the
quality of the work.

Do not propose it when a declined proposal's reason sets a lower limit at or
above the current length (for example "about 500,000 is fine").

**Ratings:** upkeep 5 stars; quality 2 stars, because a summary drops detail:
in the example week 14% of conversations reached the new length;
savings 3 stars in the example week, where one step from 500,000 to 450,000
cut about 4.1%.
**Overall: 3.1.**

### 6b. Make a part of the context smaller, and lower the compaction length by the same share

**Propose it when** a part of what fills the context can be made smaller
without losing what the work uses: most often one tool's or command's results,
which the summary's "What fills the context" shows (sample 3), but also text a
hook or skill adds (sample 4). Making the part smaller on its own only delays the next
compaction (see "Making the context smaller saves little" in ratings.md).
Lowering the compaction length by the share of context growth that goes away
keeps what a conversation holds before it compacts, while every call reads
less.

Take off no more than the part's share of context growth × how much of it goes
away, over the conversations where it will shrink
(`cca summary --project NAME`): a part that is 8% of the growth, made 30%
shorter, takes 2.4% away, so 450,000 can become 440,000. Set the length where
only those conversations get it (the project's own `.claude/settings.json` or
`.claude/settings.local.json`) and measure both changes together with
`cca simulate --project NAME --tool-results 0.7 --tool read --compact-at 440000`.
Make both changes together and record them as one change (`cca mark add`), so
later numbers split into before and after at one date. Afterwards, check that
the part's share fell as planned; if it fell less, raise the length to match.

**Ratings:** upkeep 3 stars, because the part to make smaller differs between
projects; quality 5 stars, because a conversation holds as much of what the
work uses before it compacts, and only what it does not use is cut; savings by
the replay. **Overall: 2.5 with savings 1 star, 3.1 with 2, 3.6 with 3.**

**Move tool use to an agent with little context**

### 7. Hand self-contained runs of tool calls to a fresh agent

**Propose it when** the main conversation is long and does runs of many tool
calls in a row between its replies. `cca simulate --delegate 5-19` replays it
as if each run of 5 to 19 calls had gone to a fresh agent (a subagent) that
starts small and hands back a short report. The replay is the most it can
save: it assumes every such run can be handed over.

The action: a subagent in `~/.claude/agents/` (or the project's
`.claude/agents/`), with `model: inherit` to keep the same model, whose
`description` says what to hand it (one fix with its
test, one check, one lookup) and whose body says what a brief must hold: the
goal, the files to read, the constraints and decisions already made, how to
check the work, and what to report. A `SubagentStop` hook can run the check,
so the main conversation does not read the work again. Or an open-source
multi-agent setup that fits, found by searching (SKILL.md, "One action").

**Ratings:** upkeep 3 stars, because what to hand over depends on the kind of
task; quality 2 stars, because a brief can miss what only the main
conversation knows: in the example week 74% of conversations had runs to hand
over; savings on half of the replayed cut, since not every run
can be handed over: 4 stars in the example week, where the replay cut 9.6%.
**Overall: 2.9.**

### 8. Hand research to a subagent and keep only its result

**Propose it when** search and read tools take a large share, and most of what
they return is never used later in the conversation. The subagent uses the
same model; only its final answer comes back into the main conversation.

**Ratings:** upkeep 4 stars, because it works across projects with almost no
tuning; quality 4 stars, because what was read and not kept can be read
again; savings 2 stars, estimated at about 1.5%, because this makes
the context smaller and the subagent's own calls cost money too.
**Overall: 3.2.**

### 9. Hand research to a subagent on a lighter model

**Propose it when** search and read tools take a large share of the cost.

**Ratings:** upkeep 3 stars; quality 2 stars, because a lighter model may miss
things: in the example week 51% of conversations searched or read;
savings 5 stars,
estimated at about 10% when those calls take a large share, from the lower
price per call. **Overall: 3.1.**

## C. A lower price

### 10. Use a smaller model by default

**Propose it when** one large model takes most of the cost. It works well for
some users, so it is worth showing as a choice to consider.

**Ratings:** upkeep 5 stars; quality 1 star, because everyday work loses
quality; savings 5 stars, from the lower price per call: on the pricing page a smaller
model can cost half as much per token or less, so moving most calls cuts a
large share.
**Overall: 2.9.**

### 11. Lower the effort level for all work

**Propose it when** output, which includes the model's thinking, takes a clear
share of the cost.

**Ratings:** upkeep 5 stars; quality 1 star, because all work gets less
thinking; savings 3 stars, estimated at a little under half of output's share
of the cost (about 4% in an example week where output was 9%). **Overall: 2.5.**

### 12. Work on a lighter model and consult a stronger one at decision points

**Propose it when** one large model takes most of the cost and most turns are
routine. The advisor tool lets the main model call a stronger one before it
commits to an approach, when an error keeps coming back, and before it calls
a task done (`/advisor opus`, or `advisorModel` in the settings, with a
lighter main model). Each consultation reads the whole conversation without
the cache, so it pays off when consultations are few.

**Ratings:** upkeep 5 stars; quality 2 stars, because the lighter model still
does the work; savings 4 stars, an estimate: less than moving to the lighter
model outright, because of the consultations. **Overall: 3.4.**

## D. The cache kept

### 13. Compact before a long break instead of letting the cache expire

**Propose it when** the summary's "Cache write after the cache expired" takes
a clear share of the cost (the `expired` column by day), and the "cache
rebuilt" examples in `--tool` are long conversations picked up after a break.
After the cache expires, the next call writes the whole conversation again; a
compaction while the cache is still warm reads it at the cache price and
writes only the summary. In a terminal session on the one-hour cache, Claude
Code compacts an idle long conversation shortly before the cache expires
(check that `idleCompaction` is not set to `false`); the summary's "1-hour
cache" share says which cache is in use, and the docs say which sessions
compact when idle. Elsewhere, `/compact` at
a natural break before stepping away does the same, and so does starting a new
conversation instead of resuming a long one whose context is no longer needed.

**Ratings:** upkeep 5 stars when it is a setting, 1 star when the user has to
remember it; quality 2 stars, because the summary drops detail: in the
example week about 45% of conversations were picked up after a break longer
than the cache lasts (an estimate); savings on
half of the expired share, since not every break is known in advance: 4 stars
in the example week, where it was 13% of the cost. **Overall: 3.4 as a
setting, 2.0 as a habit.**
