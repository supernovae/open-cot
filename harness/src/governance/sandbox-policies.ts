import type { SandboxConfig } from "../schemas/sandbox.js";
import type { PolicySet, PolicyRule } from "./policy-evaluator.js";

export function buildSandboxPolicySets(sandbox: SandboxConfig): PolicySet[] {
  const policies: PolicySet[] = [];

  const denyRules: PolicyRule[] = sandbox.blockedTools.map((toolName, idx) => ({
    rule_id: `sandbox-deny-${idx + 1}`,
    action: "deny",
    resource: `tool:${toolName}`,
    reason: `Tool "${toolName}" is blocked by sandbox`,
  }));
  if (denyRules.length > 0) {
    policies.push({
      policy_id: "sandbox-deny",
      policy_type: "safety",
      priority: 1,
      rules: denyRules,
    });
  }

  const allowRules = buildAllowRules(sandbox.allowedTools);
  if (allowRules.length > 0) {
    policies.push({
      policy_id: "sandbox-allow",
      policy_type: "operational",
      priority: 100,
      rules: allowRules,
    });
  }

  return policies;
}

function buildAllowRules(allowedTools: string[]): PolicyRule[] {
  if (allowedTools.includes("*")) {
    return [
      {
        rule_id: "sandbox-allow-all",
        action: "allow",
        resource: "tool:*",
      },
    ];
  }
  return allowedTools.map((toolName, idx) => ({
    rule_id: `sandbox-allow-${idx + 1}`,
    action: "allow",
    resource: `tool:${toolName}`,
  }));
}
