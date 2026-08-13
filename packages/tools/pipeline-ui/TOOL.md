# pipeline-ui

Renders delivery pipeline events (`stage.started`, `stage.log`, `stage.passed`, `stage.failed`, `stage.skipped`, `pipeline.completed`) on the terminal, with colors on a TTY and plain lines otherwise. It consumes events and owns no orchestration logic.

## Usage

```js
import { createRenderer } from "@diego/pipeline-ui";
const renderer = createRenderer({});
renderer.handle("stage.started", { stage: "Test" });
```

## Notes for agents

- OakShelf never executes this package during install or link. Invoking it is always an explicit action.
- The installed path is reported by `oak inspect '@diego/pipeline-ui'`.
