/**
 * Telemetry types — RFC 0031 (Agent Observability & Telemetry).
 *
 * Mirrors schemas/rfc-0031-agent-observability-telemetry.json.
 */

export interface TelemetryMetrics {
  steps: number;
  tool_calls: number;
  latency_ms: number;
  memory_reads: number;
  safety_violations: number;
  [key: string]: number;
}

export interface TelemetryRecord {
  version: string;
  agent_id: string;
  timestamp: string;
  metrics: TelemetryMetrics;
}

export function createInitialTelemetry(agentId: string): TelemetryRecord {
  return {
    version: "0.1",
    agent_id: agentId,
    timestamp: new Date().toISOString(),
    metrics: {
      steps: 0,
      tool_calls: 0,
      latency_ms: 0,
      memory_reads: 0,
      safety_violations: 0,
    },
  };
}
