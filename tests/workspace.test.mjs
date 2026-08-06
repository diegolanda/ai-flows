import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();

async function read(relativePath) {
  return readFile(resolve(root, relativePath), "utf8");
}

test("skill protects technical tokens", async () => {
  const skill = await read("packages/skills/simple-technical-writing/SKILL.md");
  for (const token of ["code blocks", "identifiers", "commands and flags", "quoted error messages"]) {
    assert.match(skill, new RegExp(token));
  }
});

test("skill defines procedural and descriptive limits", async () => {
  const skill = await read("packages/skills/simple-technical-writing/SKILL.md");
  assert.match(skill, /20 words or fewer/);
  assert.match(skill, /25 words or fewer/);
});

test("skill package metadata is aligned", async () => {
  const packageJson = JSON.parse(
    await read("packages/skills/simple-technical-writing/package.json"),
  );
  const manifest = JSON.parse(
    await read("packages/skills/simple-technical-writing/oakshelf.json"),
  );
  const skill = await read("packages/skills/simple-technical-writing/SKILL.md");

  assert.equal(packageJson.version, "0.0.2");
  assert.equal(manifest.version, "0.0.2");
  assert.equal(manifest.name, packageJson.name);
  assert.equal(manifest.entrypoints.skill, "./SKILL.md");
  assert.match(skill, /^name: diego-simple-technical-writing$/m);
  assert.doesNotMatch(skill, /^version:/m);
  assert.match(skill, /^  version: "0\.0\.2"$/m);
});

test("workflow consumes the skill", async () => {
  const packageJson = JSON.parse(
    await read("packages/workflows/development/package.json"),
  );
  const manifest = JSON.parse(
    await read("packages/workflows/development/oakshelf.json"),
  );
  assert.equal(
    packageJson.dependencies["@diego/simple-technical-writing"],
    "workspace:^",
  );
  assert.equal(packageJson.oakshelf.manifest, "./oakshelf.json");
  assert.equal(manifest.kind, "workflow");
  assert.equal(manifest.entrypoints.workflow, "./WORKFLOW.md");
  assert.equal(
    manifest.dependencies["@diego/simple-technical-writing"],
    "^0.0.2",
  );

  const workflow = await read("packages/workflows/development/WORKFLOW.md");
  assert.match(workflow, /@diego\/simple-technical-writing/);
});

test("development profile defines agent-specific instructions", async () => {
  const packageJson = JSON.parse(
    await read("packages/profiles/development/package.json"),
  );
  const manifest = JSON.parse(
    await read("packages/profiles/development/oakshelf.json"),
  );
  const claude = await read("packages/profiles/development/CLAUDE.md");
  const codex = await read("packages/profiles/development/AGENTS.md");

  assert.equal(packageJson.name, "@diego/development-profile");
  assert.equal(packageJson.version, "0.0.1");
  assert.equal(packageJson.dependencies["@diego/simple-technical-writing"], "workspace:^");
  assert.equal(manifest.kind, "profile");
  assert.equal(manifest.name, packageJson.name);
  assert.equal(manifest.version, packageJson.version);
  assert.equal(manifest.entrypoints.claude, "./CLAUDE.md");
  assert.equal(manifest.entrypoints.codex, "./AGENTS.md");
  assert.equal(manifest.dependencies["@diego/simple-technical-writing"], "^0.0.2");
  assert.match(claude, /^@~\/\.claude\/skills\/diego-simple-technical-writing\/SKILL\.md$/m);
  assert.match(codex, /read and follow `~\/\.codex\/skills\/diego-simple-technical-writing\/SKILL\.md`/);
  assert.match(claude, /Do not add co-author trailers/);
  assert.match(codex, /Do not add co-author trailers/);
});

test("evaluation cases are valid JSON and named", async () => {
  const evaluations = JSON.parse(
    await read("packages/skills/simple-technical-writing/evals/cases.json"),
  );
  assert.equal(evaluations.version, 1);
  assert.ok(evaluations.cases.length >= 4);
  assert.ok(evaluations.cases.every((item) => item.name && item.input && item.expect));
});
