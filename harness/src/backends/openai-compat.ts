/**
 * OpenAI-compatible LLM backend.
 *
 * Works with any server that implements the OpenAI chat completions API:
 * OpenAI, Ollama, vLLM, LiteLLM, Together, etc.
 *
 * Configuration via environment variables:
 *   OPENAI_BASE_URL  - API base (default: https://api.openai.com/v1)
 *   OPENAI_API_KEY   - Bearer token
 *   OPENAI_MODEL     - Model name (default: gpt-4o-mini)
 */

import type {
  LLMBackend,
  LLMChatOptions,
  LLMFinishReason,
  LLMMessage,
  LLMResponseWithTools,
  ToolCallRequest,
} from "./types.js";

export interface OpenAICompatConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export function configFromEnv(): OpenAICompatConfig {
  return {
    baseUrl:
      process.env["OPENAI_BASE_URL"] ?? "https://api.openai.com/v1",
    apiKey: process.env["OPENAI_API_KEY"] ?? "",
    model: process.env["OPENAI_MODEL"] ?? "gpt-4o-mini",
    temperature: 0.2,
    maxTokens: 4096,
  };
}

export class OpenAICompatBackend implements LLMBackend {
  readonly name: string;
  private config: OpenAICompatConfig;

  constructor(config?: OpenAICompatConfig) {
    this.config = config ?? configFromEnv();
    this.name = `openai-compat:${this.config.model}`;
  }

  async chat(
    messages: LLMMessage[],
    options?: LLMChatOptions,
  ): Promise<LLMResponseWithTools> {
    if (options?.stream) {
      return this.chatStreaming(messages, options);
    }
    return this.chatBuffered(messages, options);
  }

  private resolveMaxTokens(limit?: number): number {
    const configured = this.config.maxTokens ?? 4096;
    if (limit === undefined || limit <= 0) {
      return configured;
    }
    return Math.min(configured, limit);
  }

  private async chatBuffered(
    messages: LLMMessage[],
    options?: LLMChatOptions,
  ): Promise<LLMResponseWithTools> {
    const url = `${this.config.baseUrl}/chat/completions`;
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages,
      temperature: this.config.temperature,
      max_tokens: this.resolveMaxTokens(options?.maxOutputTokens),
    };
    const mappedTools = mapTools(options?.tools);
    if (mappedTools) {
      body.tools = mappedTools;
    }
    const mappedToolChoice = mapToolChoice(options?.toolChoice);
    if (mappedToolChoice) {
      body.tool_choice = mappedToolChoice;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.config.apiKey
          ? { Authorization: `Bearer ${this.config.apiKey}` }
          : {}),
      },
      body: JSON.stringify(body),
      signal: options?.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `OpenAI API error ${res.status}: ${text.slice(0, 500)}`,
      );
    }

    const data = (await res.json()) as OpenAIChatResponse;
    const choice = data.choices?.[0];
    if (!choice) throw new Error("No choices in OpenAI response");

    const toolCalls = parseToolCalls(choice.message.tool_calls ?? []);

    const tokensUsed =
      (data.usage?.prompt_tokens ?? 0) + (data.usage?.completion_tokens ?? 0);

    return {
      content: choice.message.content ?? "",
      tokensUsed,
      model: data.model ?? this.config.model,
      finishReason: normalizeFinishReason(choice.finish_reason),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  private async chatStreaming(
    messages: LLMMessage[],
    options: LLMChatOptions,
  ): Promise<LLMResponseWithTools> {
    const url = `${this.config.baseUrl}/chat/completions`;
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages,
      temperature: this.config.temperature,
      max_tokens: this.resolveMaxTokens(options.maxOutputTokens),
      stream: true,
      stream_options: { include_usage: true },
    };
    const mappedTools = mapTools(options.tools);
    if (mappedTools) {
      body.tools = mappedTools;
    }
    const mappedToolChoice = mapToolChoice(options.toolChoice);
    if (mappedToolChoice) {
      body.tool_choice = mappedToolChoice;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.config.apiKey
          ? { Authorization: `Bearer ${this.config.apiKey}` }
          : {}),
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `OpenAI API error ${res.status}: ${text.slice(0, 500)}`,
      );
    }
    if (!res.body) {
      throw new Error("OpenAI streaming response has no body");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const toolCallsByIndex = new Map<number, StreamToolAccumulator>();
    let content = "";
    let completionTokensEstimated = 0;
    let finishReason: LLMFinishReason = "stop";
    let model = this.config.model;
    let promptTokens = 0;
    let completionTokens = 0;
    let done = false;
    let buffer = "";

    while (!done) {
      const { value, done: streamDone } = await reader.read();
      buffer += streamDone
        ? decoder.decode()
        : decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n");

      const drained = await drainSseBuffer({
        buffer,
        flushTrailing: streamDone,
        toolCallsByIndex,
        context: {
          content,
          completionTokensEstimated,
          finishReason,
          model,
          promptTokens,
          completionTokens,
        },
        options,
      });
      buffer = drained.buffer;
      done = drained.done;
      content = drained.context.content;
      completionTokensEstimated = drained.context.completionTokensEstimated;
      finishReason = drained.context.finishReason;
      model = drained.context.model;
      promptTokens = drained.context.promptTokens;
      completionTokens = drained.context.completionTokens;

      if (streamDone) {
        break;
      }
    }

    const toolCalls = finalizeStreamToolCalls(toolCallsByIndex);
    const tokensUsed =
      promptTokens + completionTokens > 0
        ? promptTokens + completionTokens
        : estimateMessagesTokens(messages) + completionTokensEstimated;

    return {
      content,
      tokensUsed,
      model,
      finishReason,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }
}

