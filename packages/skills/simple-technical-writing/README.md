# @diego/simple-technical-writing

An OakShelf skill that writes, rewrites, or reviews technical prose in clear, direct English.

Use it when you want technical text that is concise, consistent, and easier to translate.

The skill prefers common words for general language. It explains necessary technical terms when they first appear.

## Example requests

- "Rewrite this runbook using Simplified Technical English principles."
- "Review this pull request description for ambiguity."
- "Make this API guide easier for non-native English readers."

## Guarantees

The skill instructs the model to preserve code, commands, identifiers, paths, URLs, API names, configuration keys, product names, and quoted errors.

For review findings, the skill puts the visible consequence before the internal cause. It also avoids dense groups of technical nouns.

This package uses controlled technical-writing principles. It does not claim formal ASD-STE100 compliance.

## Validate and pack

From the repository root:

```bash
pnpm check
pnpm validate:skill
pnpm pack:skill
```

## Publish

Authenticate with the target OakShelf registry. Then run:

```bash
pnpm publish:skill -- --registry <registry-url>
```

## Install globally

```bash
oak link '@diego/simple-technical-writing' --agent claude --global --registry <registry-url>
oak link '@diego/simple-technical-writing' --agent codex --global --registry <registry-url>
```
