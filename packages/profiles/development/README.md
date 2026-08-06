# @diego/development-profile

An OakShelf profile that defines persistent development instructions for Claude Code and Codex.

The profile activates `@diego/simple-technical-writing` for every task. It also prohibits AI attribution in commits and pull requests.

## Status

This package requires OakShelf `0.0.1-beta2` or newer.

The behavior below matches OakShelf `0.0.1-beta2`.

## Validate and publish

From the repository root, run:

```bash
pnpm validate:profile
pnpm pack:profile
pnpm publish:profile -- --registry <registry-url>
```

## Link globally

Use:

```bash
oak link '@diego/development-profile' --agent claude --global
oak link '@diego/development-profile' --agent codex --global
```

The Claude profile manages a block in `~/.claude/CLAUDE.md`.
The Codex profile manages a block in `$CODEX_HOME/AGENTS.md` or `~/.codex/AGENTS.md`.

Only one profile can be active for each agent.

If a manual instruction file exists, OakShelf moves it to a sibling `.back.md` file. Unlinking the profile restores that backup.

Do not edit an OakShelf-owned target. Verification and sync reject unrecorded changes.
