/**
 * Mock tool implementations — deterministic tools for CI and demos.
 *
 * Provides: search, calculator, readFile, writeFile, runTests.
 */

import type { ToolResult } from "../schemas/tool-invocation.js";
import { ToolRegistry } from "../core/tool-registry.js";
import type { ToolHandler } from "../core/tool-registry.js";
import { defineToolContract } from "./tool-types.js";

const SEARCH_DB: Record<string, string> = {
  "population of tokyo": "Tokyo has a population of approximately 13.96 million people.",
  "capital of france": "The capital of France is Paris.",
  "speed of light": "The speed of light is approximately 299,792,458 meters per second.",
  "relevant information": "Here is the relevant information you requested.",
};

const searchHandler: ToolHandler = (args) => {
  const query = String(args["query"] ?? "").toLowerCase().trim();
  const match = SEARCH_DB[query];
  if (match) {
    return { output: { answer: match, source: "mock-knowledge-base" } };
  }
  return {
    output: null,
    error: `No results found for: ${query}`,
    errorCategory: "not_found",
  };
};

const calculatorHandler: ToolHandler = (args) => {
  const expr = String(args["expression"] ?? "");
  try {
    const sanitized = expr.replace(/[^0-9+\-*/().sqrt\s]/g, "");
    const sqrtReplaced = sanitized.replace(
      /sqrt\(([^)]+)\)/g,
      "Math.sqrt($1)",
    );
    const result = new Function(`return ${sqrtReplaced}`)() as number;
    if (typeof result !== "number" || isNaN(result)) {
      return { output: null, error: `Invalid result for: ${expr}` };
    }
    return { output: { value: result, expression: expr } };
  } catch {
    return {
      output: null,
      error: `Failed to evaluate: ${expr}`,
      errorCategory: "invalid_input",
    };
  }
};

const FILE_SYSTEM: Map<string, string> = new Map([
  [
    "src/main.ts",
    'import { greet } from "./utils";\n\nconsole.log(greet("world"));\n',
  ],
  [
    "src/utils.ts",
    'export function greet(name: string): string {\n  return `Hello, ${name}!`;\n}\n',
  ],
]);

const readFileHandler: ToolHandler = (args) => {
  const path = String(args["path"] ?? "");
  const content = FILE_SYSTEM.get(path);
  if (content !== undefined) {
    return { output: { path, content } };
  }
  return {
    output: null,
    error: `File not found: ${path}`,
    errorCategory: "not_found",
  };
};

const writeFileHandler: ToolHandler = (args) => {
  const path = String(args["path"] ?? "");
  const content = String(args["content"] ?? "");
  FILE_SYSTEM.set(path, content);
  return {
    output: { path, bytesWritten: content.length },
  };
};

const runTestsHandler: ToolHandler = (args) => {
  const target = String(args["target"] ?? "all");
  return {
    output: {
      target,
      passed: 3,
      failed: 0,
      total: 3,
      summary: "All tests passed",
    },
  };
};

export function createMockToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register(
    defineToolContract({
      name: "search",
      description: "Search a knowledge base for information",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
      idempotent: true,
      retryable: true,
      failureTypes: ["not_found", "timeout"],
    }),
    searchHandler,
  );

  registry.register(
    defineToolContract({
      name: "calculator",
      description: "Evaluate a mathematical expression",
      inputSchema: {
        type: "object",
        properties: { expression: { type: "string" } },
        required: ["expression"],
      },
      idempotent: true,
      retryable: false,
      failureTypes: ["invalid_input"],
    }),
    calculatorHandler,
  );

  registry.register(
    defineToolContract({
      name: "readFile",
      description: "Read the contents of a file",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
      },
      idempotent: true,
      retryable: true,
      failureTypes: ["not_found", "permission_denied"],
    }),
    readFileHandler,
  );

  registry.register(
    defineToolContract({
      name: "writeFile",
      description: "Write content to a file",
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
      },
      expectedSideEffects: ["filesystem_write"],
      idempotent: false,
      retryable: false,
      failureTypes: ["permission_denied", "internal_error"],
    }),
    writeFileHandler,
  );

  registry.register(
    defineToolContract({
      name: "runTests",
      description: "Run the test suite or a specific test target",
      inputSchema: {
        type: "object",
        properties: { target: { type: "string" } },
      },
      expectedSideEffects: ["process_execution"],
      idempotent: true,
      retryable: true,
      failureTypes: ["timeout", "internal_error"],
    }),
    runTestsHandler,
  );

  return registry;
}

export function resetMockFileSystem(): void {
  FILE_SYSTEM.clear();
  FILE_SYSTEM.set(
    "src/main.ts",
    'import { greet } from "./utils";\n\nconsole.log(greet("world"));\n',
  );
  FILE_SYSTEM.set(
    "src/utils.ts",
    'export function greet(name: string): string {\n  return `Hello, ${name}!`;\n}\n',
  );
}

export function getMockFileSystem(): ReadonlyMap<string, string> {
  return FILE_SYSTEM;
}
