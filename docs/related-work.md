# 📚 Related Work: Structured Reasoning, Chain‑of‑Thought, and Agentic LLMs

This document summarizes the major research threads that inform the **Open CoT Standard**.  
It complements the annotated bibliography by explaining *how* each line of work influences the design of structured reasoning schemas, evaluation metrics, and agent loop protocols.

---

## 1. Chain‑of‑Thought (CoT)

### Key Ideas
- Step‑by‑step reasoning improves accuracy on arithmetic, symbolic, and commonsense tasks.
- CoT reveals intermediate reasoning steps but is often verbose and unstructured.
- Self‑Consistency (sampling multiple CoTs) improves reliability.

### Influence on This Project
- Motivates the need for **structured, typed reasoning steps**.
- Establishes the baseline for “reasoning traces” that the schema formalizes.
- Highlights the need for **faithfulness** and **verifiability** fields.

---

## 2. Structured Reasoning (ReAct, Reflexion, PoT)

### ReAct
Interleaves *Thought* and *Action* steps, enabling tool use and environment interaction.

**Impact:**  
- Schema includes `action`, `observation`, and `tool` fields.
- Supports agent loops that alternate between reasoning and acting.

### Reflexion
Adds self‑critique and iterative refinement.

**Impact:**  
- Schema includes `critique`, `revision`, and `error_type`.

### Program‑of‑Thoughts (PoT)
Uses executable code as reasoning.

**Impact:**  
- Schema supports typed reasoning (`nl`, `code`, `math`, `logic`).
- Enables verifiable intermediate steps.

---

## 3. Search‑Based Reasoning (ToT, GoT)

### Tree‑of‑Thoughts (ToT)
Models reasoning as a branching search tree.

**Impact:**  
- Schema supports `parent`, `children`, and `branch_score`.
- Enables multi‑path reasoning and pruning strategies.

### Graph‑of‑Thoughts (GoT)
Generalizes ToT to arbitrary graphs.

**Impact:**  
- Schema supports DAG‑style reasoning structures.
- Encourages flexible, non‑linear reasoning formats.

---

## 4. RL‑Based Reasoning (R1‑style)

Modern reasoning models (DeepSeek‑R1, Qwen‑R1, etc.) use reinforcement learning with:

- verifiable intermediate steps  
- reward shaping  
- long‑horizon reasoning  
- structured scratchpads  

**Impact:**  
- Schema includes `reward`, `verification_status`, and `confidence`.
- Supports RL‑friendly reasoning traces.

---

## 5. Mechanistic Interpretability of Reasoning

Studies show:

- Long CoT emerges from RL and scaling.
- Models often hallucinate reasoning steps (unfaithful CoT).
- Step‑level verification dramatically improves accuracy.

**Impact:**  
- Schema includes `evidence`, `source`, and `verifier_score`.
- Encourages explicit tracking of reasoning faithfulness.

---

## 6. Evaluation & Verification

Step‑level verification research demonstrates:

- Verifiers outperform raw CoT.
- Structured reasoning enables automated checking.
- Faithfulness and correctness diverge without constraints.

**Impact:**  
- Schema includes `step_validity`, `verifier_score`, and `justification`.
- Benchmarks include step‑level scoring.

---

## 7. Token‑Efficient Serialization Formats

### Key Ideas
- JSON is the standard interchange format for structured LLM I/O, but its verbosity (repeated keys, braces, quotes, commas) wastes tokens, especially for uniform arrays of objects.
- Several compact formats have emerged targeting the model boundary: **TOON** (Token-Oriented Object Notation), **JTON** (JSON Tabular Object Notation), and **ATON** (Adaptive Token-Oriented Notation).
- Common techniques include inline schema headers, pipe-delimited tabular rows, and indentation-based nesting — all designed to be human-readable and model-parseable.
- Published benchmarks report 20–60% token reduction vs JSON with minimal impact on generation validity.

### TOON
Uses `items[N]{field1, field2}:` headers and pipe-delimited rows. Benchmarked against JSON and constrained decoding (arXiv 2603.03306); efficiency follows a non-linear curve, advantageous beyond a structural complexity threshold.

### JTON
JSON superset with "Zen Grid" tabular encoding. 15–60% reduction, 28.5% average across seven domains (arXiv 2604.05865). 100% syntactic validity in generation tests across 12 LLMs.

### ATON
Production-grade format with native relationship support. 56% reduction vs JSON reported in the V2 whitepaper (2025).

**Impact:**
- [RFC 0050](../rfcs/0050-toon-adapter.md) adds a TOON adapter to the harness as an opt-in wire format.
- JSON Schema remains normative; TOON is a serialization adapter with round-trip fidelity.
- The adapter generalizes the pattern established by `manifestToCompactText` (RFC 0049) into a reusable, schema-aware translation layer.
- Experiment card: [`docs/experiments/toon_format_efficiency.md`](experiments/toon_format_efficiency.md).