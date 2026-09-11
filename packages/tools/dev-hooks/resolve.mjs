#!/usr/bin/env node
import { resolveDevelopmentTools } from "./lib/resolve-tools.mjs";

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("--")) continue;
    const value = args[i + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Flag ${arg} requires a value.`);
    }
    flags[arg.slice(2)] = value;
    i += 1;
  }
  return flags;
}

function print(value, stream = process.stdout) {
  stream.write(`${JSON.stringify(value, null, 2)}\n`);
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (command !== "resolve") {
    process.stderr.write("Usage: diego-development-tools resolve\n");
    return 1;
  }

  try {
    const flags = parseFlags(rest);
    // Keep the old flag working while installed workflows migrate to the
    // self-locating resolver. A complete resolver package does not need it.
    print(resolveDevelopmentTools({ root: flags.root }));
    return 0;
  } catch (error) {
    print(
      {
        error: error.message,
        ...(error.attempted ? { attempted: error.attempted } : {}),
        ...(error.nextAction ? { nextAction: error.nextAction } : {}),
      },
      process.stderr,
    );
    return 1;
  }
}

process.exitCode = main();
