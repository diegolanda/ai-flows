import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  readState,
  initState,
  setIntent,
  lockIntent,
  editIntent,
  markStale,
  recordDescription,
  recordReview,
  checkFreshness,
  setPullRequest,
  canonicalizeIntent,
  intentHash,
} from '../index.mjs';
import { validateState } from '../lib/validate.mjs';
import { branchSafeId } from '../lib/paths.mjs';

function sh(cwd, args) {
  execFileSync('git', args, { cwd, encoding: 'utf8' });
}

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'branch-state-'));
  sh(dir, ['init', '--initial-branch=main', '--quiet']);
  sh(dir, ['config', 'user.email', 'test@example.com']);
  sh(dir, ['config', 'user.name', 'Test']);
  fs.writeFileSync(path.join(dir, 'README.md'), '# repo\n');
  sh(dir, ['add', '.']);
  sh(dir, ['commit', '--quiet', '-m', 'initial commit']);
  return dir;
}

function headSha(dir) {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
}

function commit(dir, message) {
  fs.writeFileSync(path.join(dir, `${message.replace(/\s+/g, '-')}.txt`), `${message}\n`);
  sh(dir, ['add', '.']);
  sh(dir, ['commit', '--quiet', '-m', message]);
  return headSha(dir);
}

test('initState and readState round trip', () => {
  const repo = makeRepo();
  const created = initState({ cwd: repo, branch: 'main', baseBranch: 'main', rawIntent: 'Do the thing' });

  assert.equal(created.version, 1);
  assert.equal(created.branch, 'main');
  assert.equal(created.baseBranch, 'main');
  assert.equal(created.rawIntent, 'Do the thing');
  assert.equal(created.intent, null);
  assert.equal(created.intentHash, null);
  assert.equal(created.intentLocked, false);
  assert.equal(created.descriptionStale, true);
  assert.equal(created.reviewStale, true);

  const read = readState({ cwd: repo, branch: 'main' });
  assert.deepEqual(read, created);

  assert.throws(() => initState({ cwd: repo, branch: 'main', baseBranch: 'main', rawIntent: 'again' }));
});

test('readState returns null when no state file exists', () => {
  const repo = makeRepo();
  const state = readState({ cwd: repo, branch: 'main' });
  assert.equal(state, null);
});

test('branch-safe id sanitizes branch names with slashes', () => {
  assert.equal(branchSafeId('fix/nil-check'), 'fix-nil-check');

  const repo = makeRepo();
  sh(repo, ['checkout', '-b', 'fix/nil-check']);
  initState({ cwd: repo, branch: 'fix/nil-check', baseBranch: 'main', rawIntent: 'Fix nil check' });

  const gitDir = execFileSync('git', ['rev-parse', '--absolute-git-dir'], { cwd: repo, encoding: 'utf8' }).trim();
  const expectedFile = path.join(gitDir, 'oakshelf', 'development', 'fix-nil-check.json');
  assert.ok(fs.existsSync(expectedFile));
});

test('lock flow: setIntent then lockIntent produces the expected hash', () => {
  const repo = makeRepo();
  initState({ cwd: repo, branch: 'main', baseBranch: 'main', rawIntent: 'Prevent nil errors' });

  const text = 'Prevent nil errors when users have no organization';
  setIntent({ cwd: repo, branch: 'main', intent: text });

  const locked = lockIntent({ cwd: repo, branch: 'main' });
  assert.equal(locked.intentLocked, true);
  assert.equal(locked.intent, canonicalizeIntent(text));
  assert.equal(locked.intentHash, intentHash(text));
  assert.match(locked.intentApprovedAt, /^\d{4}-\d{2}-\d{2}T/);

  assert.throws(() => setIntent({ cwd: repo, branch: 'main', intent: 'new text' }));
  assert.throws(() => lockIntent({ cwd: repo, branch: 'main' }));
});

test('lockIntent requires an intent to already be set', () => {
  const repo = makeRepo();
  initState({ cwd: repo, branch: 'main', baseBranch: 'main', rawIntent: 'Something' });
  assert.throws(() => lockIntent({ cwd: repo, branch: 'main' }));
});

test('canonicalization: CRLF, trailing spaces, and surrounding blank lines produce the same hash', () => {
  const base = 'Prevent nil errors\nwhen users have no organization';
  const crlf = '\r\n\r\nPrevent nil errors\r\nwhen users have no organization\r\n\r\n';
  const trailingSpaces = '\n\nPrevent nil errors   \nwhen users have no organization\t\n\n';

  const expected = intentHash(base);
  assert.equal(intentHash(crlf), expected);
  assert.equal(intentHash(trailingSpaces), expected);
  assert.equal(canonicalizeIntent(crlf), base);
  assert.equal(canonicalizeIntent(trailingSpaces), base);
  assert.match(expected, /^sha256:[0-9a-f]{64}$/);
});

test('editIntent requires a locked intent and a reason, and marks stale', () => {
  const repo = makeRepo();
  initState({ cwd: repo, branch: 'main', baseBranch: 'main', rawIntent: 'Original' });
  setIntent({ cwd: repo, branch: 'main', intent: 'Original intent' });

  assert.throws(() => editIntent({ cwd: repo, branch: 'main', intent: 'New intent', reason: 'scope change' }));

  lockIntent({ cwd: repo, branch: 'main' });
  recordDescription({ cwd: repo, branch: 'main' });
  recordReview({ cwd: repo, branch: 'main', headSha: headSha(repo), status: 'pass' });

  assert.throws(() => editIntent({ cwd: repo, branch: 'main', intent: 'New intent', reason: '' }));

  const before = readState({ cwd: repo, branch: 'main' });
  const edited = editIntent({ cwd: repo, branch: 'main', intent: 'New intent', reason: 'scope change' });

  assert.equal(edited.intent, 'New intent');
  assert.equal(edited.intentHash, intentHash('New intent'));
  assert.equal(edited.intentLocked, true);
  assert.equal(edited.descriptionStale, true);
  assert.equal(edited.reviewStale, true);
  assert.notEqual(edited.intentApprovedAt, before.intentApprovedAt);
});

