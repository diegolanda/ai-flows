# git-repository

Deterministic Git state inspection for the `@diego/development` workflow: repository root, current branch, base detection, ahead/behind, diff, commits, dirty state, and an explicit rebase that refuses to run without `allowRebase: true`.

## Usage

```js
import { detectBaseBranch, aheadBehind, headSha } from "@diego/git-repository";
```

See `README.md` for the full API. All functions are synchronous and accept `{ cwd }`.

## Notes for agents

- OakShelf never executes this package during install or link. Invoking it is always an explicit action.
- The installed path is reported by `oak inspect '@diego/git-repository'`.
- Never call `rebaseOnto` from a Git hook. Only the delivery flow rebases.
