import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import { Chess } from 'chess.js';
import { Server } from 'socket.io';
import type { ChatMessage, ClientToServerEvents, GameState, PlayerColor, PromotionPiece, ServerStatus, ServerToClientEvents, TimeControl } from '../shared/types.js';
import { getLanIp } from './network.js';
import { isChessSquare, MAX_CHAT_MESSAGE_LENGTH, MAX_PLAYER_NAME_LENGTH, MAX_ROOM_CODE_LENGTH, normalizePromotion, normalizeRoomCode, sanitizeChatMessage, sanitizePlayerName, validateSessionId } from './validation.js';

const PORT = Number(process.env.PORT ?? 3001);
const HOST = '0.0.0.0';
const RECONNECT_GRACE_PERIOD_MS = Number(process.env.RECONNECT_GRACE_PERIOD_MS ?? 30000);
const MAX_SPECTATORS = Number(process.env.MAX_SPECTATORS ?? 8);
const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, { cors: { origin: true } });

interface PlayerRecord {
  sessionId: string;
  name: string;
  socketId: string | null;
  color: PlayerColor;
  disconnected: boolean;
  joinedAt: number;
}

interface SpectatorRecord {
  sessionId: string;
  name: string;
  socketId: string | null;
  joinedAt: number;
  disconnected: boolean;
}

interface Room {
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
  timeoutColor: PlayerColor | null;
  winner: PlayerColor | 'draw' | null;
  resultReason: string | null;
  drawOfferBy: PlayerColor | null;
  rematchRequests: Record<PlayerColor, boolean>;
  chatMessages: ChatMessage[];
}

const rooms = new Map<string, Room>();
const sessionToRoom = new Map<string, { roomCode: string; color?: PlayerColor; role: 'player' | 'spectator' }>();
const cleanupTimers = new Map<string, NodeJS.Timeout>();

const safeName = sanitizePlayerName;
const createSessionId = () => `session-${randomBytes(12).toString('hex')}`;
const normalizeTimeControl = (value?: TimeControl): TimeControl => {
  if (value === 'unlimited' || value === '3+0' || value === '5+0' || value === '10+0') return value;
  return '3+0';
};
const timeControlToMs = (timeControl: TimeControl): number | null => {
  if (timeControl === 'unlimited') return null;
  if (timeControl === '3+0') return 3 * 60 * 1000;
  if (timeControl === '5+0') return 5 * 60 * 1000;
  return 10 * 60 * 1000;
};

function roomCode() {
  let code = '';
  do {
    code = randomBytes(3).toString('base64url').toUpperCase().slice(0, 5);
  } while (rooms.has(code));
  return code;
}

function getRoomPlayer(room: Room, sessionId: string): PlayerRecord | null {
  if (room.white?.sessionId === sessionId) return room.white;
  if (room.black?.sessionId === sessionId) return room.black;
  return null;
}

function getRoomSpectator(room: Room, sessionId: string): SpectatorRecord | null {
  return room.spectators.find((spectator) => spectator.sessionId === sessionId) ?? null;
}

function hostUrl() {
  const ip = getLanIp();
  return ip ? `http://${ip}:${PORT}` : null;
}

function getRemainingTime(room: Room, color: PlayerColor): number | null {
  if (room.timeControl === 'unlimited') return null;
  const activeColor = room.chess.turn();
  const baseTime = color === 'w' ? room.whiteTimeMs : room.blackTimeMs;
  if (baseTime === null) return null;
  if (activeColor !== color) return baseTime;
  return Math.max(0, baseTime - (Date.now() - room.turnStartedAt));
}

function normalizeResultMessage(room: Room): string {
  if (room.resultReason) return room.resultReason;
  if (room.drawOfferBy) {
    const playerName = room.drawOfferBy === 'w' ? room.white?.name ?? 'White' : room.black?.name ?? 'Black';
    return `Draw offered by ${playerName}.`;
  }
  if (room.rematchRequests.w || room.rematchRequests.b) {
    const whoRequested = [room.rematchRequests.w ? room.white?.name : null, room.rematchRequests.b ? room.black?.name : null].filter(Boolean).join(' and ');
    return `Rematch requested by ${whoRequested ?? 'players'}.`;
  }
  return 'Waiting for opponent...';
}

function finishRoom(room: Room, winner: PlayerColor | 'draw', reason: string) {
  room.winner = winner;
  room.resultReason = reason;
  room.drawOfferBy = null;
  room.rematchRequests = { w: false, b: false };
  room.timeoutColor = null;
  room.abandonedBy = null;
  room.chatMessages = [];
  broadcast(room);
}