test('markStale sets both flags to true', () => {
  const repo = makeRepo();
  initState({ cwd: repo, branch: 'main', baseBranch: 'main', rawIntent: 'Something' });
  recordDescription({ cwd: repo, branch: 'main' });
  recordReview({ cwd: repo, branch: 'main', headSha: headSha(repo), status: 'pass' });

  const state = markStale({ cwd: repo, branch: 'main' });
  assert.equal(state.descriptionStale, true);
  assert.equal(state.reviewStale, true);
});

test('recordReview and checkFreshness go stale after a new commit', () => {
  const repo = makeRepo();
  initState({ cwd: repo, branch: 'main', baseBranch: 'main', rawIntent: 'Something' });

  const firstHead = headSha(repo);
  recordReview({ cwd: repo, branch: 'main', headSha: firstHead, status: 'pass' });

  let freshness = checkFreshness({ cwd: repo, branch: 'main' });
  assert.equal(freshness.reviewStale, false);
  assert.equal(freshness.reviewFreshForHead, true);

  commit(repo, 'second commit');

  freshness = checkFreshness({ cwd: repo, branch: 'main' });
  assert.equal(freshness.reviewStale, true);
  assert.equal(freshness.reviewFreshForHead, false);
});

test('setPullRequest records the PR number', () => {
  const repo = makeRepo();
  initState({ cwd: repo, branch: 'main', baseBranch: 'main', rawIntent: 'Something' });
  const state = setPullRequest({ cwd: repo, branch: 'main', number: 42 });
  assert.equal(state.pullRequest, 42);
  assert.throws(() => setPullRequest({ cwd: repo, branch: 'main', number: 0 }));
});

test('validation rejects unknown fields', () => {
  assert.throws(
    () =>
      validateState({
        version: 1,
        branch: 'main',
        baseBranch: 'main',
        rawIntent: 'x',
        intent: null,
        intentHash: null,
        intentLocked: false,
        descriptionStale: true,
        reviewStale: true,
        extra: 'nope',
      }),
    /unknown field "extra"/,
  );
});

test('validation rejects bad hashes and bad review SHAs', () => {
  const base = {
    version: 1,
    branch: 'main',
    baseBranch: 'main',
    rawIntent: 'x',
    intent: null,
    intentLocked: false,
    descriptionStale: true,
    reviewStale: true,
  };

  assert.throws(() => validateState({ ...base, intentHash: 'not-a-hash' }), /intentHash/);
  assert.throws(() => validateState({ ...base, intentHash: null, lastReviewedHead: 'short' }), /lastReviewedHead/);
  assert.throws(() => validateState({ ...base, intentHash: null, lastReviewStatus: 'maybe' }), /lastReviewStatus/);
  assert.doesNotThrow(() => validateState({ ...base, intentHash: null }));
});

test('validation rejects a state missing required fields', () => {
  assert.throws(() => validateState({ version: 1 }), /missing required field/);
});

test('worktree case: state for a linked worktree lands in that worktree git dir', () => {
  const repo = makeRepo();
  const worktreeParent = fs.mkdtempSync(path.join(os.tmpdir(), 'branch-state-worktree-'));
  const worktreePath = path.join(worktreeParent, 'wt');
  sh(repo, ['worktree', 'add', '-b', 'feature/worktree-branch', worktreePath]);

  const state = initState({
    cwd: worktreePath,
    branch: 'feature/worktree-branch',
    baseBranch: 'main',
    rawIntent: 'Worktree intent',
  });
  assert.equal(state.branch, 'feature/worktree-branch');

  const worktreeGitDir = execFileSync('git', ['rev-parse', '--absolute-git-dir'], {
    cwd: worktreePath,
    encoding: 'utf8',
  }).trim();
  const mainGitDir = execFileSync('git', ['rev-parse', '--absolute-git-dir'], { cwd: repo, encoding: 'utf8' }).trim();

  assert.notEqual(worktreeGitDir, mainGitDir);

  const expectedFile = path.join(worktreeGitDir, 'oakshelf', 'development', 'feature-worktree-branch.json');
  assert.ok(fs.existsSync(expectedFile));

  const mainStateAttempt = readState({ cwd: repo, branch: 'feature/worktree-branch' });
  assert.equal(mainStateAttempt, null);
});

test('setIntent stores a size and editIntent updates it', () => {
  const repo = makeRepo();
  try {
    initState({ cwd: repo, baseBranch: 'main', rawIntent: 'do the thing' });
    let state = setIntent({ cwd: repo, intent: 'Do the thing.', size: 'S' });
    assert.equal(state.intentSize, 'S');
    lockIntent({ cwd: repo });
    state = editIntent({ cwd: repo, intent: 'Do the bigger thing.', reason: 'scope grew', size: 'L' });
    assert.equal(state.intentSize, 'L');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

test('validation rejects an invalid intentSize', () => {
  const repo = makeRepo();
  try {
    initState({ cwd: repo, baseBranch: 'main', rawIntent: 'do the thing' });
    assert.throws(
      () => setIntent({ cwd: repo, intent: 'Do the thing.', size: 'HUGE' }),
      /intentSize/,
    );
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});
