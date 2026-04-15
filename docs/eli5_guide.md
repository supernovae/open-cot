# Open CoT ELI5 Guide

This guide explains Open CoT in plain language.

If you are not an LLM expert, this is for you.

---

## 1) What is this project?

Imagine a classroom where every student solves math problems differently, and nobody shows their work.

That is what many AI models look like today:

- they give an answer
- but you cannot see how they reasoned
- and every tool uses different formats

**Open CoT** fixes that by giving everyone a shared way to write down reasoning.

In this project, a model can output a structured "reasoning trace" (like step-by-step work), and we can:

- validate it
- test it
- score it
- compare runs
- improve it

So this repo is a **standard + toolkit** for open reasoning.

---

## 2) Why does this project exist?

Because black-box reasoning is hard to trust, hard to debug, and hard to improve.

Open CoT gives you:

1. **Shared schemas**  
   A schema is a "rule sheet" for what valid reasoning data should look like.

2. **Validation tools**  
   Check if traces are well-formed.

3. **Example data**  
   See good examples and start fast.

4. **Experiment scripts**  
   Run pre/post checks, compare runs, and export reproducible artifacts.

5. **Conformance fixtures**  
   Prove your implementation matches the standard profiles.

---

## 3) What can I do here as a beginner?

You can do all of this without being an ML researcher:

- Run a full smoke test in about 15 minutes (CPU-friendly)
- Validate schemas and examples
- Run benchmark-style scoring
- See safety/governance checks (contamination, policy, audit artifacts)
- Try a real model fine-tuning flow later (GPU recommended)

---

## 4) Mental model (super simple)

Think of Open CoT as a factory line:

1. **Data** comes in (tasks/traces)
2. It gets turned into **training format**
3. A model is evaluated with **pre/post checks**
4. Results are validated and scored
5. Artifacts get hashed so runs are reproducible

If something is malformed, tooling should fail fast.

---

## 5) Repo map (what each part is for)

- `schemas/` -> the official JSON schemas
- `examples/` -> known-good JSON examples
- `rfcs/` -> design specs and standards docs
- `tools/` -> validators, schema sync, diff checks, governance checks
- `experiments/factory/` -> scripts for prepare/train/eval/export
- `benchmarks/` -> scoring code + task specs
- `conformance/fixtures/` -> profile-level fixture matrix and samples
- `scripts/` -> one-command quickstart paths

---

## 6) Quick start (no expert mode)

From repo root:

```bash
bash scripts/quickstart_cpu_mock.sh
```

What this does:

1. creates `.venv` if missing
2. installs minimal dependencies
3. prepares SFT data from synthetic traces
4. runs mock pre/post evaluation
5. validates schema/examples
6. runs data governance checks
7. exports artifact hashes

Expected output files:

- `experiments/runs/quickstart/pre_post_summary.json`
- `experiments/runs/quickstart/artifact_summary.json`
- `experiments/runs/quickstart/data_governance_report.json`

If those exist and no command failed, your local pipeline works.

---

## 7) "I only want benchmark/testing flow"

Run:

```bash
bash scripts/quickstart_benchmark_only.sh
```

This path focuses on:

- scoring
- conformance fixture checks
- adapter flow for benchmark output shape

Good for people who want evaluation without training first.

---

## 8) "I want real model fine-tuning"

Use GPU path (recommended for practical speed):

```bash
bash scripts/quickstart_gpu_real.sh
```

This path runs:

- `prepare_cot_sft.py`
- `train_qwen_peft.py`
- `eval_pre_post.py`
- `export_artifacts.py`

You can also read:

- `experiments/local_oss_runbook.md`

for full setup and details.

---

## 9) How testing works in plain language

There are several kinds of checks:

1. **Schema checks**  
   "Is this JSON shaped correctly?"

2. **Scoring checks**  
   "Did the answer match?"  
   "Did steps look valid?"  
   "Are multiple sampled answers consistent?"

3. **Governance checks**  
   "Did we leak benchmark tasks into training?"  
   "Are there duplicates?"  
   "Is provenance metadata present?"

4. **Safety/policy checks**  
   "Did output exceed limits?"  
   "Did policy deny restricted patterns?"  
   "Were audit events captured?"

---

## 10) Key scripts you should know

- `tools/validate.py`  
  Validate schemas, refs, examples, and conformance profile basics.

- `tools/data_governance_check.py`  
  Check contamination, dedup, provenance fields.

- `tools/check_conformance_fixtures.py`  
  Validate profile fixture matrix.

- `experiments/factory/eval_pre_post.py`  
  Run pre/post eval and produce metrics + traces + lineage + audit outputs.

- `experiments/factory/run_lm_eval_adapter.py`  
  Adapt benchmark-style outputs into Open CoT artifacts.

---

## 11) Why this is valuable even if you are "just learning"

Learning AI can feel vague because everyone uses different formats and hidden assumptions.

Open CoT gives structure:

- same data shape
- same validation rules
- same reproducibility pattern
- same conformance targets

So when you experiment, you learn transferable skills instead of one-off hacks.

---

## 12) How to contribute as a non-expert

You can help by:

- improving docs and examples
- adding test fixtures
- trying quickstart and reporting friction
- proposing better beginner defaults
- adding small benchmark tasks with clean rubrics

Start here:

- `docs/contributing.md`

---

## 13) Frequently asked beginner questions

### "Do I need a GPU to start?"
No. Use `scripts/quickstart_cpu_mock.sh`.

### "Do I need to understand RL first?"
No. Start with schemas + validation + benchmark quickstart.

### "What if I break something?"
That is normal. The tools are designed to fail early and tell you what is wrong.

### "How do I know if my run is reproducible?"
Check exported hashes, lineage files, and saved metrics summaries.

---

## 14) Suggested learning path (60-90 minutes)

1. Read this guide once.
2. Run CPU quickstart.
3. Open `pre_post_summary.json`.
4. Run `python tools/validate.py`.
5. Run benchmark-only quickstart.
6. Read `experiments/README.md`.
7. Explore one RFC + one matching schema + one example.

By this point, you will understand the "why" and the "how."

---

## 15) Bottom line

Open CoT helps people build and test reasoning systems in an open, consistent, and teachable way.

You do not need to be an expert to start.
You only need:

- a terminal
- curiosity
- and the quickstart scripts in this repo

