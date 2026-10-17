# Contributing

Keep `skills/cost-adviser` short. It works best when it states the goal and what a good result looks like, and leaves the judgment to the agent; a list of narrow rules for every case makes it worse, because the rules start to contradict each other and crowd out the goal. When a run goes wrong, first cut words and make the goal clearer. Move a mechanical step into `cca` (a check, a warning, a number it can print), so the instructions need not say it. Add a rule only when that is not enough. Before building something into `cca` or the skill, search for an open-source tool or skill that already does it.

Open an issue first for changes to how costs are counted or how proposals are rated. For changes to the skill's behavior, include what a fresh agent did with it before and after: static checks alone cannot show that an agent follows it well.

## Development

`bin/` and `lib/` are the CLI, `web/` the report, `skills/cost-adviser/` the skill. Use Node.js 20+; there are no dependencies to install and no build:

```sh
npm run check
```

## Releases

Use SemVer in `package.json`:

1. Update the version and `CHANGELOG.md`.
2. Run the checks.
3. Commit and push main, then create an immutable `v<version>` tag.
4. CI publishes a GitHub release after the checks pass. Verify installation from that tag.

Never move a published tag.

## Pull requests

Explain the outcome and the checks performed. Do not include conversation records, private project data or cost reports from your own machine.

Contributions are licensed under this repository's MIT license. No CLA or DCO is required.
