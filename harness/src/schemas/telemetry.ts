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

export interface TelemetryOrdering {
  event_seq: number;
  parent_event_id?: string;
}

export interface TelemetryRecord {
  version: string;
  agent_id: string;
  observed_at: string;
  ordering: TelemetryOrdering;
  metrics: TelemetryMetrics;
}

export function createInitialTelemetry(agentId: string): TelemetryRecord {
  return {
    version: "0.2",
    agent_id: agentId,
    observed_at: new Date().toISOString(),
    ordering: {
      event_seq: 0,
    },
    metrics: {
      steps: 0,
      tool_calls: 0,
      latency_ms: 0,
      memory_reads: 0,
      safety_violations: 0,
    },
  };
}
