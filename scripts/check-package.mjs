import { readFile, access } from "node:fs/promises";
import { resolve } from "node:path";

const [packagePath = ".", expectedKind] = process.argv.slice(2);
const root = resolve(process.cwd(), packagePath);

const packageJson = JSON.parse(
  await readFile(resolve(root, "package.json"), "utf8"),
);

if (!packageJson.name?.startsWith("@diego/")) {
  throw new Error(`${packageJson.name ?? "Unknown package"} must use the @diego scope.`);
}

if (packageJson.oakshelf?.kind !== expectedKind) {
  throw new Error(
    `${packageJson.name} must declare oakshelf.kind as ${expectedKind}.`,
  );
}

const manifestPath = resolve(root, packageJson.oakshelf.manifest);
await access(manifestPath);
const manifestText = await readFile(manifestPath, "utf8");

if (packageJson.oakshelf.manifest.endsWith(".json")) {
  const manifest = JSON.parse(manifestText);
  const expected = {
    schemaVersion: 1,
    name: packageJson.name,
    version: packageJson.version,
    kind: expectedKind,
  };

  for (const [key, value] of Object.entries(expected)) {
    if (manifest[key] !== value) {
      throw new Error(
        `${packageJson.name} manifest ${key} must be ${JSON.stringify(value)}.`,
      );
    }
  }

  if (expectedKind === "skill" && manifest.entrypoints?.skill !== "./SKILL.md") {
    throw new Error(`${packageJson.name} has an invalid skill entrypoint.`);
  }

  if (
    expectedKind === "workflow" &&
    manifest.entrypoints?.workflow !== "./WORKFLOW.md"
  ) {
    throw new Error(`${packageJson.name} has an invalid workflow entrypoint.`);
  }

  if (
    expectedKind === "profile" &&
    (manifest.entrypoints?.claude !== "./CLAUDE.md" ||
      manifest.entrypoints?.codex !== "./AGENTS.md")
  ) {
    throw new Error(`${packageJson.name} has invalid profile entrypoints.`);
  }

  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error(`${packageJson.name} manifest must declare files.`);
  }
} else {
  throw new Error(`${packageJson.name} must use an oakshelf.json manifest.`);
}

console.log(`OK ${packageJson.name}`);
