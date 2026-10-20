# Judging a change

1. **Record the day it starts** with `cca mark add DATE LABEL --detail TEXT`.
   Without a date there is nothing to compare. The label is a title of a few
   words; the detail says what changed and how. Both open from the ⭐ on the
   report's charts.
2. **Compare like with like.** `cca summary` puts the same number of days
   before and after side by side. Use the ratios (cost per active hour, cost
   per call); totals follow how much work there was.
3. **Wait for enough data.** Work varies a lot: in our own records one request
   took 2 calls and another 133. One day rarely decides anything. Give a
   verdict once both sides have at least two full days and pass the summary's
   thresholds; until then say "too early" and name that day. Today is partial; the
   summary says when a side includes it, and a side that is only today does
   not count. `cca summary --tool NAME` shows the tool before and after each
   recorded change (uses per active hour, share of cost) and its parts.
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

A change that is not recorded yet (Context jumps, Mix shifts) can be read the
same way with `cca summary --since DAY --until LAST_FULL_DAY`, which compares
those days with as many days before them.
