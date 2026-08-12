# @diego/git-repository

`@diego/git-repository` reads and mutates Git repository state for the
`@diego/development` workflow. It is a deterministic tool. It contains no AI
logic and makes no semantic decisions.

The package has zero npm dependencies. It uses only Node.js built-in modules
and shells out to the `git` executable through `node:child_process`.

## Purpose

The `@diego/development` workflow uses this package to answer questions such
as: What is the current branch? Is the branch behind its base branch? What
changed since the base branch? The workflow, not this package, decides what
to do with the answers.

This package implements the `git-repository` responsibilities from
`packages/workflows/development/PRD.md`, section 9.1.

## Installation

This package is a plain workspace package. It has no build step. Import it
directly from `index.mjs`.

## API

Every function is synchronous. Every function accepts an optional options
object with a `cwd` property. When `cwd` is omitted, the function runs in the
process working directory.

A failing `git` command always throws an `Error`. The error message includes
the failing command and its stderr output. No function swallows stderr.

### `repoRoot({ cwd })`

Returns the absolute path to the repository root.

### `gitDir({ cwd })`

Returns the absolute path to the Git directory. This function works inside a
linked worktree, where the top-level `.git` entry is a file, not a directory.

### `currentBranch({ cwd })`

Returns the name of the current branch. Throws a clear error when HEAD is
detached, because a detached HEAD has no branch name.

### `detectBaseBranch({ cwd, configured })`

Returns the name of the base branch.

If `configured` is set and is not `"auto"`, the function returns it
unchanged.

Otherwise, the function detects the base branch in this order:

1. The `origin/HEAD` symbolic ref.
2. A local or remote branch named `main`.
3. A local or remote branch named `master`.

The function throws when none of these exist.

### `fetchRemote({ cwd, remote })`

Fetches refs from the given remote. `remote` defaults to `"origin"`.

### `aheadBehind(base, { cwd })`

Returns `{ ahead, behind }`. `ahead` is the number of commits on HEAD that are
not on `base`. `behind` is the number of commits on `base` that are not on
HEAD.

### `diffAgainst(base, { cwd })`

Returns the diff between `base` and HEAD, as a string. The function uses the
same three-dot range that GitHub uses to render a pull request diff.

### `listCommits(base, { cwd })`

Returns an array of `{ sha, subject }` objects for the commits that are on
HEAD but not on `base`. The order matches `git log`, newest first.

### `isDirty({ cwd })`

Returns `true` when the working tree has uncommitted changes, staged or
unstaged.

### `headSha({ cwd })`

Returns the 40-character sha of HEAD.

### `rebaseOnto(base, { cwd, allowRebase })`

Rebases the current branch onto `base`.

The function throws unless `allowRebase` is exactly `true`. This flag exists
so that Git hook code can never trigger a rebase. The PRD requires that the
Git tool never rebase from a `pre-push` hook. Only the mutation-safe delivery
command may pass `allowRebase: true`.

On conflict, the function aborts the rebase with `git rebase --abort` and
throws a clear error. The working tree returns to its pre-rebase state.

## Testing

Run the tests with:

```sh
node --test packages/tools/git-repository/test/
```

The tests build temporary Git repositories under the operating system
temporary directory. Each test cleans up its temporary directory when it
finishes.
