import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import { Server } from 'socket.io';
import {
  type ClientToServerEvents,
  type PlayerColor,
  type ServerStatus,
  type ServerToClientEvents,
  SOCKET_EVENTS,
} from '../shared/types.js';
import { getLanIp } from './network.js';
import { RoomManager, type Room } from './room-manager.js';
import {
  MAX_CHAT_MESSAGE_LENGTH,
  sanitizeChatMessage,
} from './validation.js';

interface SocketData {
  sessionId?: string;
  roomCode?: string;
  lastChatAt?: number;
}

const PORT = Number(process.env.PORT ?? 3001);
const HOST = '0.0.0.0';

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
  cors: { origin: true },
});

const roomManager = new RoomManager();

function getHostUrl(): string | null {
  const ip = getLanIp();
  return ip ? `http://${ip}:${PORT}` : null;
}

function broadcastRoomState(room: Room) {
  const state = roomManager.stateFor(room);
  io.to(room.code).emit(SOCKET_EVENTS.GAME_STATE, state);
}

function emitAssignments(room: Room) {
  if (room.white?.socketId) {
    io.to(room.white.socketId).emit(SOCKET_EVENTS.ROOM_JOINED, {
      roomCode: room.code,
      playerColor: 'w',
      sessionId: room.white.sessionId,
      role: 'player',
    });
  }
  if (room.black?.socketId) {
    io.to(room.black.socketId).emit(SOCKET_EVENTS.ROOM_JOINED, {
      roomCode: room.code,
      playerColor: 'b',
      sessionId: room.black.sessionId,
      role: 'player',
    });
  }
  for (const spec of room.spectators) {
    if (spec.socketId) {
      io.to(spec.socketId).emit(SOCKET_EVENTS.ROOM_JOINED, {
        roomCode: room.code,
        playerColor: null,
        sessionId: spec.sessionId,
        role: 'spectator',
      });
    }
  }
}

