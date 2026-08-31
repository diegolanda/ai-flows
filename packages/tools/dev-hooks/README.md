# @diego/dev-hooks

The deterministic hook runner and delivery helper for the `@diego/development` workflow. It composes `@diego/git-repository`, `@diego/branch-state`, `@diego/quality-gates`, `@diego/github-cli`, and `@diego/pipeline-ui`. It contains no AI logic and never invokes a model.

## CLI

```text
diego-dev-hook pre-commit    Fast deterministic checks. Currently a pass-through.
diego-dev-hook post-commit   Marks description and review stale. Never blocks.
diego-dev-hook pre-push      Verifies base relationship, intent lock, freshness, and gates.
diego-dev-hook gates         Runs the configured gates only.
diego-dev-hook pr-sync       Creates or updates the PR with managed sections and the size label. Description on stdin.
diego-dev-hook ci-verify     Verifies PR intent integrity and runs gates. For CI.
diego-dev-hook setup         Plans the repository adapter files. Pass --write to apply.
diego-development-tools resolve   Resolves both CLI paths from DIEGO_AI_FLOWS_ROOT.
```

Exit code 0 means pass. Exit code 1 means fail or error.

Every `diego-dev-hook` command accepts `--cwd <target-repository>`. The option selects the repository without changing the caller's working directory.

## Cross-repository resolution

Set `DIEGO_AI_FLOWS_ROOT` to a local ai-flows checkout. Then run the resolver from any target repository:

```bash
node "$DIEGO_AI_FLOWS_ROOT/packages/tools/dev-hooks/resolve.mjs" resolve
```

The JSON result contains absolute `branchState` and `devHook` executable paths. The resolver checks the checkout's root-linked binaries first. It checks the source entrypoints next.

Use `--root <path>` to override the environment variable. If resolution fails, the JSON error lists each attempted path and tells the user how to configure the checkout.

## Rules

- `pre-push` never rebases and never refreshes AI artifacts. When the description or review is stale, it fails and tells the developer to run the delivery flow in the agent.
- `setup` shows its plan before changing anything. Without `--write` it changes nothing.
- Configuration comes from `.oakshelf/development.json` and matches `contracts/repository-config.schema.json` in the workflow package. Defaults apply when the file is missing.
