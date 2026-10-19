# Changelog

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
