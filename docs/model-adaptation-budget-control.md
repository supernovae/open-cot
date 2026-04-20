# Model Adaptation for Budget-Constrained Reasoning

This note describes practical guidance for running Open-CoT with strict token budgets, streamed cancellation, and fallback routing.

## Runtime control path (what the harness enforces)

In the reference harness, budget/safety control is enforced at two layers:

1. **Provider-side cap**: each call gets a per-request `max_tokens` cap derived from remaining budget.
2. **Harness-side stream breaker**:
   - preflight prompt estimate gate,
   - mid-stream completion-budget interruption,
   - mid-stream safety interruption (runaway/pattern checks),
   - forced transition to terminal FSM status before any follow-on side effect.

This means budget enforcement is not dependent on model obedience.

## Model behavior profile: what tends to work best

Budget-following quality is usually higher for models with:

- strong instruction adherence in system prompts,
- native tool-call behavior and function-schema compliance,
- stable short-form planning (can compress plans under hard limits),
- lower tendency to emit long reflective preambles.

Budget-following quality is usually worse for models with:

- weak instruction tuning (treats budget as advisory text),
- verbose default style (long chain-style narration before action),
- fragile tool-call formatting under constrained output length.

These are deployment traits, not absolute rules. Evaluate with your own tasks and policies.

## Fine-tuning / adaptation recommendations

If you train or adapt models for this harness, prioritize data and objectives that reward controlled reasoning depth:

1. **Budget-conditioned demonstrations**
   - Include explicit `budget_remaining` context in prompts.
   - Provide successful traces at multiple budgets (tight/medium/high).
2. **Compression preference**
   - Reward concise plans that keep high-value steps and drop redundant rationale.
3. **Tool-first economy**
   - Reward early tool requests when external evidence is required, instead of long speculative reasoning.
4. **Truncation-aware recovery**
   - Include examples where the model says what is missing and asks for retry/escalation when budget is insufficient.
5. **Policy-aware refusal**
   - Include traces that correctly stop/escalate when policy or safety constraints prevent completion.

## Routing when reasoning is incomplete due budget

When a run ends with `budget_exhausted`, use a deterministic policy instead of silent retries:

1. **Narrow retry (same model)**  
   Retry with a smaller objective slice (single sub-problem) and explicit compact-output instruction.
2. **Model escalation (same route family)**  
   Route to a stronger instruction-following model for a bounded rescue pass.
3. **Tool-heavy route**  
   Shift from free-form reasoning to evidence/tool-driven route with minimal synthesis tokens.
4. **Human escalation**  
   If policy-critical or high-risk, require human approval/resolution path.

Each retry should carry forward prior observations and a remaining-budget contract so failures are auditable rather than hidden.

## Suggested evaluation matrix

For each candidate model family, track at least:

- completion-under-budget rate,
- correctness at fixed budget tiers,
- tool-call validity under low output caps,
- rate of `budget_exhausted` recoveries that succeed after one retry,
- safety/fail-safe trigger precision (true positives vs false positives).

Open-CoT experiments under `docs/experiments/` can be used as baseline scaffolding for this matrix.
