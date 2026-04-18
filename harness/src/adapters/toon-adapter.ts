/**
 * TOON Adapter — RFC 0050.
 *
 * Bidirectional translation between JSON objects and Token-Oriented Object
 * Notation (TOON).  JSON Schema remains the normative contract; TOON is a
 * compact serialization for model-facing context injection.
 *
 * Design constraint: toToon → fromToon must round-trip through Ajv validation
 * against the original JSON Schema without loss.
 */

// ---------- public types ----------

export interface ToonOptions {
  includeHeaders?: boolean;
  delimiter?: string;
  indent?: number;
}

export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  enum?: unknown[];
  additionalProperties?: boolean | JsonSchema;
  description?: string;
  [key: string]: unknown;
}

const DEFAULT_OPTIONS: Required<ToonOptions> = {
  includeHeaders: true,
  delimiter: "|",
  indent: 2,
};

// ---------- toToon ----------

export function toToon(
  obj: unknown,
  schema?: JsonSchema,
  options?: ToonOptions,
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  return serializeValue(obj, schema, opts, 0, undefined);
}

function serializeValue(
  value: unknown,
  schema: JsonSchema | undefined,
  opts: Required<ToonOptions>,
  depth: number,
  key: string | undefined,
): string {
  if (value === null || value === undefined) return "null";

  if (Array.isArray(value)) {
    return serializeArray(value, schema, opts, depth, key);
  }

  if (typeof value === "object") {
    return serializeObject(
      value as Record<string, unknown>,
      schema,
      opts,
      depth,
    );
  }

  return formatScalar(value);
}

function serializeObject(
  obj: Record<string, unknown>,
  schema: JsonSchema | undefined,
  opts: Required<ToonOptions>,
  depth: number,
): string {
  const keys = orderedKeys(obj, schema);
  const lines: string[] = [];
  const indent = " ".repeat(opts.indent * depth);

  for (const k of keys) {
    const v = obj[k];
    const propSchema = schema?.properties?.[k];

    if (v === null || v === undefined) continue;

    if (Array.isArray(v)) {
      if (v.length === 0) {
        lines.push(`${indent}${k}: []`);
        continue;
      }
      const arrStr = serializeArray(v, propSchema, opts, depth, k);
      if (arrStr.trimStart().startsWith(k)) {
        lines.push(arrStr);
      } else if (arrStr.startsWith("[")) {
        lines.push(`${indent}${k}${arrStr}`);
      } else {
        lines.push(`${indent}${k}: ${arrStr}`);
      }
    } else if (typeof v === "object") {
      const nested = serializeObject(
        v as Record<string, unknown>,
        propSchema,
        opts,
        depth + 1,
      );
      lines.push(`${indent}${k}:\n${nested}`);
    } else {
      lines.push(`${indent}${k}: ${formatScalar(v)}`);
    }
  }

  return lines.join("\n");
}

function serializeArray(
  arr: unknown[],
  schema: JsonSchema | undefined,
  opts: Required<ToonOptions>,
  depth: number,
  name?: string,
): string {
  if (arr.length === 0) return "[]";

  const itemSchema = schema?.items;
  const indent = " ".repeat(opts.indent * depth);
  const d = ` ${opts.delimiter} `;

  if (isScalarArray(arr)) {
    const values = arr.map((v) => formatScalar(v)).join(", ");
    if (name && opts.includeHeaders) {
      return `[${arr.length}]: ${values}`;
    }
    return values;
  }

  if (isUniformObjectArray(arr)) {
    const fieldNames = uniformFieldNames(arr, itemSchema);
    const lines: string[] = [];
    const label = name ?? "items";

    if (opts.includeHeaders) {
      lines.push(`${indent}${label}[${arr.length}]{${fieldNames.join(", ")}}:`);
    }

    for (const item of arr as Record<string, unknown>[]) {
      const cells = fieldNames.map((f) => {
        const v = item[f];
        return formatScalar(v);
      });
      lines.push(`${indent}${cells.join(d)}`);
    }

    return lines.join("\n");
  }

  const lines: string[] = [];
  for (const item of arr) {
    lines.push(
      serializeValue(item, itemSchema, opts, depth + 1, undefined),
    );
  }
  return lines.join("\n");
}

