---
name: diego-pr-description
description: |
  Describe the current implementation of a branch for a pull request body
  without rewriting the locked intent. Use when commits change and the PR
  Description section must be refreshed. The output is structured JSON with
  description, covered, skipped, assumptions, and deviations. The output has
  no intent field by design, so this skill cannot replace the locked intent.
license: MIT
metadata:
  version: "0.0.1"
  workflow: "@diego/development"
---

# PR Description

Describe what the current implementation does. The description is derived state: it changes when the implementation changes. The locked intent does not.

## Inputs

```json
{
  "intent": "string",
  "diff": "string",
  "commits": ["string"],
  "previousDescription": "string?"
}
```

- `intent`: the locked intent. Read it to relate the implementation to the requirements. Never modify it.
- `diff`: the complete base-to-HEAD diff.
- `commits`: the commit messages on the branch.
- `previousDescription`: the previous description, when one exists.

## Output

Return only a JSON object that matches this shape:

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

The schema has no `intent` field. This is deliberate. This skill must be technically unable to replace the locked intent through its normal output channel. Never output an intent, and never suggest edits to it. Intent changes go through the workflow's `intent edit` action.

## Rules

1. Describe only behavior that the diff implements. Do not describe planned or intended behavior.
2. Write in simple technical English. Apply `@diego/simple-technical-writing` to the prose.
3. List intent requirements the implementation satisfies in `covered`.
4. List intent requirements the implementation does not satisfy yet in `skipped`. An empty diff area is not coverage.
5. List assumptions the implementation relies on in `assumptions`.
6. List intentional differences from the locked intent in `deviations`. A deviation is not a failure, but it must be visible.
7. Preserve exact identifiers, file paths, and commands from the diff.
8. Return only the JSON object. Do not wrap it in prose.

## Example

Output for a nil-guard change:

```json
{
  "description": "Added a guard before accessing the organization. Added tests for users without an organization. No authorization behavior was changed.",
  "covered": [
    "Return a safe result when the organization is missing.",
    "Preserve existing behavior when an organization exists."
  ],
  "skipped": [],
  "assumptions": [
    "Callers treat a null organization result as an expected state."
  ],
  "deviations": []
}
```
