---
name: development
description: Analyze, implement, verify, and document a software-development task.
status: scaffold
---

# Development Workflow

This package is a scaffold. It defines the intended composition boundary without committing OakShelf to a final execution schema.

## Intended stages

1. Understand the task and repository constraints.
2. Plan the smallest safe implementation.
3. Implement the change.
4. Run relevant checks and tests.
5. Review the diff for regressions and unintended changes.
6. Use `@diego/simple-technical-writing` for the final summary and documentation.

## Skill boundary

Do not apply the writing skill to internal reasoning, debugging output, code, or raw tool results.

Apply the skill only to finished prose, including:

- implementation summaries
- pull request descriptions
- release notes
- documentation updates
- user-facing technical explanations

## Future executable outline

```yaml
steps:
  - id: understand
    uses: builtin/task-analysis

  - id: implement
    uses: builtin/software-development

  - id: verify
    uses: builtin/test-and-review

  - id: summarize
    uses: "@diego/simple-technical-writing"
    with:
      intent: write
      text: "${steps.implement.summary}"

  - id: document
    when: "${inputs.updateDocumentation}"
    uses: "@diego/simple-technical-writing"
    with:
      intent: rewrite
      text: "${steps.implement.documentation}"
```
