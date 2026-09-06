import React, { useState, useMemo } from 'react';
import { Chess, type Move, type Square } from 'chess.js';
import type { BoardDisplaySettings, BoardTheme, HighlightStyleId, PieceSetId } from '../../types/preferences.js';
import { Chessboard } from '../Chessboard.js';

export interface TacticalPuzzle {
  id: string;
  title: string;
  theme: string;
  fen: string;
  moves: string[]; // Solution moves in SAN
  hint: string;
}

const PUZZLE_DATABASE: TacticalPuzzle[] = [
  {
    id: 'puz-1',
    title: "Scholar's Checkmate in 1",
    theme: 'Checkmate',
    fen: 'r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 4',
    moves: ['Qxf7#'],
    hint: 'Target the weak f7 pawn with your Queen!',
  },
  {
    id: 'puz-2',
    title: 'Back Rank Mate in 1',
    theme: 'Checkmate',
    fen: '6k1/5ppp/8/8/8/8/4R3/4K3 w - - 0 1',
    moves: ['Re8#'],
    hint: 'The Black king has no escape square along the 8th rank.',
  },
  {
    id: 'puz-3',
    title: 'Royal Knight Fork',
    theme: 'Fork',
    fen: 'r1b1k2r/pp1p1ppp/4p3/8/1n6/2N5/PPP1NPPP/R3KB1R b KQkq - 0 9',
    moves: ['Nxc2+'],
    hint: 'Jump your knight to c2 to attack King and Rook simultaneously!',
  },
  {
    id: 'puz-4',
    title: 'Smothered Checkmate',
    theme: 'Smothered Mate',
    fen: '6rk/6pp/8/6N1/8/8/8/4K3 w - - 0 1',
    moves: ['Nf7#'],
    hint: 'A smothered mate occurs when the king is surrounded by its own pieces.',
  },
  {
    id: 'puz-5',
    title: 'Pin and Win',
    theme: 'Pin',
    fen: 'r3k2r/ppp2ppp/2n5/3q4/3P4/5B2/PP1Q1PPP/R3K2R w KQkq - 0 12',
    moves: ['Bxd5'],
    hint: 'Can you take advantage of the aligned Queen and King?',
  },
];

interface PuzzlePlayerProps {
  theme: BoardTheme;
  pieceSet: PieceSetId;
  highlightStyle: HighlightStyleId;
  boardSettings: BoardDisplaySettings;
  onBackToPlay: () => void;
}

