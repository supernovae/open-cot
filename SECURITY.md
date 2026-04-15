# Security Policy

## Reporting a Vulnerability

If you discover a security issue, please report it **privately** to project maintainers before opening a public issue.

Open a [private security advisory](https://github.com/supernovae/open-cot/security/advisories/new) on GitHub).

Include:

- Affected files/components
- Reproduction steps (minimal reproducer preferred)
- Impact assessment (data exposure, code execution, etc.)
- Suggested remediation if available

## Response Expectations

| Milestone | Target |
|-----------|--------|
| Acknowledge receipt | 48 hours |
| Triage & severity assessment | 5 business days |
| Patch or mitigation | depends on severity; critical within 7 days |

Reporters will be credited in the release notes unless they request anonymity.

## Scope

This policy covers vulnerabilities in:

- Tooling scripts (`tools/`, `scripts/`, `datasets/`)
- CI/workflow configurations (`.github/workflows/`)
- Example and reference execution paths (`reference/`, `experiments/`)
- Schema validation and ingestion pipelines
- Dependencies declared in `requirements-tools.txt` and `experiments/requirements-qwen-peft.txt`

## CI/CD Security Gates

Every push and pull request is guarded by the following automated checks:

### Code Quality & Linting

| Workflow | What it checks | Trigger |
|----------|---------------|---------|
| **Validate schemas** | JSON syntax of all `schemas/*.json` and `examples/**/*.json`; meta-schema conformance; Tier A coverage; RFC-to-schema sync | push + PR to `main` |
| **Schema breaking changes** | Semantic diff of JSON Schemas vs base branch; blocks major breaking changes | PR to `main` (schema paths) |
| **Python lint (Ruff)** | Lint rules (pyflakes, bugbear, bandit security subset, isort, pyupgrade) + format check | push + PR to `main` |
| **ShellCheck** | Static analysis of all `.sh` scripts for correctness, quoting, and portability | push + PR to `main` (`.sh` paths) |

### Security Scanning

| Workflow | What it checks | Trigger |
|----------|---------------|---------|
| **CodeQL Analysis** | GitHub's semantic code analysis for Python — injection flaws, unsafe deserialization, path traversal, etc. | push + PR to `main`; weekly schedule |
| **Dependency Review** | Flags newly-introduced dependencies with known CVEs (HIGH+); blocks GPL-3.0/AGPL-3.0 licenses | PR to `main` |
| **Gitleaks Secret Scanning** | Scans full git history for accidentally committed secrets, tokens, and credentials | push + PR to `main` |
| **PII Prompt Scan (Presidio)** | Uses Microsoft Presidio to detect PII entities in prompt-bearing dataset/task files (`datasets/**`, `benchmarks/**`, `experiments/**/*.jsonl`) and fails contributions when findings are detected | push + PR to `main` (prompt/data paths) |

### Test Suite

| Workflow | What it checks | Trigger |
|----------|---------------|---------|
| **pytest** (in validate-schemas) | Unit tests for schema pipeline, benchmarks, converters, mock harness, factory scripts | push + PR to `main` |

## Hardening Practices

- **Least-privilege permissions** — all workflows declare explicit `permissions` blocks; no workflow requests `write` access unless required (e.g., SARIF upload).
- **Pinned action versions** — actions are pinned to major versions (`@v4`, `@v3`) to balance stability and security updates.
- **No secrets in code** — Gitleaks enforces this on every commit. External dataset ingestion includes PII filtering (`datasets/external/ingest_external_dataset.py`).
- **License compliance** — Dependency Review blocks copyleft licenses; external dataset policy requires MIT/Apache-2.0/CC-BY-4.0 (`datasets/external/README.md`).
- **Schema integrity** — the sync check ensures committed schemas are reproducible from RFC source. Breaking changes require explicit version bumps.

## Local Development

Contributors can run the same checks locally:

```bash
# Python lint
pip install ruff
ruff check .
ruff format --check .

# Shell lint
shellcheck scripts/*.sh tools/*.sh

# Schema validation
pip install -r requirements-tools.txt
python tools/validate.py

# Tests
pytest -q

# Prompt PII scanning (Microsoft Presidio)
pip install presidio-analyzer spacy
python -m spacy download en_core_web_sm
python tools/pii_prompt_scan.py --score-threshold 0.7
```
