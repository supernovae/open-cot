# Architecture

Open-CoT is a **cognitive control plane**: normative schemas, a governed finite-state machine, and audit artifacts define how proposals become permitted actions. Everything that interprets vendor-specific protocols, calls remote tools, or wraps a particular model sits in the **data plane** and must conform to the control plane contract.

## Control plane vs data plane

| Control plane (normative) | Data plane (pluggable) |
|---------------------------|-------------------------|
| RFCs and JSON Schemas | Model adapters (OpenAI-compatible, local OSS, etc.) |
| Governed execution FSM (RFC 0007) | Concrete tool implementations |
| Delegation, permission, receipt, audit schemas | Network and storage drivers |
| Policy consultation *points* and required artifacts | Organization-specific policy rule bodies |
| Validation rules and registry | Human review UX for `escalate` |

The control plane answers: *what states may we be in, what documents must exist at each step, and what may cross a trust boundary.* The data plane answers: *which LLM, which HTTP endpoint, which filesystem.*

Keeping the split sharp avoids a common failure mode: shipping a “policy layer” that only watches logs **after** tools already ran. Here, policy consultation **points** are part of the FSM; skipping them is non-conformant, not an optimization.

## Textual component diagram

Picture data moving left to right on the **happy path**:

`Model adapter` → **Reasoning envelope** (typed proposal) → **Governed FSM** (phase gate) → **Policy engine** (decision) → **Permission store** (grants) → **Auth broker** (narrowed `AuthorityReceipt`) → **Tool executor** (`execute_tool` only) → **Observation path** (`observe_result` / `critique_verify`) → **Audit engine** (`finalize` / `audit_seal`).

Side channels include **budget** enforcement (RFC 0038) and **sandbox** allow/deny lists (RFC 0017), which can pre-empt a transition or force `fail_safe` without giving unsafe payloads back to the model.

## Major components

These names describe responsibilities; a single deployment may fold multiple roles into one service, but the boundaries stay conceptually distinct.

1. **Reasoning envelope** — Structured proposal from the model (intent, constraints, requested capabilities). It is **input** to validation, not authority to act.
2. **Governed FSM** — The fourteen-state machine from RFC 0007. Only **`execute_tool`** may perform tool side effects; transitions are schema-checked and logged.
3. **Policy engine** — Evaluates rules at mandated consultation boundaries (e.g. `frame`, `plan`, `validate_authority`, `observe_result`, `critique_verify`, `finalize`). Outcomes include allow, deny, narrow, or escalate.
4. **Permission system** — Holds and revokes **grants** (RFC 0042). Grants are issued by the harness or policy stack, never minted by the model.
5. **Auth broker** — Takes approved or narrowed delegation and produces **`AuthorityReceipt`** with `granted_scope ≤ requested_scope` (RFC 0047 / 0048). This is where scope is tightened, not where the model freelances.
6. **Tool executor** — Dispatches a registered tool only inside **`execute_tool`**, consuming or citing permission, emitting **`ToolExecutionReceipt`**.
7. **Audit engine** — Assembles integrity-backed **audit envelopes** (RFC 0043 / 0048) and drives the terminal **`audit_seal`** state so a run has a durable, reviewable closure.

The **harness** in this repository implements the FSM gate, schema validation (via Ajv against repo JSON Schemas), loop-level policy checks, budgets, sandbox enforcement for registered tools, and trace emission. A production deployment might split policy and broker onto separate services, but the **same artifacts** (requests, decisions, receipts, envelopes) should still appear in the trace.

## Data flow: one tool call

1. The model emits a **ReasoningEnvelope** and plan data; the harness validates against schema (`frame` / `plan`).

   At `frame`, the adapter’s job ends at **serialization**: turning model output into JSON that matches schema. The harness’s job begins at **validation** and **policy consult**—there is no “helpful” bypass that trusts pretty-printed prose.

2. The harness records a **`DelegationRequest`** when new capability is needed (`request_authority`).

   The request carries justification and requested scope; it is evidence for auditors, not a self-signed certificate.

3. **Policy** evaluates the request in **`validate_authority`** → **`DelegationDecision`** (approved, denied, narrowed, escalated).

   Each capability in the request should be evaluated independently, per RFC 0007, so a partial approval becomes an explicit **narrowed** outcome rather than silent truncation.

4. On approval path, the **auth broker** narrows scope and attaches **`AuthorityReceipt`** (`delegate_narrow`).

5. The harness enters **`execute_tool`** with a valid grant or documented standing authorization, runs the tool, and writes **`ToolExecutionReceipt`**.

