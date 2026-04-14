# RFC 0010 — Agent Memory Schema (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.3  
**Discussion:** https://github.com/supernovae/open-cot/issues/10

---

## 1. Summary

This RFC defines the **Agent Memory Schema**, a structured, model‑agnostic format for representing persistent and ephemeral memory used by LLM‑based agents during reasoning, planning, and tool‑augmented execution.

It extends and complements:

- RFC 0001 — Reasoning Schema  
- RFC 0003 — Tool Invocation Schema  
- RFC 0004 — Branching Reasoning Extensions  
- RFC 0007 — Agent Loop Protocol  

The goal is to standardize how agents store, retrieve, update, and serialize memory across steps, episodes, and tasks.

---

## 2. Motivation

Modern agents require memory for:

- tracking intermediate results  
- storing retrieved knowledge  
- maintaining tool state  
- caching observations  
- remembering subgoals  
- tracking failures and retries  
- maintaining long‑horizon context  
- supporting multi‑step planning  
- enabling multi‑agent collaboration  

Today, memory formats are:

- inconsistent  
- framework‑specific  
- unstructured  
- difficult to serialize  
- incompatible across agent systems  

This RFC defines a **unified, interoperable memory schema** that supports:

- short‑term (ephemeral) memory  
- long‑term (persistent) memory  
- tool‑specific memory  
- reasoning‑specific memory  
- search‑based memory (ToT/GoT)  
- RL‑based memory (reward traces, verifier feedback)  

---

## 3. Design Goals

### 3.1 Must‑Have Goals
- Support multiple memory types (short‑term, long‑term, tool, episodic).  
- Support structured, typed memory entries.  
- Support deterministic serialization and replay.  
- Support integration with the Agent Loop Protocol (RFC 0007).  
- Support memory updates, deletions, and versioning.  
- Support multi‑agent memory isolation.

### 3.2 Non‑Goals
- Defining a universal memory retrieval algorithm.  
- Defining a specific vector database or embedding model.  
- Encoding model weights or training logs.  
- Replacing reasoning traces or tool logs.

---

## 4. Memory Model

The Agent Memory Schema defines four categories:

### 4.1 Short‑Term Memory (STM)
Ephemeral memory used within a single reasoning episode.

Examples:
- intermediate results  
- temporary variables  
- partial tool outputs  
- active subgoals  
- search frontier nodes  

### 4.2 Long‑Term Memory (LTM)
Persistent memory stored across episodes.

Examples:
- user preferences  
- learned heuristics  
- cached tool results  
- stable world knowledge  

### 4.3 Episodic Memory
Chronological logs of past episodes.

Examples:
- past tasks  
- past failures  
- past successes  
- past tool interactions  

### 4.4 Tool Memory
State associated with specific tools.

Examples:
- authentication tokens  
- cached API responses  
- tool‑specific configuration  

---

## 5. Full Schema (JSON)

    {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "title": "OpenCoT Agent Memory Schema v0.1",
      "type": "object",

      "properties": {
        "version": {
          "type": "string",
          "enum": ["0.1"],
          "description": "Schema version."
        },

        "agent_id": {
          "type": "string",
          "description": "Unique identifier for the agent."
        },

        "short_term_memory": {
          "type": "array",
          "description": "Ephemeral memory entries for the current episode.",
          "items": {
            "type": "object",
            "properties": {
              "key": { "type": "string" },
              "value": {},
              "type": { "type": "string" },
              "expires_at": { "type": "string" }
            },
            "required": ["key", "value"]
          }
        },

        "long_term_memory": {
          "type": "array",
          "description": "Persistent memory entries across episodes.",
          "items": {
            "type": "object",
            "properties": {
              "key": { "type": "string" },
              "value": {},
              "type": { "type": "string" },
              "updated_at": { "type": "string" },
              "confidence": { "type": "number" }
            },
            "required": ["key", "value"]
          }
        },

        "episodic_memory": {
          "type": "array",
          "description": "Chronological logs of past episodes.",
          "items": {
            "type": "object",
            "properties": {
              "episode_id": { "type": "string" },
              "timestamp": { "type": "string" },
              "summary": { "type": "string" },
              "metadata": { "type": "object" }
            },
            "required": ["episode_id", "timestamp"]
          }
        },

        "tool_memory": {
          "type": "object",
          "description": "Tool-specific memory keyed by tool name.",
          "additionalProperties": {
            "type": "object",
            "properties": {
              "state": { "type": "object" },
              "last_used": { "type": "string" }
            }
          }
        }
      },

      "required": ["version", "agent_id"]
    }

---

## 6. Example: Short‑Term Memory

    {
      "short_term_memory": [
        {
          "key": "current_subgoal",
          "value": "Compute partial sum",
          "type": "string",
          "expires_at": "2026-04-14T12:00:00Z"
        }
      ]
    }

---

## 7. Example: Long‑Term Memory

    {
      "long_term_memory": [
        {
          "key": "preferred_units",
          "value": "metric",
          "type": "preference",
          "updated_at": "2026-04-10T09:00:00Z",
          "confidence": 0.95
        }
      ]
    }

---

## 8. Example: Tool Memory

    {
      "tool_memory": {
        "weather_api": {
          "state": {
            "cached_city": "Austin",
            "cached_result": "Clear skies, 72F"
          },
          "last_used": "2026-04-14T11:30:00Z"
        }
      }
    }

---

## 9. Open Questions Resolution (normative closure)

### 9.1 Memory policy features

- **Decision:** Expiration, compression, embeddings, and encryption tags are all supported as optional policy fields.
- **Rationale:** Memory systems vary by runtime and compliance context.
- **Normative requirement:** Base memory entries **MUST** remain valid without optional policy fields; when encryption is used, entries **MUST** include key/reference metadata rather than raw key material.
- **Migration note:** Legacy encrypted payloads should add key-reference fields for portability.

### 9.2 Retrieval, conflict, and provenance

- **Decision:** Retrieval remains implementation-defined; conflict semantics defer to RFC 0014; provenance aligns with RFC 0035.
- **Rationale:** Avoids duplicating authority across memory-related RFCs.
- **Normative requirement:** Implementations **SHOULD** expose deterministic retrieval behavior, and memory conflict resolution **MUST** follow RFC 0014 strategy declarations.
- **Migration note:** Existing memory stores with implicit overwrite behavior should declare explicit conflict strategy.

### 9.3 Storage topology

- **Decision:** Detached memory snapshots are canonical, with optional trace-level references.
- **Rationale:** Detached storage scales better and supports replay/audits.
- **Normative requirement:** Memory snapshots **MUST** carry stable IDs and trace linkage when used in loop execution.
- **Migration note:** Embedded-memory-only traces should migrate to referenced sidecar snapshots in staged releases.

---

## 10. Acceptance Criteria

This RFC will be accepted when:

- At least 3 maintainers approve it.  
- A reference implementation can serialize and deserialize memory.  
- At least one agent framework uses this schema.  
- At least one dataset includes memory snapshots.

---


## 11. Conclusion

This RFC defines the **Agent Memory Schema**, enabling:

- structured memory  
- deterministic replay  
- multi‑episode reasoning  
- tool‑augmented memory  
- long‑horizon planning  
- multi‑agent compatibility  