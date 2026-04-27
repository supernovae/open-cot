# 📚 Annotated Bibliography: Chain‑of‑Thought & LLM Reasoning
*With direct arXiv PDF links where available.*

A curated bibliography covering foundational, structured, search‑based, RL‑based, and mechanistic reasoning research for LLMs. All arXiv‑hosted papers include stable PDF links.

---

## 1. Foundational Chain‑of‑Thought (CoT)

### Wei et al. (2022). *Chain‑of‑Thought Prompting Elicits Reasoning in Large Language Models.*
https://arxiv.org/pdf/2201.11903.pdf
Introduces CoT prompting and demonstrates large gains in arithmetic, symbolic, and commonsense reasoning.
**Relevance:** Defines the modern concept of “reasoning traces.”

### Wang et al. (2022). *Self‑Consistency Improves Chain‑of‑Thought Reasoning in LLMs.*
https://arxiv.org/pdf/2203.11171.pdf
Proposes sampling multiple CoTs and voting for the most consistent answer.
**Relevance:** Establishes statistical evaluation of reasoning.

### Zhou et al. (2022). *Least‑to‑Most Prompting.*
https://arxiv.org/pdf/2205.10625.pdf
Breaks complex tasks into simpler subproblems.
**Relevance:** Motivates structured decomposition fields in reasoning schemas.

---

## 2. Structured Reasoning & Agentic CoT

### Yao et al. (2022). *ReAct: Synergizing Reasoning and Acting in Language Models.*
https://arxiv.org/pdf/2210.03629.pdf
Combines reasoning (“Thought”) with tool actions (“Act”).
**Relevance:** Foundation of modern cognitive pipelines.

### Shinn et al. (2023). *Reflexion: Language Pipelines with Verbal Reinforcement Learning.*
https://arxiv.org/pdf/2303.11366.pdf
Introduces self‑critique and iterative refinement loops.
**Relevance:** Motivates `critique` and `revision` fields in schemas.

### Chen et al. (2022). *Program‑of‑Thoughts (PoT).*
https://arxiv.org/pdf/2211.12588.pdf
Uses executable code as reasoning traces.
**Relevance:** Demonstrates typed, verifiable reasoning.

---

## 3. Search‑Based Reasoning (Beyond Linear CoT)

### Yao et al. (2023). *Tree‑of‑Thoughts: Deliberate Problem Solving with Large Language Models.*
https://arxiv.org/pdf/2305.10601.pdf
Generalizes CoT into a search tree with branching and pruning.
**Relevance:** Motivates branching reasoning structures.

### Besta et al. (2023). *Graph‑of‑Thoughts: Solving Problems with Large Language Models and Search.*
https://arxiv.org/pdf/2308.09687.pdf
Extends ToT into graph‑structured reasoning.
**Relevance:** Encourages flexible graph‑based schemas.

### Long‑Horizon CoT Studies
(Various works; no single canonical arXiv source.)
Show that longer reasoning traces improve performance but increase instability.
**Relevance:** Motivates metadata like `confidence`, `verification_status`, and `error_type`.

---

## 4. RL‑Based Reasoning (R1‑Style, DeepSeek‑Style, Qwen‑Style)

### DeepSeek‑R1 (2024). *DeepSeek‑R1: Incentivizing Reasoning in LLMs via Reinforcement Learning.*
https://arxiv.org/pdf/2501.12948.pdf
Uses RL with verifiable rewards to produce long, structured reasoning.
**Relevance:** Aligns with structured scratchpad formats.

### Qwen2.5‑R1 (2024). *Reinforcement Learning for Reasoning.*
https://arxiv.org/pdf/2501.19393.pdf
Documents RL-centric post-training strategies that improve reasoning quality while preserving broad instruction utility.
**Relevance:** Supports reward-aware post-training pipelines and reproducibility-oriented run metadata.

---

## 5. Evaluation, Reliability, and Calibration