export const PuzzlePlayer: React.FC<PuzzlePlayerProps> = ({
  theme,
  pieceSet,
  highlightStyle,
  boardSettings,
  onBackToPlay,
}) => {
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [fen, setFen] = useState(() => PUZZLE_DATABASE[0].fen);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isSolved, setIsSolved] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);

  const currentPuzzle = PUZZLE_DATABASE[puzzleIndex];
  const chess = useMemo(() => new Chess(fen), [fen]);
  // Board orientation is fixed by the puzzle's starting side to move so the
  // view never flips mid-solution.
  const puzzleFlipped = useMemo(() => new Chess(currentPuzzle.fen).turn() === 'b', [currentPuzzle]);

  const loadPuzzle = (index: number) => {
    const idx = (index + PUZZLE_DATABASE.length) % PUZZLE_DATABASE.length;
    setPuzzleIndex(idx);
    setCurrentStep(0);
    setFen(PUZZLE_DATABASE[idx].fen);
    setStatusMsg(null);
    setIsSolved(false);
    setShowHint(false);
    setSelectedSquare(null);
  };

  const legalTargets = useMemo(() => {
    if (!selectedSquare || isSolved) return new Map<Square, Move>();
    const moves = chess.moves({ square: selectedSquare, verbose: true });
    return new Map<Square, Move>(moves.map((m) => [m.to, m]));
  }, [chess, selectedSquare, isSolved]);

  const handleMoveAttempt = (from: Square, to: Square) => {
    if (isSolved) return;

    // Attempt the move on a scratch instance so the rendered position is never
    // mutated in place (a rejected attempt must not desync the board).
    const attempt = new Chess(fen);
    let move;
    try {
      move = attempt.move({ from, to, promotion: 'q' });
    } catch {
      move = null;
    }
    if (!move) {
      setStatusMsg('That move is not legal here.');
      setSelectedSquare(null);
      return;
    }

    const expectedSan = currentPuzzle.moves[currentStep];
    // Compare moves
    if (move.san === expectedSan || move.san.replace('#', '+') === expectedSan.replace('#', '+')) {
      const nextStep = currentStep + 1;
      setFen(attempt.fen());
      setSelectedSquare(null);

      if (nextStep >= currentPuzzle.moves.length) {
        setIsSolved(true);
        setStatusMsg('🎉 Excellent! Puzzle solved successfully.');
      } else {
        setCurrentStep(nextStep);
        setStatusMsg('Good move! Continue the sequence.');
      }
    } else {
      // Incorrect move
      setStatusMsg('❌ Not the best move. Try again!');
      setSelectedSquare(null);
    }
  };

  const handleSquareClick = (square: Square) => {
    const piece = chess.get(square);
    const targetMove = legalTargets.get(square);

    if (selectedSquare && targetMove) {
      handleMoveAttempt(selectedSquare, square);
      return;
    }

    if (piece && piece.color === chess.turn()) {
      setSelectedSquare(square);
    } else {
      setSelectedSquare(null);
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
      {/* Top Header */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[.25em] text-amber-400">
              Tactical Training
            </span>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
              Puzzle {puzzleIndex + 1} of {PUZZLE_DATABASE.length}
            </span>
          </div>
          <h1 className="text-2xl font-black text-white sm:text-3xl">{currentPuzzle.title}</h1>
          <p className="text-xs text-amber-300 font-semibold mt-0.5">
            Theme: {currentPuzzle.theme} · {chess.turn() === 'w' ? 'White to move' : 'Black to move'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadPuzzle(puzzleIndex - 1)}
            className="action-button action-secondary px-3 py-1 text-xs"
          >
            ◀ Prev
          </button>
          <button
            type="button"
            onClick={() => loadPuzzle(puzzleIndex + 1)}
            className="action-button action-secondary px-3 py-1 text-xs"
          >
            Next ▶
          </button>
          <button
            type="button"
            onClick={onBackToPlay}
            className="action-button action-secondary px-3 py-1 text-xs"
          >
            Exit Puzzles
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        {/* Board column */}
        <section className="mx-auto w-full max-w-[46rem]">
          {/* Status message */}
          {statusMsg && (
            <div
              className={`mb-3 rounded-lg p-3 text-xs font-bold text-center ${
                isSolved
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800 animate-pulse'
                  : 'bg-rose-950/80 text-rose-300 border border-rose-800'
              }`}
            >
              {statusMsg}
            </div>
          )}

          <Chessboard
            chess={chess}
            flipped={puzzleFlipped}
            selectedSquare={selectedSquare}
            legalTargets={legalTargets}
            lastMove={null}
            isInteractive={!isSolved}
            theme={theme}
            pieceSet={pieceSet}
            highlightStyle={highlightStyle}
            boardSettings={boardSettings}
            onSquareClick={handleSquareClick}
            onPieceDrop={handleMoveAttempt}
          />

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setShowHint((h) => !h)}
              className="action-button action-secondary flex-1 text-xs text-amber-300"
            >
              💡 {showHint ? 'Hide Hint' : 'Show Hint'}
            </button>
            <button
              type="button"
              onClick={() => loadPuzzle(puzzleIndex)}
              className="action-button action-secondary flex-1 text-xs"
            >
              🔄 Reset Puzzle
            </button>
            {isSolved && (
              <button
                type="button"
                onClick={() => loadPuzzle(puzzleIndex + 1)}
                className="action-button action-primary flex-1 text-xs font-bold"
              >
                Next Puzzle ▶
              </button>
            )}
          </div>
        </section>

        {/* Puzzle Sidebar */}
        <aside className="space-y-4">
          <div className="panel">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">Puzzle Objective</h3>
            <p className="mt-2 text-sm text-slate-200">
              Find the best continuation for {chess.turn() === 'w' ? 'White' : 'Black'} to win material or deliver checkmate.
            </p>

            {showHint && (
              <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-400/10 p-3 text-xs text-amber-200">
                <span className="font-bold">Hint: </span>
                {currentPuzzle.hint}
              </div>
            )}
          </div>

          <div className="panel">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">Tactics Training List</h3>
            <div className="mt-2 space-y-1.5">
              {PUZZLE_DATABASE.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => loadPuzzle(i)}
                  className={`w-full text-left rounded-lg p-2 text-xs transition-all flex items-center justify-between ${
                    puzzleIndex === i
                      ? 'bg-amber-400/20 text-amber-300 font-bold border border-amber-400/50'
                      : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>{i + 1}. {p.title}</span>
                  <span className="text-[10px] text-slate-500">{p.theme}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
