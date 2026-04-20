# Starter OPA Policy Package

This folder contains a minimal OPA/Rego package you can use with the governed demo.

## Start OPA with the starter policies

```bash
cd harness
opa run --server examples/opa/policies
```

The starter package exposes decision data at `open_cot/delegation`.

## Run governed demo against OPA

```bash
cd harness
POLICY_ENGINE=opa \
OPA_BASE_URL=http://127.0.0.1:8181 \
OPA_POLICY_PATH=open_cot/delegation \
npx tsx examples/governed-demo.ts
```

## Try policy modes

The governed demo sends `input.context.policy_mode` to OPA:

- default: `"allow"`
- `--deny`: `"deny"` (deny search)
- `--narrow`: `"narrow"` (narrow search scope)

Examples:

```bash
# deny search requests
POLICY_ENGINE=opa OPA_BASE_URL=http://127.0.0.1:8181 \
  npx tsx examples/governed-demo.ts --deny "search for open source"

# narrow search requests
POLICY_ENGINE=opa OPA_BASE_URL=http://127.0.0.1:8181 \
  npx tsx examples/governed-demo.ts --narrow "search for open source"
```

## Response contract expected by harness

OPA `result` should return an object like:

```json
{
  "status": "approved | denied | narrowed | escalated",
  "policy_refs": ["policy.id"],
  "narrowed_scope": {
    "resource": "tool:search",
    "action": "execute",
    "constraints": { "max_results": 5 }
  },
  "denial_reason": "optional reason",
  "escalation_target": "optional target",
  "decided_by": { "kind": "policy", "policy_id": "policy.id" }
}
```

The harness uses this same decision shape for:

- tool authorization requests (`resource: "tool:<name>"`)
- manifest reconciliation previews (`resource: "tool:<name>"`, preview context)
- phase consultation hooks (`resource: "phase:<phase>"`)

The starter policy allows `phase:*` by default so runtime consultation does not block the run unless you explicitly add phase-deny rules.

Conformance fixtures for this mapping live at:

- `tests/fixtures/opa-decision-conformance.json`
- `tests/policy-engine-conformance.test.ts`

## Optional live OPA integration test

Use the dedicated script:

```bash
cd harness
npm run test:opa-live
```

Override defaults if needed:

```bash
cd harness
OPA_BASE_URL=http://127.0.0.1:8181 \
OPA_POLICY_PATH=open_cot/delegation \
OPA_LIVE_POLICY_MODE=allow \
npm run test:opa-live
```

The live test checks end-to-end request/response integration and decision-shape mapping
against a real OPA server.
