# Judging a change

1. **Record the day it starts** with `cca mark add`. Without a date there is
   nothing to compare.
2. **Compare like with like.** `cca summary` puts the same number of days
   before and after side by side. Use the ratios (cost per active hour, cost
   per call); totals follow how much work there was.
3. **Wait for enough data.** Work varies a lot: in our own records one request
   took 2 calls and another 133. One or two days rarely decide anything. Give
   a verdict only when both sides have several days and pass the summary's
   thresholds; otherwise say "too early" and when to look again: the day
   after both sides have at least two full days. Today is partial; the
   summary says when a side includes it, and a side that is only today does
   not count. `cca summary --tool NAME` shows the tool before and after each
   recorded change (uses per active hour, share of tool cost) and its parts.
4. **Rule out other explanations** before crediting the change:
   - a different mix of work or project (filter by project);
   - a different model or effort mix (Cost by model);
   - another change in the same period (the other changes the summary lists,
     shown as ⭐ marks on the report). When two changes start on the same
     day, judge each by the number it targets (for example uses per active
     hour of the combined command, or average context for a compaction
     setting), and say that the totals mix both.
5. **State the verdict plainly:** helped, no clear effect, or made it worse,
   with the numbers and the days behind it.

Measure from the transcripts after the fact; asking the agent to log as it
works adds calls of its own.

Source for the spread of calls per request: measured on our transcripts,
2026-10 (cost-adviser design notes).
