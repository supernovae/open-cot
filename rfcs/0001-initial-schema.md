# RFC 0001 — Initial Structured Reasoning Schema (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026-04-14  
**Target Version:** Schema v0.1  
**Discussion:** https://github.com/supernovae/open-cot/issues/1

---

## 1. Summary

This RFC defines the initial Open CoT reasoning trace schema: a model-agnostic JSON structure for recording tasks, reasoning steps, and final answers.

It provides a minimal core for:

- chain-of-thought traces
- tool-augmented reasoning
- verifier sidecars
- benchmark and training datasets
- deterministic replay in agent loops

---

## 2. Design goals

### 2.1 Must-have goals

- Model-agnostic representation.
- Structured, machine-validated fields.
- Extensible step graph representation.
- Compatibility with sidecars defined in RFC 0002 and RFC 0003.

### 2.2 Non-goals

- Defining a specific training recipe.
- Requiring one universal agent runtime.
- Standardizing hidden model internals.

---

## 3. Schema overview

A reasoning trace document includes:

- `version`: schema instance version (`"0.1"` for this RFC)
- `task`: prompt or task description
- `steps[]`: ordered list of typed reasoning steps
- `final_answer`: final model output

Each step may include:

- `id`, `type`, `content`
- `parent` and `children` for graph linkage
- optional evidence and verification metadata

---

## 4. Full schema (JSON)

<!-- opencot:schema:start -->
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "OpenCoT Reasoning Trace v0.1",
  "type": "object",
  "properties": {
    "version": { "type": "string", "enum": ["0.1"] },
    "task": { "type": "string" },
    "steps": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "type": { "type": "string" },
          "content": { "type": "string" },
          "parent": {
            "oneOf": [
              { "type": "string" },
              { "type": "array", "items": { "type": "string" } }
            ]
          },
          "children": { "type": "array", "items": { "type": "string" } },
          "evidence": { "type": "array", "items": { "type": "string" } },
          "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
          "verification_status": {
            "type": "string",
            "enum": ["verified", "failed", "unknown"]
          },
          "verifier_score": { "type": "number" }
        },
        "required": ["id", "type", "content"]
      }
    },
    "final_answer": { "type": "string" }
  },
  "required": ["version", "task", "steps", "final_answer"]
}
```
<!-- opencot:schema:end -->

---

## 5. Example

```json
{
  "version": "0.1",
  "task": "What is 17 * 23?",
  "steps": [
    { "id": "s1", "type": "thought", "content": "Break 23 into 20 + 3." },
    { "id": "s2", "type": "calculation", "content": "17 * 20 = 340", "parent": "s1" },
    { "id": "s3", "type": "calculation", "content": "17 * 3 = 51", "parent": "s1" },
    { "id": "s4", "type": "thought", "content": "340 + 51 = 391", "parent": "s1" }
  ],
  "final_answer": "391"
}
```

---

## 6. Open Questions Resolution (normative closure)

### 6.1 Scope expansion fields

- **Decision:** Keep token timing, model metadata, RL rewards, and multi-agent fields optional and out of the required core object.
- **Rationale:** Preserves broad interoperability and avoids forcing runtime-specific internals.
- **Normative requirement:** Core traces **MUST** validate with only fields in this RFC. Additional fields **MAY** be attached as extensions or linked sidecars.
- **Migration note:** Future versions can promote extensions to first-class fields only with a major compatibility review.

### 6.2 Structural enforcement strictness

- **Decision:** Introduce validation levels (L0/L1/L2) as implementation guidance.
- **Rationale:** Different users need different strictness without fragmenting schema compatibility.
- **Normative requirement:** L0 validators **MUST** enforce JSON Schema validity; L1 validators **SHOULD** check parent/child linkage consistency; L2 validators **MAY** enforce DAG and recursion limits.
- **Migration note:** Tightening L1/L2 checks should ship with explicit migration notes in RFC updates.

### 6.3 Canonical sidecar standards

- **Decision:** Delegate verifier and tool invocation standards to RFC 0002 and RFC 0003.
- **Rationale:** Keeps RFC 0001 minimal and avoids duplicate authority.
- **Normative requirement:** Implementations claiming Profile B compatibility **MUST** support RFC 0002 and RFC 0003 sidecar formats.
- **Migration note:** Any cross-RFC field alignment must be documented in both RFC 0001 and the affected sidecar RFC.

---

## 7. Acceptance criteria

This RFC is accepted when:

- At least 3 maintainers approve it.
- A reference validator passes against the schema.
- At least one example dataset uses this format.
- At least one agent loop implementation emits schema-valid traces.

---

## 8. Conclusion

RFC 0001 defines the stable core trace contract for Open CoT. It prioritizes a minimal required structure with explicit extension points so OSS implementations can interoperate while iterating.
