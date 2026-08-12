# PRD: OakShelf Development Delivery Pipeline

**Status:** Draft  
**Repository:** `diegolanda/ai-flows`  
**Primary package:** `@diego/development`  
**Target users:** developers working with Codex, Claude Code, and other agentic coding harnesses  
**Primary objective:** turn the existing development workflow into a reusable OakShelf composition of skills, deterministic tools, and delivery gates.

## 1. Summary

The repository already separates OakShelf packages into skills, profiles, and workflows. The current `@diego/development` workflow is a scaffold that describes an intended software-development flow but does not yet execute repository delivery steps.

This PRD defines the next version of that workflow.

The workflow should preserve the original intent of a change, generate and maintain a pull request description, review implementation against the locked intent, run deterministic repository gates, and coordinate Git and GitHub delivery.

The workflow must not make Husky the implementation layer. Husky should only invoke the workflow at Git lifecycle boundaries. The reusable logic should live in OakShelf packages so the same behavior can be installed into other repositories.

The core model is:

```text
Git / developer action
        |
        v
small repository adapter
        |
        v
@diego/development workflow
        |
        +--> OakShelf skills
        |      - capture and normalize intent
        |      - write PR description
        |      - review against intent
        |      - simple technical writing
        |
        +--> deterministic tools
        |      - inspect Git state
        |      - inspect package scripts
        |      - run gates
        |      - call Codex
        |      - call gh
        |
        +--> delivery orchestration
               - rebase
               - review
               - test
               - lint
               - build
               - push
               - PR sync
               - CI watch
```

## 2. Problem

Agentic coding tools can implement code quickly, but the delivery contract is usually implicit.

A developer may start with a clear purpose, then accumulate commits that gradually change scope. At PR time, an agent can generate a plausible description from the final diff, but the generated description may no longer represent the original goal.

Generic AI review also lacks a stable baseline. A review such as "review this diff" evaluates code quality and likely bugs, but it does not reliably answer the more important question:

> Did the implementation satisfy the original purpose without introducing unintended scope?

Repository gates are also fragmented. Developers may run tests, lint, build, rebase, push, create the PR, and watch CI through separate commands. Hooks can help, but embedding all logic directly in Husky creates repository-specific implementations that are hard to reuse and maintain.

## 3. Product goals

### 3.1 Primary goals

1. Capture the original purpose of a development task before it is lost in implementation details.
2. Convert that purpose into a concise `Intent` section written in simple technical English.
3. Lock `Intent` after explicit approval.
4. Maintain a separate `Description` section that changes as implementation changes.
5. Review the complete implementation against the locked `Intent`.
6. Run deterministic repository gates before delivery.
7. Keep Git hooks small and declarative.
8. Package reusable behavior as OakShelf skills and tools rather than copying logic into each application repository.
9. Support Codex first while preserving an adapter boundary for Claude Code or another execution harness later.
10. Provide a terminal pipeline view similar to a local CI runner.

### 3.2 Secondary goals

- Make the development workflow reusable across multiple repositories.
- Allow repositories to configure gates without copying orchestration code.
- Make AI-produced outputs structured and machine-verifiable.
- Allow the same workflow to run manually, from Git hooks, or from CI.
- Reuse `@diego/simple-technical-writing` for human-facing PR prose.

## 4. Non-goals

The first version will not:

- replace GitHub Actions;
- guarantee enforcement using local hooks alone;
- perform autonomous merges;
- automatically approve changes to locked intent;
- discover and execute arbitrary `package.json` scripts;
- require OakShelf registry services to execute locally during initial development;
- support every Git hosting provider;
- build a general-purpose CI platform;
- require a long-running daemon;
- attempt to reconstruct a missing original intent without telling the user that the intent was inferred.

## 5. Product principles

### 5.1 Intent is an input

`Intent` describes why the change exists and what outcome is expected.

Once approved, the workflow must treat it as immutable unless the developer explicitly enters an intent-change flow.

