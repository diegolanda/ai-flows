import path from 'node:path';
import { gitDir } from './git.mjs';

/**
 * Convert a branch name to a branch-safe file identifier.
 * Every character outside [A-Za-z0-9._-] becomes "-".
 *
 * @param {string} branch
 * @returns {string}
 */
export function branchSafeId(branch) {
  return branch.replace(/[^A-Za-z0-9._-]/g, '-');
}

/**
 * Resolve the absolute path of the state file for `branch` at `cwd`.
 * Worktree-safe: resolves through `git rev-parse --absolute-git-dir`.
 *
 * @param {string} cwd
 * @param {string} branch
 * @returns {string}
 */
export function statePath(cwd, branch) {
  const dir = gitDir(cwd);
  return path.join(dir, 'oakshelf', 'development', `${branchSafeId(branch)}.json`);
}
