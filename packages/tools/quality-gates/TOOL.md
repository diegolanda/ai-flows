# quality-gates

Runs explicitly configured package scripts as delivery gates for `@diego/development`. Each gate has `required` (a failure blocks) and `skipIfMissing` (a missing script skips). Only configured scripts run. Results stream as workflow events.

## Usage

```js
import { runGates } from "@diego/quality-gates";
const result = await runGates(gates, { cwd, emit });
```

## Notes for agents

- OakShelf never executes this package during install or link. Invoking it is always an explicit action.
- The installed path is reported by `oak inspect '@diego/quality-gates'`.
- The aggregate status fails only when a required gate fails.
