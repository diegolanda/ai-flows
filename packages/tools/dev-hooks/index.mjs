import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as git from "@diego/git-repository";
import * as branchState from "@diego/branch-state";
import { runGates, validateGatesConfig } from "@diego/quality-gates";
import {
  findPullRequest,
  createPullRequest,
  updatePullRequestBody,
  getPullRequestBody,
  renderManagedBody,
  extractIntentHash,
  extractManagedSection,
  applySizeLabel,
} from "@diego/github-cli";

const DEFAULT_GATES = [
  { name: "Test", script: "test", required: true, skipIfMissing: true },
  { name: "Typecheck", script: "typecheck", required: true, skipIfMissing: true },
  { name: "Lint", script: "lint", required: true, skipIfMissing: true },
  { name: "Build", script: "build", required: true, skipIfMissing: true },
];

const noop = () => {};

const SEVERITIES = ["low", "medium", "high", "critical"];
const CONFIG_KEYS = ["workflow", "baseBranch", "review", "gates"];

/**
 * Validate a parsed repository config against the shape of
 * repository-config.schema.json. An unexpected field is a validation
 * failure, not silent data.
 */
function validateRepositoryConfig(parsed) {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("The repository config must be a JSON object.");
  }
  for (const key of Object.keys(parsed)) {
    if (!CONFIG_KEYS.includes(key)) {
      throw new Error(`The repository config has an unknown field "${key}".`);
    }
  }
  if (parsed.workflow !== "@diego/development") {
    throw new Error('The repository config field "workflow" must be "@diego/development".');
  }
  if (parsed.baseBranch !== undefined && typeof parsed.baseBranch !== "string") {
    throw new Error('The repository config field "baseBranch" must be a string.');
  }
  if (parsed.review !== undefined) {
    if (typeof parsed.review !== "object" || parsed.review === null || Array.isArray(parsed.review)) {
      throw new Error('The repository config field "review" must be an object.');
    }
    for (const key of Object.keys(parsed.review)) {
      if (key !== "failOn") {
        throw new Error(`The repository config field "review" has an unknown field "${key}".`);
      }
    }
    if (parsed.review.failOn !== undefined) {
      if (!Array.isArray(parsed.review.failOn) || parsed.review.failOn.some((s) => !SEVERITIES.includes(s))) {
        throw new Error(
          `The repository config field "review.failOn" must be an array of: ${SEVERITIES.join(", ")}.`,
        );
      }
    }
  }
}

export function loadConfig({ cwd } = {}) {
  const root = git.repoRoot({ cwd });
  const defaults = {
    workflow: "@diego/development",
    baseBranch: "auto",
    review: { failOn: ["high", "critical"] },
    gates: DEFAULT_GATES,
  };
  const configPath = join(root, ".oakshelf", "development.json");
  if (!existsSync(configPath)) return defaults;
  const parsed = JSON.parse(readFileSync(configPath, "utf8"));
  validateRepositoryConfig(parsed);
  const config = {
    workflow: parsed.workflow,
    baseBranch: parsed.baseBranch ?? defaults.baseBranch,
    review: { failOn: parsed.review?.failOn ?? defaults.review.failOn },
    gates: parsed.gates ?? defaults.gates,
  };
  validateGatesConfig(config.gates);
  return config;
}

/**
 * Strip the remote prefix from a detected base branch. detectBaseBranch can
 * return a remote-tracking name such as origin/main; GitHub and local
 * comparisons need the plain branch name.
 *
 * The prefix is hardcoded because detectBaseBranch only inspects origin.
 * If remote detection is ever generalized, change both functions together.
 */
