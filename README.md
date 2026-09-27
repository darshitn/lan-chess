# LAN Chess — v1.2.0

LAN Chess is a local-network multiplayer chess game built with React, Vite, Express, Socket.IO, and chess.js — no external chess service required. Play over LAN with friends, or play offline against the built-in Stockfish engine.

## Features

### Play — LAN Multiplayer
- Real-time LAN multiplayer with visible LAN invitation: prominent room code, complete host LAN URL (e.g., `http://192.168.1.71:3001`), and clear 3-step connection instructions ("On another device connected to the same Wi-Fi, open this address and enter the room code"); never tells remote users to open localhost or 127.0.0.1.
- Resilient multi-tier clipboard copy: "Copy Link" and "Copy Full Invite" buttons backed by an Electron desktop IPC bridge (`desktop.copyText`), browser Clipboard API, and off-screen textarea fallback with accessible live-region status feedback.
- Responsive chessboard layout: `ResponsiveBoardFrame` with strict 8-row grid containment and container-query piece sizing eliminates rank 1 clipping, keeps the board and bottom player card above the fold on 1280×800 / 1366×768 desktop displays, and supports compact viewports (1024×680) with zero horizontal overflow and smooth vertical scrolling.
- Server-authoritative rules, turns, clocks, and results — the client never decides game state
- 10 time controls grouped by speed with **Fischer increments** (server-credited per move):
  - 🔥 Bullet: 1+0, 1+1, 2+1
  - ⚡ Blitz: 3+0, 3+2, 5+0
  - ⏱️ Rapid: 10+0, 10+5, 15+10
  - ∞ Casual: no clock
  - A "Recent" row remembers your last three presets
- **How the clocks work** (all server-side):
  - Base time counts down only while it is your turn; the increment is credited by the server immediately after each of your completed moves
  - Clocks pause while any player is disconnected, and offline time is never charged
  - The server decides flag-falls (running out of time) and awards the win — clients cannot affect the clock
  - Low-time formatting and per-second updates are broadcast from the server
- **Premoves**: queue a move while the opponent thinks (cyan ring markers); it auto-plays if still legal when your turn arrives, is discarded if made illegal, and can be cancelled (click target/origin again or Escape). Promotions auto-queen.
- Resign, draw offers (**with cancellation** — the offering player may rescind before the opponent responds), takebacks (server-mediated), rematch with color swap — all behind in-app confirmation dialogs that work in every browser
- Spectator mode (view + chat only; enforced server-side)
- Reconnection-safe sessions (30 s grace period, abandonment resolution)
- Room chat with sanitization, rate limiting, and session-based identity

### Play — vs Computer (offline)
- **Play vs Computer** accessible directly from the main lobby — no server required
- Choose **White, Black, or Random** colour before the game starts
- Five **difficulty levels** (Beginner → Master) backed by UCI capability probing — no fake Elo labels
- Engine running in a dedicated Web Worker via the bundled Stockfish WASM binary (same engine used for game review)
- Full cancellation via **worker termination and replacement**: a cancelled worker is immediately terminated and replaced so stale `bestmove` replies can never leak into subsequent searches
- Millisecond-precision offline clocks with Fischer increments; moves are rejected after the deadline regardless of interval timing
- **Engine error recovery**: thinking state cleared on failure; working **Restart Engine** action exposed to the user
- Completed games saved to history with valid PGN headers and full post-game review (Stockfish analysis, replay, eval graph)
- Board flip, themes, sounds, premoves, promotion dialog, and all chess.js game-ending rules fully preserved

### Review & train (all offline, client-side)
- Game history (last 50 games) with automatic saving and PGN/FEN tools (real PGN headers: players, result, termination)
- Post-game review with replay controls, keyboard navigation, and evaluation graph
- Stockfish analysis: per-move best move, centipawn loss, classification (brilliant → blunder), accuracy estimates, genuine openings-table "book" detection; engine failures are shown honestly, never masked
- Practice sandbox with position setup and live engine evaluation
- Puzzle trainer with **1,320 rated tactical puzzles** (Lichess CC0 database, bundled and validated offline), difficulty filters, and multi-move tactics where the opponent's replies play out
- **19 board themes** (13 free + 6 locked previews — including the gray "Stone" board), 8 piece sets, 5 highlight styles, **6 UI themes** (Dark Slate, Clean Light, Midnight Blue, OLED Black, Frosted Glass, Cyber Neon — full design-token restyling), custom board builder — all persisted locally and never affecting game state
- Local player statistics (win rate, openings, records)

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS
- **Backend:** Node.js + Express + Socket.IO (in-memory authoritative state)
- **Rules engine:** chess.js (validated on both sides; the server is authoritative)
- **Engine:** Stockfish (WASM build from `stockfish.js`) in a Web Worker with a strict search lifecycle
- **Tests:** Vitest (207 tests across 19 test files — server, client, desktop security, updater, offline engine & controller)

