import { execFileSync } from 'node:child_process';

/**
 * Run a git command in the given working directory and return trimmed stdout.
 *
 * @param {string[]} args
 * @param {string} cwd
 * @returns {string}
 */
function runGit(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  } catch (error) {
    throw new Error(`git ${args.join(' ')} failed: ${error.message}`);
  }
}

/**
 * Resolve the absolute git directory for the repository at `cwd`.
 * Worktree-safe: works for linked worktrees, where `.git` is a file.
 *
 * @param {string} cwd
 * @returns {string}
 */
export function gitDir(cwd) {
  return runGit(['rev-parse', '--absolute-git-dir'], cwd);
}

/**
 * Resolve the current branch name at `cwd`.
 * Throws when HEAD is detached, because there is no branch state to address.
 *
 * @param {string} cwd
 * @returns {string}
 */
export function currentBranch(cwd) {
  const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
  if (branch === 'HEAD') {
    throw new Error('Cannot determine branch: HEAD is detached');
  }
  return branch;
}

/**
 * Resolve the full SHA of HEAD at `cwd`.
 *
 * @param {string} cwd
 * @returns {string}
 */
export function headSha(cwd) {
  return runGit(['rev-parse', 'HEAD'], cwd);
}
