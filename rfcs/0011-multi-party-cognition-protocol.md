# RFC 0011 — Multi‑Cognitive pipeline Protocol (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.4  
**Discussion:** https://github.com/supernovae/open-cot/discussions/11
---

## 1. Summary

This RFC defines the **Multi‑Cognitive pipeline Protocol**, a standardized framework for coordinating multiple LLM‑based pipelines that collaborate, compete, or specialize across tasks.

It extends:

- RFC 0001 — Reasoning Schema  
- RFC 0003 — Tool Invocation Schema  
- RFC 0004 — Branching Reasoning Extensions  
- RFC 0007 — Cognitive Pipeline Protocol  
- RFC 0010 — Cognitive pipeline Memory Schema  

The goal is to define a **clean, interoperable protocol** for multi‑cognitive pipeline systems that exchange structured messages, share memory selectively, and coordinate reasoning.

---

## 2. Motivation

Multi‑cognitive pipeline systems are increasingly important for:

- decomposition of complex tasks  
- specialization (planner, coder, verifier, critic, executor)  
- adversarial reasoning  
- self‑play  
- distributed tool use  
- multi‑step planning  
- multi‑modal collaboration  

Today, multi‑cognitive pipeline frameworks are:

- inconsistent  
- unstructured  
- incompatible  
- difficult to serialize or replay  

This RFC defines a **unified multi‑cognitive pipeline protocol** for structured reasoning ecosystems.

---

## 3. Design Goals

### 3.1 Must‑Have Goals
- Support structured cognitive pipeline‑to‑cognitive pipeline messages  
- Support shared and private memory (RFC 0010)  
- Support cognitive pipeline roles and capabilities  
- Support deterministic replay  
- Support multi‑cognitive pipeline reasoning graphs  
- Support tool‑augmented multi‑cognitive pipeline workflows  

### 3.2 Non‑Goals
- Defining a universal cognitive pipeline architecture  
- Defining a universal communication algorithm  
- Encoding model weights or training logs  

---

## 4. Multi‑Cognitive pipeline Model

A multi‑cognitive pipeline system consists of:

- **pipelines[]** — each with identity, role, capabilities  
- **messages[]** — structured communication events  
- **shared_memory** — optional global memory  
- **private_memory** — per‑cognitive pipeline memory (RFC 0010)  
- **coordination_strategy** — optional (planner, auction, voting, etc.)  

---

## 5. Full Schema (JSON)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "OpenCoT Multi-Party Protocol v0.2",
  "type": "object",

  "properties": {
    "version": { "type": "string", "enum": ["0.2"] },

    "pipelines": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "requester_id": { "type": "string" },
          "role": { "type": "string" },
          "capabilities": { "type": "array", "items": { "type": "string" } }
        },
        "required": ["requester_id", "role"]
      }
    },

    "messages": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "message_id": { "type": "string" },
          "sender": { "type": "string" },
          "receiver": { "type": "string" },
          "observed_at": { "type": "string", "format": "date-time" },
          "content": { "type": "string" },
          "metadata": { "type": "object" }
        },
        "required": ["message_id", "sender", "receiver", "observed_at", "content"]
      }
    },

    "shared_memory": { "type": "object" },

    "coordination_strategy": { "type": "string" }
  },

  "required": ["version", "pipelines", "messages"]
}
```

---

## 6. Example

```json
{
  "pipelines": [
    { "requester_id": "planner", "role": "planner" },
    { "requester_id": "coder", "role": "executor" }
  ],
  "messages": [
    {
      "message_id": "m1",
      "sender": "planner",
      "receiver": "coder",
      "observed_at": "2026-04-14T11:32:12Z",
      "content": "Implement function f(x)."
    }
  ]
}
```

---

## 7. Open Questions Resolution (normative closure)

### 7.1 Messaging mode

- **Decision:** Broadcast is supported as an explicit delivery mode in message metadata.
- **Rationale:** Multi-cognitive pipeline collaboration often requires fan-out coordination.
- **Normative requirement:** Messages **MUST** support unicast delivery; broadcast **MAY** be used with explicit recipient semantics.
- **Migration note:** Existing ad hoc broadcast conventions should be normalized through a delivery-mode field.

### 7.2 Cognitive pipeline groups

- **Decision:** Cognitive pipeline grouping is supported through optional `group_id` metadata.
- **Rationale:** Group semantics improve role orchestration without requiring topology hard-coding.
- **Normative requirement:** Group membership **MAY** be declared; when declared, group IDs **MUST** be stable within a session.
- **Migration note:** Role-only systems can incrementally adopt groups without breaking existing cognitive pipeline identifiers.

### 7.3 Coordination strategy

- **Decision:** No single mandatory strategy is imposed, but strategy declaration is required when non-default coordination is used.
- **Rationale:** Different workloads need planner-worker, voting, or auction-based coordination.
- **Normative requirement:** If coordination_strategy is set, implementations **MUST** include strategy name and deterministic parameters.
- **Migration note:** Implicit coordinator behavior should be surfaced in run metadata for reproducibility.

---

## 8. Acceptance Criteria

- Reference implementation  
- Multi‑cognitive pipeline dataset  
- Multi‑cognitive pipeline cognitive pipeline  

---

## 9. Conclusion

This RFC defines the **Multi‑Cognitive pipeline Protocol**, enabling structured multi‑cognitive pipeline collaboration.