interface OpenAIChatResponse {
  choices?: Array<{
    message: OpenAIMessage;
    finish_reason: string;
  }>;
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

interface OpenAIStreamChunk {
  choices?: Array<{
    delta?: {
      content?: string;
      tool_calls?: Array<OpenAIToolCallDelta>;
    };
    finish_reason?: string | null;
  }>;
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

interface OpenAIToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

type OpenAIToolChoice =
  | "auto"
  | "none"
  | "required"
  | {
      type: "function";
      function: {
        name: string;
      };
    };

interface OpenAIToolCallDelta {
  index?: number;
  id?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

interface OpenAIFullToolCall {
  function: { name: string; arguments: string };
}

interface OpenAIMessage {
  content?: string;
  tool_calls?: OpenAIFullToolCall[];
}

interface StreamToolAccumulator {
  name?: string;
  arguments: string;
}

interface StreamContext {
  content: string;
  completionTokensEstimated: number;
  finishReason: LLMFinishReason;
  model: string;
  promptTokens: number;
  completionTokens: number;
  done?: boolean;
}

function estimateTextTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

function estimateMessagesTokens(messages: LLMMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    total += estimateTextTokens(msg.content) + 4;
  }
  return total;
}

function normalizeFinishReason(reason: string | null | undefined): LLMFinishReason {
  if (reason === "tool_calls") return "tool_calls";
  if (reason === "length") return "length";
  if (reason === "cancelled") return "cancelled";
  return "stop";
}

function parseToolCalls(calls: OpenAIFullToolCall[]): ToolCallRequest[] {
  return calls.map((tc) => ({
    toolName: tc.function.name,
    arguments: parseToolArguments(tc.function.arguments),
  }));
}

function parseToolArguments(raw: string): Record<string, unknown> {
  if (!raw.trim()) {
    return {};
  }
  return JSON.parse(raw) as Record<string, unknown>;
}

function extractSseData(rawEvent: string): string | null {
  const dataLines = rawEvent
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart());
  if (dataLines.length === 0) {
    return null;
  }
  return dataLines.join("\n");
}

function accumulateToolDeltas(
  toolCallsByIndex: Map<number, StreamToolAccumulator>,
  deltas: OpenAIToolCallDelta[],
): void {
  for (const delta of deltas) {
    const index = delta.index ?? 0;
    const curr = toolCallsByIndex.get(index) ?? { arguments: "" };
    if (delta.function?.name) {
      curr.name = delta.function.name;
    }
    if (delta.function?.arguments) {
      curr.arguments += delta.function.arguments;
    }
    toolCallsByIndex.set(index, curr);
  }
}

function finalizeStreamToolCalls(
  toolCallsByIndex: Map<number, StreamToolAccumulator>,
): ToolCallRequest[] {
  return [...toolCallsByIndex.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, acc]) => {
      if (!acc.name) {
        throw new Error("Streaming tool call missing function name");
      }
      return {
        toolName: acc.name,
        arguments: parseToolArguments(acc.arguments),
      };
    });
}

