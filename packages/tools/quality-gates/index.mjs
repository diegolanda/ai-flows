import { spawn } from "node:child_process";
import { readFile, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";

const KNOWN_GATE_FIELDS = new Set(["name", "script", "required", "skipIfMissing"]);

function noop() {}

/**
 * Read package.json in cwd and report whether it declares the given script.
 *
 * @param {string} scriptName
 * @param {{ cwd?: string }} [options]
 * @returns {Promise<boolean>}
 */
export async function hasScript(scriptName, { cwd = process.cwd() } = {}) {
  const pkg = await readPackageJson(cwd);
  if (!pkg || typeof pkg.scripts !== "object" || pkg.scripts === null) {
    return false;
  }
  return typeof pkg.scripts[scriptName] === "string";
}

/**
 * Detect which package manager the repository at cwd uses.
 *
 * The tool prefers pnpm when a pnpm-lock.yaml file exists, or when
 * package.json declares a packageManager field that starts with "pnpm".
 * Every other case uses npm.
 *
 * @param {{ cwd?: string }} [options]
 * @returns {Promise<"pnpm" | "npm">}
 */
export async function detectPackageManager({ cwd = process.cwd() } = {}) {
  const lockfilePath = path.join(cwd, "pnpm-lock.yaml");
  if (await pathExists(lockfilePath)) {
    return "pnpm";
  }

  const pkg = await readPackageJson(cwd);
  if (pkg && typeof pkg.packageManager === "string" && pkg.packageManager.startsWith("pnpm")) {
    return "pnpm";
  }

  return "npm";
}

/**
 * Validate a list of gate configuration entries.
 *
 * The function throws a descriptive error on the first malformed entry.
 * It never mutates the input.
 *
 * @param {unknown} gates
 */
export function validateGatesConfig(gates) {
  if (!Array.isArray(gates)) {
    throw new Error("Gates configuration must be an array.");
  }

  gates.forEach((gate, index) => {
    const label = `Gate at index ${index}`;

    if (gate === null || typeof gate !== "object" || Array.isArray(gate)) {
      throw new Error(`${label} must be an object.`);
    }

    for (const field of Object.keys(gate)) {
      if (!KNOWN_GATE_FIELDS.has(field)) {
        throw new Error(`${label} has an unknown field: "${field}".`);
      }
    }

    if (typeof gate.name !== "string" || gate.name.length === 0) {
      throw new Error(`${label} must set a non-empty string "name".`);
    }

    if (typeof gate.script !== "string" || gate.script.length === 0) {
      throw new Error(`${label} must set a non-empty string "script".`);
    }

    if (gate.required !== undefined && typeof gate.required !== "boolean") {
      throw new Error(`${label} ("${gate.name}") must set "required" to a boolean.`);
    }

    if (gate.skipIfMissing !== undefined && typeof gate.skipIfMissing !== "boolean") {
      throw new Error(`${label} ("${gate.name}") must set "skipIfMissing" to a boolean.`);
    }
  });
}

/**
 * Run a sequence of quality gates.
 *
 * Gates run in order. A required gate failure stops execution: later gates
 * do not run and do not appear in the results. A non-required gate failure
 * is reported and execution continues with the next gate.
 *
 * @param {Array<{ name: string, script: string, required?: boolean, skipIfMissing?: boolean }>} gates
 * @param {{ cwd?: string, emit?: (event: string, payload: object) => void }} [options]
 * @returns {Promise<{ status: "pass" | "fail", results: Array<object> }>}
 *
 * The aggregate status is "fail" only when a required gate fails. A failing
 * gate with required set to false is reported in results and does not block.
 */
export async function runGates(gates, { cwd = process.cwd(), emit = noop } = {}) {
  validateGatesConfig(gates);

  const packageManager = await detectPackageManager({ cwd });
  const results = [];
  let overallStatus = "pass";

  for (const gate of gates) {
    const required = gate.required !== false;
    const skipIfMissing = gate.skipIfMissing !== false;

    emit("stage.started", { stage: gate.name });

    const scriptExists = await hasScript(gate.script, { cwd });

    if (!scriptExists) {
      if (skipIfMissing) {
        const reason = `No "${gate.script}" script exists and the gate allows skipIfMissing.`;
        emit("stage.skipped", { stage: gate.name, reason });
        results.push({ name: gate.name, status: "skipped", required, durationMs: 0, reason });
        continue;
      }

      const message = `No "${gate.script}" script exists and the gate does not allow skipIfMissing.`;
      emit("stage.failed", { stage: gate.name, durationMs: 0, message });
      results.push({ name: gate.name, status: "failed", required, durationMs: 0, reason: message });
      if (required) {
        overallStatus = "fail";
        break;
      }
      continue;
    }

    const outcome = await runScript(packageManager, gate.script, { cwd, emit, stage: gate.name });

    if (outcome.success) {
      emit("stage.passed", { stage: gate.name, durationMs: outcome.durationMs });
      results.push({ name: gate.name, status: "passed", required, durationMs: outcome.durationMs });
      continue;
    }

    emit("stage.failed", { stage: gate.name, durationMs: outcome.durationMs, message: outcome.message });
    results.push({
      name: gate.name,
      status: "failed",
      required,
      durationMs: outcome.durationMs,
      reason: outcome.message,
    });

    if (required) {
      overallStatus = "fail";
      break;
    }
  }

  return { status: overallStatus, results };
}

/**
 * Run a single package script with the given package manager and stream
 * its output line by line through emit as stage.log events.
 *
 * @param {"pnpm" | "npm"} packageManager
 * @param {string} script
 * @param {{ cwd: string, emit: Function, stage: string }} options
 * @returns {Promise<{ success: boolean, durationMs: number, message?: string }>}
 */
function runScript(packageManager, script, { cwd, emit, stage }) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(packageManager, ["run", script], {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let sawError = null;

    const forwardLines = (stream) => {
      let buffer = "";
      stream.on("data", (chunk) => {
        buffer += chunk.toString("utf8");
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          emit("stage.log", { stage, line });
        }
      });
      stream.on("end", () => {
        if (buffer.length > 0) {
          emit("stage.log", { stage, line: buffer });
          buffer = "";
        }
      });
    };

    forwardLines(child.stdout);
    forwardLines(child.stderr);

    child.on("error", (error) => {
      sawError = error;
    });

    child.on("close", (code) => {
      const durationMs = Date.now() - startedAt;
      if (sawError) {
        resolve({ success: false, durationMs, message: sawError.message });
        return;
      }
      if (code === 0) {
        resolve({ success: true, durationMs });
        return;
      }
      resolve({ success: false, durationMs, message: `"${script}" exited with code ${code}.` });
    });
  });
}

async function readPackageJson(cwd) {
  const packageJsonPath = path.join(cwd, "package.json");
  try {
    const raw = await readFile(packageJsonPath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function pathExists(targetPath) {
  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}
