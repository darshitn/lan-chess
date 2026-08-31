import { getApiBase } from "../services/api";

export function Dashboard() {
  const apiBase = getApiBase();
  return (
    <div className="dashboard">
      <h1>Welcome — Phase 2</h1>
      <p className="lead">
        Core data + provider abstraction are live. Header shows backend health — if it says <em>Offline / Failed to fetch</em>, start the backend (see below).
      </p>

      <div className="card-grid">
        <section className="card">
          <h2>Backend — Phase 1 &amp; 2</h2>
          <ul>
            <li><code>GET {apiBase}/api/health</code> — status</li>
            <li><code>GET {apiBase}/docs</code> — Swagger (try it)</li>
            <li><code>GET /api/projects /agents /roles /providers /profiles /settings</code> — Phase 1 CRUD</li>
            <li><code>GET /api/providers/{"{id}"}/health /models</code> + <code>POST /generate /stream</code> — Phase 2</li>
            <li><code>POST /api/agents/{"{id}"}/generate</code> — Agent → Provider → Model (no Ollama code in Agent)</li>
            <li>SQLite at <code>backend/data/app.db</code></li>
          </ul>
        </section>
        <section className="card">
          <h2>Ollama — Configurable</h2>
          <ul>
            <li>Default <code>http://127.0.0.1:11434</code> (only default) — override via <code>OLLAMA_HOST</code> or <code>providers.config.base_url</code></li>
            <li>Health: <code>GET /providers/{"{ollama_id}"}/health</code> (503 if down — never crashes)</li>
            <li>Models: <code>GET /providers/{"{ollama_id}"}/models</code></li>
            <li>Assign to agent: <code>PATCH /api/agents/{"{id}"} {"{model}"}</code></li>
            <li>Demo provider: deterministic <code>[DEMO]</code> responses — clearly labeled, never real AI</li>
          </ul>
        </section>
        <section className="card">
          <h2>Run &amp; Fix Offline</h2>
          <ul>
            <li>Backend was offline in your screenshot because it wasn't running (see terminal). Start it:</li>
            <li><code>python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload</code></li>
            <li>Frontend: <code>npm --prefix frontend run dev</code> → <code>http://localhost:5173</code></li>
            <li>Or one-shot: <code>powershell -ExecutionPolicy Bypass -File scripts/dev.ps1</code></li>
            <li>If still offline, check <code>.env</code> <code>VITE_API_BASE_URL=http://127.0.0.1:8000</code> and hard-refresh.</li>
          </ul>
        </section>
      </div>

      <div className="card-grid" style={{ marginTop: 14 }}>
        <section className="card">
          <h2>Security</h2>
          <ul>
            <li>Credentials backend-only; <code>.env</code> gitignored.</li>
            <li>Claude API vs web vs Ollama vs Demo distinct — no fake "connected".</li>
          </ul>
        </section>
        <section className="card">
          <h2>Tests &amp; Docs</h2>
          <ul>
            <li><code>pytest -q</code> — 63 passed (mocked Ollama, no install needed)</li>
            <li><code>npm --prefix frontend run typecheck & build</code> — ok</li>
            <li><code>docs/providers.md</code> + <code>docs/ollama.md</code></li>
          </ul>
        </section>
        <section className="card">
          <h2>Next — Phase 3+</h2>
          <ul>
            <li>DAG workflows, parallel, approvals, artifacts, team chat</li>
            <li>React Flow visualization, notifications, search</li>
          </ul>
        </section>
      </div>

      <div className="notice" style={{ marginTop: 14 }}>
        <strong>Phase 2 live:</strong> Demo + Ollama abstraction + Agent runner. If header still says Offline, backend isn't running — start it and click Retry.
      </div>
    </div>
  );
}