io.on('connection', (socket) => {
  socket.emit(SOCKET_EVENTS.CONNECTION_STATUS, { status: 'connected' });

  // Flood guard: drop events from a socket that exceeds a generous per-second
  // budget so a malicious client cannot flood room broadcasts.
  let floodWindowStart = Date.now();
  let floodEventCount = 0;
  const FLOOD_LIMIT = 80;
  socket.use((_event, next) => {
    const now = Date.now();
    if (now - floodWindowStart >= 1000) {
      floodWindowStart = now;
      floodEventCount = 0;
    }
    floodEventCount += 1;
    if (floodEventCount > FLOOD_LIMIT) return;
    next();
  });

  socket.on(SOCKET_EVENTS.IDENTIFY_SESSION, ({ sessionId }) => {
    if (!sessionId) return;
    // A socket identifying with a new session must not leave its previous
    // seat marked as connected with a dead socketId (ghost player).
    const previousSessionId = socket.data.sessionId;
    if (previousSessionId && previousSessionId !== sessionId) {
      roomManager.leaveCurrentSession(previousSessionId);
    }
    const session = roomManager.getSession(sessionId);
    if (!session) return;

    const room = roomManager.getRoom(session.roomCode);
    if (!room) {
      roomManager.sessionToRoom.delete(sessionId);
      return;
    }

    socket.data.sessionId = sessionId;
    socket.data.roomCode = room.code;
    socket.join(room.code);

    if (session.role === 'player') {
      const player = roomManager.getRoomPlayer(room, sessionId);
      if (player) {
        // Evict any previous socket still holding this seat so a stale socket's
        // later disconnect cannot mark the live player as disconnected.
        if (player.socketId && player.socketId !== socket.id) {
          const oldSocket = io.sockets.sockets.get(player.socketId);
          if (oldSocket) {
            oldSocket.leave(room.code);
            oldSocket.data.sessionId = undefined;
            oldSocket.data.roomCode = undefined;
          }
        }
        player.socketId = socket.id;
        roomManager.rejoinPlayer(room, player, (abandonedRoom) => broadcastRoomState(abandonedRoom));
        socket.emit(SOCKET_EVENTS.ROOM_JOINED, {
          roomCode: room.code,
          playerColor: player.color,
          sessionId: player.sessionId,
          role: 'player',
        });
      }
    } else {
      const spec = roomManager.getRoomSpectator(room, sessionId);
      if (spec) {
        if (spec.socketId && spec.socketId !== socket.id) {
          const oldSocket = io.sockets.sockets.get(spec.socketId);
          if (oldSocket) {
            oldSocket.leave(room.code);
            oldSocket.data.sessionId = undefined;
            oldSocket.data.roomCode = undefined;
          }
        }
        spec.socketId = socket.id;
        spec.disconnected = false;
        socket.emit(SOCKET_EVENTS.ROOM_JOINED, {
          roomCode: room.code,
          playerColor: null,
          sessionId: spec.sessionId,
          role: 'spectator',
        });
      }
    }

    broadcastRoomState(room);
  });

  socket.on(SOCKET_EVENTS.CREATE_GAME, ({ playerName, sessionId, timeControl, allowTakebacks }) => {
    const result = roomManager.createGame(playerName, sessionId, timeControl, socket.id, allowTakebacks ?? true);
    if ('error' in result) {
      socket.emit(SOCKET_EVENTS.GAME_ERROR, { message: result.error });
      return;
    }

    const { room, player } = result;
    socket.data.sessionId = player.sessionId;
    socket.data.roomCode = room.code;
    socket.join(room.code);

    socket.emit(SOCKET_EVENTS.ROOM_CREATED, {
      roomCode: room.code,
      playerColor: 'w',
      sessionId: player.sessionId,
      hostUrl: getHostUrl(),
    });

    broadcastRoomState(room);
  });

  socket.on(SOCKET_EVENTS.JOIN_GAME, ({ roomCode, playerName, sessionId }) => {
    const result = roomManager.joinGame(roomCode, playerName, sessionId, socket.id);
    if ('error' in result) {
      socket.emit(SOCKET_EVENTS.GAME_ERROR, { message: result.error });
      return;
    }

    const { room, player } = result;
    socket.data.sessionId = player.sessionId;
    socket.data.roomCode = room.code;
    socket.join(room.code);

    socket.emit(SOCKET_EVENTS.ROOM_JOINED, {
      roomCode: room.code,
      playerColor: player.color,
      sessionId: player.sessionId,
      role: 'player',
    });

    broadcastRoomState(room);
  });

  socket.on(SOCKET_EVENTS.JOIN_SPECTATOR, ({ roomCode, playerName, sessionId }) => {
    const result = roomManager.joinSpectator(roomCode, playerName, sessionId, socket.id);
    if ('error' in result) {
      socket.emit(SOCKET_EVENTS.GAME_ERROR, { message: result.error });
      return;
    }

    const { room, spectator } = result;
    socket.data.sessionId = spectator.sessionId;
    socket.data.roomCode = room.code;
    socket.join(room.code);

    socket.emit(SOCKET_EVENTS.ROOM_JOINED, {
      roomCode: room.code,
      playerColor: null,
      sessionId: spectator.sessionId,
      role: 'spectator',
    });

    broadcastRoomState(room);
  });

  socket.on(SOCKET_EVENTS.MAKE_MOVE, ({ from, to, promotion }) => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) {
      socket.emit(SOCKET_EVENTS.GAME_ERROR, { message: 'Session not identified.' });
      return;
    }

    const session = roomManager.getSession(sessionId);
    if (!session || session.role !== 'player') {
      socket.emit(SOCKET_EVENTS.GAME_ERROR, { message: 'Only active players can make moves.' });
      return;
    }

    const room = roomManager.getRoom(session.roomCode);
    if (!room) {
      socket.emit(SOCKET_EVENTS.GAME_ERROR, { message: 'Room not found.' });
      return;
    }

    const moveResult = roomManager.makeMove(room, sessionId, from, to, promotion);
    if ('error' in moveResult) {
      // A move attempt that flagged the mover on time finishes the room; the
      // players must receive the finished state even though the move errored.
      if (moveResult.finished) {
        broadcastRoomState(room);
      }
      socket.emit(SOCKET_EVENTS.GAME_ERROR, { message: moveResult.error });
      return;
    }

    broadcastRoomState(room);
  });

  socket.on(SOCKET_EVENTS.RESIGN_GAME, () => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) return;

    const session = roomManager.getSession(sessionId);
    if (!session || session.role !== 'player') return;

    const room = roomManager.getRoom(session.roomCode);
    if (!room || room.resultReason || !room.black) return;

    const player = roomManager.getRoomPlayer(room, sessionId);
    if (!player) return;

    const winner: PlayerColor = player.color === 'w' ? 'b' : 'w';
    const winnerName = player.color === 'w' ? (room.black?.name ?? 'Black') : (room.white?.name ?? 'White');
    roomManager.finishRoom(room, winner, `${player.name} resigned. ${winnerName} wins.`);
    broadcastRoomState(room);
  });

  socket.on(SOCKET_EVENTS.OFFER_DRAW, () => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) return;

    const session = roomManager.getSession(sessionId);
    if (!session || session.role !== 'player') return;

    const room = roomManager.getRoom(session.roomCode);
    if (!room || room.resultReason || !room.black) return;

    const player = roomManager.getRoomPlayer(room, sessionId);
    if (!player) return;

    if (room.drawOfferBy === player.color) return;

    room.drawOfferBy = player.color;
    room.lastUpdated = Date.now();
    broadcastRoomState(room);
  });

  socket.on(SOCKET_EVENTS.RESPOND_DRAW, ({ accept }) => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) return;

    const session = roomManager.getSession(sessionId);
    if (!session || session.role !== 'player') return;

    const room = roomManager.getRoom(session.roomCode);
    if (!room || room.resultReason || !room.drawOfferBy) return;

    const player = roomManager.getRoomPlayer(room, sessionId);
    if (!player || player.color === room.drawOfferBy) return;

    if (accept) {
      roomManager.finishRoom(room, 'draw', 'Draw agreed by both players.');
    } else {
      room.drawOfferBy = null;
      room.lastUpdated = Date.now();
    }
    broadcastRoomState(room);
  });

  socket.on(SOCKET_EVENTS.REQUEST_TAKEBACK, () => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) return;

    const session = roomManager.getSession(sessionId);
    if (!session || session.role !== 'player') return;

    const room = roomManager.getRoom(session.roomCode);
    if (!room) return;

    const result = roomManager.requestTakeback(room, sessionId);
    if (result.error) {
      socket.emit(SOCKET_EVENTS.GAME_ERROR, { message: result.error });
      return;
    }

    broadcastRoomState(room);
  });

  socket.on(SOCKET_EVENTS.RESPOND_TAKEBACK, ({ accept }) => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) return;

    const session = roomManager.getSession(sessionId);
    if (!session || session.role !== 'player') return;

    const room = roomManager.getRoom(session.roomCode);
    if (!room) return;

    const result = roomManager.respondTakeback(room, sessionId, accept);
    if (result.error) {
      socket.emit(SOCKET_EVENTS.GAME_ERROR, { message: result.error });
      return;
    }

    broadcastRoomState(room);
  });

  socket.on(SOCKET_EVENTS.REQUEST_REMATCH, () => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) return;

    const session = roomManager.getSession(sessionId);
    if (!session || session.role !== 'player') return;

    const room = roomManager.getRoom(session.roomCode);
    if (!room || !room.resultReason || !room.black) {
      socket.emit(SOCKET_EVENTS.GAME_ERROR, { message: 'A rematch can only be requested after game completion.' });
      return;
    }

    const player = roomManager.getRoomPlayer(room, sessionId);
    if (!player) return;

    // Nothing changed if this player already requested the rematch.
    if (room.rematchRequests[player.color]) return;

    room.rematchRequests[player.color] = true;
    room.lastUpdated = Date.now();

    if (room.rematchRequests.w && room.rematchRequests.b) {
      roomManager.handleRematchAgreement(room);
      emitAssignments(room);
    }

    broadcastRoomState(room);
  });

  socket.on(SOCKET_EVENTS.RESPOND_REMATCH, ({ accept }) => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) return;

    const session = roomManager.getSession(sessionId);
    if (!session || session.role !== 'player') return;

    const room = roomManager.getRoom(session.roomCode);
    if (!room || !room.resultReason || !room.black) return;

    const player = roomManager.getRoomPlayer(room, sessionId);
    if (!player) return;

    if (accept) {
      room.rematchRequests[player.color] = true;
      room.lastUpdated = Date.now();
      if (room.rematchRequests.w && room.rematchRequests.b) {
        roomManager.handleRematchAgreement(room);
        emitAssignments(room);
      }
    } else {
      const hadRequest = room.rematchRequests.w || room.rematchRequests.b;
      room.rematchRequests = { w: false, b: false };
      room.lastUpdated = Date.now();
      if (!hadRequest) return; // nothing changed; skip the broadcast
    }

    broadcastRoomState(room);
  });

  socket.on(SOCKET_EVENTS.SEND_CHAT, ({ message }) => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) {
      socket.emit(SOCKET_EVENTS.GAME_ERROR, { message: 'Session not identified.' });
      return;
    }

    const session = roomManager.getSession(sessionId);
    if (!session) {
      socket.emit(SOCKET_EVENTS.GAME_ERROR, { message: 'You are not in an active room.' });
      return;
    }

    const room = roomManager.getRoom(session.roomCode);
    if (!room) {
      socket.emit(SOCKET_EVENTS.GAME_ERROR, { message: 'Room not found.' });
      return;
    }

    const player = roomManager.getRoomPlayer(room, sessionId);
    const spectator = roomManager.getRoomSpectator(room, sessionId);
    if (!player && !spectator) {
      socket.emit(SOCKET_EVENTS.GAME_ERROR, { message: 'You are not a participant in this room.' });
      return;
    }

    if (typeof message !== 'string' || message.length > 500) {
      socket.emit(SOCKET_EVENTS.GAME_ERROR, { message: `Messages are limited to ${MAX_CHAT_MESSAGE_LENGTH} characters.` });
      return;
    }

    const sanitized = sanitizeChatMessage(message);
    if (!sanitized) {
      socket.emit(SOCKET_EVENTS.GAME_ERROR, { message: 'Message is empty or invalid.' });
      return;
    }

    const lastChatAt = Number(socket.data.lastChatAt ?? 0);
    if (Date.now() - lastChatAt < 800) {
      socket.emit(SOCKET_EVENTS.GAME_ERROR, { message: 'Please slow down. Try again in a moment.' });
      return;
    }
    socket.data.lastChatAt = Date.now();

    const chatItem = {
      id: `chat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      sender: player?.name ?? spectator?.name ?? 'Spectator',
      senderSessionId: sessionId,
      message: sanitized,
      color: player?.color ?? ('system' as const),
      sentAt: Date.now(),
    };

    room.chatMessages = [...room.chatMessages.slice(-29), chatItem];
    room.lastUpdated = Date.now();
    broadcastRoomState(room);
  });

  socket.on(SOCKET_EVENTS.LEAVE_ROOM, () => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) return;

    const session = roomManager.getSession(sessionId);
    if (session) {
      socket.leave(session.roomCode);
      const room = roomManager.getRoom(session.roomCode);
      roomManager.leaveCurrentSession(sessionId);
      if (room) {
        broadcastRoomState(room);
      }
    }

    socket.data.sessionId = undefined;
    socket.data.roomCode = undefined;
  });

  socket.on('disconnect', () => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) return;

    const session = roomManager.getSession(sessionId);
    if (!session) return;

    const room = roomManager.getRoom(session.roomCode);
    if (!room) {
      roomManager.sessionToRoom.delete(sessionId);
      return;
    }

    if (session.role === 'player') {
      const player = roomManager.getRoomPlayer(room, sessionId);
      if (player) {
        // A newer socket may already own this seat (fast reconnect while the old
        // connection is still timing out) — only the owning socket may mark it.
        if (player.socketId && player.socketId !== socket.id) return;

        player.socketId = null;
        player.disconnected = true;
        room.lastUpdated = Date.now();

        // Mark when the clock paused so the reconnecting player is not charged
        // for the time they were offline.
        if (room.black && !room.resultReason && room.disconnectedAt === null) {
          room.disconnectedAt = Date.now();
        }

        // If game is active and Black is in room, schedule reconnection grace period
        if (room.black && !room.resultReason) {
          roomManager.scheduleRoomCleanup(room, player.color, (abandonedRoom) => {
            broadcastRoomState(abandonedRoom);
          });
        } else if (!room.black && !room.resultReason) {
          // Nobody ever joined this waiting room: reclaim it after the grace period.
          roomManager.scheduleWaitingRoomCleanup(room);
        }
        broadcastRoomState(room);
      }
    } else {
      const spec = roomManager.getRoomSpectator(room, sessionId);
      if (spec) {
        if (spec.socketId && spec.socketId !== socket.id) return;

        spec.socketId = null;
        spec.disconnected = true;
        room.spectators = room.spectators.filter((s) => s.sessionId !== sessionId);
        roomManager.sessionToRoom.delete(sessionId);
        room.lastUpdated = Date.now();
        broadcastRoomState(room);
      }
    }
  });
});

app.get('/api/status', (_request, response) => {
  response.json({
    online: true,
    lanIp: getLanIp(),
    port: PORT,
  } satisfies ServerStatus);
});

// Resolve client production and dev directories
const clientCandidates = [
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client'),
  path.resolve(process.cwd(), 'dist/client'),
  path.resolve(process.cwd(), 'client'),
];
const clientDirectory = clientCandidates.find((candidate) => existsSync(candidate));
if (clientDirectory) {
  app.use(express.static(clientDirectory));
  app.use((request, response, next) => {
    if (request.path.startsWith('/api') || request.path.startsWith('/socket.io')) return next();
    response.sendFile(path.join(clientDirectory, 'index.html'));
  });
}

// Clock ticker: enforces timeouts once per second. Ticking clocks are sent as a
// lightweight clock-update event instead of the full game state, which would
// re-send the entire move history and chat log every second.
setInterval(() => {
  const timedOutRoomCodes = roomManager.checkTimeouts();
  for (const code of timedOutRoomCodes) {
    const room = roomManager.getRoom(code);
    if (room) broadcastRoomState(room);
  }

  for (const room of roomManager.rooms.values()) {
    if (
      room.black &&
      !room.resultReason &&
      !room.timeoutColor &&
      room.timeControl !== 'unlimited' &&
      !timedOutRoomCodes.includes(room.code)
    ) {
      io.to(room.code).emit(SOCKET_EVENTS.CLOCK_UPDATE, {
        roomCode: room.code,
        whiteTimeMs: roomManager.getRemainingTime(room, 'w'),
        blackTimeMs: roomManager.getRemainingTime(room, 'b'),
      });
    }
  }
}, 1000);

// Sweep stale rooms inactive for > 1 hour
setInterval(() => {
  roomManager.sweepIdleRooms();
}, 10 * 60 * 1000);

httpServer.listen(PORT, HOST, () => {
  console.info(`LAN Chess server listening on http://${HOST}:${PORT}`);
  const url = getHostUrl();
  if (url) console.info(`LAN access: ${url}`);
});
