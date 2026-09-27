# ROADMAP.md — LAN Chess In-App Windows Updater Roadmap

This document outlines the phased development plan for implementing the in-app Windows updater in LAN Chess.

---

## Phase 1: Architecture, Dependencies & IPC Bridge Design
- [ ] Research and install `electron-updater` compatible with Electron 44 and electron-builder 26.
- [ ] Configure `package.json` with GitHub release provider specifications (`provider: "github"`, `owner: "darshitn"`, `repo: "lan-chess"`).
- [ ] Define updater state types in `shared/types.ts` (`UpdateStatus`, `UpdateProgress`, `UpdateInfo`).
- [ ] Create `electron/updater.cjs` with safe lifecycle hooks, event listeners, and rate-limited manual check support.
- [ ] Implement narrow, typed context bridge in `electron/preload.cjs`.

## Phase 2: Renderer Service & UI Integration
- [ ] Build `client/services/desktop-updater.ts` with React-friendly subscription hooks and fallback behavior in non-desktop environments.
- [ ] Add the "Desktop Updates" section to `client/components/SettingsModal.tsx` showing current version, check button, download progress, and restart action.
- [ ] Create an unobtrusive global `UpdateBanner` or status badge when an update is downloaded and ready to install.
- [ ] Connect game state in `client/App.tsx` to updater lockout via `window.desktop.setGameActive()`.

## Phase 3: Active Game Protection & Resilience
- [ ] Implement strict main-process lockout refusing `quitAndInstall()` if `isGameActive === true`.
- [ ] Implement offline and network failure handling with sanitized, user-friendly error messages and manual retry controls.
- [ ] Add unit tests for updater utilities, active game guards, and IPC validators.

## Phase 4: Packaging, Differential Blockmaps & Mock E2E Testing
- [ ] Verify `npm run electron:build` produces `latest.yml`, `LAN-Chess-Setup-${version}.exe.blockmap`, and the installer executable.
- [ ] Create automated updater test script (`scripts/test-updater.mjs`) simulating:
  - Startup update check.
  - Manual update check via Settings.
  - Offline / 500 error handling without crashes.
  - Active game lockout refusal.
  - Update download progress and readiness.
- [ ] Verify `%APPDATA%\lan-chess` local storage data (custom themes, history, stats) is preserved across installations.

## Phase 5: Verification, Documentation & Release Preparation
- [ ] Run full test suite (`npm test`), typecheck (`npm run typecheck`), production build (`npm run build`), and dependency audits (`npm audit`).
- [ ] Update `README.md` and `CHANGELOG.md` with in-app updater documentation and bootstrapping guidance for v1.1.0/v1.1.1 users.
- [ ] Fast-forward `main`, tag, and publish the release with installer, blockmap, and `latest.yml`.