An implementation agent must not be allowed to silently rewrite the requirement to match the code it produced.

### 5.2 Description is derived state

`Description` describes the current implementation.

It should be regenerated or updated when commits change the implementation.

The description should explain:

- what was implemented;
- what is covered;
- what was skipped;
- assumptions;
- relevant trade-offs;
- intentional deviations.

### 5.3 AI proposes; deterministic code enforces

AI should interpret and review semantic content.

Deterministic code should:

- read Git state;
- compare refs;
- calculate hashes;
- run commands;
- enforce schemas;
- execute configured gates;
- call GitHub CLI;
- decide pass/fail based on structured results.

### 5.4 Hooks are adapters

Husky hooks should invoke OakShelf-provided behavior.

They should not contain the workflow implementation.

### 5.5 Local checks are convenience; CI is authority

Git hooks can be bypassed. Required enforcement must eventually be repeatable as a GitHub required check.

## 6. User experience

### 6.1 Starting a task

The preferred flow captures intent before implementation:

```bash
oak run @diego/development start \
  "Prevent nil errors when users have no organization"
```

The workflow records local task state associated with the current branch.

Example state:

```json
{
  "branch": "fix/nil-check",
  "rawIntent": "Prevent nil errors when users have no organization",
  "intent": null,
  "intentLocked": false,
  "descriptionStale": true,
  "reviewStale": true
}
```

The exact OakShelf execution syntax may change as workflow execution becomes stable. The important requirement is that the capability belongs to the OakShelf workflow and is not implemented independently in every target repository.

### 6.2 Creating a PR

The developer runs the workflow's PR delivery command.

Conceptually:

```bash
oak run @diego/development pr
```

The pipeline performs:

```text
Fetch
  -> Rebase
  -> Intent
  -> Intent approval
  -> Description
  -> Intent-based review
  -> Test
  -> Typecheck
  -> Lint
  -> Build
  -> Push
  -> PR create/update
  -> CI watch
```

The terminal should display pipeline state:

```text
Pipeline
fix/nil-check                                  running

✓ Rebase          8.0s
✓ Intent          3.1s
✓ Description     2.2s
⋮ Review          2.9s
○ Test
○ Typecheck
○ Lint
○ Build
○ Push
○ PR
○ CI

Log
Reviewing implementation against locked Intent...

x abort    ? help
```

### 6.3 Pull request body

The generated body must contain two primary sections:

```md
## Intent

Prevent nil errors when resolving a user without an assigned organization.

The change must:
- return a safe result when the organization is missing;
- preserve existing behavior when an organization exists;
- avoid changing unrelated authorization behavior.

<!-- oak:intent-sha256=<hash> -->

## Description

Added a guard before accessing the organization.

Added tests for users without an organization.

No authorization behavior was changed.
```

The intent hash is workflow metadata, not the security boundary. It detects accidental or unauthorized workflow-level mutation but does not replace server-side enforcement.

## 7. OakShelf package architecture

The workflow should be composed from small packages instead of becoming one large prompt.

The existing repository already uses `packages/skills`, `packages/profiles`, and `packages/workflows`. This PRD proposes extending that structure with reusable execution packages while avoiding an unsupported OakShelf manifest kind until the OakShelf schema explicitly defines one.

Target structure:

```text
packages/
  profiles/
    development/

  skills/
    simple-technical-writing/
    development-intent/
    pr-description/
    intent-review/

  workflows/
    development/
      WORKFLOW.md
      PRD.md
      oakshelf.json
      README.md

  tools/
    git-repository/
    github-cli/
    codex-exec/
    quality-gates/
    pipeline-ui/
```

### Important compatibility boundary

If OakShelf does not yet support a first-class `tool` package kind, packages under `packages/tools` must initially remain normal executable workspace packages and must not invent an `oakshelf.json` schema that the OakShelf CLI cannot validate.

