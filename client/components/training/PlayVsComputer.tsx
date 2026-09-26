import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Chess, type Move, type Square } from 'chess.js';
import type {
  BoardDisplaySettings,
  BoardTheme,
  HighlightStyleId,
  PieceSetId,
  SoundPreferences,
} from '../../types/preferences.js';
import type { GameResult, PlayerColor, PromotionPiece } from '../../../shared/types.js';
import { Chessboard } from '../Chessboard.js';
import { ResponsiveBoardFrame } from '../ResponsiveBoardFrame.js';
import { PlayerCard } from '../PlayerCard.js';
import { MoveHistory } from '../MoveHistory.js';
import { PromotionModal } from '../PromotionModal.js';
import { ConfirmDialog } from '../ConfirmDialog.js';
import {
  playCaptureSound,
  playCheckSound,
  playGameOverSound,
  playMoveSound,
} from '../../utils/sound.js';
import { getCapturedPiecesAndScore } from '../../utils/chess-helpers.js';
import { identifyOpening } from '../../utils/openings.js';
import {
  ComputerGameController,
  type ComputerGameConfig,
  type ComputerGameState,
  type GameSoundEvent,
} from '../../services/computer-game-controller.js';
import {
  ComputerPlayerService,
  DIFFICULTY_CONFIGS,
  type ComputerDifficulty,
} from '../../services/computer-player.js';
import type { SavedGame } from '../../services/game-history.js';

interface PlayVsComputerProps {
  initialConfig: ComputerGameConfig;
  theme: BoardTheme;
  pieceSet: PieceSetId;
  highlightStyle: HighlightStyleId;
  boardSettings: BoardDisplaySettings;
  soundSettings: SoundPreferences;
  onBackToLobby: () => void;
  onReviewGame: (game: SavedGame) => void;
  onOpenSettings: () => void;
}