function stateFor(room: Room): GameState {
  const chess = room.chess;
  const timeControl = room.timeControl;
  const whiteTimeMs = room.timeControl === 'unlimited' ? null : getRemainingTime(room, 'w');
  const blackTimeMs = room.timeControl === 'unlimited' ? null : getRemainingTime(room, 'b');

  if (room.resultReason) {
    return {
      roomCode: room.code,
      fen: chess.fen(),
      turn: chess.turn(),
      whiteName: room.white?.name ?? 'White',
      blackName: room.black?.name ?? null,
      status: 'finished',
      message: room.resultReason,
      moves: chess.history({ verbose: true }).map((move) => ({
        from: move.from,
        to: move.to,
        san: move.san,
        color: move.color,
        captured: move.captured as GameState['moves'][number]['captured'],
        promotion: move.promotion as GameState['moves'][number]['promotion'],
      })),
      timeControl,
      whiteTimeMs,
      blackTimeMs,
      winner: room.winner,
      reason: room.resultReason,
      drawOfferBy: room.drawOfferBy,
      rematchRequests: { ...room.rematchRequests },
      chatMessages: room.chatMessages,
      spectatorCount: room.spectators.length,
    };
  }

  if (room.timeoutColor) {
    const winnerName = room.timeoutColor === 'w' ? room.black?.name ?? 'Black' : room.white?.name ?? 'White';
    return {
      roomCode: room.code,
      fen: chess.fen(),
      turn: chess.turn(),
      whiteName: room.white?.name ?? 'White',
      blackName: room.black?.name ?? null,
      status: 'finished',
      message: `Time expired — ${winnerName} wins.`,
      moves: chess.history({ verbose: true }).map((move) => ({
        from: move.from,
        to: move.to,
        san: move.san,
        color: move.color,
        captured: move.captured as GameState['moves'][number]['captured'],
        promotion: move.promotion as GameState['moves'][number]['promotion'],
      })),
      timeControl,
      whiteTimeMs,
      blackTimeMs,
      winner: room.timeoutColor === 'w' ? 'b' : 'w',
      reason: 'Timeout',
      drawOfferBy: room.drawOfferBy,
      rematchRequests: { ...room.rematchRequests },
      chatMessages: room.chatMessages,
      spectatorCount: room.spectators.length,
    };
  }

  if (room.abandonedBy) {
    const abandonedPlayer = room.abandonedBy === 'w' ? room.white : room.black;
    return {
      roomCode: room.code,
      fen: chess.fen(),
      turn: chess.turn(),
      whiteName: room.white?.name ?? 'White',
      blackName: room.black?.name ?? null,
      status: chess.isGameOver() ? 'finished' : 'waiting',
      message: `${abandonedPlayer?.name ?? 'A player'} abandoned the game. Waiting for reconnection...`,
      moves: chess.history({ verbose: true }).map((move) => ({
        from: move.from,
        to: move.to,
        san: move.san,
        color: move.color,
        captured: move.captured as GameState['moves'][number]['captured'],
        promotion: move.promotion as GameState['moves'][number]['promotion'],
      })),
      timeControl,
      whiteTimeMs,
      blackTimeMs,
      winner: null,
      reason: null,
      drawOfferBy: room.drawOfferBy,
      rematchRequests: { ...room.rematchRequests },
      chatMessages: room.chatMessages,
      spectatorCount: room.spectators.length,
    };
  }

  const disconnectedPlayer = room.white?.disconnected ? room.white : room.black?.disconnected ? room.black : null;
  let message = room.black ? `${chess.turn() === 'w' ? room.white?.name : room.black?.name} to move.` : 'Waiting for opponent...';

  if (room.drawOfferBy) {
    const offeredBy = room.drawOfferBy === 'w' ? room.white?.name ?? 'White' : room.black?.name ?? 'Black';
    message = `Draw offered by ${offeredBy}.`;
  } else if (disconnectedPlayer) {
    message = 'Opponent disconnected. Waiting for reconnection...';
  }
  if (chess.isCheckmate()) message = `Checkmate — ${chess.turn() === 'w' ? 'Black' : 'White'} wins.`;
  else if (chess.isStalemate()) message = 'Stalemate — the game is drawn.';
  else if (chess.isThreefoldRepetition()) message = 'Draw by threefold repetition.';
  else if (chess.isInsufficientMaterial()) message = 'Draw by insufficient material.';
  else if (chess.isDrawByFiftyMoves()) message = 'Draw by the fifty-move rule.';
  else if (chess.isCheck()) message = `${chess.turn() === 'w' ? 'White' : 'Black'} is in check.`;

  const hasDisconnectedPlayer = Boolean(room.white?.disconnected || room.black?.disconnected);

  return {
    roomCode: room.code,
    fen: chess.fen(),
    turn: chess.turn(),
    whiteName: room.white?.name ?? 'White',
    blackName: room.black?.name ?? null,
    status: chess.isGameOver() ? 'finished' : room.black && !hasDisconnectedPlayer ? 'active' : 'waiting',
    message,
    moves: chess.history({ verbose: true }).map((move) => ({
      from: move.from,
      to: move.to,
      san: move.san,
      color: move.color,
      captured: move.captured as GameState['moves'][number]['captured'],
      promotion: move.promotion as GameState['moves'][number]['promotion'],
    })),
    timeControl,
    whiteTimeMs,
    blackTimeMs,
    winner: null,
    reason: null,
    drawOfferBy: room.drawOfferBy,
    rematchRequests: { ...room.rematchRequests },
    chatMessages: room.chatMessages,
    spectatorCount: room.spectators.length,
  };
}

function broadcast(room: Room) {
  io.to(room.code).emit('game-state', stateFor(room));
}

