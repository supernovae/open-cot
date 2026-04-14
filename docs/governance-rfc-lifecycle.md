# RFC Lifecycle Governance

Open CoT uses this lifecycle for RFCs:

1. `draft`
2. `implementation_required`
3. `stable`
4. `superseded` or `archived`

## Label semantics

- **draft**: idea/proposal stage; may not have complete schema coverage.
- **implementation_required**: accepted direction, must ship schema artifacts + examples + consumer path.
- **stable**: production-ready contract for the targeted tier.
- **superseded**: replaced by newer RFC; include replacement links.
- **archived**: inactive and not promoted.

## Promotion expectations

- Tier A promotion to `stable` requires:
  - deterministic sync output,
  - conformance profile coverage,
  - migration notes for major schema changes.

## Deprecation notes

When superseding an RFC, document:

- replacement RFC id(s),
- compatibility impact,
- migration path and timeline.
