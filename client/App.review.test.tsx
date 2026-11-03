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

describe('live LAN replay arrows', () => {
  function activeGame(sans: string[]): GameState {
    const chess = new Chess();
    const moves = sans.map((san) => {
      const move = chess.move(san);
      return { from: move.from, to: move.to, san: move.san, color: move.color };
    });
    return { ...finishedGame(), fen: chess.fen(), moves, turn: chess.turn(), status: 'active', winner: null, reason: null, message: 'Game in progress' };
  }

  for (const role of ['player', 'spectator'] as const) {
    it(`keeps live updates separate from replay for a ${role}`, async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      const square = (name: string) => container.querySelector<HTMLButtonElement>(`[data-square="${name}"]`)!;
      const button = (label: string) => container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
      try {
        await act(async () => root.render(<App />));
        await act(async () => {
          listeners.get('room-joined')?.({ roomCode: 'ABCD', playerColor: role === 'player' ? 'w' : null, sessionId: 'replay-test', role });
          listeners.get('game-state')?.(activeGame(['e4', 'e5', 'Nf3']));
        });
        expect(square('f3').getAttribute('aria-label')).toContain('white Knight');
        act(() => button('Previous move').click());
        expect(square('g1').getAttribute('aria-label')).toContain('white Knight');
        socket.emit.mockClear();
        act(() => { square('d2').click(); square('d4').click(); });
        expect(socket.emit).not.toHaveBeenCalledWith('make-move', expect.anything());
        await act(async () => {
          listeners.get('game-state')?.(activeGame(['e4', 'e5', 'Nf3', 'Nc6']));
          listeners.get('clock-update')?.({ roomCode: 'ABCD', whiteTimeMs: 123000, blackTimeMs: 124000 });
        });
        expect(square('g1').getAttribute('aria-label')).toContain('white Knight');
        expect(container.textContent).toContain('2/4');
        const live = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Live')!;
        act(() => live.click());
        expect(square('c6').getAttribute('aria-label')).toContain('black Knight');
        if (role === 'player') {
          act(() => square('d2').click());
          act(() => square('d4').click());
          expect(socket.emit).toHaveBeenCalledWith('make-move', expect.objectContaining({ from: 'd2', to: 'd4' }));
        }
        act(() => button('Previous move').click());
        await act(async () => listeners.get('game-state')?.(activeGame([])));
        expect(container.textContent).toContain('Live position');
        expect(button('Previous move').disabled).toBe(true);
      } finally {
        act(() => root.unmount());
        container.remove();
      }
    });
  }
});
