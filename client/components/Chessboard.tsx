import React, { useState, useRef, useCallback } from 'react';
import type { Chess, Move, Square } from 'chess.js';
import type { GameMove, PlayerColor } from '../../shared/types.js';
import type {
  BoardDisplaySettings,
  BoardTheme,
  HighlightStyleId,
  PieceSetId,
} from '../types/preferences.js';
import { FILES, RANKS, isLightSquare } from '../utils/chess-helpers.js';
import { BoardAnnotations, type ArrowAnnotation } from './chess/BoardAnnotations.js';

const PIECE_GLYPHS: Record<PlayerColor, Record<string, string>> = {
  w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
  b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' },
};

const PIECE_NAMES: Record<string, string> = {
  p: 'Pawn',
  n: 'Knight',
  b: 'Bishop',
  r: 'Rook',
  q: 'Queen',
  k: 'King',
};

interface ChessboardProps {
  chess: Chess;
  flipped: boolean;
  selectedSquare: Square | null;
  legalTargets: Map<Square, Move>;
  lastMove: GameMove | null;
  isInteractive: boolean;
  premove?: { from: Square; to: Square } | null;
  theme?: BoardTheme;
  pieceSet?: PieceSetId;
  highlightStyle?: HighlightStyleId;
  boardSettings?: BoardDisplaySettings;
  onSquareClick: (square: Square) => void;
  onPieceDrop: (from: Square, to: Square) => void;
}

