# Benchmark Scoring (0.1 slice)

`scorer.py` provides starter metrics:

- `final_answer_exact`
- `step_validity_proxy`
- `schema_valid`

Example:

```bash
python3 benchmarks/scoring/scorer.py --trace examples/reasoning/example1.json --expected 391
```

This is intentionally minimal for 0.1 and should be expanded with stronger step-level correctness checks over time.
