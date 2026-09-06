import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Chess } from 'chess.js';
import type { GameMove } from '../../../shared/types.js';
import type { BoardDisplaySettings, BoardTheme, HighlightStyleId, PieceSetId } from '../../types/preferences.js';
import { Chessboard } from '../Chessboard.js';
import { PgnFenTools } from './PgnFenTools.js';
import { EngineAnalysisPanel } from '../analysis/EngineAnalysisPanel.js';
import {
  stockfishEngine,
  type EngineScore,
  type GameAnalysisReport,
  type MoveClassification,
} from '../../services/stockfish-engine.js';
import { identifyOpening } from '../../utils/openings.js';
import type { SavedGame } from '../../services/game-history.js';

interface GameReviewProps {
  game: SavedGame;
  theme: BoardTheme;
  pieceSet: PieceSetId;
  highlightStyle: HighlightStyleId;
  boardSettings: BoardDisplaySettings;
  onExitReview: () => void;
}

const CLASSIFICATION_SYMBOLS: Record<MoveClassification, { symbol: string; color: string }> = {
  brilliant: { symbol: '!!', color: 'text-teal-400 font-black' },
  excellent: { symbol: '!', color: 'text-emerald-400 font-bold' },
  good: { symbol: '', color: '' },
  book: { symbol: '📖', color: 'text-amber-400 text-[10px]' },
  inaccuracy: { symbol: '?!', color: 'text-yellow-400 font-bold' },
  mistake: { symbol: '?', color: 'text-orange-400 font-bold' },
  blunder: { symbol: '??', color: 'text-rose-500 font-black' },
  unavailable: { symbol: '·', color: 'text-slate-500' },
};

// Stable reference so the Chessboard memo is not defeated on every render.
const EMPTY_LEGAL_TARGETS = new Map();

