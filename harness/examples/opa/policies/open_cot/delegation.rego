package open_cot.delegation

import rego.v1

policy_mode := object.get(object.get(input, "context", {}), "policy_mode", "allow")
requested_scope := input.request.requested_scope
is_search_request if requested_scope.resource == "tool:search"

default_result := {
  "status": "denied",
  "policy_refs": ["starter.default_deny"],
  "denial_reason": "No matching rule in starter OPA policy",
  "decided_by": {
    "kind": "policy",
    "policy_id": "starter.default_deny",
  },
}

allow_result := {
  "status": "approved",
  "policy_refs": ["starter.allow_all_tools"],
  "decided_by": {
    "kind": "policy",
    "policy_id": "starter.allow_all_tools",
  },
}

allow_phase_result := {
  "status": "approved",
  "policy_refs": ["starter.allow_phase_hooks"],
  "decided_by": {
    "kind": "policy",
    "policy_id": "starter.allow_phase_hooks",
  },
}

deny_result := {
  "status": "denied",
  "policy_refs": ["starter.deny_search"],
  "denial_reason": "Search access is restricted by starter OPA policy",
  "decided_by": {
    "kind": "policy",
    "policy_id": "starter.deny_search",
  },
}

narrow_result := {
  "status": "narrowed",
  "policy_refs": ["starter.narrow_search"],
  "narrowed_scope": {
    "resource": requested_scope.resource,
    "action": requested_scope.action,
    "constraints": object.union(
      object.get(requested_scope, "constraints", {}),
      {
        "max_results": 5,
        "excluded_fields": ["raw_html", "cached_page"],
      },
    ),
  },
  "decided_by": {
    "kind": "policy",
    "policy_id": "starter.narrow_search",
  },
}

result := deny_result if {
  policy_mode == "deny"
  is_search_request
}
else := narrow_result if {
  policy_mode == "narrow"
  is_search_request
}
else := allow_result if {
  startswith(requested_scope.resource, "tool:")
}
else := allow_phase_result if {
  startswith(requested_scope.resource, "phase:")
}
else := default_result
