# ARCHITECTURE.md — LAN Chess Desktop & Updater Architecture

This document describes the architectural design of LAN Chess, specifically focusing on the desktop application lifecycle, in-app updater pipeline, inter-process communication (IPC), and security model.

---

## 1. System Architecture

LAN Chess operates as a hybrid desktop/web architecture:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        ELECTRON MAIN PROCESS                           │
│  ┌─────────────────────────┐              ┌─────────────────────────┐  │
│  │     Server Manager      │              │      AutoUpdater        │  │
│  │ (Spawns bundled Node.js │              │   (electron-updater)    │  │
│  │  Express/Socket.IO)     │              │                         │  │
│  └────────────┬────────────┘              └────────────┬────────────┘  │
│               │ child_process (port 3001)              │ HTTPS (GitHub)│
│               ▼                                        ▼               │
│  ┌─────────────────────────┐              ┌─────────────────────────┐  │
│  │  Local Express/WS Server│              │  GitHub Releases API    │  │
│  │  - Room Management      │              │  - latest.yml           │  │
│  │  - Authoritative Clocks │              │  - NSIS .blockmap       │  │
│  │  - chess.js validation  │              │  - Setup-${ver}.exe     │  │
│  └────────────▲────────────┘              └────────────┬────────────┘  │
│               │ HTTP / WebSocket                       │ Download      │
│  ┌────────────┴────────────────────────────────────────▼────────────┐  │
│  │                   BrowserWindow (Renderer UI)                    │  │
│  │  ┌──────────────────────┐             ┌───────────────────────┐  │  │
│  │  │  React 19 SPA        │             │ Preload Bridge        │  │  │
│  │  │  - Chessboard / Grid │◄─── IPC ───►│ (window.desktop)      │  │  │
│  │  │  - Settings Modal    │             │ - copyText            │  │  │
│  │  │  - Game Review       │             │ - updateStatus        │  │  │
│  │  │  - Stockfish Worker  │             │ - checkForUpdates     │  │  │
│  │  └──────────────────────┘             │ - quitAndInstall      │  │  │
│  │                                       └───────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend (Renderer Process)

- **Technology**: React 19 + TypeScript + Vite + Tailwind CSS.
- **State Management**:
  - `App.tsx`: Central coordinator for multiplayer socket events, room state, active game tracking, and clock updates.
  - `SettingsModal.tsx`: Host for the "Desktop Updates" section. Renders update state (`idle`, `checking`, `available`, `downloading`, `downloaded`, `error`), download progress metrics (bytes, speed, percentage), and controls.
  - `UpdateBanner.tsx`: Non-disruptive banner notifying the user when an update is downloaded and ready for installation.
- **Bridge Consumption**: Interacts with `window.desktop` through typed helper services in `client/services/desktop-updater.ts`. If running in a standard web browser (non-Electron), all desktop features degrade gracefully (update checks report web environment; clipboard falls back to browser APIs).

---

## 3. Backend (Bundled Local Server)

- **Technology**: Node.js + Express 5 + Socket.IO 4 + chess.js.
- **Role**: Authoritative game lifecycle host. Manages in-memory rooms, validate moves, arbitrates Fischer increment clocks, enforces spectator constraints, and broadcasts serialized game state.
- **Packaging**: Bundled into a single self-contained CommonJS binary (`desktop/server/server.cjs`) using esbuild during `desktop:assets`. Extracted to `process.resourcesPath/app-assets` so the main process can execute it via system Node without global runtime prerequisites.

---

## 4. Database & Persistence

