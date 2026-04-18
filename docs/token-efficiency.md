# Token Efficiency and Context Management

The control plane adds structure. Structure costs tokens. For large models—128k+ context, GPT-4 class—the overhead is usually manageable. For small models—7B–13B running locally—every token matters. The project has to live in that tension honestly: we want strong governance and auditable artifacts without turning every run into a prompt dump.

Token efficiency here is not the same as “cheapest possible API bill,” though they overlap. It is about **fit**: keeping the model’s working memory full of signal—objective, allowed tools, fresh observations—instead of noise—stale manifests, redundant receipts, duplicated stack traces of control-plane chatter. When the window is narrow, bad context hygiene shows up as hallucinated tools, repeated denied delegations, and answers that ignore the last observation because it scrolled out of view.

This note is not an RFC. It is a working map of what we are doing, what we are trying next, and what we still do not know. Some ideas already have a normative home in the specs (for example capability manifests in [RFC 0049](../rfcs/0049-capability-manifest.md)). Others are research directions where we want benchmarks, adapters, and real-world reports from people building on top of the harness.

If something here contradicts an RFC, the RFC wins. If the harness lags the RFC, treat the gap as a bug or a tracked follow-up—not as permission to drift from the interchange contract.

---

## 1. Capability manifests (implemented)

The biggest token-efficiency win we have named so far is **stopping blind guessing**. Without a clear picture of what tools exist, what policy allows, and what budget remains, small models burn context proposing delegations and tool shapes the harness will reject. Each denied cycle is not just latency; it is narrative the model will try to “fix” on the next turn, often by elaborating rather than narrowing.

[RFC 0049 — Capability manifest](../rfcs/0049-capability-manifest.md) defines a harness-compiled briefing: tools the model may consider, sandbox and policy posture, budget snapshot, and trust level. The harness compiles authoritative state into a structured manifest, keeps **JSON** for validation and audit continuity, and injects a **compact text** serialization at key FSM transitions. Normative injection points include **`frame`** (initial briefing), **`critique_verify`** (refresh after consumption, especially budget drift), and **`plan`** when static analysis shows the draft references tools absent from the last manifest or when budget figures are materially stale. The linear `[capability_manifest]` … `[/capability_manifest]` block is deliberately easy to locate, replace, or strip when superseded.

That split—verbose canonical JSON off the hot path, terse briefing on the hot path—is the pattern we want to repeat elsewhere: **rich artifacts for audit**, **tight prompts for inference**.

**Where this meets code:** the governed execution loop, transitions, and trace/state plumbing live under [`harness/`](../harness/README.md). Useful entry points:

- [`harness/src/agents/governed-agent.ts`](../harness/src/agents/governed-agent.ts) — end-to-end governed FSM with delegation and receipts
- [`harness/src/core/transitions.ts`](../harness/src/core/transitions.ts) — phase changes and harness-driven state
- [`harness/src/core/state.ts`](../harness/src/core/state.ts) — `AgentState` and trace accumulation
- [`harness/src/core/tool-registry.ts`](../harness/src/core/tool-registry.ts) — registered tools and contracts feeding compilation

Manifest compilation should draw from the same sources the enforcement path trusts (registry, sandbox config, active policies, budget tracker), not from prose the model invented. That keeps the briefing aligned with what will actually happen when a tool call is attempted.

---

## 2. Wire format exploration (research)

The **normative** interchange contract for tools, plans, receipts, and audit material remains **JSON Schema** (and the schema registry the repo validates in CI). Models, diff tools, and regulators need a stable, auditable shape. The research question is how much of that shape must appear **verbatim** in the model’s context and completion stream versus being produced or consumed only inside adapters and harness services.

**Validation boundary.** A compact or textual representation is acceptable at the model boundary only if the harness can translate to canonical JSON and run the same validators policy already depends on. Adapters are not a place to skip schema checks “because it usually works.”

### Tier 1 — Compact JSON (available now)

No spec change required: strip insignificant whitespace, omit optional nulls, prefer short keys in model-facing payloads where the schema allows flexibility, and keep canonical pretty JSON for logs, PR review, and interchange when humans need it. Round-trip tests should still target the normative schema, not the minified bytes.

