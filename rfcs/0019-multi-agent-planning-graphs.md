# RFC 0019 — Multi‑Agent Planning Graphs (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.4  
**Discussion:** https://github.com/supernovae/open-cot/issues/19

---

## 1. Summary

This RFC defines the **Multi‑Agent Planning Graph Schema**, enabling structured representation of collaborative planning across multiple agents.

It extends:

- RFC 0004 — Branching Reasoning Extensions  
- RFC 0011 — Multi‑Agent Protocol  

---

## 2. Motivation

Multi‑agent systems require:

- shared planning graphs  
- role‑based subgraphs  
- dependency tracking  
- conflict detection  
- plan merging  

This RFC defines a **graph‑based planning representation**.

---

## 3. Graph Components

- **nodes** — tasks, subgoals, tool calls  
- **edges** — dependencies  
- **owners** — agent responsible for each node  
- **status** — pending, running, done, failed  

---

## 4. Full Schema (JSON)

    {
      "nodes": [
        {
          "id": "n1",
          "description": "Plan route",
          "owner": "planner",
          "status": "pending"
        }
      ],
      "edges": [
        { "from": "n1", "to": "n2" }
      ]
    }

---

## 5. Example

    {
      "nodes": [
        { "id": "n1", "owner": "planner" },
        { "id": "n2", "owner": "executor" }
      ],
      "edges": [
        { "from": "n1", "to": "n2" }
      ]
    }

---

## 6. Conclusion

This RFC defines a unified planning graph for multi‑agent coordination.