## Architecture

```text
Browser / Desktop App (React client)
  ├─ Socket.IO ⇄ Node.js server (authoritative: rooms, moves, clocks, results)
  │                 └─ chess.js re-validation of every move
  ├─ Stockfish WASM worker (game review & sandbox — never touches server state)
  └─ localStorage (preferences, themes, game history)
```

The server keeps all multiplayer state in memory and validates every action (identity, turn, legality, clock, capacity). Analysis and review operate only on completed game data in the browser.

## Running

### Web Development
```bash
npm install
npm run dev          # dev server (Vite on :5173, API/WS proxied to :3001)
```

### Web Production
```bash
npm run build        # typecheck + client bundle + server compile
npm start            # serves the built app on http://0.0.0.0:3001
```

The server prints the LAN URL (e.g. `http://192.168.1.25:3001`) — share it with anyone on the same network. Players can also join with the 4-character room code at any instance's URL.

### Desktop Application (Windows)
```bash
npm run electron:dev     # build and launch the Electron desktop shell
npm run electron:build   # build and generate the Windows NSIS installer
```
For detailed desktop architecture, see [DESKTOP_APP.md](DESKTOP_APP.md).

#### In-App Updates
The desktop app features background update checks via `electron-updater` and GitHub Releases, complete with download progress, differential blockmap transfers, and a user-controlled restart action. To prevent match disruption, update restarts are strictly locked out during active LAN or computer games.

> [!NOTE]
> **Bootstrapping Note for v1.1.0 / v1.1.1 Users**: Earlier versions (v1.1.0 and v1.1.1) did not bundle the in-app updater client. Existing users need one manual installer upgrade to v1.2.0 to bootstrap automated in-app updates. Local preferences, themes, and game archives are preserved across upgrades.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Concurrent dev server + client with hot reload |
| `npm test` | Vitest test suite (207 tests across 19 test files) |
| `npm run typecheck` | `tsc --noEmit` over the whole project |
| `npm run build` | Typecheck, then client + server production build |
| `npm run desktop:assets` | Stage bundled server and static client for Electron |
| `npm run electron:dev` | Build and open the desktop window |
| `npm run electron:build` | Build and produce the Windows NSIS installer |
| `npm run build:puzzles` | Regenerate the bundled puzzle library from a Lichess puzzle database dump (see `scripts/generate-puzzles.mjs`) |
| `npm start` | Serve the production build |

## Testing

```bash
npm test
```

Covers server game-lifecycle integrity (abandonment, forfeits, clock accounting incl. Fischer increments, timeouts, takebacks, spectator limits, room caps, time-control normalization, draw-offer cancellation authorization), input validation, chess helpers, openings/book detection, statistics, persistence corruption handling, desktop security and origin validation (URL navigation checks, CLI parameter validation, port fallback), the Stockfish pipeline (search lifecycle, score parsing, perspective normalization, cancellation, stop-and-drain stale-output immunity, FEN replay, best-move failure handling), and the offline computer-game controller (clock settlement, deadline rejection, between-tick moves, engine error recovery, cancellation sequencing).


## Troubleshooting

- **Other devices can't connect** — confirm both devices are on the same Wi-Fi/LAN, use the exact LAN URL printed by the server, and allow the port through the firewall. Some college/public Wi-Fi networks isolate clients from each other; that cannot be bypassed by the app.
- **Wrong IP shown** — if the machine has multiple adapters, verify the address matches the network your players are on.
- **Analysis seems slow** — depth 15 can take a few seconds per move; use Standard (12) or cancel via the button. Engine failures are shown as "Analysis unavailable" rather than fake results.
- **Sounds don't play at first** — browsers require user interaction before audio; click anywhere once.

## Limitations

- All multiplayer state is in-memory: a server restart clears active rooms.
- Analysis evals come from the bundled 2019 Stockfish build; opening-phase evals at low depth can be noisy (mitigated by genuine book detection).
- Player identity is a localStorage session id over plaintext WS — appropriate for a trusted home/college LAN.
