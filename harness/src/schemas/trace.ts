/**
 * Open CoT trace types for the compact cognitive pipeline contract.
 *
 * These mirror the runtime-facing schema in schemas/rfc-0007-cognitive-pipeline.json.
 */

import type { CompletionStatus } from "./audit-envelope.js";

export type StepType =
  | "thought"
  | "action"
  | "observation"
  | "critique"
  | "plan"
  | "verify"
  | "summarize"
  | "delegation_request"
  | "delegation_decision"
  | "denial"
  | "escalation";

export type VerificationStatus = "verified" | "failed" | "unknown";

export { type CompletionStatus } from "./audit-envelope.js";

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
  delegation_requests?: string[];
  delegation_decisions?: string[];
  authority_receipts?: string[];
  tool_execution_receipts?: string[];
  audit_envelope?: string;
}
