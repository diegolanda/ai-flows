# dev-hooks

The deterministic hook runner and delivery helper for `@diego/development`. It composes the other five tool packages and contains no AI logic.

## Usage

```bash
node <installed-path>/bin.mjs pre-push    # deterministic checks: base, intent, freshness, gates
node <installed-path>/bin.mjs gates
node <installed-path>/bin.mjs pr-sync --title "..."   # description on stdin
node <installed-path>/bin.mjs ci-verify --pr <number>
node <installed-path>/bin.mjs setup            # dry-run plan
node <installed-path>/bin.mjs setup --write    # apply after approval
```

In a pnpm workspace the bin is also available as `pnpm exec diego-dev-hook`.

## Notes for agents

- OakShelf never executes this package during install or link. Invoking it is always an explicit action.
- The installed path is reported by `oak inspect '@diego/dev-hooks'`.
- Hooks never invoke a model. When a hook fails on stale artifacts, run the delivery flow in the agent.
- This package imports its five sibling tools by bare specifier and needs them resolvable (pnpm workspace or npm install).
