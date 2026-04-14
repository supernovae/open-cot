# RFC 0023 — Human‑in‑the‑Loop Feedback Schema (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.5  
**Discussion:** https://github.com/<your-org>/<your-repo>/issues/23

---

## 1. Summary

This RFC defines a **Human‑in‑the‑Loop (HITL) Feedback Schema**, enabling structured human feedback for:

- preference modeling  
- correction  
- ranking  
- critique  
- approval / rejection  
- RLHF / RLAIF pipelines  

It integrates with:

- RFC 0005 — RL Reward Trace Schema  
- RFC 0022 — Agent Evaluation Protocol  

---

## 2. Feedback Types

- **binary** — approve / reject  
- **scalar** — numeric rating  
- **ranking** — order multiple outputs  
- **edit** — human‑provided correction  
- **critique** — natural‑language feedback  
- **reward** — explicit reward signal  

---

## 3. Full Schema (JSON)

    {
      "trace_id": "string",
      "feedback_id": "string",
      "human_id": "string",
      "feedback_type": "ranking",
      "content": {
        "ranking": ["output_a", "output_b", "output_c"]
      },
      "timestamp": "string",
      "metadata": {}
    }

---

## 4. Example

    {
      "feedback_type": "binary",
      "content": { "approved": true }
    }

---

## 5. Conclusion

This RFC defines a unified schema for human feedback across training and evaluation.