async function drainSseBuffer(args: {
  buffer: string;
  flushTrailing: boolean;
  toolCallsByIndex: Map<number, StreamToolAccumulator>;
  context: StreamContext;
  options: LLMChatOptions;
}): Promise<{ buffer: string; context: StreamContext; done: boolean }> {
  let buffer = args.buffer;
  let context = args.context;
  let done = false;

  let boundary = buffer.indexOf("\n\n");
  while (boundary !== -1) {
    const rawEvent = buffer.slice(0, boundary);
    buffer = buffer.slice(boundary + 2);
    boundary = buffer.indexOf("\n\n");
    context = await consumeSseEvent(
      rawEvent,
      args.toolCallsByIndex,
      context,
      args.options,
    );
    if (context.done) {
      done = true;
      return { buffer: "", context, done };
    }
  }

  if (args.flushTrailing && buffer.trim().length > 0) {
    context = await consumeSseEvent(
      buffer,
      args.toolCallsByIndex,
      context,
      args.options,
    );
    buffer = "";
    if (context.done) {
      done = true;
    }
  }

  return { buffer, context, done };
}

async function consumeSseEvent(
  rawEvent: string,
  toolCallsByIndex: Map<number, StreamToolAccumulator>,
  context: StreamContext,
  options: LLMChatOptions,
): Promise<StreamContext> {
  const payload = extractSseData(rawEvent);
  if (!payload) {
    return context;
  }
  if (payload === "[DONE]") {
    return { ...context, done: true };
  }

  const chunk = JSON.parse(payload) as OpenAIStreamChunk;
  const next: StreamContext = {
    ...context,
    model: chunk.model ?? context.model,
    promptTokens: chunk.usage?.prompt_tokens ?? context.promptTokens,
    completionTokens: chunk.usage?.completion_tokens ?? context.completionTokens,
  };

  const choice = chunk.choices?.[0];
  if (!choice) {
    return next;
  }

  if (choice.delta?.content) {
    next.content += choice.delta.content;
    next.completionTokensEstimated += estimateTextTokens(choice.delta.content);
  }
  if (choice.delta?.tool_calls) {
    accumulateToolDeltas(toolCallsByIndex, choice.delta.tool_calls);
  }
  if (choice.finish_reason) {
    next.finishReason = normalizeFinishReason(choice.finish_reason);
  }

  await options.onChunk?.({
    contentDelta: choice.delta?.content,
    content: next.content,
    completionTokensEstimated: next.completionTokensEstimated,
    finishReason: next.finishReason,
  });

  return next;
}

function mapTools(tools?: LLMChatOptions["tools"]): OpenAIToolDefinition[] | undefined {
  if (!tools || tools.length === 0) {
    return undefined;
  }
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
}

function mapToolChoice(
  choice?: LLMChatOptions["toolChoice"],
): OpenAIToolChoice | undefined {
  if (!choice) {
    return undefined;
  }
  if (typeof choice === "string") {
    return choice;
  }
  return {
    type: "function",
    function: {
      name: choice.name,
    },
  };
}
