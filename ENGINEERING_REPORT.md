# LAN Chess — Engineering Report

**Date:** 2026-09-06 · **Branch:** `main` (all work in working tree; nothing committed by this pass)

---

# Executive Summary

This pass turned the previously-repaired LAN Chess codebase into a hardened, tested, and polished v1. Three parallel audits (client UI, server/security, persistence/services) surfaced **40+ concrete defects**; the highest-impact ones — multiplayer integrity bugs that could flip game results, crash entire views, or drop live connections mid-game — are all fixed and covered by tests. A final defect-first review of the new code found **6 more findings (1×P1, 2×P2, 3×P3), all fixed and re-verified**.

**Final state:** 91/91 tests pass · `tsc --noEmit` clean (client + server) · production build green (typecheck-gated) · `npm audit` 0 vulnerabilities · production server boots and serves · full multiplayer, chat, clocks, and Stockfish review verified live in a real browser.

# Research

Research was grounded in the repository itself and in primary sources where decisions depended on them:

- **Stockfish/UCI behavior** — empirically probed the bundled engine (version, nps, perspective semantics, `Contempt` default, `searchmoves` support, `stop`→`bestmove` latency) with sandboxed harnesses before designing the lifecycle. This is why `Contempt 0` is set at init and why played moves are measured with `go depth D searchmoves <uci>` from the same position (perspective-safe by construction).
- **Socket.IO semantics** — verified `socket.use` middleware ordering, reconnect/ping-timeout windows (motivating the stale-socket disconnect guard), and that dropping events without `next()` is safe for this client's ack-free emits.
- **chess.js 1.4** — verified SAN output (`O-O`, `e8=Q+`), FEN serialization (en-passant field omitted when no capture exists — corrected earlier test fixtures), and PGN header defaults (`White "?"`, `Result "*"`) which motivated explicit `setHeader` calls.
- **Web Worker/environment** — confirmed the WASM build needs no SharedArrayBuffer/COOP-COEP; asm.js vs WASM performance measured (~10k vs ~330k nps).
- **typescript-eslint compatibility** — verified it requires TypeScript `< 6.1` while this toolchain runs TS 7; ESLint was therefore *not* added (see `questions.md`).

# Problems Found

**CRITICAL**
- One corrupted localStorage record crashed the whole Archives/Statistics view (`computePlayerStats` dereferenced unvalidated fields); game history, preferences, and custom themes were loaded with no validation.
- Server: the abandonment grace timer could **overwrite a finished game's result** (winner flip) if the game ended during the window.
- Server: a player leaving an active game created a **zombie seat** — clock kept ticking toward a loss for the remaining player and the seat could never be refilled.

**HIGH**
- Toggling any sound setting **disconnected the socket mid-game** (socket effect depended on the `preferences.sound` object).
- Reconnecting players were **charged for offline time** (clock pause never compensated).
- A move attempt that flagged the mover on time finished the room **without broadcasting** — the opponent never learned the game ended.
- `PuzzlePlayer` puzzle 4 was **unsolvable** (illegal position, wrong solution — verified against chess.js).
- Production static-directory resolution risk (auditor claimed source-dir serving — disproven by verification: resolves correctly to `dist/client`; documented to prevent regression).
- PGN exports had no real headers (`White "?"`, `Result "*"` always).

**MEDIUM**
- 1 Hz ticker re-broadcast full game state (entire move history + chat) to every timed room every second.
- Unthrottled state-changing handlers + no room cap → broadcast-flood and memory-growth surface.
- Stale-socket disconnects could mark live players disconnected (winner awarded to the opponent of a sitting player) — caught by the final review (P1).
- Interleaved disconnects could cancel the remaining player's abandonment timer and overcharge the active player's clock (P2s from final review).
- Modal focus/Escape unmanaged; chessboard had invalid ARIA grid structure and no keyboard navigation; light theme contrast ~2.5–4:1 in panels.
- `sound.volume` preference was dead; a fake "Analysis Depth" control did nothing; clipboard copy threw on LAN (insecure origin); Black players saw the opponent's name on their own card; sounds went silent after leaving a game; `Date.now()`-based IDs could collide.
- Dependencies declared as `"latest"` across the board.

# Fixes Implemented

**Server (all server-authoritative, nothing weakened)**
- Abandonment timer guards against overwriting results and self-cleans its map entry; waiting rooms with no host are reclaimed after the grace period (unless spectators watch); `MAX_ROOMS` cap; `NaN`-safe env parsing.
- Leaving an active game is an explicit forfeit (win awarded, seat stays occupied, game locked); leaving a waiting room still frees the seat.
- Clock accounting: pause marker (`disconnectedAt`) set on disconnect; `resumeClocks` shifts the turn timer only when **both** seats are reconnected; `rejoinPlayer` reschedules the grace timer onto a still-absent player so interleaved disconnects never strand anyone timer-less.
- Stale-socket protection: disconnect handlers verify socket ownership; `identify-session` evicts the previous socket from the room and clears its session data.
- Timeout-on-move broadcasts the finished state; flood limiter (80 events/s/socket); rematch/draw/takeback no-op early-returns; chat length pre-checked before sanitization; board coordinates normalized to lowercase.
- Takeback integrity: requesters who haven't moved are rejected; responses after game end are refused.
- New `clock-update` event replaces full-state 1 Hz broadcasts; chat messages carry `senderSessionId`.