export const GameReview: React.FC<GameReviewProps> = ({
  game,
  theme,
  pieceSet,
  highlightStyle,
  boardSettings,
  onExitReview,
}) => {
  const [currentPly, setCurrentPly] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [analysisReport, setAnalysisReport] = useState<GameAnalysisReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [selectedDepth, setSelectedDepth] = useState(12);

  // Pre-generate all board positions across the game
  const positions = useMemo(() => {
    const list: Array<{ ply: number; fen: string; lastMove: GameMove | null; chess: Chess }> = [];
    const c = new Chess();
    list.push({ ply: 0, fen: c.fen(), lastMove: null, chess: new Chess() });

    for (let i = 0; i < game.moves.length; i++) {
      const m = game.moves[i];
      try {
        c.move({ from: m.from, to: m.to, promotion: m.promotion });
        list.push({ ply: i + 1, fen: c.fen(), lastMove: m, chess: new Chess(c.fen()) });
      } catch {
        break;
      }
    }
    return list;
  }, [game.moves]);

  const currentPosition = positions[currentPly] ?? positions[0];

  // Opening detection
  const opening = useMemo(() => {
    const sans = game.moves.slice(0, currentPly).map((m) => m.san);
    return identifyOpening(sans);
  }, [game.moves, currentPly]);

  // Current evaluation from report if available, else zero
  const currentEvaluation: EngineScore = useMemo(() => {
    if (!analysisReport) return { type: 'cp', value: 0 };
    const match = analysisReport.positions.find((p) => p.ply === currentPly);
    return match?.evaluation ?? { type: 'cp', value: 0 };
  }, [analysisReport, currentPly]);

  // Navigation handlers
  const goToPly = useCallback((ply: number) => {
    const clamped = Math.max(0, Math.min(positions.length - 1, ply));
    setCurrentPly(clamped);
  }, [positions.length]);

  const goNext = useCallback(() => {
    goToPly(currentPly + 1);
  }, [currentPly, goToPly]);

  const goPrev = useCallback(() => {
    goToPly(currentPly - 1);
  }, [currentPly, goToPly]);

  const goFirst = useCallback(() => {
    goToPly(0);
  }, [goToPly]);

  const goLast = useCallback(() => {
    goToPly(positions.length - 1);
  }, [goToPly, positions.length]);

  // Auto-play timer
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentPly((prev) => {
        if (prev >= positions.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [isPlaying, positions.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'Home') {
        e.preventDefault();
        goFirst();
      } else if (e.key === 'End') {
        e.preventDefault();
        goLast();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goPrev, goNext, goFirst, goLast]);

  // Run full Stockfish engine analysis
  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisProgress(0);

    try {
      const report = await stockfishEngine.analyzeGame(
        positions[0].fen,
        game.moves,
        selectedDepth,
        ({ percent }) => setAnalysisProgress(percent)
      );
      setAnalysisReport(report);
    } catch {
      // Error handling
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCancelAnalysis = () => {
    stockfishEngine.cancelAnalysis();
    setIsAnalyzing(false);
  };

  // Stop any in-flight engine search when leaving the review screen.
  useEffect(() => {
    return () => {
      stockfishEngine.cancelAnalysis();
    };
  }, []);

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
      {/* Header bar */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[.25em] text-amber-400">
              Game Review & Replay
            </span>
            <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
              Room {game.roomCode}
            </span>
          </div>
          <h1 className="text-2xl font-black text-white sm:text-3xl">
            {game.whiteName} vs {game.blackName}
          </h1>
          {opening && (
            <p className="mt-0.5 text-xs font-semibold text-amber-300">
              Opening: {opening.name} {opening.variation ? `(${opening.variation})` : ''} · {opening.eco}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className="action-button action-secondary px-3 py-1 text-xs"
          >
            Flip Board
          </button>
          <button
            type="button"
            onClick={onExitReview}
            className="action-button action-secondary px-3 py-1 text-xs text-amber-300"
          >
            Exit Review
          </button>
        </div>
      </header>

      {/* Main Grid: Board Column + Sidebar Review Tools */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
        {/* Left Column: Board & Controls */}
        <section className="mx-auto w-full max-w-[46rem]">
          {/* Position Info Bar */}
          <div className="mb-2 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-2 text-xs">
            <span className="font-semibold text-white">
              {currentPly === 0 ? 'Starting Position' : `Move ${Math.ceil(currentPly / 2)} (${currentPosition.lastMove?.san})`}
            </span>
            <span className="font-mono text-slate-400">
              Ply {currentPly} / {positions.length - 1}
            </span>
          </div>

          <Chessboard
            chess={currentPosition.chess}
            flipped={flipped}
            selectedSquare={null}
            legalTargets={EMPTY_LEGAL_TARGETS}
            lastMove={currentPosition.lastMove}
            isInteractive={false}
            theme={theme}
            pieceSet={pieceSet}
            highlightStyle={highlightStyle}
            boardSettings={boardSettings}
            onSquareClick={() => {}}
            onPieceDrop={() => {}}
          />

          {/* Replay Controls Bar */}
          <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 p-2.5 shadow-md">
            <button
              type="button"
              onClick={goFirst}
              disabled={currentPly === 0}
              className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
              title="First Move (Home)"
            >
              ⏮ First
            </button>
            <button
              type="button"
              onClick={goPrev}
              disabled={currentPly === 0}
              className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
              title="Previous Move (Left Arrow)"
            >
              ◀ Prev
            </button>
            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              className="action-button action-primary px-4 py-1.5 text-xs font-bold"
              title="Play/Pause (Space)"
            >
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={currentPly >= positions.length - 1}
              className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
              title="Next Move (Right Arrow)"
            >
              Next ▶
            </button>
            <button
              type="button"
              onClick={goLast}
              disabled={currentPly >= positions.length - 1}
              className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
              title="Last Move (End)"
            >
              Last ⏭
            </button>
          </div>
        </section>

        {/* Right Column: Engine Analysis & Move List */}
        <aside className="space-y-4">
          <EngineAnalysisPanel
            currentEvaluation={currentEvaluation}
            currentPly={currentPly}
            report={analysisReport}
            isAnalyzing={isAnalyzing}
            progressPercent={analysisProgress}
            engineVersion={stockfishEngine.getEngineVersion()}
            selectedDepth={selectedDepth}
            onDepthChange={setSelectedDepth}
            onRunAnalysis={handleRunAnalysis}
            onCancelAnalysis={handleCancelAnalysis}
            onSelectPly={goToPly}
          />

          {/* Interactive Move List with Classification Badges */}
          <div className="panel">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">Move Navigation</h3>
            <ol className="move-list mt-2 max-h-48" aria-label="Game moves">
              {Array.from({ length: Math.ceil(game.moves.length / 2) }).map((_, idx) => {
                const moveNum = idx + 1;
                const whitePly = idx * 2 + 1;
                const blackPly = idx * 2 + 2;
                const whiteMove = game.moves[whitePly - 1];
                const blackMove = game.moves[blackPly - 1];

                const whiteAnalysis = analysisReport?.positions.find((p) => p.ply === whitePly);
                const blackAnalysis = analysisReport?.positions.find((p) => p.ply === blackPly);

                const whiteSymbol = whiteAnalysis ? CLASSIFICATION_SYMBOLS[whiteAnalysis.classification] : null;
                const blackSymbol = blackAnalysis ? CLASSIFICATION_SYMBOLS[blackAnalysis.classification] : null;

                return (
                  <li key={moveNum} className="text-xs">
                    <span className="font-mono text-slate-500 font-bold">{moveNum}.</span>
                    <button
                      type="button"
                      onClick={() => goToPly(whitePly)}
                      className={`move-cell flex items-center justify-between gap-1 text-left ${
                        currentPly === whitePly ? 'active-move' : 'text-slate-200'
                      }`}
                    >
                      <span>{whiteMove?.san}</span>
                      {whiteSymbol?.symbol && (
                        <span className={`text-[11px] ${whiteSymbol.color}`}>{whiteSymbol.symbol}</span>
                      )}
                    </button>
                    {blackMove && (
                      <button
                        type="button"
                        onClick={() => goToPly(blackPly)}
                        className={`move-cell flex items-center justify-between gap-1 text-left ${
                          currentPly === blackPly ? 'active-move' : 'text-slate-300'
                        }`}
                      >
                        <span>{blackMove.san}</span>
                        {blackSymbol?.symbol && (
                          <span className={`text-[11px] ${blackSymbol.color}`}>{blackSymbol.symbol}</span>
                        )}
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>

          {/* PGN & FEN Tools */}
          <PgnFenTools
            currentFen={currentPosition.fen}
            pgnText={game.pgn}
          />
        </aside>
      </div>
    </div>
  );
};
