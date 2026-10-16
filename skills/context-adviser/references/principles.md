# Principles

Basic mechanics that stay true across versions. Each has its source so a new
agent can check it. A principle explains why; the options in a note turn it
into concrete actions, each checked against the current docs.

## P1 Every call re-reads the whole conversation

Each request re-sends the full context, and each tool use sends another
request. So the cost of one call grows with the conversation's length, and
input (mostly cache reads) is the bulk of the bill, not output.

- Manage costs, "Why usage climbs in a long session" — https://code.claude.com/docs/en/costs
- How Claude Code uses prompt caching — https://code.claude.com/docs/en/prompt-caching

## P2 Keep each conversation small and on one task

Stale context is paid for on every later message. Start fresh between
unrelated tasks; summarize at natural breaks rather than mid-task. Long inputs
also make models less reliable, so a smaller context helps accuracy too.

- Manage costs, "Manage context proactively" — https://code.claude.com/docs/en/costs
- Best practices for Claude Code — https://code.claude.com/docs/en/best-practices
- Context Rot (Chroma, 2025-07; 18 models) — https://www.trychroma.com/research/context-rot

## P3 Keep the cache warm and its prefix stable

Cached reads cost a fraction of input; a rebuild re-processes everything. The
cache matches the request's start exactly, so changing the model, the tool set
or anything early in the request rebuilds it, and so does a break longer than
the cache lifetime. Settle such choices at the start of a conversation.

- How Claude Code uses prompt caching, "Actions that invalidate the cache", "Cache lifetime" — https://code.claude.com/docs/en/prompt-caching
- Pricing (cache read and write rates) — https://platform.claude.com/docs/en/about-claude/pricing
- Lessons from building Claude Code: Prompt caching is everything — https://claude.com/blog/lessons-from-building-claude-code-prompt-caching-is-everything

## P4 Fewer, more complete round trips

Since a call is the unit of cost, work that needs many small calls costs more
than work that gets what it needs in a few. Tools and instructions that return
the whole relevant picture at once, and that combine steps usually chained
together, reduce calls.

- Manage costs, "Why usage climbs in a long session" (each tool use sends another request) — https://code.claude.com/docs/en/costs
- Writing effective tools for agents (Anthropic, 2025-09) — https://www.anthropic.com/engineering/writing-tools-for-agents

## P5 Delegate work that is self-contained and noisy

A fresh agent has a small context, so its calls are cheap, and verbose output
stays out of the main conversation. It pays off only when the brief is
complete enough for a few calls; spreading one job across many agents
multiplies tokens.

- Manage costs, "Delegate verbose operations to subagents" — https://code.claude.com/docs/en/costs
- How we built our multi-agent research system (Anthropic; about 15× the tokens of chat) — https://www.anthropic.com/engineering/multi-agent-research-system

## P6 Cut the largest part, not the easiest token count

Fewer tokens do not mean a lower bill: compressing output or tool results can
cause retries and longer paths, while cache activity drives most of the cost.
Find where the money goes (Cost by type, top tools) before cutting.

- Token Reduction Is Not Cost Reduction (Weinberger & Hozez, 2026) — https://arxiv.org/abs/2607.12161
- Pricing — https://platform.claude.com/docs/en/about-claude/pricing
