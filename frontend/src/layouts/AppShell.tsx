import { HealthBadge } from "../components/HealthBadge";

type Props = { children: React.ReactNode };

export function AppShell({ children }: Props) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__left">
          <span className="app-logo" aria-hidden>⬢</span>
          <span className="app-title">Multi-Agent AI Workspace</span>
          <span className="app-subtitle">Phase 2 — Provider Abstraction · Ollama</span>
        </div>
        <div className="app-header__right">
          <HealthBadge />
        </div>
      </header>
      <div className="app-body">
        <nav className="app-sidebar" aria-label="Primary">
          <div className="sidebar-section">
            <div className="sidebar-label">Navigation</div>
            <a className="sidebar-item sidebar-item--active" href="#">Dashboard</a>
            <a className="sidebar-item" href="#" title="Phase 1 — live via /api/projects">Projects</a>
            <a className="sidebar-item" href="#" title="Phase 1 — live via /api/agents">Agents</a>
            <a className="sidebar-item" href="#" title="Phase 2 — provider abstraction live">Providers & Ollama</a>
            <span className="sidebar-item sidebar-item--disabled" title="Phase 3+">Workflows</span>
            <span className="sidebar-item sidebar-item--disabled" title="Phase 3+">Artifacts</span>
          </div>
          <div className="sidebar-section">
            <div className="sidebar-label">System</div>
            <a className="sidebar-item" href="#" title="Live via /api/settings">Settings</a>
            <a className="sidebar-item" href="#" title="Live via /api/health">Diagnostics</a>
          </div>
          <div className="sidebar-foot">
            <div className="sidebar-hint">Phase 2 live: Demo + Ollama (configurable) · Agent → Provider → Model · Try /docs</div>
          </div>
        </nav>
        <main className="app-main">{children}</main>
      </div>
      <footer className="app-footer">
        <span>Local-first · SQLite · Provider-independent · Credentials stay backend-only</span>
      </footer>
    </div>
  );
}
