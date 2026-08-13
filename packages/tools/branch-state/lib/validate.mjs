// Dedicated validator for the branch state shape.
// This mirrors packages/workflows/development/contracts/branch-state.schema.json.
// It is not a general JSON Schema engine on purpose: the schema is small and fixed.

const REQUIRED_FIELDS = [
  'version',
  'branch',
  'baseBranch',
  'rawIntent',
  'intent',
  'intentHash',
  'intentLocked',
  'descriptionStale',
  'reviewStale',
];

const OPTIONAL_FIELDS = ['intentApprovedAt', 'intentSize', 'lastReviewedHead', 'lastReviewStatus', 'pullRequest'];

const INTENT_SIZES = ['XS', 'S', 'M', 'L', 'XL'];

const ALLOWED_FIELDS = new Set([...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]);

const INTENT_HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;
const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length >= 1;
}

/**
 * Validate a branch state object against the branch state schema.
 * Throws an Error listing every violation when the state is invalid.
 *
 * @param {unknown} state
 */
export function validateState(state) {
  const errors = [];

  if (typeof state !== 'object' || state === null || Array.isArray(state)) {
    throw new Error('branch state must be a JSON object');
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in state)) {
      errors.push(`missing required field "${field}"`);
    }
  }

  for (const field of Object.keys(state)) {
    if (!ALLOWED_FIELDS.has(field)) {
      errors.push(`unknown field "${field}"`);
    }
  }

  if ('version' in state && state.version !== 1) {
    errors.push('"version" must equal 1');
  }

  if ('branch' in state && !isNonEmptyString(state.branch)) {
    errors.push('"branch" must be a non-empty string');
  }

  if ('baseBranch' in state && !isNonEmptyString(state.baseBranch)) {
    errors.push('"baseBranch" must be a non-empty string');
  }

  if ('rawIntent' in state && !isNonEmptyString(state.rawIntent)) {
    errors.push('"rawIntent" must be a non-empty string');
  }

  if ('intent' in state && !(state.intent === null || typeof state.intent === 'string')) {
    errors.push('"intent" must be a string or null');
  }

  if ('intentHash' in state) {
    const value = state.intentHash;
    if (!(value === null || (typeof value === 'string' && INTENT_HASH_PATTERN.test(value)))) {
      errors.push('"intentHash" must be null or match ^sha256:[0-9a-f]{64}$');
    }
  }

  if ('intentSize' in state && !INTENT_SIZES.includes(state.intentSize)) {
    errors.push(`"intentSize" must be one of: ${INTENT_SIZES.join(', ')}`);
  }

  if ('intentLocked' in state && typeof state.intentLocked !== 'boolean') {
    errors.push('"intentLocked" must be a boolean');
  }

  if ('intentApprovedAt' in state) {
    const value = state.intentApprovedAt;
    if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
      errors.push('"intentApprovedAt" must be a date-time string');
    }
  }

  if ('descriptionStale' in state && typeof state.descriptionStale !== 'boolean') {
    errors.push('"descriptionStale" must be a boolean');
  }

  if ('reviewStale' in state && typeof state.reviewStale !== 'boolean') {
    errors.push('"reviewStale" must be a boolean');
  }

  if ('lastReviewedHead' in state) {
    const value = state.lastReviewedHead;
    if (typeof value !== 'string' || !COMMIT_SHA_PATTERN.test(value)) {
      errors.push('"lastReviewedHead" must match ^[0-9a-f]{40}$');
    }
  }

  if ('lastReviewStatus' in state && state.lastReviewStatus !== 'pass' && state.lastReviewStatus !== 'fail') {
    errors.push('"lastReviewStatus" must be "pass" or "fail"');
  }

  if ('pullRequest' in state) {
    const value = state.pullRequest;
    if (!Number.isInteger(value) || value < 1) {
      errors.push('"pullRequest" must be an integer greater than or equal to 1');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid branch state:\n- ${errors.join('\n- ')}`);
  }
}
