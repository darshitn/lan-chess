import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Chess, type Move, type Square } from 'chess.js';
import type { BoardDisplaySettings, BoardTheme, HighlightStyleId, PieceSetId } from '../../types/preferences.js';
import { Chessboard } from '../Chessboard.js';

export interface PuzzleRecord {
  id: string;
  title: string;
  theme: string;
  fen: string; // position with the solver to move
  moves: string[]; // solver solution in SAN
  replies: string[]; // opponent replies in SAN (between solver moves)
  rating: number;
  themes: string[];
}

// Hand-crafted warm-up puzzles — also the offline fallback if the bundled
// Lichess library fails to load.
const PUZZLE_DATABASE: PuzzleRecord[] = [
  {
    id: 'puz-1',
    title: "Scholar's Checkmate in 1",
    theme: 'Checkmate',
    fen: 'r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 4',
    moves: ['Qxf7#'],
    replies: [],
    rating: 800,
    themes: ['Checkmate'],
  },
  {
    id: 'puz-2',
    title: 'Back Rank Mate in 1',
    theme: 'Checkmate',
    fen: '6k1/5ppp/8/8/8/8/4R3/4K3 w - - 0 1',
    moves: ['Re8#'],
    replies: [],
    rating: 800,
    themes: ['Checkmate'],
  },
  {
    id: 'puz-3',
    title: 'Royal Knight Fork',
    theme: 'Fork',
    fen: 'r1b1k2r/pp1p1ppp/4p3/8/1n6/2N5/PPP1NPPP/R3KB1R b KQkq - 0 9',
    moves: ['Nxc2+'],
    replies: [],
    rating: 900,
    themes: ['Fork'],
  },
  {
    id: 'puz-4',
    title: 'Smothered Checkmate',
    theme: 'Smothered Mate',
    fen: '6rk/6pp/8/6N1/8/8/8/4K3 w - - 0 1',
    moves: ['Nf7#'],
    replies: [],
    rating: 900,
    themes: ['Smothered Mate'],
  },
  {
    id: 'puz-5',
    title: 'Pin and Win',
    theme: 'Pin',
    fen: 'r3k2r/ppp2ppp/2n5/3q4/3P4/5B2/PP1Q1PPP/R3K2R w KQkq - 0 12',
    moves: ['Bxd5'],
    replies: [],
    rating: 850,
    themes: ['Pin'],
  },
];

// Module-level cache so the library is fetched once per session.
let libraryCache: PuzzleRecord[] | null = null;
let libraryPromise: Promise<PuzzleRecord[]> | null = null;

async function loadPuzzleLibrary(): Promise<PuzzleRecord[]> {
  if (libraryCache) return libraryCache;
  if (!libraryPromise) {
    libraryPromise = fetch('/puzzles/lichess-puzzles.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<PuzzleRecord[]>;
      })
      .then((list) => {
        if (!Array.isArray(list) || list.length === 0) throw new Error('empty library');
        libraryCache = list;
        return list;
      })
      .catch(() => PUZZLE_DATABASE); // offline fallback: the warm-up set
  }
  return libraryPromise;
}

type Difficulty = 'all' | 'easy' | 'medium' | 'hard';

