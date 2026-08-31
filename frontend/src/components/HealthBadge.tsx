import { useHealth } from "../hooks/useHealth";
import { getApiBase } from "../services/api";

function providerLabel(status: string | undefined): string {
  if (!status) return "UNKNOWN";
  return status.toUpperCase();
}

export function HealthBadge() {
  const { data, loading, error, refresh } = useHealth(15000);
  const apiBase = getApiBase();

  let status: "ok" | "error" | "loading" = "loading";
  let label = "Checking…";
  if (loading && !data && !error) {
    status = "loading";
    label = "Connecting…";
  } else if (error) {
    status = "error";
    label = "Offline";
  } else if (data?.status === "ok") {
    status = "ok";
    label = "Connected";
  } else if (data) {
    status = "error";
    label = data.status;
  }

  const providers = data?.providers ?? data?.details?.providers;
  const dbStatus = data?.database ?? data?.details?.database;

  return (
    <div className="health-badge" role="status" aria-live="polite" style={{ flexWrap: "wrap", gap: 8 }}>
      <span className={`health-dot health-dot--${status}`} aria-hidden />
      <span className="health-label">
        Backend: <strong>{label}</strong>
      </span>
      {data && (
        <span className="health-meta">
          v{data.version} · {data.environment} · {apiBase}
        </span>
      )}
      {/* Distinct provider statuses — Ollama offline does NOT mean backend failure */}
      {data && providers && (
        <span className="health-meta" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span title="Database">DB:{providerLabel(dbStatus)}</span>
          <span title="Ollama">Ollama:{providerLabel(providers["ollama"])}</span>
          <span title="Claude">Claude:{providerLabel(providers["claude"])}</span>
          <span title="Demo">Demo:{providerLabel(providers["demo"])}</span>
        </span>
      )}
      {error && <span className="health-error" title={error}>{error}</span>}
      <button type="button" className="health-refresh" onClick={() => void refresh()} aria-label="Retry health check">
        Retry
      </button>
    </div>
  );
}
