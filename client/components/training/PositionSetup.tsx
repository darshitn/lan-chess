import React, { useState } from 'react';
import { Chess, type PieceSymbol, type Square } from 'chess.js';
import type { PlayerColor } from '../../../shared/types.js';
import { FILES, RANKS, isLightSquare } from '../../utils/chess-helpers.js';
import { useModalBehavior } from '../../utils/modal-behavior.js';

interface PositionSetupProps {
  onApplyPosition: (fen: string) => void;
  onClose: () => void;
}

type PaletteItem = { type: PieceSymbol; color: PlayerColor } | null;

const PIECE_GLYPHS: Record<PlayerColor, Record<PieceSymbol, string>> = {
  w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
  b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' },
};

export const PositionSetup: React.FC<PositionSetupProps> = ({
  onApplyPosition,
  onClose,
}) => {
  const modalRef = useModalBehavior(onClose);
  // 8x8 board representation
  const [board, setBoard] = useState<Map<Square, { type: PieceSymbol; color: PlayerColor }>>(() => {
    const c = new Chess();
    const map = new Map<Square, { type: PieceSymbol; color: PlayerColor }>();
    for (const r of RANKS) {
      for (const f of FILES) {
        const sq = `${f}${r}` as Square;
        const p = c.get(sq);
        if (p) map.set(sq, { type: p.type, color: p.color });
      }
    }
    return map;
  });

  const [activePalette, setActivePalette] = useState<PaletteItem>({ type: 'p', color: 'w' });
  const [turn, setTurn] = useState<PlayerColor>('w');
  const [castling, setCastling] = useState({ K: true, Q: true, k: true, q: true });
  const [error, setError] = useState<string | null>(null);

  const handleSquareClick = (square: Square) => {
    setBoard((prev) => {
      const next = new Map(prev);
      if (!activePalette) {
        next.delete(square);
      } else {
        next.set(square, { ...activePalette });
      }
      return next;
    });
  };

  const handleClear = () => {
    setBoard(new Map());
  };

  const handleStartingPosition = () => {
    const c = new Chess();
    const map = new Map<Square, { type: PieceSymbol; color: PlayerColor }>();
    for (const r of RANKS) {
      for (const f of FILES) {
        const sq = `${f}${r}` as Square;
        const p = c.get(sq);
        if (p) map.set(sq, { type: p.type, color: p.color });
      }
    }
    setBoard(map);
    setTurn('w');
    setCastling({ K: true, Q: true, k: true, q: true });
  };

  const generateFen = (): string => {
    let fenRows: string[] = [];
    for (const r of RANKS) {
      let emptyCount = 0;
      let rowStr = '';
      for (const f of FILES) {
        const sq = `${f}${r}` as Square;
        const piece = board.get(sq);
        if (!piece) {
          emptyCount++;
        } else {
          if (emptyCount > 0) {
            rowStr += emptyCount;
            emptyCount = 0;
          }
          const char = piece.color === 'w' ? piece.type.toUpperCase() : piece.type.toLowerCase();
          rowStr += char;
        }
      }
      if (emptyCount > 0) rowStr += emptyCount;
      fenRows.push(rowStr);
    }

    const castlingStr =
      Object.entries(castling)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join('') || '-';

    return `${fenRows.join('/')} ${turn} ${castlingStr} - 0 1`;
  };

  const handleApply = () => {
    setError(null);
    const fen = generateFen();

    try {
      const testChess = new Chess();
      testChess.load(fen);
      onApplyPosition(fen);
    } catch {
      setError('Illegal position (ensure both kings exist and the inactive player is not in check).');
    }
  };

  return (
    <div
      className="promotion-backdrop z-50 p-3"
      role="dialog"
      aria-modal="true"
      aria-label="Custom Position Setup"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-amber-400">Position Editor</p>
            <h2 className="text-lg font-black text-white">Custom Board Setup</h2>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        {error && (
          <div className="mt-3 rounded-lg bg-rose-950 p-2.5 text-xs text-rose-300 border border-rose-800">
            {error}
          </div>
        )}

        {/* Piece Palette */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold text-slate-400 mr-1">White:</span>
            {(['k', 'q', 'r', 'b', 'n', 'p'] as PieceSymbol[]).map((t) => (
              <button
                key={`w-${t}`}
                type="button"
                onClick={() => setActivePalette({ type: t, color: 'w' })}
                className={`h-9 w-9 rounded border text-xl font-serif leading-none ${
                  activePalette?.type === t && activePalette?.color === 'w'
                    ? 'border-amber-400 bg-amber-400/20 text-white'
                    : 'border-slate-800 bg-slate-900 text-white'
                }`}
              >
                {PIECE_GLYPHS.w[t]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs font-bold text-slate-400 mr-1">Black:</span>
            {(['k', 'q', 'r', 'b', 'n', 'p'] as PieceSymbol[]).map((t) => (
              <button
                key={`b-${t}`}
                type="button"
                onClick={() => setActivePalette({ type: t, color: 'b' })}
                className={`h-9 w-9 rounded border text-xl font-serif leading-none ${
                  activePalette?.type === t && activePalette?.color === 'b'
                    ? 'border-amber-400 bg-amber-400/20 text-slate-200'
                    : 'border-slate-800 bg-slate-900 text-slate-200'
                }`}
              >
                {PIECE_GLYPHS.b[t]}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setActivePalette(null)}
            className={`h-9 px-2.5 rounded border text-xs font-bold ${
              activePalette === null
                ? 'border-amber-400 bg-amber-400/20 text-amber-300'
                : 'border-slate-800 bg-slate-900 text-slate-400'
            }`}
          >
            🧹 Eraser
          </button>
        </div>

        {/* 8x8 Mini Grid */}
        <div className="mt-4 mx-auto aspect-square w-72 overflow-hidden rounded-lg border-2 border-slate-700 shadow-xl">
          <div className="grid h-full w-full grid-cols-8">
            {RANKS.map((rank) =>
              FILES.map((file) => {
                const sq = `${file}${rank}` as Square;
                const piece = board.get(sq);
                const isLight = isLightSquare(file, rank);

                return (
                  <button
                    key={sq}
                    type="button"
                    onClick={() => handleSquareClick(sq)}
                    style={{ backgroundColor: isLight ? '#f0d9b5' : '#b58863' }}
                    className="flex items-center justify-center font-serif text-2xl leading-none transition-all hover:opacity-80"
                  >
                    {piece && (
                      <span className={piece.color === 'w' ? 'text-white drop-shadow' : 'text-slate-950 drop-shadow'}>
                        {PIECE_GLYPHS[piece.color][piece.type]}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Options: Turn & Castling */}
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-800 pt-3 text-xs">
          <div>
            <label className="font-bold text-slate-300 block mb-1">Side to Move</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTurn('w')}
                className={`flex-1 rounded p-1.5 font-bold ${turn === 'w' ? 'bg-amber-400 text-slate-900' : 'bg-slate-800 text-slate-300'}`}
              >
                White
              </button>
              <button
                type="button"
                onClick={() => setTurn('b')}
                className={`flex-1 rounded p-1.5 font-bold ${turn === 'b' ? 'bg-amber-400 text-slate-900' : 'bg-slate-800 text-slate-300'}`}
              >
                Black
              </button>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-300 block mb-1">Castling Rights</label>
            <div className="flex gap-2 items-center pt-1">
              {(['K', 'Q', 'k', 'q'] as const).map((key) => (
                <label key={key} className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={castling[key]}
                    onChange={(e) => setCastling((c) => ({ ...c, [key]: e.target.checked }))}
                    className="rounded accent-amber-400"
                  />
                  <span className="font-mono text-slate-300">{key}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-4 flex justify-between border-t border-slate-800 pt-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleStartingPosition}
              className="action-button action-secondary text-xs"
            >
              Reset Initial
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="action-button action-secondary text-xs text-rose-300"
            >
              Clear
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="action-button action-secondary text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="action-button action-primary text-xs font-bold"
            >
              Load Position
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
