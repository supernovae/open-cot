# RFC 0007 — Agent Loop Protocol (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.3  
**Discussion:** https://github.com/<your-org>/<your-repo>/issues/7

---

## 1. Summary

This RFC defines the **Agent Loop Protocol**, a standardized execution model for LLM‑based agents that produce structured reasoning traces, invoke tools, process observations, integrate verifier outputs, and optionally generate RL reward signals.

It unifies the schemas defined in:

- RFC 0001 — Reasoning Schema  
- RFC 0002 — Verifier Output Schema  
- RFC 0003 — Tool Invocation Schema  
- RFC 0004 — Branching Reasoning Extensions  
- RFC 0005 — RL Reward Trace Schema  
- RFC 0006 — Multi‑Verifier Ensemble Schema  

The goal is to define a **canonical, interoperable agent loop** that is deterministic, inspectable, reproducible, and compatible with both symbolic and RL‑based reasoning systems.

---

## 2. Motivation

Modern LLM agents require:

- structured reasoning  
- tool invocation  
- observation handling  
- self‑critique and revision  
- branching exploration (ToT/GoT)  
- verifier feedback  
- RL reward shaping  

But today:

- Every agent framework uses a different loop.  
- Tool invocation formats are inconsistent.  
- Observations are unstructured.  
- Reasoning traces are not standardized.  
- Verifier integration is ad‑hoc.  
- RL pipelines cannot reuse each other’s data.  

This RFC defines a **unified agent loop protocol** that all frameworks can adopt.

---

## 3. Design Goals

### 3.1 Must‑Have Goals
- Define a canonical loop structure.  
- Support structured reasoning steps (RFC 0001).  
- Support tool invocation + observation (RFC 0003).  
- Support branching (RFC 0004).  
- Support verifier integration (RFC 0002, RFC 0006).  
- Support RL reward integration (RFC 0005).  
- Support deterministic replay.  
- Support partial or full trajectories.

### 3.2 Non‑Goals
- Defining a specific planning algorithm.  
- Defining a universal tool registry.  
- Defining a universal reward function.  
- Encoding model weights or training logs.

---

## 4. Agent Loop Overview

The canonical agent loop consists of:

1. **Reason Step**  
   Model produces a structured reasoning step.  
   May include subgoals, critiques, revisions, or branches.

2. **Action Step (optional)**  
   Model invokes a tool using the Tool Invocation Schema.

3. **Observation Step (optional)**  
   Tool returns structured output.  
   Agent incorporates it into the reasoning trace.

4. **Verification Step (optional)**  
   Verifiers evaluate steps and produce correctness signals.

5. **Reward Step (optional)**  
   RL reward traces are generated or updated.

6. **Termination Step**  
   Model emits a `final_answer`.

This loop repeats until termination criteria are met.

---

## 5. Protocol State Machine

Linear control flow (optional steps may be skipped per trajectory). All boxes share one column width for alignment in monospace viewers.

```text
                ┌─────────────────┐
                │     Reason      │
                └────────┬────────┘
                         │
                         ▼
                ┌─────────────────┐
                │     Action      │ ──► RFC 0003 · tool invocation
                └────────┬────────┘
                         │
                         ▼
                ┌─────────────────┐
                │  Observation    │
                └────────┬────────┘
                         │
                         ▼
                ┌─────────────────┐
                │ Verification    │
                └────────┬────────┘
                         │
                         ▼
                ┌─────────────────┐
                │     Reward      │
                └────────┬────────┘
                         │
                         ▼
                ┌─────────────────┐
                │   Terminate     │
                └─────────────────┘
```

Branching (ToT/GoT) introduces parallel or graph‑structured Reason → Action → Observation paths.

---

## 6. Protocol Specification

### 6.1 Reason Step
A Reason step MUST:

- produce a structured step (RFC 0001)  
- optionally reference parent steps  
- optionally create branches (RFC 0004)  
- optionally include critiques or revisions  

### 6.2 Action Step
An Action step MUST:

- use the Tool Invocation Schema (RFC 0003)  
- specify tool name + arguments  
- reference the triggering Reason step  

### 6.3 Observation Step
An Observation step MUST:

- record structured tool output  
- reference the Action step  
- propagate errors if present  

### 6.4 Verification Step
A Verification step MAY:

- attach verifier outputs (RFC 0002)  
- attach ensemble outputs (RFC 0006)  
- update step correctness  

### 6.5 Reward Step
A Reward step MAY:

- attach step‑level rewards  
- attach branch‑level rewards  
- attach trajectory‑level rewards  
- specify credit assignment (RFC 0005)  

### 6.6 Termination Step
Termination occurs when:

- the model emits a `final_answer`, OR  
- a maximum step limit is reached, OR  
- a tool signals termination, OR  
- a verifier signals termination  

---

## 7. Full Protocol Example

```json
{
  "version": "0.1",
  "task": "Find the population of Tokyo and compute its square root.",

  "steps": [
    {
      "id": "s1",
      "type": "thought",
      "content": "I should call the search tool to get Tokyo's population."
    },
    {
      "id": "s2",
      "type": "action",
      "content": "call:search",
      "tool_invocation": {
        "tool_name": "search",
        "arguments": { "query": "population of Tokyo" },
        "triggered_by_step": "s1"
      }
    },
    {
      "id": "s3",
      "type": "observation",
      "content": "{\"population\": 13960000}",
      "parent": "s2"
    },
    {
      "id": "s4",
      "type": "calculation",
      "content": "sqrt(13960000) ≈ 3736.0",
      "parent": "s3"
    }
  ],

  "final_answer": "The square root of Tokyo's population (~13.96M) is approximately 3736."
}

## 8. Open Questions

### 8.1 Should the protocol support:

multi‑agent collaboration?
tool‑initiated actions?
asynchronous tool calls?
streaming observations?

### 8.2 Should we define:

a canonical termination condition?
a standard for agent memory?
a standard for agent state serialization?

### 8.3 Should the protocol enforce:

step ordering?
DAG structure?
maximum recursion depth?

## 9. Acceptance Criteria

This RFC will be accepted when:

At least 3 maintainers approve it.
A reference agent loop implementation follows the protocol.
At least one tool‑augmented dataset uses the protocol.
At least one RL pipeline integrates reward traces using the protocol.


## 10. Conclusion
This RFC defines the Agent Loop Protocol, the execution backbone for:

structured reasoning
tool use
branching exploration
verification

RL reward shaping