export function localBaseName(base) {
  return base.replace(/^origin\//, "");
}

function baseRef(base, { cwd }) {
  try {
    git.aheadBehind(`origin/${base}`, { cwd });
    return `origin/${base}`;
  } catch {
    return base;
  }
}

function fail(stage, message, emit) {
  emit("stage.failed", { stage, durationMs: 0, message });
  return { stage, message };
}

export function preCommit() {
  return { status: "pass", failures: [] };
}

export function postCommit({ cwd } = {}) {
  try {
    if (branchState.readState({ cwd }) !== null) {
      branchState.markStale({ cwd });
    }
  } catch {
    // post-commit is informational and must never block.
  }
  return { status: "pass", failures: [] };
}

/**
 * Deterministic pre-push verification. Never invokes a model and never
 * mutates the repository. See PRD section 12.3.
 */
export async function prePush({ cwd, emit = noop } = {}) {
  const failures = [];
  const config = loadConfig({ cwd });

  emit("stage.started", { stage: "Branch" });
  try {
    git.currentBranch({ cwd });
    emit("stage.passed", { stage: "Branch" });
  } catch (error) {
    failures.push(
      fail("Branch", `${error.message} Check out a branch before pushing.`, emit),
    );
    emit("pipeline.completed", { status: "fail" });
    return { status: "fail", failures, gates: [] };
  }

  const base = localBaseName(git.detectBaseBranch({ cwd, configured: config.baseBranch }));
  const ref = baseRef(base, { cwd });

  emit("stage.started", { stage: "Base" });
  const { behind } = git.aheadBehind(ref, { cwd });
  if (behind > 0) {
    failures.push(
      fail(
        "Base",
        `Branch is ${behind} commits behind ${ref}. Ask the agent to run the delivery flow so the workflow can rebase before pushing.`,
        emit,
      ),
    );
  } else {
    emit("stage.passed", { stage: "Base" });
  }

  emit("stage.started", { stage: "Intent" });
  const state = branchState.readState({ cwd });
  if (state === null) {
    failures.push(
      fail(
        "Intent",
        "No original task intent is recorded for this branch. Provide the original purpose or explicitly approve an inferred intent before delivery.",
        emit,
      ),
    );
  } else {
    const freshness = branchState.checkFreshness({ cwd });
    if (!freshness.intentLocked) {
      failures.push(fail("Intent", "The intent is not locked. Approve it in the agent before delivery.", emit));
    } else {
      emit("stage.passed", { stage: "Intent" });
    }

    emit("stage.started", { stage: "Freshness" });
    const staleMessages = [];
    if (freshness.descriptionStale) {
      staleMessages.push(
        state.lastReviewedHead
          ? "The description is out of date for the current implementation."
          : "No description has been produced for this branch.",
      );
    }
    if (freshness.reviewStale || !freshness.reviewFreshForHead) {
      staleMessages.push(
        state.lastReviewedHead
          ? "HEAD changed after the last review."
          : "No review is recorded for this branch.",
      );
    }
    if (staleMessages.length > 0) {
      failures.push(
        fail(
          "Freshness",
          `${staleMessages.join(" ")} Ask the agent to run the delivery flow to refresh the stale artifacts.`,
          emit,
        ),
      );
    } else if (state.lastReviewStatus === "fail") {
      failures.push(fail("Freshness", "The last recorded review failed. Resolve the findings before pushing.", emit));
    } else {
      emit("stage.passed", { stage: "Freshness" });
    }
  }

  const gates = await runGates(config.gates, { cwd, emit });
  if (gates.status === "fail") {
    failures.push({ stage: "Gates", message: "A required gate failed." });
  }

  const status = failures.length === 0 ? "pass" : "fail";
  emit("pipeline.completed", { status });
  return { status, failures, gates: gates.results };
}

export async function gatesOnly({ cwd, emit = noop } = {}) {
  const config = loadConfig({ cwd });
  const result = await runGates(config.gates, { cwd, emit });
  emit("pipeline.completed", { status: result.status });
  return result;
}

function hexFromStoredHash(storedHash) {
  return storedHash.replace(/^sha256:/, "");
}

/**
 * Create or update the PR with managed Intent and Description sections.
 * The description text comes from the agent (stdin in the CLI); everything
 * else is deterministic.
 */
export function prSync({ cwd, title, description } = {}) {
  if (!description || description.trim() === "") {
    throw new Error("A description is required. Pass the description text on stdin.");
  }
  const state = branchState.readState({ cwd });
  if (state === null || !state.intentLocked) {
    throw new Error("No locked intent exists for this branch. Lock the intent before PR sync.");
  }
  const branch = git.currentBranch({ cwd });
  const config = loadConfig({ cwd });
  const base = localBaseName(git.detectBaseBranch({ cwd, configured: config.baseBranch }));

  const existing = findPullRequest(branch, { cwd });
  const body = renderManagedBody({
    intent: branchState.canonicalizeIntent(state.intent),
    intentHash: hexFromStoredHash(state.intentHash),
    description,
    existingBody: existing?.body ?? "",
  });

  let number;
  let url;
  if (existing) {
    updatePullRequestBody(existing.number, body, { cwd });
    number = existing.number;
    url = existing.url;
  } else {
    const fallbackTitle = branchState.canonicalizeIntent(state.intent).split("\n")[0];
    const created = createPullRequest({ title: title ?? fallbackTitle, body, base, head: branch }, { cwd });
    number = created.number;
    url = created.url;
  }
  branchState.setPullRequest({ cwd, number });

  // The size label is non-blocking. The PR number is recorded before the
  // label call, and a label failure is reported in the result instead of
  // failing an otherwise successful sync. The next pr-sync retries it.
  let sizeLabel = null;
  if (state.intentSize) {
    try {
      sizeLabel = applySizeLabel(number, state.intentSize, { cwd });
    } catch (error) {
      sizeLabel = { error: error.message };
    }
  }
  return { number, url, sizeLabel };
}

export function extractManagedIntent(body) {
  const section = extractManagedSection(body, "intent");
  if (section === null) return null;
  const lines = section.split("\n");
  const headingIndex = lines.findIndex((line) => /^##\s*Intent\s*$/.test(line.trim()));
  if (headingIndex !== -1) {
    lines.splice(headingIndex, 1);
  }
  const hashIndex = lines.findLastIndex((line) => line.trim().startsWith("<!-- oak:intent-sha256="));
  if (hashIndex !== -1) {
    lines.splice(hashIndex, 1);
  }
  return lines.join("\n");
}

/**
 * Deterministic CI verification (PRD section 20, without the model review):
 * confirm the PR body intent matches its recorded hash, then run the gates.
 *
 * Limitation: the recorded hash lives in the same PR body as the intent
 * text, so this check detects accidental or unilateral edits, not a
 * deliberate rewrite that also updates the hash comment. An authoritative
 * baseline outside the body is an open question in the PRD (section 24).
 */
export async function ciVerify({ cwd, prNumber, emit = noop, body } = {}) {
  const failures = [];
  emit("stage.started", { stage: "Intent integrity" });
  const prBody = body ?? getPullRequestBody(prNumber, { cwd });
  const recordedHex = extractIntentHash(prBody);
  const intentText = extractManagedIntent(prBody);
  if (!recordedHex || intentText === null) {
    failures.push(
      fail("Intent integrity", "The PR body has no managed intent section with a recorded hash.", emit),
    );
  } else {
    const actual = branchState.intentHash(intentText);
    if (actual !== `sha256:${recordedHex}`) {
      failures.push(
        fail(
          "Intent integrity",
          "The PR intent text does not match its recorded hash. The intent was changed outside the workflow.",
          emit,
        ),
      );
    } else {
      emit("stage.passed", { stage: "Intent integrity" });
    }
  }

  const config = loadConfig({ cwd });
  const gates = await runGates(config.gates, { cwd, emit });
  if (gates.status === "fail") {
    failures.push({ stage: "Gates", message: "A required gate failed." });
  }

  const status = failures.length === 0 ? "pass" : "fail";
  emit("pipeline.completed", { status });
  return { status, failures, gates: gates.results };
}

const HOOK_NAMES = ["pre-commit", "post-commit", "pre-push"];

function hookContent(name) {
  return `pnpm exec oakshelf-dev-hook ${name}\n`;
}

const STARTER_CONFIG = `${JSON.stringify(
  {
    workflow: "@diego/development",
    baseBranch: "auto",
    review: { failOn: ["high", "critical"] },
    gates: DEFAULT_GATES,
  },
  null,
  2,
)}\n`;

/**
 * Plan or apply the repository adapter files (PRD sections 13 and 21 Phase 5).
 * Without write, this only returns the plan. With write, it creates missing
 * files and updates hooks whose content differs, but never touches a file
 * whose planned action is keep.
 */
export function setup({ cwd, write = false } = {}) {
  const root = git.repoRoot({ cwd });
  const entries = [];

  for (const name of HOOK_NAMES) {
    const path = join(root, ".husky", name);
    const proposed = hookContent(name);
    if (!existsSync(path)) {
      entries.push({ path, action: "create", proposed });
    } else if (readFileSync(path, "utf8") === proposed) {
      entries.push({ path, action: "keep" });
    } else {
      entries.push({ path, action: "update", current: readFileSync(path, "utf8"), proposed });
    }
  }

  const configPath = join(root, ".oakshelf", "development.json");
  if (!existsSync(configPath)) {
    entries.push({ path: configPath, action: "create", proposed: STARTER_CONFIG });
  } else {
    entries.push({ path: configPath, action: "keep" });
  }

  if (write) {
    for (const entry of entries) {
      if (entry.action === "keep") continue;
      mkdirSync(dirname(entry.path), { recursive: true });
      const isHook = HOOK_NAMES.some((name) => entry.path.endsWith(`.husky/${name}`));
      writeFileSync(entry.path, entry.proposed, isHook ? { mode: 0o755 } : undefined);
    }
  }

  return { applied: write, entries };
}
