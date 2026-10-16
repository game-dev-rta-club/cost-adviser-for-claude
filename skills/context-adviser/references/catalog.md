# Sample proposals

These proposals often fit. Upkeep and quality are fixed for each one; savings
depends on the user's numbers, and the savings given here come from one real
week, except where they are marked as estimates. Rate them by
[ratings.md](ratings.md). Do not propose anything the user has declined; the
summary lists declined proposals. Check the name and value of every setting
against its current documentation before proposing it.

## 1. Combine a command that is called many times into fewer calls

**Propose it when** the same command, or the same check, is called many times
and takes a large share of the cost: for example, a status check before every
step, or asking again and again until something finishes.

**Ratings:** upkeep 3 stars, because the tool has to be changed to fit that
workflow; quality 5 stars, because the same work is done with fewer calls;
savings 5 stars in the example week, where halving a command that took 26% of
the cost cut 13%. **Overall: 4.2.**

## 2. Make tool results smaller

**Propose it when** a tool returns large results each time, or the same large
file is read again and again. Ways to do it include a limit on the number of
results, a summary instead of a full list, and reading only the part of a file
that is needed.

**Ratings:** upkeep 3 stars; quality 5 stars; savings 3 stars in the example
week, where `cca simulate --tool-results 0.7` (results 30% shorter) cut 2.1%
(see "Making the context smaller saves little" in ratings.md).
**Overall: 3.6.**

## 3. Shorten the text the user's own hooks or skills add to every call

**Propose it when** the same text is added to every call, or a large fixed
instruction is loaded in every conversation. Adding the text only when it has
changed works too.

**Ratings:** upkeep 3 stars; quality 5 stars; savings 1 star, usually under 1%
for the reason in "Making the context smaller saves little". **Overall: 2.5.**

## 4. Start compaction at half of the context window

**Propose it when** calls that read more than half of the context window take a
clear share of the cost. The setting is `autoCompactWindow`; set it to half of
the context window of the model in use, read from the model's documentation.
For a model with a one-million-token window, that is 500,000.

**Ratings:** upkeep 5 stars, though it should be checked again when the model
changes; quality 4 stars; savings 5 stars in the example week, where
`cca simulate --compact-at 500000` (from one million) cut about 16%, even after
counting the extra compactions. **Overall: 4.6.**

## 5. Below half of the context window, lower the compaction length by one step

**Propose it when** the compaction length is already at half of the context
window or lower (read `autoCompactWindow` in the user's settings). One step is one twentieth of the context window: for a
one-million-token window, 500,000 to 450,000, then 450,000 to 400,000, and so
on. Context windows differ between models and grow with new ones, so work out
the step from the window of the model in use, read from its documentation.

Propose one step at a time, never a large cut at once. Nobody knows where the
work starts to suffer, and the adviser cannot see whether quality dropped. So
say plainly, when proposing it, that a lower compaction length may lower the
quality of the work. The risk adds up with every step, so the quality rating
stays at 3 stars however many steps have gone well.

**Ratings:** upkeep 5 stars; quality 3 stars; savings 3 stars in the example
week, where one step from 500,000 to 450,000 cut about 4.7%. **Overall: 3.6.**

## 6. Hand research to a subagent and keep only its result

**Propose it when** search and read tools take a large share, and most of what
they return is never used later in the conversation. The subagent uses the
same model; only its final answer comes back into the main conversation.

**Ratings:** upkeep 4 stars, because it works across projects with almost no
tuning; quality 4 stars, because some of what was read does not stay in the
main conversation; savings 2 stars, estimated at about 1.5%, because this makes
the context smaller and the subagent's own calls cost money too.
**Overall: 3.2.**

## 7. Hand research to a subagent on a lighter model

**Propose it when** search and read tools take a large share of the cost.

**Ratings:** upkeep 3 stars; quality 3 stars, because a lighter model may miss
things; savings 5 stars, estimated at about 10% when those calls take a large
share, from the lower price per call. **Overall: 3.6.**

## 8. Use a smaller model by default

**Propose it when** one large model takes most of the cost. It works well for
some users, so it is worth showing as a choice to consider.

**Ratings:** upkeep 5 stars; quality 1 star, because everyday work loses
quality; savings 5 stars, estimated at about 30% from the lower price per call.
**Overall: 2.9.**

## 9. Lower the effort level for all work

**Propose it when** output, which includes the model's thinking, takes a clear
share of the cost.

**Ratings:** upkeep 5 stars; quality 1 star, because all work gets less
thinking; savings 3 stars, estimated at about 4% in the example week, where
output was 9% of the cost. **Overall: 2.5.**
