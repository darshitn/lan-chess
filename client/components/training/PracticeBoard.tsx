import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Chess, type Move, type Square } from 'chess.js';
import type { BoardDisplaySettings, BoardTheme, HighlightStyleId, PieceSetId } from '../../types/preferences.js';
import { Chessboard } from '../Chessboard.js';
import { PgnFenTools } from '../review/PgnFenTools.js';
import { stockfishEngine, formatEngineScore } from '../../services/stockfish-engine.js';
import { PositionSetup } from './PositionSetup.js';
import { identifyOpening } from '../../utils/openings.js';

interface PracticeBoardProps {
  theme: BoardTheme;
  pieceSet: PieceSetId;
  highlightStyle: HighlightStyleId;
  boardSettings: BoardDisplaySettings;
  onBackToPlay: () => void;
}

export const PracticeBoard: React.FC<PracticeBoardProps> = ({
  theme,
  pieceSet,
  highlightStyle,
  boardSettings,
  onBackToPlay,
}) => {
  const [fen, setFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [isEngineOn, setIsEngineOn] = useState(false);
  const [evalScore, setEvalScore] = useState<string | null>(null);
  const [bestMove, setBestMove] = useState<string | null>(null);
  const [isSetupOpen, setIsSetupOpen] = useState(false);

  const chess = useMemo(() => new Chess(fen), [fen]);
  const fenRef = useRef(fen);
  fenRef.current = fen;

  // Opening detection
  const opening = useMemo(() => identifyOpening(moveHistory), [moveHistory]);

  // Update engine eval when fen changes if engine is enabled. Results are
  // correlated to the displayed FEN so a slow older search can never overwrite
  // a newer position's evaluation.
  const updateEngine = useCallback(async (requestedFen: string) => {
    if (!isEngineOn) return;
    const res = await stockfishEngine.evaluateFen(requestedFen, 12);
    if (fenRef.current !== requestedFen) return; // stale result for an older position
    if (!res) {
      setEvalScore(null);
      setBestMove(null);
      return;
    }
    setEvalScore(formatEngineScore(res.score));
    setBestMove(res.bestMoveSan || null);
  }, [isEngineOn]);

  // Stop any in-flight engine search when leaving the sandbox.
  useEffect(() => {
    return () => {
      stockfishEngine.cancelAnalysis();
    };
  }, []);

  const legalTargets = useMemo(() => {
    if (!selectedSquare) return new Map<Square, Move>();
    const moves = chess.moves({ square: selectedSquare, verbose: true });
    return new Map<Square, Move>(moves.map((m) => [m.to, m]));
  }, [chess, selectedSquare]);

  const handleSquareClick = (square: Square) => {
    const piece = chess.get(square);
    const targetMove = legalTargets.get(square);

    if (selectedSquare && targetMove) {
      try {
        chess.move({ from: selectedSquare, to: square, promotion: 'q' });
        const newFen = chess.fen();
        setFen(newFen);
        setMoveHistory((prev) => [...prev, targetMove.san]);
        setSelectedSquare(null);
        void updateEngine(newFen);
      } catch {
        setSelectedSquare(null);
      }
      return;
    }

    if (piece && piece.color === chess.turn()) {
      setSelectedSquare(square);
    } else {
      setSelectedSquare(null);
    }
  };

  const handlePieceDrop = (from: Square, to: Square) => {
    try {
      const move = chess.move({ from, to, promotion: 'q' });
      if (move) {
        const newFen = chess.fen();
        setFen(newFen);
        setMoveHistory((prev) => [...prev, move.san]);
        setSelectedSquare(null);
        void updateEngine(newFen);
      }
    } catch {
      // Illegal drop ignored
    }
  };

  const handleReset = () => {
    const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    setFen(startFen);
    setMoveHistory([]);
    setSelectedSquare(null);
    setEvalScore(null);
    setBestMove(null);
  };

  const handleLoadCustomFen = (newFen: string) => {
    setFen(newFen);
    setMoveHistory([]);
    setSelectedSquare(null);
    void updateEngine(newFen);
  };

  const toggleEngine = () => {
    const next = !isEngineOn;
    setIsEngineOn(next);
    if (next) {
      void updateEngine(fen);
    } else {
      setEvalScore(null);
      setBestMove(null);
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
      {/* Top Header */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[.25em] text-amber-400">
              Training Sandbox
            </span>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
              Practice Board
            </span>
          </div>
          <h1 className="text-2xl font-black text-white sm:text-3xl">Free Board Analysis</h1>
          {opening && (
            <p className="text-xs text-amber-300 font-semibold mt-0.5">
              Opening: {opening.name} {opening.variation ? `(${opening.variation})` : ''} · {opening.eco}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleEngine}
            className={`action-button px-3 py-1 text-xs font-bold ${
              isEngineOn ? 'bg-emerald-500 text-slate-950' : 'action-secondary text-slate-300'
            }`}
          >
            {isEngineOn ? '⚡ Engine ON' : '⚡ Engine OFF'}
          </button>
          <button
            type="button"
            onClick={() => setIsSetupOpen(true)}
            className="action-button action-secondary px-3 py-1 text-xs text-amber-300"
          >
            🧩 Setup Position
          </button>
          <button
            type="button"
            onClick={onBackToPlay}
            className="action-button action-secondary px-3 py-1 text-xs"
          >
            Exit Sandbox
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        {/* Board column */}
        <section className="mx-auto w-full max-w-[46rem]">
          <div className="mb-2 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-2 text-xs">
            <span className="font-semibold text-white">
              {chess.turn() === 'w' ? 'White to move' : 'Black to move'}
              {chess.isCheck() ? ' (Check!)' : ''}
              {chess.isCheckmate() ? ' (Checkmate!)' : ''}
            </span>
            {isEngineOn && evalScore !== null && (
              <span className="font-mono font-bold text-amber-300">
                Eval: {evalScore}
                {bestMove ? ` · Best: ${bestMove}` : ''}
              </span>
            )}
          </div>

          <Chessboard
            chess={chess}
            flipped={flipped}
            selectedSquare={selectedSquare}
            legalTargets={legalTargets}
            lastMove={null}
            isInteractive={true}
            theme={theme}
            pieceSet={pieceSet}
            highlightStyle={highlightStyle}
            boardSettings={boardSettings}
            onSquareClick={handleSquareClick}
            onPieceDrop={handlePieceDrop}
          />

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              className="action-button action-secondary flex-1 text-xs"
            >
              Flip Board
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="action-button action-secondary flex-1 text-xs text-amber-300"
            >
              Reset to Starting Position
            </button>
          </div>
        </section>

        {/* Sidebar Tools */}
        <aside className="space-y-4">
          <div className="panel">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">Moves Played</h3>
            <div className="move-list mt-2 max-h-48 text-xs font-mono">
              {moveHistory.length === 0 ? (
                <p className="text-slate-500 italic">Play moves on the board for either side.</p>
              ) : (
                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                  {moveHistory.map((san, i) => (
                    <span key={i} className="text-slate-300">
                      {i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : ''}{san}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <PgnFenTools
            currentFen={fen}
            onLoadFen={handleLoadCustomFen}
          />
        </aside>
      </div>

      {/* Position Setup Modal */}
      {isSetupOpen && (
        <PositionSetup
          onApplyPosition={(newFen) => {
            handleLoadCustomFen(newFen);
            setIsSetupOpen(false);
          }}
          onClose={() => setIsSetupOpen(false)}
        />
      )}
    </div>
  );
};
