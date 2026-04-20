/**
 * Capability Manifest builder — RFC 0049.
 *
 * Compiles a structured briefing from the tool registry, sandbox config,
 * policy rules, and budget snapshot. The model never builds this — only the
 * harness does.
 */

import { randomUUID } from "node:crypto";
import type {
  CapabilityManifest,
  ManifestToolEntry,
  ToolAccessLevel,
} from "../schemas/capability-manifest.js";
import type { ToolContract } from "../schemas/tool-invocation.js";
import type { BudgetSnapshot } from "../schemas/budget.js";
import type { SandboxConfig } from "../schemas/sandbox.js";
import type { PolicySet, PolicyRule } from "./policy-evaluator.js";
import type { Phase } from "../schemas/agent-loop.js";

export type WireFormat = "json" | "compact-text" | "toon";

export interface ManifestToolOverride {
  accessLevel: ToolAccessLevel | "blocked";
  constraints?: Record<string, unknown>;
  reason?: string;
}

export interface ManifestInput {
  runId: string;
  agentId: string;
  phase: Phase;
  toolContracts: ToolContract[];
  sandbox: SandboxConfig;
  policies: PolicySet[];
  budget: BudgetSnapshot;
  trustLevel?: "untrusted" | "low" | "medium" | "high";
  toolOverrides?: Record<string, ManifestToolOverride>;
}

function isBlocked(toolName: string, sandbox: SandboxConfig): boolean {
  if (sandbox.blockedTools.includes(toolName)) return true;
  if (
    sandbox.allowedTools.length > 0 &&
    !sandbox.allowedTools.includes("*") &&
    !sandbox.allowedTools.includes(toolName)
  ) {
    return true;
  }
  return false;
}

function findPolicyAction(
  toolName: string,
  policies: PolicySet[],
): { action: string; rule?: PolicyRule } | null {
  const sorted = [...policies].sort((a, b) => a.priority - b.priority);
  for (const policy of sorted) {
    for (const rule of policy.rules) {
      const resource = `tool:${toolName}`;
      if (rule.resource === resource || rule.resource === "tool:*") {
        return { action: rule.action, rule };
      }
    }
  }
  return null;
}

function determineAccessLevel(
  toolName: string,
  sandbox: SandboxConfig,
  policies: PolicySet[],
): ToolAccessLevel | "blocked" {
  if (isBlocked(toolName, sandbox)) return "blocked";

  const policyHit = findPolicyAction(toolName, policies);
  if (policyHit?.action === "deny") return "blocked";

  const isOnAllowlist =
    sandbox.allowedTools.includes("*") ||
    sandbox.allowedTools.includes(toolName);

  if (isOnAllowlist && (!policyHit || policyHit.action === "allow")) {
    return "pre_authorized";
  }

  return "requires_delegation";
}

function collectConstraints(
  toolName: string,
  policies: PolicySet[],
): { constraints: Record<string, unknown>; descriptions: string[] } {
  const constraints: Record<string, unknown> = {};
  const descriptions: string[] = [];
  const sorted = [...policies].sort((a, b) => a.priority - b.priority);

  for (const policy of sorted) {
    for (const rule of policy.rules) {
      const resource = `tool:${toolName}`;
      if (
        (rule.resource === resource || rule.resource === "tool:*") &&
        rule.action === "narrow" &&
        rule.narrowing
      ) {
        if (rule.narrowing.allowed_fields) {
          constraints.allowed_fields = rule.narrowing.allowed_fields;
          descriptions.push(
            `${toolName}: fields limited to ${rule.narrowing.allowed_fields.join(", ")}`,
          );
        }
        if (rule.narrowing.excluded_fields) {
          constraints.excluded_fields = rule.narrowing.excluded_fields;
          descriptions.push(
            `${toolName}: ${rule.narrowing.excluded_fields.join(", ")} excluded`,
          );
        }
        if (rule.narrowing.max_results !== undefined) {
          constraints.max_results = rule.narrowing.max_results;
          descriptions.push(
            `${toolName}: max ${rule.narrowing.max_results} results`,
          );
        }
      }
    }
  }
  return { constraints, descriptions };
}

/**
 * Compile a capability manifest from the current run state.
 */
