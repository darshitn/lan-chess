// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Chess } from 'chess.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameState, PlayerColor } from '../shared/types.js';
import { App } from './App.js';

const { listeners, socket } = vi.hoisted(() => {
  const listeners = new Map<string, (payload: unknown) => void>();
  const socket = {
    io: { on: vi.fn(), off: vi.fn() },
    on: vi.fn((event: string, handler: (payload: unknown) => void) => {
      listeners.set(event, handler);
    }),
    off: vi.fn((event: string) => {
      listeners.delete(event);
    }),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  return { listeners, socket };
});

vi.mock('socket.io-client', () => ({ io: () => socket }));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  listeners.clear();
  socket.emit.mockClear();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

function finishedGame(): GameState {
  const chess = new Chess();
  const move = chess.move('e4');
  return {
    roomCode: 'ABCD',
    fen: chess.fen(),
    moves: [{ from: move.from, to: move.to, san: move.san, color: 'w' }],
    whiteName: 'White Player',
    blackName: 'Black Player',
    turn: 'b',
    status: 'finished',
    message: 'Black resigned',
    timeControl: '3+2',
    whiteTimeMs: 179000,
    blackTimeMs: 180000,
    winner: 'w',
    reason: 'Black resigned',
    drawOfferBy: null,
    takebackRequestedBy: null,
    allowTakebacks: true,
    rematchRequests: { w: false, b: false },
    chatMessages: [],
    spectatorCount: 0,
  };
}

describe('completed LAN game review', () => {
  for (const playerColor of ['w', 'b'] as PlayerColor[]) {
    it(`opens the replay for the ${playerColor === 'w' ? 'host' : 'guest'} while still in the room`, async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      try {
        await act(async () => root.render(<App />));
        await act(async () => {
          listeners.get('room-joined')?.({
            roomCode: 'ABCD',
            playerColor,
            sessionId: `player-${playerColor}`,
            role: 'player',
          });
          listeners.get('game-state')?.(finishedGame());
        });

        const reviewButton = Array.from(container.querySelectorAll('button')).find(
          (button) => button.textContent?.includes('Review Game & Analysis')
        );
        expect(reviewButton).toBeDefined();

        await act(async () => reviewButton?.click());
        expect(container.textContent).toContain('Game Review & Replay');
        expect(container.textContent).toContain('White Player vs Black Player');
        expect(container.textContent).toContain('e4');

        const exitButton = Array.from(container.querySelectorAll('button')).find(
          (button) => button.textContent?.includes('Exit Review')
        );
        await act(async () => exitButton?.click());
        expect(container.textContent).toContain('Review Game & Analysis');
        expect(socket.emit).not.toHaveBeenCalledWith('leave-room');
      } finally {
        await act(async () => root.unmount());
        container.remove();
      }
    });
  }
});
