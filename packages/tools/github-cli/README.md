# @diego/github-cli

Tool package for the OakShelf development delivery pipeline. It shells out
to the GitHub CLI (`gh`) to find, create, and update pull requests, and to
read check status. It has zero npm dependencies.

## Requirements

The GitHub CLI must be installed and authenticated. Run `gh auth login`
before using this package.

## API

All functions are synchronous. Every function accepts an `opts` object
with `cwd` (working directory for the `gh` process) and `ghPath` (path to
the `gh` binary, default `"gh"`). `ghPath` exists so tests can point at a
stub binary.

- `findPullRequest(branch, opts)` returns `{ number, url, body }` for the
  open pull request on `branch`, or `null` when none exists.
- `getPullRequestBody(number, opts)` returns the current pull request
  body as a string.
- `createPullRequest({ title, body, base, head }, opts)` creates a pull
  request and returns `{ number, url }`.
- `updatePullRequestBody(number, body, opts)` replaces the pull request
  body. The body is sent to `gh` on standard input.
- `checkStatus(number, opts)` returns an array of
  `{ name, status, conclusion }` for the pull request checks.

Every `gh`-invoking function throws an `Error` on failure. The error
message includes the failed command and its stderr. When `gh` is not
found, the error message tells the user to install and authenticate the
GitHub CLI.

## Managed pull request sections

The workflow must not overwrite human-authored pull request content. Two
pure helper functions manage this. They perform no `gh` calls.

- `renderManagedBody({ intent, intentHash, description, existingBody })`
  returns a pull request body with the managed intent and description
  sections set to the given content. When `existingBody` already
  contains the managed markers, only the content between each marker
  pair is replaced. All other content, including sections a developer
  added by hand, is preserved byte-for-byte.
- `extractIntentHash(body)` returns the lowercase hex intent hash
  recorded in a pull request body, or `null` when no hash comment is
  present.

The managed sections use these markers:

```md
<!-- oak:managed:intent:start -->
## Intent
...
<!-- oak:intent-sha256=<hex> -->
<!-- oak:managed:intent:end -->

<!-- oak:managed:description:start -->
## Description
...
<!-- oak:managed:description:end -->
```

## Testing

```sh
node --test packages/tools/github-cli/test/
```

Tests for `gh`-invoking functions use a stub executable named `gh` that
writes canned JSON output and records its arguments. No test calls the
real GitHub CLI.
