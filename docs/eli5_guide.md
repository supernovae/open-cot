# Open CoT ELI5 Guide

This guide explains Open CoT in plain language and gives you things to try.

If you are not an LLM expert, this is for you.

---

## 1) What is this project?

Every AI agent framework today handles permissions, safety, and logging differently. If you switch models or tools, you start from scratch. There is no shared playbook.

**Open CoT** is that shared playbook. It gives you:

- a **standard way** for models to say what they want to do
- a **harness** that checks whether they are allowed
- **typed receipts** that prove what actually happened
- and it works the same whether you use GPT, Claude, Llama, Qwen, or anything else

Think of it like HTTP for agent behavior. HTTP does not care what web server you run -- it defines the contract. Open CoT does not care what model you run -- it defines the control contract.

---

## 2) The big idea in one sentence

> Models **propose** actions. The harness **decides** what is allowed. Receipts **prove** what happened.

That is the whole thing. The model never gets to authorize itself. It asks. The harness evaluates the ask against policies. If approved, the tool runs. Everything is logged.

---

## 3) Why should I care?

If you are building with AI agents, you have probably run into:

- **"How do I stop my agent from doing something dangerous?"**
  Open CoT makes the model ask permission before every tool call. No permission, no execution.

- **"How do I know what my agent actually did?"**
  Every tool call produces a tamper-evident receipt. At the end, the whole run is sealed in an audit envelope with integrity hashes.

- **"I switched from one model to another and everything broke."**
  The control plane is model-agnostic. Same schemas, same harness, same audit trail -- different model.

- **"My compliance team wants proof of what the AI did."**
  The audit envelope is a single JSON object that says: here is who ran, what they asked for, what was granted, what tools executed, and a hash proving none of it was tampered with.

---

## 4) The harness: what it is and how to think about it

The harness is the **runtime** that sits between the model and the real world. It is a TypeScript implementation of the governed execution model defined in the RFCs.

Here is the flow:

```
You give the agent a task
  -> receive: harness logs the task
  -> frame: model interprets what needs doing
  -> plan: model proposes actions (maybe tool calls)
  -> request_authority: model asks "can I use this tool?"
  -> validate_authority: policy engine checks the rules
  -> delegate_narrow: auth broker says "yes, but only these fields"
  -> execute_tool: tool runs with the granted permission
  -> observe_result: model sees what came back
  -> critique_verify: model checks if the result makes sense
  -> finalize: model writes the final answer
  -> audit_seal: harness seals the whole run with a hash
```

The model never skips the permission step. If a tool is not in the policy, it does not run.

For simple use cases (like a chatbot doing a pre-approved search), the harness has a shortcut: `plan -> execute_tool` skips the delegation ceremony for tools that are already on the allowlist.

---

## 5) Try it yourself (5 minutes, no GPU, no API key)

Everything below uses a mock backend -- no real LLM needed.

### Install

```bash
cd harness
npm install
```

### Run the chat agent

```bash
npx tsx examples/chat-demo.ts
```

This runs a simple agent loop: receive, frame, plan, execute a search tool, observe, finalize. Look at the output -- you will see the step-by-step trace and a validation check at the end.

### Run the coder agent

```bash
npx tsx examples/coder-demo.ts
```

This one is more complex. It reads a file, makes changes, writes the file, runs tests, and verifies. Watch the FSM transitions in the output -- you will see it loop through plan/execute/observe/critique.

### Run the governed agent (the new stuff)

This is the flagship demo. It shows the full permission-aware flow.

**Allow mode** -- the agent asks to use the search tool, and the policy says yes:

```bash
npx tsx examples/governed-demo.ts
```

Look at the output. You will see:
- `request_authority` -- the agent formally requesting search access
- `validate_authority` -- the policy evaluating the request
- `delegate_narrow` -- authority granted
- A governance summary showing 1 request, 1 approval
- An audit envelope with integrity hashes

**Deny mode** -- same agent, but now the policy blocks search:

```bash
npx tsx examples/governed-demo.ts --deny "search for open source"
```

Watch what happens: the flow goes `plan -> request_authority -> validate_authority -> deny -> audit_seal`. The tool never runs. The audit envelope records the denial with the reason.

