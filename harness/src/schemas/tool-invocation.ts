/**
 * Tool invocation types — RFC 0003.
 *
 * Defines structured tool call contracts, result shapes, and error taxonomy
 * aligned with RFC 0018.
 */

export type ErrorCategory =
  | "timeout"
  | "invalid_input"
  | "not_found"
  | "permission_denied"
  | "rate_limit"
  | "internal_error"
  | "unknown";

export interface ToolResult {
  output: unknown;
  error?: string;
  errorCategory?: ErrorCategory;
  metadata?: Record<string, unknown>;
  latencyMs?: number;
}

export interface ToolContract {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  expectedSideEffects: string[];
  timeoutMs: number;
  idempotent: boolean;
  retryable: boolean;
  failureTypes: ErrorCategory[];
}

export interface ToolCallRecord {
  toolName: string;
  arguments: Record<string, unknown>;
  triggeredByStep: string;
  result: ToolResult;
  startedAt: string;
  durationMs: number;
}
