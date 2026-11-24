import React, { useState } from 'react';
import { Chess, type PieceSymbol, type Square } from 'chess.js';
import { ChessPiece } from '../chess/ChessPiece.js';
import type { BoardTheme, PieceSetId } from '../../types/preferences.js';
import type { PlayerColor } from '../../../shared/types.js';
import { FILES, RANKS, isLightSquare } from '../../utils/chess-helpers.js';
import { useModalBehavior } from '../../utils/modal-behavior.js';

interface PositionSetupProps {
  initialFen: string;
  theme: BoardTheme;
  pieceSet: PieceSetId;
  onApplyPosition: (fen: string) => void;
  onClose: () => void;
}

type PaletteItem = { type: PieceSymbol; color: PlayerColor } | null;

const pieceNames: Record<PieceSymbol, string> = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };

function readPosition(chess: Chess) {
  const pieces = new Map<Square, NonNullable<PaletteItem>>();
  for (const piece of chess.board().flat()) {
    if (piece) pieces.set(piece.square, { type: piece.type, color: piece.color });
  }
  return pieces;
}

export const PositionSetup: React.FC<PositionSetupProps> = ({
  initialFen,
  theme,
  pieceSet,
  onApplyPosition,
  onClose,
}) => {
  const modalRef = useModalBehavior(onClose);
  const [board, setBoard] = useState(() => readPosition(new Chess(initialFen)));
  const [, initialTurn, rights] = initialFen.split(' ');
  const [activePalette, setActivePalette] = useState<PaletteItem>({ type: 'p', color: 'w' });
  const [turn, setTurn] = useState<PlayerColor>(initialTurn === 'b' ? 'b' : 'w');
  const [castling, setCastling] = useState({ K: rights.includes('K'), Q: rights.includes('Q'), k: rights.includes('k'), q: rights.includes('q') });
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
    setCastling({ K: false, Q: false, k: false, q: false });
  };

  const handleStartingPosition = () => {
    setBoard(readPosition(new Chess()));
    setTurn('w');
    setCastling({ K: true, Q: true, k: true, q: true });
  };

  const generateFen = (): string => {
    const fenRows: string[] = [];
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
      const unchanged = fen.split(' ').slice(0, 3).join(' ') === initialFen.split(' ').slice(0, 3).join(' ');
      onApplyPosition(unchanged ? initialFen : fen);
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
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-3 sm:p-6 shadow-2xl focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-lg font-black text-white">Set up position</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close position editor" className="p-2 text-slate-400 hover:text-white">✕</button>
        </div>

        {error && (
          <div role="alert" className="mt-3 rounded-lg bg-rose-950 p-2.5 text-xs text-rose-300 border border-rose-800">
            {error}
          </div>
        )}

        {/* Piece Palette */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
          {(['w', 'b'] as const).map(color => (
            <div key={color} className="editor-palette">
              <span>{color === 'w' ? 'White' : 'Black'}</span>
              {(Object.keys(pieceNames) as PieceSymbol[]).map(type => (
                <button key={type} type="button"
                  aria-label={`${color === 'w' ? 'White' : 'Black'} ${pieceNames[type]}`}
                  aria-pressed={activePalette?.color === color && activePalette.type === type}
                  onClick={() => setActivePalette({ type, color })}>
                  <ChessPiece type={type} color={color} pieceSet={pieceSet} />
                </button>
              ))}
            </div>
          ))}

          <button
            type="button"
            aria-pressed={activePalette === null}
            onClick={() => setActivePalette(null)}
            className={`h-9 px-2.5 rounded border text-xs font-bold ${
              activePalette === null
                ? 'border-amber-400 bg-amber-400/20 text-amber-300'
                : 'border-slate-800 bg-slate-900 text-slate-400'
            }`}
          >
            Eraser
          </button>
        </div>

        {/* 8x8 Mini Grid */}
        <div className="mt-4 mx-auto aspect-square w-full max-w-72 shrink-0 overflow-hidden rounded-lg border-2 border-slate-700 shadow-xl">
          <div className="grid h-full w-full grid-cols-8 grid-rows-8">
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
                    aria-label={`${sq}, ${piece ? `${piece.color === 'w' ? 'white' : 'black'} ${pieceNames[piece.type]}` : 'empty'}`}
                    style={{ backgroundColor: isLight ? theme.lightSquare : theme.darkSquare }}
                    className="flex items-center justify-center font-serif text-2xl leading-none transition-all hover:opacity-80"
                  >
                    {piece && (
                      <ChessPiece type={piece.type} color={piece.color} pieceSet={pieceSet} className="h-5/6 w-5/6" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Options: Turn & Castling */}
        <div className="mt-4 grid sm:grid-cols-2 gap-3 border-t border-slate-800 pt-3 text-xs">
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
                    className="rounded accent-[var(--accent-color)]"
                  />
                  <span className="font-mono text-slate-300">{key}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-4 flex flex-wrap gap-2 justify-between border-t border-slate-800 pt-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleStartingPosition}
              className="action-button action-secondary text-xs"
            >
              Starting position
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
