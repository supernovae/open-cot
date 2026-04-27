import { describe, it, expect } from "vitest";
import { toToon, fromToon, schemaToToonHeader } from "../src/adapters/toon-adapter.js";
import type { JsonSchema } from "../src/adapters/toon-adapter.js";
import {
  buildManifest,
  manifestToToon,
  manifestToCompactText,
  serializeManifest,
} from "../src/governance/manifest-builder.js";
import { defineToolContract } from "../src/tools/tool-types.js";
import { DEFAULT_SANDBOX_CONFIG } from "../src/schemas/sandbox.js";
import { createInitialSnapshot, DEFAULT_BUDGET_POLICY } from "../src/schemas/budget.js";
import type { SandboxConfig } from "../src/schemas/sandbox.js";

// ---------- fixtures ----------

const stepsSchema: JsonSchema = {
  type: "array",
  items: {
    type: "object",
    required: ["id", "type", "content", "confidence"],
    properties: {
      id: { type: "integer" },
      type: { type: "string" },
      content: { type: "string" },
      confidence: { type: "number" },
    },
  },
};

const reasoningSchema: JsonSchema = {
  type: "object",
  required: ["version", "task", "steps", "final_answer"],
  properties: {
    version: { type: "string" },
    task: { type: "string" },
    steps: stepsSchema,
    final_answer: { type: "string" },
  },
};

const sampleSteps = [
  { id: 1, type: "thought", content: "Check the manifest for perms.", confidence: 0.98 },
  { id: 2, type: "action", content: "Checking db_access scope.", confidence: 1.0 },
  { id: 3, type: "observation", content: "delete scope missing.", confidence: 0.95 },
];

const sampleReasoning = {
  version: "0.8",
  task: "Can I delete the record?",
  steps: sampleSteps,
  final_answer: "No, delete scope is missing.",
};

const searchContract = defineToolContract({
  name: "search",
  description: "Search a knowledge base",
  inputSchema: { type: "object", properties: { query: { type: "string" } } },
  idempotent: true,
  retryable: true,
  failureTypes: ["not_found"],
});

const calcContract = defineToolContract({
  name: "calculator",
  description: "Evaluate math expressions",
  inputSchema: { type: "object", properties: { expression: { type: "string" } } },
  idempotent: true,
  retryable: false,
  failureTypes: ["invalid_input"],
});

const writeContract = defineToolContract({
  name: "writeFile",
  description: "Write content to a file",
  inputSchema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } } },
  idempotent: false,
  retryable: false,
  failureTypes: ["permission_denied"],
});

const shellContract = defineToolContract({
  name: "shell",
  description: "Execute shell commands",
  inputSchema: { type: "object", properties: { command: { type: "string" } } },
  idempotent: false,
  retryable: false,
  failureTypes: ["permission_denied"],
});

const allTools = [searchContract, calcContract, writeContract, shellContract];
const budget = createInitialSnapshot(DEFAULT_BUDGET_POLICY);

// ---------- toToon ----------

describe("toToon", () => {
  it("serializes a flat object as key-value pairs", () => {
    const obj = { name: "search", access_level: "pre_authorized", idempotent: true };
    const result = toToon(obj);
    expect(result).toContain("name: search");
    expect(result).toContain("access_level: pre_authorized");
    expect(result).toContain("idempotent: true");
  });

  it("serializes a uniform array as tabular rows with header", () => {
    const result = toToon(sampleSteps, stepsSchema);
    expect(result).toContain("{id, type, content, confidence}:");
    expect(result).toContain("1 | thought | Check the manifest for perms. | 0.98");
    expect(result).toContain("3 | observation | delete scope missing. | 0.95");
  });

  it("serializes nested objects with indentation", () => {
    const obj = {
      trust_level: "medium",
      budget: { steps: 10, tokens: 5000 },
    };
    const result = toToon(obj);
    expect(result).toContain("trust_level: medium");
    expect(result).toContain("budget:");
    expect(result).toContain("  steps: 10");
    expect(result).toContain("  tokens: 5000");
  });

  it("serializes a complete reasoning trace", () => {
    const result = toToon(sampleReasoning, reasoningSchema);
    expect(result).toContain("version: 0.8");
    expect(result).toContain("task: Can I delete the record?");
    expect(result).toContain("steps[3]{id, type, content, confidence}:");
    expect(result).toContain("final_answer: No, delete scope is missing.");
  });

  it("quotes values containing pipe characters", () => {
    const obj = { note: "value | with pipe" };
    const result = toToon(obj);
    expect(result).toContain('"value | with pipe"');
  });

  it("handles empty arrays", () => {
    const obj = { items: [] as unknown[] };
    const result = toToon(obj);
    expect(result).toContain("items: []");
  });

  it("handles null values by skipping them", () => {
    const obj = { name: "test", value: null };
    const result = toToon(obj);
    expect(result).toContain("name: test");
    expect(result).not.toContain("value");
  });
});

