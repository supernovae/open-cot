# RFC 0049 — Capability Manifest (v0.1)

**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026-04-18  
**Target Version:** Schema v0.8  
**Discussion:** https://github.com/supernovae/open-cot/discussions/49

## 1. Summary

Open-CoT is a cognitive control plane for governed agent execution. Without a **capability manifest**, models propose actions with incomplete knowledge of what the harness will permit, burning context on delegation cycles that resolve to denial. This RFC defines the **capability manifest**: a harness-compiled, model-facing snapshot that summarizes callable tools, policy and sandbox posture, remaining budget, and agent trust. The manifest is injected at key finite-state machine (FSM) transitions so the model can plan within real constraints. Schema v0.8 adds a normative JSON representation for validation and audit, and a normative **compact text** serialization for token-efficient injection.

## 2. Motivation and problem statement

Tool registries (RFC 0003), sandboxes (RFC 0017), policies (RFC 0041), and budgets (RFC 0038) each encode part of the execution envelope. The model, however, consumes natural language context—not internal configuration graphs. Bridging that gap with ad hoc prose is fragile and expensive. The capability manifest is the **single compiled briefing** the harness derives from authoritative sources and supplies to the model at controlled injection points, reducing wasted proposals and making the control plane practical for small models and narrow context windows.

## 3. Normative requirements

The following requirements apply to conforming harnesses for Schema v0.8.

**N1 — Compilation.** The harness MUST compile the manifest; the model MUST NOT construct or mutate the manifest as authoritative state.

**N2 — Provenance.** Each manifest instance MUST be attributable to a `run_id`, `agent_id`, and compilation `timestamp`, and MUST record the FSM `phase` at which it was produced.

**N3 — Heartbeat injection.** The harness MUST re-compile and inject a fresh manifest before **every LLM call** during a governed run. Models lose sight of earlier context as the conversation grows (context decay); a stale manifest from three LLM calls ago is effectively invisible. Re-injecting at every model-facing turn keeps budget numbers, tool availability, and constraints current regardless of how far the run has progressed. This pattern is called the **manifest heartbeat**.

At minimum, the manifest MUST be injected at FSM states **`frame`**, **`plan`**, **`critique_verify`**, and **`finalize`** — every state where the model makes decisions. Conforming harnesses SHOULD inject at every LLM call without exception; the cost is under 200 tokens per injection and is repaid many times over by preventing hallucinated tool calls and wasted delegation cycles.

**N4 — Audit.** The structured JSON form MUST be retained on **AgentState** for the run and MUST be referenceable from the audit envelope (RFC 0048) as part of the governed trace.

**N5 — Blocked tools.** Blocked tool names MUST appear in `tools.blocked` (structured) and in the compact `tools_restricted` line with reason `blocked` where applicable, so the model can avoid requesting them. Descriptions for blocked tools are intentionally omitted in compact form (name only).

## 4. Design: inputs and semantics

The manifest aggregates, at minimum:

| Source | RFC | Contributes |
|--------|-----|-------------|
| Tool registry | 0003 | Tool names, descriptions, idempotent flags, optional contract references |
| Sandbox configuration | 0017 | Allow/deny lists, environment limits affecting tool viability |
| Policy rules | 0041 | `access_level` per tool, narrowing constraints, approval requirements |
| Budget tracker | 0038 | `steps_remaining`, `tool_calls_remaining`, `tokens_remaining`, `retries_remaining` |
| Agent identity | 0026 | `trust_level` |

**Access levels** align with permission semantics (RFC 0042): `pre_authorized`, `requires_delegation`, and `blocked`. Tools that are blocked by sandbox or policy appear in `tools.blocked` and MUST NOT appear in `tools.available` with `access_level: "blocked"`; blocked status is expressed only via the blocked list and compact serialization.

**Trust level** is one of `untrusted`, `low`, `medium`, `high`, derived from agent identity and deployment policy. It informs expected delegation friction, not cryptographic proof.

## 5. Injection points — the manifest heartbeat

Models experience **context decay**: as the conversation grows, information from earlier turns becomes progressively less influential on the model's output. A capability manifest injected only at `frame` is effectively forgotten by `critique_verify` in a long run. The harness counters this by re-compiling and re-injecting the manifest before every LLM call — the **manifest heartbeat**.

Each heartbeat is cheap (under 200 tokens for a typical setup) and carries current truth:

- **Budget numbers** reflect actual consumption, not the snapshot from three turns ago.
- **Tool availability** reflects any permissions revoked or consumed mid-run.
- **Constraints** reflect any policy narrowing applied during delegation.

The heartbeat is synchronized with the governed FSM (RFC 0007):

| FSM state | Heartbeat role |
|-----------|---------------|
| **`frame`** | Initial briefing — full manifest with all available tools, blocked tools, budget, trust level, constraints. |
| **`plan`** | Planning briefing — model sees what it can request before committing to a plan. Prevents hallucinated tool references. |
| **`critique_verify`** | Post-execution refresh — updated budget after tool calls; revoked permissions reflected. |
| **`finalize`** | Final-answer briefing — model knows remaining budget and can decide whether to attempt more work or synthesize. |