**Client**
- Data safety: per-record validation for game history (invalid records dropped, quota errors surfaced), field-type validation + coercion for preferences and custom themes (invalid colors replaced, incomplete themes dropped), deterministic statistics tie-breaks, `null` winner ≠ loss, empty-name guard.
- Socket effect rewritten around refs: no more mid-game disconnects; `clock-update` merges into state without clobbering; room transitions reset sound tracking via a `-1` sentinel (also now saves games when reconnecting into an already-finished match).
- Real PGN headers (`White`/`Black`/`Result`/`Termination`) on both save paths; per-move replay isolation so a bad move can't silently drop a saved game.
- A11y: chessboard got proper `role="row"` structure (`display: contents` preserves layout), `aria-selected`, state-rich square labels (check/selected/legal/last-move), arrow-key navigation, visible focus ring; `role="alert"`/`aria-live` banners; modal hook providing Escape, focus trap, initial focus, and focus return (Settings, Position Setup, Game Over).
- Board interaction: drag/drop gated on interactivity and validated to this board's squares; stale right-click arrow anchors cleared on mouse leave.
- Review/sandbox: engine work cancelled on unmount; sandbox correlates eval results to the displayed FEN; memo-stable empty legal-target map; memoized opening/capture calculations.
- Puzzle 4 fixed and verified; puzzle attempts run on a scratch board (no in-place mutation) with illegal-move feedback; orientation no longer flips mid-solution.
- Volume preference wired into WebAudio (with cache invalidation); dead `gameStart` pref removed; dead fake depth control removed and honestly explained; master-volume slider added; clipboard fallback for insecure origins; collision-proof theme IDs; hex validation in the board builder; light-theme panel contrast remapped to WCAG-AA-readable tones.

**Tooling**
- All dependency versions pinned to real semver ranges; lockfile regenerated (`stockfish.js` entry repaired); `typecheck` script added and wired into `npm run build`.

# Architecture Improvements

- **Engine service** (`stockfish-engine.ts`): strict state machine — single permanent message listener, FIFO search mutex, per-search quiescence cooldown (stale-output immunity), session tokens invalidating cancelled analyses, terminate-on-cancel/safety-timeout (no leaked workers or unresolved promises; the post-quiescence window is explicitly checked after review).
- **Server room lifecycle**: `rejoinPlayer`/`resumeClocks`/`scheduleWaitingRoomCleanup` centralize reconnect bookkeeping; every path (identify, join, spectate, leave, disconnect) flows through the same guarded logic.
- **Persistence layer**: load-time validation at every localStorage boundary (`game-history`, preferences, custom themes) — malformed data can degrade gracefully but never crash a view.
- **Build**: typecheck is part of `build`, so a "Vite passes but TS is broken" state is impossible.

# Multiplayer

