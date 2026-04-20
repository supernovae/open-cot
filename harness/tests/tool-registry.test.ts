import { describe, expect, it } from "vitest";
import { ToolRegistry } from "../src/core/tool-registry.js";
import { defineToolContract } from "../src/tools/tool-types.js";
import { DEFAULT_SANDBOX_CONFIG } from "../src/schemas/sandbox.js";

describe("ToolRegistry authority and argument enforcement", () => {
  it("rejects arguments that violate input schema", async () => {
    const registry = new ToolRegistry();
    registry.register(
      defineToolContract({
        name: "search",
        description: "Search records",
        inputSchema: {
          type: "object",
          required: ["query"],
          properties: {
            query: { type: "string" },
          },
          additionalProperties: false,
        },
      }),
      () => ({ output: { ok: true } }),
    );

    const result = await registry.call(
      "search",
      {},
      DEFAULT_SANDBOX_CONFIG,
      { kind: "standing" },
    );
    expect(result.errorCategory).toBe("invalid_input");
    expect(result.error).toContain("Invalid arguments");
  });

  it("blocks receipt-based calls when permission is invalid", async () => {
    const registry = new ToolRegistry();
    let executed = false;
    registry.register(
      defineToolContract({
        name: "search",
        description: "Search records",
        inputSchema: {
          type: "object",
          required: ["query"],
          properties: {
            query: { type: "string" },
          },
        },
      }),
      () => {
        executed = true;
        return { output: { ok: true } };
      },
    );

    const result = await registry.call(
      "search",
      { query: "tokyo" },
      DEFAULT_SANDBOX_CONFIG,
      {
        kind: "receipt",
        permissionId: "perm-1",
        grantedScope: { resource: "tool:search", action: "execute" },
        isPermissionValid: () => false,
      },
    );

    expect(result.errorCategory).toBe("permission_denied");
    expect(result.error).toContain("not active");
    expect(executed).toBe(false);
  });

  it("enforces granted scope constraints on arguments", async () => {
    const registry = new ToolRegistry();
    registry.register(
      defineToolContract({
        name: "search",
        description: "Search records",
        inputSchema: {
          type: "object",
          required: ["query"],
          properties: {
            query: { type: "string" },
            user_email: { type: "string" },
          },
        },
      }),
      () => ({ output: { ok: true } }),
    );

    const result = await registry.call(
      "search",
      { query: "tokyo", user_email: "x@example.com" },
      DEFAULT_SANDBOX_CONFIG,
      {
        kind: "receipt",
        permissionId: "perm-2",
        grantedScope: {
          resource: "tool:search",
          action: "execute",
          constraints: {
            excluded_fields: ["user_email"],
          },
        },
        isPermissionValid: () => true,
      },
    );

    expect(result.errorCategory).toBe("permission_denied");
    expect(result.error).toContain("excluded_fields");
  });

  it("executes when receipt scope and arguments are valid", async () => {
    const registry = new ToolRegistry();
    registry.register(
      defineToolContract({
        name: "search",
        description: "Search records",
        inputSchema: {
          type: "object",
          required: ["query"],
          properties: {
            query: { type: "string" },
            max_results: { type: "integer" },
          },
        },
      }),
      () => ({ output: { answer: "ok" } }),
    );

    const result = await registry.call(
      "search",
      { query: "tokyo", max_results: 2 },
      DEFAULT_SANDBOX_CONFIG,
      {
        kind: "receipt",
        permissionId: "perm-3",
        grantedScope: {
          resource: "tool:search",
          action: "execute",
          constraints: {
            max_results: 5,
          },
        },
        isPermissionValid: () => true,
      },
    );

    expect(result.error).toBeUndefined();
    expect(result.output).toEqual({ answer: "ok" });
  });
});
