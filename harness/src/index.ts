/**
 * @open-cot/core - Reference package for the Open CoT standard.
 *
 * This package proves the standard is executable, testable, and operational
 * by exposing cognitive artifact, policy boundary, and reconciliation helpers
 * that emit and consume RFC-compliant traces.
 */

// Schema types
export * from "./schemas/index.js";

// Core engine
export * from "./core/index.js";

// Backends
export * from "./backends/index.js";

// Tools
export * from "./tools/index.js";

// Governance
export * from "./governance/index.js";

// Adapters
export * from "./adapters/index.js";

// Pipelines
export * from "./pipelines/index.js";
