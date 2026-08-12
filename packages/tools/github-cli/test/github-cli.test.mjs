import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  findPullRequest,
  getPullRequestBody,
  createPullRequest,
  updatePullRequestBody,
  checkStatus,
  renderManagedBody,
  extractIntentHash,
  applySizeLabel,
} from '../index.mjs';

/**
 * Create a stub `gh` executable.
 *
 * The stub writes each argument it receives on its own line to an argv
 * file, writes the given stdout and stderr content, and exits with the
 * given code. Tests read the argv file to assert which subcommand and
 * flags the code under test used.
 */
function makeGhStub({ stdout = '', stderr = '', exitCode = 0 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'github-cli-test-'));
  const ghPath = join(dir, 'gh');
  const argsFile = join(dir, 'argv.txt');
  const outFile = join(dir, 'stdout.txt');
  const errFile = join(dir, 'stderr.txt');

  writeFileSync(argsFile, '', 'utf8');
  writeFileSync(outFile, stdout, 'utf8');
  writeFileSync(errFile, stderr, 'utf8');

  const script = [
    '#!/usr/bin/env bash',
    `for a in "$@"; do printf '%s\\n' "$a" >> "${argsFile}"; done`,
    `cat "${outFile}"`,
    `cat "${errFile}" >&2`,
    `exit ${exitCode}`,
    '',
  ].join('\n');
  writeFileSync(ghPath, script, 'utf8');
  chmodSync(ghPath, 0o755);

  return {
    ghPath,
    dir,
    getArgs() {
      const content = readFileSync(argsFile, 'utf8');
      return content.length === 0 ? [] : content.split('\n').slice(0, -1);
    },
    cleanup() {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

// --- Managed body helpers -------------------------------------------------

test('renderManagedBody produces a fresh body with no existing content', () => {
  const body = renderManagedBody({
    intent: 'Add retry logic to the fetch stage.',
    intentHash: 'abc123',
    description: 'Retries the fetch stage up to three times.',
    existingBody: '',
  });

  assert.match(body, /^<!-- oak:managed:intent:start -->/);
  assert.match(body, /## Intent/);
  assert.match(body, /Add retry logic to the fetch stage\./);
  assert.match(body, /<!-- oak:intent-sha256=abc123 -->/);
  assert.match(body, /<!-- oak:managed:intent:end -->/);
  assert.match(body, /<!-- oak:managed:description:start -->/);
  assert.match(body, /## Description/);
  assert.match(body, /Retries the fetch stage up to three times\./);
  assert.match(body, /<!-- oak:managed:description:end -->\s*$/);

  const intentIdx = body.indexOf('<!-- oak:managed:intent:start -->');
  const descriptionIdx = body.indexOf('<!-- oak:managed:description:start -->');
  assert.ok(intentIdx < descriptionIdx, 'intent section must come before the description section');
});

test('renderManagedBody replaces managed sections and preserves human content', () => {
  const existingBody = [
    '<!-- oak:managed:intent:start -->',
    '## Intent',
    '',
    'Old intent text.',
    '',
    '<!-- oak:intent-sha256=deadbeef -->',
    '<!-- oak:managed:intent:end -->',
    '',
    '## Screenshots',
    '',
    '![before](before.png)',
    '',
    '<!-- oak:managed:description:start -->',
    '## Description',
    '',
    'Old description text.',
    '<!-- oak:managed:description:end -->',
    '',
    '## Rollout notes',
    '',
    'Deploy behind a feature flag.',
  ].join('\n');

  const body = renderManagedBody({
    intent: 'New intent text.',
    intentHash: 'cafef00d',
    description: 'New description text.',
    existingBody,
  });

  // Old managed content is gone.
  assert.doesNotMatch(body, /Old intent text\./);
  assert.doesNotMatch(body, /Old description text\./);
  assert.doesNotMatch(body, /oak:intent-sha256=deadbeef/);

  // New managed content is present.
  assert.match(body, /New intent text\./);
  assert.match(body, /New description text\./);
  assert.match(body, /oak:intent-sha256=cafef00d/);

  // Human-authored content between and after the managed sections survives
  // byte-for-byte.
  assert.match(body, /## Screenshots\n\n!\[before\]\(before\.png\)/);
  assert.match(body, /## Rollout notes\n\nDeploy behind a feature flag\.$/);
});

test('renderManagedBody is idempotent', () => {
  const first = renderManagedBody({
    intent: 'Add retry logic.',
    intentHash: 'abc123',
    description: 'Retries the fetch stage.',
    existingBody: '## Notes\n\nSome manual note.',
  });

  const second = renderManagedBody({
    intent: 'Add retry logic.',
    intentHash: 'abc123',
    description: 'Retries the fetch stage.',
    existingBody: first,
  });

  assert.equal(second, first);
  assert.match(second, /## Notes\n\nSome manual note\.$/);
});

test('extractIntentHash round-trips through renderManagedBody', () => {
  const body = renderManagedBody({
    intent: 'Add retry logic.',
    intentHash: '0123456789abcdef',
    description: 'Retries the fetch stage.',
    existingBody: '',
  });

  assert.equal(extractIntentHash(body), '0123456789abcdef');
});

test('extractIntentHash returns null when no hash comment is present', () => {
  assert.equal(extractIntentHash(''), null);
  assert.equal(extractIntentHash('## Description\n\nNo markers here.'), null);
});

// --- gh-invoking functions -------------------------------------------------

test('findPullRequest returns the matching pull request', (t) => {
  const stub = makeGhStub({
    stdout: JSON.stringify([{ number: 42, url: 'https://github.com/o/r/pull/42', body: 'Old body' }]),
  });
  t.after(() => stub.cleanup());

  const result = findPullRequest('feature/x', { ghPath: stub.ghPath });

  assert.deepEqual(result, { number: 42, url: 'https://github.com/o/r/pull/42', body: 'Old body' });
  assert.deepEqual(stub.getArgs(), ['pr', 'list', '--head', 'feature/x', '--json', 'number,url,body']);
});

test('findPullRequest returns null when no pull request exists', (t) => {
  const stub = makeGhStub({ stdout: '[]' });
  t.after(() => stub.cleanup());

  const result = findPullRequest('feature/x', { ghPath: stub.ghPath });

  assert.equal(result, null);
});

test('getPullRequestBody returns the body text', (t) => {
  const stub = makeGhStub({ stdout: JSON.stringify({ body: 'Hello from gh' }) });
  t.after(() => stub.cleanup());

  const body = getPullRequestBody(5, { ghPath: stub.ghPath });

  assert.equal(body, 'Hello from gh');
  assert.deepEqual(stub.getArgs(), ['pr', 'view', '5', '--json', 'body']);
});

test('createPullRequest parses the number from the printed URL', (t) => {
  const stub = makeGhStub({ stdout: 'https://github.com/o/r/pull/7\n' });
  t.after(() => stub.cleanup());

  const result = createPullRequest(
    { title: 'Add retry logic', body: 'Body text', base: 'main', head: 'feature/x' },
    { ghPath: stub.ghPath },
  );

  assert.deepEqual(result, { number: 7, url: 'https://github.com/o/r/pull/7' });
  assert.deepEqual(stub.getArgs(), [
    'pr',
    'create',
    '--title',
    'Add retry logic',
    '--body',
    'Body text',
    '--base',
    'main',
    '--head',
    'feature/x',
  ]);
});

test('updatePullRequestBody sends the body on standard input', (t) => {
  const stub = makeGhStub({ stdout: '' });
  t.after(() => stub.cleanup());

  updatePullRequestBody(7, 'New body text', { ghPath: stub.ghPath });

  assert.deepEqual(stub.getArgs(), ['pr', 'edit', '7', '--body-file', '-']);
});

test('checkStatus maps gh check fields to name, status, and conclusion', (t) => {
  const stub = makeGhStub({
    stdout: JSON.stringify([
      { name: 'test', state: 'SUCCESS', bucket: 'pass' },
      { name: 'lint', state: 'FAILURE', bucket: 'fail' },
    ]),
  });
  t.after(() => stub.cleanup());

  const result = checkStatus(7, { ghPath: stub.ghPath });

  assert.deepEqual(result, [
    { name: 'test', status: 'pass', conclusion: 'SUCCESS' },
    { name: 'lint', status: 'fail', conclusion: 'FAILURE' },
  ]);
  assert.deepEqual(stub.getArgs(), ['pr', 'checks', '7', '--json', 'name,state,bucket']);
});

test('a failing gh command throws with the command and stderr', (t) => {
  const stub = makeGhStub({ exitCode: 1, stderr: 'error: not authenticated' });
  t.after(() => stub.cleanup());

  assert.throws(
    () => findPullRequest('feature/x', { ghPath: stub.ghPath }),
    /not authenticated/,
  );
});

test('a missing gh binary throws an install and authenticate message', () => {
  const dir = mkdtempSync(join(tmpdir(), 'github-cli-test-missing-'));
  const missingGhPath = join(dir, 'gh-does-not-exist');
  assert.equal(existsSync(missingGhPath), false);

  try {
    assert.throws(
      () => findPullRequest('feature/x', { ghPath: missingGhPath }),
      /install.*GitHub CLI|GitHub CLI.*install/i,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("renderManagedBody throws on out-of-order markers instead of writing null", () => {
  const broken = [
    "Notes",
    "<!-- oak:managed:intent:end -->",
    "stuff",
    "<!-- oak:managed:intent:start -->",
    "more",
  ].join("\n");
  assert.throws(
    () =>
      renderManagedBody({
        intent: "I",
        intentHash: "a".repeat(64),
        description: "D",
        existingBody: broken,
      }),
    /marker/,
  );
});

test("renderManagedBody preserves a marker-free existing body verbatim", () => {
  const existingBody = "\n  ## Rollout notes\n\ntrailing space  \n";
  const body = renderManagedBody({
    intent: "I",
    intentHash: "a".repeat(64),
    description: "D",
    existingBody,
  });
  assert.ok(body.endsWith(`\n\n${existingBody}`));
});

test("extractIntentHash ignores a hash comment outside the managed intent section", () => {
  const body = renderManagedBody({
    intent: "I",
    intentHash: "b".repeat(64),
    description: "D",
  });
  const spoofed = `<!-- oak:intent-sha256=${"c".repeat(64)} -->\n${body}`;
  assert.equal(extractIntentHash(spoofed), "b".repeat(64));
});

test('applySizeLabel ensures the label, adds it, and removes other size labels', (t) => {
  const stub = makeGhStub({
    stdout: JSON.stringify({ labels: [{ name: 'size/L' }, { name: 'bug' }] }),
  });
  t.after(() => stub.cleanup());

  const result = applySizeLabel(7, 'M', { ghPath: stub.ghPath });

  assert.deepEqual(result, { added: 'size/M', removed: ['size/L'] });
  const args = stub.getArgs();
  const createIdx = args.indexOf('label');
  assert.deepEqual(args.slice(createIdx, createIdx + 3), ['label', 'create', 'size/M']);
  assert.ok(args.includes('--force'));
  const editIdx = args.lastIndexOf('edit');
  const editArgs = args.slice(editIdx - 1);
  assert.deepEqual(editArgs.slice(0, 3), ['pr', 'edit', '7']);
  assert.ok(editArgs.includes('--add-label') && editArgs.includes('size/M'));
  assert.ok(editArgs.includes('--remove-label') && editArgs.includes('size/L'));
});

test('applySizeLabel rejects an unknown size value', () => {
  assert.throws(() => applySizeLabel(7, 'XXL', {}), /Unknown size/);
});
