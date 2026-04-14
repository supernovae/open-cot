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
**Relevance:** Foundation of modern agent loops.

### Shinn et al. (2023). *Reflexion: Language Agents with Verbal Reinforcement Learning.*  
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
https://arxiv.org/pdf/250