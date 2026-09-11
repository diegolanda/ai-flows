import { accessSync, constants } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const AI_FLOWS_ROOT_ENV = "DIEGO_AI_FLOWS_ROOT";

const TOOL_CANDIDATES = {
  branchState: [
    ["ai-flows root linked binary", "node_modules/.bin/diego-branch-state"],
    ["ai-flows source entrypoint", "packages/tools/branch-state/bin.mjs"],
  ],
  devHook: [
    ["ai-flows root linked binary", "node_modules/.bin/diego-dev-hook"],
    ["ai-flows source entrypoint", "packages/tools/dev-hooks/bin.mjs"],
  ],
};

const DEV_HOOK_PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RESOLVER_PACKAGE_CANDIDATES = {
  branchState: ["resolver package dependency", resolveDependencyExecutable("@diego/branch-state")],
  devHook: ["resolver package entrypoint", resolve(DEV_HOOK_PACKAGE_ROOT, "bin.mjs")],
};

function resolveDependencyExecutable(specifier) {
  try {
    return resolve(dirname(fileURLToPath(import.meta.resolve(specifier))), "bin.mjs");
  } catch {
    return resolve(DEV_HOOK_PACKAGE_ROOT, `../${specifier.replace("@diego/", "")}/bin.mjs`);
  }
}

export class ToolResolutionError extends Error {
  constructor(message, { attempted, nextAction }) {
    super(message);
    this.name = "ToolResolutionError";
    this.attempted = attempted;
    this.nextAction = nextAction;
  }
}

function isExecutable(path) {
  try {
    accessSync(path, constants.F_OK | constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveExecutable(name, root, attempted) {
  for (const [method, relativePath] of TOOL_CANDIDATES[name]) {
    const path = resolve(root, relativePath);
    const found = isExecutable(path);
    attempted.push({ tool: name, method, path, result: found ? "found" : "not found" });
    if (found) return path;
  }
  return null;
}

function resolvePackageExecutable(name, attempted) {
  const [method, path] = RESOLVER_PACKAGE_CANDIDATES[name];
  const found = isExecutable(path);
  attempted.push({ tool: name, method, path, result: found ? "found" : "not found" });
  return found ? path : null;
}

function resolverPackageRoot() {
  const sourceSuffix = join("packages", "tools", "dev-hooks");
  if (DEV_HOOK_PACKAGE_ROOT.endsWith(sourceSuffix)) {
    return resolve(DEV_HOOK_PACKAGE_ROOT, "../../..");
  }

  const nodeModulesMarker = `${sep}node_modules${sep}`;
  const nodeModulesIndex = DEV_HOOK_PACKAGE_ROOT.indexOf(nodeModulesMarker);
  if (nodeModulesIndex !== -1) {
    return DEV_HOOK_PACKAGE_ROOT.slice(0, nodeModulesIndex);
  }

  return DEV_HOOK_PACKAGE_ROOT;
}

function resolveFromRoot(root, attempted) {
  const absoluteRoot = resolve(root);
  const branchState = resolveExecutable("branchState", absoluteRoot, attempted);
  const devHook = resolveExecutable("devHook", absoluteRoot, attempted);
  if (!branchState || !devHook) return null;
  return { root: absoluteRoot, branchState, devHook };
}

export function resolveDevelopmentTools({ root, envRoot = process.env[AI_FLOWS_ROOT_ENV] } = {}) {
  const attempted = [];
  const nextAction = `Set ${AI_FLOWS_ROOT_ENV} to the ai-flows checkout path, then run the resolver again.`;

  const branchState = resolvePackageExecutable("branchState", attempted);
  const devHook = resolvePackageExecutable("devHook", attempted);
  if (branchState && devHook) {
    return { root: resolverPackageRoot(), branchState, devHook, attempted };
  }

  const roots = [...new Set([envRoot, root].filter(Boolean).map((candidate) => resolve(candidate)))];
  if (roots.length === 0) {
    attempted.push({
      tool: "all",
      method: AI_FLOWS_ROOT_ENV,
      result: "not configured",
    });
    throw new ToolResolutionError("The ai-flows checkout path is not configured.", {
      attempted,
      nextAction,
    });
  }

  for (const candidateRoot of roots) {
    const resolution = resolveFromRoot(candidateRoot, attempted);
    if (resolution) return { ...resolution, attempted };
  }

  throw new ToolResolutionError("The configured ai-flows checkout does not contain all required tools.", {
    attempted,
    nextAction,
  });
}
