---
name: diego-development-intent
description: |
  Convert a raw development task request into a stable, structured PR intent.
  Use when a task starts, before implementation, to capture why the change
  exists and what outcome is expected. The output is structured JSON with
  intent, goals, nonGoals, and assumptions. Inferred scope must appear as an
  assumption, never inside the intent. The developer approves the result
  before the workflow locks it.
license: MIT
metadata:
  version: "0.0.1"
  workflow: "@diego/development"
---

# Development Intent

Convert a raw task request into a normalized intent that the development workflow can lock.

`Intent` describes why the change exists and what outcome is expected. It is an input to implementation, not a summary of it. After the developer approves the intent, the workflow treats it as immutable.

## Inputs

```json
{
  "rawIntent": "string",
  "repositoryContext": "string?",
  "examples": ["string"]
}
```

- `rawIntent`: the developer's original request, unmodified.
- `repositoryContext`: optional facts about the repository that constrain the change.
- `examples`: optional examples the developer provided.

## Output

Return only a JSON object that matches this shape:

```json
{
  "intent": "string",
  "goals": ["string"],
  "nonGoals": ["string"],
  "assumptions": ["string"]
}
```

The canonical schema is `contracts/intent.schema.json` in the `@diego/development` workflow package. Unknown fields are a validation failure.

## Rules

1. Preserve the original purpose. Do not narrow it, widen it, or restate it as the implementation you expect.
2. Write the intent in simple technical English. Apply `@diego/simple-technical-writing` to the prose.
3. Do not infer new scope silently. If the raw request implies scope it does not state, record that scope in `assumptions`.
4. Make ambiguity visible. If the raw request can mean two different outcomes, state the interpretation you chose in `assumptions`.
5. Put outcomes the change must achieve in `goals`. Put outcomes the change must not attempt in `nonGoals`.
6. Do not include implementation details, file names, or code in the intent unless the raw request states them as requirements.
7. Do not invent measurements, retry counts, timeouts, or dependencies that the raw request does not support.
8. Return only the JSON object. Do not wrap it in prose.

## Approval

The developer must approve the normalized intent in conversation before the workflow locks it. Present the intent and wait for confirmation. Do not lock the intent yourself. The lock is recorded by the deterministic `branch-state` tool.

## Example

Input:

```json
{
  "rawIntent": "Prevent nil errors when users have no organization"
}
```

Output:

```json
{
  "intent": "Prevent nil errors when resolving a user without an assigned organization.",
  "goals": [
    "Return a safe result when the organization is missing.",
    "Preserve existing behavior when an organization exists."
  ],
  "nonGoals": [
    "Change unrelated authorization behavior."
  ],
  "assumptions": [
    "The fix applies to user resolution paths only, because the request names no other flow."
  ]
}
```
