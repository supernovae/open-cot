# RFC 0025 — Tool Marketplace Registry Format (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.5  
**Discussion:** https://github.com/supernovae/open-cot/issues/25

---

## 1. Summary

This RFC defines a **registry format** for publishing, discovering, and versioning tools in a decentralized marketplace.

It extends:

- RFC 0003 — Tool Invocation Schema  
- RFC 0016 — Tool Capability Negotiation  

---

## 2. Registry Fields

- tool metadata  
- version  
- capabilities  
- authentication requirements  
- cost model  
- rate limits  
- schema references  

---

## 3. Full Schema (JSON)

```json
{
  "tool_name": "weather_api",
  "version": "1.2.0",
  "description": "Provides weather forecasts.",
  "capabilities": ["forecast", "current_conditions"],
  "auth": "api_key",
  "cost": { "per_call": 0.001 }
}
```

---

## 4. Example

```json
{
  "tool_name": "calculator",
  "version": "1.0.0"
}
```

---

## 5. Conclusion

This RFC defines a standardized registry format for tool ecosystems.
