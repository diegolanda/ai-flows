# branch-state

The only writer of branch-specific workflow state for `@diego/development`: raw intent, normalized intent, deterministic lock and hash, size, staleness, review results, and the PR number. Every write is validated against the branch state schema. State lives under `<git-dir>/oakshelf/development/`.

## Usage

```bash
node <installed-path>/bin.mjs read
node <installed-path>/bin.mjs init --base-branch main   # raw intent on stdin
node <installed-path>/bin.mjs set-intent --size S       # intent text on stdin
node <installed-path>/bin.mjs lock-intent
node <installed-path>/bin.mjs record-review --head <sha> --status pass
node <installed-path>/bin.mjs check-freshness
```

In a pnpm workspace the bin is also available as `pnpm exec diego-branch-state`.

## Notes for agents

- OakShelf never executes this package during install or link. Invoking it is always an explicit action.
- The installed path is reported by `oak inspect '@diego/branch-state'`.
- Never edit state files directly. Locking, hashing, and staleness must go through this tool.
