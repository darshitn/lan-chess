export interface ProviderHealthStatus {
  status: "available" | "unavailable" | "not_configured" | "error" | "unknown";
  available: boolean;
  latency_ms?: number | null;
  error?: string | null;
}

export interface DiagnosticsResponse {
  status: string;
  version: string;
  environment: string;
  database: "ok" | "error";
  database_error?: string | null;
  providers: Record<string, string>;
  ollama?: ProviderHealthStatus | null;
  claude?: ProviderHealthStatus | null;
  demo?: ProviderHealthStatus | null;
}

export interface HealthResponse {
  status: string;
  version: string;
  environment: string;
  database?: string | null;
  providers?: Record<string, string> | null;
  details?: DiagnosticsResponse | null;
}
