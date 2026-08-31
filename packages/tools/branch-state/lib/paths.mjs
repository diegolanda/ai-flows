import fs from 'node:fs';
import path from 'node:path';
import { gitCommonDir, gitDir } from './git.mjs';

/**
 * Convert a branch name to a collision-safe file identifier.
 *
 * @param {string} branch
 * @returns {string}
 */
export function branchSafeId(branch) {
  return encodeURIComponent(branch);
}

function legacyBranchSafeId(branch) {
  return branch.replace(/[^A-Za-z0-9._-]/g, '-');
}

/**
 * Resolve the absolute path of the state file for `branch` at `cwd`.
 * State is shared by linked worktrees through the common Git directory.
 *
 * @param {string} cwd
 * @param {string} branch
 * @returns {string}
 */
export function statePath(cwd, branch) {
  const dir = gitCommonDir(cwd);
  return path.join(dir, 'oakshelf', 'development', `${branchSafeId(branch)}.json`);
}

/**
 * Find paths used by releases that stored state in each worktree Git directory.
 *
 * @param {string} cwd
 * @param {string} branch
 * @returns {string[]}
 */
export function legacyStatePaths(cwd, branch) {
  const commonDir = gitCommonDir(cwd);
  const legacyName = `${legacyBranchSafeId(branch)}.json`;
  const gitDirs = new Set([gitDir(cwd), commonDir]);
  const worktreesDir = path.join(commonDir, 'worktrees');

  if (fs.existsSync(worktreesDir)) {
    for (const entry of fs.readdirSync(worktreesDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        gitDirs.add(path.join(worktreesDir, entry.name));
      }
    }
  }

  return [...gitDirs].map((dir) => path.join(dir, 'oakshelf', 'development', legacyName));
}