When OakShelf gains a supported tool manifest kind, these packages can be promoted to publishable OakShelf tools without changing the workflow contract.

## 8. Skills

### 8.1 `@diego/development-intent`

Purpose: convert a raw task request into a stable PR intent.

Inputs:

```json
{
  "rawIntent": "string",
  "repositoryContext": "string?",
  "examples": ["string"]
}
```

Output:

```json
{
  "intent": "string",
  "goals": ["string"],
  "nonGoals": ["string"],
  "assumptions": ["string"]
}
```

Requirements:

- use simple technical English;
- preserve the original purpose;
- do not infer new scope without marking it as an assumption;
- make ambiguity visible;
- produce structured output;
- allow the developer to approve the final result before locking it.

The skill may depend on `@diego/simple-technical-writing` for final prose normalization.

### 8.2 `@diego/pr-description`

Purpose: describe the current implementation without rewriting intent.

Inputs:

```json
{
  "intent": "string",
  "diff": "string",
  "commits": ["string"],
  "previousDescription": "string?"
}
```

Output:

```json
{
  "description": "string",
  "covered": ["string"],
  "skipped": ["string"],
  "assumptions": ["string"],
  "deviations": ["string"]
}
```

The schema must not expose an `intent` output field.

This is deliberate. The skill should be technically unable to replace the locked intent through its normal output channel.

### 8.3 `@diego/intent-review`

Purpose: review the complete branch diff against the locked intent.

The review should check:

- contradictions with intent;
- missing requirements;
- unnecessary scope;
- bugs;
- regressions;
- unsafe assumptions;
- missing intent-critical tests;
- behavior described in the PR but not implemented;
- implementation behavior not disclosed in the PR description.

Output:

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

Configurable failure policy should determine which severities block delivery.

## 9. Tool packages

### 9.1 `git-repository`

Responsibilities:

- determine repository root;
- determine current branch;
- detect `main` or `master`, with explicit config override;
- fetch remote refs;
- calculate ahead/behind state;
- produce base-to-HEAD diff;
- list commits;
- detect dirty working tree;
- perform explicit rebase only from a mutation-safe workflow command;
- expose structured results to the workflow.

The Git tool must never perform a rebase from a `pre-push` hook.

If a direct `git push` detects that the branch is behind the configured base branch, it should fail and tell the developer to run the OakShelf delivery command.

### 9.2 `codex-exec`

Responsibilities:

- invoke Codex non-interactively;
- pass prompts and context through stdin or files;
- force read-only sandboxing for review/generation steps when possible;
- request structured JSON output;
- validate model output against a JSON Schema;
- expose stdout/stderr and timing events;
- return normalized exit status;
- avoid giving Codex mutation capabilities during review.

The abstraction should support a future provider adapter:

```ts
interface AgentExecutor {
  execute(request: AgentRequest): Promise<AgentResult>;
}
```

V1 provider:

```text
Codex CLI
```

Possible later providers:

```text
Claude Code
Gemini CLI
OpenCode
```

### 9.3 `github-cli`

Responsibilities:

- detect an existing PR for the current branch;
- create a PR using `gh`;
- read existing PR body;
- update only workflow-managed PR sections;
- preserve unrelated human-authored PR content where possible;
- retrieve CI/check state;
- optionally watch checks after push.

The first implementation should shell out to `gh` instead of adding a separate GitHub SDK dependency.

### 9.4 `quality-gates`

Responsibilities:

- execute explicitly configured commands;
- detect whether an optional package script exists;
- stream output;
- collect duration and result;
- stop on required gate failure;
- never run arbitrary scripts merely because they exist.

Default recommended gates:

```text
test
typecheck
lint
build
```

Example repository configuration:

```json
{
  "baseBranch": "main",
  "gates": [
    { "name": "Test", "script": "test", "optional": true },
    { "name": "Typecheck", "script": "typecheck", "optional": true },
    { "name": "Lint", "script": "lint", "optional": true },
    { "name": "Build", "script": "build", "optional": true }
  ]
}
```

