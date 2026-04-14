# RFC 0022 — Agent Evaluation Protocol (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.4  
**Discussion:** https://github.com/<your-org>/<your-repo>/issues/22

---

## 1. Summary

This RFC defines the **Agent Evaluation Protocol**, a standardized method for evaluating reasoning agents across:

- correctness  
- efficiency  
- tool use  
- memory use  
- safety  
- multi‑agent coordination  

It integrates:

- RFC 0001–0021  

---

## 2. Evaluation Dimensions

- **Correctness** — verifier‑based  
- **Efficiency** — steps, branches, tool calls  
- **Safety** — sandbox violations  
- **Memory** — usage, conflicts, compression  
- **Tool Use** — correctness, cost, error rate  
- **Multi‑Agent** — coordination quality  

---

## 3. Full Schema (JSON)

    {
      "agent_id": "planner",
      "metrics": {
        "correctness": 0.92,
        "efficiency": { "steps": 42 },
        "safety": { "violations": 0 },
        "tool_use": { "errors": 1 },
        "memory": { "conflicts": 0 }
      }
    }

---

## 4. Example

    {
      "agent_id": "coder",
      "metrics": {
        "correctness": 0.88
      }
    }

---

## 5. Conclusion

This RFC defines a unified evaluation protocol for reasoning agents.