export const PlayVsComputer: React.FC<PlayVsComputerProps> = ({
  initialConfig,
  theme,
  pieceSet,
  highlightStyle,
  boardSettings,
  soundSettings,
  onBackToLobby,
  onReviewGame,
  onOpenSettings,
}) => {
  const [controller, setController] = useState<ComputerGameController | null>(null);
  const [gameState, setGameState] = useState<ComputerGameState | null>(null);
  const [flipped, setFlipped] = useState(initialConfig.colorChoice === 'b');
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [premove, setPremove] = useState<{ from: Square; to: Square } | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    action: () => void;
  } | null>(null);

  const soundSettingsRef = useRef(soundSettings);
  soundSettingsRef.current = soundSettings;

  // Initialize service and controller on mount
  useEffect(() => {
    const service = new ComputerPlayerService();
    const ctrl = new ComputerGameController(service, initialConfig);

    const unsubState = ctrl.subscribeState((state) => {
      setGameState({ ...state });
    });

    const unsubSound = ctrl.subscribeSound((event: GameSoundEvent) => {
      const s = soundSettingsRef.current;
      if (!s.master) return;
      if (event === 'move' && s.move) playMoveSound();
      else if (event === 'capture' && s.capture) playCaptureSound();
      else if (event === 'check' && s.check) playCheckSound();
      else if (event === 'gameover' && s.gameEnd) playGameOverSound();
    });

    setController(ctrl);
    void ctrl.startNewGame();

    return () => {
      unsubState();
      unsubSound();
      ctrl.dispose();
      service.dispose();
    };
  }, [initialConfig]);

  const chess = useMemo(() => {
    if (!gameState) return new Chess();
    try {
      return new Chess(gameState.fen);
    } catch {
      return new Chess();
    }
  }, [gameState?.fen]);

  // Attempt premove execution when turn flips to human
  useEffect(() => {
    if (!controller || !gameState || gameState.status !== 'active') return;
    if (gameState.turn === gameState.humanColor && premove) {
      const pm = premove;
      setPremove(null);
      void controller.makeHumanMove(pm.from, pm.to);
    }
  }, [controller, gameState?.turn, gameState?.status, gameState?.humanColor, premove]);

  // Active opening detection
  const activeOpening = useMemo(() => {
    if (!gameState || gameState.moves.length === 0) return null;
    return identifyOpening(gameState.moves.map((m) => m.san));
  }, [gameState?.moves]);

  // Captured pieces and material score
  const capturedSummary = useMemo(() => {
    return getCapturedPiecesAndScore(chess);
  }, [chess]);

  // Legal move targets for square click / highlight
  const legalTargets = useMemo(() => {
    if (!selectedSquare) return new Map<Square, Move>();
    const moves = chess.moves({ square: selectedSquare, verbose: true });
    return new Map<Square, Move>(moves.map((m) => [m.to, m]));
  }, [chess, selectedSquare]);

  const canMove = Boolean(
    gameState &&
      gameState.status === 'active' &&
      gameState.turn === gameState.humanColor &&
      !gameState.isEngineThinking
  );

  const canPremove = Boolean(
    gameState &&
      gameState.status === 'active' &&
      gameState.turn !== gameState.humanColor
  );

  const handleSquareClick = useCallback(
    (square: Square) => {
      if (!controller || !gameState || gameState.status !== 'active') return;

      const piece = chess.get(square);

      if (canMove) {
        if (selectedSquare) {
          const targetMove = legalTargets.get(square);
          if (targetMove) {
            // Check for pawn promotion
            const isPawn = chess.get(selectedSquare)?.type === 'p';
            const isPromoRank = square.endsWith('8') || square.endsWith('1');
            if (isPawn && isPromoRank) {
              setPendingPromotion({ from: selectedSquare, to: square });
              setSelectedSquare(null);
              return;
            }

            void controller.makeHumanMove(selectedSquare, square);
            setSelectedSquare(null);
            return;
          }
        }

        if (piece && piece.color === gameState.humanColor) {
          setSelectedSquare(square);
        } else {
          setSelectedSquare(null);
        }
      } else if (canPremove) {
        // Premove handling
        if (selectedSquare) {
          if (selectedSquare !== square) {
            setPremove({ from: selectedSquare, to: square });
          }
          setSelectedSquare(null);
        } else if (piece && piece.color === gameState.humanColor) {
          setSelectedSquare(square);
        }
      }
    },
    [controller, gameState, chess, canMove, canPremove, selectedSquare, legalTargets]
  );

  const handlePieceDrop = useCallback(
    (from: Square, to: Square) => {
      if (!controller || !gameState || gameState.status !== 'active') return false;

      if (canMove) {
        const moves = chess.moves({ square: from, verbose: true });
        const legal = moves.find((m) => m.to === to);
        if (!legal) return false;

        const isPawn = chess.get(from)?.type === 'p';
        const isPromoRank = to.endsWith('8') || to.endsWith('1');
        if (isPawn && isPromoRank) {
          setPendingPromotion({ from, to });
          return true;
        }

        void controller.makeHumanMove(from, to);
        setSelectedSquare(null);
        return true;
      } else if (canPremove) {
        const piece = chess.get(from);
        if (piece && piece.color === gameState.humanColor) {
          setPremove({ from, to });
          setSelectedSquare(null);
          return true;
        }
      }

      return false;
    },
    [controller, gameState, chess, canMove, canPremove]
  );

  const handleExecutePromotion = (piece: PromotionPiece) => {
    if (!controller || !pendingPromotion) return;
    const { from, to } = pendingPromotion;
    setPendingPromotion(null);
    void controller.makeHumanMove(from, to, piece);
  };

  const handleResign = () => {
    if (!controller || !gameState || gameState.status !== 'active') return;
    setPendingConfirm({
      title: 'Resign Game',
      message: 'Are you sure you want to resign against the computer?',
      confirmLabel: 'Resign',
      danger: true,
      action: () => controller.resign(),
    });
  };

  const handleRestart = () => {
    if (!controller) return;
    if (gameState?.status === 'active') {
      setPendingConfirm({
        title: 'Restart Game',
        message: 'Abandon this match and start a new game from move 1?',
        confirmLabel: 'Restart',
        danger: true,
        action: () => {
          setSelectedSquare(null);
          setPremove(null);
          void controller.startNewGame();
        },
      });
    } else {
      setSelectedSquare(null);
      setPremove(null);
      void controller.startNewGame();
    }
  };

  const handleLeave = () => {
    if (gameState?.status === 'active') {
      setPendingConfirm({
        title: 'Leave Match',
        message: 'Are you sure you want to leave? Your game progress will be lost.',
        confirmLabel: 'Leave',
        danger: true,
        action: onBackToLobby,
      });
    } else {
      onBackToLobby();
    }
  };

  if (!gameState) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center text-slate-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent mx-auto mb-2" />
          <p className="text-sm font-semibold">Starting Stockfish...</p>
        </div>
      </div>
    );
  }

  const diffConfig = DIFFICULTY_CONFIGS[gameState.difficulty];
  const engineDisplayName = `Stockfish (${diffConfig.name})`;

  const topColor: PlayerColor = flipped ? gameState.humanColor : gameState.computerColor;
  const bottomColor: PlayerColor = flipped ? gameState.computerColor : gameState.humanColor;

  const topName = topColor === gameState.humanColor ? initialConfig.playerName : engineDisplayName;
  const bottomName = bottomColor === gameState.humanColor ? initialConfig.playerName : engineDisplayName;

  const topTimeMs = topColor === 'w' ? gameState.whiteTimeMs : gameState.blackTimeMs;
  const bottomTimeMs = bottomColor === 'w' ? gameState.whiteTimeMs : gameState.blackTimeMs;

  const { capturedWhite, capturedBlack, whiteAdvantage, blackAdvantage } = capturedSummary;
  const topCaptured = topColor === 'w' ? capturedWhite : capturedBlack;
  const bottomCaptured = bottomColor === 'w' ? capturedWhite : capturedBlack;
  const topAdvantage = topColor === 'w' ? whiteAdvantage : blackAdvantage;
  const bottomAdvantage = bottomColor === 'w' ? whiteAdvantage : blackAdvantage;

  const lastMove = gameState.moves.at(-1) ?? null;
  const moveNumber = Math.floor(gameState.moves.length / 2) + 1;

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-3 py-2 sm:px-6 sm:py-3.5">
      {/* Top Header Bar */}
      <header className="mb-2 sm:mb-3 flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800 pb-2 sm:pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-amber-400/10 border border-amber-500/30 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-amber-300">
              Offline vs Computer
            </span>
            <span className="text-xs font-semibold text-slate-400">
              · {diffConfig.name} ({diffConfig.description})
            </span>
            {activeOpening && (
              <span className="text-xs font-semibold text-amber-300/90 hidden md:inline">
                · {activeOpening.name}
              </span>
            )}
          </div>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-white sm:text-3xl">
            LAN CHESS
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Engine thinking indicator */}
          {gameState.isEngineThinking && (
            <div className="flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-950/70 px-3 py-1 text-xs font-semibold text-indigo-300 animate-pulse">
              <span className="h-2 w-2 rounded-full bg-indigo-400" />
              <span>Stockfish thinking...</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className="action-button action-secondary px-2.5 py-1 text-xs"
            title="Flip board perspective"
          >
            Flip Board
          </button>

          <button
            type="button"
            onClick={handleRestart}
            className="action-button action-secondary px-2.5 py-1 text-xs"
          >
            Restart
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="action-button action-secondary px-2.5 py-1 text-xs"
            title="Settings & Themes"
          >
            ⚙️
          </button>

          <button
            type="button"
            onClick={handleLeave}
            className="action-button action-secondary px-2.5 py-1 text-xs text-rose-300 hover:border-rose-700 hover:text-rose-200"
          >
            Lobby
          </button>
        </div>
      </header>

      {/* Engine Error Alert */}
      {gameState.engineError && (
        <div className="mb-4 rounded-xl border border-rose-500/60 bg-rose-950/80 p-3.5 shadow-lg flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-rose-200">
            ⚠️ {gameState.engineError}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void controller?.retryComputerMove()}
              className="action-button action-primary text-xs font-bold"
            >
              Retry Move
            </button>
            <button
              type="button"
              onClick={handleRestart}
              className="action-button action-secondary text-xs"
            >
              Restart
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Board Column + Move History Column */}
      <div className="grid gap-4 lg:gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        {/* Left Column: Board & Player Panels */}
        <section className="mx-auto w-full max-w-[46rem]">
          {/* Top Player Card */}
          <div className="mb-1.5 sm:mb-2">
            <PlayerCard
              name={topName}
              color={topColor}
              isTurn={gameState.turn === topColor && gameState.status === 'active'}
              timeMs={topTimeMs}
              capturedPieces={topCaptured}
              advantage={topAdvantage}
              isLocalPlayer={topColor === gameState.humanColor}
            />
          </div>

          {/* Status banner */}
          <div
            className="mb-1.5 sm:mb-2 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-2 font-medium">
              <span
                className={`h-2 w-2 rounded-full ${
                  chess.isCheck()
                    ? 'bg-rose-500 animate-ping'
                    : gameState.status === 'active'
                    ? gameState.turn === gameState.humanColor
                      ? 'bg-emerald-400'
                      : 'bg-indigo-400'
                    : 'bg-amber-400'
                }`}
              />
              <span className="text-slate-200">
                {gameState.status === 'active'
                  ? chess.isCheck()
                    ? 'Check!'
                    : gameState.turn === gameState.humanColor
                    ? 'Your turn'
                    : 'Stockfish is calculating...'
                  : gameState.reason ?? 'Game over'}
              </span>
            </div>
            <span className="font-mono text-slate-400">Move {moveNumber}</span>
          </div>

          {/* Interactive Chessboard wrapped in ResponsiveBoardFrame */}
          <ResponsiveBoardFrame>
            <Chessboard
              chess={chess}
              flipped={flipped}
              selectedSquare={selectedSquare}
              legalTargets={legalTargets}
              lastMove={lastMove}
              isInteractive={canMove || canPremove}
              premove={premove}
              theme={theme}
              pieceSet={pieceSet}
              highlightStyle={highlightStyle}
              boardSettings={boardSettings}
              onSquareClick={handleSquareClick}
              onPieceDrop={handlePieceDrop}
            />
          </ResponsiveBoardFrame>

          {/* Bottom Player Card */}
          <div className="mt-1.5 sm:mt-2">
            <PlayerCard
              name={bottomName}
              color={bottomColor}
              isTurn={gameState.turn === bottomColor && gameState.status === 'active'}
              timeMs={bottomTimeMs}
              capturedPieces={bottomCaptured}
              advantage={bottomAdvantage}
              isLocalPlayer={bottomColor === gameState.humanColor}
            />
          </div>

          {/* Resign action button */}
          {gameState.status === 'active' && (
            <div className="mt-2 sm:mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleResign}
                className="action-button action-secondary flex-1 text-xs text-rose-300 hover:border-rose-800 hover:text-rose-200"
              >
                Resign Game
              </button>
            </div>
          )}
        </section>

        {/* Right Column: Move History & Game Information */}
        <aside className="space-y-3 lg:max-h-[calc(100dvh-5.5rem)] lg:overflow-y-auto lg:pr-1">
          <MoveHistory moves={gameState.moves} />

          {/* Offline Information Box */}
          <div className="panel space-y-2 text-xs text-slate-400">
            <h3 className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
              Offline Chess Workstation
            </h3>
            <p>
              Stockfish runs locally inside your browser via WebAssembly with zero network overhead.
            </p>
            <div className="pt-2 border-t border-slate-800 space-y-1">
              <div className="flex justify-between">
                <span>Difficulty:</span>
                <span className="font-semibold text-slate-200">{diffConfig.name}</span>
              </div>
              <div className="flex justify-between">
                <span>Search Depth:</span>
                <span className="font-semibold text-slate-200">Depth {diffConfig.depth}</span>
              </div>
              <div className="flex justify-between">
                <span>Time Control:</span>
                <span className="font-semibold text-slate-200">{gameState.timeControl}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Pawn Promotion Modal */}
      {pendingPromotion && (
        <PromotionModal
          color={gameState.humanColor}
          onSelect={handleExecutePromotion}
          onCancel={() => setPendingPromotion(null)}
        />
      )}

      {/* Confirmation Dialog */}
      {pendingConfirm && (
        <ConfirmDialog
          title={pendingConfirm.title}
          message={pendingConfirm.message}
          confirmLabel={pendingConfirm.confirmLabel}
          danger={pendingConfirm.danger}
          onConfirm={() => {
            pendingConfirm.action();
            setPendingConfirm(null);
          }}
          onCancel={() => setPendingConfirm(null)}
        />
      )}

      {/* Game Over Dialog */}
      {gameState.status === 'finished' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="panel w-full max-w-md border-amber-400/40 bg-slate-900/95 p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="text-center">
              <span className="text-4xl mb-2 inline-block">
                {gameState.winner === gameState.humanColor
                  ? '🏆'
                  : gameState.winner === 'draw'
                  ? '🤝'
                  : '🤖'}
              </span>
              <h2 className="text-2xl font-black text-white">
                {gameState.winner === gameState.humanColor
                  ? 'Victory!'
                  : gameState.winner === 'draw'
                  ? 'Game Drawn'
                  : 'Defeat'}
              </h2>
              <p className="mt-1 text-sm text-slate-300 font-medium">
                {gameState.reason}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                This game has been saved into your local archives.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
              {controller?.getCompletedGame() && (
                <button
                  type="button"
                  onClick={() => {
                    const saved = controller.getCompletedGame();
                    if (saved) onReviewGame(saved);
                  }}
                  className="action-button action-primary w-full text-sm font-bold flex items-center justify-center gap-2"
                >
                  <span>🔍</span>
                  <span>Review Game with Stockfish</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleRestart}
                className="action-button action-secondary w-full text-sm font-semibold"
              >
                Play Again
              </button>

              <button
                type="button"
                onClick={onBackToLobby}
                className="action-button action-secondary w-full text-sm"
              >
                Back to Lobby
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