// ---------- fromToon ----------

describe("fromToon", () => {
  it("parses key-value pairs into an object", () => {
    const toon = "name: search\naccess_level: pre_authorized\nidempotent: true";
    const result = fromToon(toon) as Record<string, unknown>;
    expect(result.name).toBe("search");
    expect(result.access_level).toBe("pre_authorized");
    expect(result.idempotent).toBe(true);
  });

  it("parses tabular rows with a header", () => {
    const toon = [
      "steps[3]{id, type, content, conf}:",
      "1 | thought | Check perms. | 0.98",
      "2 | action | Checking scope. | 1.0",
      "3 | observation | Missing. | 0.95",
    ].join("\n");

    const schema: JsonSchema = {
      type: "object",
      properties: {
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "integer" },
              type: { type: "string" },
              content: { type: "string" },
              conf: { type: "number" },
            },
          },
        },
      },
    };

    const result = fromToon(toon, schema) as Record<string, unknown>;
    const steps = result.steps as Record<string, unknown>[];
    expect(steps).toHaveLength(3);
    expect(steps[0]!.id).toBe(1);
    expect(steps[0]!.type).toBe("thought");
    expect(steps[0]!.conf).toBe(0.98);
    expect(steps[2]!.id).toBe(3);
  });

  it("parses nested objects via indentation", () => {
    const toon = "trust_level: medium\nbudget:\n  steps: 10\n  tokens: 5000";
    const schema: JsonSchema = {
      type: "object",
      properties: {
        trust_level: { type: "string" },
        budget: {
          type: "object",
          properties: {
            steps: { type: "integer" },
            tokens: { type: "integer" },
          },
        },
      },
    };
    const result = fromToon(toon, schema) as Record<string, unknown>;
    expect(result.trust_level).toBe("medium");
    const b = result.budget as Record<string, unknown>;
    expect(b.steps).toBe(10);
    expect(b.tokens).toBe(5000);
  });

  it("handles quoted values with pipes", () => {
    const toon = 'note: "value | with pipe"';
    const result = fromToon(toon) as Record<string, unknown>;
    expect(result.note).toBe("value | with pipe");
  });
});

// ---------- round-trip ----------

describe("toToon/fromToon round-trip", () => {
  it("round-trips a flat object", () => {
    const obj = { name: "search", count: 5, active: true };
    const schema: JsonSchema = {
      type: "object",
      properties: {
        name: { type: "string" },
        count: { type: "integer" },
        active: { type: "boolean" },
      },
    };
    const toon = toToon(obj, schema);
    const parsed = fromToon(toon, schema);
    expect(parsed).toEqual(obj);
  });

  it("round-trips a uniform array of objects", () => {
    const toon = toToon(sampleSteps, stepsSchema);
    const parsed = fromToon(toon, {
      type: "object",
      properties: { "": stepsSchema },
    });
    // For a top-level array, the parser wraps it
    // Let's test via the reasoning object instead
    const reasoningToon = toToon(sampleReasoning, reasoningSchema);
    const roundTripped = fromToon(reasoningToon, reasoningSchema) as Record<string, unknown>;
    const steps = roundTripped.steps as Record<string, unknown>[];
    expect(steps).toHaveLength(3);
    expect(steps[0]).toEqual(sampleSteps[0]);
    expect(steps[2]).toEqual(sampleSteps[2]);
  });
});

// ---------- schemaToToonHeader ----------

