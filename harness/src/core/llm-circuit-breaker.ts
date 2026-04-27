import type {
  LLMBackend,
  LLMMessage,
  LLMResponseWithTools,
  LLMStreamChunk,
  LLMToolChoice,
  LLMToolDefinition,
} from "../backends/types.js";
import type { BudgetTracker } from "./budget-tracker.js";
import type { PipelineState } from "./state.js";
import { forceStop } from "./transitions.js";
import type { CompletionStatus } from "../schemas/audit-envelope.js";

const NOOP_RESPONSE: LLMResponseWithTools = {
  content: "",
  tokensUsed: 0,
  model: "noop",
  finishReason: "stop",
};

const DEFAULT_MAX_DECODED_CHARS = 16_000;

export interface StreamSafetyConfig {
  /**
   * Hard ceiling on streamed decoded characters to prevent runaway output.
   */
  maxDecodedChars: number;
  /**
   * Optional denylist for decoded output. If any pattern matches, decoding is
   * interrupted and the run enters fail_safe.
   */
  blockedPatterns: RegExp[];
}

export interface CircuitBreakerOptions {
  backend: LLMBackend;
  messages: LLMMessage[];
  state: PipelineState;
  budget: BudgetTracker;
  llmReason?: string;
  stream?: boolean;
  safety?: Partial<StreamSafetyConfig>;
  tools?: LLMToolDefinition[];
  toolChoice?: LLMToolChoice;
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}

function abortWithReason(controller: AbortController, reason: string): void {
  if (!controller.signal.aborted) {
    controller.abort(reason);
  }
}

export function estimateTextTokens(text: string): number {
  if (!text) return 0;
  // Deliberately simple, provider-agnostic estimate (good enough for guardrails).
  return Math.max(1, Math.ceil(text.length / 4));
}

export function estimateMessageTokens(messages: LLMMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    total += estimateTextTokens(msg.content) + 4;
  }
  return total;
}

function toNoopErrorResponse(): LLMResponseWithTools {
  return {
    content: "",
    tokensUsed: 0,
    model: "error",
    finishReason: "stop",
  };
}

function normalizeSafetyConfig(
  partial?: Partial<StreamSafetyConfig>,
): StreamSafetyConfig {
  return {
    maxDecodedChars: partial?.maxDecodedChars ?? DEFAULT_MAX_DECODED_CHARS,
    blockedPatterns: partial?.blockedPatterns ?? [],
  };
}

export async function callLLMWithCircuitBreaker(
  options: CircuitBreakerOptions,
): Promise<LLMResponseWithTools> {
  const { backend, messages, state, budget } = options;
  if (state.phase === "audit_seal") {
    return NOOP_RESPONSE;
  }

  const llmReason = options.llmReason ?? `LLM (${backend.name})`;
  const hardBudget = state.budgetPolicy.enforcement === "hard";
  const promptEstimate = estimateMessageTokens(messages);
  const reserve = 4;
  const completionBudget = Math.max(
    0,
    state.budget.tokensRemaining - promptEstimate - reserve,
  );
  const safety = normalizeSafetyConfig(options.safety);
  const requestOutputCap =
    hardBudget && completionBudget > 0 ? completionBudget : undefined;

  if (hardBudget && completionBudget <= 0) {
    forceStop(
      state,
      "budget_exhausted",
      `Insufficient token budget before decode (remaining=${state.budget.tokensRemaining}, prompt_estimate=${promptEstimate})`,
    );
    return toNoopErrorResponse();
  }

  const controller = new AbortController();
  let streamedText = "";
  let streamedCompletionEstimate = 0;
  let localStopStatus: CompletionStatus | null = null;
  let localStopReason = "";

  const onChunk = async (chunk: LLMStreamChunk): Promise<void> => {
    const delta = chunk.contentDelta ?? "";
    if (delta.length > 0) {
      streamedText += delta;
    } else if (chunk.content.length > streamedText.length) {
      streamedText = chunk.content;
    }

    streamedCompletionEstimate = Math.max(
      streamedCompletionEstimate,
      chunk.completionTokensEstimated,
    );

    if (hardBudget && streamedCompletionEstimate >= completionBudget) {
      localStopStatus = "budget_exhausted";
      localStopReason = `Token budget exhausted mid-decode (completion_estimate=${streamedCompletionEstimate}, allowance=${completionBudget})`;
      abortWithReason(controller, localStopReason);
      return;
    }

    if (streamedText.length > safety.maxDecodedChars) {
      localStopStatus = "fail_safe";
      localStopReason = `Safety circuit breaker: decoded output exceeded ${safety.maxDecodedChars} characters`;
      abortWithReason(controller, localStopReason);
      return;
    }

    for (const pattern of safety.blockedPatterns) {
      if (pattern.test(streamedText)) {
        localStopStatus = "fail_safe";
        localStopReason = `Safety circuit breaker matched blocked output pattern: ${pattern}`;
        abortWithReason(controller, localStopReason);
        return;
      }
    }
  };

  try {
    const response = await backend.chat(messages, {
      stream: options.stream ?? true,
      maxOutputTokens: requestOutputCap,
      signal: controller.signal,
      onChunk: options.stream === false ? undefined : onChunk,
      tools: options.tools,
      toolChoice: options.toolChoice,
    });
    budget.recordTokens(state, response.tokensUsed, llmReason);
    return response;
  } catch (err) {
    if (localStopStatus) {
      forceStop(state, localStopStatus, localStopReason);
      const estimatedTotal = promptEstimate + streamedCompletionEstimate;
      if (estimatedTotal > 0) {
        budget.recordTokens(
          state,
          estimatedTotal,
          `${llmReason} (stream-estimated)`,
        );
      }
      return toNoopErrorResponse();
    }

    if (isAbortError(err)) {
      forceStop(state, "external_stop", "LLM stream aborted");
      return toNoopErrorResponse();
    }

    const msg = err instanceof Error ? err.message : String(err);
    forceStop(state, "fail_safe", `LLM failure: ${msg}`);
    return toNoopErrorResponse();
  }
}
