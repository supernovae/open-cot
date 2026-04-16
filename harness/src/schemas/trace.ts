/**
 * Open CoT Trace types — RFC 0001 (Reasoning) + RFC 0007 (Agent Loop).
 *
 * These mirror the JSON Schemas in schemas/rfc-0001-reasoning.json and
 * schemas/rfc-0007-agent-loop.json.
 */

export type StepType =
  | "thought"
  | "action"
  | "observation"
  | "critique"
  | "plan"
  | "verify"
  | "summarize";

export type VerificationStatus = "verified" | "failed" | "unknown";

export type CompletionStatus =
  | "running"
  | "succeeded"
  | "failed"
  | "budget_exhausted"
  | "external_stop";

export interface ToolInvocationResult {
  output: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolInvocation {
  tool_name: string;
  arguments: Record<string, unknown>;
  triggered_by_step: string;
  observation_step?: string;
  result?: ToolInvocationResult;
}

export interface Step {
  id: string;
  type: StepType;
  content: string;
  parent?: string | string[];
  children?: string[];
  evidence?: string[];
  confidence?: number;
  verification_status?: VerificationStatus;
  verifier_score?: number;
  tool_invocation?: ToolInvocation;
}

export interface Trace {
  version: string;
  task: string;
  steps: Step[];
  final_answer: string;
  termination?: CompletionStatus;
}