function isScalarArray(arr: unknown[]): boolean {
  return arr.every(
    (v) => typeof v !== "object" || v === null,
  );
}

function isUniformObjectArray(arr: unknown[]): boolean {
  if (arr.length === 0) return false;
  if (!arr.every((v) => typeof v === "object" && v !== null && !Array.isArray(v))) {
    return false;
  }
  const keys0 = Object.keys(arr[0] as object).sort().join(",");
  return arr.every(
    (v) => Object.keys(v as object).sort().join(",") === keys0,
  );
}

function uniformFieldNames(
  arr: unknown[],
  itemSchema?: JsonSchema,
): string[] {
  if (itemSchema?.required && itemSchema.required.length > 0) {
    const extra = Object.keys(arr[0] as object).filter(
      (k) => !itemSchema.required!.includes(k),
    );
    return [...itemSchema.required, ...extra];
  }
  if (itemSchema?.properties) {
    const schemaKeys = Object.keys(itemSchema.properties);
    const objKeys = Object.keys(arr[0] as object);
    const extra = objKeys.filter((k) => !schemaKeys.includes(k));
    return [...schemaKeys.filter((k) => objKeys.includes(k)), ...extra];
  }
  return Object.keys(arr[0] as object);
}

function formatScalar(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") {
    if (value.includes("|") || value.includes("\n") || /^\s|\s$/.test(value)) {
      return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
    }
    return value;
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  return String(value);
}

// ---------- fromToon ----------

export function fromToon(
  toon: string,
  schema?: JsonSchema,
): unknown {
  const lines = toon.split("\n");
  const ctx: ParseContext = { lines, pos: 0, schema };
  return parseRoot(ctx);
}

interface ParseContext {
  lines: string[];
  pos: number;
  schema?: JsonSchema;
}

function parseRoot(ctx: ParseContext): unknown {
  skipEmpty(ctx);
  if (ctx.pos >= ctx.lines.length) return {};
  return parseObjectBlock(ctx, 0);
}

function parseObjectBlock(
  ctx: ParseContext,
  baseIndent: number,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  while (ctx.pos < ctx.lines.length) {
    const raw = ctx.lines[ctx.pos]!;
    if (raw.trim() === "") { ctx.pos++; continue; }

    const lineIndent = raw.length - raw.trimStart().length;
    if (lineIndent < baseIndent) break;

    const trimmed = raw.trim();

    if (trimmed.startsWith("[/")) break;
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      ctx.pos++;
      continue;
    }

    const arrMatch = trimmed.match(/^(\w+)\[(\d+|N)\]\{([^}]+)\}:\s*$/);
    if (arrMatch) {
      const arrName = arrMatch[1]!;
      const fields = arrMatch[3]!.split(",").map((f) => f.trim());
      ctx.pos++;
      const items = parseTabularRows(ctx, fields, lineIndent);
      const propSchema = ctx.schema?.properties?.[arrName]?.items;
      result[arrName] = coerceArrayTypes(items, propSchema);
      continue;
    }

    const scalarArrMatch = trimmed.match(/^(\w+)\[(\d+)\]:(.+)$/);
    if (scalarArrMatch) {
      const arrName = scalarArrMatch[1]!;
      const values = scalarArrMatch[3]!.trim().split(",").map((v) => v.trim());
      result[arrName] = values;
      ctx.pos++;
      continue;
    }

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) { ctx.pos++; continue; }

    const key = trimmed.slice(0, colonIdx).trim();
    const rest = trimmed.slice(colonIdx + 1).trim();

    if (rest === "") {
      ctx.pos++;

      if (ctx.pos < ctx.lines.length) {
        const nextRaw = ctx.lines[ctx.pos]!;
        const nextIndent = nextRaw.length - nextRaw.trimStart().length;
        if (nextIndent > lineIndent) {
          const propSchema = ctx.schema?.properties?.[key];
          const subCtx: ParseContext = {
            lines: ctx.lines,
            pos: ctx.pos,
            schema: propSchema,
          };
          result[key] = parseObjectBlock(subCtx, nextIndent);
          ctx.pos = subCtx.pos;
          continue;
        }
      }
      result[key] = "";
      continue;
    }

    result[key] = coerceScalar(rest, ctx.schema?.properties?.[key]);
    ctx.pos++;
  }

  return result;
}