### 9.5 `pipeline-ui`

Responsibilities:

- render stage state on interactive terminals;
- fall back to plain logs in non-TTY environments;
- show duration;
- show current log line;
- support abort;
- permit detach only after blocking local stages have completed;
- consume workflow events rather than owning orchestration logic.

Event model:

```text
stage.started
stage.log
stage.passed
stage.failed
stage.skipped
pipeline.completed
```

## 10. Workflow state

Task state should be local and branch-specific.

Recommended initial storage:

```text
.git/oakshelf/development/<branch-safe-id>.json
```

This state must not be committed by default.

Example:

```json
{
  "version": 1,
  "branch": "fix/nil-check",
  "baseBranch": "main",
  "rawIntent": "Prevent nil errors when users have no organization",
  "intent": "Prevent nil errors...",
  "intentHash": "sha256:...",
  "intentLocked": true,
  "intentApprovedAt": "2026-08-12T00:00:00Z",
  "descriptionStale": true,
  "reviewStale": true,
  "lastReviewedHead": "abc123",
  "pullRequest": 42
}
```

No secrets should be stored in this file.

## 11. Intent change flow

Changing intent must be a first-class action.

Conceptual command:

```bash
oak run @diego/development intent edit
```

The workflow should show the previous and proposed intent and require explicit approval.

Example:

```diff
- Prevent nil errors when users have no organization.
+ Prevent nil errors when users have no organization and add guest support.
```

The developer must provide a reason for the scope change.

After approval:

1. replace the locked intent;
2. calculate a new hash;
3. mark description stale;
4. mark review stale;
5. run intent review again before delivery;
6. update the PR body;
7. optionally add a PR comment that records the scope change.

Environment variables or agent-controlled output must not silently authorize an intent change.

## 12. Git lifecycle integration

### 12.1 `pre-commit`

Use only fast deterministic checks.

Recommended behavior:

- format staged files if configured;
- run lint-staged or equivalent;
- optional lightweight static checks.

Do not run full Codex review here.

### 12.2 `post-commit`

Do not perform expensive network or AI work.

Mark branch state:

```json
{
  "descriptionStale": true,
  "reviewStale": true
}
```

The hook cannot reject the already-created commit, so it should remain cheap and informational.

### 12.3 `pre-push`

The hook should:

1. verify branch/base relationship;
2. fail if a rebase is required;
3. refresh description if stale;
4. run intent review;
5. run configured deterministic gates;
6. allow Git push only if blocking stages pass.

It must not rewrite branch history.

### 12.4 OakShelf delivery command

The mutation-safe delivery path may:

1. fetch;
2. rebase onto the configured base;
3. refresh PR artifacts;
4. run review;
5. run gates;
6. push;
7. create/update PR;
8. watch CI.

## 13. Repository adapter

Target repositories should contain minimal integration only.

Example:

```text
.husky/
  pre-commit
  post-commit
  pre-push

.oakshelf/
  development.json
```

Example hook:

```sh
pnpm exec oak run @diego/development hook pre-push
```

The exact command depends on OakShelf workflow execution support. No target repository should copy the implementation of intent generation, review, Codex invocation, GitHub integration, or pipeline rendering.

## 14. Configuration

A target repository should be able to configure behavior without editing the workflow package.

Proposed repository-level configuration:

```json
{
  "workflow": "@diego/development",
  "baseBranch": "auto",
  "review": {
    "provider": "codex",
    "failOn": ["high", "critical"]
  },
  "gates": [
    { "name": "Test", "script": "test", "optional": true },
    { "name": "Typecheck", "script": "typecheck", "optional": true },
    { "name": "Lint", "script": "lint", "optional": true },
    { "name": "Build", "script": "build", "optional": true }
  ]
}
```

The workflow may provide defaults, but target repositories own their gate commands.

