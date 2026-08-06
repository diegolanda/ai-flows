# Contributing

## Set up the repository

Install Node.js 20 or newer. Then run:

```bash
corepack enable
npm install --global @oakshelf/cli@beta2
pnpm install
```

## Make a change

Keep each change focused. Update package versions when a published package changes.

Use only `oakshelf.json` for OakShelf package manifests.

Add or update tests for behavior changes. Do not commit credentials, local configuration, or generated bundles.

## Verify the change

Run:

```bash
pnpm check
pnpm check:profile-link
pnpm validate:skill
pnpm validate:profile
pnpm validate:workflow
pnpm pack:skill
pnpm pack:profile
pnpm pack:workflow
pnpm audit --prod
```

## Submit a pull request

Describe what changed and how you verified it. List known limitations or follow-up work.
