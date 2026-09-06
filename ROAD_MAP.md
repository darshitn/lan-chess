# ♟ LAN Chess — Development Roadmap

A phase-wise development roadmap for the LAN Chess project.

The project is designed to provide a **real-time multiplayer chess experience over a local network**, without requiring chess.com or an external multiplayer server.

---

# Project Status

| Phase    | Feature                  | Status     |
| -------- | ------------------------ | ---------- |
| Phase 0  | Project Foundation       | ✅ Complete |
| Phase 1  | Chessboard & Chess Logic | ✅ Complete |
| Phase 2  | LAN Multiplayer          | ✅ Complete |
| Phase 3  | Reconnection & Sessions  | ✅ Complete |
| Phase 4  | Chess Clocks             | ✅ Complete |
| Phase 5  | Game Lifecycle           | ⬜ Pending  |
| Phase 6  | Custom Themes            | ⬜ Pending  |
| Phase 7  | Game Review & Replay     | ⬜ Pending  |
| Phase 8  | Stockfish Analysis       | ⬜ Pending  |
| Phase 9  | Chat & UI Polish         | ⬜ Pending  |
| Phase 10 | Spectator Mode           | ⬜ Pending  |
| Phase 11 | Security & Reliability   | ⬜ Pending  |
| Phase 12 | LAN Deployment & Release | ⬜ Pending  |

---

# Phase 0 — Project Foundation

### Status: ✅ Complete

## Goal

Create the basic project architecture.

## Technology

* React
* TypeScript
* Vite
* Node.js
* Express
* Socket.IO
* chess.js
* Tailwind CSS

## Completed Features

* Frontend setup
* Backend setup
* TypeScript configuration
* Client/server separation
* Basic Socket.IO setup
* LAN server foundation
* Development scripts
* Basic home page

---

# Phase 1 — Chessboard & Chess Logic

### Status: ✅ Complete

## Goal

Create a fully functional local chessboard.

## Features

* Chessboard
* chess.js integration
* Legal move validation
* Click-to-move
* Drag-and-drop
* Captures
* Check
* Checkmate
* Stalemate
* Castling
* En passant
* Pawn promotion
* Move history
* Captured pieces
* Board flipping
* Player names
* Responsive board

---

# Phase 2 — LAN Multiplayer

### Status: ✅ Complete

## Goal

Allow two devices on the same local network to play against each other.

## Features

* Socket.IO multiplayer
* Room creation
* Room codes
* Join room
* Two-player rooms
* White/Black assignment
* Server-side chess validation
* Real-time move synchronization
* LAN IP detection
* LAN URL
* `0.0.0.0` server binding

## Basic Architecture

```text
Player 1
Browser
   │
   │ Socket.IO
   ▼
Node.js Server
   │
   │ chess.js
   │ Room Manager
   │
   ▼
Player 2
Browser
```

---

# Phase 3 — Reconnection & Persistent Sessions

### Status: ⬜ Pending

## Goal

Allow players to recover their game after refreshing or temporarily disconnecting.

## Features

* Persistent player/session ID
* localStorage session
* Server-side player association
* Reconnection
* Game-state restoration
* Room restoration
* Color restoration
* Move-history restoration
* Connection status
* Opponent disconnect notification
* Reconnection grace period
* Abandoned room cleanup

## Requirements

The Socket.IO socket ID must NOT be used as the permanent player identity.

Use:

```text
sessionId
    ↓
player
    ↓
room
    ↓
color
```

---

# Phase 4 — Chess Clocks

### Status: ⬜ Pending

## Goal

Add real-time chess clocks.

## Time Controls

Initially support:

* Unlimited
* 3 + 0
* 5 + 0
* 10 + 0

Later:

* 3 + 2
* 5 + 3
* 10 + 5
* 15 + 10

## Features

* White clock
* Black clock
* Active-player indicator
* Low-time warning
* Timeout detection
* Server-authoritative timing
* Clock restoration after reconnect

## Important

The server must determine when time expires.

The client must not be trusted to determine the winner by timeout.

---

# Phase 5 — Complete Game Lifecycle

### Status: ⬜ Pending

## Goal

Handle every normal way a chess game can end.

## Features

### Resignation

```text
[ Resign ]
```

With confirmation.

### Draw

```text
Offer Draw
Accept Draw
Decline Draw
```

### Game Ending

Support:

* Checkmate
* Stalemate
* Timeout
* Resignation
* Draw agreement
* Insufficient material
* Other draw conditions supported by chess.js

## Game Over Screen

Display:

```text
GAME OVER

Winner: White

Reason: Checkmate

[ REMATCH ]
[ HOME ]
```

## Rematch

When both players request a rematch:

* Reset board
* Reset move history
* Reset clocks
* Create new game state
* Optionally swap colors