Conforming harnesses SHOULD inject at every LLM call, not only the four states listed above. Any additional LLM call (for example, a re-plan after critique) benefits from the same heartbeat. The per-injection cost is negligible compared to the tokens saved by preventing the model from proposing actions against stale or forgotten context.

## 6. Representations

**Structured JSON** — Canonical for storage, schema validation, audit linkage, and machine processing. This is the object persisted on AgentState and cited by audit envelopes.

**Compact text** — Canonical for model-visible context. It uses delimiter lines `[capability_manifest]` … `[/capability_manifest]` so parsers and harness scrubbers can locate and optionally strip the briefing when superseded.

Implementations MAY attach optional `tool_contract_ref` (URI or registry id) per available tool in JSON for traceability; compact text MUST NOT embed full input schemas (see §12).

## 7. JSON Schema — `capability_manifest`

<!-- opencot:schema:start -->
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://opencot.dev/schema/v0.8/capability_manifest.json",
  "title": "Open CoT RFC 0049 — Capability Manifest",
  "type": "object",
  "additionalProperties": false,
  "required": ["manifest_id", "run_id", "agent_id", "timestamp", "phase", "tools", "budget", "trust_level"],
  "properties": {
    "manifest_id": { "type": "string", "minLength": 1 },
    "run_id": { "type": "string", "minLength": 1 },
    "agent_id": { "type": "string", "minLength": 1 },
    "timestamp": { "type": "string", "format": "date-time" },
    "phase": { "type": "string", "minLength": 1, "description": "FSM phase at which this manifest was compiled (e.g., frame, critique_verify, plan)." },
    "tools": {
      "type": "object",
      "additionalProperties": false,
      "required": ["available", "blocked"],
      "properties": {
        "available": {
          "type": "array",
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["name", "description", "access_level"],
            "properties": {
              "name": { "type": "string", "minLength": 1 },
              "description": { "type": "string" },
              "access_level": { "type": "string", "enum": ["pre_authorized", "requires_delegation"] },
              "idempotent": { "type": "boolean" },
              "tool_contract_ref": { "type": "string", "description": "Optional pointer to tool contract schema (RFC 0003); not serialized in compact text." },
              "constraints": {
                "type": "object",
                "description": "Policy-imposed constraints on this tool (e.g., narrowing).",
                "additionalProperties": true
              }
            }
          }
        },
        "blocked": {
          "type": "array",
          "items": { "type": "string", "minLength": 1 },
          "description": "Tool names blocked by sandbox or policy — do not request these."
        }
      }
    },
    "budget": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "steps_remaining": { "type": "integer" },
        "tool_calls_remaining": { "type": "integer" },
        "tokens_remaining": { "type": "integer" },
        "retries_remaining": { "type": "integer" }
      }
    },
    "trust_level": { "type": "string", "enum": ["untrusted", "low", "medium", "high"] },
    "active_constraints": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Human-readable summary of active policy constraints."
    }
  }
}
```
<!-- opencot:schema:end -->

## 8. Compact text serialization

The harness SHOULD serialize the manifest to compact text for injection. The format is intentionally linear—no JSON parsing is required by the model.

```
[capability_manifest]
tools_available: <name> (<access_level>, <flags>), ...
tools_restricted: <name> (<reason>), ...
budget: <steps> steps, <tool_calls> tool calls, <tokens> tokens remaining
trust_level: <level>
constraints: <constraint1>, <constraint2>, ...
[/capability_manifest]
```

**Flags** for `tools_available` SHOULD include `idempotent` or `mutating` derived from the tool contract, and MAY include shorthand such as `read` / `execute` when the harness maps those categories from registry metadata. **Reason** in `tools_restricted` MUST distinguish `blocked` from `requires_delegation` when a restricted-but-not-blocked tool is listed for clarity; harnesses MAY omit restricted entries that are already fully described under `tools_available` with `requires_delegation`, provided the compact form remains self-consistent with the JSON.

**Omission rules.** If `active_constraints` is empty, the `constraints:` line MAY be omitted or replaced with `constraints: none`. If `budget` fields are unknown for a dimension, that segment MAY read `unknown` for that quantity rather than inventing numbers.

## 9. Token efficiency

Typical deployments SHOULD target **under 200 tokens** for a five-tool setup in compact form, excluding optional harness wrappers. Explicitly listing blocked tools trades a small number of tokens for disproportionate savings from avoided denial loops. Surfacing remaining **steps**, **tool calls**, and **tokens** enables the model to self-limit plan breadth—for example, when `tool_calls_remaining` is two, the plan SHOULD NOT assume five serial tool invocations without delegation or replanning.

## 10. Lifecycle

1. During **`receive`**, the harness gathers registry, sandbox, policy, budget, and identity inputs.
2. Before **every LLM call** (the heartbeat), the harness recompiles the manifest from current state, assigns a fresh `manifest_id`, sets `phase` to the current FSM state, and persists it on AgentState (latest manifest replaces previous; implementations MAY retain history for audit).
3. The harness injects the **compact text** form into the system message preamble (or equivalent model-facing channel).
4. After tool execution, budget and permission changes are reflected in the next heartbeat automatically — no explicit "refresh" step is needed because every heartbeat reads current state.
5. The **audit envelope** references the final manifest id or embeds hashes of canonical JSON as required by RFC 0048.

## 11. Cross-references

- RFC 0003 — Tool Invocation (contracts: name, description, idempotent flags).
- RFC 0007 — Governed FSM (injection points `frame`, `critique_verify`).
- RFC 0016 — Tool Capability Negotiation (manifest as runtime realization of negotiated capabilities).
- RFC 0017 — Safety & Sandboxing (sandbox feeds allow/deny into manifest).
- RFC 0021 — Agent Capability Declaration (declared vs manifest-granted capabilities).
- RFC 0026 — Agent Identity (`trust_level`).
- RFC 0038 — Cost-Aware Budget (budget snapshot fields).
- RFC 0041 — Policy Enforcement (access levels and constraints).
- RFC 0042 — Permissions (`pre_authorized` vs `requires_delegation`).
- RFC 0048 — Execution Receipts & Audit Envelopes (audit linkage).

## 12. Resolved design questions

1. **Input schemas in the manifest?** **No** in compact text (too verbose). Structured JSON **MAY** include `tool_contract_ref` pointing at the tool contract; models that consume OpenAI-style tool definitions continue to receive full schemas through that parallel channel.
2. **Refresh cadence?** **Normative:** `frame` and `critique_verify`. **Optional:** `plan` when stale tool references or budget drift are detected.
3. **Visibility of inaccessible tools?** **Yes, by name** for blocked tools in `tools.blocked` and compact `tools_restricted`, without descriptions, to reduce harmful guessing.

## 13. Examples

### 13.1 Structured JSON (three available tools, one blocked, medium trust)

```json
{
  "manifest_id": "cm_01jqzexample0001",
  "run_id": "run_8f3c2a",
  "agent_id": "agent_researcher_eu",
  "timestamp": "2026-04-18T14:22:05Z",
  "phase": "frame",
  "tools": {
    "available": [
      {
        "name": "search",
        "description": "Query curated document index",
        "access_level": "pre_authorized",
        "idempotent": true,
        "tool_contract_ref": "https://opencot.dev/contracts/v0.8/search.json",
        "constraints": { "max_results": 5, "no_raw_html": true }
      },
      {
        "name": "calculator",
        "description": "Safe arithmetic evaluation",
        "access_level": "pre_authorized",
        "idempotent": true
      },
      {
        "name": "writeFile",
        "description": "Write artifact to workspace",
        "access_level": "requires_delegation",
        "idempotent": false
      }
    ],
    "blocked": ["shell"]
  },
  "budget": {
    "steps_remaining": 48,
    "tool_calls_remaining": 18,
    "tokens_remaining": 95000,
    "retries_remaining": 2
  },
  "trust_level": "medium",
  "active_constraints": [
    "max 5 results per search",
    "no raw HTML in search excerpts"
  ]
}
```

### 13.2 Compact text for §13.1

```
[capability_manifest]
tools_available: search (pre_authorized, idempotent), calculator (pre_authorized, idempotent), writeFile (requires_delegation, mutating)
tools_restricted: shell (blocked)
budget: 48 steps, 18 tool calls, 95000 tokens remaining
trust_level: medium
constraints: max 5 results per search, no raw HTML in search excerpts
[/capability_manifest]
```

## 14. Acceptance criteria

Conformance for a harness implementation is indicated by all of the following:

- The harness compiles the manifest from tool registry, sandbox configuration, active policy rules, and budget tracker state, joined with agent identity for `trust_level`.
- The manifest heartbeat fires before **every LLM call** (at minimum: `frame`, `plan`, `critique_verify`, `finalize`) using the compact text format.
- For representative five-tool profiles, compact serialization stays **under 200 tokens** (excluding outer system prompt boilerplate).
- Structured JSON validates against the schema in §7.
- Each run retains manifest history or the latest manifest on **AgentState** suitable for audit.
- Automated tests cover manifest **compilation** from synthetic registry/policy inputs and **round-trip consistency** between JSON and compact text for a fixed fixture set.

## 15. Security considerations

The manifest is **non-authoritative** for enforcement: sandbox and policy engines remain the source of truth for permission decisions. A compromised model cannot elevate privileges by editing the manifest. Harnesses MUST NOT leak secrets (API keys, raw PII) into `active_constraints` or descriptions. Compact text is intended for model consumption and MAY be logged; operators SHOULD apply the same redaction policies as for other prompt material.
