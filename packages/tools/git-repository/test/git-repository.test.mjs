import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, appendFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  repoRoot,
  gitDir,
  currentBranch,
  detectBaseBranch,
  aheadBehind,
  diffAgainst,
  listCommits,
  isDirty,
  headSha,
  rebaseOnto,
} from '../index.mjs';

// Runs a git command in the given repository during test setup. Throws with
// the command and stderr on failure, so a broken fixture fails loudly.
function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`test setup: git ${args.join(' ')} failed.\n${(result.stderr || '').trim()}`);
  }
  return (result.stdout || '').trim();
}

// Creates a temporary Git repository with a local identity, an initial
// branch, and one commit. Returns the repository path.
function createRepo({ branch = 'main' } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'git-repository-test-'));
  git(dir, ['init', '--initial-branch', branch]);
  git(dir, ['config', 'user.name', 'Test User']);
  git(dir, ['config', 'user.email', 'test@example.com']);
  writeFileSync(join(dir, 'README.md'), 'initial\n');
  git(dir, ['add', 'README.md']);
  git(dir, ['commit', '-m', 'Initial commit']);
  return dir;
}

function removeRepo(dir) {
  rmSync(dir, { recursive: true, force: true });
}

test('currentBranch returns the checked-out branch name', () => {
  const dir = createRepo();
  try {
    assert.equal(currentBranch({ cwd: dir }), 'main');
  } finally {
    removeRepo(dir);
  }
});

test('currentBranch throws a clear error on detached HEAD', () => {
  const dir = createRepo();
  try {
    const sha = headSha({ cwd: dir });
    git(dir, ['checkout', sha]);
    assert.throws(() => currentBranch({ cwd: dir }), /detached/i);
  } finally {
    removeRepo(dir);
  }
});

test('detectBaseBranch returns the configured value when set and not "auto"', () => {
  const dir = createRepo();
  try {
    assert.equal(detectBaseBranch({ cwd: dir, configured: 'develop' }), 'develop');
  } finally {
    removeRepo(dir);
  }
});

test('detectBaseBranch falls back to a local "main" branch', () => {
  const dir = createRepo({ branch: 'main' });
  try {
    assert.equal(detectBaseBranch({ cwd: dir }), 'main');
    assert.equal(detectBaseBranch({ cwd: dir, configured: 'auto' }), 'main');
  } finally {
    removeRepo(dir);
  }
});

test('detectBaseBranch falls back to a local "master" branch when main is absent', () => {
  const dir = createRepo({ branch: 'master' });
  try {
    assert.equal(detectBaseBranch({ cwd: dir }), 'master');
  } finally {
    removeRepo(dir);
  }
});

test('detectBaseBranch throws when neither main nor master exists', () => {
  const dir = createRepo({ branch: 'trunk' });
  try {
    assert.throws(() => detectBaseBranch({ cwd: dir }), /cannot detect the base branch/i);
  } finally {
    removeRepo(dir);
  }
});

test('aheadBehind reports the divergence between a feature branch and its base', () => {
  const dir = createRepo();
  try {
    git(dir, ['checkout', '-b', 'feature']);
    writeFileSync(join(dir, 'feature.txt'), 'feature work\n');
    git(dir, ['add', 'feature.txt']);
    git(dir, ['commit', '-m', 'Add feature file']);

    git(dir, ['checkout', 'main']);
    writeFileSync(join(dir, 'base.txt'), 'base work\n');
    git(dir, ['add', 'base.txt']);
    git(dir, ['commit', '-m', 'Add base file']);

    git(dir, ['checkout', 'feature']);
    const result = aheadBehind('main', { cwd: dir });
    assert.deepEqual(result, { ahead: 1, behind: 1 });
  } finally {
    removeRepo(dir);
  }
});

test('listCommits returns the commits unique to the current branch', () => {
  const dir = createRepo();
  try {
    git(dir, ['checkout', '-b', 'feature']);
    writeFileSync(join(dir, 'a.txt'), 'a\n');
    git(dir, ['add', 'a.txt']);
    git(dir, ['commit', '-m', 'Add a']);
    writeFileSync(join(dir, 'b.txt'), 'b\n');
    git(dir, ['add', 'b.txt']);
    git(dir, ['commit', '-m', 'Add b']);

    const commits = listCommits('main', { cwd: dir });
    assert.equal(commits.length, 2);
    assert.equal(commits[0].subject, 'Add b');
    assert.equal(commits[1].subject, 'Add a');
    assert.match(commits[0].sha, /^[0-9a-f]{40}$/);
  } finally {
    removeRepo(dir);
  }
});

