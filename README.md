<p align="center">
  <img src="assets/logo.svg" width="112" height="112" alt="Cost Adviser logo: three bars step down beside a coin.">
</p>

<h1 align="center">Cost Adviser For Claude</h1>

<div align="center">

[![CI](https://github.com/game-dev-rta-club/cost-adviser-for-claude/actions/workflows/ci.yml/badge.svg)](https://github.com/game-dev-rta-club/cost-adviser-for-claude/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/game-dev-rta-club/cost-adviser-for-claude)](https://github.com/game-dev-rta-club/cost-adviser-for-claude/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

**See where your Claude Code money goes—and what to change.**

A command-line tool and an agent skill for Claude Code. `cca` turns the conversation records Claude Code already keeps on your machine into a report. The `cost-adviser` skill reads that report with your agent and keeps a short list of improvements, each rated so you can weigh it. Nothing is sent anywhere.

## How it works

### 1. Run the cost-adviser skill

Ask your agent to use the skill, and it diagnoses your costs. It refreshes the report, takes the numbers as clues, looks at what happened in the conversations behind them, explains it with basic principles, and updates the list of improvements. It replies with each improvement in a sentence or two, and a link that opens its details in the report.

```text
/cost-adviser
```

Every tool call makes the model read the whole conversation again. So cost is the **number of calls × what each call reads × the price per token**, plus the cache written again after it expires. The report below breaks the cost down along each of these.

### 2. Check performance in Summary

Cost, active time and calls for each day, with ratios such as cost per active hour and cost per call. A marker shows the day you recorded a change, so you can see whether it worked.

![Summary: bars for cost, active time and calls on each day from 10/6 to 10/17, and below them cost per active hour, cost per call and the share of subagent calls. A marker labelled "Fewer chill calls" sits on 10/16, the day that change went in.](assets/summary.jpg)

### 3. Analyze it in Profile

Where the money goes for the chosen days: cache reads, cache writes, output and compacting, then each model and effort level. Here, reading the conversation again from the cache is 60% of the cost, and output only 14%.

![Profile for 10/11–17: $1,587.51 over 15,472 calls and 117 active hours. Cost by type: cache reads 60%, cache writes 25%, output 14%, compacting 1%. Cost by model: Opus 5.5 at high effort 75%, at medium 25%.](assets/profile.jpg)

### 4. See the costly commands in Calls by action

Every tool call as a tree, ranked by cost. Commands that share their first words add up (`bash › chill › connection › wait`), so one repeated step stands out even when each use is cheap.

![Calls by action for the same days: bash 74% of the cost, with a workflow tool's commands (chill) 16%, Python scripts 11%, grep 7% and sed 6% below it; then final replies 12%, MCP tools 5%, read 2% and write 2%.](assets/calls.jpg)

### 5. Get improvements in Improvements

The skill keeps a short list of improvements, each rated one to five stars on upkeep, quality kept and savings. Open one to see what to do, why, the numbers behind it, and how to tell whether it worked.

![Improvements: a list of rated proposals with a star slider, and one proposal opened beside it, "Hand runs of tool calls to a subagent", 3.0 stars, with what to do, the measurements and replay behind it, and its three ratings.](assets/improvements.jpg)

- **Four angles:** fewer calls, less read per call (a smaller conversation, or tool use handed to an agent with little context), a lower price, and the cache kept.
- **A steady list:** an improvement changes only when its numbers or facts do, so a change on the report means something.
- **Measured before you change anything:** `cca simulate` replays your recent conversations as if a change had been in place, such as an earlier compaction, shorter tool results, or work handed to a fresh agent.

## Install and use

```sh
npm install -g github:game-dev-rta-club/cost-adviser-for-claude
npx skills@latest add game-dev-rta-club/cost-adviser-for-claude \
  --skill cost-adviser \
  --agent claude-code \
  --yes
```

The first line installs `cca`; the second adds the skill to your project. Then, in Claude Code:

```text
/cost-adviser
```

Or look for yourself:

```sh
cca build --open    # write the report and open it
cca summary         # the same as text: this week against the last
```

**Requires:** Claude Code and Node.js 20 or later. No other dependencies. `cca` reads `~/.claude/projects` and writes only to `~/.cost-adviser-for-claude`. Costs are estimates at list prices per model; on a subscription, they show what the same use would cost through the API.

Every command and how each number is counted: [Reference](docs/reference.md).

## Update

Rerun the install commands to update. See the [release notes](CHANGELOG.md).

## Project

[Game Dev RTA Club](https://github.com/game-dev-rta-club) · [MIT](LICENSE) · [Contributing](CONTRIBUTING.md) · [Code of Conduct](CODE_OF_CONDUCT.md) · [Security](SECURITY.md)