---

# Phase 6 — Custom Chess Themes

### Status: ⬜ Pending

## Goal

Allow each player to customize the visual appearance of their chess game.

---

## Board Themes

Initial themes:

* Classic
* Wood
* Dark Wood
* Marble
* Midnight
* Royal
* Neon
* Cyber
* Glass
* Minimal
* Golden

Each theme should control:

```text
lightSquare
darkSquare
selectedSquare
lastMoveSquare
legalMoveIndicator
checkSquare
```

---

## Chess Piece Themes

Initial piece sets:

* Classic
* Modern
* Minimal
* Staunton
* Wood
* Marble
* Royal
* Neon
* Cyber
* Premium

Piece assets should preferably be bundled locally.

---

## Premium-Style Themes

Create premium-looking locked themes such as:

```text
PREMIUM

Golden       🔒
Royal Gold   🔒
Obsidian     🔒
Cyber        🔒
```

No payment system is required.

These are only premium-style UI concepts for the current project.

---

## UI Themes

Support:

* Light
* Dark

Potential future themes:

* Midnight
* OLED
* Glass
* Cyber

---

## Theme Persistence

Store preferences using:

```text
localStorage
```

Each player can have a different theme.

Example:

```text
Player 1 → Wood
Player 2 → Midnight
```

Theme selection must never affect the actual chess game state.

---

# Phase 7 — Post-Game Review & Replay

### Status: ⬜ Pending

## Goal

Allow players to review the complete game after it ends.

After the game:

```text
GAME OVER

Darshit 1 - 0 Opponent

[ REVIEW GAME ]
```

---

## Move Replay

Allow:

* First move
* Previous move
* Next move
* Last move
* Play
* Pause

Example:

```text
◀ First
◀ Previous
▶ Next
▶ Last
▶ Play
```

---

## Board Navigation

When selecting a move:

* Display the corresponding board position
* Highlight the move
* Update captured pieces
* Update move list
* Update move number

Review mode must not modify the original completed game.

---

## Game Information

Display:

```text
White: Player 1
Black: Player 2

Result: 1 - 0
Reason: Checkmate

Time Control: 5 + 0

Moves: 42
```

Optionally:

* Game duration
* Opening
* Date
* PGN

---

# Phase 8 — Stockfish Game Analysis

### Status: ⬜ Pending

## Goal

Provide chess-engine analysis after a game ends.

Prefer running Stockfish locally so the feature remains compatible with the LAN/offline philosophy.

---

## Architecture

```text
Completed Game
      ↓
Move History / PGN
      ↓
Position Generator
      ↓
Stockfish
      ↓
Evaluation
      ↓
Compare Played Move
      ↓
Analysis
      ↓
Game Review
```

---

## Engine Analysis

For each move, provide:

* Evaluation
* Best move
* Played move
* Evaluation change
* Move classification

Example:

```text
Move 17: Qxd4?!

Inaccuracy

Best move:
Bxd4

Evaluation:
+0.8 → +0.1
```

---

## Move Classification

Possible classifications:

```text
Brilliant
Excellent
Good
Book
Inaccuracy
Mistake
Blunder
```

Use configurable engine-based thresholds.

Do not present classifications as official chess ratings.

---

## Accuracy

Calculate an estimated accuracy percentage.

Example:

```text
GAME ANALYSIS

White
Accuracy: 91.4%

Black
Accuracy: 84.7%
```

Clearly identify this as an application-generated metric.

---

## Analysis Summary

Example:

```text
WHITE

Accuracy: 91.4%

Brilliant: 1
Excellent: 8
Good: 19
Inaccuracies: 2
Mistakes: 1
Blunders: 0
```

---

## Evaluation Graph

Add an evaluation graph showing how the game changed over time.

Example:

```text
 +3 ┤             ╭────
 +2 ┤       ╭─────╯
 +1 ┤────╮──╯
  0 ┤    ╰──────────
 -1 ┤
 -2 ┤
    └────────────────
       Moves
```

Clicking a point should navigate to that move.

---

## Engine Controls

Allow:

```text
Engine:
Stockfish

Depth:
10
15
20
25

[ ANALYZE GAME ]
```

Use a sensible default depth.

Avoid extremely expensive analysis by default.

---

## Analysis Progress

Display:

```text
Analyzing game...

Move 18 / 42

████████████░░░░░░
```

Allow cancellation.

If Stockfish runs in the browser, use a Web Worker where appropriate.

---

# Phase 9 — Chat & UI Polish

### Status: ⬜ Pending

## Goal

Make the application feel like a polished chess platform.

## Chat

Add room-specific real-time chat.

Features:

* Real-time messages
* Message length limit
* Input sanitization
* Spam protection
* Room-specific messages

---

