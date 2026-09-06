import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Chess, type Move, type Square } from 'chess.js';
import { io, type Socket } from 'socket.io-client';
import {
  type ClientToServerEvents,
  type ConnectionStatus,
  type GameResult,
  type GameState,
  type PlayerColor,
  type PromotionPiece,
  type ServerToClientEvents,
  type TimeControl,
  SOCKET_EVENTS,
} from '../shared/types.js';
import { Lobby } from './components/Lobby.js';
import { Chessboard } from './components/Chessboard.js';
import { PlayerCard } from './components/PlayerCard.js';
import { MoveHistory } from './components/MoveHistory.js';
import { ChatPanel } from './components/ChatPanel.js';
import { PromotionModal } from './components/PromotionModal.js';
import { GameOverModal } from './components/GameOverModal.js';
import { ConfirmDialog } from './components/ConfirmDialog.js';
import { SettingsModal } from './components/settings/SettingsModal.js';
import { GameReview } from './components/review/GameReview.js';
import { HistoryView } from './components/review/HistoryView.js';
import { PracticeBoard } from './components/training/PracticeBoard.js';
import { PuzzlePlayer } from './components/training/PuzzlePlayer.js';
import {
  playMoveSound,
  playCaptureSound,
  playCheckSound,
  playGameOverSound,
} from './utils/sound.js';
import { getCapturedPiecesAndScore } from './utils/chess-helpers.js';
import { identifyOpening } from './utils/openings.js';
import {
  loadUserPreferences,
  saveUserPreferences,
  loadCustomThemes,
  saveCustomThemes,
  getActiveBoardTheme,
  applyUiThemeToDom,
} from './services/preferences.js';
import {
  getSavedGames,
  saveCompletedGame,
  deleteSavedGame,
  toggleFavoriteGame,
  type SavedGame,
} from './services/game-history.js';
import type { BoardTheme, UserPreferences } from './types/preferences.js';

const PLAYER_STORAGE_KEY = 'lan-chess-player-id';

function getStoredSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(PLAYER_STORAGE_KEY);
}

function storeSessionId(sessionId: string): void {
  try {
    window.localStorage.setItem(PLAYER_STORAGE_KEY, sessionId);
  } catch {
    // Storage may be unavailable (private mode / quota): the session simply
    // won't survive a refresh.
  }
}

/**
 * Builds a PGN with real headers — chess.js defaults would emit
 * `White "?"` / `Result "*"` regardless of the actual game outcome.
 */
function buildGamePgn(
  chess: Chess,
  whiteName: string,
  blackName: string,
  winner: GameResult | null,
  reason: string | null
): string {
  const result =
    winner === 'w' ? '1-0' : winner === 'b' ? '0-1' : winner === 'draw' ? '1/2-1/2' : '*';
  chess.setHeader('White', whiteName);
  chess.setHeader('Black', blackName);
  chess.setHeader('Result', result);
  if (reason) chess.setHeader('Termination', reason);
  return chess.pgn();
}

function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
  }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const success = document.execCommand('copy');
    document.body.removeChild(el);
    return Promise.resolve(success);
  } catch {
    return Promise.resolve(false);
  }
}

