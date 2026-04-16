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

export interface LLMResponse {
  content: string;
  tokensUsed: number;
  model: string;
  finishReason: "stop" | "length" | "tool_calls";
}

export interface ToolCallRequest {
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface LLMResponseWithTools extends LLMResponse {
  toolCalls?: ToolCallRequest[];
}

export interface LLMBackend {
  chat(messages: LLMMessage[]): Promise<LLMResponseWithTools>;
  readonly name: string;
}
