/**
 * Agent state — the single mutable object that an agent loop carries through
 * every transition. Designed so the full state can be serialized for
 * checkpointing and replay (RFC 0007).
 */

import { randomUUID } from "node:crypto";
import type { Phase } from "../schemas/agent-loop.js";
import { VALID_TRANSITIONS } from "../schemas/agent-loop.js";
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

export interface AgentState {
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

export interface AgentStateInit {
  objective: string;
  budgetPolicy?: BudgetPolicy;
  sandbox?: SandboxConfig;
  agentId?: string;
}

export function createAgentState(init: AgentStateInit): AgentState {
  const policy = init.budgetPolicy ?? DEFAULT_BUDGET_POLICY;
  const agentId = init.agentId ?? `agent-${randomUUID().slice(0, 8)}`;
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
    telemetry: createInitialTelemetry(agentId),
    delegationRequests: [],
    delegationDecisions: [],
    authorityReceipts: [],
    activePermissions: [],
    toolExecutionReceipts: [],
  };
}
