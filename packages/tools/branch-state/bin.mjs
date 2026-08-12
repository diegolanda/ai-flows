#!/usr/bin/env node
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
} from './index.mjs';

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[i + 1];
      flags[key] = value;
      i += 1;
    }
  }
  return flags;
}

function printResult(result) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function printError(error) {
  process.stderr.write(`${JSON.stringify({ error: error.message }, null, 2)}\n`);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  const options = { cwd: flags.cwd, branch: flags.branch };

  switch (command) {
    case 'read': {
      const state = readState(options);
      printResult(state);
      return state === null ? 1 : 0;
    }

    case 'init': {
      const rawIntent = await readStdin();
      const state = initState({ ...options, baseBranch: flags['base-branch'], rawIntent: rawIntent.trim() });
      printResult(state);
      return 0;
    }

    case 'set-intent': {
      const intent = await readStdin();
      const state = setIntent({ ...options, intent });
      printResult(state);
      return 0;
    }

    case 'lock-intent': {
      const state = lockIntent(options);
      printResult(state);
      return 0;
    }

    case 'edit-intent': {
      const intent = await readStdin();
      const state = editIntent({ ...options, intent, reason: flags.reason });
      printResult(state);
      return 0;
    }

    case 'mark-stale': {
      const state = markStale(options);
      printResult(state);
      return 0;
    }

    case 'record-description': {
      const state = recordDescription(options);
      printResult(state);
      return 0;
    }

    case 'record-review': {
      const state = recordReview({ ...options, headSha: flags.head, status: flags.status });
      printResult(state);
      return 0;
    }

    case 'check-freshness': {
      const result = checkFreshness(options);
      printResult(result);
      return 0;
    }

    case 'set-pr': {
      const state = setPullRequest({ ...options, number: Number(flags.number) });
      printResult(state);
      return 0;
    }

    default: {
      process.stderr.write(
        `Unknown command "${command ?? ''}". Expected one of: read, init, set-intent, lock-intent, edit-intent, mark-stale, record-description, record-review, check-freshness, set-pr.\n`,
      );
      return 1;
    }
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    printError(error);
    process.exitCode = 1;
  });