6. Results flow through **`observe_result`** and **`critique_verify`** under policy; **`finalize`** revokes outstanding grants as required; **`audit_seal`** seals the trace and audit material.

If policy denies or a hard failure occurs, control routes through **`deny`**, **`escalate`**, or **`fail_safe`** into **`audit_seal`** per RFC 0007.

**Standing authorization path:** When `plan` transitions directly to `execute_tool`, the harness must still record **why** execution was legal—typically a cited standing grant or sandbox allowlist entry on the **`ToolExecutionReceipt`**. Auditors should never have to guess that tools ran “because the model said so.”

## Schema registry and validation path

The `schemas/` directory is the **machine-readable** anchor: each RFC with schema sections publishes JSON Schema files; `registry.json` lists shortnames and versions used by examples and CI.

Downstream flows typically look like: **author** instance JSON → **validate** with `tools/validate.py` (Python) or harness-side Ajv (TypeScript) → **store or replay** the validated trace. The control plane stays identical even when the storage backend or transport changes.

## Trust boundaries

| Source | What it may supply | What it must not supply |
|--------|--------------------|-------------------------|
| Model | Proposals, plans, justifications, interpretations of observations | Self-granted permissions, forged receipts, out-of-band tool execution |
| Harness | State transitions, validation, delegation records, dispatch, trace steps | Silent policy bypass; executing tools outside `execute_tool` |
| Policy engine | Allow / deny / narrow / escalate decisions | Direct tool side effects (policy decides; executor acts) |
| Auth broker | Narrowed **`AuthorityReceipt`** | Broader scope than policy approved |
| Tool executor | Tool outputs, errors, telemetry | Authority to expand requested scope |

**Humans in `escalate`** supply judgment, not schema: the FSM only requires that escalation eventually resolves to `delegate_narrow`, `deny`, or `audit_seal` (for example on timeout). UX for reviewers is data-plane concern; the **control-plane obligation** is to record the resolution and receipts.

## Normative vs reference

- **Normative:** RFC text, JSON Schemas under `schemas/`, and the FSM / artifact rules they define. A conforming implementation must satisfy these without contradicting the specs.
- **Reference:** The TypeScript **`harness/`** package, Python helpers under **`reference/python/`** and **`tools/`**, and **`examples/`** fixtures. They demonstrate one correct reading of the specs and are expected to evolve as RFCs tighten; when reference and RFC disagree, the RFC wins and the reference should be updated.

Treat the harness as a **credible PoC** of the control plane, not as the only permissible runtime architecture.

## RFC map (minimal spine)

Implementers usually traverse these in order after RFC 0001 (reasoning / trace):

- **RFC 0007** — Governed FSM; owns which phase may call tools and where policy must be consulted.
- **RFC 0003** (+ **RFC 0018** tool errors) — Tool invocation payloads and structured failure.
- **RFC 0017** — Sandbox surfaces that constrain *which* tools or scopes are even eligible.
- **RFC 0038** — Budget objects that can terminate a run without pretending the model “agreed” to stop.
- **RFC 0041** — Policy evaluation schema and attachment semantics at FSM hooks.
- **RFC 0042** — Permissions / ACL material the harness may attach to a run.
- **RFC 0047** — Delegation requests and decisions that precede narrowed authority.
- **RFC 0048** — Execution receipts plus integrity linkage into audit envelopes.
- **RFC 0043** — Auditing and compliance log shapes that consume the above identifiers.

Additional RFCs cover identity (**RFC 0026**), provenance (**RFC 0035**), org governance (**RFC 0044**), federation, and economics; they extend the same spine rather than replacing it.

## Operational deployment patterns

- **Single binary / edge agent:** All components may run in-process; still emit the same receipts so a central collector can verify them later.
- **Split trust domains:** Policy engine and auth broker on hardened hosts; model adapter on GPU nodes; tool executor in a network-restricted VPC. The control plane stays coherent as long as **artifact IDs** chain correctly in the trace.
- **Human escalation:** `escalate` pauses the FSM; reviewers act through a workflow UI; the resumed transition must record the human decision alongside broker output.
- **Replay and forensics:** Because phases and receipts are serialized, investigators can replay a run without re-executing tools, comparing recorded policy decisions to recorded grants.

## Closing note

Adopters should map their existing “agent framework” onto this diagram explicitly: identify where proposals become JSON, where policy can still say **no** before side effects, and where receipts land for compliance. If those three answers are fuzzy, the system is still trusting the model more than the contract.
