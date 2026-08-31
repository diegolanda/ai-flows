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
node <installed-path>/resolve.mjs resolve      # return branch-state and dev-hook paths
```

In a pnpm workspace the bin is also available as `pnpm exec diego-dev-hook`.
The resolver is available as `pnpm exec diego-development-tools resolve`.

## Notes for agents

- OakShelf never executes this package during install or link. Invoking it is always an explicit action.
- The installed path is reported by `oak inspect '@diego/dev-hooks'`.
- Hooks never invoke a model. When a hook fails on stale artifacts, run the delivery flow in the agent.
- This package imports its five sibling tools by bare specifier and needs them resolvable (pnpm workspace or npm install).
- Pass `--cwd <target-repository>` to each hook command when the tool runs outside the target repository.
- Set `DIEGO_AI_FLOWS_ROOT` to resolve tools from a local checkout in another directory tree.