**Try your own questions:**

```bash
npx tsx examples/governed-demo.ts "calculate 2+2"
npx tsx examples/governed-demo.ts "search for the speed of light"
npx tsx examples/governed-demo.ts --deny "search for anything"
```

### See the full trace or envelope

Add `--trace` to dump the reasoning trace as JSON, or `--envelope` to see the complete audit envelope:

```bash
npx tsx examples/governed-demo.ts --envelope
npx tsx examples/governed-demo.ts --trace
```

---

## 6) Run the tests

```bash
cd harness
npm test
```

You should see 78 tests pass across 8 test files. The governance tests cover:

- Permission grants, consumption, expiry, and revocation
- Policy evaluation: allow, deny, narrow, fail-closed defaults
- Authority receipts with integrity hashing
- Audit event chaining and envelope sealing
- End-to-end governed agent runs

---

## 7) Experiment: write your own policy

Policies are just JSON objects. Here is the simplest possible policy that blocks a tool:

```json
{
  "policy_id": "my-policy",
  "policy_type": "safety",
  "rules": [
    {
      "rule_id": "block-writes",
      "action": "deny",
      "resource": "tool:writeFile",
      "reason": "File writes are not allowed in this environment"
    }
  ],
  "priority": 1
}
```

You can also **narrow** instead of deny. This policy lets the agent read email, but only headers:

```json
{
  "policy_id": "email-compliance",
  "policy_type": "compliance",
  "rules": [
    {
      "rule_id": "headers-only",
      "action": "narrow",
      "resource": "tool:email",
      "narrowing": {
        "allowed_fields": ["subject", "from", "date"],
        "excluded_fields": ["body", "attachments"]
      },
      "reason": "Email body access restricted for compliance"
    }
  ],
  "priority": 10
}
```

And you can require human approval:

```json
{
  "policy_id": "db-safety",
  "policy_type": "safety",
  "rules": [
    {
      "rule_id": "approve-db-writes",
      "action": "require_approval",
      "resource": "tool:database",
      "escalation_target": "ops-team-lead",
      "reason": "Database writes require human approval"
    }
  ],
  "priority": 1
}
```

The policy engine evaluates rules in priority order. Deny always wins. If nothing matches, the default is deny (fail-closed).

---

## 8) Experiment: look at the example fixtures

Check out the governance example files in `examples/`:

```bash
cat examples/delegation/example1.json      # request -> decision -> receipt
cat examples/permission_grant/example1.json # a permission with TTL and scope
cat examples/audit_envelope/example1.json   # a sealed run summary
```

These are real instances of the schemas. Compare them to the RFCs:
- `rfcs/0047-delegation-extension.md` -- the delegation flow
- `rfcs/0042-permission-acl.md` -- permission objects
- `rfcs/0043-auditing-compliance-logs.md` -- audit events and envelopes

---

## 9) How this simplifies working with different models

Today, if you use Claude for coding and GPT for analysis and Llama for search, each one has different tool-calling conventions, different safety behaviors, and different output formats. You end up writing glue code for each one.

With Open CoT, the contract is the same regardless of which model sits behind it:

1. **Any model** that can produce structured output can participate. The harness does not care if it came from Claude, GPT, Llama, Qwen, Mistral, or a local fine-tune.

2. **Same policies** apply to every model. You write your safety rules once. They apply whether the backend is a $200/month API or a 7B model running on your laptop.

3. **Same audit trail** for every run. Your compliance team does not need a different integration per vendor.

4. **Model adapters** are thin. The mock backend in this repo is 90 lines. A real OpenAI adapter is about the same. The adapter just translates model-specific output into the Open CoT schema -- the harness handles everything else.

This means you can swap models freely without rewriting your safety, permission, or audit logic. The control plane stays stable.

---

## 10) Real-world scenarios this handles

**"Read email headers but not bodies"**
Policy narrows email access to subject/from/date only. The tool gets a permission with `allowed_fields: ["subject", "from", "date"]`. Even if the model asks for the body, it will not get it.

