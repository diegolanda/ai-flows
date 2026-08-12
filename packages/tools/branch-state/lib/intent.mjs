import { createHash } from 'node:crypto';

/**
 * Convert intent text to its canonical form.
 *
 * Canonicalization steps, in order:
 * 1. Treat the text as UTF-8.
 * 2. Convert CRLF and CR line endings to LF.
 * 3. Remove trailing whitespace from each line.
 * 4. Remove leading and trailing blank lines.
 *
 * @param {string} text
 * @returns {string}
 */
export function canonicalizeIntent(text) {
  if (typeof text !== 'string') {
    throw new TypeError('intent text must be a string');
  }

  const withLf = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = withLf.split('\n').map((line) => line.replace(/\s+$/, ''));

  let start = 0;
  let end = lines.length - 1;
  while (start <= end && lines[start] === '') {
    start += 1;
  }
  while (end >= start && lines[end] === '') {
    end -= 1;
  }

  return lines.slice(start, end + 1).join('\n');
}

/**
 * Calculate the intent hash defined in CONTRACTS.md.
 * The hash covers the canonical form of the intent text.
 *
 * @param {string} text
 * @returns {string} `sha256:<lowercase hex>`
 */
export function intentHash(text) {
  const canonical = canonicalizeIntent(text);
  const digest = createHash('sha256').update(canonical, 'utf8').digest('hex');
  return `sha256:${digest}`;
}
