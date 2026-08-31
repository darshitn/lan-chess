import type { HealthResponse, DiagnosticsResponse } from "../types/health";

// Centralized API config — no hardcoding in components
// Priority: VITE_API_BASE_URL env > vite proxy (/api) > fallback
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "http://127.0.0.1:8000";

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/api/health`, { signal });
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as HealthResponse;
  return data;
}

export async function fetchDiagnostics(signal?: AbortSignal): Promise<DiagnosticsResponse> {
  const res = await fetch(`${API_BASE}/api/diagnostics`, { signal });
  if (!res.ok) {
    throw new Error(`Diagnostics failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as DiagnosticsResponse;
}

export function getApiBase(): string {
  return API_BASE;
}