- **Multiplayer State**: Strictly in-memory for zero disk overhead and rapid cleanup. A server restart clears active rooms.
- **Client Preferences & Archives**: Persisted in browser `localStorage` (managed under Electron's `userData` profile at `%APPDATA%\lan-chess`):
  - `lan-chess:preferences`: Player name, piece set, active theme, sound toggles, volume.
  - `lan-chess:custom-themes`: User-designed board palettes.
  - `lan-chess:game-history`: Complete PGN records with timestamps and move classifications.
  - `lan-chess:statistics`: Aggregated win/loss/draw records.
- **Updater Persistence**: `electron-updater` caches temporary differential downloads in `%LOCALAPPDATA%\lan-chess-updater`.

---

## 5. APIs & IPC Protocols

### Electron Main-to-Renderer IPC

| Channel | Type | Payload / Returns | Description |
| :--- | :--- | :--- | :--- |
| `desktop:get-status` | `invoke` | Returns `DesktopStatus` | Returns version, server port, platform. |
| `desktop:copy-text` | `invoke` | `text: string` &rarr; `boolean` | Safely writes text (up to 5,000 chars) to OS clipboard. |
| `desktop:updater-get-status` | `invoke` | Returns `UpdateStatusPayload` | Current updater state (`idle`, `checking`, etc.). |
| `desktop:updater-check` | `invoke` | Returns `UpdateCheckResult` | Manually triggers update check against GitHub. |
| `desktop:updater-quit-and-install` | `invoke` | Returns `{ success: boolean, message?: string }` | Quits app and launches NSIS installer (blocked if game active). |
| `desktop:updater-set-game-active` | `send` | `active: boolean` | Notifies main process whether a game is in progress. |
| `desktop:updater-status-changed` | `push` | `UpdateStatusPayload` | Broadcasts download progress and state transitions to window. |

---

## 6. Authentication & Security

1. **Context Isolation & Sandboxing**:
   - `contextIsolation: true` and `nodeIntegration: false` enabled on all `BrowserWindow` instances.
   - Preload script exposes only narrow, strictly validated functions under `window.desktop`.
2. **IPC Input Validation**:
   - Every IPC handler strictly sanitizes inputs (string length bounds, boolean casts).
   - `desktop:copy-text` validates character count (&le; 5,000) and UTF-8 strings.
   - `desktop:updater-quit-and-install` enforces the active game lockout rule:
     ```javascript
     if (isGameActive) {
       return { success: false, message: "Cannot update during an active game." };
     }
     ```
3. **Navigation Lockdown**:
   - `will-navigate` and `setWindowOpenHandler` prevent the renderer from navigating to external URLs or untrusted origins. External links (GitHub, issues) open in the user's default browser via `shell.openExternal`.
4. **Code Signing & Integrity Model**:
   - When builds are self-packaged without an EV/OV code-signing certificate, Windows SmartScreen presents an Unknown Publisher warning.
   - `electron-updater` operates over TLS/HTTPS with GitHub Releases.
   - Cryptographic integrity is verified via the SHA-512 checksum recorded in `latest.yml` and the NSIS `.blockmap`.
   - **We do not disable integrity checks** (`verifyUpdateCodeSignature: false` is not set).

---

## 7. AI Components

- **Stockfish WASM Engine**: Stockfish 10 compiled to WebAssembly, executed in a dedicated browser Web Worker for post-game review, analysis, and offline computer play.
- **Search Cancellation**: Search jobs terminate and recreate the Web Worker upon cancellation to guarantee delayed `bestmove` tokens never contaminate subsequent searches.

---

## 8. Data Flow: Update Lifecycle

```text
1. Startup / Manual Click
   Renderer ──(IPC: updater-check)──► Main Process ──(HTTPS)──► GitHub Releases (latest.yml)

2. Version Comparison
   If remote version > current version:
   Main Process emits 'status: available' ──► Renderer displays available banner/badge

3. Differential Blockmap Download
   Main Process requests .blockmap ──► Downloads delta chunks from Setup.exe
   Main Process emits 'status: downloading' (progress %) ──► Renderer updates progress bar

4. Ready to Install
   Download complete & verified (SHA-512 match)
   Main Process emits 'status: downloaded' ──► Renderer activates "Restart & Update Now" button

5. User-Initiated Restart
   User clicks Restart ──(IPC: quit-and-install)──► Main Process
   Main checks `isGameActive`:
     - If true: Refuses installation with user warning.
     - If false: Shuts down server process, quits app, runs installer with silent flags.
```

---

## 9. Folder Structure

```text
├── client/
│   ├── components/
│   │   ├── SettingsModal.tsx          # Settings modal with updater section
│   │   └── UpdateBanner.tsx           # Global update notification banner
│   ├── services/
│   │   └── desktop-updater.ts         # Renderer updater client & status listener
│   └── App.tsx                        # Coordinates game state with updater lockout
├── electron/
│   ├── main.cjs                       # Window creation & server management
│   ├── updater.cjs                    # AutoUpdater lifecycle & IPC handlers
│   ├── preload.cjs                    # ContextBridge desktop API
│   └── desktop-utils.cjs              # Security, port, and argument parsing
├── scripts/
│   ├── build-desktop.mjs              # Server bundle & client staging
│   ├── test-updater.mjs               # Automated updater test suite (offline/mock/lockout)
│   └── test-installed-electron.mjs    # E2E installed application test
└── package.json                       # Electron-builder publish config & dependencies
```

---

## 10. Deployment & Release Pipeline

1. **Build Step**:
   - `npm run build` &rarr; Vite compiles client to `dist/client`, TypeScript compiles server to `dist/server`.
   - `npm run desktop:assets` &rarr; Bundles server with esbuild into `desktop/server/server.cjs`.
   - `npm run electron:build` &rarr; `electron-builder --win` packages the NSIS executable, calculates blockmaps, and outputs:
     - `release/LAN-Chess-Setup-${version}.exe`
     - `release/LAN-Chess-Setup-${version}.exe.blockmap`
     - `release/latest.yml`
2. **Publishing Step**:
   - GitHub Release created using GitHub CLI (`gh release create`).
   - Assets uploaded: Setup `.exe`, `.blockmap`, `latest.yml`, and `.sha256`.

---

## 11. Important Technical Decisions

1. **In-App Updater Logic in Main Process**: Updating binaries involves file system replacement and process spawning. Keeping this in `electron/updater.cjs` maintains the principle of least privilege in the renderer.
2. **No Automatic Restarts**: Unlike web apps that can hot-reload, desktop chess games represent active cognitive investment. Even if an update is fully downloaded, the app will never restart without explicit user consent.
3. **Active Game Guard in Main**: Even if a user clicks restart or a malicious script attempts to trigger IPC, the main process rejects the quit command if a match is flagged as active.
4. **Differential Updates**: NSIS differential blockmap updating avoids re-downloading ~120 MB on every minor release, reducing bandwidth to only the modified asar and assets (~5-15 MB).
