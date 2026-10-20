# Changelog

## Unreleased

- `cca` can read transcripts copied from your other machines along with this one's. List their folders in `~/.cost-adviser-for-claude/sources.json`; the summary then shows the cost by machine, and the top sessions say where each ran. `--transcripts` can be given more than once.

## 0.1.7 — 2026-10-20

- A recorded change is a ⭐ above its day on the charts, with a count when one period has several. Hovering or clicking the star opens its title and detail, so the charts stay clear however many changes there are.
- A change has a short label, its title (30 characters at most), and a detail: `cca mark add DATE LABEL --detail TEXT`. Adding the same label on the same day again replaces its detail.

## 0.1.6 — 2026-10-19

- In Safari, the Summary charts no longer hide their date labels under the scroll bar when scroll bars are always shown.

## 0.1.5 — 2026-10-19

- The Stats chart no longer stops short of the latest period when it shows more metrics than Totals: both charts keep their axes the same width, so they scroll together to the end.

## 0.1.4 — 2026-10-19

- The Summary charts open scrolled to the latest period, and both charts scroll together. A period you click stays where it is.

## 0.1.3 — 2026-10-18

- A Reload button at the top right of the report builds it again from the latest conversations, without leaving the page. It works when the report is open through `cca serve`, which is how the skill's links open it.

## 0.1.2 — 2026-10-17

- The skill takes the numbers as clues and then looks at what happened in the conversations behind them, so each proposal names the cause it saw there.

## 0.1.1 — 2026-10-17

- The skill's goal is the reply: it tells you what to change, one short numbered item per proposal, each with a link that opens its card on the report.
- `cca advise` prints that link for each proposal, best first (`--port` sets the port).

## 0.1.0 — 2026-10-17

- First public release: `cca` collects the cost of Claude Code conversations from local records, shows it as a report, compares days before and after a recorded change, and replays conversations to estimate what a change would save (`cca simulate`).
- The `cost-adviser` skill keeps a short, rated list of improvement proposals on the report, under four angles: fewer calls, less read per call, a lower price, and the cache kept.
