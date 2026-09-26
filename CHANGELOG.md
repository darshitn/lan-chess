# Changelog

All notable changes to LAN Chess are documented here.

## [1.1.1] — 2026-09-26

### Fixed — LAN Invitation & Host Link Visibility
- Prominently display the full host LAN URL (e.g. `http://192.168.1.71:3001`), 4-character room code, and 3-step connection instructions in the waiting panel.
- Remote users are explicitly directed to connect to the host's actual LAN IP rather than `localhost` or `127.0.0.1`.
- Added advisory guidance regarding client isolation on public and university Wi-Fi networks.
- Desktop layout places the invitation panel in the right sidebar column on viewports ≥1024px, preserving full board and player card visibility.

### Fixed — Multi-Tier Reliable Clipboard Actions
- Introduced resilient multi-tier copy mechanism for "Copy Link" and "Copy Full Invite":
  1. Desktop native IPC bridge via Electron preload (`window.desktop.copyText`) backed by `electron.clipboard.writeText` with safe 5,000-character payload length bounds.
  2. Modern browser `navigator.clipboard.writeText` with permission rejection fallback.
  3. Off-screen `<textarea>` `document.execCommand('copy')` fallback for insecure HTTP / LAN origins and older browsers.
- "Copy Link" copies the exact LAN URL; "Copy Full Invite" copies a structured message with the room code, LAN URL, and Wi-Fi instructions.
- Added accessible `role="status"` live region announcements for copy success ("LAN link copied", "Invite copied") and clear manual-selection guidance if copying is denied.

### Fixed — Responsive Chessboard & Viewport Layout
- Wrapped the chessboard in `ResponsiveBoardFrame` with strict 8-row grid containment (`grid-template-rows: repeat(8, minmax(0, 1fr))`) and container-query piece sizing.
- Eliminated rank 1 piece and coordinate clipping across all board themes and piece sets.
- Square sizing dynamically adapts to both viewport width and viewport height, keeping the board and bottom player card above the fold on standard desktop viewports (1280×800 and 1366×768) without vertical page overflow.
- Preserved zero horizontal overflow on compact viewports (1024×680) with smooth vertical scrolling to access lower controls.

### Tests & Tooling
- Test suite expanded from 153 → 184 tests across 17 test files (added unit tests for invite service, clipboard service, responsive board sizing, desktop preload security, and acceptance scripts).
- Acceptance script `scripts/test-acceptance.mjs` made portable with dynamic Chrome path detection and ignored output directories.
- Strengthened installed Electron acceptance test `scripts/test-installed-electron.mjs` with native OS clipboard verification for both copy actions and scroll reachability assertions at 1024×680.

## [1.1.0] — 2026-09-15

### Added — Play vs Computer (offline)
- Offline **Play vs Computer** mode accessible from the main lobby: choose White / Black / Random colour and one of five difficulty levels (Beginner → Master) before the match starts.
- Dedicated `ComputerPlayerService` wraps the bundled Stockfish WASM worker with typed worker termination and replacement cancellation: a cancelled search immediately terminates and replaces the worker, ensuring delayed `bestmove` replies can never resolve a later search.
- `ComputerGameController` drives a typed computer-game state machine with millisecond-precision clocks, per-increment accounting, and **deadline rejection**: moves are refused once the clock has expired regardless of whether the interval callback has fired.
- UCI capability probing at startup: only `Skill Level` (depth-capped) and `UCI_LimitStrength` / `UCI_Elo` are advertised if Stockfish reports supporting them — no fake difficulty labels.
- Engine error recovery: rejected `requestMove()` calls are caught in the controller; stale-game guards prevent state mutation after cancellation; a working **Restart Engine** recovery action is exposed to the user.
- Completed computer games are saved to game history with valid PGN headers (`[White]`, `[Black]`, `[Result]`, `[Termination]`, `[Mode "Computer"]`).
- Full game-review integration: post-game Stockfish analysis, replay, FEN/PGN export, and evaluation graph work identically to multiplayer games.
- Board flip, themes, sounds, premoves, promotion dialog, and all chess.js game-ending rules (checkmate, stalemate, insufficient material, 50-move rule, threefold repetition) preserved.
- Accessibility: `aria-live` status region announces engine thinking / result; keyboard-navigable board and focus-managed modals unchanged.

### Fixed — engine & clock hardening (correction pass)
- **Engine cancellation**: implemented worker termination and replacement on cancellation so no stale reply can corrupt a subsequent search (regression test included).
- **Clock correctness**: elapsed time is now settled for the active player before accepting any move (human or engine), applying increments, or changing turns; moves after the deadline are rejected even between interval ticks (regression tests for between-tick moves, delayed callbacks, and increments near timeout).
- **Engine error recovery**: `requestMove()` rejection is caught, stale-game guard applied, thinking state cleared, and recovery action surfaced — tested with an intentional worker failure scenario.
- **PGN export**: `[Event]`, `[Site]`, `[Date]`, and `[Mode]` headers added; duplicate-move crash on inconsistent replay fixed.

