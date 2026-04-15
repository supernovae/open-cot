# RFC 0008 — Dataset Packaging Standard (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.3  
**Discussion:** https://github.com/supernovae/open-cot/discussions/8
---

## 1. Summary

This RFC defines the **Dataset Packaging Standard** for distributing, sharing, and consuming structured reasoning datasets that follow the Open CoT ecosystem.

It provides a unified, model‑agnostic format for packaging:

- reasoning traces (RFC 0001)  
- verifier outputs (RFC 0002)  
- tool invocation logs (RFC 0003)  
- branching structures (RFC 0004)  
- RL reward traces (RFC 0005)  
- multi‑verifier ensembles (RFC 0006)  

The goal is to make reasoning datasets **portable, reproducible, inspectable, and interoperable** across training pipelines, evaluation harnesses, and agent frameworks.

---

## 2. Motivation

Reasoning datasets today are fragmented:

- Some contain raw CoT text with no structure.  
- Some contain tool calls but no observations.  
- Some contain verifier labels but no reward signals.  
- Some contain branching traces but no metadata.  
- Some are stored as loose JSON files with no manifest.  

This fragmentation makes it difficult to:

- train RL‑based reasoning models  
- evaluate step‑level correctness  
- reproduce agent trajectories  
- share datasets across frameworks  
- benchmark models consistently  

This RFC defines a **standard packaging format** so that reasoning datasets can be:

- versioned  
- validated  
- merged  
- sharded  
- streamed  
- consumed by any training or evaluation pipeline  

---

## 3. Design Goals

### 3.1 Must‑Have Goals
- Support all schemas from RFC 0001–0007.  
- Provide a clear directory structure.  
- Provide a dataset manifest.  
- Support sharding and streaming.  
- Support dataset‑level metadata.  
- Support dataset validation.  
- Support partial datasets (e.g., traces only, rewards only).  

### 3.2 Non‑Goals
- Defining a specific training format (e.g., HF datasets).  
- Defining a specific compression format.  
- Defining a universal licensing model.  
- Encoding model weights or training logs.

---

## 4. Dataset Structure

A dataset MUST follow this directory structure. Paths below are **relative to the dataset package root** (the `dataset/` directory is the on-disk bundle root; omit the leading `dataset/` segment when the root folder itself is named after the release).

```text
dataset/                                 # package root (release / volume root)
├── manifest.json                        # required: dataset manifest (§5)
├── traces/                              # one file per trace (RFC 0001 + extensions)
│   └── <trace_id>.json
├── verifier_outputs/                    # optional: per-trace verifier payloads (RFC 0002)
│   └── <trace_id>.json
├── ensembles/                           # optional: multi-verifier bundles (RFC 0006)
│   └── <trace_id>.json
├── rewards/                             # optional: RL reward traces (RFC 0005)
│   └── <trace_id>.json
└── metadata/                            # dataset-level descriptors
    ├── dataset.json                     # human + machine metadata
    ├── splits.json                      # train / val / test (or custom) split map
    └── license.txt                      # distribution terms for this package
```

**Naming:** `<trace_id>` is a stable identifier shared across `traces/`, `verifier_outputs/`, `ensembles/`, and `rewards/` when those sidecars refer to the same trajectory.

All subdirectories are optional **except**:

- `manifest.json`
- `traces/`

This allows datasets to be partial (e.g., traces only, or traces + rewards).

---

## 5. Manifest Specification

`manifest.json` MUST contain:

```json
{
  "version": "0.1",
  "name": "example-dataset",
  "description": "A dataset of structured reasoning traces.",
  "schemas": {
    "reasoning": "0.1",
    "verifier_output": "0.1",
    "tool_invocation": "0.1",
    "branching": "0.1",
    "reward": "0.1",
    "ensemble": "0.1"
  },
  "counts": {
    "traces": 1000,
    "verifier_outputs": 1000,
    "ensembles": 1000,
    "rewards": 1000
  },
  "splits": ["train", "validation", "test"],
  "created_at": "2026-04-14T00:00:00Z",
  "license": "MIT"
}
```

## 6. Trace Files

Each file in traces/ MUST follow RFC 0001.

Example:

traces/trace_001.json

## 7. Verififer Output Files

Each file in verifier_outputs/ MUST follow RFC 0002.

Example:

verifier_outputs/trace_001.json

## 8. Ensemble Files

Each file in ensembles/ MUST follow RFC 0006.

ensembles/trace_001.json

## 9. Reward Files

Each file in rewards/ MUST follow RFC 0005.

Example:

rewards/trace_001.json


## 10. Metadata Files

### 10.1 dataset.json
Contains dataset‑level metadata:

```json
{
  "domain": "math",
  "source": "synthetic",
  "language": "en",
  "num_tokens": 1234567
}
```

### 10.2 splits.json

```json
{
  "train": ["trace_001", "trace_002"],
  "validation": ["trace_101"],
  "test": ["trace_201"]
}
```


## 11.  Validation Requirements

A dataset MUST pass the following checks:

All traces validate against RFC 0001.
All verifier outputs validate against RFC 0002.
All ensembles validate against RFC 0006.
All reward traces validate against RFC 0005.
All referenced trace IDs exist.
Manifest counts match actual file counts.

## 12. Example Dataset Package

```text
dataset/
  manifest.json
  traces/
    trace_001.json
    trace_002.json
  verifier_outputs/
    trace_001.json
    trace_002.json
  rewards/
    trace_001.json
  metadata/
    dataset.json
    splits.json
    license.txt
```


## 13. Open Questions Resolution (normative closure)

### 13.1 Packaging profiles

- **Decision:** JSON manifest + JSON traces remain the baseline profile, with optional extension profiles for JSONL stream and columnar formats.
- **Rationale:** Baseline portability is critical; advanced storage should be opt-in.
- **Normative requirement:** Packaged datasets **MUST** include canonical manifest metadata. Non-baseline formats **MAY** be used but **MUST** declare profile type and conversion path.
- **Migration note:** Existing custom archives should add profile declarations in manifest before publication.

### 13.2 IDs and versioning

- **Decision:** Trace IDs and dataset versions are standardized at manifest level.
- **Rationale:** Stable identifiers are required for replay, provenance, and diffability.
- **Normative requirement:** Trace IDs **MUST** be stable, unique strings within a package; dataset versions **SHOULD** follow semver; dataset diffs **MAY** be emitted as optional changelog artifacts.
- **Migration note:** Datasets lacking stable IDs should regenerate IDs once and retain a legacy mapping table.

## 14.  Acceptance Criteria

This RFC will be accepted when:

At least 3 maintainers approve it.
A reference dataset passes validation.
At least one training pipeline consumes this format.
At least one evaluation harness consumes this format.


## 15. Conclusion

This RFC defines the Dataset Packaging Standard, enabling:

portable reasoning datasets
reproducible training
consistent evaluation
multi‑verifier integration
RL reward‑augmented datasets
branching and tool‑augmented traces