test('isDirty reflects uncommitted changes', () => {
  const dir = createRepo();
  try {
    assert.equal(isDirty({ cwd: dir }), false);
    appendFileSync(join(dir, 'README.md'), 'more text\n');
    assert.equal(isDirty({ cwd: dir }), true);
  } finally {
    removeRepo(dir);
  }
});

test('diffAgainst returns the diff between base and HEAD', () => {
  const dir = createRepo();
  try {
    git(dir, ['checkout', '-b', 'feature']);
    writeFileSync(join(dir, 'feature.txt'), 'feature content\n');
    git(dir, ['add', 'feature.txt']);
    git(dir, ['commit', '-m', 'Add feature file']);

    const diff = diffAgainst('main', { cwd: dir });
    assert.match(diff, /feature\.txt/);
    assert.match(diff, /feature content/);
  } finally {
    removeRepo(dir);
  }
});

test('rebaseOnto rebases the current branch when allowRebase is true', () => {
  const dir = createRepo();
  try {
    git(dir, ['checkout', '-b', 'feature']);
    writeFileSync(join(dir, 'feature.txt'), 'feature content\n');
    git(dir, ['add', 'feature.txt']);
    git(dir, ['commit', '-m', 'Add feature file']);

    git(dir, ['checkout', 'main']);
    writeFileSync(join(dir, 'base.txt'), 'base content\n');
    git(dir, ['add', 'base.txt']);
    git(dir, ['commit', '-m', 'Add base file']);

    git(dir, ['checkout', 'feature']);
    rebaseOnto('main', { cwd: dir, allowRebase: true });

    const result = aheadBehind('main', { cwd: dir });
    assert.deepEqual(result, { ahead: 1, behind: 0 });
  } finally {
    removeRepo(dir);
  }
});

test('rebaseOnto throws when allowRebase is not true', () => {
  const dir = createRepo();
  try {
    git(dir, ['checkout', '-b', 'feature']);
    assert.throws(() => rebaseOnto('main', { cwd: dir }), /allowRebase/);
    assert.throws(() => rebaseOnto('main', { cwd: dir, allowRebase: false }), /allowRebase/);
  } finally {
    removeRepo(dir);
  }
});

test('rebaseOnto aborts and throws a clear error on conflict', () => {
  const dir = createRepo();
  try {
    git(dir, ['checkout', '-b', 'feature']);
    writeFileSync(join(dir, 'README.md'), 'feature version\n');
    git(dir, ['add', 'README.md']);
    git(dir, ['commit', '-m', 'Change README on feature']);

    git(dir, ['checkout', 'main']);
    writeFileSync(join(dir, 'README.md'), 'base version\n');
    git(dir, ['add', 'README.md']);
    git(dir, ['commit', '-m', 'Change README on base']);

    git(dir, ['checkout', 'feature']);
    assert.throws(() => rebaseOnto('main', { cwd: dir, allowRebase: true }), /git rebase main failed/);

    // The failed rebase must have been aborted, so the repository is usable again.
    const status = git(dir, ['status', '--porcelain=v2', '--branch']);
    assert.doesNotMatch(status, /rebase/i);
  } finally {
    removeRepo(dir);
  }
});

test('repoRoot and gitDir resolve inside a linked worktree', () => {
  const dir = createRepo();
  const worktreeDir = join(tmpdir(), `git-repository-test-worktree-${process.pid}-${Date.now()}`);
  try {
    git(dir, ['branch', 'wt-branch']);
    git(dir, ['worktree', 'add', worktreeDir, 'wt-branch']);

    const root = repoRoot({ cwd: worktreeDir });
    assert.equal(root, realpathSync(worktreeDir));

    const resolvedGitDir = gitDir({ cwd: worktreeDir });
    assert.match(resolvedGitDir, /\.git[/\\]worktrees[/\\]/);
  } finally {
    spawnSync('git', ['worktree', 'remove', '--force', worktreeDir], { cwd: dir });
    removeRepo(dir);
    rmSync(worktreeDir, { recursive: true, force: true });
  }
});
