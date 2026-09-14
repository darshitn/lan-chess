# LAN Chess — Desktop Release Report

**Date:** 2026-09-15 · **Branch:** `desktop-app` · **Release Target:** `v1.0.0` Desktop Installer

---

## 1. Executive Summary

Desktop packaging and security hardening are **complete and verified**.
The toolchain has been upgraded to modern, secure stable releases:
- **Electron:** `^44.3.0`
- **electron-builder:** `^26.15.3`

Both `npm audit` and `npm audit --omit=dev` report **0 vulnerabilities**.
The legacy `winCodeSign` macOS symlink extraction error is completely resolved by the upgraded toolchain; the temporary workaround script (`scripts/patch-electron-builder.cjs`) has been removed.
A production-ready NSIS installer (`release/LAN-Chess-Setup-1.0.0.exe`, 122.5 MB) was generated cleanly with code 0 on a standard Windows environment.

---

## 2. Status

| Gate / Component | Status | Details |
| :--- | :--- | :--- |
| **Web/LAN v1.0.0** | **VERIFIED** | Baseline on `main` (tag `v1.0.0`) intact and regression-free |
| **Electron Desktop Shell** | **VERIFIED** | Electron 44 with sandboxing, context isolation, strict origin checking |
| **NSIS Installer Artifact** | **PRODUCED** | `release/LAN-Chess-Setup-1.0.0.exe` (122.5 MB) created via `npm run electron:build` |
| **Automated Tests** | **112 / 112 PASS** | 10 test files (including 18 new desktop security & utility tests) |
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

## 4. Verification & Smoke-Test Matrix

1. **Clean NSIS Installer Build:**
   - Command: `npm run electron:build`
   - Output: `release/LAN-Chess-Setup-1.0.0.exe` (122,556,712 bytes)
   - Exit code: `0`
2. **Packaged Server Direct Execution:**
   - Spawned `release/win-unpacked/resources/app-assets/server.cjs`
   - Polled `http://127.0.0.1:3001/api/status`
   - Output: `online: True`, `lanIp: 192.168.1.71`, `port: 3001`
   - Child process terminated cleanly without orphan processes.
3. **Port Collision & Fallback Verification:**
   - Verified via unit test suite in `electron/desktop-utils.test.ts`: when preferred port is occupied, `pickPort` automatically binds and returns an available ephemeral port with `{ preferred: false }`.
4. **Security & Input Validation:**
   - Tested in `electron/desktop-utils.test.ts`:
     - Port validation (1–65535, rejects invalid/out-of-range).
     - `--connect` CLI parameter parsing (rejects protocol injection, credentials, path traversal, out-of-range ports).
     - Navigation origin checking (rejects domain-prefix spoofing and non-HTTP schemes).
     - External URL safety check (restricts to safe HTTP/HTTPS).
5. **Asset Serving:**
   - Stockfish WASM (`stockfish.wasm`, `stockfish.wasm.js`) and 1,320 tactical puzzles (`puzzles/lichess-puzzles.json`) bundled into production client staging.

---

## 5. Artifacts Produced

- `release/LAN-Chess-Setup-1.0.0.exe` (Windows NSIS installer)
- `release/LAN-Chess-Setup-1.0.0.exe.blockmap`
- `release/win-unpacked/` (Unpacked binary distribution for quick portable execution)
