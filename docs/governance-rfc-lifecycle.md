# RFC Lifecycle Governance

Open CoT now keeps only active core RFCs in `rfcs/`.

## States

- `draft`: active proposal in the compact core.
- `stable`: accepted core contract with generated schema and examples.
- `archived`: removed from the active tree and retained only in Git history.

## Reset Rule

The core reset is intentionally breaking. Removed RFCs are not compatibility targets, and missing RFC numbers should not remain in the active set. Renumbering is allowed when the active core is reset.

## Schema Rule

Normative schemas MUST be embedded in RFC markdown between `opencot:schema` markers. Generated files in `schemas/` are derived artifacts.
