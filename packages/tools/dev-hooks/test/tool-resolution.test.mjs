import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readState } from "@diego/branch-state";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(testDirectory, "../../../..");
const resolverPath = resolve(testDirectory, "../resolve.mjs");

function gitRun(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function makeTargetRepo() {
  const parent = mkdtempSync(join(tmpdir(), "development-target-tree-"));
  const target = join(parent, "repositories", "target");
  mkdirSync(target, { recursive: true });
  gitRun(target, "init", "--initial-branch", "main");
  gitRun(target, "config", "user.name", "Test");
  gitRun(target, "config", "user.email", "test@example.com");
  writeFileSync(
    join(target, "package.json"),
    JSON.stringify({
      name: "separate-target",
      version: "0.0.0",
      scripts: {
        "verify-target": "node -e \"require('node:fs').writeFileSync('gate-ran.txt', process.cwd())\"",
      },
    }),
  );
  mkdirSync(join(target, ".oakshelf"));
  writeFileSync(
    join(target, ".oakshelf", "development.json"),
    JSON.stringify({
      workflow: "@diego/development",
      gates: [{ name: "Target", script: "verify-target", required: true, skipIfMissing: false }],
    }),
  );
  gitRun(target, "add", ".");
  gitRun(target, "commit", "-m", "initial");
  gitRun(target, "checkout", "-b", "feature");
  return { parent, target };
}

function makeIncompleteResolver() {
  const root = mkdtempSync(join(tmpdir(), "incomplete-development-tools-"));
  const packageRoot = join(root, "packages", "tools", "dev-hooks");
  mkdirSync(join(packageRoot, "lib"), { recursive: true });
  copyFileSync(resolverPath, join(packageRoot, "resolve.mjs"));
  copyFileSync(resolve(testDirectory, "../lib/resolve-tools.mjs"), join(packageRoot, "lib", "resolve-tools.mjs"));
  return { root, resolverPath: join(packageRoot, "resolve.mjs") };
}

function makeInstalledResolver() {
  const root = mkdtempSync(join(tmpdir(), "installed-development-tools-"));
  const scopeRoot = join(root, "node_modules", "@diego");
  const packageRoot = join(scopeRoot, "dev-hooks");
  const dependencyRoot = join(scopeRoot, "branch-state");
  mkdirSync(join(packageRoot, "lib"), { recursive: true });
  mkdirSync(dependencyRoot, { recursive: true });
  copyFileSync(resolverPath, join(packageRoot, "resolve.mjs"));
  copyFileSync(resolve(testDirectory, "../lib/resolve-tools.mjs"), join(packageRoot, "lib", "resolve-tools.mjs"));
  writeFileSync(join(packageRoot, "bin.mjs"), "#!/usr/bin/env node\n");
  writeFileSync(join(dependencyRoot, "package.json"), JSON.stringify({ type: "module", exports: "./index.mjs" }));
  writeFileSync(join(dependencyRoot, "index.mjs"), "export {};\n");
  writeFileSync(join(dependencyRoot, "bin.mjs"), "#!/usr/bin/env node\n");
  chmodSync(join(packageRoot, "bin.mjs"), 0o755);
  chmodSync(join(dependencyRoot, "bin.mjs"), 0o755);
  return { root, resolverPath: join(packageRoot, "resolve.mjs") };
}

test("configured checkout tools operate on a target in a separate directory tree", () => {
  const { parent, target } = makeTargetRepo();
  const launcher = mkdtempSync(join(tmpdir(), "development-launcher-tree-"));
  try {
    assert.equal(existsSync(join(target, "oakshelf.lock.json")), false);
    assert.equal(existsSync(join(target, "node_modules", "@diego", "branch-state")), false);
    assert.equal(repositoryRoot.startsWith(dirname(target)), false);

    const resolution = JSON.parse(
      execFileSync(process.execPath, [resolverPath, "resolve"], {
        cwd: target,
        env: { ...process.env, DIEGO_AI_FLOWS_ROOT: repositoryRoot },
        encoding: "utf8",
      }),
    );
    assert.equal(resolution.root, repositoryRoot);

    execFileSync(
      resolution.branchState,
      ["init", "--cwd", target, "--base-branch", "main"],
      { cwd: launcher, input: "Capture intent across repositories.", encoding: "utf8" },
    );
    assert.equal(readState({ cwd: target }).rawIntent, "Capture intent across repositories.");

    execFileSync(resolution.devHook, ["gates", "--cwd", target], {
      cwd: launcher,
      encoding: "utf8",
    });
    assert.equal(realpathSync(readFileSync(join(target, "gate-ran.txt"), "utf8")), realpathSync(target));
    assert.equal(existsSync(join(launcher, "gate-ran.txt")), false);
  } finally {
    rmSync(parent, { recursive: true, force: true });
    rmSync(launcher, { recursive: true, force: true });
  }
});

test("legacy target root does not override the self-locating resolver", () => {
  const { parent, target } = makeTargetRepo();
  try {
    const resolution = JSON.parse(
      execFileSync(process.execPath, [resolverPath, "resolve", "--root", target], {
        cwd: target,
        env: { ...process.env, DIEGO_AI_FLOWS_ROOT: repositoryRoot },
        encoding: "utf8",
      }),
    );

    assert.equal(resolution.root, repositoryRoot);
    assert.equal(resolution.branchState, resolve(repositoryRoot, "packages/tools/branch-state/bin.mjs"));
    assert.equal(resolution.devHook, resolve(repositoryRoot, "packages/tools/dev-hooks/bin.mjs"));
    assert.ok(resolution.attempted.every((attempt) => attempt.result === "found"));
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("installed resolver locates its package dependency without a repository root", () => {
  const installedResolver = makeInstalledResolver();
  try {
    const env = { ...process.env };
    delete env.DIEGO_AI_FLOWS_ROOT;
    const resolution = JSON.parse(
      execFileSync(process.execPath, [installedResolver.resolverPath, "resolve"], {
        cwd: installedResolver.root,
        env,
        encoding: "utf8",
      }),
    );

    assert.equal(realpathSync(resolution.root), realpathSync(installedResolver.root));
    assert.equal(
      realpathSync(resolution.branchState),
      realpathSync(resolve(installedResolver.root, "node_modules/@diego/branch-state/bin.mjs")),
    );
    assert.equal(
      realpathSync(resolution.devHook),
      realpathSync(resolve(installedResolver.root, "node_modules/@diego/dev-hooks/bin.mjs")),
    );
  } finally {
    rmSync(installedResolver.root, { recursive: true, force: true });
  }
});

test("resolver failure lists every attempted path and the next action", () => {
  const emptyRoot = mkdtempSync(join(tmpdir(), "empty-ai-flows-"));
  const incompleteResolver = makeIncompleteResolver();
  try {
    const env = { ...process.env };
    delete env.DIEGO_AI_FLOWS_ROOT;
    const result = spawnSync(process.execPath, [incompleteResolver.resolverPath, "resolve", "--root", emptyRoot], {
      env,
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    const error = JSON.parse(result.stderr);
    assert.equal(error.attempted.length, 6);
    assert.ok(error.attempted.every((attempt) => attempt.result === "not found"));
    assert.match(error.nextAction, /DIEGO_AI_FLOWS_ROOT/);
  } finally {
    rmSync(emptyRoot, { recursive: true, force: true });
    rmSync(incompleteResolver.root, { recursive: true, force: true });
  }
});

test("incomplete resolver requires a configured checkout path", () => {
  const incompleteResolver = makeIncompleteResolver();
  try {
    const env = { ...process.env };
    delete env.DIEGO_AI_FLOWS_ROOT;
    const result = spawnSync(process.execPath, [incompleteResolver.resolverPath, "resolve"], {
      env,
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    const error = JSON.parse(result.stderr);
    assert.deepEqual(error.attempted.slice(-1), [
      { tool: "all", method: "DIEGO_AI_FLOWS_ROOT", result: "not configured" },
    ]);
    assert.match(error.nextAction, /Set DIEGO_AI_FLOWS_ROOT/);
  } finally {
    rmSync(incompleteResolver.root, { recursive: true, force: true });
  }
});

test("resolver locates its package tools without a configured checkout path", () => {
  const env = { ...process.env };
  delete env.DIEGO_AI_FLOWS_ROOT;
  const result = spawnSync(process.execPath, [resolverPath, "resolve"], { env, encoding: "utf8" });
  assert.equal(result.status, 0);
  const resolution = JSON.parse(result.stdout);
  assert.equal(resolution.root, repositoryRoot);
  assert.ok(resolution.attempted.every((attempt) => attempt.result === "found"));
});