function parseTabularRows(
  ctx: ParseContext,
  fields: string[],
  parentIndent: number,
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];

  while (ctx.pos < ctx.lines.length) {
    const raw = ctx.lines[ctx.pos]!;
    if (raw.trim() === "") { ctx.pos++; continue; }

    const lineIndent = raw.length - raw.trimStart().length;
    if (lineIndent < parentIndent) break;

    const trimmed = raw.trim();

    if (trimmed.startsWith("[/") || trimmed.includes("]:") || isObjectKeyLine(trimmed)) break;

    const cells = trimmed.split("|").map((c) => c.trim());
    if (cells.length < fields.length) { ctx.pos++; continue; }

    const row: Record<string, unknown> = {};
    for (let i = 0; i < fields.length; i++) {
      row[fields[i]!] = cells[i] ?? null;
    }
    rows.push(row);
    ctx.pos++;
  }

  return rows;
}

function isObjectKeyLine(line: string): boolean {
  if (line.includes("|")) return false;
  const colonIdx = line.indexOf(":");
  if (colonIdx === -1) return false;
  const before = line.slice(0, colonIdx).trimEnd();
  return /^\w[\w_]*(\[[^\]]*\])?$/.test(before);
}

function isArrayHeader(line: string): boolean {
  return /^\w+\[(\d+|N)\]\{[^}]+\}:\s*$/.test(line);
}

function parseArrayBlock(
  ctx: ParseContext,
  baseIndent: number,
): Record<string, unknown>[] {
  const trimmed = ctx.lines[ctx.pos]!.trim();
  const match = trimmed.match(/^(\w+)\[(\d+|N)\]\{([^}]+)\}:\s*$/);
  if (!match) return [];

  const fields = match[3]!.split(",").map((f) => f.trim());
  ctx.pos++;
  return parseTabularRows(ctx, fields, baseIndent);
}

function coerceScalar(
  value: string,
  schema?: JsonSchema,
): unknown {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value
      .slice(1, -1)
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }

  if (value === "null") return null;
  if (value === "true") return true;
  if (value === "false") return false;

  if (schema?.type === "integer" || schema?.type === "number") {
    const n = Number(value);
    if (!isNaN(n)) return n;
  }

  if (!schema?.type || schema.type === "string") {
    const n = Number(value);
    if (!isNaN(n) && value !== "") return n;
  }

  return value;
}

function coerceArrayTypes(
  items: Record<string, unknown>[],
  itemSchema?: JsonSchema,
): Record<string, unknown>[] {
  if (!itemSchema?.properties) return items;

  return items.map((row) => {
    const coerced: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (typeof v === "string") {
        coerced[k] = coerceScalar(v, itemSchema.properties![k]);
      } else {
        coerced[k] = v;
      }
    }
    return coerced;
  });
}

// ---------- schemaToToonHeader ----------

export function schemaToToonHeader(
  schema: JsonSchema,
  name?: string,
): string | null {
  if (schema.type !== "array" || !schema.items?.properties) return null;

  const props = schema.items.properties;
  const required = schema.items.required;
  const fields = required
    ? [...required, ...Object.keys(props).filter(
        (k) => !required.includes(k),
      )]
    : Object.keys(props);

  const label = name ?? "items";
  return `${label}[N]{${fields.join(", ")}}`;
}

// ---------- helpers ----------

function orderedKeys(
  obj: Record<string, unknown>,
  schema?: JsonSchema,
): string[] {
  if (schema?.required) {
    const extra = Object.keys(obj).filter(
      (k) => !schema.required!.includes(k),
    );
    return [...schema.required.filter((k) => k in obj), ...extra];
  }
  if (schema?.properties) {
    const schemaKeys = Object.keys(schema.properties);
    const objKeys = Object.keys(obj);
    const ordered = schemaKeys.filter((k) => objKeys.includes(k));
    const extra = objKeys.filter((k) => !schemaKeys.includes(k));
    return [...ordered, ...extra];
  }
  return Object.keys(obj);
}

function skipEmpty(ctx: ParseContext): void {
  while (ctx.pos < ctx.lines.length && ctx.lines[ctx.pos]!.trim() === "") {
    ctx.pos++;
  }
}
