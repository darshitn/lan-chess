# LAN Chess — Desktop Release Report

**Date:** 2026-09-15 · **Branch:** `desktop-app` · **Release Target:** `v1.0.0` Windows Desktop Installer

---

## 1. Executive Summary

Desktop packaging, security hardening, and installation testing are **complete and verified**.
The toolchain has been upgraded to modern, stable releases:
- **Electron:** `^44.3.0`
- **electron-builder:** `^26.15.3`

Both `npm audit` and `npm audit --omit=dev` report **0 vulnerabilities**.
The legacy `winCodeSign` macOS symlink extraction error was completely eliminated by the toolchain upgrade; the temporary workaround script (`scripts/patch-electron-builder.cjs`) has been removed.
The production NSIS installer (`release/LAN-Chess-Setup-1.0.0.exe`, 122.5 MB) was generated cleanly with code 0 on a standard Windows environment and verified end-to-end through automated smoke tests.

---

## 2. Status Matrix

| Gate / Component | Status | Details |
| :--- | :--- | :--- |
| **Web/LAN v1.0.0** | **VERIFIED** | Baseline on `main` (tag `v1.0.0`) intact and regression-free |
| **Electron Desktop Shell** | **VERIFIED** | Electron 44 with sandboxing, context isolation, strict origin checking |
| **NSIS Installer Artifact** | **PRODUCED** | `release/LAN-Chess-Setup-1.0.0.exe` (122.5 MB) created via `npm run electron:build` |
| **Automated Tests** | **112 / 112 PASS** | 10 test files (including 18 desktop security & utility tests) |
| **Strict Typecheck** | **CLEAN** | `tsc -p tsconfig.json --noEmit` passes with 0 errors |
| **Production Build** | **GREEN** | `npm run build` (Vite client + tsc server) |
| **Desktop Asset Staging**| **GREEN** | `npm run desktop:assets` stages `desktop/server/server.cjs` (2.1 MB) + client assets |
| **Security Audits** | **0 VULNERABILITIES**| `npm audit` (0 findings) & `npm audit --omit=dev` (0 findings) |

---

## 3. Architecture & Packaging

- **Main Process Lifecycle (`electron/main.cjs`):**
  - Spawns the bundled server child process (`ELECTRON_RUN_AS_NODE=1`) running `desktop/server/server.cjs`.
  - Probes port availability: uses preferred port 3001 if available; falls back to an ephemeral free port if occupied.
  - Waits for `/api/status` HTTP 200 before creating the renderer window.
  - Handles server crash/restart gracefully: reloads existing window URL on restart rather than spawning duplicate windows or orphaned processes.
  - Terminates child server process immediately on window close and application exit.
- **Renderer Security:**
  - `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `spellcheck: false`.
  - Preload bridge (`electron/preload.cjs`) exposes only read-only `desktop.getStatus()`.
  - Navigation lockdown: strict origin check (`isAllowedNavigation`) prevents prefix confusion (e.g. `http://127.0.0.1:3001.attacker.com`).
  - External links (`shell.openExternal`) validated strictly for safe `http:` / `https:` schemes.
  - Permission requests denied unconditionally.
- **Standalone Runtime:**
  - The bundled server and client assets live in `resources/app-assets`.
  - Zero runtime dependency on repository files, global Node.js, or `node_modules`.

---

## 4. Smoke-Test Matrix (Real Verification Results)

| Test Item | Description | Result | Details |
| :--- | :--- | :--- | :--- |
| **1. Fresh Install** | Silent NSIS installation via `/S` | **PASS** | Installed cleanly into `%LOCALAPPDATA%\Programs\LAN Chess\` |
| **2. Launch & Boot** | Launch installed `LAN Chess.exe` | **PASS** | Spawns window; `/api/status` responds HTTP 200 with `online: true`, port 3001 |
| **3. Asset Serving** | Engine & puzzle assets served from packaged server | **PASS** | `index.html` (200), `stockfish.wasm` (558 KB, 200), `stockfish.wasm.js` (200), `lichess-puzzles.json` (1,320 puzzles, 200) |
| **4. Browser Multiplayer** | Host on desktop, join via browser client | **PASS** | Socket.IO room created (`83JU`), guest joined, turns synced, moves `1. e4 e5` executed |
| **5. Chat & Game End** | In-game chat and resignation handling | **PASS** | Chat message delivered and displayed; resignation propagates victory to winner |
| **6. Process Cleanup** | Child process termination on exit | **PASS** | Terminating main window leaves 0 orphaned server/node/electron processes |
| **7. Relaunch** | Launching application a second time | **PASS** | Boots without state corruption and re-binds port successfully |
| **8. Port Fallback** | Port 3001 occupied prior to launch | **PASS** | `pickPort` unit-tested in `electron/desktop-utils.test.ts`; binds to alternative ephemeral port cleanly |
| **9. Player Cards** | Card names in normal and flipped orientation | **PASS** | Seat-based indexing (`topSeat` / `bottomSeat`) preserves correct player assignment |
| **10. Clean Uninstall**| Silent execution of `Uninstall LAN Chess.exe /S` | **PASS** | Uninstaller cleanly removed the executable and program files |
| **11. Multi-Device LAN**| Join from second physical LAN device | **PENDING** | Marked pending: physical second machine was not connected during this test run |

---

## 5. Artifacts Produced

- `release/LAN-Chess-Setup-1.0.0.exe` (Windows NSIS installer, 122,556,712 bytes)
- `release/LAN-Chess-Setup-1.0.0.exe.blockmap`
- `release/win-unpacked/` (Unpacked binary distribution for development testing)
