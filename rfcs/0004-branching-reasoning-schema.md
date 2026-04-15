# RFC 0004 — Branching Reasoning Extensions (ToT / GoT)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.2  
**Discussion:** https://github.com/supernovae/open-cot/issues/4

---

## 1. Summary

This RFC proposes **branching and graph‑structured reasoning extensions** to the Open CoT Reasoning Schema.  
It enables representation of:

- **Tree‑of‑Thoughts (ToT)**  
- **Graph‑of‑Thoughts (GoT)**  
- **multi‑path exploration**  
- **search‑based reasoning**  
- **beam search / BFS / DFS reasoning**  
- **pruned branches**  
- **branch scoring and selection**  

These extensions build on RFC 0001 (Initial Reasoning Schema) and introduce new fields and conventions for representing non‑linear reasoning.

---

## 2. Motivation

Linear Chain‑of‑Thought is insufficient for many reasoning tasks:

- Complex planning  
- Mathematical proofs  
- Multi‑step coding tasks  
- Search problems  
- Multi‑hypothesis reasoning  
- RL‑trained long‑horizon reasoning  

Research such as **Tree‑of‑Thoughts** and **Graph‑of‑Thoughts** demonstrates that **branching exploration** significantly improves performance.

However:

- No open standard exists for representing branching reasoning.  
- Existing implementations use ad‑hoc formats.  
- Agent frameworks cannot interoperate.  
- RL pipelines cannot train on structured search traces.  
- Datasets cannot represent multi‑path reasoning.

This RFC defines a **unified, interoperable, graph‑friendly extension** to the reasoning schema.

---

## 3. Design Goals

### 3.1 Must‑Have Goals
- Support **trees** (ToT) and **graphs** (GoT).  
- Support **branch scoring** and **pruning**.  
- Support **multiple candidate paths**.  
- Maintain compatibility with RFC 0001.  
- Allow **partial or full exploration traces**.  
- Support **search algorithms** (BFS, DFS, beam search).  
- Support **RL reward propagation** across branches.

### 3.2 Non‑Goals
- Defining a specific search algorithm.  
- Enforcing a particular branching strategy.  
- Representing full agent state machines.  
- Encoding model weights or proprietary metadata.

---

## 4. Branching Model

A reasoning trace may contain:

- **nodes** (steps)  
- **edges** (parent → child relationships)  
- **branch groups** (sets of alternative paths)  
- **branch scores** (model‑assigned or verifier‑assigned)  
- **pruned branches** (optional)  

This RFC introduces:

- `branch_group`  
- `branch_score`  
- `pruned`  
- `exploration_strategy`  
- `path_id`  

These fields extend the existing step structure.

---

## 5. Schema Extensions (JSON)

Below are **additions** to the RFC 0001 schema.

<!-- opencot:schema:start -->
```json
{
  "branch_group": {
    "type": "string",
    "description": "Identifier for a set of sibling branches exploring alternative reasoning paths."
  },

  "branch_score": {
    "type": "number",
    "minimum": -1,
    "maximum": 1,
    "description": "Score assigned to this branch (model, verifier, or search algorithm)."
  },

  "pruned": {
    "type": "boolean",
    "description": "Whether this branch was pruned during search."
  },

  "exploration_strategy": {
    "type": "string",
    "enum": ["bfs", "dfs", "beam", "heuristic", "rl", "unknown"],
    "description": "Search strategy used to explore this branch."
  },

  "path_id": {
    "type": "string",
    "description": "Identifier for a complete reasoning path from root to leaf."
  }
}
```
<!-- opencot:schema:end -->


## 6. Example: Tree-of-Thoughts (ToT)

```json
{
  "version": "0.1",
  "task": "Find a plan to visit 3 landmarks in Paris.",

  "steps": [
    {
      "id": "root",
      "type": "thought",
      "content": "Consider possible sequences of landmarks.",
      "children": ["b1", "b2"]
    },

    {
      "id": "b1",
      "type": "branch",
      "branch_group": "g1",
      "content": "Path A: Louvre → Eiffel Tower → Notre Dame",
      "branch_score": 0.72,
      "children": ["b1a"]
    },

    {
      "id": "b1a",
      "type": "thought",
      "content": "Evaluate travel time for Path A.",
      "parent": "b1"
    },

    {
      "id": "b2",
      "type": "branch",
      "branch_group": "g1",
      "content": "Path B: Notre Dame → Louvre → Eiffel Tower",
      "branch_score": 0.64,
      "pruned": false,
      "children": ["b2a"]
    },

    {
      "id": "b2a",
      "type": "thought",
      "content": "Evaluate travel time for Path B.",
      "parent": "b2"
    }
  ],

  "final_answer": "Path A is optimal based on travel time and ordering."
}
```

## 7. Example: Graph-of-Thoughts (GoT)

```json
{
  "id": "n3",
  "type": "thought",
  "content": "Combine results from n1 and n2.",
  "parent": ["n1", "n2"],
  "path_id": "p1"
}
```

This supports DAG-style reasoning

## 8. Open Questions Resolution (normative closure)

### 8.1 Branch metadata richness

- **Decision:** Weighted/probabilistic branches and branch metadata are allowed as optional fields.
- **Rationale:** Search-heavy systems need richer annotations, but minimal traces should remain simple.
- **Normative requirement:** Core branching fields **MUST** remain valid without weights; weighted extensions **MAY** be attached with numeric values in [0,1] where probabilities are used.
- **Migration note:** Pipelines that previously used free-form branch scores should normalize into explicit numeric fields.

### 8.2 Pruning semantics

- **Decision:** Pruning uses multi-valued status labels rather than a binary-only flag.
- **Rationale:** Multi-valued labels preserve decision provenance for benchmarking and debugging.
- **Normative requirement:** Pruning annotations **SHOULD** use explicit categorical labels (`none`, `beam_pruned`, `depth_pruned`, `score_pruned`, `other`).
- **Migration note:** Boolean pruning fields should be upgraded to categorical labels in conversion scripts.

### 8.3 Scoring and ranking

- **Decision:** No single mandatory branch scorer is defined in this RFC; ranking policy is implementation-defined but must be declared.
- **Rationale:** Different tasks require different score models.
- **Normative requirement:** If path ranking is emitted, ranking method metadata **MUST** be present and reproducible.
- **Migration note:** Existing implicit ranking logic should be surfaced in benchmark run cards.

## 9. Acceptance Criteria

This RFC will be accepted when:

At least 3 maintainers approve it.
A reference implementation can parse branching traces.
At least one ToT or GoT example dataset is converted.
At least one agent loop emits branching traces.

## 10. Conclusion

This RFC introduces branching reasoning extensions that enable:

* Tree‑of‑Thoughts
* Graph‑of‑Thoughts
* multi‑path exploration
* search‑based reasoning
* RL‑compatible reasoning graphs

