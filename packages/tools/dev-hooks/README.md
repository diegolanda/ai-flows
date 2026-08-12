# @diego/dev-hooks

The deterministic hook runner and delivery helper for the `@diego/development` workflow. It composes `@diego/git-repository`, `@diego/branch-state`, `@diego/quality-gates`, `@diego/github-cli`, and `@diego/pipeline-ui`. It contains no AI logic and never invokes a model.

## CLI

```text
oakshelf-dev-hook pre-commit    Fast deterministic checks. Currently a pass-through.
oakshelf-dev-hook post-commit   Marks description and review stale. Never blocks.
oakshelf-dev-hook pre-push      Verifies base relationship, intent lock, freshness, and gates.
oakshelf-dev-hook gates         Runs the configured gates only.
oakshelf-dev-hook pr-sync       Creates or updates the PR with managed sections. Description on stdin.
oakshelf-dev-hook ci-verify     Verifies PR intent integrity and runs gates. For CI.
oakshelf-dev-hook setup         Plans the repository adapter files. Pass --write to apply.
```

Exit code 0 means pass. Exit code 1 means fail or error.

## Rules

- `pre-push` never rebases and never refreshes AI artifacts. When the description or review is stale, it fails and tells the developer to run the delivery flow in the agent.
- `setup` shows its plan before changing anything. Without `--write` it changes nothing.
- Configuration comes from `.oakshelf/development.json` and matches `contracts/repository-config.schema.json` in the workflow package. Defaults apply when the file is missing.
