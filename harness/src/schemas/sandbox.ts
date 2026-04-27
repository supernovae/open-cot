/**
 * Sandbox / safety types — RFC 0017 (Cognitive pipeline Safety & Sandboxing).
 *
 * Defines the sandbox configuration that policy engines consume at run start.
 */

export type Permission = "read" | "write" | "execute" | "admin";

export interface MemoryAcl {
  [roleOrAgentId: string]: Permission[];
}

export interface SandboxConfig {
  allowedTools: string[];
  blockedTools: string[];
  maxSteps: number;
  maxBranches: number;
  memoryAcl: MemoryAcl;
}

export const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  allowedTools: ["*"],
  blockedTools: [],
  maxSteps: 50,
  maxBranches: 5,
  memoryAcl: {
    default: ["read"],
  },
};
