import fs from 'node:fs';
import path from 'node:path';

import { currentBranch, headSha } from './lib/git.mjs';
import { canonicalizeIntent, intentHash } from './lib/intent.mjs';
import { statePath } from './lib/paths.mjs';
import { validateState } from './lib/validate.mjs';

export { canonicalizeIntent, intentHash };

const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/;

function resolveCwd(cwd) {
  return cwd || process.cwd();
}

function resolveBranch(cwd, branch) {
  return branch || currentBranch(cwd);
}

function fileFor(cwd, branch) {
  return statePath(cwd, branch);
}

function readStateFile(file) {
  if (!fs.existsSync(file)) {
    return null;
  }
  const raw = fs.readFileSync(file, 'utf8');
  const state = JSON.parse(raw);
  validateState(state);
  return state;
}

function writeStateFile(file, state) {
  validateState(state);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`);
}

function loadExistingState(cwd, branch, file) {
  const state = readStateFile(file);
  if (state === null) {
    throw new Error(`Branch state not found for branch "${branch}". Run init first.`);
  }
  return state;
}

/**
 * Read the branch state, or null when no state file exists yet.
 *
 * @param {{cwd?: string, branch?: string}} [options]
 * @returns {object|null}
 */
export function readState(options = {}) {
  const cwd = resolveCwd(options.cwd);
  const branch = resolveBranch(cwd, options.branch);
  const file = fileFor(cwd, branch);
  return readStateFile(file);
}

/**
 * Create the branch state file. Throws when a state file already exists.
 *
 * @param {{cwd?: string, branch?: string, baseBranch: string, rawIntent: string}} options
 * @returns {object}
 */
export function initState(options = {}) {
  const cwd = resolveCwd(options.cwd);
  const branch = resolveBranch(cwd, options.branch);
  const { baseBranch, rawIntent } = options;

  if (typeof baseBranch !== 'string' || baseBranch.length === 0) {
    throw new Error('baseBranch is required');
  }
  if (typeof rawIntent !== 'string' || rawIntent.length === 0) {
    throw new Error('rawIntent is required');
  }

  const file = fileFor(cwd, branch);
  if (fs.existsSync(file)) {
    throw new Error(`Branch state already exists for branch "${branch}"`);
  }

  const state = {
    version: 1,
    branch,
    baseBranch,
    rawIntent,
    intent: null,
    intentHash: null,
    intentLocked: false,
    descriptionStale: true,
    reviewStale: true,
  };

  writeStateFile(file, state);
  return state;
}

/**
 * Store the normalized intent. Only allowed while the intent is not locked.
 *
 * @param {{cwd?: string, branch?: string, intent: string}} options
 * @returns {object}
 */
export function setIntent(options = {}) {
  const cwd = resolveCwd(options.cwd);
  const branch = resolveBranch(cwd, options.branch);
  const file = fileFor(cwd, branch);
  const state = loadExistingState(cwd, branch, file);

  if (state.intentLocked) {
    throw new Error('Cannot set intent: intent is locked. Use editIntent instead.');
  }
  if (typeof options.intent !== 'string' || options.intent.trim().length === 0) {
    throw new Error('intent must be a non-empty string');
  }

  state.intent = canonicalizeIntent(options.intent);
  writeStateFile(file, state);
  return state;
}

/**
 * Lock the stored intent. Computes its hash and records the approval timestamp.
 * Requires an intent to have been set with setIntent first.
 *
 * @param {{cwd?: string, branch?: string}} [options]
 * @returns {object}
 */
export function lockIntent(options = {}) {
  const cwd = resolveCwd(options.cwd);
  const branch = resolveBranch(cwd, options.branch);
  const file = fileFor(cwd, branch);
  const state = loadExistingState(cwd, branch, file);

  if (state.intentLocked) {
    throw new Error('Intent is already locked');
  }
  if (!state.intent) {
    throw new Error('Cannot lock intent: no intent has been set');
  }

  state.intentHash = intentHash(state.intent);
  state.intentLocked = true;
  state.intentApprovedAt = new Date().toISOString();

  writeStateFile(file, state);
  return state;
}

/**
 * Replace a locked intent with a new one. Requires a non-empty reason.
 * Keeps the intent locked, recomputes the hash, and marks description and
 * review stale.
 *
 * @param {{cwd?: string, branch?: string, intent: string, reason: string}} options
 * @returns {object}
 */
export function editIntent(options = {}) {
  const cwd = resolveCwd(options.cwd);
  const branch = resolveBranch(cwd, options.branch);
  const file = fileFor(cwd, branch);
  const state = loadExistingState(cwd, branch, file);

  if (!state.intentLocked) {
    throw new Error('Cannot edit intent: intent is not locked. Use setIntent instead.');
  }
  if (typeof options.reason !== 'string' || options.reason.trim().length === 0) {
    throw new Error('reason is required to edit a locked intent');
  }
  if (typeof options.intent !== 'string' || options.intent.trim().length === 0) {
    throw new Error('intent must be a non-empty string');
  }

  const normalized = canonicalizeIntent(options.intent);
  state.intent = normalized;
  state.intentHash = intentHash(normalized);
  state.intentApprovedAt = new Date().toISOString();
  state.descriptionStale = true;
  state.reviewStale = true;

  writeStateFile(file, state);
  return state;
}

/**
 * Mark both description and review as stale.
 *
 * @param {{cwd?: string, branch?: string}} [options]
 * @returns {object}
 */
export function markStale(options = {}) {
  const cwd = resolveCwd(options.cwd);
  const branch = resolveBranch(cwd, options.branch);
  const file = fileFor(cwd, branch);
  const state = loadExistingState(cwd, branch, file);

  state.descriptionStale = true;
  state.reviewStale = true;

  writeStateFile(file, state);
  return state;
}

/**
 * Record that the PR description was written for the current intent.
 *
 * @param {{cwd?: string, branch?: string}} [options]
 * @returns {object}
 */
export function recordDescription(options = {}) {
  const cwd = resolveCwd(options.cwd);
  const branch = resolveBranch(cwd, options.branch);
  const file = fileFor(cwd, branch);
  const state = loadExistingState(cwd, branch, file);

  state.descriptionStale = false;

  writeStateFile(file, state);
  return state;
}

/**
 * Record the result of a review for a specific commit.
 * A review result is valid only for the commit it evaluated.
 *
 * @param {{cwd?: string, branch?: string, headSha: string, status: 'pass'|'fail'}} options
 * @returns {object}
 */
export function recordReview(options = {}) {
  const cwd = resolveCwd(options.cwd);
  const branch = resolveBranch(cwd, options.branch);
  const file = fileFor(cwd, branch);
  const state = loadExistingState(cwd, branch, file);

  if (typeof options.headSha !== 'string' || !COMMIT_SHA_PATTERN.test(options.headSha)) {
    throw new Error('headSha must be a 40-character lowercase hex commit SHA');
  }
  if (options.status !== 'pass' && options.status !== 'fail') {
    throw new Error('status must be "pass" or "fail"');
  }

  state.reviewStale = false;
  state.lastReviewedHead = options.headSha;
  state.lastReviewStatus = options.status;

  writeStateFile(file, state);
  return state;
}

/**
 * Report the current freshness of the branch state relative to HEAD.
 * The review is stale both when the state marks it stale and when HEAD has
 * moved past the last reviewed commit.
 *
 * @param {{cwd?: string, branch?: string}} [options]
 * @returns {{intentLocked: boolean, descriptionStale: boolean, reviewStale: boolean, reviewFreshForHead: boolean}}
 */
export function checkFreshness(options = {}) {
  const cwd = resolveCwd(options.cwd);
  const branch = resolveBranch(cwd, options.branch);
  const file = fileFor(cwd, branch);
  const state = loadExistingState(cwd, branch, file);

  const head = headSha(cwd);
  const reviewFreshForHead = state.lastReviewedHead === head;
  const reviewStale = Boolean(state.reviewStale) || !reviewFreshForHead;

  return {
    intentLocked: state.intentLocked,
    descriptionStale: state.descriptionStale,
    reviewStale,
    reviewFreshForHead,
  };
}

/**
 * Record the pull request number for this branch.
 *
 * @param {{cwd?: string, branch?: string, number: number}} options
 * @returns {object}
 */
export function setPullRequest(options = {}) {
  const cwd = resolveCwd(options.cwd);
  const branch = resolveBranch(cwd, options.branch);
  const file = fileFor(cwd, branch);
  const state = loadExistingState(cwd, branch, file);

  if (!Number.isInteger(options.number) || options.number < 1) {
    throw new Error('number must be an integer greater than or equal to 1');
  }

  state.pullRequest = options.number;

  writeStateFile(file, state);
  return state;
}
