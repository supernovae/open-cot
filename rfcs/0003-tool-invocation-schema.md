# RFC 0003 — Tool Invocation Schema (v0.1)
**Status:** Draft  
**Author:** Byron / Open CoT Community  
**Created:** 2026‑04‑14  
**Target Version:** Schema v0.1  
**Discussion:** https://github.com/<your-org>/<your-repo>/issues/3

---

## 1. Summary

This RFC proposes the **Tool Invocation Schema**, a structured, model‑agnostic format for representing tool calls within reasoning traces.  
It extends RFC 0001 (Reasoning Schema) by defining how LLMs should express:

- tool selection  
- tool arguments  
- tool execution  
- tool outputs  
- error handling  
- integration with reasoning steps  

This schema is compatible with:

- **ReAct** (Thought → Action → Observation)  
- **OpenAI function calling**  
- **JSON‑based tool APIs**  
- **LangChain / LangGraph tool nodes**  
- **agentic coding frameworks**  
- **R1‑style RL training with tool feedback**  

---

## 2. Motivation

Tool use is now a core part of modern LLM reasoning:

- ReAct introduced interleaved reasoning + actions.  
- Agent frameworks rely on structured tool calls.  
- Coding agents require deterministic tool invocation formats.  
- RL‑trained reasoning models use tool feedback as reward signals.  
- Multi‑step planning requires consistent action/observation structure.

However:

- Every framework uses a different tool schema.  
- Tool calls are often embedded in unstructured text.  
- Observations are inconsistently formatted.  
- Error handling is ad‑hoc.  
- No open standard exists for tool invocation within reasoning traces.

This RFC defines a **unified, interoperable, verifiable** schema for tool use.

---

## 3. Design Goals

### 3.1 Must‑Have Goals
- **Compatible with RFC 0001** (step IDs, structure).  
- **Supports ReAct** (thought → action → observation).  
- **Supports JSON‑based tool APIs**.  
- **Supports deterministic parsing**.  
- **Supports error reporting**.  
- **Supports multi‑tool workflows**.  
- **Extensible** for future agent frameworks.

### 3.2 Non‑Goals
- Defining tool semantics.  
- Defining a universal tool registry.  
- Enforcing a specific agent loop.  
- Encoding proprietary tool metadata.

---

## 4. Tool Invocation Model

A tool invocation consists of:

1. **Action Step**  
   - specifies the tool  
   - includes arguments  
   - references the reasoning step that triggered it  

2. **Observation Step**  
   - contains the tool output  
   - may include structured or unstructured results  
   - may include error information  

This mirrors ReAct and modern agent frameworks.

---

## 5. Full Schema (JSON)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "OpenCoT Tool Invocation v0.1",
  "type": "object",

  "properties": {
    "tool_name": {
      "type": "string",
      "description": "Name of the tool being invoked."
    },

    "arguments": {
      "type": "object",
      "description": "JSON arguments passed to the tool."
    },

    "result": {
      "type": "object",
      "description": "Structured output returned by the tool.",
      "properties": {
        "output": {
          "description": "Primary tool output (string or structured)."
        },
        "error": {
          "type": "string",
          "description": "Optional error message if the tool failed."
        },
        "metadata": {
          "type": "object",
          "description": "Optional tool-specific metadata."
        }
      }
    },

    "triggered_by_step": {
      "type": "string",
      "description": "ID of the reasoning step that triggered this tool call."
    },

    "observation_step": {
      "type": "string",
      "description": "ID of the observation step that records the tool output."
    }
  },

  "required": ["tool_name", "arguments", "triggered_by_step"]
}


## 6.  Integration with RFC 0001 (Reasoning Schema)

Tool invocations appear as steps of type:

* "action" — tool call

* "observation" — tool output

Example:

```json
{
  "id": "s3",
  "type": "action",
  "content": "call:search",
  "tool_invocation": {
    "tool_name": "search",
    "arguments": { "query": "population of Tokyo" },
    "triggered_by_step": "s2"
  }
}


And the observation:

```json
{
  "id": "s4",
  "type": "observation",
  "content": "Tokyo population is 13.96 million.",
  "parent": "s3"
}


## 7. Example: ReAct-Style Tool Use

```json

{
  "version": "0.1",
  "task": "Find the current weather in Austin, TX.",
  "steps": [
    {
      "id": "s1",
      "type": "thought",
      "content": "I should call the weather API."
    },
    {
      "id": "s2",
      "type": "action",
      "content": "call:weather_api",
      "tool_invocation": {
        "tool_name": "weather_api",
        "arguments": { "city": "Austin", "state": "TX" },
        "triggered_by_step": "s1"
      }
    },
    {
      "id": "s3",
      "type": "observation",
      "content": "{\"temp\": 72, \"conditions\": \"Clear\"}",
      "parent": "s2"
    },
    {
      "id": "s4",
      "type": "thought",
      "content": "The weather is clear and 72 degrees."
    }
  ],
  "final_answer": "Clear skies, 72°F."
}

## 8. Error Handling

```json

"result": {
  "error": "Timeout contacting weather API."
}


Observation steps should reflect the failure:

```json

{
  "id": "s3",
  "type": "observation",
  "content": "ERROR: Timeout contacting weather API.",
  "parent": "s2"
}

##9. Open Questions
###9.1 Should we support:
streaming tool outputs?

multi‑tool parallel execution?

tool cancellation events?

tool versioning?

### 9.2 Should we define:
a canonical set of tool types?

a standard for tool metadata?

a standard for tool error taxonomies?

### 9.3 Should tool invocations be:
embedded inside steps (current design)?

stored separately and referenced by ID?

## 10. Acceptance Criteria

This RFC will be accepted when:

At least 3 maintainers approve it.
A reference implementation can parse and validate tool invocations.
At least one agent loop emits this schema.
At least one dataset includes tool‑augmented reasoning traces.