## UI Polish

Improve:

* Home screen
* Create room screen
* Join room screen
* Waiting screen
* Chessboard
* Player cards
* Clocks
* Move history
* Game-over screen
* Review screen
* Settings

Add:

* Dark mode
* Sound effects
* Animations
* Connection indicators
* Responsive mobile UI

Keep animations lightweight.

---

# Phase 10 — Spectator Mode

### Status: ⬜ Pending

## Goal

Allow additional users to watch an ongoing game.

## Spectators Can

* View board
* View moves
* View clocks
* View players
* View game status
* Use chat

## Spectators Cannot

* Move pieces
* Resign
* Offer draws
* Modify game state
* Change player colors

The server must enforce these permissions.

---

# Phase 11 — Security & Reliability Audit

### Status: ⬜ Pending

## Goal

Perform a final security and reliability review.

---

## Server Authority

Verify that clients cannot:

* Make illegal moves
* Move for opponents
* Modify clocks
* Change colors
* Join full rooms
* Modify other rooms
* Perform actions after game end
* Impersonate players

---

## Input Validation

Validate and sanitize:

* Player names
* Room codes
* Chat messages
* Socket payloads

Add reasonable length limits.

---

## Network Testing

Test:

* Disconnect
* Reconnect
* Refresh
* Duplicate connections
* Invalid rooms
* Full rooms
* Abandoned rooms
* Server restart

---

## Chess Testing

Test:

* Check
* Checkmate
* Stalemate
* Castling
* En passant
* Promotion
* Draw
* Resignation
* Timeout

---

## Performance

Check for:

* Memory leaks
* Duplicate Socket.IO connections
* Unnecessary React re-renders
* Excessive socket events
* Unnecessary network traffic

---

# Phase 12 — LAN Deployment & Release

### Status: ⬜ Pending

## Goal

Make LAN Chess easy to run and distribute.

---

## One-Command Startup

Prefer:

```bash
npm run lan
```

This should ideally:

1. Start the server.
2. Detect the local IP.
3. Display the LAN URL.
4. Display connection instructions.

Example:

```text
================================
        LAN CHESS SERVER
================================

Server: ONLINE

LAN URL:
http://192.168.1.25:3000

Share this URL with friends
connected to the same Wi-Fi.
================================
```

---

# README

The GitHub README should contain:

## Overview

What LAN Chess is.

## Features

List the major features.

## Screenshots

Show the application.

## Architecture

Explain:

```text
React
  ↓
Socket.IO
  ↓
Node.js
  ↓
chess.js
```

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Production

```bash
npm run build
npm start
```

## LAN Usage

Explain how two devices connect.

## Troubleshooting

Explain:

* Firewall
* Wi-Fi connection
* Wrong IP address
* Port issues
* College Wi-Fi client isolation

Important:

The application does not bypass network security restrictions.

---

# Future Version 2 Ideas

These should NOT be implemented until Version 1 is stable.

## Online Multiplayer

Allow friends to play over the internet.

```text
Player
   ↓
Internet
   ↓
Cloud Server
   ↓
Opponent
```

---

## Accounts

Potential features:

* Sign up
* Login
* Profile
* Game history
* Statistics
* Ratings

---

## Persistent Database

Potential technology:

* PostgreSQL
* MongoDB

Store:

* Users
* Games
* PGNs
* Statistics
* Preferences

---

## AI Opponent

Add:

```text
PLAY

[ Friend ]
[ LAN ]
[ AI ]
```

Use Stockfish for local AI games.

---

## Advanced Analysis

Potential features:

* Opening detection
* Opening database
* Best-line explorer
* Blunder explanations
* Tactical insights
* Game summaries
* Position analysis

---

# Development Principles

## 1. Working > Feature Count

A reliable feature is more valuable than ten broken features.

## 2. Server Authority

The server is authoritative for multiplayer game state.

## 3. Offline-Friendly

Core LAN chess should not depend on the internet.

## 4. Modular Architecture

New features should not require rewriting existing systems.

## 5. Test Before Expanding

Every phase should be tested before beginning the next phase.

## 6. Keep Dependencies Reasonable

Do not add libraries unless they provide meaningful value.

---

# Current Target

The immediate objective is:

```text
Phase 0 ✅
      ↓
Phase 1 ✅
      ↓
Phase 2 ✅
      ↓
Phase 3
      ↓
Phase 4
      ↓
Phase 5
      ↓
Phase 6 🎨
      ↓
Phase 7 🔍
      ↓
Phase 8 🧠
      ↓
Phase 9
      ↓
Phase 10
      ↓
Phase 11
      ↓
Phase 12 🚀
```

The final Version 1 goal is a **polished, reliable, offline-friendly LAN chess platform** with customizable themes and post-game analysis.
