import test from "node:test";
import assert from "node:assert/strict";
import { createRenderer } from "../index.mjs";

function capture() {
  const lines = [];
  return { lines, write: (chunk) => lines.push(chunk) };
}

test("renders the stage lifecycle in plain mode", () => {
  const { lines, write } = capture();
  const renderer = createRenderer({ write, tty: false });
  renderer.handle("stage.started", { stage: "Test" });
  renderer.handle("stage.log", { stage: "Test", line: "1 passing" });
  renderer.handle("stage.passed", { stage: "Test", durationMs: 1234 });
  assert.deepEqual(lines, ["⋮ Test\n", "    1 passing\n", "✓ Test  1.2s\n"]);
});

test("renders failure message and skip reason", () => {
  const { lines, write } = capture();
  const renderer = createRenderer({ write, tty: false });
  renderer.handle("stage.failed", { stage: "Lint", durationMs: 500, message: "2 errors" });
  renderer.handle("stage.skipped", { stage: "Typecheck", reason: "No typecheck script exists." });
  assert.deepEqual(lines, [
    "✗ Lint  0.5s\n",
    "    2 errors\n",
    "- Typecheck  skipped\n",
    "    No typecheck script exists.\n",
  ]);
});

test("renders pipeline completion and ignores unknown events", () => {
  const { lines, write } = capture();
  const renderer = createRenderer({ write, tty: false });
  renderer.handle("pipeline.completed", { status: "pass" });
  renderer.handle("something.else", {});
  assert.deepEqual(lines, ["Pipeline pass\n"]);
});

test("colors stage results in TTY mode and not in plain mode", () => {
  const tty = capture();
  createRenderer({ write: tty.write, tty: true }).handle("stage.passed", {
    stage: "Build",
    durationMs: 100,
  });
  assert.match(tty.lines[0], /\[32m✓\[0m Build/);

  const plain = capture();
  createRenderer({ write: plain.write, tty: false }).handle("stage.passed", {
    stage: "Build",
    durationMs: 100,
  });
  assert.doesNotMatch(plain.lines[0], /\[/);
});
