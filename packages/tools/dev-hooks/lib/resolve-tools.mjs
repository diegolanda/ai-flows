import { accessSync, constants } from "node:fs";
import { resolve } from "node:path";

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

export function resolveDevelopmentTools({ root = process.env[AI_FLOWS_ROOT_ENV] } = {}) {
  const attempted = [];
  const nextAction = `Set ${AI_FLOWS_ROOT_ENV} to the ai-flows checkout path, then run the resolver again.`;

  if (!root) {
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

  const absoluteRoot = resolve(root);
  const branchState = resolveExecutable("branchState", absoluteRoot, attempted);
  const devHook = resolveExecutable("devHook", absoluteRoot, attempted);

  if (!branchState || !devHook) {
    throw new ToolResolutionError("The configured ai-flows checkout does not contain all required tools.", {
      attempted,
      nextAction,
    });
  }

  return { root: absoluteRoot, branchState, devHook, attempted };
}
