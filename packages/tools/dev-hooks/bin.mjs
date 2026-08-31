#!/usr/bin/env node
import { createRenderer } from "@diego/pipeline-ui";
import {
  ciVerify,
  gatesOnly,
  postCommit,
  preCommit,
  prePush,
  prSync,
  setup,
} from "./index.mjs";

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    if (key === "write") {
      flags[key] = true;
      continue;
    }
    const value = args[i + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Flag ${arg} requires a value.`);
    }
    flags[key] = value;
    i += 1;
  }
  return flags;
}

function reportFailures(failures) {
  for (const failure of failures) {
    process.stderr.write(`\n✗ ${failure.stage}\n\n${failure.message}\n`);
  }
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);
  const cwd = flags.cwd;
  const renderer = createRenderer({});
  const emit = renderer.handle;

  switch (command) {
    case "pre-commit":
      return preCommit().status === "pass" ? 0 : 1;
    case "post-commit":
      return postCommit({ cwd }).status === "pass" ? 0 : 1;
    case "pre-push": {
      const result = await prePush({ cwd, emit });
      reportFailures(result.failures);
      return result.status === "pass" ? 0 : 1;
    }
    case "gates": {
      const result = await gatesOnly({ cwd, emit });
      return result.status === "pass" ? 0 : 1;
    }
    case "pr-sync": {
      const description = await readStdin();
      const result = prSync({ cwd, title: flags.title, description });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return 0;
    }
    case "ci-verify": {
      const prNumber = flags.pr ? Number(flags.pr) : undefined;
      const result = await ciVerify({ cwd, prNumber, emit });
      reportFailures(result.failures);
      return result.status === "pass" ? 0 : 1;
    }
    case "setup": {
      const result = setup({ cwd, write: "write" in flags });
      for (const entry of result.entries) {
        process.stdout.write(`${entry.action.padEnd(6)} ${entry.path}\n`);
      }
      if (!result.applied) {
        process.stdout.write("\nDry run. Pass --write to apply the plan.\n");
      }
      return 0;
    }
    default:
      process.stderr.write(
        "Usage: diego-dev-hook <pre-commit|post-commit|pre-push|gates|pr-sync|ci-verify|setup>\n",
      );
      return 1;
  }
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  },
);