function clearRoomCleanup(roomCode: string) {
  const timer = cleanupTimers.get(roomCode);
  if (timer) {
    clearTimeout(timer);
    cleanupTimers.delete(roomCode);
  }
}

function scheduleRoomCleanup(room: Room, disconnectedColor: PlayerColor) {
  clearRoomCleanup(room.code);
  const timer = setTimeout(() => {
    const currentRoom = rooms.get(room.code);
    if (!currentRoom) return;

    const disconnectedPlayer = disconnectedColor === 'w' ? currentRoom.white : currentRoom.black;
    if (!disconnectedPlayer || !disconnectedPlayer.disconnected) return;

    currentRoom.abandonedBy = disconnectedColor;
    if (currentRoom.white?.disconnected && currentRoom.black?.disconnected) {
      const playerIds = [currentRoom.white.sessionId, currentRoom.black.sessionId];
      for (const sessionId of playerIds) {
        sessionToRoom.delete(sessionId);
      }
      rooms.delete(currentRoom.code);
      clearRoomCleanup(currentRoom.code);
      return;
    }

    broadcast(currentRoom);
  }, RECONNECT_GRACE_PERIOD_MS);

  cleanupTimers.set(room.code, timer);
}

function attachSession(socket: { id: string; join: (room: string) => void; leave: (room: string) => void; data: { sessionId?: string; roomCode?: string } }, room: Room, player: PlayerRecord) {
  if (player.socketId && player.socketId !== socket.id) {
    const previousSocket = io.sockets.sockets.get(player.socketId);
    if (previousSocket && previousSocket.id !== socket.id) {
      previousSocket.leave(room.code);
      previousSocket.data.sessionId = undefined;
      previousSocket.data.roomCode = undefined;
    }
  }

  socket.data.sessionId = player.sessionId;
  socket.data.roomCode = room.code;
  player.socketId = socket.id;
  player.disconnected = false;
  room.abandonedBy = null;
  room.lastUpdated = Date.now();
  socket.join(room.code);
  sessionToRoom.set(player.sessionId, { roomCode: room.code, color: player.color, role: 'player' });
}

function attachSpectatorSession(socket: { id: string; join: (room: string) => void; leave: (room: string) => void; data: { sessionId?: string; roomCode?: string } }, room: Room, spectator: SpectatorRecord) {
  if (spectator.socketId && spectator.socketId !== socket.id) {
    const previousSocket = io.sockets.sockets.get(spectator.socketId);
    if (previousSocket && previousSocket.id !== socket.id) {
      previousSocket.leave(room.code);
      previousSocket.data.sessionId = undefined;
      previousSocket.data.roomCode = undefined;
    }
  }

  socket.data.sessionId = spectator.sessionId;
  socket.data.roomCode = room.code;
  spectator.socketId = socket.id;
  spectator.disconnected = false;
  room.lastUpdated = Date.now();
  socket.join(room.code);
  sessionToRoom.set(spectator.sessionId, { roomCode: room.code, role: 'spectator' });
}

function emitPlayerAssignments(room: Room) {
  if (room.white) {
    const whiteSocket = room.white.socketId ? io.sockets.sockets.get(room.white.socketId) : null;
    if (whiteSocket) {
      whiteSocket.emit('room-created', { roomCode: room.code, playerColor: 'w', sessionId: room.white.sessionId, hostUrl: hostUrl() });
      whiteSocket.data.sessionId = room.white.sessionId;
      whiteSocket.data.roomCode = room.code;
    }
  }
  if (room.black) {
    const blackSocket = room.black.socketId ? io.sockets.sockets.get(room.black.socketId) : null;
    if (blackSocket) {
      blackSocket.emit('room-joined', { roomCode: room.code, playerColor: 'b', sessionId: room.black.sessionId, role: 'player' });
      blackSocket.data.sessionId = room.black.sessionId;
      blackSocket.data.roomCode = room.code;
    }
  }
}

function emitConnectionStatus(socket: { emit: (event: 'connection-status', payload: { status: 'connected' | 'reconnecting' | 'disconnected'; message?: string }) => void }, status: 'connected' | 'reconnecting' | 'disconnected', message?: string) {
  socket.emit('connection-status', { status, message });
}

function runClockTicker() {
  setInterval(() => {
    for (const room of rooms.values()) {
      if (!room.black || room.timeoutColor || room.abandonedBy || room.timeControl === 'unlimited') continue;
      const activeColor = room.chess.turn();
      const remaining = getRemainingTime(room, activeColor);
      if (remaining === null) continue;
      if (remaining <= 0) {
        if (activeColor === 'w') room.whiteTimeMs = 0; else room.blackTimeMs = 0;
        room.timeoutColor = activeColor;
        broadcast(room);
      } else if (room.white && room.black && !room.white.disconnected && !room.black.disconnected) {
        broadcast(room);
      }
    }
  }, 1000);
}