**"The agent tried to access a file it should not have"**
The delegation request gets evaluated against policy. No matching allow rule = deny. The denial is recorded in the audit envelope. The file is never touched.

**"We need proof the agent only did what it was supposed to"**
The audit envelope contains: every delegation request, every decision, every tool execution receipt with input/output hashes, and an integrity hash over the whole thing. If any event was modified after the fact, the hash chain breaks.

**"A tool call succeeded but returned suspicious output"**
The postcondition check on the execution receipt catches it. Status is set to "quarantined" and the result is not returned to the model. The fail_safe state takes over.

---

## 11) Repo map (what each part is for)

| Folder | What is in it |
|--------|---------------|
| `rfcs/` | 48 design specs. The normative standard. Start with 0007 (the FSM), 0041 (policy), 0042 (permissions), 0047 (delegation). |
| `schemas/` | JSON Schemas generated from the RFCs. Machine-readable versions of the specs. |
| `harness/` | TypeScript reference implementation. The actual running code. |
| `harness/src/governance/` | Permission manager, policy evaluator, auth broker, audit engine. |
| `harness/src/agents/` | Three agent implementations: chat, coder, governed. |
| `harness/examples/` | Runnable demos you can try right now. |
| `examples/` | JSON fixture files showing what the data looks like. |
| `tools/` | Python scripts for validation and schema sync. |
| `docs/` | Architecture overview, philosophy, this guide. |

---

## 12) Key scripts you should know

| Script | What it does |
|--------|--------------|
| `npx tsx examples/chat-demo.ts` | Run the chat agent (simple mode) |
| `npx tsx examples/coder-demo.ts` | Run the coder agent (plan/execute/repair loop) |
| `npx tsx examples/governed-demo.ts` | Run the governed agent (full delegation flow) |
| `npm test` (in harness/) | Run all 78 tests |
| `python tools/validate.py` | Validate schemas and examples |
| `python tools/sync_schemas_from_rfcs.py` | Regenerate JSON Schemas from RFC markdown |

---

## 13) Suggested learning path (30-60 minutes)

1. Read this guide.
2. Run `cd harness && npm install && npm test` -- make sure everything passes.
3. Run `npx tsx examples/governed-demo.ts` -- watch the full flow.
4. Run it again with `--deny` -- see the policy block the tool.
5. Run it with `--envelope` -- look at the audit envelope JSON.
6. Open `rfcs/0007-agent-loop-protocol.md` -- read about the FSM states.
7. Open `rfcs/0047-delegation-extension.md` -- see how delegation works.
8. Look at `examples/delegation/example1.json` -- see the data.
9. Look at `harness/src/governance/policy-evaluator.ts` -- see how policy rules are evaluated.
10. Try writing a policy rule that narrows or blocks a different tool.

By this point you will understand the "what," the "why," and the "how."

---

## 14) Frequently asked questions

### "Do I need a GPU or an API key?"
No. Everything works with the mock backend out of the box.

### "Can I use this with Ollama or a local model?"
Yes. Set `OPENAI_BASE_URL=http://localhost:11434/v1` and the demos use your local model instead of the mock.

### "What if I break something?"
That is fine. The harness is designed to fail early with clear errors. Run `npm test` to check if things still work.

### "Is this only for TypeScript?"
The TypeScript harness is the reference implementation. The schemas are JSON Schema (language-agnostic). You could implement the same FSM and governance in Python, Go, Rust, or anything else.

### "What is the difference between the chat agent and the governed agent?"
The chat agent uses the pre-authorized shortcut -- it skips the delegation ceremony for tools on the allowlist. The governed agent goes through the full flow: request, evaluate, narrow, grant, execute, receipt.

### "Why does the default policy deny everything?"
Fail-closed. If you forget to write a policy rule, the agent cannot do anything. That is safer than the alternative.

---

## 15) Bottom line

Open CoT gives agents a standard way to ask for permission and gives you a standard way to say yes, no, or "yes but only this much."

It works the same across models, produces tamper-evident audit trails, and fails safely when something is wrong.

You do not need to be an expert to start. You need:

- a terminal
- `npm install` in the harness folder
- and 5 minutes to run the demos
