# Contracts: OakShelf Development Delivery Pipeline

These contracts are the Phase 0 deliverable of `PRD.md`. They define the machine-verifiable boundaries between skills, tools, and the workflow.

## Schemas

| File | Contract |
| --- | --- |
| `intent.schema.json` | Output of the `@diego/development-intent` skill. |
| `description.schema.json` | Output of the `@diego/pr-description` skill. It has no `intent` field by design. |
| `review.schema.json` | Output of the `@diego/intent-review` skill. |
| `repository-config.schema.json` | Repository configuration file `.oakshelf/development.json`. |
| `branch-state.schema.json` | Branch state file written only by the `branch-state` tool. |

All schemas use JSON Schema draft 2020-12. Every object sets `additionalProperties: false`, so an unexpected field is a validation failure, not silent data.

## Intent canonicalization and hash

The intent hash detects workflow-level mutation of a locked intent. Both the local state and the PR body marker store the same value.

Calculate the hash over the canonical form of the intent text:

1. Encode the text as UTF-8.
2. Convert CRLF and CR line endings to LF.
3. Remove trailing whitespace from each line.
4. Remove leading and trailing blank lines.
5. Calculate SHA-256 over the result.

Store the value as `sha256:<lowercase hex>`.

The PR body embeds the value as an HTML comment:

```md
<!-- oak:intent-sha256=<lowercase hex> -->
```

The hash is workflow metadata, not a security boundary. Server-side enforcement belongs in CI.

## Branch state rules

- Only the `branch-state` tool writes the state file. Agents must not edit it directly.
- The state directory is `<git-dir>/oakshelf/development/`, where `<git-dir>` is the result of `git rev-parse --git-dir`.
- The file name is a branch-safe identifier: replace every character outside `[A-Za-z0-9._-]` in the branch name with `-`.
- Every write is validated against `branch-state.schema.json`.
- When HEAD no longer equals `lastReviewedHead`, the review is stale.
- A review result is valid only for the exact commit it reviewed.

## Workflow events

The pipeline emits these events. The renderer consumes them and owns no orchestration logic.

```text
stage.started      { stage }
stage.log          { stage, line }
stage.passed       { stage, durationMs }
stage.failed       { stage, durationMs, message }
stage.skipped      { stage, reason }
pipeline.completed { status }
```

`stage` is one of:

```text
fetch, rebase, intent, intent-approval, description, review,
test, typecheck, lint, build, push, pr, ci
```

## Gate semantics

Each configured gate has two independent flags:

- `required`: if `true`, a gate failure blocks delivery. If `false`, a failure is reported and delivery continues.
- `skipIfMissing`: if `true`, a missing package script skips the gate. If `false`, a missing script is a failure.

Only explicitly configured scripts run. The workflow never runs a script merely because it exists.
