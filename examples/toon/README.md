# TOON Format Examples

Side-by-side comparisons of JSON and TOON (Token-Oriented Object Notation) for
Open CoT schemas. See [RFC 0050](../../rfcs/0050-toon-adapter.md) for the
specification and [docs/experiments/toon_format_efficiency.md](../../docs/experiments/toon_format_efficiency.md)
for the experiment card.

## Files

| JSON | TOON | Schema |
|------|------|--------|
| `capability-manifest.json` | `capability-manifest.toon` | RFC 0049 capability manifest |
| `reasoning-trace.json` | `reasoning-trace.toon` | RFC 0001 reasoning trace |

## Token count comparison (approximate, cl100k_base)

| Fixture | JSON (pretty) | JSON (minified) | TOON | Reduction vs minified |
|---------|---------------|-----------------|------|-----------------------|
| Capability manifest (3 tools) | ~180 tokens | ~130 tokens | ~80 tokens | ~38% |
| Reasoning trace (5 steps) | ~200 tokens | ~155 tokens | ~95 tokens | ~39% |

These are rough estimates. Run the benchmark script for precise counts with your
tokenizer of choice.

## How TOON works

**JSON (repeated keys, braces, quotes):**
```json
[
  { "id": 1, "type": "thought", "content": "I need to check perms.", "confidence": 0.98 },
  { "id": 2, "type": "action", "content": "Checking db_access scope.", "confidence": 1.0 }
]
```

**TOON (header + tabular rows):**
```
steps[2]{id, type, content, confidence}:
1 | thought | I need to check perms. | 0.98
2 | action | Checking db_access scope. | 1.0
```

The header `steps[2]{id, type, content, confidence}:` declares the array name,
length, and field order once. Each row is pipe-delimited. No repeated keys, no
braces, no quotes on simple values.
