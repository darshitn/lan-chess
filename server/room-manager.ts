import { randomBytes } from 'node:crypto';
import { Chess } from 'chess.js';
import type {
  CapturedPiece,
  ChatMessage,
  GameMove,
  GameResult,
  GameState,
  PlayerColor,
  PromotionPiece,
  TimeControl,
} from '../shared/types.js';
import {
  isChessSquare,
  MAX_ROOM_CODE_LENGTH,
  normalizePromotion,
  normalizeRoomCode,
  sanitizePlayerName,
  validateSessionId,
} from './validation.js';

export interface PlayerRecord {
  sessionId: string;
  name: string;
  socketId: string | null;
  color: PlayerColor;
  disconnected: boolean;
  joinedAt: number;
}

export interface SpectatorRecord {
  sessionId: string;
  name: string;
  socketId: string | null;
  joinedAt: number;
  disconnected: boolean;
}

export interface Room {
  code: string;
  chess: Chess;
  white: PlayerRecord | null;
  black: PlayerRecord | null;
  spectators: SpectatorRecord[];
  abandonedBy: PlayerColor | null;
  lastUpdated: number;
  timeControl: TimeControl;
  whiteTimeMs: number | null;
  blackTimeMs: number | null;
  turnStartedAt: number;
  disconnectedAt: number | null;
  timeoutColor: PlayerColor | null;
  winner: GameResult | null;
  resultReason: string | null;
  drawOfferBy: PlayerColor | null;
  takebackRequestedBy: PlayerColor | null;
  allowTakebacks: boolean;
  rematchRequests: Record<PlayerColor, boolean>;
  chatMessages: ChatMessage[];
}

export interface SessionRecord {
  roomCode: string;
  color?: PlayerColor;
  role: 'player' | 'spectator';
}

export const RECONNECT_GRACE_PERIOD_MS = positiveIntEnv('RECONNECT_GRACE_PERIOD_MS', 30000);
export const MAX_SPECTATORS = positiveIntEnv('MAX_SPECTATORS', 8);
export const MAX_ROOMS = positiveIntEnv('MAX_ROOMS', 200);
export const IDLE_ROOM_TTL_MS = 60 * 60 * 1000; // 1 hour

function positiveIntEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

export function createSessionId(): string {
  return `session-${randomBytes(12).toString('hex')}`;
}

const KNOWN_TIME_CONTROLS: readonly TimeControl[] = [
  'unlimited',
  '1+0', '1+1', '2+1',
  '3+0', '3+2', '5+0',
  '10+0', '10+5', '15+10',
];

export function normalizeTimeControl(value?: unknown): TimeControl {
  if (typeof value === 'string' && (KNOWN_TIME_CONTROLS as readonly string[]).includes(value)) {
    return value as TimeControl;
  }
  return '3+0';
}

function minutesOf(timeControl: TimeControl): number {
  const base = timeControl.split('+')[0];
  const parsed = Number(base);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
}

export function timeControlToMs(timeControl: TimeControl): number | null {
  if (timeControl === 'unlimited') return null;
  return minutesOf(timeControl) * 60 * 1000;
}

/** Fischer increment in milliseconds (0 for no-increment controls). */
export function incrementMsOf(timeControl: TimeControl): number {
  if (timeControl === 'unlimited') return 0;
  const inc = Number(timeControl.split('+')[1]);
  return Number.isFinite(inc) && inc > 0 ? inc * 1000 : 0;
}

export class RoomManager {
  readonly rooms = new Map<string, Room>();
  readonly sessionToRoom = new Map<string, SessionRecord>();
  readonly cleanupTimers = new Map<string, NodeJS.Timeout>();

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    do {
      code = '';
      for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.rooms.has(code));
    return code;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  getSession(sessionId: string): SessionRecord | undefined {
    return this.sessionToRoom.get(sessionId);
  }

  getRoomPlayer(room: Room, sessionId: string): PlayerRecord | null {
    if (room.white?.sessionId === sessionId) return room.white;
    if (room.black?.sessionId === sessionId) return room.black;
    return null;
  }

