const SYMBOLS = {
  started: "⋮",
  passed: "✓",
  failed: "✗",
  skipped: "-",
};

function formatDuration(durationMs) {
  if (typeof durationMs !== "number") return "";
  return `${(durationMs / 1000).toFixed(1)}s`;
}

/**
 * Create a renderer for workflow events.
 *
 * The renderer consumes the event model defined in the workflow contracts
 * (stage.started, stage.log, stage.passed, stage.failed, stage.skipped,
 * pipeline.completed). It owns no orchestration logic.
 *
 * Options:
 * - write: sink for output lines (default process.stderr.write).
 * - tty: when true, stage results are colored. Defaults to the sink TTY state.
 */
export function createRenderer({ write, tty } = {}) {
  const sink = write ?? ((line) => process.stderr.write(line));
  const isTty = tty ?? Boolean(process.stderr.isTTY);

  function paint(symbol, text) {
    if (!isTty) return `${symbol} ${text}`;
    const colors = { "✓": "32", "✗": "31", "-": "33", "⋮": "36" };
    const code = colors[symbol];
    return code ? `[${code}m${symbol}[0m ${text}` : `${symbol} ${text}`;
  }

  function line(text) {
    sink(`${text}\n`);
  }

  function handle(event, payload = {}) {
    const stage = payload.stage ?? "";
    switch (event) {
      case "stage.started":
        line(paint(SYMBOLS.started, `${stage}`));
        return;
      case "stage.log":
        line(`    ${payload.line ?? ""}`);
        return;
      case "stage.passed":
        line(paint(SYMBOLS.passed, `${stage}  ${formatDuration(payload.durationMs)}`.trimEnd()));
        return;
      case "stage.failed":
        line(paint(SYMBOLS.failed, `${stage}  ${formatDuration(payload.durationMs)}`.trimEnd()));
        if (payload.message) line(`    ${payload.message}`);
        return;
      case "stage.skipped":
        line(paint(SYMBOLS.skipped, `${stage}  skipped`));
        if (payload.reason) line(`    ${payload.reason}`);
        return;
      case "pipeline.completed":
        line(`Pipeline ${payload.status ?? "completed"}`);
        return;
      default:
        return;
    }
  }

  return { handle };
}
