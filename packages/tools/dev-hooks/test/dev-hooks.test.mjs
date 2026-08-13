import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ciVerify,
  extractManagedIntent,
  loadConfig,
  localBaseName,
  postCommit,
  prePush,
  prSync,
  setup,
} from "../index.mjs";
import {
  initState,
  setIntent,
  lockIntent,
  readState,
  recordDescription,
  recordReview,
  intentHash,
  canonicalizeIntent,
} from "@diego/branch-state";
import { renderManagedBody } from "@diego/github-cli";

function gitRun(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), "dev-hooks-"));
  gitRun(dir, "init", "--initial-branch", "main");
  gitRun(dir, "config", "user.name", "Test");
  gitRun(dir, "config", "user.email", "test@example.com");
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "fixture", version: "0.0.0" }));
  gitRun(dir, "add", ".");
  gitRun(dir, "commit", "-m", "initial");
  gitRun(dir, "checkout", "-b", "feature");
  return dir;
}

test("loadConfig returns defaults when no config file exists", () => {
  const dir = makeRepo();
  try {
    const config = loadConfig({ cwd: dir });
    assert.equal(config.baseBranch, "auto");
    assert.deepEqual(config.review.failOn, ["high", "critical"]);
    assert.equal(config.gates.length, 4);
    assert.equal(config.gates[0].required, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadConfig merges the repository config file", () => {
  const dir = makeRepo();
  try {
    mkdirSync(join(dir, ".oakshelf"));
    writeFileSync(
      join(dir, ".oakshelf", "development.json"),
      JSON.stringify({
        workflow: "@diego/development",
        gates: [{ name: "Test", script: "test", required: false, skipIfMissing: false }],
      }),
    );
    const config = loadConfig({ cwd: dir });
    assert.equal(config.gates.length, 1);
    assert.equal(config.gates[0].required, false);
    assert.deepEqual(config.review.failOn, ["high", "critical"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("prePush fails closed when no intent is recorded", async () => {
  const dir = makeRepo();
  try {
    const result = await prePush({ cwd: dir });
    assert.equal(result.status, "fail");
    assert.ok(result.failures.some((f) => f.stage === "Intent"));
    assert.match(result.failures.find((f) => f.stage === "Intent").message, /No original task intent/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("prePush fails when the intent is not locked", async () => {
  const dir = makeRepo();
  try {
    initState({ cwd: dir, baseBranch: "main", rawIntent: "do the thing" });
    const result = await prePush({ cwd: dir });
    assert.equal(result.status, "fail");
    assert.ok(result.failures.some((f) => f.message.includes("not locked")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("prePush passes with a locked intent, fresh review, and passing gates", async () => {
  const dir = makeRepo();
  try {
    initState({ cwd: dir, baseBranch: "main", rawIntent: "do the thing" });
    setIntent({ cwd: dir, intent: "Do the thing safely." });
    lockIntent({ cwd: dir });
    recordDescription({ cwd: dir });
    const head = gitRun(dir, "rev-parse", "HEAD").trim();
    recordReview({ cwd: dir, headSha: head, status: "pass" });
    const events = [];
    const result = await prePush({ cwd: dir, emit: (event, payload) => events.push([event, payload]) });
    assert.equal(result.status, "pass");
    assert.ok(events.some(([event, payload]) => event === "stage.skipped" && payload.stage === "Test"));
    assert.deepEqual(events.at(-1), ["pipeline.completed", { status: "pass" }]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("prePush fails when a commit lands after the review", async () => {
  const dir = makeRepo();
  try {
    initState({ cwd: dir, baseBranch: "main", rawIntent: "do the thing" });
    setIntent({ cwd: dir, intent: "Do the thing safely." });
    lockIntent({ cwd: dir });
    recordDescription({ cwd: dir });
    const head = gitRun(dir, "rev-parse", "HEAD").trim();
    recordReview({ cwd: dir, headSha: head, status: "pass" });
    writeFileSync(join(dir, "later.txt"), "later");
    gitRun(dir, "add", ".");
    gitRun(dir, "commit", "-m", "later change");
    postCommit({ cwd: dir });
    const result = await prePush({ cwd: dir });
    assert.equal(result.status, "fail");
    assert.ok(result.failures.some((f) => f.stage === "Freshness"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ciVerify passes for an untampered managed body and fails for a tampered one", async () => {
  const dir = makeRepo();
  try {
    const intent = "Prevent nil errors when the organization is missing.";
    const hex = intentHash(intent).replace(/^sha256:/, "");
    const body = renderManagedBody({ intent, intentHash: hex, description: "Added a guard." });

    const ok = await ciVerify({ cwd: dir, body });
    assert.equal(ok.status, "pass");

    const tampered = body.replace("nil errors", "all errors");
    const bad = await ciVerify({ cwd: dir, body: tampered });
    assert.equal(bad.status, "fail");
    assert.ok(bad.failures.some((f) => f.stage === "Intent integrity"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("extractManagedIntent strips the heading and the hash comment", () => {
  const intent = "Line one.\nLine two.";
  const body = renderManagedBody({ intent, intentHash: "a".repeat(64), description: "d" });
  const extracted = extractManagedIntent(body);
  assert.equal(intentHash(extracted), intentHash(intent));
});

test("setup plans without writing and applies with write", () => {
  const dir = makeRepo();
  try {
    const plan = setup({ cwd: dir });
    assert.equal(plan.applied, false);
    assert.equal(plan.entries.filter((e) => e.action === "create").length, 4);
    assert.ok(!existsSync(join(dir, ".husky", "pre-push")));

    const applied = setup({ cwd: dir, write: true });
    assert.equal(applied.applied, true);
    assert.equal(
      readFileSync(join(dir, ".husky", "pre-push"), "utf8"),
      "pnpm exec diego-dev-hook pre-push\n",
    );
    assert.ok(existsSync(join(dir, ".oakshelf", "development.json")));

    const again = setup({ cwd: dir });
    assert.ok(again.entries.every((e) => e.action === "keep"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("setup reports an update for a hook with different content", () => {
  const dir = makeRepo();
  try {
    mkdirSync(join(dir, ".husky"), { recursive: true });
    writeFileSync(join(dir, ".husky", "pre-push"), "echo custom\n");
    const plan = setup({ cwd: dir });
    const entry = plan.entries.find((e) => e.path.endsWith("pre-push"));
    assert.equal(entry.action, "update");
    assert.equal(entry.current, "echo custom\n");
    assert.equal(readFileSync(join(dir, ".husky", "pre-push"), "utf8"), "echo custom\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("prePush and localBaseName handle a cloned repository with origin/HEAD", async () => {
  const upstream = makeRepo();
  const parent = mkdtempSync(join(tmpdir(), "dev-hooks-clone-"));
  const clone = join(parent, "clone");
  try {
    gitRun(upstream, "checkout", "main");
    execFileSync("git", ["clone", upstream, clone], { encoding: "utf8" });
    gitRun(clone, "config", "user.name", "Test");
    gitRun(clone, "config", "user.email", "test@example.com");
    gitRun(clone, "checkout", "-b", "feature");

    const { detectBaseBranch } = await import("@diego/git-repository");
    const detected = detectBaseBranch({ cwd: clone, configured: "auto" });
    assert.equal(localBaseName(detected), "main");

    const result = await prePush({ cwd: clone });
    assert.ok(!result.failures.some((f) => f.stage === "Base"));
  } finally {
    rmSync(upstream, { recursive: true, force: true });
    rmSync(parent, { recursive: true, force: true });
  }
});

test("ciVerify rejects a hash comment planted above the managed section", async () => {
  const dir = makeRepo();
  try {
    const intent = "Prevent nil errors when the organization is missing.";
    const hex = intentHash(intent).replace(/^sha256:/, "");
    const body = renderManagedBody({ intent, intentHash: hex, description: "Added a guard." });
    const rewritten = body.replace("nil errors", "all errors");
    const spoofedHex = intentHash("Prevent all errors when the organization is missing.").replace(/^sha256:/, "");
    const spoofed = `<!-- oak:intent-sha256=${spoofedHex} -->\n${rewritten}`;
    const result = await ciVerify({ cwd: dir, body: spoofed });
    assert.equal(result.status, "fail");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ciVerify round-trips an intent that contains its own heading line", async () => {
  const dir = makeRepo();
  try {
    const intent = "Do the thing.\n\n## Intent\n\nA quoted heading inside the intent.";
    const canonical = canonicalizeIntent(intent);
    const hex = intentHash(intent).replace(/^sha256:/, "");
    const body = renderManagedBody({ intent: canonical, intentHash: hex, description: "D" });
    const result = await ciVerify({ cwd: dir, body });
    assert.equal(result.status, "pass");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a non-required failing gate does not block prePush", async () => {
  const dir = makeRepo();
  try {
    mkdirSync(join(dir, ".oakshelf"));
    writeFileSync(
      join(dir, ".oakshelf", "development.json"),
      JSON.stringify({
        workflow: "@diego/development",
        gates: [{ name: "Lint", script: "lint", required: false, skipIfMissing: false }],
      }),
    );
    initState({ cwd: dir, baseBranch: "main", rawIntent: "do the thing" });
    setIntent({ cwd: dir, intent: "Do the thing safely." });
    lockIntent({ cwd: dir });
    recordDescription({ cwd: dir });
    const head = gitRun(dir, "rev-parse", "HEAD").trim();
    recordReview({ cwd: dir, headSha: head, status: "pass" });
    const result = await prePush({ cwd: dir });
    assert.equal(result.status, "pass");
    assert.equal(result.gates[0].status, "failed");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadConfig rejects unknown fields and bad severities", () => {
  const dir = makeRepo();
  try {
    mkdirSync(join(dir, ".oakshelf"));
    writeFileSync(
      join(dir, ".oakshelf", "development.json"),
      JSON.stringify({ workflow: "@diego/development", reveiw: { failOn: ["high"] } }),
    );
    assert.throws(() => loadConfig({ cwd: dir }), /unknown field "reveiw"/);

    writeFileSync(
      join(dir, ".oakshelf", "development.json"),
      JSON.stringify({ workflow: "@diego/development", review: { failOn: ["sev1"] } }),
    );
    assert.throws(() => loadConfig({ cwd: dir }), /review.failOn/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeGhStub({ prList = "[]", failLabelCreate = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "dev-hooks-gh-"));
  const argsFile = join(dir, "argv.txt");
  writeFileSync(argsFile, "");
  const script = [
    "#!/usr/bin/env bash",
    `printf '%s\\n' "$*" >> "${argsFile}"`,
    'case "$1 $2" in',
    `  "pr list") cat "${join(dir, "pr-list.json")}" ;;`,
    '  "pr create") echo "https://github.com/o/r/pull/9" ;;',
    '  "pr view") echo "{\\"labels\\":[]}" ;;',
    `  "label create") ${failLabelCreate ? "echo boom >&2; exit 1" : ":"} ;;`,
    '  *) : ;;',
    "esac",
    "exit 0",
    "",
  ].join("\n");
  writeFileSync(join(dir, "pr-list.json"), prList);
  writeFileSync(join(dir, "gh"), script);
  chmodSync(join(dir, "gh"), 0o755);
  return {
    dir,
    calls: () => readFileSync(argsFile, "utf8").split("\n").filter(Boolean),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

function prepareLockedState(dir, { size } = {}) {
  initState({ cwd: dir, baseBranch: "main", rawIntent: "do the thing" });
  setIntent({ cwd: dir, intent: "Do the thing safely.", ...(size ? { size } : {}) });
  lockIntent({ cwd: dir });
}

async function withStubbedGh(stub, fn) {
  const oldPath = process.env.PATH;
  process.env.PATH = `${stub.dir}:${oldPath}`;
  try {
    return await fn();
  } finally {
    process.env.PATH = oldPath;
  }
}

test("prSync creates the PR, records the number, and applies the size label", async () => {
  const dir = makeRepo();
  const stub = makeGhStub();
  try {
    prepareLockedState(dir, { size: "M" });
    const result = await withStubbedGh(stub, () =>
      prSync({ cwd: dir, title: "T", description: "D" }),
    );
    assert.equal(result.number, 9);
    assert.deepEqual(result.sizeLabel, { added: "size/M", removed: [] });
    assert.equal(readState({ cwd: dir }).pullRequest, 9);
    assert.ok(stub.calls().some((c) => c.startsWith("label create size/M")));
    assert.ok(stub.calls().some((c) => c.startsWith("pr edit 9 --add-label size/M")));
  } finally {
    stub.cleanup();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("prSync updates an existing PR and still applies the size label", async () => {
  const dir = makeRepo();
  const stub = makeGhStub({
    prList: JSON.stringify([{ number: 4, url: "https://github.com/o/r/pull/4", body: "" }]),
  });
  try {
    prepareLockedState(dir, { size: "XS" });
    const result = await withStubbedGh(stub, () =>
      prSync({ cwd: dir, title: "T", description: "D" }),
    );
    assert.equal(result.number, 4);
    assert.deepEqual(result.sizeLabel, { added: "size/XS", removed: [] });
    assert.ok(stub.calls().some((c) => c.startsWith("pr edit 4 --body-file")));
  } finally {
    stub.cleanup();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("prSync skips the label step when no intentSize is stored", async () => {
  const dir = makeRepo();
  const stub = makeGhStub();
  try {
    prepareLockedState(dir, {});
    const result = await withStubbedGh(stub, () =>
      prSync({ cwd: dir, title: "T", description: "D" }),
    );
    assert.equal(result.sizeLabel, null);
    assert.ok(!stub.calls().some((c) => c.startsWith("label")));
  } finally {
    stub.cleanup();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a label failure does not fail prSync and the PR number is still recorded", async () => {
  const dir = makeRepo();
  const stub = makeGhStub({ failLabelCreate: true });
  try {
    prepareLockedState(dir, { size: "L" });
    const result = await withStubbedGh(stub, () =>
      prSync({ cwd: dir, title: "T", description: "D" }),
    );
    assert.equal(result.number, 9);
    assert.match(result.sizeLabel.error, /label create/);
    assert.equal(readState({ cwd: dir }).pullRequest, 9);
  } finally {
    stub.cleanup();
    rmSync(dir, { recursive: true, force: true });
  }
});