## 15. Existing package reuse

The existing `@diego/simple-technical-writing` skill should remain responsible for final technical prose, not internal reasoning or raw tool output.

It should be reused by:

- intent normalization;
- PR description generation;
- final pipeline summaries;
- documentation updates.

It should not be injected into every Codex reasoning step.

The existing `@diego/development-profile` may later establish persistent coding-agent instructions, but profile behavior should remain separate from delivery workflow execution.

## 16. PR body ownership

The workflow must distinguish managed and unmanaged sections.

V1 may own the complete PR body if the repository explicitly opts in.

Preferred later behavior is managed markers:

```md
<!-- oak:managed:intent:start -->
## Intent
...
<!-- oak:managed:intent:end -->

<!-- oak:managed:description:start -->
## Description
...
<!-- oak:managed:description:end -->
```

This allows developers to add manual sections such as screenshots, rollout notes, or operational context without the workflow deleting them.

## 17. Review lifecycle

Review results are valid only for the HEAD commit that was reviewed.

State must record:

```text
lastReviewedHead
```

If HEAD changes, review becomes stale automatically.

A successful review should not be reused for a different commit.

The same rule should apply to deterministic gate results where practical.

## 18. Failure behavior

The workflow must fail closed for required stages.

Examples:

### Missing intent

```text
✗ Intent

No original task intent is recorded for this branch.

Provide the original purpose or explicitly approve an inferred intent before delivery.
```

### Branch behind base

```text
✗ Rebase required

Branch is 3 commits behind origin/main.

Run the OakShelf development delivery command so the workflow can rebase before pushing.
```

### Review failure

```text
✗ Review

1 high-severity finding blocks delivery.

src/user.ts:42
The nil guard changes authorization behavior, but the locked intent requires authorization behavior to remain unchanged.
```

### Missing optional gate

```text
- Typecheck        skipped
  No configured typecheck script exists.
```

## 19. Security and trust boundaries

- AI review must run read-only when possible.
- Review prompts must not grant arbitrary shell execution.
- Only allowlisted gate commands may execute.
- Intent approval must require direct user action.
- Local intent hashes detect workflow mutation but do not prove authenticity.
- Required organization-level enforcement belongs in CI/branch protection.
- `gh` and Codex authentication should use the user's existing local authentication mechanisms.
- The workflow must not read or print repository secrets unless explicitly required by a configured command.
- Logs should avoid dumping environment variables.

## 20. CI parity

A later GitHub Action should reuse the same OakShelf workflow or underlying packages.

The server-side check should at minimum:

1. parse the PR intent;
2. confirm intent integrity against the accepted baseline;
3. review PR diff against intent;
4. run required deterministic gates or consume their existing CI results;
5. publish a required check.

This makes local hooks a fast developer experience while GitHub remains the authoritative enforcement layer.

## 21. Implementation phases

### Phase 0 — PRD and contracts

Deliverables:

- this PRD;
- package boundaries;
- JSON schemas for intent, description, and review;
- workflow event contract;
- repository config contract.

### Phase 1 — Skills

Add:

```text
packages/skills/development-intent
packages/skills/pr-description
packages/skills/intent-review
```

Requirements:

- `SKILL.md`;
- `README.md`;
- evals;
- package metadata;
- OakShelf manifest only where supported by the existing schema;
- structured output examples.

### Phase 2 — Local executable tools

Add workspace packages:

```text
packages/tools/git-repository
packages/tools/codex-exec
packages/tools/github-cli
packages/tools/quality-gates
```

These may initially be internal npm/workspace packages rather than OakShelf package kinds.

Update `pnpm-workspace.yaml` to include `packages/tools/*` only when this phase begins.

### Phase 3 — Workflow orchestration

Replace the current development workflow scaffold with executable orchestration that composes the skills and tool packages.

Add commands/actions equivalent to:

```text
start
check
push
pr
intent edit
hook pre-commit
hook post-commit
hook pre-push
```

