/**
 * Execution receipt types — RFC 0048.
 *
 * Tamper-evident records proving what happened during tool execution.
 * Receipts contain hashes, not raw data — safe for compliance sharing.
 */

import type { ErrorCategory } from "./tool-invocation.js";
import type { ReceiptIntegrity } from "./delegation.js";

export type ReceiptStatus = "success" | "error" | "timeout" | "quarantined";

export type PostconditionResult = "passed" | "failed" | "skipped";

export interface ToolExecutionReceipt {
  execution_id: string;
  run_id: string;
  tool_name: string;
  permission_id: string;
  authority_receipt_id: string;
  input_hash: string;
  output_hash: string;
  output_size_bytes?: number;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  status: ReceiptStatus;
  error_category?: ErrorCategory;
  postcondition_check: PostconditionResult;
  postcondition_violation?: string;
  sandbox_state_hash?: string;
  integrity: ReceiptIntegrity;
}
