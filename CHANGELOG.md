# Changelog

All notable changes to LAN Chess are documented here.

## [0.2.0] — 2026-09-06

### Added
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
