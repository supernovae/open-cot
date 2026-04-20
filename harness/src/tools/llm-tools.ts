import type { LLMToolDefinition } from "../backends/types.js";
import type { ToolContract } from "../schemas/tool-invocation.js";

export function toLLMToolDefinitions(
  contracts: ToolContract[],
  allowlist?: ReadonlySet<string>,
): LLMToolDefinition[] {
  return contracts
    .filter((contract) => (allowlist ? allowlist.has(contract.name) : true))
    .map((contract) => ({
      name: contract.name,
      description: contract.description,
      inputSchema: contract.inputSchema,
    }));
}