  getRoomSpectator(room: Room, sessionId: string): SpectatorRecord | null {
    return room.spectators.find((s) => s.sessionId === sessionId) ?? null;
  }

  getRemainingTime(room: Room, color: PlayerColor): number | null {
    if (room.timeControl === 'unlimited') return null;
    const baseTime = color === 'w' ? room.whiteTimeMs : room.blackTimeMs;
    if (baseTime === null) return null;

    // Clock only ticks when game is actively in progress with 2 players
    const isGameActive =
      room.black !== null &&
      !room.resultReason &&
      !room.timeoutColor &&
      !room.abandonedBy &&
      !room.white?.disconnected &&
      !room.black?.disconnected;

    if (!isGameActive) return baseTime;

    const activeColor = room.chess.turn();
    if (activeColor !== color) return baseTime;

    return Math.max(0, baseTime - (Date.now() - room.turnStartedAt));
  }

  stateFor(room: Room): GameState {
    const chess = room.chess;
    const timeControl = room.timeControl;
    const whiteTimeMs = this.getRemainingTime(room, 'w');
    const blackTimeMs = this.getRemainingTime(room, 'b');

    const moves: GameMove[] = chess.history({ verbose: true }).map((m) => ({
      from: m.from,
      to: m.to,
      san: m.san,
      color: m.color as PlayerColor,
      captured: m.captured as CapturedPiece | undefined,
      promotion: m.promotion as PromotionPiece | undefined,
    }));

    let status: GameState['status'] = 'active';
    let message = '';

    if (room.resultReason) {
      status = 'finished';
      message = room.resultReason;
    } else if (!room.black) {
      status = 'waiting';
      message = 'Waiting for opponent...';
    } else if (room.white?.disconnected || room.black?.disconnected) {
      status = 'waiting';
      const disc = room.white?.disconnected ? room.white.name : room.black?.name;
      message = `${disc ?? 'Opponent'} disconnected. Waiting for reconnection...`;
    } else {
      status = chess.isGameOver() ? 'finished' : 'active';
      if (room.drawOfferBy) {
        const who = room.drawOfferBy === 'w' ? (room.white?.name ?? 'White') : (room.black?.name ?? 'Black');
        message = `Draw offered by ${who}.`;
      } else if (chess.isCheckmate()) {
        const winner = chess.turn() === 'w' ? 'Black' : 'White';
        message = `Checkmate — ${winner} wins.`;
      } else if (chess.isStalemate()) {
        message = 'Stalemate — the game is drawn.';
      } else if (chess.isThreefoldRepetition()) {
        message = 'Draw by threefold repetition.';
      } else if (chess.isInsufficientMaterial()) {
        message = 'Draw by insufficient material.';
      } else if (chess.isDrawByFiftyMoves()) {
        message = 'Draw by the fifty-move rule.';
      } else if (chess.isCheck()) {
        message = `${chess.turn() === 'w' ? (room.white?.name ?? 'White') : (room.black?.name ?? 'Black')} is in check.`;
      } else {
        const turnName = chess.turn() === 'w' ? (room.white?.name ?? 'White') : (room.black?.name ?? 'Black');
        message = `${turnName} to move.`;
      }
    }

    return {
      roomCode: room.code,
      fen: chess.fen(),
      moves,
      whiteName: room.white?.name ?? 'White',
      blackName: room.black?.name ?? null,
      turn: chess.turn() as PlayerColor,
      status,
      message,
      timeControl,
      whiteTimeMs,
      blackTimeMs,
      winner: room.winner,
      reason: room.resultReason,
      drawOfferBy: room.drawOfferBy,
      takebackRequestedBy: room.takebackRequestedBy,
      allowTakebacks: room.allowTakebacks,
      rematchRequests: { ...room.rematchRequests },
      chatMessages: room.chatMessages,
      spectatorCount: room.spectators.length,
    };
  }