### Added — Draw Offer Cancellation (Milestone 4.1)
- New `cancel-draw` server event (`ClientToServerEvents`): only the **offering player** may cancel their own pending draw offer; opponents, spectators, and invalid sessions are rejected with typed error responses.
- `RoomManager.cancelDrawOffer()` clears `room.drawOfferBy` and broadcasts updated room state; disconnecting while holding a pending offer also clears it automatically.
- Client UI: **"Draw offer pending"** banner (`role="status"`, `aria-live="polite"`) with an accessible **Cancel draw offer** button; the Offer Draw action button toggles to **Cancel Draw** (amber-tinted) while an offer is live.
- 14 new server-side regression tests covering authorization (opponent cannot cancel, spectator cannot cancel, invalid session), lifecycle (offer cleared by move / decline / acceptance / rematch), and invalid-state transitions.

### Tests
- Test suite expanded from **112 → 153 tests** across **12 test files** (added `computer-player.test.ts`, `computer-game-controller.test.ts`, and expanded `room-manager.test.ts`).

### Documentation
- `CHANGELOG.md`, `README.md`, `AUDIT.md`, `DESKTOP_APP.md`, and `DESKTOP_RELEASE_REPORT.md` updated to reflect v1.1.0 scope.
- Deferred items recorded: game-history archive import/export, host-side logging, active-room persistence, ESLint integration, CI pipeline.

## [1.0.0] — 2026-09-15



First stable release.

### Multiplayer
- LAN play with rooms, spectators, chat (session identity), reconnection grace, server-authoritative rules/clocks/results
- 10 time controls grouped by speed with server-credited Fischer increments and remembered presets
- Takebacks, draw offers, resignations, and rematches (color swap) via in-app confirmation dialogs that work in every browser
- Premoves with cancel and legality re-checked at execution time

### Analysis & training
- Stockfish WASM game review: per-move best move, centipawn loss, classifications, accuracy, genuine book detection, honest failure states
- 1,320-puzzle rated tactics library (Lichess CC0) with difficulty filters and multi-move auto-replies
- Practice sandbox with live engine evaluation

### Desktop (Windows)
- Native Windows desktop application packaging via Electron 44 and electron-builder 26 with 0 vulnerabilities
- Standalone NSIS installer (`release/LAN-Chess-Setup-1.0.0.exe`) bundling the authoritative Express/Socket.IO server and static client with zero global Node/dependency requirements
- Desktop security hardening: exact origin matching on navigation, strict `--connect` host/port validation, safe external URL opening, and process lifecycle cleanup
- Automated test suite expanded to 112 tests across 10 test files

### Platform
- 19 board themes, 8 piece sets, 5 highlight styles, 6 full UI themes, custom board builder — persisted locally
- Game history with real PGN headers; player statistics
- Accessibility: keyboard-navigable board, focus-managed modals, live-region announcements
- Server integrity: forfeit-on-leave, abandonment guards, reconnect clock accounting, flood limits, room caps
- 112 automated tests; typecheck-gated production build; dependency versions pinned with 0 vulnerabilities

## [0.2.0] — 2026-09-06

### Added
- **Chess.com-style time-control picker** grouped by speed — Bullet (1+0, 1+1, 2+1), Blitz (3+0, 3+2, 5+0), Rapid (10+0, 10+5, 15+10), Casual (No Clock) — with a "Recent" row that remembers your last three presets.
- **True Fischer increment support** (server-authoritative): the mover's clock is credited the increment after each completed move (2+1 really gives 2 minutes plus 2 seconds per move).
- New **Stone** board theme (cool silver squares on warm stone gray).
- **1,320-puzzle tactics library** (from the Lichess open puzzle database, CC0): chess.js-validated slice filtered by rating (900–1900), popularity, and clean solutions; difficulty filters (Easy ≤1200 / Medium / Hard 1600+), per-puzzle rating and theme badges, and true multi-move tactics with the opponent's replies auto-played. Falls back to the built-in warm-up set offline. Regenerate with `npm run build:puzzles`.
- **Premoves**: queue a move while the opponent is thinking (click or drag; cyan ring marks origin/target). It auto-plays the instant your turn arrives if still legal, is discarded silently if the position changed made it illegal, and can be cancelled (click the target or origin again, press Escape, or queue a different premove). Premove promotions auto-queen. The server still validates every executed premove.

### Fixed
- **Resign / draw / takeback now work in every browser** (e.g. Arc, where native `window.confirm` is suppressed and silently blocked these actions). They use an in-app confirmation dialog with Escape-to-cancel and Cancel focused first.

