# LAN Chess — Desktop Release Report

**Date:** 2026-09-15 · **Branch:** `feature/draw-offer-cancellation` · **Release Target:** `v1.1.0` Windows Desktop Installer

---

## 1. Executive Summary

Desktop packaging for v1.1.0 supersedes the v1.0.0 installer with:

- **Play vs Computer** (offline Stockfish engine with difficulty selection and full PGN/review integration).
- **Draw-offer cancellation** (server-authoritative `cancel-draw` event with UI toggle and 14 regression tests).
- **Engine & clock hardening** (worker termination and replacement cancellation, deadline rejection, error recovery).
- **Test count 112 → 153** across 12 test files.

Toolchain unchanged from v1.0.0:
- **Electron:** `^44.3.0`
- **electron-builder:** `^26.15.3`

Both `npm audit` and `npm audit --omit=dev` continue to report **0 vulnerabilities**.  
The v1.0.0 installer (`LAN-Chess-Setup-1.0.0.exe`) did **not** contain Play vs Computer; that feature is new in v1.1.0.
Development server runs at `http://localhost:5173` (Vite) proxied to the backend at `http://localhost:3001`.

---

## 2. Status Matrix — v1.1.0

| Gate / Component | Status | Details |
| :--- | :--- | :--- |
| **Previous Stable (v1.0.0)** | **VERIFIED** | `release/LAN-Chess-Setup-1.0.0.exe` (122.5 MB) on `main`; LAN multiplayer + Desktop only |
| **Automated Tests** | **153 / 153 PASS** | 12 test files (server, client, desktop security, offline AI engine, computer-game controller) |
| **Strict Typecheck** | **CLEAN** | `tsc -p tsconfig.json --noEmit` passes with 0 errors |
| **Production Build** | **GREEN** | `npm run build` (Vite client + tsc server) |
| **Desktop Asset Staging** | **GREEN** | `npm run desktop:assets` stages `desktop/server/server.cjs` + client assets |
| **Security Audits** | **0 VULNERABILITIES** | `npm audit` and `npm audit --omit=dev` both 0 findings; 517 packages audited |
| **git diff --check** | **CLEAN** | No whitespace errors |
| **NSIS Installer (v1.1.0)** | **VERIFIED** | `release/LAN-Chess-Setup-1.1.0.exe` (122.6 MB) built, installed, and smoke-tested |

---

## 3. Architecture & Packaging

Architecture is unchanged from v1.0.0. New in v1.1.0:

- **ComputerPlayerService** runs as a Web Worker inside the Electron renderer process (same Stockfish WASM as game review); it never touches server state or the Electron main process. Engine cancellation uses immediate worker termination and replacement to guarantee zero delayed message leakage.
- **ComputerGameController** operates entirely in the renderer; no IPC additions required.
- The `cancel-draw` socket event is handled by the bundled Express/Socket.IO server (same child process as before).

All other packaging details from v1.0.0 remain identical (see below).

**Main Process Lifecycle (`electron/main.cjs`):**
- Spawns the bundled server child process (`ELECTRON_RUN_AS_NODE=1`) running `desktop/server/server.cjs`.
- Probes port availability; falls back to an ephemeral free port if 3001 is occupied.
- Waits for `/api/status` HTTP 200 before creating the renderer window.
- Handles server crash/restart gracefully.
- Terminates child server process immediately on window close and application exit.

**Renderer Security (unchanged):**
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `spellcheck: false`.
- Preload bridge (`electron/preload.cjs`) exposes only read-only `desktop.getStatus()`.
- Navigation lockdown: strict origin check prevents prefix confusion.
- External links validated strictly for safe `http:` / `https:` schemes.
- Permission requests denied unconditionally.

---

## 4. Smoke-Test Matrix — v1.1.0

| # | Test Item | Description | Result | Details |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **Launch & Boot** | Launch installed `LAN Chess.exe` | **PASS** | Window opens; `/api/status` responds HTTP 200 `online: true`, LAN IP reported |
| 2 | **Asset Serving** | Engine & puzzle assets from packaged server | **PASS** | `stockfish.wasm` (558 KB, 200), `stockfish.wasm.js` (200), `lichess-puzzles.json` (1,320 puzzles, 200) |
| 3 | **LAN Multiplayer** | Host on desktop, join from browser | **PASS** | Room created, moves synced, chat delivered, resignation processed |
| 4 | **Play vs Computer** | Select difficulty, play as White & Black | **PASS** | Played as White and Black; engine moves responded; resignation dialog works; saved to History |
| 5 | **Game History / Review** | Completed game saved and reviewable | **PASS** | Completed computer game loaded into Game Review with full evaluation graph and move analysis |
| 6 | **Draw-offer Cancellation** | Offer draw → cancel in two clients | **PASS** | Verified live with two multiplayer clients; draw offer cleared on both upon cancellation |
| 7 | **Process Cleanup** | Closing app leaves no orphan processes | **PASS** | Verified via process audit; all Electron and Node processes exit cleanly |
| 8 | **Port Fallback** | Bind when 3001 is occupied | **PASS** | Probes available port and falls back; unit-tested in `electron/desktop-utils.test.ts` |
| 9 | **Clean Uninstall** | Silent uninstall via `/S` flag | **PASS** | `Uninstall LAN Chess.exe /S` removes installed files cleanly |

---

## 5. Historical — v1.0.0 Installer

The v1.0.0 installer (`release/LAN-Chess-Setup-1.0.0.exe`, 122,556,712 bytes) was the first stable packaged release.  
**It contained**: LAN multiplayer, Stockfish game review, tactical puzzles, practice sandbox, game history, 19 board themes, 6 UI themes, and the Electron desktop shell.  
**It did NOT contain**: Play vs Computer, draw-offer cancellation.

---

## 6. Artifacts Produced

### v1.1.0 (current)
- `release/LAN-Chess-Setup-1.1.0.exe` (122,562,605 bytes · 122.6 MB)
- `release/LAN-Chess-Setup-1.1.0.exe.blockmap` (129,282 bytes)
- `release/win-unpacked/` (unpacked portable binary directory)

### v1.0.0 (historical)
- `release/LAN-Chess-Setup-1.0.0.exe` (122,556,712 bytes)
- `release/LAN-Chess-Setup-1.0.0.exe.blockmap` (129,313 bytes)

---

## 7. Deferred Future Enhancements

The following roadmap items were deliberately scoped out of this integration pass and tracked for future releases:
1. **Game-history archive import/export**: Portable JSON/ZIP backup and restore of client-side game history.
2. **Host-side logging**: Structured room audit logging on the host/server process.
3. **Active-room persistence**: Reconnecting ongoing multiplayer games across server restarts.
4. **ESLint integration**: Project-wide linting configuration and rule setup.
5. **CI / Automated Pipeline**: GitHub Actions workflow for automated test, build, and packaging.

