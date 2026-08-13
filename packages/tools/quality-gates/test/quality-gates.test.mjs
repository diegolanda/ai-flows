import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { runGates, validateGatesConfig } from "../index.mjs";

async function makeFixture(scripts) {
  const dir = await mkdtemp(path.join(tmpdir(), "quality-gates-"));
  const packageJson = {
    name: "fixture",
    version: "0.0.0",
    private: true,
    scripts,
  };
  await writeFile(path.join(dir, "package.json"), JSON.stringify(packageJson, null, 2));
  return dir;
}

function collectingEmitter() {
  const events = [];
  const emit = (name, payload) => events.push({ name, payload });
  return { events, emit };
}

test("a passing gate reports status passed", async () => {
  const cwd = await makeFixture({ ok: "node -e \"\"" });
  try {
    const { emit, events } = collectingEmitter();
    const result = await runGates([{ name: "Test", script: "ok" }], { cwd, emit });

    assert.equal(result.status, "pass");
    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].name, "Test");
    assert.equal(result.results[0].status, "passed");
    assert.equal(typeof result.results[0].durationMs, "number");

    const names = events.map((event) => event.name);
    assert.equal(names[0], "stage.started");
    assert.equal(names[names.length - 1], "stage.passed");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("a failing required gate stops execution before later gates", async () => {
  const cwd = await makeFixture({
    bad: "node -e \"process.exit(1)\"",
    ok: "node -e \"\"",
  });
  try {
    const result = await runGates(
      [
        { name: "Bad", script: "bad", required: true },
        { name: "Ok", script: "ok" },
      ],
      { cwd },
    );

    assert.equal(result.status, "fail");
    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].name, "Bad");
    assert.equal(result.results[0].status, "failed");
    assert.ok(result.results.every((entry) => entry.name !== "Ok"));
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("a failing non-required gate reports failure and execution continues", async () => {
  const cwd = await makeFixture({
    bad: "node -e \"process.exit(1)\"",
    ok: "node -e \"\"",
  });
  try {
    const result = await runGates(
      [
        { name: "Bad", script: "bad", required: false },
        { name: "Ok", script: "ok" },
      ],
      { cwd },
    );

    assert.equal(result.status, "pass");
    assert.equal(result.results.length, 2);
    assert.equal(result.results[0].name, "Bad");
    assert.equal(result.results[0].status, "failed");
    assert.equal(result.results[0].required, false);
    assert.equal(result.results[1].name, "Ok");
    assert.equal(result.results[1].status, "passed");
    assert.equal(result.results[1].required, true);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("a missing script with skipIfMissing true is skipped", async () => {
  const cwd = await makeFixture({ ok: "node -e \"\"" });
  try {
    const { emit, events } = collectingEmitter();
    const result = await runGates(
      [{ name: "Missing", script: "does-not-exist", skipIfMissing: true }],
      { cwd, emit },
    );

    assert.equal(result.status, "pass");
    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].status, "skipped");
    assert.equal(typeof result.results[0].reason, "string");

    const skipEvent = events.find((event) => event.name === "stage.skipped");
    assert.ok(skipEvent);
    assert.equal(skipEvent.payload.stage, "Missing");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("a missing script with skipIfMissing false is a failure", async () => {
  const cwd = await makeFixture({ ok: "node -e \"\"" });
  try {
    const result = await runGates(
      [{ name: "Missing", script: "does-not-exist", skipIfMissing: false }],
      { cwd },
    );

    assert.equal(result.status, "fail");
    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].status, "failed");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("the event sequence for a passing gate is started then passed", async () => {
  const cwd = await makeFixture({ ok: "node -e \"\"" });
  try {
    const { emit, events } = collectingEmitter();
    await runGates([{ name: "Test", script: "ok" }], { cwd, emit });

    const stageEvents = events.filter((event) => event.payload.stage === "Test");
    const names = stageEvents.map((event) => event.name);
    assert.equal(names[0], "stage.started");
    assert.equal(names[names.length - 1], "stage.passed");
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("stage.log events capture output lines", async () => {
  const cwd = await makeFixture({
    talk: "node -e \"console.log('hello from gate')\"",
  });
  try {
    const { emit, events } = collectingEmitter();
    await runGates([{ name: "Talk", script: "talk" }], { cwd, emit });

    const logLines = events
      .filter((event) => event.name === "stage.log")
      .map((event) => event.payload.line);

    assert.ok(logLines.some((line) => line.includes("hello from gate")));
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("validateGatesConfig rejects an unknown field", () => {
  assert.throws(
    () => validateGatesConfig([{ name: "Test", script: "test", extra: true }]),
    /unknown field/,
  );
});

test("validateGatesConfig accepts a well-formed list", () => {
  assert.doesNotThrow(() =>
    validateGatesConfig([
      { name: "Test", script: "test", required: true, skipIfMissing: true },
      { name: "Lint", script: "lint" },
    ]),
  );
});
