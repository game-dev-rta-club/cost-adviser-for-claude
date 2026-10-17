# Contributing

Keep the skill short. It works best when it states the goal and what a good result looks like; a growing list of rules for individual failures makes it worse. Move mechanical steps (a check, a number, a warning) into `cca` instead. See "Changing the skill" in the README.

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
