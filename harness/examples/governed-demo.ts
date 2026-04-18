#!/usr/bin/env npx tsx
/**
 * Governed agent demo — run with `npx tsx examples/governed-demo.ts`
 *
 * Shows the full governed execution flow: the model requests permission,
 * the policy engine evaluates, the auth broker narrows scope, tools
 * execute with granted authority, and everything is sealed in an audit
 * envelope.
 *
 * Try different scenarios:
 *   npx tsx examples/governed-demo.ts                           # search (allowed)
 *   npx tsx examples/governed-demo.ts "calculate 2+2"           # calculator (allowed)
 *   npx tsx examples/governed-demo.ts "search for open source"  # search (allowed)
 *   npx tsx examples/governed-demo.ts --deny "search for info"  # search (denied by policy)
 */

import { runGovernedAgent } from "../src/agents/governed-agent.js";
import type { GovernedAgentConfig } from "../src/agents/governed-agent.js";
import { MockLLMBackend } from "../src/backends/mock.js";
import { OpenAICompatBackend } from "../src/backends/openai-compat.js";
import { createMockToolRegistry } from "../src/tools/mock-tools.js";
import type { PolicySet } from "../src/governance/policy-evaluator.js";
import type { LLMBackend } from "../src/backends/types.js";

function pickBackend(): LLMBackend {
  if (process.env["OPENAI_BASE_URL"] || process.env["OPENAI_API_KEY"]) {
    console.log("Using OpenAI-compatible backend");
    return new OpenAICompatBackend();
  }
  console.log("Using mock backend (set OPENAI_BASE_URL for real LLM)");
  return new MockLLMBackend();
}

const ALLOW_ALL_POLICY: PolicySet = {
  policy_id: "default-allow",
  policy_type: "operational",
  rules: [
    {
      rule_id: "allow-all-tools",
      action: "allow",
      resource: "tool:*",
    },
  ],
  priority: 100,
};

const DENY_SEARCH_POLICY: PolicySet = {
  policy_id: "restrict-search",
  policy_type: "safety",
  rules: [
    {
      rule_id: "deny-search",
      action: "deny",
      resource: "tool:search",
      reason: "Search access is restricted by organizational policy",
    },
  ],
  priority: 1,
};

const NARROW_SEARCH_POLICY: PolicySet = {
  policy_id: "narrow-search",
  policy_type: "compliance",
  rules: [
    {
      rule_id: "narrow-search-results",
      action: "narrow",
      resource: "tool:search",
      narrowing: {
        max_results: 5,
        excluded_fields: ["raw_html", "cached_page"],
      },
      reason: "Search results narrowed for compliance — no raw HTML or cached pages",
    },
  ],
  priority: 10,
};

async function main() {
  const args = process.argv.slice(2);
  const denyMode = args.includes("--deny");
  const narrowMode = args.includes("--narrow");
  const filtered = args.filter((a) => !a.startsWith("--"));
  const question = filtered[0] ?? "Search for the population of Tokyo and calculate its square root.";

  const policies: PolicySet[] = [ALLOW_ALL_POLICY];
  let mode = "ALLOW ALL";

  if (denyMode) {
    policies.unshift(DENY_SEARCH_POLICY);
    mode = "DENY SEARCH";
  } else if (narrowMode) {
    policies.unshift(NARROW_SEARCH_POLICY);
    mode = "NARROW SEARCH";
  }

  console.log(`\n--- Governed Agent Demo ---`);
  console.log(`Policy mode: ${mode}`);
  console.log(`Question: ${question}\n`);

  const config: GovernedAgentConfig = {
    objective: question,
    backend: pickBackend(),
    toolRegistry: createMockToolRegistry(),
    policies,
    agentId: "demo-agent-01",
  };

  const { trace, envelope, state } = await runGovernedAgent(config);

  console.log(`\n--- Result ---`);
  console.log(`Answer: ${trace.final_answer}`);
  console.log(`Completion: ${trace.termination}`);
  console.log(`Steps: ${trace.steps.length}`);

  console.log(`\n--- FSM Transitions ---`);
  const transitions = trace.steps
    .filter((s) => s.content.startsWith("[transition]"))
    .map((s) => s.content.replace("[transition] ", ""));
  for (const t of transitions) {
    console.log(`  ${t}`);
  }

  if (state.capabilityManifest) {
    console.log(`\n--- Capability Manifest (injected at ${state.capabilityManifest.phase}) ---`);
    console.log(`Tools available: ${state.capabilityManifest.tools.available.map((t) => `${t.name} (${t.access_level})`).join(", ")}`);
    if (state.capabilityManifest.tools.blocked.length > 0) {
      console.log(`Tools blocked: ${state.capabilityManifest.tools.blocked.join(", ")}`);
    }
    console.log(`Budget: ${state.capabilityManifest.budget.steps_remaining} steps, ${state.capabilityManifest.budget.tool_calls_remaining} tool calls remaining`);
    console.log(`Trust level: ${state.capabilityManifest.trust_level}`);
    if (state.capabilityManifest.active_constraints.length > 0) {
      console.log(`Constraints: ${state.capabilityManifest.active_constraints.join("; ")}`);
    }
  }

  console.log(`\n--- Governance Summary ---`);
  console.log(`Delegation requests: ${state.delegationRequests.length}`);
  console.log(`Delegation decisions: ${state.delegationDecisions.length}`);
  for (const d of state.delegationDecisions) {
    console.log(`  - ${d.request_id}: ${d.status}${d.denial_reason ? ` (${d.denial_reason})` : ""}${d.narrowed_scope ? ` (narrowed)` : ""}`);
  }
  console.log(`Authority receipts: ${state.authorityReceipts.length}`);
  console.log(`Tool execution receipts: ${state.toolExecutionReceipts.length}`);
  console.log(`Active permissions: ${state.activePermissions.filter((p) => p.status === "active").length}`);

  console.log(`\n--- Audit Envelope ---`);
  console.log(`Envelope ID: ${envelope.envelope_id}`);
  console.log(`Completion: ${envelope.completion_status}`);
  console.log(`Trace hash: ${envelope.trace_hash.slice(0, 16)}...`);
  console.log(`Integrity: ${envelope.integrity.content_hash.slice(0, 16)}...`);
  console.log(`Delegation: ${JSON.stringify(envelope.delegation_summary)}`);
  console.log(`Permissions: ${JSON.stringify(envelope.permission_summary)}`);

  if (process.argv.includes("--trace")) {
    console.log(`\n--- Full Trace (JSON) ---`);
    console.log(JSON.stringify(trace, null, 2));
  }

  if (process.argv.includes("--envelope")) {
    console.log(`\n--- Full Envelope (JSON) ---`);
    console.log(JSON.stringify(envelope, null, 2));
  }

  if (process.argv.includes("--manifest") && state.capabilityManifest) {
    console.log(`\n--- Full Manifest (JSON) ---`);
    console.log(JSON.stringify(state.capabilityManifest, null, 2));
  }
}

main().catch(console.error);
