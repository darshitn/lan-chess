# LAN Chess — Windows Desktop Application

LAN Chess ships as a native Windows desktop application. The desktop shell is
**Electron doing exactly two jobs**: showing the app in a real window and
running/monitoring the bundled Node server. All game behavior is unchanged:

```text
Electron (window + server lifecycle)
   └─ spawns bundled Node server (child process)
        ├─ serves production React frontend
        ├─ Socket.IO ⇄ React UI (same as browser)
        └─ Room Manager + chess.js (authoritative game state)
   Other devices (browser or another LAN Chess install) join over LAN
```

There is no second game implementation: the Electron layer never touches chess
rules, rooms, or clocks.

## Install

1. Download `LAN-Chess-Setup-<version>.exe` from GitHub Releases.
2. Run it — no Node.js, npm, Git, or admin rights required (per-user install).
3. Choose shortcuts (Start Menu + optional desktop) and install.
4. Launch **LAN Chess** — the local server starts automatically and the window
   opens when it is ready.

> The installer is unsigned, so Windows SmartScreen may show an
> "Unknown publisher" warning — choose *More info → Run anyway*.

## Hosting a game

1. Enter your name and press **Create Room & Play**.
2. The lobby shows your LAN address (e.g. `http://192.168.1.66:3001`) and the
   4-character room code. Use **Copy Room Invite** to share both.
3. Friends join from any browser on the same network by opening that address
   and entering the code — they do **not** need the desktop app.

Two desktop installs can also play each other: the joining player can start
the app with `LAN Chess.exe --connect=<host-ip>:<port>` to open the UI
directly onto the host's table (advanced usage; the browser path is the
normal one).

## Firewall & networks

- The first time the app hosts, Windows Firewall may ask for permission —
  **allow on Private networks** so other devices can reach the server.
- The app never modifies firewall or security settings.
- On college/public Wi-Fi, device-to-device traffic is often blocked by the
  network itself (client isolation). The app cannot bypass this; the host
  screen will simply never be reachable from other devices. Try a phone
  hotspot or a home network.

## How it works inside

| Concern | Where it lives |
| --- | --- |
| Window, lifecycle, crash/restart handling | `electron/main.cjs` |
| Renderer bridge (read-only status IPC only) | `electron/preload.cjs` |
| Game server (Express + Socket.IO + chess.js) | bundled to `desktop/server/server.cjs` |
| Frontend build (incl. Stockfish WASM + puzzle library) | `desktop/server/client/` |

- The server runs as a **plain Node child process**
  (`ELECTRON_RUN_AS_NODE=1`), outside any Electron sandbox, so file serving
  behaves exactly like the web deployment.
- If the default port `3001` is busy, the shell picks a free port and passes
  it to the server; the LAN address shown in the UI always reflects the
  actual port.
- If the server process dies, the window shows
  *"The local server stopped unexpectedly"* with **Restart Server / Quit**.
- Closing the window stops the server child — no orphan processes.
- Renderer security: `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`, permission requests denied, navigation locked to the local
  server, external links open in the system browser. The only IPC is a
  read-only `desktop:get-status` (version / port / server state).

## Build commands

```bash
npm run dev              # web development (browser, hot reload) — unchanged
npm run build            # web production build (typecheck + client + server)
npm run electron:dev     # build everything, then open the desktop window
npm run electron:build   # build everything, then produce the NSIS installer
npm run build:puzzles    # regenerate the puzzle library (see scripts/)
```

- Desktop build output: `desktop/server/server.cjs` + `desktop/server/client/`
- Installer output: `release/LAN-Chess-Setup-<version>.exe`

## User data

Preferences, themes, game history, and statistics live in the app's browser
storage (Chromium profile inside `%APPDATA%/lan-chess`), never in the install
directory — uninstalling or updating the app preserves your data.

## Known limitations

- The installer is unsigned (SmartScreen warning on first run).
- Windows Firewall must be approved once per new server port.
- Client-isolated networks (college/public Wi-Fi) block LAN play by policy.
