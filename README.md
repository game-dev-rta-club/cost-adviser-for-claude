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

![The report: cost, active time and calls for each day, with a marker on the day a change went in, and the rated improvements beside it.](assets/report.png)

## Find where the cost goes

Every tool call makes the model read the whole conversation again. So cost is the **number of calls × what each call reads × the price per token**, plus the cache written again after it expires.

The report splits the cost along each of these: by day, model, project and conversation, and as a tree of what each call did (`bash › git › status`, `read`, a skill's own commands). The largest cost is usually a few repeated steps in long conversations, not the size of any one result.

## Get improvements you can weigh

Ask your agent for a review. It measures, explains what it sees with basic principles, and updates the list on the report. Each improvement says what to change and why, with the numbers and the command that reproduces them.

![An improvement's details: its stars, what to do, and why, with the numbers behind it.](assets/proposal.png)

- **Rated on three axes:** upkeep, quality kept and savings, from one to five stars. One weak axis pulls the overall rating down.
- **Four angles:** fewer calls, less read per call (a smaller conversation, or tool use handed to an agent with little context), a lower price, and the cache kept.
- **A steady list:** an improvement changes only when its numbers or facts do, so a change on the report means something.

## Check whether a change worked

Record the day you changed something; the report marks it, and the summary compares the days before it with the days since. Before changing anything, `cca simulate` replays your recent conversations as if the change had been in place: an earlier compaction, shorter tool results, or work handed to a fresh agent.

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