### Fixed — multiplayer correctness (server-authoritative)
- **Abandonment race:** the reconnect grace timer no longer overwrites a result recorded during the grace window (previously, resigning while the opponent was disconnected could flip the winner 30 seconds later).
- **Leaving an active game is now a forfeit:** the remaining player is awarded the win and the seat can never be refilled into a "zombie" game with a running clock.
- **Clock accounting across disconnects:** the turn timer is shifted by the paused duration on reconnect, so a reconnecting player is no longer charged for the time they were offline.
- **Timeout visibility:** when a move attempt flags the mover on time, the finished game state is broadcast immediately instead of being silently swallowed.
- **Ghost seats:** a socket identifying with a *different* session now leaves its previous seat cleanly.
- **Waiting-room reclamation:** a host who creates a room and vanishes has their lobby room destroyed after the grace period; fired cleanup timers no longer leak map entries.
- **Resource limits:** room creation is capped (`MAX_ROOMS`, default 200); environment overrides for grace period/spectator caps are sanitized against `NaN`.
- **Flood protection:** per-socket event budget (80/sec) plus early-returns on no-op rematch requests protect room broadcasts from spam.

### Changed — multiplayer protocol
- Clocks now tick via a lightweight `clock-update` event. The 1 Hz ticker no longer re-broadcasts the full game state (entire move history + chat) every second.
- Chat messages carry `senderSessionId`; the client tags "(You)" by session identity instead of display name (colliding names no longer mis-tag).
- Takebacks: a player who has not yet moved cannot request one (it would erase the opponent's move), and responses after game end are refused.

### Fixed — game review & analysis
- Engine pipeline unchanged (Stockfish WASM lifecycle, contempt 0, same-position `searchmoves` measurement); all regression tests re-verified in-browser.
- Board ARIA: proper `row` structure, `aria-selected`, state-rich square labels (check/selected/legal/last-move), arrow-key navigation, visible focus ring.
- Analysis cancels on unmount from review/sandbox; sandbox correlates engine results to the displayed FEN (no stale eval overwrite).
- Game review list no longer allocates a new `Map` per render (memo-friendly board).

### Fixed — data safety (localStorage)
- **Corrupted records no longer crash views:** game history validates each record at load (the known "one bad entry kills the Archives view" crash), preferences and custom themes are field-validated with safe coercion, and invalid theme colors are rejected/replaced.
- Statistics: malformed records skipped, `null` winner no longer counted as a loss, empty player name returns zeroed stats, deterministic opening tie-break.
- PGN exports now carry real `White`/`Black`/`Result`/`Termination` headers (previously always `White "?"`, `Result "*"`); finished games save even if move replay hits an inconsistent move.
- Clipboard copy falls back to `execCommand` on insecure (LAN/HTTP) origins instead of throwing.

### Fixed — client bugs
- Toggling any sound setting no longer disconnects/reconnects the socket mid-game (sound prefs read through a ref).
- Black players now see their own name (not the opponent's) on their player card; disconnect warning targets the right card.
- Move/capture/check sounds no longer go silent for the second game after leaving one (sound refs reset on room transitions), and rejoining a room no longer replays a spurious sound for an old move.
- Puzzle 4 ("Smothered Checkmate") was unsolvable (illegal position, wrong solution) — fixed and verified with chess.js; puzzle attempts are now simulated on a scratch board (no in-place mutation) and illegal moves give feedback.
- Sandbox board evaluates the position it displays (stale engine results discarded); volume preference is now honored by the WebAudio synthesis.
- Dead "Analysis Depth" fake control removed from Settings (the real one lives in game review) and replaced with an honest explanation; a real master-volume slider was added.
- Connection badge gains a real `connecting` state; error and status banners announce via `role="alert"`/`aria-live`.
- Modals (Settings, Position Setup, Game Over) now manage focus: Escape to close (where appropriate), focus trap, focus return.

### Improved
- **Application UI themes now actually restyle the app.** All six themes (Dark Slate, Clean Light, Midnight Blue, OLED Black, Frosted Glass, Cyber Neon) drive a design-token layer that remaps the app's surfaces, borders, text, and accent colors; Frosted Glass adds real backdrop blur and Cyber Neon switches accents to cyan. Previously only the page background and panel fill changed.
- Light UI theme keeps readable contrast inside panels (dark-theme text utilities remapped to dark-on-white equivalents).
- Dependency versions pinned to concrete semver ranges (was `latest` everywhere); `package-lock.json` regenerated and `npm audit` clean (0 vulnerabilities).
- Drag-and-drop only accepts this board's squares and is gated on interactivity; right-click arrow drawing no longer leaves stale anchors.
- `npm run typecheck` script added; `npm run build` runs typecheck before bundling.
- `vite.config.ts` types vitest config properly (`vitest/config` import) instead of `@ts-ignore`.

## [0.1.1] — 2026-09-06

### Fixed — Stockfish game review (major repair)
- Root-caused and fixed the broken analysis pipeline: proper UCI search lifecycle (no overlapping searches, no stale output), WASM engine (~32× faster), `Contempt 0`, same-position `searchmoves` measurement of played moves, genuine openings-table book detection, and no masking of engine failures ("Analysis unavailable" instead of fake best moves).
- The previously reported bug is gone: 1.d4 is classified Book (~0.2 measured loss) instead of "Mistake −1.26".

## [0.1.0] — initial release

- LAN multiplayer, rooms, spectators, reconnection grace, server-side clocks, draw/resign/takeback/rematch, chat, themes, game history, review/replay, Stockfish analysis, puzzles, sandbox.
