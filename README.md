<div align="center">

<pre>
 ██████╗ ██████╗ ████████╗
██╔════╝██╔═══██╗╚══██╔══╝
██║     ██║   ██║   ██║
██║     ██║   ██║   ██║
╚██████╗╚██████╔╝   ██║
 ╚═════╝ ╚═════╝    ╚═╝
</pre>

### Chain of Thought Reasoning Framework

**Open CoT Standard &amp; Toolkit** — an open-source, community-driven home for interoperable reasoning traces.

<img src="https://img.shields.io/badge/Project-Open%20CoT-5c6bc0?style=for-the-badge" alt="Open CoT" />
<a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License: MIT" /></a>
<a href="./docs/contributing.md"><img src="https://img.shields.io/badge/Contributions-Welcome-4caf50?style=for-the-badge" alt="Contributions welcome" /></a>
<a href="./schemas/rfc-0001-reasoning.json"><img src="https://img.shields.io/badge/Schema-JSON%20Draft-ff9800?style=for-the-badge" alt="JSON Schema" /></a>

</div>

---

## Why this exists

Many frontier models are **hiding chain-of-thought and reasoning traces**—often by encrypting or otherwise concealing intermediate steps. The result is a **deeper black box**: harder to audit, harder to teach from, and harder to align with human expectations.

**Open CoT** pushes the other direction: a **reasoning toolkit** built on **open standards** for how reasoning is represented, exchanged, and evaluated—so the ecosystem can inspect, compare, and improve reasoning **without** every lab inventing a one-off format.

## 🚀 Why This Project Exists

Modern reasoning models (DeepSeek‑R1, Qwen‑R1, OpenAI o‑series, etc.) increasingly rely on:

- structured scratchpads  
- verifiable intermediate steps  
- reward‑shaped reasoning loops  
- typed reasoning traces  
- step‑level verification  

…but none of these formats are open.

Meanwhile, open‑source models lack:

- a shared schema for reasoning  
- a standard dataset format  
- a reference implementation for reasoning loops  
- evaluation metrics for step‑level correctness  
- a way to compare reasoning quality across models  

**Open CoT Standard** fills this gap by providing a neutral, community‑maintained foundation for reasoning research.

---

## 📦 What This Repository Provides

### **1. A Universal Reasoning Schema (`/standards`)**
A JSON‑schema describing:

- steps  
- subgoals  
- evidence  
- tool actions  
- critiques  
- revisions  
- confidence scores  
- final answers  

This schema is designed to be:

- model‑agnostic  
- easy to parse  
- easy to validate  
- compatible with CoT, ReAct, ToT, GoT, PoT, and R1‑style RL  

---

### **2. Reasoning Patterns Library (`/standards/patterns`)**
Canonical templates for:

- deductive chains  
- inductive reasoning  
- hypothesis → test → revision  
- planning loops  
- self‑critique (Reflexion)  
- tool‑augmented reasoning (ReAct)  
- branching search (ToT)  
- graph‑structured reasoning (GoT)  

---

### **3. Datasets & Converters (`/datasets`)**
Tools to convert existing datasets into structured reasoning format:

- GSM8K  
- MATH  
- MMLU  
- BIG‑Bench  
- custom datasets  

Includes synthetic and human‑annotated examples.

---

### **4. Reference Implementation (`/reference`)**
A lightweight Python library that provides:

- parsing  
- validation  
- conversion  
- reasoning loop harness  
- step‑level scoring  
- self‑consistency evaluation  

This is the “batteries‑included” toolkit for working with structured CoT.

---

### **5. Benchmarks & Leaderboards (`/benchmarks`)**
Evaluation suites for:

- step‑level correctness  
- reasoning faithfulness  
- decomposition quality  
- tool‑use correctness  
- long‑horizon stability  

---

### **6. Documentation (`/docs`)**
Includes:

- annotated bibliography  
- related work  
- design principles  
- roadmap  
- contributor guide  

## Canonical reasoning patterns (library)

We collect and document **canonical reasoning patterns** so traces can be labeled, generated, and evaluated consistently. Examples include:

- **Deductive chain** — stepwise implication from premises to conclusion  
- **Inductive chain** — generalization from observations with explicit uncertainty  
- **Hypothesis → test → revision** — propose, check evidence, update belief  
- **Multi-agent debate** — distinct roles or models with structured disagreement and resolution  
- **Self-critique loop** — generate, then explicitly challenge and repair reasoning  
- **Planning → execution → verification** — goals, actions, and post-hoc checks  
- **Error-driven refinement** — detect mistakes or inconsistencies and revise earlier steps  

Pattern docs live under [`standards/reasoning-patterns.md`](./standards/reasoning-patterns.md); worked examples will accumulate under [`standards/examples/`](./standards/examples/).

## Repository map

| Area | Role |
|------|------|
| [`schemas/`](./schemas/) | Versioned JSON Schemas per RFC (`registry.json`, `rfc-*-*.json`) |
| [`examples/`](./examples/) | Validated instance fixtures keyed by registry shortname |
| [`standards/`](./standards/) | Human-readable patterns, metrics, narrative docs |
| [`datasets/`](./datasets/) | Conventions and converters for training-ready data |
| [`reference/python/`](./reference/python/) | Reference Python tooling |
| [`benchmarks/`](./benchmarks/) | Tasks, scoring, leaderboards |
| [`docs/`](./docs/) | Philosophy, roadmap, contributing |

## Reference Python library (goals)

The [`reference/python/`](./reference/python/) package is growing toward a small, focused library that can:

- **Parse** reasoning traces (e.g. JSON / JSONL)  
- **Validate** traces against the shared schema  
- **Convert** between external formats and the Open CoT schema  
- **Run** composable **reasoning loops** (building blocks for agents)  
- **Benchmark** reasoning quality using shared tasks and scorers  

Today you will find early modules such as [`parser.py`](./reference/python/parser.py), [`validator.py`](./reference/python/validator.py), and [`generator.py`](./reference/python/generator.py); converters, loop runners, and benchmarks will land alongside community contributions.

## Contributing

See [`docs/contributing.md`](./docs/contributing.md). Issues and PRs that tighten the schema, add patterns with examples, or improve evaluation are especially valuable.

## License

This project is licensed under the **MIT License**. See [`LICENSE`](./LICENSE) for the full text.

Copyright © 2026 Open CoT contributors. Permission is granted to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the software, subject to the conditions stated in the license file.