The capability manifest’s compact text form is already an example of “structured briefing without JSON soup in the prompt.” The same philosophy applies to tool arguments once validated: store canonical JSON in trace; echo a slimmer representation to the model if your adapter layer can prove equivalence.

### Tier 2 — Structured text markers (near-term)

Many models naturally emit lines like `[TOOL:search] [QUERY:population of tokyo]`. A **text adapter** could translate those markers to and from the same JSON Schema objects the harness validates today—so the trace and audit path stay schema-clean while the live prompt stays short. Failure handling matters: ambiguous markers should surface as structured validation errors the model can repair, not silent coercion.

This tier is attractive for small local models that handle rigid JSON poorly, and for providers where `tool_calls` support is uneven so you still want a deterministic parse path.

### Tier 2.5 — TOON: Token-Oriented Object Notation (implemented)

[RFC 0050 — TOON Adapter](../rfcs/0050-toon-adapter.md) adds an opt-in adapter that translates canonical JSON Schema objects into **TOON** notation at the model boundary. TOON uses inline schema headers (`tools[3]{name, access, idempotent}:`) and pipe-delimited tabular rows to eliminate repeated key names, braces, quotes, and commas. Published benchmarks report 20–60% token reduction compared to equivalent JSON, with the savings following a non-linear curve — the advantage grows with structural complexity (arXiv 2603.03306).

TOON sits between Tier 2 (ad-hoc markers) and Tier 3 (new serialization languages): it is more structured and general-purpose than bespoke markers, but simpler and more model-friendly than YAML or a full DSL. The key properties:

- **JSON Schema stays normative.** TOON is a serialization adapter, not a schema language. All validation, audit, and interchange remain JSON.
- **Round-trip fidelity.** `fromToon(toToon(obj, schema), schema)` must produce the same validated object. The adapter is not a trust boundary.
- **Inline guardrails.** The `[N]` length marker and `{fields}` header tell the model exactly how many items to generate and which keys to use, reducing hallucinated structure.
- **Opt-in via `wire_format`.** Set `wire_format: "toon"` on agent config; default remains `"compact-text"` for backward compatibility.

Example — the capability manifest in TOON vs compact text:

```
[toon:capability_manifest]
tools_available[3]{name, access, idempotent}:
search | pre-authorized | true
calculator | pre-authorized | true
writeFile | requires-delegation | false
tools_blocked: shell
budget{steps, tool_calls, tokens, retries}: 48 | 18 | 95000 | 2
trust_level: medium
constraints: max 5 results per search; no raw HTML
[/toon:capability_manifest]
```

The TOON form for this manifest uses roughly 30–40% fewer tokens than the equivalent JSON, and is comparable or slightly more compact than the hand-coded compact text — with the advantage that the adapter is reusable across any schema, not just manifests.

**Implementation:** [`harness/src/adapters/toon-adapter.ts`](../harness/src/adapters/toon-adapter.ts) provides `toToon`, `fromToon`, and `schemaToToonHeader`. The manifest builder ([`harness/src/governance/manifest-builder.ts`](../harness/src/governance/manifest-builder.ts)) adds `manifestToToon` and a `serializeManifest` dispatcher. Both the governed agent and chat agent accept a `wireFormat` config option.

**Research backing:**

- Abt (2025) — TOON design rationale: https://benjamin-abt.com/blog/2025/12/12/ai-toon-format/
- arXiv 2603.03306 (2026) — TOON vs JSON benchmark with constrained decoding: https://arxiv.org/abs/2603.03306
- arXiv 2604.05865 (2026) — JTON (related format), 15–60% reduction, 100% validity across 12 LLMs: https://arxiv.org/abs/2604.05865
- ATON V2 Whitepaper (2025) — 56% reduction vs JSON: https://www.atonformat.com/whitepaper.html

See [`docs/experiments/toon_format_efficiency.md`](experiments/toon_format_efficiency.md) for the experiment card.

### Tier 3 — Alternative serializations (research)

