/**
 * Mock LLM backend — deterministic responses keyed by prompt patterns.
 *
 * Used in CI tests and demos. Supports canned planning, tool selection,
 * verification, and summarization responses.
 */

import type {
  LLMBackend,
  LLMMessage,
  LLMResponseWithTools,
  ToolCallRequest,
} from "./types.js";

interface MockRoute {
  pattern: RegExp;
  response: string;
  toolCalls?: ToolCallRequest[];
  tokensUsed?: number;
}

export class MockLLMBackend implements LLMBackend {
  readonly name = "mock";
  private routes: MockRoute[] = [];

  constructor(routes?: MockRoute[]) {
    this.routes = routes ?? getDefaultRoutes();
  }

  addRoute(route: MockRoute): void {
    this.routes.push(route);
  }

  async chat(messages: LLMMessage[]): Promise<LLMResponseWithTools> {
    const raw =
      [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

    if (raw.startsWith("[harness:frame]\n")) {
      const body = raw.slice("[harness:frame]\n".length);
      return {
        content: `Framed objective: clarify goals, constraints, and outputs for: ${body.slice(0, 200)}${body.length > 200 ? "…" : ""}`,
        tokensUsed: 28,
        model: "mock",
        finishReason: "stop",
      };
    }

    if (raw.startsWith("[harness:finalize]\n")) {
      return {
        content:
          "Final answer: task completed with verified reasoning and observations where applicable.",
        tokensUsed: 36,
        model: "mock",
        finishReason: "stop",
      };
    }

    if (raw.startsWith("[harness:critique]\n")) {
      return {
        content:
          "Critique/verify: observations support the conclusion; no contradictions detected.",
        tokensUsed: 42,
        model: "mock",
        finishReason: "stop",
      };
    }

    const lastUserMsg = raw.startsWith("[harness:plan]\n")
      ? raw.slice("[harness:plan]\n".length)
      : raw;

    for (const route of this.routes) {
      if (route.pattern.test(lastUserMsg)) {
        return {
          content: route.response,
          tokensUsed: route.tokensUsed ?? 50,
          model: "mock",
          finishReason: route.toolCalls ? "tool_calls" : "stop",
          toolCalls: route.toolCalls,
        };
      }
    }

    return {
      content: "I'll analyze this step by step and provide a direct answer.",
      tokensUsed: 30,
      model: "mock",
      finishReason: "stop",
    };
  }
}

function getDefaultRoutes(): MockRoute[] {
  return [
    {
      pattern: /plan|analyze|break down|step.by.step/i,
      response:
        "Plan:\n1. Gather relevant information\n2. Analyze the data\n3. Formulate conclusion\n4. Verify the result",
      tokensUsed: 60,
    },
    {
      pattern: /search|look up|find/i,
      response: "I need to search for this information.",
      toolCalls: [
        { toolName: "search", arguments: { query: "relevant information" } },
      ],
      tokensUsed: 40,
    },
    {
      pattern: /calculate|compute|math/i,
      response: "Let me calculate this.",
      toolCalls: [
        {
          toolName: "calculator",
          arguments: { expression: "42" },
        },
      ],
      tokensUsed: 35,
    },
    {
      pattern: /read.file|open.file|inspect.file/i,
      response: "I need to read the file to understand the code.",
      toolCalls: [
        { toolName: "readFile", arguments: { path: "src/main.ts" } },
      ],
      tokensUsed: 35,
    },
    {
      pattern: /write.file|edit.file|modify/i,
      response: "I'll make the necessary changes to the file.",
      toolCalls: [
        {
          toolName: "writeFile",
          arguments: {
            path: "src/main.ts",
            content: '// Updated content\nconsole.log("hello");\n',
          },
        },
      ],
      tokensUsed: 45,
    },
    {
      pattern: /fix|repair|bug|error/i,
      response: "I identified the issue and will apply a fix.",
      toolCalls: [
        {
          toolName: "writeFile",
          arguments: {
            path: "src/main.ts",
            content: "// Fixed content\n",
          },
        },
      ],
      tokensUsed: 40,
    },
    {
      pattern: /verify|check|test|correct/i,
      response: "Verification: The result looks correct based on the evidence collected.",
      tokensUsed: 45,
    },
    {
      pattern: /summarize|summary|conclude/i,
      response:
        "Summary: Based on the analysis and verification, the task has been completed successfully.",
      tokensUsed: 50,
    },
  ];
}