export function App() {
  const socket = useMemo<Socket<ServerToClientEvents, ClientToServerEvents>>(() => {
    const serverUrl = import.meta.env.VITE_SERVER_URL
      ? import.meta.env.VITE_SERVER_URL
      : import.meta.env.DEV
      ? `${window.location.protocol}//${window.location.hostname}:3001`
      : undefined;
    return io(serverUrl, { transports: ['websocket', 'polling'] }) as Socket<ServerToClientEvents, ClientToServerEvents>;
  }, []);

  // Application navigation view
  const [currentView, setCurrentView] = useState<'play' | 'history' | 'review' | 'practice' | 'puzzles'>('play');
  const [reviewGame, setReviewGame] = useState<SavedGame | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Preferences & Customization state
  const [preferences, setPreferences] = useState<UserPreferences>(() => loadUserPreferences());
  const [customThemes, setCustomThemes] = useState<BoardTheme[]>(() => loadCustomThemes());
  const [savedGames, setSavedGames] = useState<SavedGame[]>(() => getSavedGames());

  // Multiplayer Game state
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [color, setColor] = useState<PlayerColor | null>(null);
  const [role, setRole] = useState<'player' | 'spectator'>('player');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [hostUrl, setHostUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [premove, setPremove] = useState<{ from: Square; to: Square } | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    action: () => void;
  } | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [timeControl, setTimeControl] = useState<TimeControl>('3+0');
  const [allowTakebacks, setAllowTakebacks] = useState(true);

  const prevMovesCountRef = useRef(0);
  const prevStatusRef = useRef<GameState['status']>('waiting');
  // Sound preferences are read through a ref so that toggling a sound setting
  // does not tear down and re-establish the socket connection mid-game.
  const soundPrefsRef = useRef(preferences.sound);
  useEffect(() => {
    soundPrefsRef.current = preferences.sound;
  }, [preferences.sound]);

  const chess = useMemo(() => new Chess(gameState?.fen), [gameState?.fen]);

  // Active theme calculation
  const activeTheme = useMemo(
    () => getActiveBoardTheme(preferences.activeThemeId, customThemes),
    [preferences.activeThemeId, customThemes]
  );

  // Opening and capture calculation, kept out of the render path (App re-renders
  // on every socket message, selection change, and clock tick).
  const activeOpening = useMemo(
    () => (gameState ? identifyOpening(gameState.moves.map((m) => m.san)) : null),
    [gameState]
  );
  const capturedSummary = useMemo(() => getCapturedPiecesAndScore(chess), [chess]);

  // Apply UI Theme tokens on mount or preference change
  useEffect(() => {
    applyUiThemeToDom(preferences.uiTheme);
  }, [preferences.uiTheme]);

  const canMove = Boolean(
    gameState &&
    role === 'player' &&
    color &&
    gameState.status === 'active' &&
    gameState.turn === color
  );

  // Premoving: queue a move while it is the opponent's turn. The move is only
  // attempted (and only by the authoritative server) once it is actually our
  // turn — illegal premoves are discarded silently.
  const canPremove = Boolean(
    gameState &&
    role === 'player' &&
    color &&
    gameState.status === 'active' &&
    !pendingPromotion &&
    gameState.turn !== color
  );

  // A premove only survives while a game is actively waiting for the opponent;
  // any finished/disconnected/waiting state clears it.
  useEffect(() => {
    if (gameState?.status !== 'active') {
      setPremove(null);
    }
  }, [gameState?.status]);

  // Execute the queued premove the moment it becomes our turn.
  useEffect(() => {
    if (!canMove || !premove) return;
    const candidates = chess
      .moves({ square: premove.from, verbose: true })
      .filter((m) => m.to === premove.to);
    // Legality is re-checked in the position that just arose: if the
    // opponent's move invalidated the premove, it is discarded silently.
    const chosen = candidates.find((m) => m.promotion === 'q') ?? candidates[0];
    setPremove(null);
    setSelectedSquare(null);
    if (chosen) {
      // Premove promotions auto-queen (the first listed promotion is q).
      const promotion = chosen.promotion ? (chosen.promotion as PromotionPiece) : undefined;
      executeMove(premove.from, premove.to, promotion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canMove]);

  // Escape cancels a queued premove (and any selection).
  useEffect(() => {
    if (!premove) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPremove(null);
        setSelectedSquare(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [premove]);

  // Auto-orient board to Black's perspective when playing Black
  useEffect(() => {
    if (color === 'b') {
      setFlipped(true);
    } else if (color === 'w') {
      setFlipped(false);
    }
  }, [color]);

  const handleUpdatePreferences = (newPrefs: UserPreferences) => {
    setPreferences(newPrefs);
    saveUserPreferences(newPrefs);
  };

  const handleSaveCustomTheme = (newTheme: BoardTheme) => {
    const updated = [newTheme, ...customThemes.filter((t) => t.id !== newTheme.id)];
    setCustomThemes(updated);
    saveCustomThemes(updated);
    handleUpdatePreferences({ ...preferences, activeThemeId: newTheme.id });
  };

  const handleDeleteCustomTheme = (themeId: string) => {
    const updated = customThemes.filter((t) => t.id !== themeId);
    setCustomThemes(updated);
    saveCustomThemes(updated);
    if (preferences.activeThemeId === themeId) {
      handleUpdatePreferences({ ...preferences, activeThemeId: 'wooden' });
    }
  };

  // Socket setup & event listeners
  useEffect(() => {
    const onConnect = () => {
      setConnectionStatus('connected');
      const sessionId = getStoredSessionId();
      if (sessionId) {
        socket.emit(SOCKET_EVENTS.IDENTIFY_SESSION, { sessionId });
      }
    };

    const onDisconnect = () => setConnectionStatus('disconnected');
    const onReconnectAttempt = () => setConnectionStatus('reconnecting');
    const onSocketReconnect = () => {
      setConnectionStatus('connected');
      const sessionId = getStoredSessionId();
      if (sessionId) {
        socket.emit(SOCKET_EVENTS.IDENTIFY_SESSION, { sessionId });
      }
    };

    const onRoomCreated = (payload: { roomCode: string; playerColor: PlayerColor; sessionId: string; hostUrl: string | null }) => {
      storeSessionId(payload.sessionId);
      setColor(payload.playerColor);
      setRole('player');
      if (payload.hostUrl) setHostUrl(payload.hostUrl);
      setError(null);
      setCurrentView('play');
      // Sync sound tracking to the new game without replaying sounds for
      // moves that already happened.
      prevMovesCountRef.current = -1;
      prevStatusRef.current = 'waiting';
      setPremove(null);
    };

    const onRoomJoined = (payload: { roomCode: string; playerColor: PlayerColor | null; sessionId: string; role: 'player' | 'spectator' }) => {
      storeSessionId(payload.sessionId);
      setColor(payload.playerColor);
      setRole(payload.role);
      setError(null);
      setCurrentView('play');
      prevMovesCountRef.current = -1;
      prevStatusRef.current = 'waiting';
      setPremove(null);
    };

    const onGameState = (state: GameState) => {
      setGameState(state);
      setError(null);

      const soundPrefs = soundPrefsRef.current;
      const currentMovesCount = state.moves.length;

      // -1 marks a fresh room join: adopt the existing move count silently.
      if (prevMovesCountRef.current === -1) {
        prevMovesCountRef.current = currentMovesCount;
        prevStatusRef.current = state.status;
        // Reconnecting into a game that already ended must still save it.
        if (state.status === 'finished') saveFinishedGame(state);
        return;
      }

      // Sound triggers
      if (currentMovesCount > prevMovesCountRef.current && soundPrefs.master) {
        const lastMove = state.moves[currentMovesCount - 1];
        if (lastMove?.captured && soundPrefs.capture) {
          playCaptureSound();
        } else if (soundPrefs.move) {
          playMoveSound();
        }

        const tempChess = new Chess(state.fen);
        if (tempChess.isCheck() && soundPrefs.check) {
          playCheckSound();
        }
      }

      if (state.status === 'finished' && prevStatusRef.current !== 'finished') {
        if (soundPrefs.master && soundPrefs.gameEnd) {
          playGameOverSound();
        }
        saveFinishedGame(state);
      }

      prevMovesCountRef.current = currentMovesCount;
      prevStatusRef.current = state.status;
    };

    const saveFinishedGame = (state: GameState) => {
      try {
        const finishedChess = new Chess();
        for (const m of state.moves) {
          try {
            finishedChess.move({ from: m.from, to: m.to, promotion: m.promotion });
          } catch {
            break; // replay stops at the first inconsistent move; keep partial game
          }
        }
        const sans = state.moves.map((m) => m.san);
        const opening = identifyOpening(sans);

        const savedGameItem: SavedGame = {
          id: `game-${Date.now()}-${state.roomCode}`,
          roomCode: state.roomCode,
          date: Date.now(),
          whiteName: state.whiteName,
          blackName: state.blackName ?? 'Black',
          winner: state.winner,
          reason: state.reason,
          timeControl: state.timeControl,
          pgn: buildGamePgn(finishedChess, state.whiteName, state.blackName ?? 'Black', state.winner, state.reason),
          moves: state.moves,
          fen: state.fen,
          opening,
        };

        saveCompletedGame(savedGameItem);
        setSavedGames(getSavedGames());
      } catch {
        // Graceful ignore
      }
    };

    const onClockUpdate = ({ roomCode, whiteTimeMs, blackTimeMs }: { roomCode: string; whiteTimeMs: number | null; blackTimeMs: number | null }) => {
      setGameState((prev) =>
        prev && prev.roomCode === roomCode ? { ...prev, whiteTimeMs, blackTimeMs } : prev
      );
    };

    const onGameError = ({ message }: { message: string }) => {
      setError(message);
    };

    const onConnectionStatus = (payload: { status: ConnectionStatus }) => {
      setConnectionStatus(payload.status);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect', onSocketReconnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);

    socket.on(SOCKET_EVENTS.ROOM_CREATED, onRoomCreated);
    socket.on(SOCKET_EVENTS.ROOM_JOINED, onRoomJoined);
    socket.on(SOCKET_EVENTS.GAME_STATE, onGameState);
    socket.on(SOCKET_EVENTS.CLOCK_UPDATE, onClockUpdate);
    socket.on(SOCKET_EVENTS.GAME_ERROR, onGameError);
    socket.on(SOCKET_EVENTS.CONNECTION_STATUS, onConnectionStatus);

    socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect', onSocketReconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.off(SOCKET_EVENTS.ROOM_CREATED, onRoomCreated);
      socket.off(SOCKET_EVENTS.ROOM_JOINED, onRoomJoined);
      socket.off(SOCKET_EVENTS.GAME_STATE, onGameState);
      socket.off(SOCKET_EVENTS.CLOCK_UPDATE, onClockUpdate);
      socket.off(SOCKET_EVENTS.GAME_ERROR, onGameError);
      socket.off(SOCKET_EVENTS.CONNECTION_STATUS, onConnectionStatus);
      socket.disconnect();
    };
  }, [socket]);

  // Clear selection if not active turn
  useEffect(() => {
    if (!canMove) {
      setSelectedSquare(null);
      setPendingPromotion(null);
    }
  }, [canMove]);

  // Legal targets calculation
  const legalTargets = useMemo(() => {
    if (!selectedSquare || !canMove) return new Map<Square, Move>();
    const moves = chess.moves({ square: selectedSquare, verbose: true });
    return new Map<Square, Move>(moves.map((m) => [m.to, m]));
  }, [chess, selectedSquare, canMove]);

  const executeMove = useCallback((from: Square, to: Square, promotionPiece?: PromotionPiece) => {
    if (!canMove) return;
    socket.emit(SOCKET_EVENTS.MAKE_MOVE, { from, to, promotion: promotionPiece });
    setSelectedSquare(null);
    setPendingPromotion(null);
  }, [canMove, socket]);

  const handleSquareClick = useCallback((square: Square) => {
    if (!gameState || gameState.status !== 'active' || pendingPromotion) return;

    if (!canMove) {
      // Premoving: queue a move for our next turn.
      if (!canPremove || !color) return;

      // Clicking the premove target again cancels it.
      if (premove && square === premove.to) {
        setPremove(null);
        setSelectedSquare(null);
        return;
      }

      // With a piece selected, any other square (re)targets the premove.
      if (selectedSquare && square !== selectedSquare) {
        setPremove({ from: selectedSquare, to: square });
        setSelectedSquare(null);
        return;
      }

      const piece = chess.get(square);
      if (piece && piece.color === color) {
        // Clicking the premove origin with nothing selected cancels the premove.
        if (premove && square === premove.from && !selectedSquare) {
          setPremove(null);
          return;
        }
        setSelectedSquare(square === selectedSquare ? null : square);
      } else {
        setSelectedSquare(null);
      }
      return;
    }

    const piece = chess.get(square);
    const targetMove = legalTargets.get(square);

    if (selectedSquare && targetMove) {
      if (targetMove.promotion) {
        setPendingPromotion({ from: selectedSquare, to: square });
      } else {
        executeMove(selectedSquare, square);
      }
      return;
    }

    if (piece && piece.color === color) {
      setSelectedSquare(square);
    } else {
      setSelectedSquare(null);
    }
  }, [gameState, canMove, canPremove, pendingPromotion, chess, legalTargets, selectedSquare, color, executeMove, premove]);

  const handlePieceDrop = useCallback((from: Square, to: Square) => {
    if (!gameState || gameState.status !== 'active' || pendingPromotion) return;

    if (!canMove) {
      // Premoving via drag: only our own pieces, dropping onto another square.
      if (!canPremove || !color || from === to) return;
      const dragged = chess.get(from);
      if (!dragged || dragged.color !== color) return;
      if (premove && premove.from === from && premove.to === to) {
        setPremove(null); // dropping the same premove again cancels it
      } else {
        setPremove({ from, to });
        setSelectedSquare(null);
      }
      return;
    }

    const moves = chess.moves({ square: from, verbose: true });
    const targetMove = moves.find((m) => m.to === to);
    if (!targetMove) return;

    if (targetMove.promotion) {
      setPendingPromotion({ from, to });
    } else {
      executeMove(from, to);
    }
  }, [gameState, canMove, canPremove, pendingPromotion, chess, color, premove]);

  // Lobby actions
  const handleCreateGame = () => {
    const sessionId = getStoredSessionId();
    socket.emit(SOCKET_EVENTS.CREATE_GAME, {
      playerName: preferences.playerName,
      sessionId,
      timeControl,
      allowTakebacks,
    });
  };

  const handleJoinGame = () => {
    const sessionId = getStoredSessionId();
    socket.emit(SOCKET_EVENTS.JOIN_GAME, {
      roomCode: roomCodeInput,
      playerName: preferences.playerName,
      sessionId,
    });
  };

  const handleJoinSpectator = () => {
    const sessionId = getStoredSessionId();
    socket.emit(SOCKET_EVENTS.JOIN_SPECTATOR, {
      roomCode: roomCodeInput,
      playerName: preferences.playerName,
      sessionId,
    });
  };

  // Game actions (in-app confirm dialog: window.confirm is broken/suppressed
  // in some browsers, e.g. Arc, which made resign/draw/takeback dead there)
  const handleResign = () => {
    if (!gameState || gameState.status !== 'active' || role !== 'player' || !color) return;
    setPendingConfirm({
      title: 'Resign Game?',
      message: 'Your opponent will be awarded the win.',
      confirmLabel: 'Resign',
      danger: true,
      action: () => socket.emit(SOCKET_EVENTS.RESIGN_GAME),
    });
  };

  const handleOfferDraw = () => {
    if (!gameState || gameState.status !== 'active' || role !== 'player' || !color) return;
    if (gameState.drawOfferBy) {
      setError('A draw offer is already pending.');
      return;
    }
    setPendingConfirm({
      title: 'Offer Draw?',
      message: 'Your opponent can accept or decline the offer.',
      confirmLabel: 'Offer Draw',
      action: () => socket.emit(SOCKET_EVENTS.OFFER_DRAW),
    });
  };

  const handleRespondDraw = (accept: boolean) => {
    socket.emit(SOCKET_EVENTS.RESPOND_DRAW, { accept });
  };

  const handleRequestTakeback = () => {
    if (!gameState || gameState.status !== 'active' || role !== 'player' || !color) return;
    setPendingConfirm({
      title: 'Request Takeback?',
      message: 'Your opponent can accept or decline your takeback request.',
      confirmLabel: 'Request Takeback',
      action: () => socket.emit(SOCKET_EVENTS.REQUEST_TAKEBACK),
    });
  };

  const handleRespondTakeback = (accept: boolean) => {
    socket.emit(SOCKET_EVENTS.RESPOND_TAKEBACK, { accept });
  };

  const handleRequestRematch = () => {
    socket.emit(SOCKET_EVENTS.REQUEST_REMATCH);
  };

  const handleRespondRematch = (accept: boolean) => {
    socket.emit(SOCKET_EVENTS.RESPOND_REMATCH, { accept });
  };

  const handleLeaveRoom = () => {
    socket.emit(SOCKET_EVENTS.LEAVE_ROOM);
    setGameState(null);
    setColor(null);
    setSelectedSquare(null);
    setPendingPromotion(null);
    setError(null);
    setCurrentView('play');
    setPremove(null);
    prevMovesCountRef.current = 0;
    prevStatusRef.current = 'waiting';
  };

  const handleSendChat = (message: string) => {
    socket.emit(SOCKET_EVENTS.SEND_CHAT, { message });
  };

  const handleShareRoom = async () => {
    if (!gameState) return;
    const shareText = hostUrl
      ? `Join my LAN Chess match!\nRoom Code: ${gameState.roomCode}\nLink: ${hostUrl}`
      : `LAN Chess Room Code: ${gameState.roomCode}`;
    const success = await copyToClipboard(shareText);
    if (success) {
      setCopiedNotification('Room details copied to clipboard!');
      setTimeout(() => setCopiedNotification(null), 3000);
    }
  };

  // Launch review from current game
  const handleOpenCurrentGameReview = () => {
    if (!gameState) return;
    const finishedChess = new Chess();
    for (const m of gameState.moves) {
      try {
        finishedChess.move({ from: m.from, to: m.to, promotion: m.promotion });
      } catch {
        break;
      }
    }

    const gameRecord: SavedGame = {
      id: `current-review-${Date.now()}`,
      roomCode: gameState.roomCode,
      date: Date.now(),
      whiteName: gameState.whiteName,
      blackName: gameState.blackName ?? 'Black',
      winner: gameState.winner,
      reason: gameState.reason,
      timeControl: gameState.timeControl,
      pgn: buildGamePgn(finishedChess, gameState.whiteName, gameState.blackName ?? 'Black', gameState.winner, gameState.reason),
      moves: gameState.moves,
      fen: gameState.fen,
      opening: identifyOpening(gameState.moves.map((m) => m.san)),
    };

    setReviewGame(gameRecord);
    setCurrentView('review');
  };

  // History item select
  const handleSelectHistoryGame = (game: SavedGame) => {
    setReviewGame(game);
    setCurrentView('review');
  };

  const handleDeleteHistoryGame = (id: string) => {
    deleteSavedGame(id);
    setSavedGames(getSavedGames());
  };

  const handleToggleFavoriteHistoryGame = (id: string) => {
    toggleFavoriteGame(id);
    setSavedGames(getSavedGames());
  };

  // RENDER: Review View
  if (currentView === 'review' && reviewGame) {
    return (
      <GameReview
        game={reviewGame}
        theme={activeTheme}
        pieceSet={preferences.pieceSet}
        highlightStyle={preferences.highlightStyle}
        boardSettings={preferences.boardSettings}
        onExitReview={() => setCurrentView('play')}
      />
    );
  }

  // RENDER: History View
  if (currentView === 'history') {
    return (
      <HistoryView
        games={savedGames}
        playerName={preferences.playerName}
        onSelectGame={handleSelectHistoryGame}
        onDeleteGame={handleDeleteHistoryGame}
        onToggleFavorite={handleToggleFavoriteHistoryGame}
        onBackToPlay={() => setCurrentView('play')}
      />
    );
  }

  // RENDER: Practice Sandbox View
  if (currentView === 'practice') {
    return (
      <PracticeBoard
        theme={activeTheme}
        pieceSet={preferences.pieceSet}
        highlightStyle={preferences.highlightStyle}
        boardSettings={preferences.boardSettings}
        onBackToPlay={() => setCurrentView('play')}
      />
    );
  }

  // RENDER: Puzzles View
  if (currentView === 'puzzles') {
    return (
      <PuzzlePlayer
        theme={activeTheme}
        pieceSet={preferences.pieceSet}
        highlightStyle={preferences.highlightStyle}
        boardSettings={preferences.boardSettings}
        onBackToPlay={() => setCurrentView('play')}
      />
    );
  }

  // RENDER: Lobby (when not in a room)
  if (!gameState) {
    return (
      <div className="min-h-screen px-4 pb-10">
        {/* Top Navbar */}
        <nav className="mx-auto flex max-w-4xl items-center justify-between py-4 border-b border-slate-800/80 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">♟</span>
            <span className="font-black text-sm tracking-wider text-white">LAN CHESS V2</span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setCurrentView('history')}
              className="rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-300 hover:border-slate-700 hover:text-white"
            >
              📜 Archives ({savedGames.length})
            </button>
            <button
              type="button"
              onClick={() => setCurrentView('puzzles')}
              className="rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-300 hover:border-slate-700 hover:text-white"
            >
              🧩 Puzzles
            </button>
            <button
              type="button"
              onClick={() => setCurrentView('practice')}
              className="rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-300 hover:border-slate-700 hover:text-white"
            >
              🔬 Sandbox
            </button>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="rounded-lg border border-slate-800 bg-slate-900/60 p-1.5 text-slate-300 hover:border-amber-400 hover:text-amber-300"
              title="Settings & Themes"
            >
              ⚙️
            </button>
          </div>
        </nav>

        <Lobby
          playerName={preferences.playerName}
          onNameChange={(name) => handleUpdatePreferences({ ...preferences, playerName: name })}
          roomCode={roomCodeInput}
          onRoomCodeChange={setRoomCodeInput}
          timeControl={timeControl}
          onTimeControlChange={setTimeControl}
          allowTakebacks={allowTakebacks}
          onAllowTakebacksChange={setAllowTakebacks}
          onCreateGame={handleCreateGame}
          onJoinGame={handleJoinGame}
          onJoinSpectator={handleJoinSpectator}
          onOpenSettings={() => setIsSettingsOpen(true)}
          hostUrl={hostUrl}
          error={error}
          isConnecting={connectionStatus === 'connecting'}
        />

        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          preferences={preferences}
          customThemes={customThemes}
          onUpdatePreferences={handleUpdatePreferences}
          onSaveCustomTheme={handleSaveCustomTheme}
          onDeleteCustomTheme={handleDeleteCustomTheme}
        />
      </div>
    );
  }

  // Active match data calculation
  const { capturedWhite, capturedBlack, whiteAdvantage, blackAdvantage } = capturedSummary;

  const opponentColor: PlayerColor = color === 'b' ? 'w' : 'b';
  const opponentName = opponentColor === 'w' ? gameState.whiteName : (gameState.blackName ?? 'Waiting for opponent...');
  const myName = color === 'w' ? gameState.whiteName : (gameState.blackName ?? preferences.playerName);

  const lastMove = gameState.moves.at(-1) ?? null;
  const currentMoveNumber = Math.floor(gameState.moves.length / 2) + 1;

  const opponentDisconnected = gameState.message.toLowerCase().includes('disconnected') || gameState.message.toLowerCase().includes('reconnection');

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
      {/* Top Header Bar */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold tracking-[.25em] text-amber-400">
              ROOM {gameState.roomCode}
            </span>
            {activeOpening && (
              <span className="text-xs font-semibold text-amber-300/90 hidden sm:inline">
                · {activeOpening.name}
              </span>
            )}
          </div>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight text-white sm:text-3xl">
            LAN CHESS
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Connection status badge */}
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
              connectionStatus === 'connected'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                : connectionStatus === 'connecting' || connectionStatus === 'reconnecting'
                ? 'bg-amber-950 text-amber-300 border border-amber-800/60 animate-pulse'
                : 'bg-rose-950 text-rose-300 border border-rose-800/60'
            }`}
          >
            {connectionStatus}
          </span>

          {/* Role badge */}
          <span
            className={`rounded-full px-3 py-0.5 text-xs font-bold ${
              role === 'spectator'
                ? 'bg-violet-950 text-violet-300 border border-violet-800'
                : color === 'w'
                ? 'bg-slate-100 text-slate-900'
                : 'bg-slate-800 text-white border border-slate-700'
            }`}
          >
            {role === 'spectator' ? 'Spectating' : `You: ${color === 'w' ? 'White' : 'Black'}`}
          </span>

          {gameState.spectatorCount > 0 && (
            <span className="rounded-full border border-slate-700 bg-slate-800/80 px-2.5 py-0.5 text-xs font-semibold text-slate-300">
              {gameState.spectatorCount} Spectators
            </span>
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
            onClick={() => setIsSettingsOpen(true)}
            className="action-button action-secondary px-2.5 py-1 text-xs"
            title="Settings & Themes"
          >
            ⚙️
          </button>

          <button
            type="button"
            onClick={handleLeaveRoom}
            className="action-button action-secondary px-2.5 py-1 text-xs text-rose-300 hover:border-rose-700 hover:text-rose-200"
          >
            Leave
          </button>
        </div>
      </header>

      {/* Copy Notification Toast */}
      {copiedNotification && (
        <div className="mb-3 rounded-lg border border-emerald-500/50 bg-emerald-950/80 px-3 py-2 text-center text-xs font-semibold text-emerald-300 shadow-md">
          {copiedNotification}
        </div>
      )}

      {/* Waiting Room notice */}
      {gameState.status === 'waiting' && (
        <section className="mb-4 rounded-xl border border-amber-500/50 bg-amber-400/10 p-4">
          <p className="font-bold text-amber-300">{gameState.message}</p>
          {opponentDisconnected ? (
            <p className="mt-1 text-sm text-slate-300">
              Waiting for opponent to reconnect (30 second grace period)...
            </p>
          ) : gameState.blackName ? (
            <p className="mt-1 text-sm text-slate-300">
              Match will resume as soon as the player reconnects.
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="text-sm text-slate-300">
                Share room code <b className="font-mono text-base tracking-widest text-white">{gameState.roomCode}</b> on your local network.
              </span>
              <button
                type="button"
                onClick={handleShareRoom}
                className="action-button action-secondary text-xs"
              >
                Copy Room Invite
              </button>
            </div>
          )}
        </section>
      )}

      {/* Takeback Negotiation Banner */}
      {gameState.takebackRequestedBy && gameState.status === 'active' && (
        <div className="mb-4 rounded-xl border border-amber-500/60 bg-amber-400/15 p-3.5 shadow-lg animate-pulse">
          {gameState.takebackRequestedBy === color ? (
            <p className="font-bold text-amber-300 text-sm">
              ⏳ You requested a takeback. Waiting for opponent to respond...
            </p>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-bold text-amber-300 text-sm">
                ⚠️ Opponent is requesting a takeback on their last move!
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleRespondTakeback(true)}
                  className="action-button action-primary text-xs font-bold"
                >
                  Accept Takeback
                </button>
                <button
                  type="button"
                  onClick={() => handleRespondTakeback(false)}
                  className="action-button action-secondary text-xs"
                >
                  Decline
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Draw offer banner */}
      {gameState.drawOfferBy !== null &&
        gameState.drawOfferBy !== color &&
        gameState.status === 'active' && (
          <div className="mb-4 rounded-xl border border-amber-500/50 bg-amber-500/10 p-3">
            <p className="font-bold text-amber-300">
              Draw offered by {gameState.drawOfferBy === 'w' ? gameState.whiteName : (gameState.blackName ?? 'Opponent')}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => handleRespondDraw(true)}
                className="action-button action-primary text-xs"
              >
                Accept Draw
              </button>
              <button
                type="button"
                onClick={() => handleRespondDraw(false)}
                className="action-button action-secondary text-xs"
              >
                Decline
              </button>
            </div>
          </div>
        )}

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-lg bg-rose-950 px-3 py-2 text-sm text-rose-200" role="alert">
          {error}
        </div>
      )}

      {/* Main Grid: Board Column + Sidebar Column */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        {/* Left Column: Board & Player Panels */}
        <section className="mx-auto w-full max-w-[46rem]">
          {/* Top Player Card */}
          <div className="mb-2">
            <PlayerCard
              name={flipped ? gameState.whiteName : opponentName}
              color={flipped ? 'w' : 'b'}
              isTurn={gameState.turn === (flipped ? 'w' : 'b') && gameState.status === 'active'}
              timeMs={flipped ? gameState.whiteTimeMs : gameState.blackTimeMs}
              capturedPieces={flipped ? capturedBlack : capturedWhite}
              advantage={flipped ? whiteAdvantage : blackAdvantage}
              isLocalPlayer={color === (flipped ? 'w' : 'b')}
              isDisconnected={Boolean(opponentDisconnected && color !== (flipped ? 'w' : 'b'))}
            />
          </div>

          {/* Status banner */}
          <div
            className="mb-2 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-2 text-xs"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-2 font-medium">
              <span
                className={`h-2 w-2 rounded-full ${
                  chess.isCheck()
                    ? 'bg-rose-500 animate-ping'
                    : gameState.status === 'active'
                    ? 'bg-emerald-400'
                    : 'bg-amber-400'
                }`}
              />
              <span className="text-slate-200">{gameState.message}</span>
            </div>
            <span className="font-mono text-slate-400">Move {currentMoveNumber}</span>
          </div>

          {/* Interactive Chessboard */}
          <Chessboard
            chess={chess}
            flipped={flipped}
            selectedSquare={selectedSquare}
            legalTargets={legalTargets}
            lastMove={lastMove}
            isInteractive={canMove || canPremove}
            premove={premove}
            theme={activeTheme}
            pieceSet={preferences.pieceSet}
            highlightStyle={preferences.highlightStyle}
            boardSettings={preferences.boardSettings}
            onSquareClick={handleSquareClick}
            onPieceDrop={handlePieceDrop}
          />

          {/* Bottom Player Card */}
          <div className="mt-2">
            <PlayerCard
              name={flipped ? (role === 'player' ? myName : (gameState.blackName ?? 'Black')) : opponentName}
              color={flipped ? 'b' : 'w'}
              isTurn={gameState.turn === (flipped ? 'b' : 'w') && gameState.status === 'active'}
              timeMs={flipped ? gameState.blackTimeMs : gameState.whiteTimeMs}
              capturedPieces={flipped ? capturedWhite : capturedBlack}
              advantage={flipped ? blackAdvantage : whiteAdvantage}
              isLocalPlayer={color === (flipped ? 'b' : 'w')}
              isDisconnected={Boolean(
                opponentDisconnected &&
                  role === 'player' &&
                  color === (flipped ? 'b' : 'w')
              )}
            />
          </div>

          {/* Action buttons (Takeback, Draw, Resign) */}
          {role === 'player' && gameState.status === 'active' && (
            <div className="mt-3 flex gap-2">
              {gameState.allowTakebacks && (
                <button
                  type="button"
                  onClick={handleRequestTakeback}
                  disabled={Boolean(gameState.takebackRequestedBy) || gameState.moves.length === 0}
                  className="action-button action-secondary flex-1 text-xs"
                >
                  Request Takeback
                </button>
              )}
              <button
                type="button"
                onClick={handleOfferDraw}
                disabled={Boolean(gameState.drawOfferBy)}
                className="action-button action-secondary flex-1 text-xs"
              >
                Offer Draw
              </button>
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

        {/* Right Column: Move History & Room Chat */}
        <aside className="space-y-4">
          <MoveHistory moves={gameState.moves} />
          <ChatPanel
            messages={gameState.chatMessages}
            onSendMessage={handleSendChat}
            currentUserName={preferences.playerName}
            currentSessionId={getStoredSessionId()}
          />
        </aside>
      </div>

      {/* Pawn Promotion Modal */}
      {pendingPromotion && color && (
        <PromotionModal
          color={color}
          onSelect={(piece) => executeMove(pendingPromotion.from, pendingPromotion.to, piece)}
          onCancel={() => setPendingPromotion(null)}
        />
      )}

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

      {/* Game Over Modal */}
      {gameState.status === 'finished' && (
        <GameOverModal
          winner={gameState.winner}
          reason={gameState.reason}
          userColor={color}
          isSpectator={role === 'spectator'}
          rematchRequestedByMe={Boolean(color && gameState.rematchRequests[color])}
          rematchRequestedByOpponent={Boolean(color && gameState.rematchRequests[opponentColor])}
          onRequestRematch={handleRequestRematch}
          onRespondRematch={handleRespondRematch}
          onLeaveRoom={handleLeaveRoom}
          onReviewGame={handleOpenCurrentGameReview}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        preferences={preferences}
        customThemes={customThemes}
        onUpdatePreferences={handleUpdatePreferences}
        onSaveCustomTheme={handleSaveCustomTheme}
        onDeleteCustomTheme={handleDeleteCustomTheme}
      />
    </div>
  );
}
