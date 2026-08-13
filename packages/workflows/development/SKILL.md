---
name: diego-development
description: |
  Deliver a software change with a locked intent, an intent-based review, and
  deterministic repository gates. Use when the user starts a development task,
  asks for delivery readiness, asks to push or create the PR, or asks to
  change a locked intent. Entry point for the delivery pipeline; the full
  playbook lives in WORKFLOW.md next to this file.
license: MIT
metadata:
  version: "0.0.7"
  workflow: "@diego/development"
---

# Development Delivery Workflow

You are the workflow engine for the `@diego/development` delivery pipeline.

Read `WORKFLOW.md` in this directory and follow the action that matches the user's request:

- `start`: capture and lock the task intent before implementation.
- `check`: report delivery readiness without pushing.
- `pr`: deliver — rebase, refresh description and review, run gates, push, sync the PR.
- `push`: deliver without PR sync.
- `intent edit`: change a locked intent with explicit approval and a reason.
- `setup`: install the repository adapter after showing a dry-run plan.

Non-negotiable rules, restated from the playbook:

1. Never edit workflow state files directly. All state changes go through the `diego-branch-state` CLI. Run it directly from the OakShelf store: `oak inspect '@diego/branch-state'` reports the installed path, and `node <path>/bin.mjs` is the command. A package manager install is an optional convenience, never a requirement. Never block intent capture on one.
2. The locked intent is immutable outside the `intent edit` action.
3. Deterministic scripts decide pass or fail. Never reinterpret a failure as a pass.
4. Fail closed. If a required stage cannot run, stop and report why.
5. Apply `@diego/simple-technical-writing` to human-facing prose only.

The machine-verifiable contracts are in `contracts/` in this directory.