  clearRoomCleanup(roomCode: string) {
    const timer = this.cleanupTimers.get(roomCode);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(roomCode);
    }
  }

  scheduleRoomCleanup(room: Room, disconnectedColor: PlayerColor, onAbandonment: (room: Room) => void) {
    this.clearRoomCleanup(room.code);
    const timer = setTimeout(() => {
      this.cleanupTimers.delete(room.code);
      const currentRoom = this.rooms.get(room.code);
      if (!currentRoom) return;

      // The game may have ended during the grace period (resignation, checkmate,
      // timeout): never overwrite a recorded result.
      if (currentRoom.resultReason) return;

      const disconnectedPlayer = disconnectedColor === 'w' ? currentRoom.white : currentRoom.black;
      if (!disconnectedPlayer || !disconnectedPlayer.disconnected) return;

      // Both players disconnected and never returned
      if (currentRoom.white?.disconnected && currentRoom.black?.disconnected) {
        this.destroyRoom(currentRoom.code);
        return;
      }

      // One player abandoned: award win to remaining connected player!
      const remainingColor: PlayerColor = disconnectedColor === 'w' ? 'b' : 'w';
      const remainingPlayer = remainingColor === 'w' ? currentRoom.white : currentRoom.black;
      const abandonerName = disconnectedPlayer.name || 'Opponent';

      currentRoom.abandonedBy = disconnectedColor;
      this.finishRoom(
        currentRoom,
        remainingColor,
        `${abandonerName} abandoned the game. ${remainingPlayer?.name ?? 'Remaining player'} wins by abandonment.`
      );
      onAbandonment(currentRoom);
    }, RECONNECT_GRACE_PERIOD_MS);

    this.cleanupTimers.set(room.code, timer);
  }

  /**
   * Destroys a waiting room (host created it but no opponent ever joined) after
   * the reconnect grace period, so abandoned lobby rooms cannot accumulate.
   * Rooms with spectators are kept alive — someone is still watching.
   */
  scheduleWaitingRoomCleanup(room: Room) {
    this.clearRoomCleanup(room.code);
    const timer = setTimeout(() => {
      this.cleanupTimers.delete(room.code);
      const currentRoom = this.rooms.get(room.code);
      if (!currentRoom || currentRoom.black || currentRoom.resultReason || currentRoom.spectators.length > 0) return;
      this.destroyRoom(currentRoom.code);
    }, RECONNECT_GRACE_PERIOD_MS);
    this.cleanupTimers.set(room.code, timer);
  }

  /**
   * Resumes clock accounting once every player is back. While a player was
   * disconnected the clock was paused for display, so the turn start marker
   * must be shifted forward by the pause duration — otherwise the reconnecting
   * player is charged for the time they were offline. Shifting only when both
   * seats are connected avoids billing the active player for the tail of the
   * pause (when their opponent, not they, was offline).
   */
  resumeClocks(room: Room) {
    if (room.disconnectedAt === null) return;
    if (room.resultReason || !room.black || room.white?.disconnected || room.black?.disconnected) {
      return;
    }
    const pausedFor = Date.now() - room.disconnectedAt;
    room.turnStartedAt += pausedFor;
    room.disconnectedAt = null;
    room.lastUpdated = Date.now();
  }

  /**
   * Marks a player as returned to their seat. Clears the abandonment timer only
   * when nobody remains disconnected — otherwise the timer is rescheduled for
   * the player who is still gone, so an interleaved disconnect/reconnect cannot
   * leave anyone without a grace timer.
   */
  rejoinPlayer(room: Room, player: PlayerRecord, onAbandonment?: (room: Room) => void) {
    const wasDisconnected = player.disconnected;
    player.disconnected = false;
    this.resumeClocks(room);

    const stillOut = room.white?.disconnected ? room.white : room.black?.disconnected ? room.black : null;
    if (stillOut) {
      this.scheduleRoomCleanup(room, stillOut.color, onAbandonment ?? (() => {}));
    } else {
      this.clearRoomCleanup(room.code);
    }
    room.lastUpdated = Date.now();
    return wasDisconnected;
  }

  finishRoom(room: Room, winner: GameResult, reason: string) {
    room.winner = winner;
    room.resultReason = reason;
    room.drawOfferBy = null;
    room.rematchRequests = { w: false, b: false };
    room.timeoutColor = null;
    room.abandonedBy = null;
    room.disconnectedAt = null;
    room.lastUpdated = Date.now();
  }

  destroyRoom(roomCode: string) {
    this.clearRoomCleanup(roomCode);
    const room = this.rooms.get(roomCode);
    if (room) {
      if (room.white) this.sessionToRoom.delete(room.white.sessionId);
      if (room.black) this.sessionToRoom.delete(room.black.sessionId);
      for (const spec of room.spectators) {
        this.sessionToRoom.delete(spec.sessionId);
      }
    }
    this.rooms.delete(roomCode);
  }

  leaveCurrentSession(sessionId: string) {
    const existing = this.sessionToRoom.get(sessionId);
    if (!existing) return;

    this.sessionToRoom.delete(sessionId);
    const room = this.rooms.get(existing.roomCode);
    if (!room) return;

    if (existing.role === 'spectator') {
      room.spectators = room.spectators.filter((s) => s.sessionId !== sessionId);
    } else {
      const leaver = this.getRoomPlayer(room, sessionId);
      if (leaver && room.black && !room.resultReason) {
        // Deliberately leaving an active game is a forfeit: the remaining player
        // wins and the slot must not linger as a refillable zombie seat.
        const remainingColor: PlayerColor = leaver.color === 'w' ? 'b' : 'w';
        const remainingPlayer = remainingColor === 'w' ? room.white : room.black;
        this.finishRoom(
          room,
          remainingColor,
          `${leaver.name} left the game. ${remainingPlayer?.name ?? 'Remaining player'} wins.`
        );
        room.lastUpdated = Date.now();
        return;
      }
      if (room.white?.sessionId === sessionId) {
        room.white = null;
      } else if (room.black?.sessionId === sessionId) {
        room.black = null;
      }
      if (!room.white && !room.black) {
        this.destroyRoom(room.code);
        return;
      }
    }
    room.lastUpdated = Date.now();
  }

  createGame(
    playerName: string,
    sessionId: string | null | undefined,
    timeControl?: TimeControl,
    socketId: string | null = null,
    allowTakebacks = true
  ): { room: Room; player: PlayerRecord } | { error: string } {
    if (this.rooms.size >= MAX_ROOMS) {
      return { error: 'The server is at maximum room capacity. Try again later.' };
    }

    const safeSessionId = validateSessionId(sessionId) ?? createSessionId();
    const sanitizedName = sanitizePlayerName(playerName);
    const selectedTimeControl = normalizeTimeControl(timeControl);

    // If already in a room, cleanly leave the previous room first
    this.leaveCurrentSession(safeSessionId);

    const code = this.generateRoomCode();
    const player: PlayerRecord = {
      sessionId: safeSessionId,
      name: sanitizedName,
      socketId,
      color: 'w',
      disconnected: false,
      joinedAt: Date.now(),
    };

    const initialTimeMs = timeControlToMs(selectedTimeControl);
    const room: Room = {
      code,
      chess: new Chess(),
      white: player,
      black: null,
      spectators: [],
      abandonedBy: null,
      lastUpdated: Date.now(),
      timeControl: selectedTimeControl,
      whiteTimeMs: initialTimeMs,
      blackTimeMs: initialTimeMs,
      turnStartedAt: Date.now(),
      disconnectedAt: null,
      timeoutColor: null,
      winner: null,
      resultReason: null,
      drawOfferBy: null,
      takebackRequestedBy: null,
      allowTakebacks,
      rematchRequests: { w: false, b: false },
      chatMessages: [],
    };

    this.rooms.set(code, room);
    this.sessionToRoom.set(safeSessionId, { roomCode: code, color: 'w', role: 'player' });

    return { room, player };
  }

  joinGame(
    submittedCode: string,
    playerName: string,
    sessionId: string | null | undefined,
    socketId: string | null = null,
    onRejoinAbandonment?: (room: Room) => void
  ): { room: Room; player: PlayerRecord } | { error: string } {
    const code = normalizeRoomCode(submittedCode);
    if (!code) {
      return { error: 'Enter a valid room code (3-5 letters/numbers).' };
    }

    const room = this.rooms.get(code);
    if (!room) {
      return { error: 'Room not found. Check the code and try again.' };
    }

    const safeSessionId = validateSessionId(sessionId) ?? createSessionId();
    const sanitizedName = sanitizePlayerName(playerName);

    // Check if player is rejoining their own room
    const existingPlayer = this.getRoomPlayer(room, safeSessionId);
    if (existingPlayer) {
      existingPlayer.socketId = socketId;
      this.rejoinPlayer(room, existingPlayer, onRejoinAbandonment);
      return { room, player: existingPlayer };
    }

    if (room.black) {
      return { error: 'This room already has two players.' };
    }

    // Leave any other room this session was in
    this.leaveCurrentSession(safeSessionId);

    const player: PlayerRecord = {
      sessionId: safeSessionId,
      name: sanitizedName,
      socketId,
      color: 'b',
      disconnected: false,
      joinedAt: Date.now(),
    };

    room.black = player;
    room.abandonedBy = null;
    room.lastUpdated = Date.now();
    // Start game clocks NOW when Black joins!
    room.turnStartedAt = Date.now();

    this.clearRoomCleanup(room.code);
    this.sessionToRoom.set(safeSessionId, { roomCode: code, color: 'b', role: 'player' });

    return { room, player };
  }

  joinSpectator(
    submittedCode: string,
    playerName: string | undefined,
    sessionId: string | null | undefined,
    socketId: string | null = null
  ): { room: Room; spectator: SpectatorRecord } | { error: string } {
    const code = normalizeRoomCode(submittedCode);
    if (!code) {
      return { error: 'Enter a valid room code.' };
    }

    const room = this.rooms.get(code);
    if (!room) {
      return { error: 'Room not found. Check the code and try again.' };
    }

    const safeSessionId = validateSessionId(sessionId) ?? createSessionId();
    const sanitizedName = sanitizePlayerName(playerName ?? 'Spectator');

    // Rejoining spectators keep their slot even at full capacity.
    const existingSpectator = this.getRoomSpectator(room, safeSessionId);
    if (existingSpectator) {
      existingSpectator.socketId = socketId;
      existingSpectator.disconnected = false;
      room.lastUpdated = Date.now();
      return { room, spectator: existingSpectator };
    }

    if (room.spectators.length >= MAX_SPECTATORS) {
      return { error: `This room has reached the maximum spectator capacity (${MAX_SPECTATORS}).` };
    }

    // If this session is already a player in this room, keep them as player
    const existingPlayer = this.getRoomPlayer(room, safeSessionId);
    if (existingPlayer) {
      return { error: 'You are already a player in this room.' };
    }

    // Leave any other room
    this.leaveCurrentSession(safeSessionId);

    const spectator: SpectatorRecord = {
      sessionId: safeSessionId,
      name: sanitizedName,
      socketId,
      joinedAt: Date.now(),
      disconnected: false,
    };

    room.spectators = [...room.spectators.filter((s) => s.sessionId !== safeSessionId), spectator];
    room.lastUpdated = Date.now();
    this.sessionToRoom.set(safeSessionId, { roomCode: code, role: 'spectator' });

    return { room, spectator };
  }

  makeMove(
    room: Room,
    sessionId: string,
    from: string,
    to: string,
    promotion?: PromotionPiece
  ): { success: true } | { error: string; finished?: boolean } {
    const player = this.getRoomPlayer(room, sessionId);
    if (!player || player.disconnected) {
      return { error: 'Player connection not active.' };
    }

    if (!room.black) {
      return { error: 'Both players must be in the room to play.' };
    }

    if (room.resultReason || room.timeoutColor || room.chess.isGameOver()) {
      return { error: 'This game has already finished.' };
    }

    if (room.white?.disconnected || room.black?.disconnected) {
      return { error: 'Cannot move while a player is disconnected.' };
    }

    const color = player.color;
    if (room.chess.turn() !== color) {
      return { error: 'It is not your turn.' };
    }

    if (!isChessSquare(from) || !isChessSquare(to)) {
      return { error: 'Invalid board coordinates.' };
    }
    const fromSquare = from.toLowerCase();
    const toSquare = to.toLowerCase();

    const normalizedPromo = normalizePromotion(promotion);

    // Check clock before moving
    const remaining = this.getRemainingTime(room, color);
    if (remaining !== null && remaining <= 0) {
      if (color === 'w') room.whiteTimeMs = 0;
      else room.blackTimeMs = 0;
      room.timeoutColor = color;
      const winner: PlayerColor = color === 'w' ? 'b' : 'w';
      this.finishRoom(room, winner, 'Timeout');
      return { error: 'Time expired.', finished: true };
    }

    // ATTEMPT THE CHESS MOVE FIRST before deducting clock time!
    try {
      const moveResult = room.chess.move({ from: fromSquare, to: toSquare, promotion: normalizedPromo });
      if (!moveResult) {
        return { error: 'Illegal chess move.' };
      }
    } catch {
      return { error: 'That move is not legal.' };
    }

    // Move succeeded: deduct elapsed time safely, then credit the Fischer
    // increment for the completed move.
    if (room.timeControl !== 'unlimited') {
      const previousTime = color === 'w' ? room.whiteTimeMs : room.blackTimeMs;
      const elapsed = Date.now() - room.turnStartedAt;
      if (previousTime !== null) {
        const updatedTime = Math.max(0, previousTime - elapsed) + incrementMsOf(room.timeControl);
        if (color === 'w') room.whiteTimeMs = updatedTime;
        else room.blackTimeMs = updatedTime;
      }
    }

    room.turnStartedAt = Date.now();
    room.lastUpdated = Date.now();
    room.drawOfferBy = null;

    // Check game over
    if (room.chess.isCheckmate()) {
      const winner: PlayerColor = room.chess.turn() === 'w' ? 'b' : 'w';
      this.finishRoom(room, winner, 'Checkmate');
    } else if (room.chess.isStalemate()) {
      this.finishRoom(room, 'draw', 'Draw by stalemate');
    } else if (room.chess.isThreefoldRepetition()) {
      this.finishRoom(room, 'draw', 'Draw by repetition');
    } else if (room.chess.isInsufficientMaterial()) {
      this.finishRoom(room, 'draw', 'Draw by insufficient material');
    } else if (room.chess.isDrawByFiftyMoves()) {
      this.finishRoom(room, 'draw', 'Draw by fifty-move rule');
    } else if (room.chess.isGameOver()) {
      this.finishRoom(room, 'draw', 'Draw');
    }

    return { success: true };
  }

  requestTakeback(room: Room, sessionId: string): { success?: boolean; error?: string } {
    if (!room.allowTakebacks) {
      return { error: 'Takebacks are disabled in this match.' };
    }
    if (!room.black || room.resultReason) {
      return { error: 'Game is not active.' };
    }
    const player = this.getRoomPlayer(room, sessionId);
    if (!player) {
      return { error: 'Only players can request a takeback.' };
    }
    if (room.chess.history().length === 0) {
      return { error: 'No moves have been made yet.' };
    }
    if (room.takebackRequestedBy) {
      return { error: 'A takeback request is already pending.' };
    }
    // A player who has not moved yet has nothing to take back; allowing the
    // request could erase the opponent's move instead (undoCount math).
    const requesterHasMoved = room.chess
      .history({ verbose: true })
      .some((m) => m.color === player.color);
    if (!requesterHasMoved) {
      return { error: 'You have not made a move to take back yet.' };
    }

    room.takebackRequestedBy = player.color;
    room.lastUpdated = Date.now();
    return { success: true };
  }

  respondTakeback(room: Room, sessionId: string, accept: boolean): { success?: boolean; error?: string } {
    if (room.resultReason || !room.black) {
      return { error: 'Game is not active.' };
    }
    if (!room.takebackRequestedBy) {
      return { error: 'No takeback is currently requested.' };
    }
    const player = this.getRoomPlayer(room, sessionId);
    if (!player || player.color === room.takebackRequestedBy) {
      return { error: 'Only the opponent can respond to a takeback.' };
    }

    if (!accept) {
      room.takebackRequestedBy = null;
      room.lastUpdated = Date.now();
      return { success: true };
    }

    // Replay moves to 1 or 2 plies back
    const history = room.chess.history({ verbose: true });
    if (history.length === 0) {
      room.takebackRequestedBy = null;
      return { error: 'No moves to take back.' };
    }

    // If it is the opponent's turn, requester made the last move (undo 1 move)
    // If it is the requester's turn, opponent made the last move (undo 2 moves to give requester back their turn)
    const undoCount = room.chess.turn() !== room.takebackRequestedBy ? 1 : 2;
    const targetLength = Math.max(0, history.length - undoCount);

    const replayedChess = new Chess();
    for (let i = 0; i < targetLength; i++) {
      const m = history[i];
      replayedChess.move({ from: m.from, to: m.to, promotion: m.promotion });
    }

    room.chess = replayedChess;
    room.takebackRequestedBy = null;
    room.turnStartedAt = Date.now();
    room.lastUpdated = Date.now();
    return { success: true };
  }

  handleRematchAgreement(room: Room): boolean {
    if (!room.rematchRequests.w || !room.rematchRequests.b) {
      return false;
    }

    const prevWhite = room.white;
    const prevBlack = room.black;
    if (!prevWhite || !prevBlack) return false;

    // Swap colors!
    const nextWhite: PlayerRecord = {
      ...prevBlack,
      color: 'w',
      socketId: prevBlack.socketId,
      disconnected: prevBlack.disconnected,
    };
    const nextBlack: PlayerRecord = {
      ...prevWhite,
      color: 'b',
      socketId: prevWhite.socketId,
      disconnected: prevWhite.disconnected,
    };

    room.white = nextWhite;
    room.black = nextBlack;
    room.chess = new Chess();
    room.disconnectedAt = null;

    const initialTime = timeControlToMs(room.timeControl);
    room.whiteTimeMs = initialTime;
    room.blackTimeMs = initialTime;
    room.turnStartedAt = Date.now();
    room.timeoutColor = null;
    room.winner = null;
    room.resultReason = null;
    room.drawOfferBy = null;
    room.takebackRequestedBy = null;
    room.abandonedBy = null;
    room.rematchRequests = { w: false, b: false };
    room.lastUpdated = Date.now();

    this.sessionToRoom.set(nextWhite.sessionId, { roomCode: room.code, color: 'w', role: 'player' });
    this.sessionToRoom.set(nextBlack.sessionId, { roomCode: room.code, color: 'b', role: 'player' });

    return true;
  }

  checkTimeouts(): string[] {
    const timedOutRoomCodes: string[] = [];
    for (const room of this.rooms.values()) {
      if (!room.black || room.resultReason || room.timeoutColor || room.abandonedBy || room.timeControl === 'unlimited') {
        continue;
      }
      const activeColor = room.chess.turn() as PlayerColor;
      const remaining = this.getRemainingTime(room, activeColor);
      if (remaining !== null && remaining <= 0) {
        if (activeColor === 'w') room.whiteTimeMs = 0;
        else room.blackTimeMs = 0;
        room.timeoutColor = activeColor;
        const winner: PlayerColor = activeColor === 'w' ? 'b' : 'w';
        this.finishRoom(room, winner, 'Timeout');
        timedOutRoomCodes.push(room.code);
      }
    }
    return timedOutRoomCodes;
  }

  sweepIdleRooms(): void {
    const now = Date.now();
    for (const [code, room] of this.rooms.entries()) {
      if (now - room.lastUpdated > IDLE_ROOM_TTL_MS) {
        this.destroyRoom(code);
      }
    }
  }
}
