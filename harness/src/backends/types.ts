/**
 * LLM backend interface — abstraction over model providers.
 *
 * Both mock and real backends implement this interface so agents can switch
 * between deterministic testing and real inference without code changes.
 */

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type LLMFinishReason = "stop" | "length" | "tool_calls" | "cancelled";

export interface LLMResponse {
  content: string;
  tokensUsed: number;
  model: string;
  finishReason: LLMFinishReason;
}

export interface ToolCallRequest {
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface LLMResponseWithTools extends LLMResponse {
  toolCalls?: ToolCallRequest[];
}

export interface LLMStreamChunk {
  /**
   * New text emitted by this chunk.
   */
  contentDelta?: string;
  /**
   * Aggregated text emitted so far in this response.
   */
  content: string;
  /**
   * Running estimate of completion tokens emitted so far.
   */
  completionTokensEstimated: number;
  /**
   * Optional finish reason when the provider emits it mid-stream.
   */
  finishReason?: LLMFinishReason;
}

export interface LLMChatOptions {
  /**
   * Request streamed decoding. Backends MAY ignore this and fall back to
   * buffered responses, but OpenAI-compatible backend supports it.
   */
  stream?: boolean;
  /**
   * Max completion tokens for this request, typically derived from remaining
   * runtime budget.
   */
  maxOutputTokens?: number;
  /**
   * Abort signal for circuit-breakers (budget/safety/external stop).
   */
  signal?: AbortSignal;
  /**
   * Stream callback invoked for each content/tool delta.
   */
  onChunk?: (chunk: LLMStreamChunk) => void | Promise<void>;
}

export interface LLMBackend {
  chat(
    messages: LLMMessage[],
    options?: LLMChatOptions,
  ): Promise<LLMResponseWithTools>;
  readonly name: string;
}
