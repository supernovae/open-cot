/**
 * Tool registry — RFC 0003 + RFC 0016 (Tool Capability Negotiation).
 *
 * Maintains a registry of tool contracts and dispatches calls with contract
 * validation, timeout enforcement, and structured result capture.
 */

import type { ToolContract, ToolResult, ErrorCategory } from "../schemas/tool-invocation.js";
import type { SandboxConfig } from "../schemas/sandbox.js";

export type ToolHandler = (
  args: Record<string, unknown>,
) => Promise<ToolResult> | ToolResult;

interface RegisteredTool {
  contract: ToolContract;
  handler: ToolHandler;
}

export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>();

  register(contract: ToolContract, handler: ToolHandler): void {
    this.tools.set(contract.name, { contract, handler });
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  getContract(name: string): ToolContract | undefined {
    return this.tools.get(name)?.contract;
  }

  listTools(): ToolContract[] {
    return [...this.tools.values()].map((t) => t.contract);
  }

  /**
   * Call a tool by name, enforcing sandbox rules, timeouts, and contract shape.
   */
  async call(
    name: string,
    args: Record<string, unknown>,
    sandbox: SandboxConfig,
  ): Promise<ToolResult> {
    if (!this.isAllowed(name, sandbox)) {
      return {
        output: null,
        error: `Tool "${name}" is blocked by sandbox policy`,
        errorCategory: "permission_denied",
      };
    }

    const entry = this.tools.get(name);
    if (!entry) {
      return {
        output: null,
        error: `Unknown tool: ${name}`,
        errorCategory: "not_found",
      };
    }

    const { contract, handler } = entry;
    const start = Date.now();

    try {
      const result = await Promise.race([
        Promise.resolve(handler(args)),
        timeout(contract.timeoutMs, name),
      ]);
      return { ...result, latencyMs: Date.now() - start };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const category: ErrorCategory = message.startsWith("Timeout")
        ? "timeout"
        : "internal_error";
      return {
        output: null,
        error: message,
        errorCategory: category,
        latencyMs: Date.now() - start,
      };
    }
  }

  private isAllowed(name: string, sandbox: SandboxConfig): boolean {
    if (sandbox.blockedTools.includes(name)) return false;
    if (
      sandbox.allowedTools.length > 0 &&
      !sandbox.allowedTools.includes("*") &&
      !sandbox.allowedTools.includes(name)
    ) {
      return false;
    }
    return true;
  }
}

function timeout(ms: number, toolName: string): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error(`Timeout after ${ms}ms calling tool "${toolName}"`)),
      ms,
    ),
  );
}
