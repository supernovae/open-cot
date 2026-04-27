/**
 * Capability Manifest types — RFC 0049.
 *
 * A harness-compiled briefing injected into the model's context at key FSM
 * states. Tells the model what tools are available, what constraints apply,
 * and how much budget remains — so it doesn't waste tokens guessing.
 */

export type ToolAccessLevel = "pre_authorized" | "requires_delegation";

export interface ManifestToolEntry {
  name: string;
  description: string;
  access_level: ToolAccessLevel;
  idempotent?: boolean;
  constraints?: Record<string, unknown>;
}

export interface ManifestBudget {
  steps_remaining: number;
  tool_calls_remaining: number;
  tokens_remaining: number;
  retries_remaining: number;
}

export interface CapabilityManifest {
  manifest_id: string;
  run_id: string;
  requester_id: string;
  timestamp: string;
  phase: string;
  tools: {
    available: ManifestToolEntry[];
    blocked: string[];
  };
  budget: ManifestBudget;
  trust_level: "untrusted" | "low" | "medium" | "high";
  active_constraints: string[];
}
