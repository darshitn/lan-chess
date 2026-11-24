import React, { useState, useMemo, useEffect } from 'react';
import { Chess, type Move, type Square } from 'chess.js';
import type { BoardDisplaySettings, BoardTheme, HighlightStyleId, PieceSetId } from '../../types/preferences.js';
import { Chessboard } from '../Chessboard.js';
import { StudyBoardFrame } from '../StudyBoardFrame.js';
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
  const opening = useMemo(() => identifyOpening(moveHistory), [moveHistory]);
  const [engineMessage, setEngineMessage] = useState('');

  useEffect(() => {
    setEvalScore(null);
    setBestMove(null);
    if (!isEngineOn) return;
    let current = true;
    setEngineMessage('Analyzing…');
    stockfishEngine.evaluateFen(fen, 12).then(result => {
      if (!current) return;
      setEngineMessage(result ? '' : 'Evaluation unavailable');
      if (result) {
        setEvalScore(formatEngineScore(result.score));
        setBestMove(result.bestMoveSan || null);
      }
    }).catch(() => {
      if (current) setEngineMessage('Evaluation unavailable');
    });
    return () => {
      current = false;
      stockfishEngine.cancelAnalysis();
    };
  }, [fen, isEngineOn]);

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

  };

  const toggleEngine = () => setIsEngineOn(value => !value);

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-3 py-2 sm:px-6 sm:py-3.5">
      {/* Top Header */}
      <header className="mb-2 sm:mb-3 flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800 pb-2 sm:pb-2.5">
        <div>
          <h1 className="workspace-title">Practice board</h1>
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
            aria-pressed={isEngineOn}
            className={`action-button px-3 py-1 text-xs font-bold ${
              isEngineOn ? 'bg-emerald-500 text-slate-950' : 'action-secondary text-slate-300'
            }`}
          >
            {isEngineOn ? 'Engine on' : 'Engine off'}
          </button>
          <button
            type="button"
            onClick={() => setIsSetupOpen(true)}
            className="action-button action-secondary px-3 py-1 text-xs text-amber-300"
          >
            Set up position
          </button>
          <button
            type="button"
            onClick={onBackToPlay}
            className="action-button action-secondary px-3 py-1 text-xs"
          >
            Back to play
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-4 lg:gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        {/* Board column */}
        <section className="study-board-column mx-auto w-full min-w-0 max-w-[46rem]">
          <div className="mb-1.5 sm:mb-2 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs">
            <span className="font-semibold text-white">
              {chess.turn() === 'w' ? 'White to move' : 'Black to move'}
              {chess.isCheck() ? ' (Check!)' : ''}
              {chess.isCheckmate() ? ' (Checkmate!)' : ''}
            </span>
            {isEngineOn && !evalScore && <span role="status">{engineMessage}</span>}
            {isEngineOn && evalScore !== null && (
              <span className="font-mono font-bold text-amber-300">
                Eval: {evalScore}
                {bestMove ? ` · Best: ${bestMove}` : ''}
              </span>
            )}
          </div>

          <StudyBoardFrame>
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
          </StudyBoardFrame>

          <div className="mt-2 sm:mt-3 flex gap-2">
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
        <aside className="space-y-3 lg:max-h-[calc(100dvh-5.5rem)] lg:overflow-y-auto lg:pr-1">
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
          initialFen={fen}
          theme={theme}
          pieceSet={pieceSet}
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
