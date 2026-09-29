// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import {
  ChessPiece,
  PIECE_UNICODE_FALLBACK,
  type PieceSymbol,
} from './ChessPiece.js';
import type { PlayerColor } from '../../../shared/types.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ChessPiece SVG component', () => {
  const PIECE_TYPES: PieceSymbol[] = ['k', 'q', 'r', 'b', 'n', 'p'];
  const COLORS: PlayerColor[] = ['w', 'b'];

  it('renders all 12 Staunton pieces (6 white, 6 black) as valid SVGs', () => {
    for (const color of COLORS) {
      for (const type of PIECE_TYPES) {
        const container = document.createElement('div');
        const root = createRoot(container);
        act(() => root.render(<ChessPiece type={type} color={color} />));

        const svg = container.querySelector('svg');
        expect(svg).toBeTruthy();
        expect(svg?.getAttribute('viewBox')).toBe('0 0 45 45');
        expect(svg?.getAttribute('aria-hidden')).toBe('true');
        expect(svg?.classList.contains('chess-piece-svg')).toBe(true);
        expect(svg?.classList.contains(color === 'w' ? 'piece-svg-w' : 'piece-svg-b')).toBe(true);
        act(() => root.unmount());
      }
    }
  });

  it('includes fallback unicode characters for all pieces', () => {
    for (const color of COLORS) {
      for (const type of PIECE_TYPES) {
        expect(PIECE_UNICODE_FALLBACK[color][type]).toBeDefined();
        expect(typeof PIECE_UNICODE_FALLBACK[color][type]).toBe('string');
      }
    }
  });

  it('passes through custom className and styles', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() =>
      root.render(
        <ChessPiece
          type="q"
          color="w"
          className="custom-piece-test"
          style={{ transform: 'scale(1.2)' }}
        />
      )
    );

    const svg = container.querySelector('svg');
    expect(svg?.classList.contains('custom-piece-test')).toBe(true);
    expect(svg?.style.transform).toBe('scale(1.2)');
    root.unmount();
  });

  it('renders promotion choices (q, r, b, n) for both colors correctly', () => {
    const promotionChoices: PieceSymbol[] = ['q', 'r', 'b', 'n'];
    for (const color of COLORS) {
      for (const piece of promotionChoices) {
        const container = document.createElement('div');
        const root = createRoot(container);
        act(() =>
          root.render(
            <button type="button" aria-label={`Promote to ${piece}`}>
              <ChessPiece type={piece} color={color} className="w-12 h-12" />
            </button>
          )
        );

        const svg = container.querySelector('svg');
        expect(svg).toBeTruthy();
        expect(svg?.classList.contains('w-12')).toBe(true);
        act(() => root.unmount());
      }
    }
  });
});
