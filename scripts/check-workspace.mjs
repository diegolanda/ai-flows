import { readFile, access } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const required = [
  "pnpm-workspace.yaml",
  "packages/skills/simple-technical-writing/package.json",
  "packages/skills/simple-technical-writing/oakshelf.json",
  "packages/skills/simple-technical-writing/SKILL.md",
  "packages/profiles/development/package.json",
  "packages/profiles/development/oakshelf.json",
  "packages/profiles/development/CLAUDE.md",
  "packages/profiles/development/AGENTS.md",
  "packages/workflows/development/package.json",
  "packages/workflows/development/oakshelf.json",
  "packages/workflows/development/WORKFLOW.md"
];

await Promise.all(required.map((file) => access(resolve(root, file))));

const skill = JSON.parse(
  await readFile(
    resolve(root, "packages/skills/simple-technical-writing/package.json"),
    "utf8",
  ),
);
const workflow = JSON.parse(
  await readFile(
    resolve(root, "packages/workflows/development/package.json"),
    "utf8",
  ),
);
const profile = JSON.parse(
  await readFile(
    resolve(root, "packages/profiles/development/package.json"),
    "utf8",
  ),
);

if (skill.name !== "@diego/simple-technical-writing") {
  throw new Error("Unexpected skill package name.");
}

if (workflow.name !== "@diego/development") {
  throw new Error("Unexpected workflow package name.");
}

if (profile.name !== "@diego/development-profile") {
  throw new Error("Unexpected profile package name.");
}

if (profile.dependencies?.[skill.name] !== "workspace:~") {
  throw new Error("The development profile must use the local skill through workspace:~.");
}

if (workflow.dependencies?.[skill.name] !== "workspace:^") {
  throw new Error("The development workflow must use the local skill through workspace:^.");
}

console.log("OK workspace structure");
