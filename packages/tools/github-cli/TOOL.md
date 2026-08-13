# github-cli

A `gh` wrapper for the `@diego/development` workflow: find, create, and update pull requests, render managed `Intent` and `Description` body sections that preserve human-authored content, apply `size/<value>` labels, and read check status.

## Usage

```js
import { findPullRequest, renderManagedBody, applySizeLabel } from "@diego/github-cli";
```

See `README.md` for the full API. Requires an authenticated GitHub CLI (`gh auth login`).

## Notes for agents

- OakShelf never executes this package during install or link. Invoking it is always an explicit action.
- The installed path is reported by `oak inspect '@diego/github-cli'`.
- The managed-section helpers throw on malformed markers instead of overwriting the PR body.
