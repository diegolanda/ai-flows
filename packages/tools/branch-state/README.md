# `@diego/branch-state`

Read and write OakShelf branch-specific workflow state for the development delivery pipeline.

This tool is the only writer of the branch state file. Agents and skills must not edit the state file directly. Every write is validated against the shape defined in `packages/workflows/development/contracts/branch-state.schema.json`.

## State file location

The state directory is:

```text
<git-dir>/oakshelf/development/<branch-safe-id>.json
```

`<git-dir>` is the result of `git rev-parse --absolute-git-dir`, run from the repository at `cwd`. This resolution works for linked worktrees, where `.git` is a file rather than a directory.

`<branch-safe-id>` replaces every character outside `[A-Za-z0-9._-]` in the branch name with `-`. For example, branch `fix/nil-check` maps to file `fix-nil-check.json`.

The state file is local. Do not commit it.

## Intent canonicalization and hash

`canonicalizeIntent(text)` normalizes intent text before it is hashed or compared:

1. Treat the text as UTF-8.
2. Convert CRLF and CR line endings to LF.
3. Remove trailing whitespace from each line.
4. Remove leading and trailing blank lines.

`intentHash(text)` calculates SHA-256 over the canonical form and returns `sha256:<lowercase hex>`.

## API

All functions are synchronous. `options.cwd` locates the repository, and defaults to `process.cwd()`. `options.branch` defaults to the current branch, detected through git.

```js
import {
  readState,
  initState,
  setIntent,
  lockIntent,
  editIntent,
  markStale,
  recordDescription,
  recordReview,
  checkFreshness,
  setPullRequest,
  canonicalizeIntent,
  intentHash,
} from '@diego/branch-state';
```

- `readState({ cwd, branch })` returns the state object, or `null` when no state file exists.
- `initState({ cwd, branch, baseBranch, rawIntent })` creates the state file. It throws when a state file already exists for the branch. The new state has `intent: null`, `intentHash: null`, `intentLocked: false`, `descriptionStale: true`, and `reviewStale: true`.
- `setIntent({ cwd, branch, intent })` stores the normalized intent. It throws when the intent is locked.
- `lockIntent({ cwd, branch })` locks the stored intent. It requires an intent to already be set. It calculates the hash from the stored intent, sets `intentLocked: true`, and records `intentApprovedAt` as the current UTC timestamp.
- `editIntent({ cwd, branch, intent, reason })` replaces a locked intent. It requires `intentLocked: true` and a non-empty `reason`. It recomputes the hash, keeps the intent locked, updates `intentApprovedAt`, and marks description and review stale.
- `markStale({ cwd, branch })` sets `descriptionStale: true` and `reviewStale: true`.
- `recordDescription({ cwd, branch })` sets `descriptionStale: false`.
- `recordReview({ cwd, branch, headSha, status })` sets `reviewStale: false`, `lastReviewedHead`, and `lastReviewStatus`. `status` is `"pass"` or `"fail"`.
- `checkFreshness({ cwd, branch })` returns `{ intentLocked, descriptionStale, reviewStale, reviewFreshForHead }`. `reviewFreshForHead` compares `lastReviewedHead` with the current HEAD commit. `reviewStale` is `true` when the state already marks it stale, or when HEAD no longer matches `lastReviewedHead`.
- `setPullRequest({ cwd, branch, number })` records the pull request number.
- `canonicalizeIntent(text)` returns the canonical form of intent text.
- `intentHash(text)` returns the `sha256:<lowercase hex>` hash of the canonical form.

Every mutating function throws an `Error` with a clear message when the requested state transition is invalid, or when the resulting state would fail schema validation.

## CLI

The package exposes the `oakshelf-branch-state` binary as a thin wrapper over the API, for use from hooks and agents. Each subcommand accepts `--cwd <path>` and `--branch <name>` to override auto-detection. Output is JSON on stdout. The exit code is `0` on success and `1` on failure.

```text
oakshelf-branch-state read
oakshelf-branch-state init --base-branch <name>          (reads rawIntent from stdin)
oakshelf-branch-state set-intent                          (reads intent text from stdin)
oakshelf-branch-state lock-intent
oakshelf-branch-state edit-intent --reason <text>          (reads intent text from stdin)
oakshelf-branch-state mark-stale
oakshelf-branch-state record-description
oakshelf-branch-state record-review --head <sha> --status <pass|fail>
oakshelf-branch-state check-freshness
oakshelf-branch-state set-pr --number <n>
```
