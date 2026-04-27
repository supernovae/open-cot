/**
 * Cognitive pipeline state - the single mutable object carried through
 * every transition. Designed so the full state can be serialized for
 * checkpointing and replay (RFC 0007).
 */

import { randomUUID } from "node:crypto";
import type { Phase } from "../schemas/cognitive-pipeline.js";
import { VALID_TRANSITIONS } from "../schemas/cognitive-pipeline.js";
import type { BudgetPolicy, BudgetSnapshot } from "../schemas/budget.js";
import {
  createInitialSnapshot,
  DEFAULT_BUDGET_POLICY,
} from "../schemas/budget.js";
import type { SandboxConfig } from "../schemas/sandbox.js";
import { DEFAULT_SANDBOX_CONFIG } from "../schemas/sandbox.js";
import type { TelemetryRecord } from "../schemas/telemetry.js";
import { createInitialTelemetry } from "../schemas/telemetry.js";
import type { CompletionStatus, Trace } from "../schemas/trace.js";
import type { DelegationRequest, DelegationDecision, AuthorityReceipt } from "../schemas/delegation.js";
import type { PermissionGrant } from "../schemas/permission.js";
import type { ToolExecutionReceipt } from "../schemas/receipt.js";
import type { CapabilityManifest } from "../schemas/capability-manifest.js";

export interface PipelineState {
  runId: string;
  objective: string;
  currentSubtask: string | null;
  phase: Phase;
  planVersion: number;
  blockers: string[];
  evidenceCollected: string[];
  lastAction: string | null;
  nextAllowedPhases: Phase[];
  budget: BudgetSnapshot;
  budgetPolicy: BudgetPolicy;
  sandbox: SandboxConfig;
  completionStatus: CompletionStatus;
  trace: Trace;
  telemetry: TelemetryRecord;

  delegationRequests: DelegationRequest[];
  delegationDecisions: DelegationDecision[];
  authorityReceipts: AuthorityReceipt[];
  activePermissions: PermissionGrant[];
  toolExecutionReceipts: ToolExecutionReceipt[];
  capabilityManifest?: CapabilityManifest;
}

export interface PipelineStateInit {
  objective: string;
  budgetPolicy?: BudgetPolicy;
  sandbox?: SandboxConfig;
  requesterId?: string;
}

export function createPipelineState(init: PipelineStateInit): PipelineState {
  const policy = init.budgetPolicy ?? DEFAULT_BUDGET_POLICY;
  const requesterId = init.requesterId ?? `cognitive-runtime-${randomUUID().slice(0, 8)}`;
  return {
    runId: randomUUID(),
    objective: init.objective,
    currentSubtask: null,
    phase: "receive",
    planVersion: 0,
    blockers: [],
    evidenceCollected: [],
    lastAction: null,
    nextAllowedPhases: [...VALID_TRANSITIONS.receive],
    budget: createInitialSnapshot(policy),
    budgetPolicy: policy,
    sandbox: init.sandbox ?? DEFAULT_SANDBOX_CONFIG,
    completionStatus: "running",
    trace: {
      version: "0.2",
      task: init.objective,
      steps: [],
      final_answer: "",
    },
    telemetry: createInitialTelemetry(requesterId),
    delegationRequests: [],
    delegationDecisions: [],
    authorityReceipts: [],
    activePermissions: [],
    toolExecutionReceipts: [],
  };
}
