/**
 * Re-export tool types from schemas for convenience, plus helpers for
 * building tool contracts.
 */

export type {
  ToolContract,
  ToolResult,
  ErrorCategory,
  ToolCallRecord,
} from "../schemas/tool-invocation.js";

import type { ToolContract } from "../schemas/tool-invocation.js";

export function defineToolContract(
  partial: Partial<ToolContract> & Pick<ToolContract, "name" | "description">,
): ToolContract {
  return {
    inputSchema: {},
    expectedSideEffects: [],
    timeoutMs: 10_000,
    idempotent: true,
    retryable: true,
    failureTypes: ["internal_error"],
    ...partial,
  };
}
