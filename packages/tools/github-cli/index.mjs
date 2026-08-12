import { spawnSync } from 'node:child_process';

const INTENT_START = '<!-- oak:managed:intent:start -->';
const INTENT_END = '<!-- oak:managed:intent:end -->';
const DESCRIPTION_START = '<!-- oak:managed:description:start -->';
const DESCRIPTION_END = '<!-- oak:managed:description:end -->';
const INTENT_HASH_PATTERN = /<!-- oak:intent-sha256=([0-9a-f]+) -->/;

/**
 * Run a `gh` subcommand and return its stdout.
 *
 * The function throws when the process cannot start or exits with a
 * non-zero status. The error message includes the command and stderr.
 */
function runGh(args, opts = {}) {
  const { cwd, ghPath = 'gh', input } = opts;
  const result = spawnSync(ghPath, args, {
    cwd,
    input,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    if (result.error.code === 'ENOENT') {
      throw new Error(
        `GitHub CLI not found at "${ghPath}". Install the GitHub CLI and run "gh auth login" before using this tool.`,
      );
    }
    throw result.error;
  }

  if (result.status !== 0) {
    const command = [ghPath, ...args].join(' ');
    const stderr = (result.stderr || '').trim();
    throw new Error(`Command failed: ${command}\n${stderr}`);
  }

  return result.stdout;
}

/**
 * Find the open pull request for a branch.
 *
 * Returns `{ number, url, body }` or `null` when no pull request exists
 * for the branch.
 */
export function findPullRequest(branch, opts = {}) {
  const stdout = runGh(['pr', 'list', '--head', branch, '--json', 'number,url,body'], opts);
  const list = JSON.parse(stdout);
  if (!Array.isArray(list) || list.length === 0) {
    return null;
  }
  const pr = list[0];
  return { number: pr.number, url: pr.url, body: pr.body ?? '' };
}

/**
 * Read the current body of a pull request.
 */
export function getPullRequestBody(number, opts = {}) {
  const stdout = runGh(['pr', 'view', String(number), '--json', 'body'], opts);
  const data = JSON.parse(stdout);
  return data.body ?? '';
}

/**
 * Create a pull request.
 *
 * Returns `{ number, url }`. The pull request number is parsed from the
 * URL that `gh pr create` prints, because that command does not support
 * `--json`.
 */
export function createPullRequest({ title, body, base, head }, opts = {}) {
  const args = ['pr', 'create', '--title', title, '--body', body, '--base', base, '--head', head];
  const stdout = runGh(args, opts);
  const lines = stdout.trim().split('\n').filter(Boolean);
  const url = lines.length > 0 ? lines[lines.length - 1].trim() : '';
  const match = url.match(/\/pull\/(\d+)/);
  const number = match ? Number(match[1]) : null;
  return { number, url };
}

/**
 * Replace the body of an existing pull request.
 *
 * The new body is sent to `gh` on standard input, so the body text never
 * needs to pass through the shell as an argument.
 */
export function updatePullRequestBody(number, body, opts = {}) {
  runGh(['pr', 'edit', String(number), '--body-file', '-'], { ...opts, input: body });
}

/**
 * Read the check state for a pull request.
 *
 * Returns an array of `{ name, status, conclusion }`. `status` is the
 * coarse category that `gh` reports (for example `pass`, `fail`,
 * `pending`). `conclusion` is the finer-grained state string.
 */
export function checkStatus(number, opts = {}) {
  const stdout = runGh(['pr', 'checks', String(number), '--json', 'name,state,bucket'], opts);
  const list = JSON.parse(stdout);
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map((check) => ({
    name: check.name,
    status: check.bucket,
    conclusion: check.state,
  }));
}

function intentSectionInner(intent, intentHash) {
  // The intent text is rendered verbatim. Callers must pass the canonical
  // form of the intent, because the recorded hash covers exactly that text.
  return ['## Intent', '', intent, '', `<!-- oak:intent-sha256=${intentHash} -->`].join('\n');
}

function descriptionSectionInner(description) {
  return ['## Description', '', description.trim()].join('\n');
}

/**
 * Replace the content between one pair of managed markers.
 *
 * Everything outside the marker pair is preserved byte-for-byte. The
 * function throws when the end marker does not follow the start marker,
 * because writing a body it could not construct would destroy content.
 */
function replaceManagedSection(body, startMarker, endMarker, innerContent) {
  const startIdx = body.indexOf(startMarker);
  if (startIdx === -1) {
    throw new Error(`The PR body is missing the ${startMarker} marker. Repair the marker pair before syncing.`);
  }
  const endIdx = body.indexOf(endMarker, startIdx + startMarker.length);
  if (endIdx === -1) {
    throw new Error(
      `The PR body has ${startMarker} without a following ${endMarker}. Repair the marker pair before syncing.`,
    );
  }
  const before = body.slice(0, startIdx);
  const after = body.slice(endIdx + endMarker.length);
  const section = `${startMarker}\n${innerContent}\n${endMarker}`;
  return `${before}${section}${after}`;
}

/**
 * Render a pull request body with the managed intent and description
 * sections set to the given content.
 *
 * When `existingBody` already contains managed marker pairs, only the
 * content between each pair is replaced. All other content, including
 * human-added sections, is preserved byte-for-byte. When `existingBody`
 * has no managed markers, the managed sections are placed first and any
 * existing content is kept below them.
 */
export function renderManagedBody({ intent, intentHash, description, existingBody = '' }) {
  const intentInner = intentSectionInner(intent, intentHash);
  const descriptionInner = descriptionSectionInner(description);
  const intentSection = `${INTENT_START}\n${intentInner}\n${INTENT_END}`;
  const descriptionSection = `${DESCRIPTION_START}\n${descriptionInner}\n${DESCRIPTION_END}`;

  const hasIntentMarkers = existingBody.includes(INTENT_START) && existingBody.includes(INTENT_END);
  const hasDescriptionMarkers =
    existingBody.includes(DESCRIPTION_START) && existingBody.includes(DESCRIPTION_END);

  if (!hasIntentMarkers && !hasDescriptionMarkers) {
    return existingBody.length > 0
      ? `${intentSection}\n\n${descriptionSection}\n\n${existingBody}`
      : `${intentSection}\n\n${descriptionSection}`;
  }

  let body = existingBody;

  body = hasIntentMarkers
    ? replaceManagedSection(body, INTENT_START, INTENT_END, intentInner)
    : `${intentSection}\n\n${body}`;

  body = hasDescriptionMarkers
    ? replaceManagedSection(body, DESCRIPTION_START, DESCRIPTION_END, descriptionInner)
    : `${body}\n\n${descriptionSection}`;

  return body;
}

/**
 * Extract the text between the managed intent markers.
 *
 * Returns the raw section content, or `null` when the marker pair is not
 * present or is malformed.
 */
export function extractManagedSection(body, kind = 'intent') {
  if (!body) {
    return null;
  }
  const startMarker = kind === 'description' ? DESCRIPTION_START : INTENT_START;
  const endMarker = kind === 'description' ? DESCRIPTION_END : INTENT_END;
  const startIdx = body.indexOf(startMarker);
  if (startIdx === -1) {
    return null;
  }
  const endIdx = body.indexOf(endMarker, startIdx + startMarker.length);
  if (endIdx === -1) {
    return null;
  }
  return body.slice(startIdx + startMarker.length, endIdx);
}

/**
 * Extract the intent hash recorded in a pull request body.
 *
 * The search is scoped to the managed intent section when the markers are
 * present, so a hash comment elsewhere in the body cannot stand in for the
 * recorded one. Returns the lowercase hex digest, or `null`.
 */
export function extractIntentHash(body) {
  if (!body) {
    return null;
  }
  const section = extractManagedSection(body, 'intent');
  const scope = section ?? body;
  const match = scope.match(INTENT_HASH_PATTERN);
  return match ? match[1] : null;
}
