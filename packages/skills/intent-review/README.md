# @diego/intent-review

An OakShelf skill that reviews a complete branch diff against a locked intent.

The skill is part of the `@diego/development` delivery workflow. Generic code review evaluates code quality. This review answers a narrower and more important question: did the implementation satisfy the original purpose without introducing unintended scope?

## Output contract

The skill returns structured JSON:

```json
{
  "status": "pass | fail",
  "findings": [
    {
      "severity": "low | medium | high | critical",
      "file": "string?",
      "line": 42,
      "message": "string",
      "intentRelation": "string"
    }
  ]
}
```

The canonical schema is `contracts/review.schema.json` in the `@diego/development` workflow package. The repository configuration decides which severities block delivery through `review.failOn`.

The review is read-only. It never modifies files, state, or the PR, and it never proposes edits to the locked intent.

## Related packages

- `@diego/development`: the delivery workflow that composes this skill.
- `@diego/development-intent`: produces the locked intent this skill reviews against.
- `@diego/pr-description`: produces the description this skill checks for disclosure gaps.

## Validate and pack

From the repository root:

```bash
pnpm check
pnpm validate:skill:review
pnpm pack:skill:review
```

## Publish

Authenticate with the target OakShelf registry. Then run:

```bash
pnpm publish:skill:review -- --registry <registry-url>
```

## Install globally

```bash
oak link '@diego/intent-review' --agent claude --global --registry <registry-url>
oak link '@diego/intent-review' --agent codex --global --registry <registry-url>
```

## License

MIT
