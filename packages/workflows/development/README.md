# @diego/development

An OakShelf workflow that delivers a software change with a locked intent, an intent-based review, and deterministic repository gates.

`oak sync` distributes this workflow, its skills, and its tool packages into a coding agent. The agent executes the workflow by following `WORKFLOW.md`. Deterministic tool scripts decide pass or fail. See `PRD.md` for the full product definition and `contracts/` for the machine-verifiable boundaries.

## Composition

- `@diego/development-intent`: normalizes a raw task request into a lockable intent.
- `@diego/pr-description`: describes the implementation without touching the locked intent.
- `@diego/intent-review`: reviews the branch diff against the locked intent.
- `@diego/simple-technical-writing`: normalizes human-facing prose.
- `packages/tools/*`: deterministic tools for Git state, branch state, gates, GitHub delivery, and terminal rendering.

## CI parity

`ci/github-intent-check.example.yml` shows how a target repository runs the deterministic subset of the workflow in GitHub Actions: intent hash integrity plus the configured gates through `diego-dev-hook ci-verify`.

## Validate and pack

From the repository root:

```bash
pnpm validate:workflow
pnpm pack:workflow
```

The package is marked `private` until the OakShelf distribution model for executable tool packages is finalized.
