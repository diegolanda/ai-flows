# @diego OakShelf packages

A pnpm monorepo for OakShelf skills, profiles, and workflows published under the `@diego` namespace.

## Packages

| Package | Kind | Status |
| --- | --- | --- |
| `@diego/simple-technical-writing` | Skill | Ready for validation and packaging |
| `@diego/development-profile` | Profile | Ready for validation and packaging |
| `@diego/development` | Workflow | Private scaffold for later implementation |

## Requirements

- Node.js 20 or newer
- Corepack
- OakShelf CLI `0.0.1-beta2` or newer available as `oak`

Install the required OakShelf prerelease with:

```bash
npm install --global @oakshelf/cli@beta2
```

## Start

```bash
corepack enable
pnpm install
pnpm check
```

## Package the skill

```bash
pnpm pack:skill
```

The command creates a deterministic OakShelf bundle in `dist`.

## Publish the skill

Authenticate with the target OakShelf registry. Then run:

```bash
pnpm publish:skill -- --registry <registry-url>
```

OakShelf publishes `oakshelf.json` and the declared package files as a verified bundle.

## Install the skill globally

```bash
oak link '@diego/simple-technical-writing' --agent claude --global --registry <registry-url>
oak link '@diego/simple-technical-writing' --agent codex --global --registry <registry-url>
```

## Develop the workflow locally

The workflow package depends on the skill through pnpm's workspace protocol:

```json
"@diego/simple-technical-writing": "workspace:^"
```

During publication, pnpm replaces this with the matching package version.

All OakShelf packages in this repository use `oakshelf.json` manifests.

Validate and package the workflow scaffold with:

```bash
pnpm validate:workflow
pnpm pack:workflow
```

## Publish the profile

The development profile defines persistent instructions for Claude Code and Codex.
OakShelf `0.0.1-beta2` or newer is required.

Validate, package, and publish it with:

```bash
pnpm validate:profile
pnpm pack:profile
pnpm publish:profile -- --registry <registry-url>
```

Then link it globally:

```bash
oak link '@diego/development-profile' --agent claude --global --registry <registry-url>
oak link '@diego/development-profile' --agent codex --global --registry <registry-url>
```

The [profile package README](packages/profiles/development/README.md) documents beta2 ownership and recovery behavior.

## Design boundary

The skill defines how final technical prose is written. The development workflow decides when the skill runs. Do not apply the skill to every reasoning or debugging step.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a change.

Report security problems as described in [SECURITY.md](SECURITY.md).