describe("schemaToToonHeader", () => {
  it("generates a header for an array schema with required fields", () => {
    const header = schemaToToonHeader(stepsSchema, "steps");
    expect(header).toBe("steps[N]{id, type, content, confidence}");
  });

  it("generates a header for an array schema without required fields", () => {
    const schema: JsonSchema = {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          value: { type: "number" },
        },
      },
    };
    const header = schemaToToonHeader(schema, "items");
    expect(header).toBe("items[N]{name, value}");
  });

  it("returns null for non-array schemas", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: { name: { type: "string" } },
    };
    expect(schemaToToonHeader(schema)).toBeNull();
  });

  it("uses default name when none provided", () => {
    const header = schemaToToonHeader(stepsSchema);
    expect(header).toBe("items[N]{id, type, content, confidence}");
  });
});

// ---------- manifestToToon ----------

describe("manifestToToon", () => {
  it("produces TOON output with markers", () => {
    const manifest = buildManifest({
      runId: "run-1",
      requesterId: "cognitive-pipeline-1",
      phase: "frame",
      toolContracts: [searchContract, calcContract, writeContract],
      sandbox: DEFAULT_SANDBOX_CONFIG,
      policies: [],
      budget,
    });

    const toon = manifestToToon(manifest);

    expect(toon).toContain("[toon:capability_manifest]");
    expect(toon).toContain("[/toon:capability_manifest]");
    expect(toon).toContain("tools_available[3]{name, access, idempotent}:");
    expect(toon).toContain("search | pre-authorized | true");
    expect(toon).toContain("calculator | pre-authorized | true");
    expect(toon).toContain("writeFile | pre-authorized | false");
    expect(toon).toContain("budget{steps, tool_calls, tokens, retries}:");
    expect(toon).toContain("trust_level: medium");
  });

  it("includes blocked tools", () => {
    const sandbox: SandboxConfig = {
      ...DEFAULT_SANDBOX_CONFIG,
      blockedTools: ["shell"],
    };

    const manifest = buildManifest({
      runId: "run-1",
      requesterId: "cognitive-pipeline-1",
      phase: "frame",
      toolContracts: allTools,
      sandbox,
      policies: [],
      budget,
    });

    const toon = manifestToToon(manifest);
    expect(toon).toContain("tools_blocked: shell");
  });

  it("is more compact than JSON", () => {
    const manifest = buildManifest({
      runId: "run-1",
      requesterId: "cognitive-pipeline-1",
      phase: "frame",
      toolContracts: allTools,
      sandbox: { ...DEFAULT_SANDBOX_CONFIG, blockedTools: ["shell"] },
      policies: [],
      budget,
    });

    const toon = manifestToToon(manifest);
    const json = JSON.stringify(manifest);
    expect(toon.length).toBeLessThan(json.length);
  });

  it("TOON word count stays under 100 for typical manifest", () => {
    const manifest = buildManifest({
      runId: "run-1",
      requesterId: "cognitive-pipeline-1",
      phase: "frame",
      toolContracts: allTools,
      sandbox: { ...DEFAULT_SANDBOX_CONFIG, blockedTools: ["shell"] },
      policies: [],
      budget,
    });

    const toon = manifestToToon(manifest);
    const wordCount = toon.split(/\s+/).length;
    expect(wordCount).toBeLessThan(100);
  });
});

// ---------- serializeManifest ----------

describe("serializeManifest", () => {
  const manifest = buildManifest({
    runId: "run-1",
    requesterId: "cognitive-pipeline-1",
    phase: "frame",
    toolContracts: [searchContract, calcContract],
    sandbox: DEFAULT_SANDBOX_CONFIG,
    policies: [],
    budget,
  });

  it("defaults to compact-text", () => {
    const result = serializeManifest(manifest);
    expect(result).toContain("[capability_manifest]");
    expect(result).not.toContain("[toon:");
  });

  it("selects compact-text explicitly", () => {
    const result = serializeManifest(manifest, "compact-text");
    expect(result).toBe(manifestToCompactText(manifest));
  });

  it("selects toon format", () => {
    const result = serializeManifest(manifest, "toon");
    expect(result).toContain("[toon:capability_manifest]");
  });

  it("selects json format", () => {
    const result = serializeManifest(manifest, "json");
    const parsed = JSON.parse(result);
    expect(parsed.manifest_id).toBe(manifest.manifest_id);
  });
});
