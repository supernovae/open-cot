# RFC 0016 — Tool Capability Negotiation (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.4  
**Discussion:** https://github.com/supernovae/open-cot/issues/16

---

## 1. Summary

This RFC defines the **Tool Capability Negotiation Standard**, enabling agents to:

- discover tool capabilities  
- negotiate tool parameters  
- validate tool compatibility  
- adapt reasoning based on tool constraints  

It extends:

- RFC 0003 — Tool Invocation Schema  
- RFC 0007 — Agent Loop Protocol  

---

## 2. Motivation

Tools vary in:

- input formats  
- output formats  
- rate limits  
- supported operations  
- authentication requirements  
- cost models  

Agents must negotiate capabilities before invoking tools.

This RFC defines a **structured negotiation protocol**.

---

## 3. Capability Types

- `input_schema`  
- `output_schema`  
- `supported_operations`  
- `cost_per_call`  
- `max_batch_size`  
- `authentication_required`  
- `version`  

---

## 4. Full Schema (JSON)

    {
      "tool_name": "string",
      "agent_id": "string",
      "requested_capabilities": ["input_schema", "supported_operations"],
      "tool_response": {
        "input_schema": {},
        "supported_operations": ["search", "lookup"],
        "version": "1.2.0"
      },
      "negotiation_status": "success"
    }

---

## 5. Example

    {
      "tool_name": "weather_api",
      "requested_capabilities": ["input_schema"],
      "tool_response": {
        "input_schema": {
          "city": "string",
          "state": "string"
        }
      }
    }

---

## 6. Conclusion

This RFC defines a unified negotiation protocol for tool capabilities, enabling robust tool‑augmented reasoning.
