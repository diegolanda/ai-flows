---
name: diego-intent-review
description: |
  Review a complete branch diff against a locked intent. Use before delivery
  to answer one question: did the implementation satisfy the original purpose
  without introducing unintended scope? The output is structured JSON with a
  pass or fail status and findings. Every finding names its relation to the
  locked intent and states the consequence before the internal cause.
license: MIT
metadata:
  version: "0.0.1"
  workflow: "@diego/development"
---

# Intent Review

Review the complete branch diff against the locked intent. The locked intent is the baseline. Generic code review answers "is this code good?" This review answers "does this change do what the developer asked for, and nothing else?"

## Inputs

```json
{
  "intent": "string",
  "diff": "string",
  "description": "string?",
  "failOn": ["high", "critical"]
}
```

- `intent`: the locked intent. It is immutable. Do not propose edits to it.
- `diff`: the complete base-to-HEAD diff.
- `description`: the current PR description, when one exists.
- `failOn`: the severities that block delivery, from repository configuration.

## What to check

- contradictions with the intent;
- missing requirements;
- unnecessary scope;
- bugs;
- regressions;
- unsafe assumptions;
- missing intent-critical tests;
- behavior described in the PR but not implemented;
- implementation behavior not disclosed in the PR description.

## Output

Return only a JSON object that matches this shape:

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

The canonical schema is `contracts/review.schema.json` in the `@diego/development` workflow package.

Set `status` to `fail` when at least one finding has a severity listed in `failOn`. Otherwise set `status` to `pass`. Findings below the `failOn` threshold are still reported.

## Rules

1. Review only against the locked intent and the diff. Do not review against what you would have built.
2. State the user-visible or system-visible consequence before the internal cause in every `message`.
3. Set `intentRelation` to the part of the intent that the finding contradicts, misses, or exceeds. Every finding must relate to the intent, the diff, or the disclosure gap between them.
4. Anchor a finding to `file` and `line` when the evidence is in a specific location.
5. Do not turn a hypothesis into a fact. If you suspect a problem but cannot confirm it from the diff, say what is unknown in the message and lower the severity.
6. Do not report style preferences as findings.
7. This review is read-only. Do not modify files, state, or the PR.
8. Return only the JSON object. Do not wrap it in prose.

## Severity guide

- `critical`: the change breaks the intent or damages data or security.
- `high`: an intent requirement is contradicted, missing, or undisclosed.
- `medium`: likely bug or regression not directly tied to an intent requirement.
- `low`: risk worth recording that does not block delivery.

## Example

```json
{
  "status": "fail",
  "findings": [
    {
      "severity": "high",
      "file": "src/user.ts",
      "line": 42,
      "message": "Users in a suspended organization gain access they did not have before. The nil guard changes authorization behavior, but the locked intent requires authorization behavior to remain unchanged.",
      "intentRelation": "Non-goal: change unrelated authorization behavior."
    }
  ]
}
```