export function buildManifest(input: ManifestInput): CapabilityManifest {
  const available: ManifestToolEntry[] = [];
  const blocked: string[] = [];
  const activeConstraints: string[] = [];

  for (const contract of input.toolContracts) {
    const override = input.toolOverrides?.[contract.name];
    const level =
      override?.accessLevel ??
      determineAccessLevel(contract.name, input.sandbox, input.policies);

    if (level === "blocked") {
      blocked.push(contract.name);
      if (override?.reason) {
        activeConstraints.push(`${contract.name}: ${override.reason}`);
      }
      continue;
    }

    const {
      constraints,
      descriptions,
    } = override?.constraints
      ? {
          constraints: override.constraints,
          descriptions: describeConstraints(contract.name, override.constraints),
        }
      : collectConstraints(contract.name, input.policies);
    if (override?.reason) {
      descriptions.push(`${contract.name}: ${override.reason}`);
    }
    activeConstraints.push(...descriptions);

    available.push({
      name: contract.name,
      description: contract.description,
      access_level: level,
      idempotent: contract.idempotent,
      constraints: Object.keys(constraints).length > 0 ? constraints : undefined,
    });
  }

  return {
    manifest_id: randomUUID(),
    run_id: input.runId,
    agent_id: input.agentId,
    timestamp: new Date().toISOString(),
    phase: input.phase,
    tools: { available, blocked },
    budget: {
      steps_remaining: input.budget.stepsRemaining,
      tool_calls_remaining: input.budget.toolCallsRemaining,
      tokens_remaining: input.budget.tokensRemaining,
      retries_remaining: input.budget.retriesRemaining,
    },
    trust_level: input.trustLevel ?? "medium",
    active_constraints: activeConstraints,
  };
}

function describeConstraints(
  toolName: string,
  constraints: Record<string, unknown>,
): string[] {
  const descriptions: string[] = [];
  const allowedFields = constraints["allowed_fields"];
  if (Array.isArray(allowedFields) && allowedFields.every((item) => typeof item === "string")) {
    descriptions.push(`${toolName}: fields limited to ${allowedFields.join(", ")}`);
  }
  const excludedFields = constraints["excluded_fields"];
  if (
    Array.isArray(excludedFields) &&
    excludedFields.every((item) => typeof item === "string")
  ) {
    descriptions.push(`${toolName}: ${excludedFields.join(", ")} excluded`);
  }
  if (typeof constraints["max_results"] === "number") {
    descriptions.push(`${toolName}: max ${constraints["max_results"]} results`);
  }
  if (descriptions.length === 0) {
    descriptions.push(`${toolName}: constrained by policy`);
  }
  return descriptions;
}

/**
 * Serialize a manifest to compact text for model-context injection.
 * Designed to be readable by any model without JSON parsing.
 */
export function manifestToCompactText(manifest: CapabilityManifest): string {
  const lines: string[] = ["[capability_manifest]"];

  if (manifest.tools.available.length > 0) {
    const entries = manifest.tools.available.map((t) => {
      const flags: string[] = [t.access_level.replace("_", "-")];
      if (t.idempotent) flags.push("idempotent");
      return `${t.name} (${flags.join(", ")})`;
    });
    lines.push(`tools_available: ${entries.join(", ")}`);
  }

  if (manifest.tools.blocked.length > 0) {
    lines.push(`tools_blocked: ${manifest.tools.blocked.join(", ")}`);
  }

  const b = manifest.budget;
  lines.push(
    `budget: ${b.steps_remaining} steps, ${b.tool_calls_remaining} tool calls, ${b.tokens_remaining} tokens remaining`,
  );

  lines.push(`trust_level: ${manifest.trust_level}`);

  if (manifest.active_constraints.length > 0) {
    lines.push(`constraints: ${manifest.active_constraints.join("; ")}`);
  }

  lines.push("[/capability_manifest]");
  return lines.join("\n");
}

/**
 * Serialize a manifest to TOON (Token-Oriented Object Notation) — RFC 0050.
 *
 * Uses tabular array headers for tools and pipe-delimited budget fields to
 * achieve ~30-40% fewer tokens than the equivalent compact text while
 * remaining human-readable.
 */
export function manifestToToon(manifest: CapabilityManifest): string {
  const lines: string[] = ["[toon:capability_manifest]"];

  if (manifest.tools.available.length > 0) {
    lines.push(
      `tools_available[${manifest.tools.available.length}]{name, access, idempotent}:`,
    );
    for (const t of manifest.tools.available) {
      const access = t.access_level.replace("_", "-");
      const idem = t.idempotent ? "true" : "false";
      lines.push(`${t.name} | ${access} | ${idem}`);
    }
  }

  if (manifest.tools.blocked.length > 0) {
    lines.push(`tools_blocked: ${manifest.tools.blocked.join(", ")}`);
  }

  const b = manifest.budget;
  lines.push(
    `budget{steps, tool_calls, tokens, retries}: ${b.steps_remaining} | ${b.tool_calls_remaining} | ${b.tokens_remaining} | ${b.retries_remaining}`,
  );

  lines.push(`trust_level: ${manifest.trust_level}`);

  if (manifest.active_constraints.length > 0) {
    lines.push(`constraints: ${manifest.active_constraints.join("; ")}`);
  }

  lines.push("[/toon:capability_manifest]");
  return lines.join("\n");
}

/**
 * Select the appropriate manifest serializer based on wire format config.
 */
export function serializeManifest(
  manifest: CapabilityManifest,
  format: WireFormat = "compact-text",
): string {
  switch (format) {
    case "toon":
      return manifestToToon(manifest);
    case "json":
      return JSON.stringify(manifest);
    case "compact-text":
    default:
      return manifestToCompactText(manifest);
  }
}
