import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimeControl } from '../shared/types.js';
import { RoomManager, RECONNECT_GRACE_PERIOD_MS, timeControlToMs } from './room-manager.js';

function createGameOrFail(
  mgr: RoomManager,
  playerName: string,
  sessionId: string | null | undefined,
  timeControl?: TimeControl,
  socketId: string | null = null
) {
  const result = mgr.createGame(playerName, sessionId, timeControl, socketId);
  if ('error' in result) throw new Error(`createGame failed: ${result.error}`);
  return result;
}

describe('RoomManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a room with host as White and does not decrement clock before Black joins', () => {
    const mgr = new RoomManager();
    const { room, player } = createGameOrFail(mgr, 'Alice', null, '3+0', 'socket-1');

    expect(room.code).toBeDefined();
    expect(room.white?.sessionId).toBe(player.sessionId);
    expect(room.white?.name).toBe('Alice');
    expect(room.black).toBeNull();
    expect(room.whiteTimeMs).toBe(3 * 60 * 1000);
    expect(room.blackTimeMs).toBe(3 * 60 * 1000);

    const remaining = mgr.getRemainingTime(room, 'w');
    // Before Black joins, remaining time should NOT decrement!
    expect(remaining).toBe(3 * 60 * 1000);

    const state = mgr.stateFor(room);
    expect(state.status).toBe('waiting');
    expect(state.message).toBe('Waiting for opponent...');
  });

  it('allows a second player to join as Black and starts the match', () => {
    const mgr = new RoomManager();
    const { room } = createGameOrFail(mgr, 'Alice', 'session-1', '5+0', 'socket-1');
    const joinResult = mgr.joinGame(room.code, 'Bob', 'session-2', 'socket-2');

    expect('error' in joinResult).toBe(false);
    if ('error' in joinResult) return;

    expect(room.black?.name).toBe('Bob');
    expect(room.black?.color).toBe('b');

    const state = mgr.stateFor(room);
    expect(state.status).toBe('active');
    expect(state.whiteName).toBe('Alice');
    expect(state.blackName).toBe('Bob');
    expect(state.turn).toBe('w');
  });

  it('rejects joining when room is full or room does not exist', () => {
    const mgr = new RoomManager();
    const notFound = mgr.joinGame('NOPE', 'Charlie', 'session-3');
    expect('error' in notFound).toBe(true);

    const { room } = createGameOrFail(mgr, 'Alice', 'session-1');
    mgr.joinGame(room.code, 'Bob', 'session-2');
    const full = mgr.joinGame(room.code, 'Charlie', 'session-3');
    expect('error' in full).toBe(true);
  });

  it('executes legal moves and updates turn and board state', () => {
    const mgr = new RoomManager();
    const { room, player: white } = createGameOrFail(mgr, 'Alice', 'session-w-1', 'unlimited');
    const joinRes = mgr.joinGame(room.code, 'Bob', 'session-b-2');
    if ('error' in joinRes) throw new Error();

    // Legal move by White: e2 -> e4
    const res1 = mgr.makeMove(room, white.sessionId, 'e2', 'e4');
    expect(res1).toEqual({ success: true });
    expect(room.chess.turn()).toBe('b');

    // Trying to move again as White should fail
    const resWrongTurn = mgr.makeMove(room, white.sessionId, 'e4', 'e5');
    expect('error' in resWrongTurn).toBe(true);

    // Legal move by Black: e7 -> e5
    const res2 = mgr.makeMove(room, 'session-b-2', 'e7', 'e5');
    expect(res2).toEqual({ success: true });
    expect(room.chess.turn()).toBe('w');
  });

  it('does NOT deduct clock time on illegal moves', () => {
    const mgr = new RoomManager();
    const { room, player: white } = createGameOrFail(mgr, 'Alice', 'session-w-1', '3+0');
    mgr.joinGame(room.code, 'Bob', 'session-b-2');

    const initialWhiteMs = room.whiteTimeMs;
    // Illegal move: e2 -> e5 (pawns cannot jump 3 squares)
    const err = mgr.makeMove(room, white.sessionId, 'e2', 'e5');
    expect('error' in err).toBe(true);

    // Clock must not have been deducted!
    expect(room.whiteTimeMs).toBe(initialWhiteMs);
  });

  it('accepts uppercase board coordinates', () => {
    const mgr = new RoomManager();
    const { room, player: white } = createGameOrFail(mgr, 'Alice', 'session-w-1', 'unlimited');
    mgr.joinGame(room.code, 'Bob', 'session-b-2');

    const res = mgr.makeMove(room, white.sessionId, 'E2', 'E4');
    expect(res).toEqual({ success: true });
    expect(room.chess.turn()).toBe('b');
  });

  it("detects Scholar's Mate (Checkmate) and finishes game", () => {
    const mgr = new RoomManager();
    const { room, player: white } = createGameOrFail(mgr, 'Alice', 'session-w-1', 'unlimited');
    mgr.joinGame(room.code, 'Bob', 'session-b-2');

    mgr.makeMove(room, white.sessionId, 'e2', 'e4');
    mgr.makeMove(room, 'session-b-2', 'e7', 'e5');
    mgr.makeMove(room, white.sessionId, 'd1', 'h5');
    mgr.makeMove(room, 'session-b-2', 'b8', 'c6');
    mgr.makeMove(room, white.sessionId, 'f1', 'c4');
    mgr.makeMove(room, 'session-b-2', 'g8', 'f6');
    // Qxf7#
    mgr.makeMove(room, white.sessionId, 'h5', 'f7');

    expect(room.chess.isCheckmate()).toBe(true);
    expect(room.winner).toBe('w');
    expect(room.resultReason).toBe('Checkmate');

    const state = mgr.stateFor(room);
    expect(state.status).toBe('finished');
    expect(state.winner).toBe('w');
  });

  it('swaps colors and resets state on rematch agreement', () => {
    const mgr = new RoomManager();
    const { room } = createGameOrFail(mgr, 'Alice', 'session-w-1', '5+0');
    mgr.joinGame(room.code, 'Bob', 'session-b-2');

    mgr.finishRoom(room, 'w', 'Resignation');
    expect(room.resultReason).toBe('Resignation');

    room.rematchRequests.w = true;
    room.rematchRequests.b = true;

    const swapped = mgr.handleRematchAgreement(room);
    expect(swapped).toBe(true);

    // White should now be Bob (session-b-2) and Black Alice (session-w-1)
    expect(room.white?.sessionId).toBe('session-b-2');
    expect(room.white?.name).toBe('Bob');
    expect(room.black?.sessionId).toBe('session-w-1');
    expect(room.black?.name).toBe('Alice');

    // Fresh board and clocks
    expect(room.chess.history()).toHaveLength(0);
    expect(room.winner).toBeNull();
    expect(room.resultReason).toBeNull();
    expect(room.rematchRequests.w).toBe(false);
    expect(room.rematchRequests.b).toBe(false);
    expect(room.whiteTimeMs).toBe(5 * 60 * 1000);
  });

  it('correctly handles spectator limits and prevents spectators from moving', () => {
    const mgr = new RoomManager();
    const { room } = createGameOrFail(mgr, 'Alice', 'session-w-1');
    mgr.joinGame(room.code, 'Bob', 'session-b-2');

    const specResult = mgr.joinSpectator(room.code, 'Spectator1', 'session-spec-1');
    expect('error' in specResult).toBe(false);
    expect(room.spectators).toHaveLength(1);

    // Spectator cannot move
    const moveRes = mgr.makeMove(room, 'session-spec-1', 'e2', 'e4');
    expect('error' in moveRes).toBe(true);
  });

  it('lets a disconnected spectator rejoin their slot even when capacity is full', () => {
    const mgr = new RoomManager();
    const { room } = createGameOrFail(mgr, 'Alice', 'session-w-1');
    mgr.joinGame(room.code, 'Bob', 'session-b-2');

    for (let i = 0; i < 8; i++) {
      const res = mgr.joinSpectator(room.code, `Spec${i}`, `session-spec-${i}`);
      expect('error' in res).toBe(false);
    }
    expect(room.spectators).toHaveLength(8);

    // A new ninth spectator is rejected...
    const ninth = mgr.joinSpectator(room.code, 'Spec9', 'session-spec-9');
    expect('error' in ninth).toBe(true);

    // ...but a disconnected existing spectator rejoins their own slot.
    const rejoin = mgr.joinSpectator(room.code, 'Spec3', 'session-spec-3', 'socket-new');
    expect('error' in rejoin).toBe(false);
    expect(room.spectators).toHaveLength(8);
  });

  it('identifies and recovers existing player session', () => {
    const mgr = new RoomManager();
    const { room } = createGameOrFail(mgr, 'Alice', 'session-w-1');
    mgr.joinGame(room.code, 'Bob', 'session-b-2');

    // Simulate page refresh from Bob
    const reconnected = mgr.joinGame(room.code, 'Bob', 'session-b-2', 'socket-new');
    expect('error' in reconnected).toBe(false);
    if ('error' in reconnected) return;

    expect(reconnected.player.color).toBe('b');
    expect(reconnected.player.socketId).toBe('socket-new');
  });

  it('timeControlToMs produces correct millisecond limits', () => {
    expect(timeControlToMs('unlimited')).toBeNull();
    expect(timeControlToMs('3+0')).toBe(180000);
    expect(timeControlToMs('5+0')).toBe(300000);
    expect(timeControlToMs('10+0')).toBe(600000);
  });

  describe('game lifecycle integrity', () => {
    it('does not flip a finished result when the abandonment grace timer fires', () => {
      const mgr = new RoomManager();
      const { room } = createGameOrFail(mgr, 'Alice', 'session-w-1', '3+0');
      mgr.joinGame(room.code, 'Bob', 'session-b-2');

      // White disconnects, then Black resigns during the grace period.
      room.white!.disconnected = true;
      mgr.scheduleRoomCleanup(room, 'w', () => {});
      mgr.finishRoom(room, 'b', 'Bob resigned. Alice wins.');

      vi.advanceTimersByTime(RECONNECT_GRACE_PERIOD_MS + 1000);

      expect(room.winner).toBe('b');
      expect(room.resultReason).toBe('Bob resigned. Alice wins.');
    });

    it('finishes the game with a win for the remaining player when a player leaves mid-game', () => {
      const mgr = new RoomManager();
      const { room } = createGameOrFail(mgr, 'Alice', 'session-w-1', '3+0');
      mgr.joinGame(room.code, 'Bob', 'session-b-2');
      mgr.makeMove(room, 'session-w-1', 'e2', 'e4');

      mgr.leaveCurrentSession('session-w-1');

      expect(room.resultReason).toBeTruthy();
      expect(room.winner).toBe('b');
      expect(room.white).not.toBeNull(); // seat stays occupied by the record
      // The abandoned game must be over: no further moves accepted.
      const moveRes = mgr.makeMove(room, 'session-b-2', 'e7', 'e5');
      expect('error' in moveRes).toBe(true);
    });

    it('removes the seat without forfeiting when a player leaves a waiting room', () => {
      const mgr = new RoomManager();
      const { room } = createGameOrFail(mgr, 'Alice', 'session-w-1', '3+0');

      mgr.leaveCurrentSession('session-w-1');

      expect(room.resultReason).toBeNull();
      expect(room.white).toBeNull();
    });

    it('does not charge the reconnecting player for time spent disconnected', () => {
      const mgr = new RoomManager();
      const { room } = createGameOrFail(mgr, 'Alice', 'session-w-1', '3+0');
      mgr.joinGame(room.code, 'Bob', 'session-b-2');
      mgr.makeMove(room, 'session-w-1', 'e2', 'e4');

      // It is Black's turn; Black disconnects for 10 seconds.
      room.black!.disconnected = true;
      room.disconnectedAt = Date.now();
      vi.advanceTimersByTime(10_000);

      const rejoined = mgr.joinGame(room.code, 'Bob', 'session-b-2', 'socket-new');
      expect('error' in rejoined).toBe(false);

      const remaining = mgr.getRemainingTime(room, 'b');
      // Without the clock resume, Black would be charged the full 10s offline.
      expect(remaining).toBeGreaterThan(179_000);
      expect(remaining).toBeLessThanOrEqual(180_000);
      expect(room.disconnectedAt).toBeNull();
    });

    it('handles interleaved disconnects: the still-absent player keeps a grace timer and is not overcharged', () => {
      const mgr = new RoomManager();
      const { room } = createGameOrFail(mgr, 'Alice', 'session-w-1', '3+0');
      mgr.joinGame(room.code, 'Bob', 'session-b-2');
      mgr.makeMove(room, 'session-w-1', 'e2', 'e4'); // Black to move

      // White drops at t1 (clock pauses for everyone).
      room.white!.disconnected = true;
      room.disconnectedAt = Date.now();
      const turnStartAtPause = room.turnStartedAt;
      vi.advanceTimersByTime(5_000);

      // Black also drops at t2; the pause marker stays at t1.
      room.black!.disconnected = true;
      mgr.scheduleRoomCleanup(room, 'b', () => {});
      vi.advanceTimersByTime(10_000);

      // White returns first: clock must NOT resume (Black is still out) and
      // Black must still have a grace timer.
      const whiteBack = mgr.joinGame(room.code, 'Alice', 'session-w-1', 'socket-w-new');
      expect('error' in whiteBack).toBe(false);
      expect(room.disconnectedAt).not.toBeNull(); // pause window still open
      expect(room.turnStartedAt).toBe(turnStartAtPause); // no shift while someone is out
      expect(mgr.cleanupTimers.size).toBe(1); // timer now targets Black

      // Black returns at t3: now the clock resumes and covers the whole pause.
      vi.advanceTimersByTime(2_000);
      const blackBack = mgr.joinGame(room.code, 'Bob', 'session-b-2', 'socket-b-new');
      expect('error' in blackBack).toBe(false);
      expect(room.disconnectedAt).toBeNull();
      // ~17s pause shifted into turnStartedAt → Black's clock shows ~3:00 again.
      const remaining = mgr.getRemainingTime(room, 'w');
      expect(remaining).toBeGreaterThan(178_000);
      expect(mgr.cleanupTimers.size).toBe(0);
    });

    it('flags finished:true when a move attempt runs the mover out of time', () => {
      const mgr = new RoomManager();
      const { room, player: white } = createGameOrFail(mgr, 'Alice', 'session-w-1', '3+0');
      mgr.joinGame(room.code, 'Bob', 'session-b-2');

      room.whiteTimeMs = 0;
      room.turnStartedAt = Date.now();

      const res = mgr.makeMove(room, white.sessionId, 'e2', 'e4');
      expect('error' in res).toBe(true);
      if ('error' in res) expect(res.finished).toBe(true);
      expect(room.winner).toBe('b');
      expect(room.resultReason).toBe('Timeout');
    });

    it('rejects a takeback request from a player who has not moved', () => {
      const mgr = new RoomManager();
      const { room } = createGameOrFail(mgr, 'Alice', 'session-w-1', 'unlimited');
      mgr.joinGame(room.code, 'Bob', 'session-b-2');
      mgr.makeMove(room, 'session-w-1', 'e2', 'e4');

      // Black has not moved yet: a takeback could only erase White's move.
      const res = mgr.requestTakeback(room, 'session-b-2');
      expect(res.error).toBeTruthy();

      // White (who moved) may request.
      const ok = mgr.requestTakeback(room, 'session-w-1');
      expect(ok.error).toBeUndefined();
    });

    it('refuses takeback responses after the game has finished', () => {
      const mgr = new RoomManager();
      const { room } = createGameOrFail(mgr, 'Alice', 'session-w-1', 'unlimited');
      mgr.joinGame(room.code, 'Bob', 'session-b-2');
      mgr.makeMove(room, 'session-w-1', 'e2', 'e4');
      mgr.makeMove(room, 'session-b-2', 'e7', 'e5');

      const req = mgr.requestTakeback(room, 'session-w-1');
      expect(req.error).toBeUndefined();

      mgr.finishRoom(room, 'w', 'Black resigned.');
      const res = mgr.respondTakeback(room, 'session-b-2', true);
      expect(res.error).toBeTruthy();
      expect(room.chess.history()).toHaveLength(2); // board not rewound
    });

    it('destroys a waiting room whose host never returns', () => {
      const mgr = new RoomManager();
      const { room } = createGameOrFail(mgr, 'Alice', 'session-w-1', '3+0');

      mgr.scheduleWaitingRoomCleanup(room);
      vi.advanceTimersByTime(RECONNECT_GRACE_PERIOD_MS + 1000);

      expect(mgr.getRoom(room.code)).toBeUndefined();
    });

    it('keeps a waiting room whose host returned during the grace period', () => {
      const mgr = new RoomManager();
      const { room } = createGameOrFail(mgr, 'Alice', 'session-w-1', '3+0');

      mgr.scheduleWaitingRoomCleanup(room);
      vi.advanceTimersByTime(1000);
      mgr.clearRoomCleanup(room.code);
      vi.advanceTimersByTime(RECONNECT_GRACE_PERIOD_MS);

      expect(mgr.getRoom(room.code)).toBeDefined();
    });

    it('removes fired cleanup timers from the map (no timer leak)', () => {
      const mgr = new RoomManager();
      const { room } = createGameOrFail(mgr, 'Alice', 'session-w-1', '3+0');
      mgr.joinGame(room.code, 'Bob', 'session-b-2');

      room.white!.disconnected = true;
      mgr.scheduleRoomCleanup(room, 'w', () => {});
      expect(mgr.cleanupTimers.size).toBe(1);

      vi.advanceTimersByTime(RECONNECT_GRACE_PERIOD_MS + 1000);
      expect(mgr.cleanupTimers.size).toBe(0);
    });

    it('caps the total number of rooms', () => {
      const mgr = new RoomManager();
      for (let i = 0; i < 200; i++) {
        const res = mgr.createGame(`P${i}`, `session-create-${i}`);
        expect('error' in res).toBe(false);
      }
      const overflow = mgr.createGame('Overflow', 'session-create-overflow');
      expect('error' in overflow).toBe(true);
    });
  });
});