- **YAML** — Sometimes slightly fewer tokens than JSON for nested objects; generation quality is inconsistent across models, and a single indentation slip can void a parse.
- **MessagePack / CBOR** — Fine for harness-to-harness links, queue payloads, or cold storage; models will not emit binary reliably, so this stays off the model-facing edge.
- **A minimal DSL** — Could shrink token count further but adds parser surface area and a novel syntax tax. TOON (Tier 2.5) is a deliberate compromise: less exotic than a full DSL, with published benchmarks showing the savings are real.

**Protobuf** is a reasonable **non-starter for model I/O** (binary on the wire from the model’s perspective). It remains useful for efficient harness-to-harness RPC and compact storage of audit blobs where both ends are code and you control versioning.

**Honest bottom line:** TOON takes the middle path: familiar enough (pipe-delimited tables, key-value lines) that models handle it well out of the box, structured enough to round-trip through validators. If you prototype further alternatives, publish token counts *and* success rates.

---

## 3. Context compilation (research)

Models often reason better with room to be verbose. Control-plane metadata does not automatically deserve the same space on the **next** turn. The harness already sits on the boundary between tool execution and model observation—there is headroom to **compile** what goes back into the prompt while preserving a lossless or intentionally-lossy audit trail elsewhere.

Concrete directions:

- **Observation summarization.** A search tool might return hundreds of tokens of noisy HTML. The harness could extract entities, numbers, and citations into a short fact list before `observe_result` reaches the model, while the full payload remains attached to the trace step or external object storage for auditors. Summarization could be heuristic (strip tags), model-based (a cheap summarizer), or policy-driven (only whitelisted fields).
- **Trace windowing.** `AgentState` can retain the full run; the model-facing context might show only the last *N* tool cycles or the last *M* tokens of narration. Long multi-tool runs otherwise drown in their own history; windowing is likely mandatory for hour-scale tasks even when total context fits in theory.
- **Metadata stripping.** Delegation request ids, integrity hashes, receipt fields, and other audit-only columns need not be echoed back to the model. Keep them in structured state and in sealed envelopes, not in the prompt loop. The model needs *enough* correlation to refer to “the last search,” not the full cryptographic tail.
- **Phase-aware injection.** At `plan`, surface the objective plus a fresh capability manifest so proposals stay feasible. At `critique_verify`, bias toward the latest observation, the manifest refresh (budget and revocation changes), and a compact summary of prior conclusions—rather than replaying the entire thread from `receive`.
- **Deterministic replay vs model context.** Anything you strip from the prompt must still be reconstructable for debugging. Document whether summarization is **reversible** (lossless compression) or **interpretive** (lossy), because critique quality depends on which you chose.

None of this removes the obligation to preserve evidence for auditors—it changes what the **model** has to re-read every hop.

Related experiment notes in-repo: [`docs/experiments/token_budget_enforcement.md`](experiments/token_budget_enforcement.md) discusses budget pressure in the loop; read it alongside this doc when designing throttles.

---

## 4. API and adapter layer (exploration)

Today the OpenAI-compatible backend builds a small JSON body—`model`, `messages`, `temperature`, `max_tokens`—and does **not** attach `tools` / `functions` from the registry ([`harness/src/backends/openai-compat.ts`](../harness/src/backends/openai-compat.ts)). That keeps the reference path simple and works with mock backends, but it leaves native tool-calling unused for providers that support it well.

For serious deployments, adapters should:

1. **Send tool definitions** derived from [`ToolRegistry.listTools()`](../harness/src/core/tool-registry.ts), **filtered** by the active capability manifest so the API surface matches what policy actually allows. If a tool is not manifest-visible, it should not appear in the OpenAI `tools` array.
2. **Prefer native tool calls** where the provider supports them, instead of asking the model to spell JSON tool invocations in free text. Native calls reduce delimiter games, brace-matching errors, and harness repair loops.
3. Treat that as both a **token** win (the model sees a tight, authoritative tool schema once per turn) and a **safety** win (disallowed tools never appear in the API contract the model can cite).

Provider reality is messy: some endpoints advertise tool calling but behave better with structured text; adapters may need per-model heuristics. The project-level goal remains: **one canonical schema story**, many transport shims.

A complementary idea: let the model ramble or think in prose if that helps quality, but have the adapter **normalize** structured outputs to compact JSON before the next harness validation step. Full verbosity can live in the trace; the **context reinjection** path can stay tight.

