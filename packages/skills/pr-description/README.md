# @diego/pr-description

An OakShelf skill that describes the current implementation of a branch for a pull request body.

The skill is part of the `@diego/development` delivery workflow. The workflow keeps two PR sections separate: `Intent` is locked and immutable, and `Description` is derived state that this skill refreshes when commits change.

## Output contract

The skill returns structured JSON:

```json
{
  "description": "string",
  "covered": ["string"],
  "skipped": ["string"],
  "assumptions": ["string"],
  "deviations": ["string"]
}
```

The canonical schema is `contracts/description.schema.json` in the `@diego/development` workflow package.

The schema has no `intent` field. This is deliberate: the skill is technically unable to replace the locked intent through its normal output channel.

## Related packages

- `@diego/development`: the delivery workflow that composes this skill.
- `@diego/development-intent`: normalizes the intent this skill describes against.
- `@diego/intent-review`: reviews the branch diff against the locked intent.
- `@diego/simple-technical-writing`: normalizes the description prose.

## Validate and pack

From the repository root:

```bash
pnpm check
pnpm validate:skill:description
pnpm pack:skill:description
```

## Publish

Authenticate with the target OakShelf registry. Then run:

```bash
pnpm publish:skill:description -- --registry <registry-url>
```

## Install globally

```bash
oak link '@diego/pr-description' --agent claude --global --registry <registry-url>
oak link '@diego/pr-description' --agent codex --global --registry <registry-url>
```

## License

MIT
