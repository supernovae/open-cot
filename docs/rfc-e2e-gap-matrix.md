# Open CoT RFC-to-E2E Capability Matrix

This matrix maps current RFC coverage to the concrete functions needed for an end-to-end model workflow:

- dataset build and governance
- training and checkpoint lineage
- benchmark execution and scoring
- policy/safety/audit enforcement
- conformance and release readiness

## Coverage Legend

- `Implemented`: working code path exists in repository tooling
- `Partial`: schema or docs exist, but execution path is incomplete
- `Gap`: missing capability for practical E2E operation

## Matrix

| Capability | Primary RFCs | Current status | What exists now | Required closure |
| --- | --- | --- | --- | --- |
| Core reasoning trace format | RFC `0001` | Implemented | `schemas/`, `tools/validate.py`, `reference/python/validator.py` | Keep stable and versioned |
| Tool/verifier sidecars | RFC `0002`, `0003`, `0006` | Partial | Schema coverage + examples | Integrate into default evaluation pipeline |
| Branching/search trace structures | RFC `0004` | Partial | Schema/examples only | Add scoring and harness paths for branch metrics |
| Reward and reward fusion | RFC `0005`, `0009` | Partial | Schema/examples only | Add reward-aware evaluation and preference/RL training glue |
| Cognitive pipeline loop protocol | RFC `0007` | Partial | `reference/python/cognitive_pipeline_runner.py` mock loop | Wire into real eval/training traces and audit outputs |
| Dataset packaging/streaming | RFC `0008`, `0012` | Implemented | Packaging layouts, manifests, synthetic datasets | Add strict governance gates (dedup/contamination/provenance assertions) |
| Cognitive pipeline memory/safety/policy | RFC `0010`, `0017`, `0041`, `0045` | Partial | Schema-level docs, limited runtime checks | Enforce policy budgets/redaction/tool denial in eval scripts |
| Evaluation reporting | RFC `0022`, `0029` | Partial | `benchmarks/scoring/scorer.py`, task specs | Add self-consistency, semantic step checks, harness adapter |
| Identity/compliance/audit | RFC `0026`, `0043`, `0044` | Partial | Policies specified | Emit machine-readable audit events per run |
| Observability + budgets + cost | RFC `0031`, `0037`, `0038`, `0039` | Gap | Mostly RFC text and examples | Add runtime counters and budget guardrails in execution |
| Provenance and integrity | RFC `0035` | Partial | `export_artifacts.py` hashes | Add lineage manifests linking data/model/eval artifacts |
| Conformance profiles | RFC `0046` | Partial | Validation checks in `tools/validate.py` | Add fixture matrix + quickstart execution paths |

## Priority Gap Backlog

1. **Evaluation credibility**: connect standard OSS harness execution to Open CoT output artifacts.
2. **Scoring quality**: add self-consistency and stronger step-level checks beyond structural proxies.
3. **Lineage and reproducibility**: record training/eval artifact lineage with hashes and run metadata.
4. **Data governance automation**: fail CI/local runs on contamination, dedup, and missing provenance.
5. **Safety/policy operationalization**: enforce budgets, denial rules, and redaction in runtime scripts.
6. **Conformance adoption path**: publish runnable profile fixtures and "kick-the-tires" scripts.

## OSS Reuse Defaults

- **lm-eval-harness** for broad benchmark execution
- **TRL** for standardized SFT/DPO-style workflows
- **vLLM/TGI** for reproducible batched inference
- **W&B/MLflow** for run metadata and artifact lineage

Open CoT should remain focused on schema standards, validators, adapters, and reference fixtures while delegating benchmark execution and training primitives to established OSS stacks.