export const Chessboard: React.FC<ChessboardProps> = React.memo(({
  chess,
  flipped,
  selectedSquare,
  legalTargets,
  lastMove,
  isInteractive,
  premove = null,
  theme,
  pieceSet = 'classic',
  highlightStyle = 'classic',
  boardSettings,
  onSquareClick,
  onPieceDrop,
}) => {
  const displayRanks = flipped ? [...RANKS].reverse() : RANKS;
  const displayFiles = flipped ? [...FILES].reverse() : FILES;

  // Local annotations (arrows & square markers)
  const [arrows, setArrows] = useState<ArrowAnnotation[]>([]);
  const [markers, setMarkers] = useState<Set<Square>>(new Set());
  const rightClickStartRef = useRef<Square | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.DragEvent, square: Square) => {
    if (!isInteractive) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', square);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isInteractive) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetSquare: Square) => {
    e.preventDefault();
    if (!isInteractive) return;
    const raw = e.dataTransfer.getData('text/plain');
    if (!/^[a-h][1-8]$/.test(raw)) return; // only accept square drags from this board
    const fromSquare = raw as Square;
    if (fromSquare !== targetSquare) {
      onPieceDrop(fromSquare, targetSquare);
    }
  };

  // Right-click arrow & marker drawing
  const handleMouseDown = (e: React.MouseEvent, square: Square) => {
    if (e.button === 2) {
      rightClickStartRef.current = square;
    } else if (e.button === 0) {
      // Left click clears annotations if any exist
      if (arrows.length > 0 || markers.size > 0) {
        setArrows([]);
        setMarkers(new Set());
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent, square: Square) => {
    if (e.button === 2) {
      const startSquare = rightClickStartRef.current;
      rightClickStartRef.current = null;
      if (!startSquare) return;

      if (startSquare === square) {
        // Toggle square marker
        setMarkers((prev) => {
          const next = new Set(prev);
          if (next.has(square)) next.delete(square);
          else next.add(square);
          return next;
        });
      } else {
        // Toggle directional arrow
        setArrows((prev) => {
          const existsIndex = prev.findIndex((a) => a.from === startSquare && a.to === square);
          if (existsIndex >= 0) {
            return prev.filter((_, i) => i !== existsIndex);
          }
          return [...prev, { from: startSquare, to: square }];
        });
      }
    }
  };

  // A right-press that releases outside the board must not leave a stale arrow
  // anchor behind.
  const handleBoardMouseLeave = () => {
    rightClickStartRef.current = null;
  };

  // Keyboard navigation: arrow keys move focus between squares, Enter/Space
  // activates (native button behavior).
  const handleBoardKeyDown = (e: React.KeyboardEvent) => {
    const key = e.key;
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return;
    const target = e.target as HTMLElement;
    const current = target.dataset?.square;
    if (!current) return;

    const fileIndex = displayFiles.findIndex((f) => f === current[0]);
    const rankIndex = displayRanks.findIndex((r) => String(r) === current[1]);
    if (fileIndex === -1 || rankIndex === -1) return;

    let nextFile = fileIndex;
    let nextRank = rankIndex;
    if (key === 'ArrowUp') nextRank = Math.max(0, rankIndex - 1);
    if (key === 'ArrowDown') nextRank = Math.min(displayRanks.length - 1, rankIndex + 1);
    if (key === 'ArrowLeft') nextFile = Math.max(0, fileIndex - 1);
    if (key === 'ArrowRight') nextFile = Math.min(displayFiles.length - 1, fileIndex + 1);

    if (nextFile === fileIndex && nextRank === rankIndex) return;
    e.preventDefault();
    const nextSquare = `${displayFiles[nextFile]}${displayRanks[nextRank]}`;
    containerRef.current
      ?.querySelector<HTMLElement>(`[data-square="${nextSquare}"]`)
      ?.focus();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  const clearAllAnnotations = useCallback(() => {
    setArrows([]);
    setMarkers(new Set());
  }, []);

  const isChecked = chess.isCheck();
  const currentTurn = chess.turn();

  // Settings helpers
  const showCoords = boardSettings?.coordinates ?? true;
  const coordClass = boardSettings?.coordinateStyle === 'small' ? 'coord-small' : boardSettings?.coordinateStyle === 'large' ? 'coord-large' : '';
  const pieceScale = boardSettings?.pieceScale ?? 1.0;

  const shellClasses = [
    'board-shell',
    boardSettings?.boardBorder === false ? 'board-shell-noborder' : '',
    boardSettings?.boardShadow === false ? 'board-shell-noshadow' : '',
    boardSettings?.roundedCorners === false ? 'board-shell-noradius' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={shellClasses}>
      <div
        ref={containerRef}
        className={`chessboard pieceset-${pieceSet} highlight-${highlightStyle} ${coordClass}`}
        role="grid"
        aria-label={`Chessboard${isInteractive ? '. Use arrow keys to move between squares.' : ''}`}
        aria-roledescription="chess board"
        onContextMenu={handleContextMenu}
        onKeyDown={handleBoardKeyDown}
        onMouseLeave={handleBoardMouseLeave}
        style={{
          ['--legal-color' as string]: theme?.legalMoveColor ?? 'rgba(15, 23, 42, 0.3)',
        }}
      >
        {/* SVG Annotations Overlay */}
        <BoardAnnotations arrows={arrows} markers={markers} flipped={flipped} />

        {displayRanks.map((rank, rowIndex) => (
          <div key={rank} role="row" className="board-row">
            {displayFiles.map((file, colIndex) => {
              const square = `${file}${rank}` as Square;
              const piece = chess.get(square);
              const targetMove = legalTargets.get(square);
              const isLastMove = lastMove?.from === square || lastMove?.to === square;
              const isSelected = selectedSquare === square;
              const isPremove = Boolean(premove && (premove.from === square || premove.to === square));
              const isPremoveDestination = Boolean(premove && premove.to === square);
              const isLight = isLightSquare(file, rank);
              const isKingInCheck = isChecked && piece?.type === 'k' && piece.color === currentTurn;

              // Screen-reader label carries the position state, not just content.
              const squareLabel = [
                `${square}${piece ? `, ${piece.color === 'w' ? 'white' : 'black'} ${PIECE_NAMES[piece.type]}` : ', empty'}`,
                isKingInCheck ? 'king in check' : '',
                isSelected ? 'selected' : '',
                targetMove ? 'legal move target' : '',
                isLastMove ? 'last move' : '',
                isPremove ? (isPremoveDestination ? 'premove target' : 'premove origin') : '',
              ]
                .filter(Boolean)
                .join(', ');

              // Calculate square background color based on theme
              let squareBg: string | undefined = undefined;
              if (theme) {
                if (isKingInCheck) squareBg = theme.checkSquare;
                else if (isSelected) squareBg = theme.selectedSquare;
                else if (isLastMove) squareBg = theme.lastMoveSquare;
                else squareBg = isLight ? theme.lightSquare : theme.darkSquare;
              }

              return (
                <button
                  key={square}
                  type="button"
                  role="gridcell"
                  data-square={square}
                  aria-selected={isSelected}
                  aria-label={squareLabel}
                  onClick={() => onSquareClick(square)}
                  onMouseDown={(e) => handleMouseDown(e, square)}
                  onMouseUp={(e) => handleMouseUp(e, square)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, square)}
                  style={{ backgroundColor: squareBg }}
                  className={`square ${
                    isLight ? 'square-light' : 'square-dark'
                  } ${isSelected ? 'selected-square' : ''} ${
                    isLastMove ? 'last-move' : ''
                  } ${isKingInCheck ? 'checked-king' : ''} ${
                    isPremove ? 'premove-square' : ''
                  } ${isPremoveDestination ? 'premove-destination' : ''}`}
                >
                  {/* Coordinates notation */}
                  {showCoords && colIndex === 0 && (
                    <span
                      className={`rank-label ${
                        isLight ? 'dark-label' : 'light-label'
                      }`}
                      aria-hidden="true"
                    >
                      {rank}
                    </span>
                  )}
                  {showCoords && rowIndex === 7 && (
                    <span
                      className={`file-label ${
                        isLight ? 'dark-label' : 'light-label'
                      }`}
                      aria-hidden="true"
                    >
                      {file}
                    </span>
                  )}

                  {/* Legal move indicator dots / capture rings */}
                  {targetMove && (
                    <span
                      aria-hidden="true"
                      className={
                        targetMove.captured || piece ? 'legal-capture' : 'legal-dot'
                      }
                    />
                  )}

                  {/* Piece glyph */}
                  {piece && (
                    <span
                      draggable={isInteractive}
                      onDragStart={(e) => handleDragStart(e, square)}
                      aria-hidden="true"
                      className={`piece piece-${piece.color}`}
                      style={pieceScale !== 1.0 ? { transform: `scale(${pieceScale})` } : undefined}
                    >
                      {PIECE_GLYPHS[piece.color as PlayerColor][piece.type]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {(arrows.length > 0 || markers.size > 0) && (
        <div className="mt-1 flex justify-end">
          <button
            type="button"
            onClick={clearAllAnnotations}
            className="text-[11px] font-semibold text-amber-300 hover:text-amber-200"
          >
            Clear Annotations
          </button>
        </div>
      )}
    </div>
  );
});

Chessboard.displayName = 'Chessboard';
