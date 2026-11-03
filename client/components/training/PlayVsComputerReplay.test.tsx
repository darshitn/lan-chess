// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Chess } from 'chess.js';
import { expect, it, vi } from 'vitest';
import { PlayVsComputer } from './PlayVsComputer.js';
import { BUILTIN_BOARD_THEMES, DEFAULT_PREFERENCES } from '../../services/preferences.js';
import type { ComputerGameState } from '../../services/computer-game-controller.js';

const bridge = vi.hoisted(() => ({ publish: (_state: ComputerGameState) => {}, makeMove: vi.fn() }));
vi.mock('../../services/computer-game-controller.js', () => ({
  getMinimumComputerTurnMs: () => 0,
  ComputerGameController: class {
    subscribeState(fn: typeof bridge.publish) { bridge.publish = fn; return () => {}; }
    subscribeSound() { return () => {}; }
    async startNewGame() {}
    makeHumanMove = bridge.makeMove;
    dispose() {}
  },
}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it('replays computer moves without changing the live controller and restores interaction', async () => {
  const state = (sans: string[]): ComputerGameState => {
    const chess = new Chess();
    const moves = sans.map(san => { const m = chess.move(san); return { from: m.from, to: m.to, san: m.san, color: m.color }; });
    return { fen: chess.fen(), moves, turn: chess.turn(), status: 'active', humanColor: 'w', computerColor: 'b', difficulty: 'medium', timeControl: '3+2', whiteTimeMs: 123000, blackTimeMs: 124000, winner: null, reason: null, isEngineThinking: false, engineError: null };
  };
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const square = (name: string) => container.querySelector<HTMLButtonElement>(`[data-square="${name}"]`)!;
  try {
    await act(async () => root.render(<PlayVsComputer initialConfig={{ playerName: 'Test', colorChoice: 'w', difficulty: 'medium', timeControl: '3+2' }} theme={BUILTIN_BOARD_THEMES[0]} pieceSet="classic" highlightStyle="classic" boardSettings={DEFAULT_PREFERENCES.boardSettings} soundSettings={DEFAULT_PREFERENCES.sound} onBackToLobby={() => {}} onReviewGame={() => {}} onOpenSettings={() => {}} />));
    act(() => bridge.publish(state(['e4', 'e5'])));
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Previous move"]')!.click());
    expect(square('e7').getAttribute('aria-label')).toContain('black Pawn');
    act(() => square('d2').click());
    act(() => square('d4').click());
    expect(bridge.makeMove).not.toHaveBeenCalled();
    act(() => bridge.publish(state(['e4', 'e5', 'Nf3', 'Nc6'])));
    expect(square('g1').getAttribute('aria-label')).toContain('white Knight');
    expect(container.textContent).toContain('1/4');
    act(() => Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Live')!.click());
    expect(square('c6').getAttribute('aria-label')).toContain('black Knight');
    act(() => square('d2').click());
    act(() => square('d4').click());
    expect(bridge.makeMove).toHaveBeenCalledWith('d2', 'd4');
    act(() => container.querySelector<HTMLButtonElement>('[aria-label="Previous move"]')!.click());
    act(() => bridge.publish(state([])));
    expect(container.textContent).toContain('Live position');
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});
