// @vitest-environment happy-dom
import React, { act, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Chess, type Move, type Square } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { Chessboard } from './Chessboard.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function TapBoard() {
  const chess = useMemo(() => new Chess(), []);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const legalTargets = useMemo(() => {
    if (!selectedSquare) return new Map<Square, Move>();
    return new Map(chess.moves({ square: selectedSquare, verbose: true }).map((move) => [move.to, move]));
  }, [chess, selectedSquare]);

  return (
    <Chessboard
      chess={chess}
      flipped={false}
      selectedSquare={selectedSquare}
      legalTargets={legalTargets}
      lastMove={null}
      isInteractive
      onSquareClick={setSelectedSquare}
      onPieceDrop={() => {}}
    />
  );
}

describe('Chessboard touch-style selection', () => {
  it('selects a piece through its glyph and renders legal-move dots', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<TapBoard />));
    const pawn = container.querySelector<HTMLElement>('[data-square="e2"] .piece');
    expect(pawn).not.toBeNull();
    act(() => pawn!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.querySelector('[data-square="e3"] .legal-dot')).not.toBeNull();
    expect(container.querySelector('[data-square="e4"] .legal-dot')).not.toBeNull();
    act(() => root.unmount());
    container.remove();
  });
});
