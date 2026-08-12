# @diego/development-intent

An OakShelf skill that converts a raw development task request into a stable, structured PR intent.

The skill is part of the `@diego/development` delivery workflow. The workflow captures the developer's original request, this skill normalizes it, the developer approves it in conversation, and the deterministic `branch-state` tool locks it. After the lock, the intent is the immutable baseline for the intent review.

## Output contract

The skill returns structured JSON:

```json
{
  "intent": "string",
  "goals": ["string"],
  "nonGoals": ["string"],
  "assumptions": ["string"]
}
```

The canonical schema is `contracts/intent.schema.json` in the `@diego/development` workflow package. Inferred scope must appear in `assumptions`, never inside `intent`.

## Related packages

- `@diego/development`: the delivery workflow that composes this skill.
- `@diego/simple-technical-writing`: normalizes the final intent prose.
- `@diego/pr-description`: describes the implementation without touching the locked intent.
- `@diego/intent-review`: reviews the branch diff against the locked intent.

## Validate and pack

From the repository root:

```bash
pnpm check
pnpm validate:skill:intent
pnpm pack:skill:intent
```

## Publish

Authenticate with the target OakShelf registry. Then run:

```bash
pnpm publish:skill:intent -- --registry <registry-url>
```

## Install globally

```bash
oak link '@diego/development-intent' --agent claude --global --registry <registry-url>
oak link '@diego/development-intent' --agent codex --global --registry <registry-url>
```

## License

MIT