### Lin et al. (2021). *TruthfulQA: Measuring How Models Mimic Human Falsehoods.*
https://arxiv.org/pdf/2109.07958.pdf
Introduces reliability-oriented evaluation emphasizing truthful behavior under difficult prompts.
**Relevance:** Motivates safety-aware benchmark slices and failure-mode tracking.

### Kadavath et al. (2022). *Language Models (Mostly) Know What They Know.*
https://arxiv.org/pdf/2207.05221.pdf
Studies calibration and confidence quality in language models.
**Relevance:** Motivates confidence and uncertainty metrics in verifier outputs.

### Gao et al. (2023). *Pal: Program-Aided Language Models.*
https://arxiv.org/pdf/2211.10435.pdf
Uses executable programs to verify intermediate reasoning steps.
**Relevance:** Supports stronger step-level verification beyond format checks.

---

## 6. Open-Source Tooling and Reuse Guidance

### EleutherAI LM Evaluation Harness
https://github.com/EleutherAI/lm-evaluation-harness
De facto open benchmark runner for reproducible LLM evaluation.
**Relevance:** Should be integrated through adapters rather than reimplemented.

### Hugging Face TRL
https://github.com/huggingface/trl
Open-source stack for SFT, DPO, PPO/GRPO-style fine-tuning workflows.
**Relevance:** Preferred training primitive for alignment and preference experiments.

### vLLM
https://github.com/vllm-project/vllm
High-throughput inference engine with consistent generation behavior for evaluation and serving.
**Relevance:** Stabilizes benchmark throughput and reproducibility for large eval runs.

---

## 7. Token-Efficient Serialization Formats

### Abt, B. (2025). *TOON Format: Token-Oriented Object Notation for LLM-Friendly Data Exchange.*
https://benjamin-abt.com/blog/2025/12/12/ai-toon-format/
Production-focused design rationale for TOON, a compact notation that uses inline schema headers and pipe-delimited tabular rows to reduce token usage vs JSON.
**Relevance:** Primary design reference for the TOON adapter (RFC 0050).

### arXiv 2603.03306 (2026). *Token-Oriented Object Notation vs JSON: A Benchmark of Plain and Constrained Decoding Generation.*
https://arxiv.org/abs/2603.03306
Benchmarks TOON against plain JSON and constrained decoding generation; finds TOON's efficiency advantage follows a non-linear curve, becoming significant beyond a structural complexity threshold where cumulative syntax savings amortize initial prompt overhead.
**Relevance:** Empirical validation of TOON's token savings claims; informs when TOON is worth the adapter complexity.

### Nandakishore, G. (2026). *JTON: A Token-Efficient JSON Superset with Zen Grid Tabular Encoding for Large Language Models.* arXiv 2604.05865.
https://arxiv.org/abs/2604.05865
Introduces "Zen Grid" tabular encoding achieving 15–60% token reduction (28.5% average) across seven real-world domains with 100% syntactic validity across 12 LLMs in generation tests.
**Relevance:** Independent validation that tabular compact formats are viable for LLM I/O; benchmarks complement the TOON paper.

### ATON Format V2 Whitepaper (2025). *Adaptive Token-Oriented Notation — Production-grade data serialization for LLMs.*
https://www.atonformat.com/whitepaper.html
Reports 56% token reduction vs JSON with native relationship support, type safety, and nested structure handling.
**Relevance:** Broader ecosystem evidence that token-efficient structured formats are a viable research direction.

---

## 8. Best-Practice Checklist for Open CoT Workflows

Use this checklist when building, fine-tuning, and validating models with Open CoT:

1. **Always emit structured traces** (`version`, `task`, `steps`, `final_answer`) and validate before scoring.
2. **Use multi-sample evaluation** with consistency metrics, not only single greedy outputs.
3. **Track lineage metadata** (dataset hash, model base, adapter hash, seed, decoding config) for every run.
4. **Enforce data governance gates** (license allowlist, dedup, contamination checks, provenance fields).
5. **Run policy and safety checks** (budget limits, tool restrictions, redaction/audit events) in runtime scripts.
6. **Reuse mature OSS tooling** for training/evaluation kernels and keep Open CoT logic focused on schemas/adapters/conformance.