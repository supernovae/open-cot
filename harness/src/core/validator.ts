/**
 * Runtime trace validator — validates emitted traces against the JSON Schemas
 * in the repo's schemas/ directory using Ajv.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { Trace } from "../schemas/trace.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCHEMAS_DIR = resolve(__dirname, "../../../schemas");

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Lazy-loaded compiled validator for the cognitive pipeline schema.
let _traceValidate: ((data: unknown) => boolean) | null = null;
let _traceErrors: (() => Array<{ instancePath?: string; message?: string }>) | null = null;

async function ensureTraceValidator(): Promise<void> {
  if (_traceValidate) return;
  const AjvMod = await import("ajv");
  const formatsMod = await import("ajv-formats");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ajv = (AjvMod as any).default ?? AjvMod;
  const addFormats = (formatsMod as any).default ?? formatsMod;
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const schema = loadSchema("rfc-0007-cognitive-pipeline.json");
  const validate = ajv.compile(schema);
  _traceValidate = (data: unknown) => validate(data) as boolean;
  _traceErrors = () =>
    (validate.errors ?? []) as Array<{ instancePath?: string; message?: string }>;
}

function loadSchema(filename: string): Record<string, unknown> {
  const path = resolve(SCHEMAS_DIR, filename);
  return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
}

/**
 * Validate a trace against the cognitive pipeline schema.
 */
export async function validateTrace(trace: Trace): Promise<ValidationResult> {
  await ensureTraceValidator();
  const valid = _traceValidate!(trace);
  if (valid) {
    return { valid: true, errors: [] };
  }
  return {
    valid: false,
    errors: _traceErrors!().map(
      (e) => `${e.instancePath || "/"}: ${e.message ?? "unknown error"}`,
    ),
  };
}

/**
 * Validate that every action step with a tool_invocation has a matching
 * observation step with parent pointing back to it.
 */
export function validateActionObservationPairing(trace: Trace): ValidationResult {
  const errors: string[] = [];
  const observationParents = new Set(
    trace.steps
      .filter((s) => s.type === "observation" && s.parent)
      .map((s) => (Array.isArray(s.parent) ? s.parent[0] : s.parent)),
  );

  for (const step of trace.steps) {
    if (step.type === "action" && step.tool_invocation) {
      if (!observationParents.has(step.id)) {
        errors.push(
          `Action step "${step.id}" has tool_invocation but no matching observation step`,
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate that the trace has a valid termination status.
 */
export function validateTermination(trace: Trace): ValidationResult {
  const errors: string[] = [];
  if (!trace.termination) {
    errors.push("Trace is missing termination status");
  }
  if (trace.termination === "running") {
    errors.push("Trace terminated with status 'running' — should be a final status");
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Run all validations on a trace and return combined results.
 */
export async function validateFull(trace: Trace): Promise<ValidationResult> {
  const schemaResult = await validateTrace(trace);
  const pairingResult = validateActionObservationPairing(trace);
  const terminationResult = validateTermination(trace);

  const allErrors = [
    ...schemaResult.errors,
    ...pairingResult.errors,
    ...terminationResult.errors,
  ];
  return { valid: allErrors.length === 0, errors: allErrors };
}