const DIFFICULTY_FILTERS: Array<{ id: Difficulty; label: string; matches: (rating: number) => boolean }> = [
  { id: 'all', label: 'All', matches: () => true },
  { id: 'easy', label: 'Easy ≤1200', matches: (r) => r <= 1200 },
  { id: 'medium', label: 'Medium', matches: (r) => r > 1200 && r <= 1600 },
  { id: 'hard', label: 'Hard 1600+', matches: (r) => r > 1600 },
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
  const [library, setLibrary] = useState<PuzzleRecord[] | null>(libraryCache);
  const [difficulty, setDifficulty] = useState<Difficulty>('all');
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [resetToken, setResetToken] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [fen, setFen] = useState<string>(() => PUZZLE_DATABASE[0].fen);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isSolved, setIsSolved] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [waitingReply, setWaitingReply] = useState(false);

  // Invalidate any pending opponent-reply timer when the puzzle or step changes.
  const playTokenRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    loadPuzzleLibrary().then((list) => {
      if (!cancelled) setLibrary(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const puzzles = useMemo(() => {
    const source = library ?? PUZZLE_DATABASE;
    const filter = DIFFICULTY_FILTERS.find((d) => d.id === difficulty)!;
    const filtered = source.filter((p) => filter.matches(p.rating));
    return filtered.length > 0 ? filtered : source;
  }, [library, difficulty]);

  // Whenever the current puzzle record changes (library loaded, difficulty
  // changed, navigation), the board resets to that puzzle's exact position.
  // This keeps the board and the header in lockstep — they must never drift.
  useEffect(() => {
    const record = puzzles[puzzleIndex] ?? puzzles[0] ?? PUZZLE_DATABASE[0];
    playTokenRef.current += 1;
    setFen(record.fen);
    setCurrentStep(0);
    setIsSolved(false);
    setStatusMsg(null);
    setSelectedSquare(null);
    setWaitingReply(false);
  }, [puzzleIndex, puzzles, resetToken]);

  const currentPuzzle = puzzles[Math.min(puzzleIndex, puzzles.length - 1)] ?? PUZZLE_DATABASE[0];
  const chess = useMemo(() => new Chess(fen), [fen]);
  // Board orientation is fixed by the puzzle's starting side to move so the
  // view never flips mid-solution.
  const puzzleFlipped = useMemo(() => new Chess(currentPuzzle.fen).turn() === 'b', [currentPuzzle]);

  const loadPuzzle = (index: number) => {
    const count = puzzles.length;
    const idx = ((index % count) + count) % count;
    setShowHint(false);
    // Bumping the token also resets when the SAME puzzle is reloaded (Reset button).
    setResetToken((t) => t + 1);
    setPuzzleIndex(idx); // board reset happens in the effect above
  };

  const changeDifficulty = (next: Difficulty) => {
    setShowHint(false);
    setResetToken((t) => t + 1);
    setDifficulty(next);
    setPuzzleIndex(0); // board reset happens in the effect above
  };

  const legalTargets = useMemo(() => {
    if (!selectedSquare || isSolved || waitingReply) return new Map<Square, Move>();
    const moves = chess.moves({ square: selectedSquare, verbose: true });
    return new Map<Square, Move>(moves.map((m) => [m.to, m]));
  }, [chess, selectedSquare, isSolved, waitingReply]);

  const handleMoveAttempt = (from: Square, to: Square) => {
    if (isSolved || waitingReply) return;

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
    const sameMove =
      move.san === expectedSan || move.san.replace('#', '+') === expectedSan.replace('#', '+');
    if (!sameMove) {
      setStatusMsg('❌ Not the best move. Try again!');
      setSelectedSquare(null);
      return;
    }

    const fenAfterSolver = attempt.fen();
    const nextStep = currentStep + 1;
    setFen(fenAfterSolver);
    setSelectedSquare(null);
    playTokenRef.current += 1;
    const token = playTokenRef.current;

    const isFinalMove = nextStep >= currentPuzzle.moves.length;
    const opponentReply = currentPuzzle.replies[currentStep];

    if (isFinalMove || !opponentReply) {
      setIsSolved(true);
      setStatusMsg('🎉 Excellent! Puzzle solved successfully.');
      return;
    }

    // Play the opponent's scripted reply after a short beat, then continue.
    setWaitingReply(true);
    setStatusMsg('Good move! Watch the reply…');
    window.setTimeout(() => {
      if (playTokenRef.current !== token) return; // puzzle changed mid-delay
      try {
        const replyBoard = new Chess(fenAfterSolver);
        replyBoard.move(opponentReply);
        if (playTokenRef.current !== token) return;
        setFen(replyBoard.fen());
        setCurrentStep(nextStep);
        setStatusMsg('Continue the sequence — find the best move.');
      } catch {
        setIsSolved(true);
        setStatusMsg('🎉 Puzzle sequence complete.');
      } finally {
        if (playTokenRef.current === token) setWaitingReply(false);
      }
    }, 700);
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

  if (!library) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <div className="panel text-center">
          <p className="text-sm font-bold text-amber-300">Loading puzzle library…</p>
          <p className="mt-1 text-xs text-slate-400">
            Preparing tactical puzzles (falls back to the built-in set when offline).
          </p>
          <button type="button" onClick={onBackToPlay} className="action-button action-secondary mt-4 text-xs">
            ← Back
          </button>
        </div>
      </div>
    );
  }

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
              Puzzle {puzzleIndex + 1} of {puzzles.length}
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

      {/* Difficulty filter */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Difficulty:</span>
        {DIFFICULTY_FILTERS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => changeDifficulty(d.id)}
            aria-pressed={difficulty === d.id}
            className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
              difficulty === d.id
                ? 'bg-amber-400 text-slate-900'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

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
              role="status"
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
            isInteractive={!isSolved && !waitingReply}
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
              {currentPuzzle.moves.length > 1 && ' This tactic continues over several moves — the opponent will reply.'}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded bg-slate-800 px-2 py-0.5 font-mono font-bold text-slate-200">
                Rating {currentPuzzle.rating}
              </span>
              {currentPuzzle.themes.slice(0, 3).map((t) => (
                <span key={t} className="rounded bg-slate-800/70 px-2 py-0.5 text-slate-300">
                  {t}
                </span>
              ))}
            </div>

            {showHint && (
              <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-400/10 p-3 text-xs text-amber-200">
                <span className="font-bold">Hint: </span>
                Look for a {currentPuzzle.theme.toLowerCase()} — the tactic wins material or mates.
              </div>
            )}
          </div>

          <div className="panel">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">Puzzle List</h3>
            <p className="mt-1 text-[10px] text-slate-500">
              Puzzles from the Lichess open database (CC0), filtered for clean tactics.
            </p>
            <div className="move-list mt-2 max-h-56">
              {puzzles.slice(0, 200).map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => loadPuzzle(i)}
                  className={`move-cell flex w-full items-center justify-between text-left text-xs ${
                    puzzleIndex === i ? 'active-move' : 'text-slate-300'
                  }`}
                >
                  <span>
                    {i + 1}. {p.theme}
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">{p.rating}</span>
                </button>
              ))}
              {puzzles.length > 200 && (
                <p className="px-1 py-1 text-[10px] text-slate-500">
                  +{puzzles.length - 200} more — use Prev/Next or the difficulty filter.
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
