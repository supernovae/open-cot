# RFC 0011 — Multi‑Agent Protocol (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.4  
**Discussion:** https://github.com/supernovae/open-cot/discussions/11
---

## 1. Summary

This RFC defines the **Multi‑Agent Protocol**, a standardized framework for coordinating multiple LLM‑based agents that collaborate, compete, or specialize across tasks.

It extends:

- RFC 0001 — Reasoning Schema  
- RFC 0003 — Tool Invocation Schema  
- RFC 0004 — Branching Reasoning Extensions  
- RFC 0007 — Agent Loop Protocol  
- RFC 0010 — Agent Memory Schema  

The goal is to define a **clean, interoperable protocol** for multi‑agent systems that exchange structured messages, share memory selectively, and coordinate reasoning.

---

## 2. Motivation

Multi‑agent systems are increasingly important for:

- decomposition of complex tasks  
- specialization (planner, coder, verifier, critic, executor)  
- adversarial reasoning  
- self‑play  
- distributed tool use  
- multi‑step planning  
- multi‑modal collaboration  

Today, multi‑agent frameworks are:

- inconsistent  
- unstructured  
- incompatible  
- difficult to serialize or replay  

This RFC defines a **unified multi‑agent protocol** for structured reasoning ecosystems.

---

## 3. Design Goals

### 3.1 Must‑Have Goals
- Support structured agent‑to‑agent messages  
- Support shared and private memory (RFC 0010)  
- Support agent roles and capabilities  
- Support deterministic replay  
- Support multi‑agent reasoning graphs  
- Support tool‑augmented multi‑agent workflows  

### 3.2 Non‑Goals
- Defining a universal agent architecture  
- Defining a universal communication algorithm  
- Encoding model weights or training logs  

---

## 4. Multi‑Agent Model

A multi‑agent system consists of:

- **agents[]** — each with identity, role, capabilities  
- **messages[]** — structured communication events  
- **shared_memory** — optional global memory  
- **private_memory** — per‑agent memory (RFC 0010)  
- **coordination_strategy** — optional (planner, auction, voting, etc.)  

---

## 5. Full Schema (JSON)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "OpenCoT Multi-Agent Protocol v0.1",
  "type": "object",

  "properties": {
    "version": { "type": "string", "enum": ["0.1"] },

    "agents": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "agent_id": { "type": "string" },
          "role": { "type": "string" },
          "capabilities": { "type": "array", "items": { "type": "string" } }
        },
        "required": ["agent_id", "role"]
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
          "timestamp": { "type": "string" },
          "content": { "type": "string" },
          "metadata": { "type": "object" }
        },
        "required": ["message_id", "sender", "receiver", "content"]
      }
    },

    "shared_memory": { "type": "object" },

    "coordination_strategy": { "type": "string" }
  },

  "required": ["version", "agents", "messages"]
}
```

---

## 6. Example

```json
{
  "agents": [
    { "agent_id": "planner", "role": "planner" },
    { "agent_id": "coder", "role": "executor" }
  ],
  "messages": [
    {
      "message_id": "m1",
      "sender": "planner",
      "receiver": "coder",
      "content": "Implement function f(x)."
    }
  ]
}
```

---

## 7. Open Questions Resolution (normative closure)

### 7.1 Messaging mode

- **Decision:** Broadcast is supported as an explicit delivery mode in message metadata.
- **Rationale:** Multi-agent collaboration often requires fan-out coordination.
- **Normative requirement:** Messages **MUST** support unicast delivery; broadcast **MAY** be used with explicit recipient semantics.
- **Migration note:** Existing ad hoc broadcast conventions should be normalized through a delivery-mode field.

### 7.2 Agent groups

- **Decision:** Agent grouping is supported through optional `group_id` metadata.
- **Rationale:** Group semantics improve role orchestration without requiring topology hard-coding.
- **Normative requirement:** Group membership **MAY** be declared; when declared, group IDs **MUST** be stable within a session.
- **Migration note:** Role-only systems can incrementally adopt groups without breaking existing agent identifiers.

### 7.3 Coordination strategy

- **Decision:** No single mandatory strategy is imposed, but strategy declaration is required when non-default coordination is used.
- **Rationale:** Different workloads need planner-worker, voting, or auction-based coordination.
- **Normative requirement:** If coordination_strategy is set, implementations **MUST** include strategy name and deterministic parameters.
- **Migration note:** Implicit coordinator behavior should be surfaced in run metadata for reproducibility.

---

## 8. Acceptance Criteria

- Reference implementation  
- Multi‑agent dataset  
- Multi‑agent agent loop  

---

## 9. Conclusion

This RFC defines the **Multi‑Agent Protocol**, enabling structured multi‑agent collaboration.
