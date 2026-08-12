# @diego/quality-gates

Deterministic tool package for the OakShelf development delivery pipeline. It runs configured repository gates, such as test, typecheck, lint, and build, and streams their result as workflow events.

The tool never runs a script merely because it exists. It only runs scripts explicitly listed in the gate configuration.

## Gate semantics

Each gate has this shape:

```js
{ name: "Test", script: "test", required: true, skipIfMissing: true }
```

- `required`: if `true`, a gate failure blocks delivery. Execution stops, and no later gate runs. If `false`, a failure is reported and execution continues with the next gate.
- `skipIfMissing`: if `true`, a missing package script skips the gate. If `false`, a missing script is a failure.

## API

```js
import { hasScript, detectPackageManager, runGates, validateGatesConfig } from "@diego/quality-gates";

const gates = [
  { name: "Test", script: "test", required: true, skipIfMissing: true },
  { name: "Typecheck", script: "typecheck", required: true, skipIfMissing: true },
  { name: "Lint", script: "lint", required: true, skipIfMissing: true },
  { name: "Build", script: "build", required: true, skipIfMissing: true },
];

validateGatesConfig(gates);

const result = await runGates(gates, {
  cwd: process.cwd(),
  emit: (event, payload) => console.log(event, payload),
});

console.log(result.status); // "pass" | "fail"
console.log(result.results); // per-gate outcome
```

### `hasScript(scriptName, { cwd })`

Returns `true` when `package.json` in `cwd` declares the given script.

### `detectPackageManager({ cwd })`

Returns `"pnpm"` when `cwd` has a `pnpm-lock.yaml` file, or when `package.json` sets a `packageManager` field that starts with `"pnpm"`. Every other case returns `"npm"`.

### `runGates(gates, { cwd, emit })`

Runs the gates in order with the detected package manager, as `<pm> run <script>`. It emits these events through `emit`, matching the workflow event model in `CONTRACTS.md`:

```text
stage.started      { stage }
stage.log          { stage, line }
stage.passed       { stage, durationMs }
stage.failed       { stage, durationMs, message }
stage.skipped      { stage, reason }
```

`stage` is the gate name. `emit` is optional. Without it, the tool runs silently.

The function returns `{ status, results }`. `status` is `"pass"` or `"fail"`. `results` lists one entry per gate that ran, in order. A required gate failure stops the run, so later gates do not appear in `results`.

### `validateGatesConfig(gates)`

Validates a gate configuration array. It throws a descriptive error when an entry has a missing `name` or `script`, a field with the wrong type, or an unknown field.

## Testing

```sh
node --test packages/tools/quality-gates/test/
```
