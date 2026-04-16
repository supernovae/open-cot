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

  async chat(messages: LLMMessage[]): Promise<LLMResponseWithTools> {
    const url = `${this.config.baseUrl}/chat/completions`;
    const body = {
      model: this.config.model,
      messages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.config.apiKey
          ? { Authorization: `Bearer ${this.config.apiKey}` }
          : {}),
      },
      body: JSON.stringify(body),
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

    const toolCalls: ToolCallRequest[] = (
      choice.message.tool_calls ?? []
    ).map((tc) => ({
      toolName: tc.function.name,
      arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
    }));

    const tokensUsed =
      (data.usage?.prompt_tokens ?? 0) + (data.usage?.completion_tokens ?? 0);

    return {
      content: choice.message.content ?? "",
      tokensUsed,
      model: data.model ?? this.config.model,
      finishReason:
        choice.finish_reason === "tool_calls" ? "tool_calls" : "stop",
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }
}

interface OpenAIChatResponse {
  choices?: Array<{
    message: {
      content?: string;
      tool_calls?: Array<{
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: string;
  }>;
  model?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}
