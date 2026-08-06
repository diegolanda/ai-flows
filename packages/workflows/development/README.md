# @diego/development

A private scaffold for a future OakShelf development workflow.

The package depends on `@diego/simple-technical-writing` through `workspace:^` for local development.

It is marked `private` to prevent accidental publication before the workflow execution contract is finalized.

The package uses `oakshelf.json`. Validate and package the scaffold from the repository root:

```bash
pnpm validate:workflow
pnpm pack:workflow
```
