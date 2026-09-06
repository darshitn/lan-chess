# LAN Chess

LAN Chess is a local-network multiplayer chess game built with React, Vite, Express, Socket.IO, and chess.js — no external chess service required.

## Features

### Play
- Real-time LAN multiplayer (rooms, room codes, LAN URL sharing)
- Server-authoritative rules, turns, clocks, and results — the client never decides game state
- Time controls: unlimited, 3+0, 5+0, 10+0, 15+10
- Resign, draw offers, takebacks (server-mediated), rematch with color swap
- Spectator mode (view + chat only; enforced server-side)
- Reconnection-safe sessions (30 s grace period, abandonment resolution)
- Room chat with sanitization and rate limiting

### Review & train (all offline, client-side)
- Game history (last 50 games) with automatic saving and PGN/FEN tools
- Post-game review with replay controls, keyboard navigation, and evaluation graph
- Stockfish analysis: per-move best move, centipawn loss, classification (brilliant → blunder), accuracy estimates, genuine openings-table "book" detection
- Practice sandbox with position setup and live engine evaluation
- Puzzle trainer and local player statistics
- Board themes, piece sets, highlight styles, UI themes, custom board builder — all persisted locally and never affecting game state

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS
- **Backend:** Node.js + Express + Socket.IO (in-memory authoritative state)
- **Rules engine:** chess.js (validated on both sides; the server is authoritative)
- **Engine:** Stockfish (WASM build from `stockfish.js`) in a Web Worker with a strict search lifecycle
- **Tests:** Vitest (90 tests across server and client logic)

## Architecture

```text
Browser (React client)
  ├─ Socket.IO ⇄ Node.js server (authoritative: rooms, moves, clocks, results)
  │                 └─ chess.js re-validation of every move
  ├─ Stockfish WASM worker (game review & sandbox — never touches server state)
  └─ localStorage (preferences, themes, game history)
```

The server keeps all multiplayer state in memory and validates every action (identity, turn, legality, clock, capacity). Analysis and review operate only on completed game data in the browser.

## Running

```bash
npm install
npm run dev          # dev server (Vite on :5173, API/WS proxied to :3001)
```

Production:

```bash
npm run build        # typecheck + client bundle + server compile
npm start            # serves the built app on http://0.0.0.0:3001
```

The server prints the LAN URL (e.g. `http://192.168.1.25:3001`) — share it with anyone on the same network. Players can also join with the 4-character room code at any instance's URL.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Concurrent dev server + client with hot reload |
| `npm test` | Vitest test suite |
| `npm run typecheck` | `tsc --noEmit` over the whole project |
| `npm run build` | Typecheck, then client + server production build |
| `npm start` | Serve the production build |

## Testing

```bash
npm test
```

Covers server game-lifecycle integrity (abandonment, forfeits, clock accounting, timeouts, takebacks, spectator limits, room caps), input validation, chess helpers, openings/book detection, statistics, persistence corruption handling, and the Stockfish pipeline (search lifecycle, score parsing, perspective normalization, cancellation, stale-output immunity, FEN replay, best-move failure handling) via a scripted fake UCI worker.

## Troubleshooting

- **Other devices can't connect** — confirm both devices are on the same Wi-Fi/LAN, use the exact LAN URL printed by the server, and allow the port through the firewall. Some college/public Wi-Fi networks isolate clients from each other; that cannot be bypassed by the app.
- **Wrong IP shown** — if the machine has multiple adapters, verify the address matches the network your players are on.
- **Analysis seems slow** — depth 15 can take a few seconds per move; use Standard (12) or cancel via the button. Engine failures are shown as "Analysis unavailable" rather than fake results.
- **Sounds don't play at first** — browsers require user interaction before audio; click anywhere once.

## Limitations

- All multiplayer state is in-memory: a server restart clears active rooms.
- Analysis evals come from the bundled 2019 Stockfish build; opening-phase evals at low depth can be noisy (mitigated by genuine book detection).
- Player identity is a localStorage session id over plaintext WS — appropriate for a trusted home/college LAN (see `questions.md`).
