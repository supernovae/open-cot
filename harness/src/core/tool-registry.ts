/**
 * Tool registry — RFC 0003 + RFC 0016 (Tool Capability Negotiation).
 *
 * Maintains a registry of tool contracts and dispatches calls with contract
 * validation, timeout enforcement, and structured result capture.
 */

import type { ToolContract, ToolResult, ErrorCategory } from "../schemas/tool-invocation.js";
import type { SandboxConfig } from "../schemas/sandbox.js";
import type { RequestedScope } from "../schemas/delegation.js";

export type ToolHandler = (
  args: Record<string, unknown>,
) => Promise<ToolResult> | ToolResult;

interface RegisteredTool {
  contract: ToolContract;
  handler: ToolHandler;
}

interface ValidationErrorItem {
  instancePath?: string;
  message?: string;
}

type JsonSchemaValidator = ((data: unknown) => boolean) & {
  errors?: ValidationErrorItem[];
};

type ValidatorFactory = (schema: Record<string, unknown>) => JsonSchemaValidator;

export interface ToolExecutionAuthority {
  kind: "standing" | "receipt";
  permissionId?: string;
  grantedScope?: RequestedScope;
  isPermissionValid?: (permissionId: string) => boolean;
}

export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>();
  private argValidators = new Map<string, JsonSchemaValidator>();
  private validatorFactoryPromise: Promise<ValidatorFactory> | null = null;

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
    authority?: ToolExecutionAuthority,
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
    const argError = await this.validateArguments(contract, args);
    if (argError) {
      return {
        output: null,
        error: argError,
        errorCategory: "invalid_input",
      };
    }

    const authorityError = this.validateAuthority(name, args, authority);
    if (authorityError) {
      return {
        output: null,
        error: authorityError,
        errorCategory: "permission_denied",
      };
    }

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

  private async validateArguments(
    contract: ToolContract,
    args: Record<string, unknown>,
  ): Promise<string | null> {
    const validator = await this.getArgValidator(contract);
    if (validator(args)) {
      return null;
    }

    const details = (validator.errors ?? [])
      .slice(0, 3)
      .map((err) => `${err.instancePath || "/"} ${err.message ?? "invalid"}`)
      .join("; ");
    const suffix = details ? ` (${details})` : "";
    return `Invalid arguments for tool "${contract.name}"${suffix}`;
  }

  private validateAuthority(
    toolName: string,
    args: Record<string, unknown>,
    authority?: ToolExecutionAuthority,
  ): string | null {
    if (!authority || authority.kind === "standing") {
      return null;
    }

    if (!authority.permissionId || !authority.grantedScope) {
      return `Missing authority receipt context for tool "${toolName}"`;
    }

    if (
      authority.isPermissionValid &&
      !authority.isPermissionValid(authority.permissionId)
    ) {
      return `Permission "${authority.permissionId}" is not active`;
    }

    if (!scopeResourceMatches(toolName, authority.grantedScope.resource)) {
      return `Granted scope "${authority.grantedScope.resource}" does not permit tool "${toolName}"`;
    }

    if (authority.grantedScope.action !== "execute") {
      return `Granted scope action "${authority.grantedScope.action}" cannot execute tool "${toolName}"`;
    }

    return this.validateScopeConstraints(toolName, args, authority.grantedScope);
  }

  private validateScopeConstraints(
    toolName: string,
    args: Record<string, unknown>,
    scope: RequestedScope,
  ): string | null {
    const constraints = scope.constraints;
    if (!constraints) {
      return null;
    }

    const argKeys = Object.keys(args);
    const allowedFields = readStringArray(constraints["allowed_fields"]);
    if (allowedFields) {
      const disallowed = argKeys.filter((key) => !allowedFields.includes(key));
      if (disallowed.length > 0) {
        return `Tool "${toolName}" arguments violate allowed_fields: ${disallowed.join(", ")}`;
      }
    }

    const excludedFields = readStringArray(constraints["excluded_fields"]);
    if (excludedFields) {
      const forbidden = argKeys.filter((key) => excludedFields.includes(key));
      if (forbidden.length > 0) {
        return `Tool "${toolName}" arguments include excluded_fields: ${forbidden.join(", ")}`;
      }
    }

    const maxResults = readFiniteNumber(constraints["max_results"]);
    if (maxResults !== undefined) {
      const rawMaxResults = args["max_results"];
      if (typeof rawMaxResults === "number" && rawMaxResults > maxResults) {
        return `Tool "${toolName}" requested max_results=${rawMaxResults}, exceeds ${maxResults}`;
      }
      const rawLimit = args["limit"];
      if (typeof rawLimit === "number" && rawLimit > maxResults) {
        return `Tool "${toolName}" requested limit=${rawLimit}, exceeds ${maxResults}`;
      }
    }

    return null;
  }

  private async getArgValidator(
    contract: ToolContract,
  ): Promise<JsonSchemaValidator> {
    const cached = this.argValidators.get(contract.name);
    if (cached) {
      return cached;
    }

    const factory = await this.getValidatorFactory();
    const validate = factory(contract.inputSchema);
    this.argValidators.set(contract.name, validate);
    return validate;
  }

  private async getValidatorFactory(): Promise<ValidatorFactory> {
    if (!this.validatorFactoryPromise) {
      this.validatorFactoryPromise = (async () => {
        const AjvMod = await import("ajv");
        const formatsMod = await import("ajv-formats");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const Ajv = (AjvMod as any).default ?? AjvMod;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const addFormats = (formatsMod as any).default ?? formatsMod;
        const ajv = new (Ajv as new (opts: Record<string, unknown>) => {
          compile: (schema: Record<string, unknown>) => JsonSchemaValidator;
        })({
          allErrors: true,
          strict: false,
        });
        addFormats(ajv);
        return (schema: Record<string, unknown>) => ajv.compile(schema);
      })();
    }
    return this.validatorFactoryPromise;
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

function scopeResourceMatches(toolName: string, resource: string): boolean {
  const expected = `tool:${toolName}`;
  if (resource === expected || resource === "tool:*") {
    return true;
  }
  if (resource.endsWith("*")) {
    const prefix = resource.slice(0, -1);
    return expected.startsWith(prefix);
  }
  return false;
}

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const parsed = value.filter((item): item is string => typeof item === "string");
  if (parsed.length !== value.length) {
    return null;
  }
  return parsed;
}

function readFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}