Verified by 24 room-manager unit tests and a live two-browser-tab session against the production build:
- Room creation, join as Black, correct color assignment ✓
- Move sync both directions; turn enforcement (illegal move never applied) ✓
- Chat delivery with session-based "(You)" tagging ✓
- Server-authoritative clock ticking (only the active player's clock moves) ✓
- Forfeit-on-leave, abandonment winner-flip guard, timeout-finish broadcast, takeback edges, spectator capacity/rejoin, interleaved disconnects, room cap — all unit-tested ✓

# Chess

- Rules remain chess.js on both sides; the server re-validates every move in correct order (identity → turn → finished-state → disconnect → clock → legality).
- Castling/en passant/promotion unchanged; promotion values normalized; coordinates case-normalized.
- Opening recognition and new book-detection unit-tested (prefix matching over the openings table; common first moves recognized; off-book sequences rejected).

# Stockfish

Regression suite (29 tests) re-verified plus a live browser run on a seeded game:
- `1.e4` → Book (0 loss) · `1...e5` → Book · `2.Qh5` → Mistake (139cp) · `3...Nf6` → Blunder ?? (1038cp, dropped M#1) · `4.Qxf7#` → Brilliant
- 1.d4/1.Nf3/1.c4 are classified Book, never punished for the engine preferring e4 (the original reported bug).
- Perspective normalization, cp/mate parsing, cancellation, safety-timeout recovery, stale-output immunity, missing-bestmove → explicit "unavailable" — all covered by the scripted fake-worker tests.

# Themes

- Theme state remains fully separate from game state (localStorage only; never touches multiplayer).
- Custom themes now validated at load (required colors, sanitized values) and at save (hex pattern) — invisible squares from garbage input are impossible.
- Fallback theme resolved by id (not array position); unknown UI theme ids fall back to `dark` instead of unstyled DOM.
- Light theme panels made readable (contained CSS remap; full redesign noted as an option in `questions.md`).

# Game Review

- Replay/navigation/autoplay/keyboard controls verified; FEN reconstruction unit-tested; PGN/FEN tools now work on plain-HTTP LAN origins (clipboard fallback) and export properly-headered PGNs.
- Analysis remains fully isolated from live multiplayer state (client-side, operates on the saved-game snapshot only).
- Failure display is explicit ("Analysis unavailable", N/A fields, diagnostics with error reason) — no masking.

# Performance

- 1 Hz full-state broadcast → lightweight `clock-update` (the dominant steady-state cost for timed rooms).
- Early-returns on no-op rematch/decline paths; flood limiter caps per-socket event rate; chat length pre-check avoids regex-processing megabyte payloads.
- Client: memoized opening detection and capture summary; memo-stable empty `Map` for review board; engine searches cancelled on unmount (no orphaned workers burning CPU); no duplicate socket listeners (effect deps fixed).
- Server intervals unchanged in count; cleanup-timer map no longer grows with disconnects.

# Security

- Server authority intact and strengthened: identity, color, turns, legality, clocks, results, spectator restrictions all server-enforced (verified by tests + live play); clients cannot mutate state after game end.
- Input validation unchanged in strength; chat now length-checked *before* sanitization; board coordinates normalized; theme colors validated as hex/rgba only (no CSS injection surface); no `dangerouslySetInnerHTML`/`eval` anywhere (grep-verified).
- Flood limiter + room cap reduce abuse surface; stale-socket ownership checks prevent seat hijacking via reconnect races.
- `npm audit`: 0 vulnerabilities. No secrets, `.env`, or machine-specific files introduced; nothing committed by this pass.

# Testing

| Gate | Result |
| --- | --- |
| `npm test` | **91/91 pass** (9 files) — was 60/60 at baseline; +31 new (server lifecycle ×14, data-safety ×17) |
| `npm run typecheck` | Clean (client + server, strict) |
| `npm run build` | Green (typecheck-gated client build + server compile) |
| Lint | Not configured — intentionally (typescript-eslint incompatible with TS 7; see `questions.md`) |
| `npm audit` | 0 vulnerabilities |
| Manual (browser, production build) | Two-player room flow, move sync, illegal-move rejection, chat, clocks, board ARIA structure (8 rows/64 labeled cells), full engine analysis regression, zero console errors |

# Files Changed (this hardening pass)

- `server/room-manager.ts` — lifecycle integrity (forfeit, clocks, timers, caps, takeback guards)
- `server/index.ts` — stale-socket guards, socket eviction, flood limiter, clock-update ticker, timeout broadcast, chat identity/pre-check
- `shared/types.ts` — `clock-update` event, `ClockUpdate`, `ChatMessage.senderSessionId`, `connecting` status
- `client/App.tsx` — socket effect rewrite, sound-ref, clock merge, PGN headers, sentinel logic, a11y banners, memoization
- `client/services/stockfish-engine.ts` — post-quiescence worker check, dispose guard
- `client/services/game-history.ts` / `statistics.ts` / `preferences.ts` — validation layers
- `client/components/*` — Chessboard ARIA + drag gating, ChatPanel identity, GameReview/PracticeBoard lifecycle fixes, SettingsModal (volume, honest analysis tab, modal behavior), GameOverModal/PositionSetup focus, CustomBoardBuilder validation, PuzzlePlayer fixes
- `client/styles.css` — board rows/focus ring, light-theme contrast remap
- `client/utils/modal-behavior.ts` (new), `client/utils/sound.ts` (volume)
- `package.json` / `package-lock.json` — pinned versions, typecheck wiring
- `README.md` (rewritten), `CHANGELOG.md`, `questions.md`, `ENGINEERING_REPORT.md` (this file)
- Tests: `server/room-manager.test.ts` (+14), `client/services/game-history.test.ts` (new, 6), `preferences.test.ts` (+4), `statistics.test.ts` (+3), `openings.test.ts` (+4)

# Questions

See `questions.md` — four non-blocking items: light-theme scope (contained remap implemented; full redesign available on request), ESLint deferred (TS 7 incompatibility), leftover `test_sf.cjs` probe (recommend deletion, kept pending your call), and the LAN session-identity trust model (documented, unchanged).

# Remaining Limitations

- Multiplayer state is in-memory; a server restart clears rooms (by design for v1).
- Single grace timer per room: with three rapid disconnect events, timers are rescheduled onto the currently-absent player — correct in all traced paths, but the design assumes ≤2 players (true for chess).
- The 2019 Stockfish build remains shallow-depth noisy in openings; book detection covers the common cases, and deeper engines are a future upgrade path.
- Session identity over plaintext LAN WebSocket is trust-on-network (documented in `questions.md` Q4).

# Recommended Future Work

1. Add ESLint when typescript-eslint supports TypeScript 7 (flat config, `react-hooks/exhaustive-deps` as warn).
2. Consider a newer single-threaded Stockfish WASM (16.x) for better opening calibration — the service's UCI lifecycle already supports it.
3. Optional: draw-offer cancellation and counter-offer auto-acceptance (current behavior is safe, just minimal).
4. PWA manifest/service worker for LAN installability (fits the offline philosophy).
5. Win-percentage-based accuracy curve once analysis data justifies recalibration (thresholds deliberately untouched this pass).
