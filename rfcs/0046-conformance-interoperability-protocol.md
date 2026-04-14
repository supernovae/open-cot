# RFC 0046 — Conformance & Interoperability Protocol (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026-04-14  
**Target Version:** Process v0.1  
**Discussion:** https://github.com/supernovae/open-cot/issues/46

---

## 1. Summary

This RFC defines how Open CoT implementations prove compatibility claims with executable conformance checks.

It aligns with:

- Profile A: RFC 0001
- Profile B: RFC 0001 + RFC 0002 + RFC 0003
- Profile C: Profile B + RFC 0008 package checks

---

## 2. Required conformance artifacts

Each implementation claiming compatibility must publish:

- fixture inputs and expected outputs
- schema validation report
- round-trip conversion report (if converters are used)
- implementation/version metadata

---

## 3. Test classes

- **schema tests**: all required artifacts validate against declared schemas
- **linkage tests**: sidecar IDs resolve to trace IDs
- **round-trip tests**: conversion in/out preserves required fields
- **profile tests**: profile-specific mandatory checks

---

## 4. Claim semantics

- `profile_a_passed`
- `profile_b_passed`
- `profile_c_passed`

A claim is valid only if all mandatory tests for that profile pass in CI and are reproducible from published fixtures.

---

## 5. Conclusion

RFC 0046 provides an interoperability contract so compatibility claims in the Open CoT ecosystem are tested, not implied.
