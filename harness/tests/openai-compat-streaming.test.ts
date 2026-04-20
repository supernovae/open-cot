import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAICompatBackend } from "../src/backends/openai-compat.js";
import type { LLMMessage } from "../src/backends/types.js";

const messages: LLMMessage[] = [{ role: "user", content: "hello" }];

function makeSseResponse(events: unknown[]): Response {
  const payload =
    events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("") +
    "data: [DONE]\n\n";
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(payload));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("OpenAICompatBackend streaming", () => {
  it("parses streamed text deltas and usage accounting", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        makeSseResponse([
          { choices: [{ delta: { content: "Hel" }, finish_reason: null }] },
          {
            choices: [{ delta: { content: "lo" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 5, completion_tokens: 2 },
          },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const backend = new OpenAICompatBackend({
      baseUrl: "https://example.test/v1",
      apiKey: "",
      model: "stream-model",
      maxTokens: 200,
    });

    const chunks: string[] = [];
    const resp = await backend.chat(messages, {
      stream: true,
      onChunk: (chunk) => {
        chunks.push(chunk.content);
      },
    });

    expect(resp.content).toBe("Hello");
    expect(resp.finishReason).toBe("stop");
    expect(resp.tokensUsed).toBe(7);
    expect(chunks.length).toBeGreaterThan(0);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.stream).toBe(true);
    expect(body.stream_options.include_usage).toBe(true);
  });

  it("reconstructs streamed tool calls with split arguments", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        makeSseResponse([
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      function: {
                        name: "search",
                        arguments: "{\"query\":\"Tok",
                      },
                    },
                  ],
                },
                finish_reason: null,
              },
            ],
          },
          {
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      function: { arguments: "yo\"}" },
                    },
                  ],
                },
                finish_reason: "tool_calls",
              },
            ],
            usage: { prompt_tokens: 11, completion_tokens: 4 },
          },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);

    const backend = new OpenAICompatBackend({
      baseUrl: "https://example.test/v1",
      apiKey: "",
      model: "stream-tool-model",
      maxTokens: 200,
    });

    const resp = await backend.chat(messages, { stream: true });

    expect(resp.finishReason).toBe("tool_calls");
    expect(resp.toolCalls).toEqual([
      {
        toolName: "search",
        arguments: { query: "Tokyo" },
      },
    ]);
  });

  it("applies per-call output cap to max_tokens", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: "buffered-model",
          choices: [
            {
              message: { content: "ok" },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 2, completion_tokens: 1 },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const backend = new OpenAICompatBackend({
      baseUrl: "https://example.test/v1",
      apiKey: "",
      model: "buffered-model",
      maxTokens: 4096,
    });

    await backend.chat(messages, { maxOutputTokens: 32 });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.max_tokens).toBe(32);
  });

  it("serializes tool schemas and tool choice in requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: "buffered-model",
          choices: [
            {
              message: { content: "ok" },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 2, completion_tokens: 1 },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const backend = new OpenAICompatBackend({
      baseUrl: "https://example.test/v1",
      apiKey: "",
      model: "buffered-model",
      maxTokens: 4096,
    });

    await backend.chat(messages, {
      tools: [
        {
          name: "search",
          description: "Search records",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string" },
            },
            required: ["query"],
          },
        },
      ],
      toolChoice: { name: "search" },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.tools).toEqual([
      {
        type: "function",
        function: {
          name: "search",
          description: "Search records",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string" },
            },
            required: ["query"],
          },
        },
      },
    ]);
    expect(body.tool_choice).toEqual({
      type: "function",
      function: {
        name: "search",
      },
    });
  });
});
