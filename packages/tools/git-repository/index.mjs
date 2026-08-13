// @diego/git-repository
//
// Deterministic Git inspection and mutation helpers for the @diego/development
// workflow. Every export is synchronous and takes an optional { cwd } option.
// No function swallows stderr. A failing git command always throws an Error
// that includes the command and its stderr.

import { spawnSync } from 'node:child_process';

const MAX_BUFFER = 64 * 1024 * 1024;

function formatFailure(args, status, stderr) {
  const command = `git ${args.join(' ')}`;
  const trimmedStderr = (stderr || '').trim();
  if (trimmedStderr) {
    return `${command} failed with exit code ${status}.\n${trimmedStderr}`;
  }
  return `${command} failed with exit code ${status}.`;
}

// Runs git and returns trimmed stdout. Throws on a non-zero exit code or a
// spawn failure. Use this for single-value output such as a ref or a sha.
function run(args, { cwd } = {}) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: MAX_BUFFER });
  if (result.error) {
    throw new Error(`git ${args.join(' ')} failed to start.\n${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(formatFailure(args, result.status, result.stderr));
  }
  return (result.stdout || '').trim();
}

// Runs git and returns raw stdout, without trimming. Use this when the exact
// text matters, for example a diff or a multi-line log.
function runRaw(args, { cwd } = {}) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: MAX_BUFFER });
  if (result.error) {
    throw new Error(`git ${args.join(' ')} failed to start.\n${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(formatFailure(args, result.status, result.stderr));
  }
  return result.stdout || '';
}

// Runs git and returns true only on a zero exit code. Use this for existence
// checks where a non-zero exit code is an expected outcome, not a failure.
function runQuiet(args, { cwd } = {}) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: MAX_BUFFER });
  return result.status === 0;
}

// Same as runQuiet, but returns trimmed stdout on success and null on a
// non-zero exit code.
function tryRun(args, { cwd } = {}) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: MAX_BUFFER });
  if (result.status === 0) {
    return (result.stdout || '').trim();
  }
  return null;
}

// Returns the absolute path to the repository root.
export function repoRoot({ cwd } = {}) {
  return run(['rev-parse', '--show-toplevel'], { cwd });
}

// Returns the absolute path to the Git directory. Works inside a linked
// worktree, where the top-level ".git" is a file, not a directory.
export function gitDir({ cwd } = {}) {
  return run(['rev-parse', '--absolute-git-dir'], { cwd });
}

// Returns the name of the current branch. Throws a clear error on detached
// HEAD, because a detached HEAD has no branch name.
export function currentBranch({ cwd } = {}) {
  const branch = tryRun(['symbolic-ref', '--quiet', '--short', 'HEAD'], { cwd });
  if (branch === null) {
    throw new Error(
      'Cannot determine the current branch. HEAD is detached. Check out a branch before running this command.'
    );
  }
  return branch;
}

// Detects the base branch for the repository.
//
// If `configured` is set and is not "auto", the function returns it
// unchanged. Otherwise it detects the base branch in this order:
//
// 1. The `origin/HEAD` symbolic ref.
// 2. A local or remote branch named "main".
// 3. A local or remote branch named "master".
//
// Throws when none of these exist.
export function detectBaseBranch({ cwd, configured } = {}) {
  if (configured && configured !== 'auto') {
    return configured;
  }

  const originHead = tryRun(['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'], { cwd });
  if (originHead) {
    return originHead;
  }

  for (const name of ['main', 'master']) {
    if (runQuiet(['show-ref', '--verify', '--quiet', `refs/heads/${name}`], { cwd })) {
      return name;
    }
    if (runQuiet(['show-ref', '--verify', '--quiet', `refs/remotes/origin/${name}`], { cwd })) {
      return `origin/${name}`;
    }
  }

  throw new Error(
    'Cannot detect the base branch. No origin/HEAD symbolic ref exists, and neither main nor master exists locally or on origin. Set baseBranch explicitly in the repository configuration.'
  );
}

// Fetches refs from the given remote. Defaults to "origin".
export function fetchRemote({ cwd, remote = 'origin' } = {}) {
  run(['fetch', remote], { cwd });
}

// Returns how many commits HEAD is ahead of and behind `base`.
export function aheadBehind(base, { cwd } = {}) {
  const output = run(['rev-list', '--left-right', '--count', `${base}...HEAD`], { cwd });
  const [behind, ahead] = output.split(/\s+/).map(Number);
  return { ahead, behind };
}

// Returns the diff between `base` and HEAD, using the same three-dot range
// that GitHub uses to render a pull request diff.
export function diffAgainst(base, { cwd } = {}) {
  return runRaw(['diff', `${base}...HEAD`], { cwd });
}

// Returns the commits reachable from HEAD but not from `base`, oldest first
// omitted, in `git log` order (newest first). Each entry has a `sha` and a
// `subject`.
export function listCommits(base, { cwd } = {}) {
  const output = runRaw(['log', `${base}..HEAD`, '--format=%H%x1f%s'], { cwd }).trim();
  if (!output) {
    return [];
  }
  return output.split('\n').map((line) => {
    const [sha, subject] = line.split('\x1f');
    return { sha, subject };
  });
}

// Returns true when the working tree has uncommitted changes, staged or
// unstaged.
export function isDirty({ cwd } = {}) {
  return run(['status', '--porcelain'], { cwd }).length > 0;
}

// Returns the 40-character sha of HEAD.
export function headSha({ cwd } = {}) {
  return run(['rev-parse', 'HEAD'], { cwd });
}

// Rebases the current branch onto `base`.
//
// Throws unless `allowRebase` is exactly `true`. This flag exists so that
// hook code can never trigger a rebase. Only the mutation-safe delivery
// command may pass `allowRebase: true`.
//
// On conflict, aborts the rebase and throws a clear error. The working tree
// is left in the state it was in before the rebase started.
export function rebaseOnto(base, { cwd, allowRebase } = {}) {
  if (allowRebase !== true) {
    throw new Error(
      'rebaseOnto refused to run because allowRebase is not true. Git hooks must never rebase. Only the mutation-safe delivery command may pass allowRebase: true.'
    );
  }

  const result = spawnSync('git', ['rebase', base], { cwd, encoding: 'utf8', maxBuffer: MAX_BUFFER });
  if (result.error) {
    throw new Error(`git rebase ${base} failed to start.\n${result.error.message}`);
  }
  if (result.status !== 0) {
    const abort = spawnSync('git', ['rebase', '--abort'], { cwd, encoding: 'utf8', maxBuffer: MAX_BUFFER });
    const abortNote =
      abort.status === 0
        ? 'The rebase was aborted. The branch is back to its pre-rebase state.'
        : 'An attempt to abort the rebase also failed. Check the working tree manually.';
    const stderr = (result.stderr || '').trim();
    const stdout = (result.stdout || '').trim();
    const details = [stderr, stdout].filter(Boolean).join('\n');
    throw new Error(`git rebase ${base} failed with exit code ${result.status}. ${abortNote}\n${details}`);
  }
}