### Phase 4 — TUI

Add `pipeline-ui` and interactive pipeline rendering.

Do not couple workflow correctness to TTY rendering.

### Phase 5 — Husky installer

Provide an explicit setup action that can add or update minimal hooks in a target repository.

The installer must show what it will modify before changing existing hooks.

### Phase 6 — CI parity

Add a GitHub Action or reusable CI integration based on the same contracts.

### Phase 7 — OakShelf native tools

If OakShelf introduces a validated first-class `tool` package kind, migrate the executable workspace packages to publishable OakShelf tool manifests.

Do not block Phases 1-6 on this capability.

## 22. Acceptance criteria for V1

V1 is complete when a developer can use the workflow in a real repository and demonstrate all of the following:

1. A task intent is captured before PR creation.
2. Intent is normalized using the dedicated skill.
3. The developer explicitly approves intent.
4. Intent is locked and receives a deterministic hash.
5. A PR body is generated with `Intent` and `Description`.
6. A later commit marks description and review stale.
7. The next delivery refreshes Description without changing Intent.
8. Codex reviews the current diff against locked Intent.
9. A high-severity review finding blocks delivery.
10. Configured tests/lint/build gates execute.
11. Missing optional gates are skipped rather than failing.
12. A branch behind base is rejected from direct `pre-push` rather than rebased inside the hook.
13. The explicit delivery workflow can fetch and rebase before gates.
14. The workflow can create or update the PR through `gh`.
15. Local state is invalidated when HEAD changes.
16. Husky hooks contain only small invocations into the shared workflow.
17. The implementation is reusable by a second repository without copying its internal logic.

## 23. Success metrics

Initial qualitative metrics:

- fewer PRs where implementation scope differs from the original task;
- fewer stale or misleading PR descriptions;
- fewer pushes that fail CI because a developer skipped a known local gate;
- lower duplication of agent workflow logic across repositories;
- developers can understand why a delivery was blocked from the terminal output alone.

Possible later quantitative metrics:

- percentage of PRs with locked intent;
- percentage of review findings mapped to an intent requirement;
- average local gate duration;
- local-to-CI failure mismatch rate;
- number of repositories consuming the same published workflow.

## 24. Open questions

1. What execution contract should OakShelf expose for workflows: declarative steps, executable entrypoint, or both?
2. Should task state live under `.git/oakshelf`, an OakShelf global state directory, or both?
3. Should an approved intent baseline also be persisted remotely in a bot-owned PR comment for CI verification?
4. What is the final OakShelf model for first-class executable tools?
5. Should the workflow invoke provider CLIs directly or resolve providers through an OakShelf tool abstraction?
6. Should the PR Description be regenerated completely or patched incrementally?
7. Should local review findings be posted to the PR automatically, or only block locally in V1?
8. How should monorepos map changed files to package-specific gates?
9. Should gate results be cached by HEAD SHA to avoid rerunning expensive builds when nothing changed?
10. What explicit approval UX should OakShelf provide for intent changes when invoked non-interactively?

## 25. Recommended V1 scope decision

The first implementation should stay deliberately narrow:

```text
Codex only
GitHub only
pnpm/npm-script gates
main/master base branch detection
local branch state
Intent + Description PR contract
intent-based review
Husky adapter
plain CLI first
TUI second
```

The product should prove that **locked intent + intent-based review + deterministic delivery gates** improves the development workflow before adding additional providers, hosting platforms, or complex workflow syntax.

## 26. Final product boundary

This project should not become "a large Husky configuration."

It should become a reusable OakShelf development workflow composed from:

```text
Skills      -> semantic behavior
Tools       -> deterministic capabilities
Workflow    -> ordering, state, policy, and gates
Profile     -> persistent agent behavior
Husky       -> Git lifecycle adapter
GitHub CI   -> authoritative enforcement
```

That separation is the main architectural requirement of this PRD.