io.on('connection', (socket) => {
  emitConnectionStatus(socket, 'connected');

  socket.on('identify-session', ({ sessionId }) => {
    const resolvedSessionId = validateSessionId(sessionId) ?? createSessionId();

    const existingSession = sessionToRoom.get(resolvedSessionId);
    if (!existingSession) {
      socket.data.sessionId = resolvedSessionId;
      return;
    }

    const room = rooms.get(existingSession.roomCode);
    if (!room) {
      sessionToRoom.delete(resolvedSessionId);
      socket.data.sessionId = resolvedSessionId;
      return;
    }

    const player = getRoomPlayer(room, resolvedSessionId);
    if (player) {
      attachSession(socket, room, player);
      if (player.color === 'w') {
        socket.emit('room-created', { roomCode: room.code, playerColor: 'w', sessionId: player.sessionId, hostUrl: hostUrl() });
      } else {
        socket.emit('room-joined', { roomCode: room.code, playerColor: 'b', sessionId: player.sessionId, role: 'player' });
      }
      broadcast(room);
      return;
    }

    const spectator = getRoomSpectator(room, resolvedSessionId);
    if (!spectator) {
      sessionToRoom.delete(resolvedSessionId);
      socket.data.sessionId = resolvedSessionId;
      return;
    }

    attachSpectatorSession(socket, room, spectator);
    socket.emit('room-joined', { roomCode: room.code, playerColor: null, sessionId: spectator.sessionId, role: 'spectator' });
    broadcast(room);
  });

  socket.on('create-game', ({ playerName, sessionId, timeControl }) => {
    const safeSessionId = validateSessionId(sessionId) ?? createSessionId();
    const selectedTimeControl = normalizeTimeControl(timeControl);
    const sanitizedName = sanitizePlayerName(playerName);
    const existingSession = sessionToRoom.get(safeSessionId);

    if (existingSession) {
      const existingRoom = rooms.get(existingSession.roomCode);
      if (existingRoom) {
        const existingPlayer = getRoomPlayer(existingRoom, safeSessionId);
        if (existingPlayer) {
          attachSession(socket, existingRoom, existingPlayer);
          socket.emit('room-created', { roomCode: existingRoom.code, playerColor: existingPlayer.color, sessionId: safeSessionId, hostUrl: hostUrl() });
          broadcast(existingRoom);
          return;
        }
      }
      sessionToRoom.delete(safeSessionId);
    }

    const code = roomCode();
    const room: Room = {
      code,
      chess: new Chess(),
      white: { sessionId: safeSessionId, name: sanitizedName, socketId: socket.id, color: 'w', disconnected: false, joinedAt: Date.now() },
      black: null,
      spectators: [],
      abandonedBy: null,
      lastUpdated: Date.now(),
      timeControl: selectedTimeControl,
      whiteTimeMs: timeControlToMs(selectedTimeControl),
      blackTimeMs: timeControlToMs(selectedTimeControl),
      turnStartedAt: Date.now(),
      timeoutColor: null,
      winner: null,
      resultReason: null,
      drawOfferBy: null,
      rematchRequests: { w: false, b: false },
      chatMessages: [],
    };
    rooms.set(code, room);
    sessionToRoom.set(safeSessionId, { roomCode: code, color: 'w', role: 'player' });
    const createdPlayer = room.white;
    if (!createdPlayer) {
      throw new Error('Failed to initialize room host player.');
    }
    attachSession(socket, room, createdPlayer);
    socket.emit('room-created', { roomCode: code, playerColor: 'w', sessionId: safeSessionId, hostUrl: hostUrl() });
    broadcast(room);
  });

  socket.on('join-game', ({ roomCode: submittedCode, playerName, sessionId }) => {
    const code = normalizeRoomCode(submittedCode);
    if (!code) {
      socket.emit('game-error', { message: 'Enter a valid room code.' });
      return;
    }
    const safeSessionId = validateSessionId(sessionId) ?? createSessionId();
    const sanitizedName = sanitizePlayerName(playerName);
    const existingSession = sessionToRoom.get(safeSessionId);

    if (existingSession) {
      const existingRoom = rooms.get(existingSession.roomCode);
      if (existingRoom) {
        const existingPlayer = getRoomPlayer(existingRoom, safeSessionId);
        if (existingPlayer) {
          attachSession(socket, existingRoom, existingPlayer);
          socket.emit('room-joined', { roomCode: existingRoom.code, playerColor: existingPlayer.color, sessionId: safeSessionId, role: 'player' });
          broadcast(existingRoom);
          return;
        }
      }
      sessionToRoom.delete(safeSessionId);
    }

    const room = rooms.get(code);
    if (!room) {
      socket.emit('game-error', { message: 'Room not found. Check the room code and try again.' });
      return;
    }
    if (room.black) {
      socket.emit('game-error', { message: 'This room already has two players.' });
      return;
    }
    if (room.white?.sessionId === safeSessionId) {
      socket.emit('game-error', { message: 'You already created this room.' });
      return;
    }

    room.black = { sessionId: safeSessionId, name: sanitizedName, socketId: socket.id, color: 'b', disconnected: false, joinedAt: Date.now() };
    room.abandonedBy = null;
    room.lastUpdated = Date.now();
    room.drawOfferBy = null;
    room.rematchRequests = { w: false, b: false };
    room.chatMessages = [];
    sessionToRoom.set(safeSessionId, { roomCode: code, color: 'b', role: 'player' });
    attachSession(socket, room, room.black);
    socket.emit('room-joined', { roomCode: code, playerColor: 'b', sessionId: safeSessionId, role: 'player' });
    broadcast(room);
  });

  socket.on('join-spectator', ({ roomCode: submittedCode, playerName, sessionId }) => {
    const code = normalizeRoomCode(submittedCode);
    if (!code) {
      socket.emit('game-error', { message: 'Enter a valid room code.' });
      return;
    }
    const safeSessionId = validateSessionId(sessionId) ?? createSessionId();
    const sanitizedName = sanitizePlayerName(playerName ?? 'Spectator');
    const existingSession = sessionToRoom.get(safeSessionId);

    if (existingSession) {
      const existingRoom = rooms.get(existingSession.roomCode);
      if (existingRoom) {
        if (existingSession.role === 'spectator') {
          const existingSpectator = getRoomSpectator(existingRoom, safeSessionId);
          if (existingSpectator) {
            attachSpectatorSession(socket, existingRoom, existingSpectator);
            socket.emit('room-joined', { roomCode: existingRoom.code, playerColor: null, sessionId: safeSessionId, role: 'spectator' });
            broadcast(existingRoom);
            return;
          }
        }

        const existingPlayer = getRoomPlayer(existingRoom, safeSessionId);
        if (existingPlayer) {
          attachSession(socket, existingRoom, existingPlayer);
          socket.emit('room-joined', { roomCode: existingRoom.code, playerColor: existingPlayer.color, sessionId: safeSessionId, role: 'player' });
          broadcast(existingRoom);
          return;
        }
      }
      sessionToRoom.delete(safeSessionId);
    }

    const room = rooms.get(code);
    if (!room) {
      socket.emit('game-error', { message: 'Room not found. Check the room code and try again.' });
      return;
    }
    if (room.spectators.length >= MAX_SPECTATORS) {
      socket.emit('game-error', { message: `This room already has the maximum spectator count (${MAX_SPECTATORS}).` });
      return;
    }

    const spectator: SpectatorRecord = {
      sessionId: safeSessionId,
      name: sanitizedName,
      socketId: socket.id,
      joinedAt: Date.now(),
      disconnected: false,
    };
    room.spectators = [...room.spectators.filter((entry) => entry.sessionId !== safeSessionId), spectator];
    room.lastUpdated = Date.now();
    attachSpectatorSession(socket, room, spectator);
    socket.emit('room-joined', { roomCode: code, playerColor: null, sessionId: safeSessionId, role: 'spectator' });
    broadcast(room);
  });

  socket.on('make-move', ({ from, to, promotion }) => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) {
      socket.emit('game-error', { message: 'Session not identified. Refresh and try again.' });
      return;
    }
    if (!isChessSquare(from) || !isChessSquare(to)) {
      socket.emit('game-error', { message: 'Invalid move coordinates.' });
      return;
    }
    const normalizedPromotion = normalizePromotion(promotion);

    const session = sessionToRoom.get(sessionId);
    if (!session) {
      socket.emit('game-error', { message: 'You are not in an active room.' });
      return;
    }

    const room = rooms.get(session.roomCode);
    if (!room || !room.black) {
      socket.emit('game-error', { message: 'Join a two-player room before moving.' });
      return;
    }
    if (session.role !== 'player') {
      socket.emit('game-error', { message: 'Spectators cannot make moves.' });
      return;
    }

    const player = getRoomPlayer(room, sessionId);
    if (!player || player.disconnected) {
      socket.emit('game-error', { message: 'Your connection is disconnected. Wait for reconnection.' });
      return;
    }

    const color: PlayerColor = player.color;
    if (room.resultReason || room.timeoutColor || room.chess.isGameOver()) {
      socket.emit('game-error', { message: 'This game has already finished.' });
      return;
    }
    if (room.white?.disconnected || room.black?.disconnected) {
      socket.emit('game-error', { message: 'The opponent is disconnected. Waiting for reconnection.' });
      return;
    }
    if (room.chess.turn() !== color) {
      socket.emit('game-error', { message: 'It is not your turn.' });
      return;
    }

    const remaining = getRemainingTime(room, color);
    if (remaining !== null && remaining <= 0) {
      if (color === 'w') room.whiteTimeMs = 0; else room.blackTimeMs = 0;
      room.timeoutColor = color;
      finishRoom(room, color === 'w' ? 'b' : 'w', 'Timeout');
      return;
    }

    try {
      const previousTime = color === 'w' ? room.whiteTimeMs : room.blackTimeMs;
      const elapsed = Date.now() - room.turnStartedAt;
      if (previousTime !== null) {
        if (color === 'w') room.whiteTimeMs = Math.max(0, previousTime - elapsed);
        else room.blackTimeMs = Math.max(0, previousTime - elapsed);
      }
      room.chess.move({ from, to, promotion: normalizedPromotion });
      room.turnStartedAt = Date.now();
      room.lastUpdated = Date.now();
      room.drawOfferBy = null;

      if (room.chess.isCheckmate()) {
        const winner = room.chess.turn() === 'w' ? 'b' : 'w';
        finishRoom(room, winner, 'Checkmate');
        return;
      }
      if (room.chess.isStalemate()) {
        finishRoom(room, 'draw', 'Draw by stalemate');
        return;
      }
      if (room.chess.isThreefoldRepetition()) {
        finishRoom(room, 'draw', 'Draw by repetition');
        return;
      }
      if (room.chess.isInsufficientMaterial()) {
        finishRoom(room, 'draw', 'Draw by insufficient material');
        return;
      }
      if (room.chess.isDrawByFiftyMoves()) {
        finishRoom(room, 'draw', 'Draw by fifty-move rule');
        return;
      }
      if (room.chess.isGameOver()) {
        finishRoom(room, 'draw', 'Draw');
        return;
      }

      broadcast(room);
    } catch {
      socket.emit('game-error', { message: 'That move is not legal.' });
    }
  });

  socket.on('resign-game', () => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) {
      socket.emit('game-error', { message: 'Session not identified. Refresh and try again.' });
      return;
    }
    const session = sessionToRoom.get(sessionId);
    if (!session) {
      socket.emit('game-error', { message: 'You are not in an active room.' });
      return;
    }
    const room = rooms.get(session.roomCode);
    if (!room || !room.black) {
      socket.emit('game-error', { message: 'Join a two-player room before resigning.' });
      return;
    }
    if (room.resultReason) {
      socket.emit('game-error', { message: 'This game has already finished.' });
      return;
    }
    const player = getRoomPlayer(room, sessionId);
    if (!player) {
      socket.emit('game-error', { message: 'You are not in this room.' });
      return;
    }
    finishRoom(room, player.color === 'w' ? 'b' : 'w', 'Resignation');
  });

  socket.on('offer-draw', () => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) {
      socket.emit('game-error', { message: 'Session not identified. Refresh and try again.' });
      return;
    }
    const session = sessionToRoom.get(sessionId);
    if (!session) {
      socket.emit('game-error', { message: 'You are not in an active room.' });
      return;
    }
    const room = rooms.get(session.roomCode);
    if (!room || !room.black) {
      socket.emit('game-error', { message: 'Join a two-player room before offering a draw.' });
      return;
    }
    if (room.resultReason) {
      socket.emit('game-error', { message: 'This game has already finished.' });
      return;
    }
    const player = getRoomPlayer(room, sessionId);
    if (!player || player.disconnected) {
      socket.emit('game-error', { message: 'Your connection is disconnected. Wait for reconnection.' });
      return;
    }
    if (room.drawOfferBy) {
      socket.emit('game-error', { message: 'A draw is already pending.' });
      return;
    }
    room.drawOfferBy = player.color;
    broadcast(room);
  });

  socket.on('respond-draw', ({ accept }) => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) {
      socket.emit('game-error', { message: 'Session not identified. Refresh and try again.' });
      return;
    }
    if (typeof accept !== 'boolean') {
      socket.emit('game-error', { message: 'Invalid draw response.' });
      return;
    }
    const session = sessionToRoom.get(sessionId);
    if (!session) {
      socket.emit('game-error', { message: 'You are not in an active room.' });
      return;
    }
    const room = rooms.get(session.roomCode);
    if (!room || !room.black) {
      socket.emit('game-error', { message: 'Join a two-player room before responding to a draw.' });
      return;
    }
    if (room.resultReason) {
      socket.emit('game-error', { message: 'This game has already finished.' });
      return;
    }
    const player = getRoomPlayer(room, sessionId);
    if (!player || player.disconnected) {
      socket.emit('game-error', { message: 'Your connection is disconnected. Wait for reconnection.' });
      return;
    }
    if (!room.drawOfferBy || room.drawOfferBy === player.color) {
      socket.emit('game-error', { message: 'There is no pending draw offer for you.' });
      return;
    }
    if (accept) {
      finishRoom(room, 'draw', 'Draw by agreement');
      return;
    }
    room.drawOfferBy = null;
    broadcast(room);
  });

  socket.on('request-rematch', () => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) {
      socket.emit('game-error', { message: 'Session not identified. Refresh and try again.' });
      return;
    }
    const session = sessionToRoom.get(sessionId);
    if (!session) {
      socket.emit('game-error', { message: 'You are not in an active room.' });
      return;
    }
    const room = rooms.get(session.roomCode);
    if (!room || !room.black) {
      socket.emit('game-error', { message: 'This room is not valid for a rematch.' });
      return;
    }
    const player = getRoomPlayer(room, sessionId);
    if (!player) {
      socket.emit('game-error', { message: 'You are not in this room.' });
      return;
    }
    if (!room.resultReason) {
      socket.emit('game-error', { message: 'The game is still in progress.' });
      return;
    }

    room.rematchRequests[player.color] = true;
    if (room.rematchRequests.w && room.rematchRequests.b) {
      const previousWhite = room.white;
      const previousBlack = room.black;

      if (previousWhite && previousBlack) {
        const nextWhitePlayer = { ...previousBlack, color: 'w' as const, disconnected: false, socketId: previousBlack.socketId };
        const nextBlackPlayer = { ...previousWhite, color: 'b' as const, disconnected: false, socketId: previousWhite.socketId };

        room.white = nextWhitePlayer;
        room.black = nextBlackPlayer;

        const nextWhiteSocket = nextWhitePlayer.socketId ? io.sockets.sockets.get(nextWhitePlayer.socketId) : null;
        const nextBlackSocket = nextBlackPlayer.socketId ? io.sockets.sockets.get(nextBlackPlayer.socketId) : null;

        if (nextWhiteSocket) {
          nextWhiteSocket.data.sessionId = nextWhitePlayer.sessionId;
          nextWhiteSocket.data.roomCode = room.code;
          nextWhiteSocket.join(room.code);
        }
        if (nextBlackSocket) {
          nextBlackSocket.data.sessionId = nextBlackPlayer.sessionId;
          nextBlackSocket.data.roomCode = room.code;
          nextBlackSocket.join(room.code);
        }

        sessionToRoom.set(nextWhitePlayer.sessionId, { roomCode: room.code, color: 'w', role: 'player' });
        sessionToRoom.set(nextBlackPlayer.sessionId, { roomCode: room.code, color: 'b', role: 'player' });
      }

      room.chess = new Chess();
      room.whiteTimeMs = timeControlToMs(room.timeControl);
      room.blackTimeMs = timeControlToMs(room.timeControl);
      room.turnStartedAt = Date.now();
      room.timeoutColor = null;
      room.resultReason = null;
      room.winner = null;
      room.drawOfferBy = null;
      room.rematchRequests = { w: false, b: false };
      room.abandonedBy = null;
      room.chatMessages = [];
      room.lastUpdated = Date.now();
      emitPlayerAssignments(room);
      broadcast(room);
      return;
    }

    broadcast(room);
  });

  socket.on('respond-rematch', ({ accept }) => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) {
      socket.emit('game-error', { message: 'Session not identified. Refresh and try again.' });
      return;
    }
    if (typeof accept !== 'boolean') {
      socket.emit('game-error', { message: 'Invalid rematch response.' });
      return;
    }

    const session = sessionToRoom.get(sessionId);
    if (!session) {
      socket.emit('game-error', { message: 'You are not in an active room.' });
      return;
    }

    const room = rooms.get(session.roomCode);
    if (!room || !room.black) {
      socket.emit('game-error', { message: 'This room is not valid for rematch approval.' });
      return;
    }

    const player = getRoomPlayer(room, sessionId);
    if (!player) {
      socket.emit('game-error', { message: 'You are not in this room.' });
      return;
    }

    if (!room.resultReason) {
      socket.emit('game-error', { message: 'There is no finished game to rematch.' });
      return;
    }

    if (accept) {
      room.rematchRequests[player.color] = true;
    } else {
      room.rematchRequests = { w: false, b: false };
      room.chatMessages = [];
      broadcast(room);
      return;
    }

    if (room.rematchRequests.w && room.rematchRequests.b) {
      const previousWhite = room.white;
      const previousBlack = room.black;

      if (previousWhite && previousBlack) {
        const nextWhitePlayer = { ...previousBlack, color: 'w' as const, disconnected: false, socketId: previousBlack.socketId };
        const nextBlackPlayer = { ...previousWhite, color: 'b' as const, disconnected: false, socketId: previousWhite.socketId };

        room.white = nextWhitePlayer;
        room.black = nextBlackPlayer;

        const nextWhiteSocket = nextWhitePlayer.socketId ? io.sockets.sockets.get(nextWhitePlayer.socketId) : null;
        const nextBlackSocket = nextBlackPlayer.socketId ? io.sockets.sockets.get(nextBlackPlayer.socketId) : null;

        if (nextWhiteSocket) {
          nextWhiteSocket.data.sessionId = nextWhitePlayer.sessionId;
          nextWhiteSocket.data.roomCode = room.code;
          nextWhiteSocket.join(room.code);
        }
        if (nextBlackSocket) {
          nextBlackSocket.data.sessionId = nextBlackPlayer.sessionId;
          nextBlackSocket.data.roomCode = room.code;
          nextBlackSocket.join(room.code);
        }

        sessionToRoom.set(nextWhitePlayer.sessionId, { roomCode: room.code, color: 'w', role: 'player' });
        sessionToRoom.set(nextBlackPlayer.sessionId, { roomCode: room.code, color: 'b', role: 'player' });
      }

      room.chess = new Chess();
      room.whiteTimeMs = timeControlToMs(room.timeControl);
      room.blackTimeMs = timeControlToMs(room.timeControl);
      room.turnStartedAt = Date.now();
      room.timeoutColor = null;
      room.resultReason = null;
      room.winner = null;
      room.drawOfferBy = null;
      room.rematchRequests = { w: false, b: false };
      room.abandonedBy = null;
      room.chatMessages = [];
      room.lastUpdated = Date.now();
      emitPlayerAssignments(room);
      broadcast(room);
      return;
    }

    broadcast(room);
  });

  socket.on('send-chat', ({ message }) => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) {
      socket.emit('game-error', { message: 'Session not identified. Refresh and try again.' });
      return;
    }

    const session = sessionToRoom.get(sessionId);
    if (!session) {
      socket.emit('game-error', { message: 'You are not in an active room.' });
      return;
    }

    const room = rooms.get(session.roomCode);
    if (!room || !room.black) {
      socket.emit('game-error', { message: 'Join a room before sending a message.' });
      return;
    }

    const player = getRoomPlayer(room, sessionId);
    const spectator = getRoomSpectator(room, sessionId);
    if (!player && !spectator) {
      socket.emit('game-error', { message: 'You are not in this room.' });
      return;
    }
    if (room.resultReason) {
      socket.emit('game-error', { message: 'Chat closes once the room ends.' });
      return;
    }

    const sanitized = sanitizeChatMessage(message);
    if (!sanitized) {
      socket.emit('game-error', { message: 'Message is empty or invalid.' });
      return;
    }
    if (sanitized.length > MAX_CHAT_MESSAGE_LENGTH) {
      socket.emit('game-error', { message: `Chat messages are limited to ${MAX_CHAT_MESSAGE_LENGTH} characters.` });
      return;
    }

    const lastChatAt = Number(socket.data.lastChatAt ?? 0);
    if (Date.now() - lastChatAt < 800) {
      socket.emit('game-error', { message: 'Please slow down. Try again in a moment.' });
      return;
    }
    socket.data.lastChatAt = Date.now();

    room.chatMessages = [...room.chatMessages.slice(-19), {
      id: `chat-${randomBytes(8).toString('hex')}`,
      sender: player?.name ?? spectator?.name ?? 'Spectator',
      message: sanitized,
      color: player?.color ?? 'system',
      sentAt: Date.now(),
    }];
    broadcast(room);
  });

  socket.on('leave-room', () => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) return;

    const session = sessionToRoom.get(sessionId);
    if (!session) {
      socket.data.sessionId = undefined;
      socket.data.roomCode = undefined;
      return;
    }

    const room = rooms.get(session.roomCode);
    if (!room) {
      sessionToRoom.delete(sessionId);
      socket.data.sessionId = undefined;
      socket.data.roomCode = undefined;
      return;
    }

    const player = getRoomPlayer(room, sessionId);
    const spectator = getRoomSpectator(room, sessionId);

    socket.leave(room.code);
    socket.data.sessionId = undefined;
    socket.data.roomCode = undefined;
    sessionToRoom.delete(sessionId);

    if (player) {
      if (room.white?.sessionId === sessionId) room.white = null;
      if (room.black?.sessionId === sessionId) room.black = null;

      clearRoomCleanup(room.code);

      if (!room.white && !room.black) {
        rooms.delete(room.code);
        return;
      }

      const remainingPlayer = room.white ?? room.black;
      if (remainingPlayer) {
        remainingPlayer.socketId = null;
        remainingPlayer.disconnected = true;
        room.abandonedBy = remainingPlayer.color;
        room.lastUpdated = Date.now();
        scheduleRoomCleanup(room, remainingPlayer.color);
      }
      broadcast(room);
      return;
    }

    if (spectator) {
      room.spectators = room.spectators.filter((entry) => entry.sessionId !== sessionId);
      room.lastUpdated = Date.now();
      if (room.white || room.black || room.spectators.length) {
        broadcast(room);
      }
    }
  });

  socket.on('disconnect', () => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) return;

    const session = sessionToRoom.get(sessionId);
    if (!session) return;

    const room = rooms.get(session.roomCode);
    if (!room) {
      sessionToRoom.delete(sessionId);
      return;
    }

    const player = getRoomPlayer(room, sessionId);
    const spectator = getRoomSpectator(room, sessionId);
    if (player) {
      if (player.socketId !== socket.id) {
        return;
      }

      player.socketId = null;
      player.disconnected = true;
      room.lastUpdated = Date.now();

      if (room.white?.disconnected && room.black?.disconnected) {
        if (room.abandonedBy === null) room.abandonedBy = room.white.disconnected ? 'w' : 'b';
        if (room.black) {
          sessionToRoom.delete(room.black.sessionId);
        }
        if (room.white) {
          sessionToRoom.delete(room.white.sessionId);
        }
        rooms.delete(room.code);
        clearRoomCleanup(room.code);
        return;
      }

      clearRoomCleanup(room.code);
      scheduleRoomCleanup(room, player.color);
      broadcast(room);
      return;
    }

    if (spectator) {
      spectator.socketId = null;
      spectator.disconnected = true;
      room.spectators = room.spectators.filter((entry) => entry.sessionId !== sessionId);
      room.lastUpdated = Date.now();
      sessionToRoom.delete(sessionId);
      broadcast(room);
    }
  });
});

app.get('/api/status', (_request, response) => response.json({ online: true, lanIp: getLanIp(), port: PORT } satisfies ServerStatus));

const clientCandidates = [
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client'),
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../client'),
  path.resolve(process.cwd(), 'client'),
];
const clientDirectory = clientCandidates.find((candidate) => existsSync(candidate));
if (clientDirectory) {
  app.use(express.static(clientDirectory));
  app.use((request, response, next) => {
    if (request.path.startsWith('/api')) return next();
    response.sendFile(path.join(clientDirectory, 'index.html'));
  });
}

runClockTicker();

httpServer.listen(PORT, HOST, () => {
  console.info(`LAN Chess server listening on http://${HOST}:${PORT}`);
  if (hostUrl()) console.info(`LAN access: ${hostUrl()}`);
});