**Open tension:** do models need the entire verbose history in context, or can they run from rolling summaries? The answer probably depends on model capability, task depth, and how lossy summarization is allowed to be. We do not have one global rule—only hypotheses worth falsifying with traces.

**Mock vs live backends.** The mock path is invaluable for CI, but it will not stress tokenizer behavior, tool latency, or provider-specific quirks. Token-efficiency work should be validated at least once against a real OpenAI-compatible endpoint (for example Ollama or vLLM) with the same prompts you intend in production.

---

## Measurement notes (practical)

Token counts are easy to misread. When you share results with the community, a few fields make comparisons reproducible:

- **Model id and revision** — include quantization or adapter names for local weights.
- **Tokenizer family** — provider billing tokens and local `tiktoken`-style counts can diverge; say which number you are reporting.
- **Prompt vs completion split** — compact manifests mostly affect prompt-side inflation; repair loops often explode completion tokens instead.
- **Phase labels** — if you instrument the harness, tag usage by FSM phase (`frame`, `plan`, `execute_tool`, etc.) so we can see where context grows.
- **Success criteria** — tokens per successful task completion matters more than tokens per failed attempt; include pass/fail or rubric scores when possible.

If you only have aggregate usage from a host API, say so. Partial data is still useful if the scenario and prompts are documented.

---

## 5. Open questions

These are not homework problems with known answers; they are gaps we expect to close with data. If you have a strong opinion, treat it as a hypothesis and try to break it on your stack.

- How much do small models (around 7B) struggle with strict JSON versus compact text markers in practice, measured as parse success rate and tasks completed?
- Is YAML actually better than well-minified JSON on **token** counts for typical tool payloads, once you account for repair loops and invalid-document retries?
- Does the capability manifest measurably cut wasted delegation cycles in your workloads, or do models ignore briefings the same way they ignore long system prompts?
- What windowing strategy works for runs with ten or more tool calls without destroying critique quality—fixed *N*, token budget, semantic clustering?
- Should the spec ever **mandate** a compact model-facing format, or should that remain an adapter concern with JSON Schema as the canonical interchange?
- Can observation summarization preserve enough detail for accurate `critique_verify`, or does summarization systematically hide the faults reviewers need to catch?
- What is the **minimum** viable context for a `critique_verify` step on your tasks—objective only, last observation only, manifest refresh only?
- When native `tool_calls` are available, does switching away from JSON-in-prose materially change **total** tokens once system prompts and tool schemas are included?
- For multi-agent or delegated subgraphs, which metadata is safe to strip without breaking the child’s correlation to parent receipts?

---

## 6. How to help

If you run small models locally, your measurements matter more than our guesses.

- Run the governed agent demo paths in [`harness/examples/`](../harness/examples/) and capture token usage (`prompt_tokens`, `completion_tokens`, and per-phase estimates if your wrapper exposes them).
- Try context compilation ideas—summaries, windowing, stripped metadata—and report what broke and what held. Attach redacted prompts if you can.
- Benchmark structured text markers vs JSON for **your** model and tool set; share model id, quantization, temperature, and rough numbers—not just one cherry-picked success.
- Propose compact formats with a clear mapping to existing schemas and an estimate of token savings **including** failure cases.

**Project entry points**

- Contributing: [`docs/contributing.md`](contributing.md)
- RFC discussion index and per-RFC threads: [`docs/rfc-discussions.md`](rfc-discussions.md)
- How RFCs evolve vs reference code: [`docs/governance-rfc-lifecycle.md`](governance-rfc-lifecycle.md)

Normative change process remains RFC-first; this document is intentionally informal exploration layered on top of that process. Use Discussions for design debate and Issues for concrete harness or adapter tasks once you have a reproducible scenario.

**Related reading**

- [`docs/architecture.md`](architecture.md) — how the harness, schemas, and FSM fit together
- [`docs/philosophy.md`](philosophy.md) — why the model is untrusted input and the control plane owns enforcement
- [`experiments/local_oss_runbook.md`](../experiments/local_oss_runbook.md) — practical local model workflows that pair well with token measurements
