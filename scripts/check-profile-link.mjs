import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = process.cwd();
const home = await mkdtemp(join(tmpdir(), "ai-flows-profile-"));
const profile = "@diego/development-profile";

function oak(args, environment) {
  return execFileSync("oak", args, {
    cwd: root,
    encoding: "utf8",
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function assertFile(file, expected) {
  assert.equal(await readFile(file, "utf8"), expected);
}

const baseEnvironment = { ...process.env, HOME: home };
delete baseEnvironment.CODEX_HOME;

try {
  oak([
    "add",
    `file:${resolve(root, "packages/skills/simple-technical-writing")}`,
    "--global",
    "--yes",
  ], baseEnvironment);
  oak([
    "add",
    `file:${resolve(root, "packages/profiles/development")}`,
    "--global",
    "--yes",
  ], baseEnvironment);

  // beta3 requires every projected package to be approved at its installed
  // digest before the first link.
  oak(["approve", "@diego/simple-technical-writing", "--global"], baseEnvironment);
  oak(["approve", profile, "--global"], baseEnvironment);

  const claudeDirectory = join(home, ".claude");
  const claudeTarget = join(claudeDirectory, "CLAUDE.md");
  const claudeBackup = join(claudeDirectory, "CLAUDE.back.md");
  const claudeOriginal = "# Existing Claude instructions\n";
  await mkdir(claudeDirectory, { recursive: true });
  await writeFile(claudeTarget, claudeOriginal);

  oak(["link", profile, "--agent", "claude", "--global", "--yes"], baseEnvironment);
  await assertFile(claudeBackup, claudeOriginal);
  assert.match(await readFile(claudeTarget, "utf8"), /oakshelf:profile:start/);
  oak(["verify", "--global"], baseEnvironment);
  oak(["unlink", profile, "--agent", "claude", "--global", "--yes"], baseEnvironment);
  await assertFile(claudeTarget, claudeOriginal);

  const codexHome = join(home, ".codex-custom");
  const codexEnvironment = { ...baseEnvironment, CODEX_HOME: codexHome };
  const codexTarget = join(codexHome, "AGENTS.md");
  const codexBackup = join(codexHome, "AGENTS.back.md");
  const codexOriginal = "# Existing Codex instructions\n";
  await mkdir(codexHome, { recursive: true });
  await writeFile(codexTarget, codexOriginal);

  oak(["link", profile, "--agent", "codex", "--global", "--yes"], codexEnvironment);
  await assertFile(codexBackup, codexOriginal);
  assert.match(await readFile(codexTarget, "utf8"), /oakshelf:profile:start/);
  await readFile(join(
    home,
    ".codex",
    "skills",
    "diego-simple-technical-writing",
    "SKILL.md",
  ));
  oak(["verify", "--global"], codexEnvironment);
  oak(["unlink", profile, "--agent", "codex", "--global", "--yes"], codexEnvironment);
  await assertFile(codexTarget, codexOriginal);

  console.log("OK global profile links and backup restoration");
} finally {
  await rm(home, { recursive: true, force: true });
}
