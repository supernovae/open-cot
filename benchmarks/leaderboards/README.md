# Leaderboard Run Card Template (0.1)

Use this template when submitting benchmark runs.

## Required fields

- Model name and version
- Checkpoint hash or API model id
- Prompting method
- Decoding settings (temperature, top_p, max_tokens)
- Random seed(s)
- Dataset/benchmark version
- Scores from `benchmarks/scoring/scorer.py`

## Anti-gaming policy

- No test split prompt leakage in training/fine-tuning data.
- No manual editing of model outputs before scoring.
- Keep run scripts and configs reproducible.
- Disclose tool use and post-processing steps.
- Submit the raw outputs file with task IDs.
