import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ConnectionStatus, GameMove, GameState, PlayerColor, PromotionPiece, ServerToClientEvents, TimeControl } from '../shared/types';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;
const PIECES: Record<Color, Record<PieceSymbol, string>> = { w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' }, b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' } };
const NAMES: Record<PieceSymbol, string> = { k: 'King', q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight', p: 'Pawn' };
const PLAYER_STORAGE_KEY = 'lan-chess-player-id';
const TIME_CONTROL_OPTIONS: Array<{ label: string; value: TimeControl }> = [
  { label: 'Unlimited', value: 'unlimited' },
  { label: '3 + 0', value: '3+0' },
  { label: '5 + 0', value: '5+0' },
  { label: '10 + 0', value: '10+0' },
];

const formatClock = (ms: number | null) => {
  if (ms === null) return 'Unlimited';
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const getOrCreatePlayerSessionId = () => {
  const existing = window.localStorage.getItem(PLAYER_STORAGE_KEY);
  if (existing) return existing;

  const created = globalThis.crypto?.randomUUID?.() ?? `player-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(PLAYER_STORAGE_KEY, created);
  return created;
};
type Promotion = { from: Square; to: Square };
const sq = (file: string, rank: string) => `${file}${rank}` as Square;

export function App() {
  const socket = useMemo<Socket<ServerToClientEvents, ClientToServerEvents>>(() => {
    const serverUrl = import.meta.env.DEV ? `${window.location.protocol}//${window.location.hostname}:3001` : undefined;
    return io(serverUrl, { transports: ['websocket', 'polling'] }) as Socket<ServerToClientEvents, ClientToServerEvents>;
  }, []);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [color, setColor] = useState<PlayerColor | null>(null);
  const [playerName, setPlayerName] = useState('Player');
  const [joinCode, setJoinCode] = useState('');
  const [hostUrl, setHostUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Square | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [timeControl, setTimeControl] = useState<TimeControl>('3+0');

  const chess = useMemo(() => new Chess(gameState?.fen), [gameState?.fen]);
  const canMove = Boolean(gameState && color && gameState.status === 'active' && gameState.turn === color);

  useEffect(() => {
    const persistSessionId = (sessionId: string) => window.localStorage.setItem(PLAYER_STORAGE_KEY, sessionId);

    const reconnectNow = () => {
      const sessionId = getOrCreatePlayerSessionId();
      socket.emit('identify-session', { sessionId });
    };

    const onConnect = () => {
      setConnectionStatus('connected');
      reconnectNow();
    };
    const onDisconnect = () => {
      setConnectionStatus('disconnected');
    };
    const onSocketReconnect = () => {
      setConnectionStatus('connected');
      reconnectNow();
    };
    const onReconnectAttempt = () => {
      setConnectionStatus('reconnecting');
    };
    const onRoomCreated = (room: { playerColor: PlayerColor; hostUrl: string | null; sessionId: string }) => {
      setColor(room.playerColor);
      setHostUrl(room.hostUrl);
      setError('');
      persistSessionId(room.sessionId);
    };
    const onRoomJoined = (room: { playerColor: PlayerColor; sessionId: string }) => {
      setColor(room.playerColor);
      setError('');
      persistSessionId(room.sessionId);
    };
    const onGameState = (state: GameState) => {
      setError('');
      setGameState(state);
    };
    const onGameError = ({ message }: { message: string }) => setError(message);
    const onConnectionStatus = (payload: { status: ConnectionStatus }) => setConnectionStatus(payload.status);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect', onSocketReconnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.on('room-created', onRoomCreated);
    socket.on('room-joined', onRoomJoined);
    socket.on('game-state', onGameState);
    socket.on('game-error', onGameError);
    socket.on('connection-status', onConnectionStatus);
    socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect', onSocketReconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.off('room-created', onRoomCreated);
      socket.off('room-joined', onRoomJoined);
      socket.off('game-state', onGameState);
      socket.off('game-error', onGameError);
      socket.off('connection-status', onConnectionStatus);
      socket.disconnect();
    };
  }, [socket]);

  useEffect(() => {
    if (!selected || !gameState || !color) return;

    const piece = chess.get(selected);
    if (!piece || piece.color !== color || !canMove) {
      setSelected(null);
      setPromotion(null);
      return;
    }

    if (gameState.status !== 'active') {
      setSelected(null);
      setPromotion(null);
    }
  }, [selected, gameState, color, chess, canMove]);
  const legalMoves = useMemo<Move[]>(() => selected && canMove ? chess.moves({ square: selected, verbose: true }) : [], [chess, selected, canMove]);
  const targets = new Map(legalMoves.map((move) => [move.to, move]));
  const files = flipped ? [...FILES].reverse() : FILES;
  const ranks = flipped ? [...RANKS].reverse() : RANKS;
  const lastMove = gameState?.moves.at(-1);

  function requestMove(from: Square, to: Square, promotionPiece?: PromotionPiece) {
    if (!canMove) return;
    socket.emit('make-move', { from, to, promotion: promotionPiece });
    setSelected(null); setPromotion(null);
  }
  function pick(square: Square) {
    if (!gameState || gameState.status !== 'active' || !canMove || promotion) return;
    const piece = chess.get(square); const target = targets.get(square);
    if (selected && target) { if (target.promotion) setPromotion({ from: selected, to: square }); else requestMove(selected, square); return; }
    setSelected(piece?.color === color ? square : null);
  }
  function dragStart(event: DragEvent<HTMLSpanElement>, square: Square) {
    const piece = chess.get(square);
    if (!gameState || gameState.status !== 'active' || !canMove || !piece || piece.color !== color) { event.preventDefault(); return; }
    event.dataTransfer.setData('text/plain', square); event.dataTransfer.effectAllowed = 'move'; setSelected(square);
  }
  function drop(event: DragEvent<HTMLButtonElement>, to: Square) {
    event.preventDefault(); const from = event.dataTransfer.getData('text/plain') as Square; const move = targets.get(to);
    if (!from || !move || move.from !== from) return;
    if (move.promotion) setPromotion({ from, to }); else requestMove(from, to);
  }
  function createGame() { socket.emit('create-game', { playerName, sessionId: getOrCreatePlayerSessionId(), timeControl }); }
  function joinGame() { socket.emit('join-game', { roomCode: joinCode, playerName, sessionId: getOrCreatePlayerSessionId() }); }
  function resignGame() {
    if (!gameState || gameState.status !== 'active') return;
    if (!window.confirm('Resign this game?')) return;
    socket.emit('resign-game');
  }
  function offerDraw() {
    if (!gameState || gameState.status !== 'active') return;
    if (gameState.drawOfferBy) {
      setError('A draw is already pending.');
      return;
    }
    if (!window.confirm('Offer a draw to the opponent?')) return;
    socket.emit('offer-draw');
  }
  function respondToDraw(accept: boolean) {
    if (!gameState || gameState.drawOfferBy === null || gameState.drawOfferBy === color) return;
    socket.emit('respond-draw', { accept });
  }
  function requestRematch() {
    if (!gameState || gameState.status !== 'finished') return;
    socket.emit('request-rematch');
  }
  function respondToRematch(accept: boolean) {
    if (!gameState || gameState.status !== 'finished') return;
    socket.emit('respond-rematch', { accept });
  }
  function leaveRoom() {
    socket.emit('leave-room');
    setGameState(null);
    setColor(null);
    setSelected(null);
    setPromotion(null);
    setError('');
  }

  if (!gameState) return <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100"><section className="mx-auto max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-7 shadow-2xl shadow-black/30"><p className="text-xs font-bold tracking-[.28em] text-amber-400">LOCAL NETWORK</p><h1 className="mt-1 text-4xl font-bold">LAN CHESS</h1><p className="mt-3 text-slate-400">Create a room or join a friend on the same Wi-Fi.</p><label className="mt-7 block text-sm font-medium">Your name<input value={playerName} onChange={(event) => setPlayerName(event.target.value)} maxLength={24} className="field" placeholder="Player name" /></label><label className="mt-5 block text-sm font-medium">Time control<select value={timeControl} onChange={(event) => setTimeControl(event.target.value as TimeControl)} className="field mt-2">{TIME_CONTROL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><button type="button" onClick={createGame} className="action-button action-primary mt-5 w-full">Create game</button><div className="my-6 border-t border-slate-700" /><label className="block text-sm font-medium">Room code<input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} maxLength={5} className="field code-field" placeholder="ABCDE" /></label><button type="button" onClick={joinGame} disabled={!joinCode.trim()} className="action-button action-secondary mt-3 w-full disabled:cursor-not-allowed disabled:opacity-40">Join game</button>{error && <p className="mt-5 rounded-lg bg-rose-950 px-3 py-2 text-sm text-rose-200">{error}</p>}</section></main>;

  const capturesByWhite = gameState.moves.filter((move) => move.color === 'w' && move.captured);
  const capturesByBlack = gameState.moves.filter((move) => move.color === 'b' && move.captured);
  const currentMoveNumber = Math.floor(gameState.moves.length / 2) + 1;
  const connectionLabel = connectionStatus === 'connected' ? '🟢 Connected' : connectionStatus === 'reconnecting' ? '🟡 Reconnecting...' : '🔴 Disconnected';
  const connectionClasses = connectionStatus === 'connected' ? 'bg-emerald-950 text-emerald-300' : connectionStatus === 'reconnecting' ? 'bg-amber-950 text-amber-300' : 'bg-rose-950 text-rose-300';
  const whiteLowTime = gameState.whiteTimeMs !== null && gameState.whiteTimeMs <= 15000;
  const blackLowTime = gameState.blackTimeMs !== null && gameState.blackTimeMs <= 15000;
  const myColor = color ?? 'w';
  const opponentColor = myColor === 'w' ? 'b' : 'w';
  const myRematchRequested = gameState.rematchRequests[myColor];
  const opponentRematchRequested = gameState.rematchRequests[opponentColor];

  return <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8 lg:py-10"><div className="mx-auto max-w-7xl">
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold tracking-[.28em] text-amber-400">ROOM {gameState.roomCode}</p><h1 className="mt-1 text-3xl font-bold sm:text-4xl">LAN CHESS</h1></div><div className="flex items-center gap-2"><span className={`rounded-full px-3 py-1 text-sm font-bold ${connectionClasses}`}>{connectionLabel}</span><span className={`rounded-full px-3 py-1 text-sm font-bold ${color === 'w' ? 'bg-slate-100 text-slate-950' : 'bg-slate-700 text-white'}`}>You are {color === 'w' ? 'White' : 'Black'}</span></div></header>
    {gameState.status === 'waiting' && <section className="mb-5 rounded-xl border border-amber-500/50 bg-amber-400/10 p-4"><p className="font-bold text-amber-300">{gameState.message}</p>{gameState.blackName ? <p className="mt-1 text-sm text-slate-300">Reconnect the opponent to continue.</p> : <p className="mt-1 text-sm text-slate-300">Share room code <b className="font-mono text-lg tracking-widest text-white">{gameState.roomCode}</b>{hostUrl && <> or open <a className="text-amber-300 underline" href={hostUrl}>{hostUrl}</a></>} on the other device.</p>}</section>}
    {gameState.drawOfferBy !== null && gameState.drawOfferBy !== color && gameState.status === 'active' && <div className="mb-4 rounded-xl border border-amber-500/50 bg-amber-500/10 p-3"><p className="font-bold text-amber-300">Draw offered</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => respondToDraw(true)} className="action-button action-primary flex-1">[ ACCEPT ]</button><button type="button" onClick={() => respondToDraw(false)} className="action-button action-secondary flex-1">[ DECLINE ]</button></div></div>}
    {gameState.status === 'active' && <div className="mb-4 flex flex-wrap gap-2"><button type="button" onClick={resignGame} className="action-button action-secondary">[ RESIGN ]</button><button type="button" onClick={offerDraw} disabled={gameState.drawOfferBy !== null} className="action-button action-secondary disabled:cursor-not-allowed disabled:opacity-40">[ OFFER DRAW ]</button></div>}
    {error && <p className="mb-4 rounded-lg bg-rose-950 px-3 py-2 text-sm text-rose-200">{error}</p>}
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start"><section className="mx-auto w-full max-w-[46rem]"><div className="mb-3 flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900 px-4 py-3"><p className="font-semibold"><span className={chess.isCheck() ? 'text-rose-400' : 'text-emerald-400'}>●</span> {gameState.message}</p><span className="text-sm text-slate-400">Move {currentMoveNumber}</span></div><div className="board-shell"><div className="chessboard" role="grid" aria-label="Chessboard">
      {ranks.map((rank, row) => files.map((file, column) => { const square = sq(file, rank); const piece = chess.get(square); const move = targets.get(square); const last = lastMove?.from === square || lastMove?.to === square; const light = (FILES.indexOf(file as typeof FILES[number]) + Number(rank)) % 2 !== 0; return <button key={square} type="button" role="gridcell" aria-label={`${square}${piece ? `, ${piece.color === 'w' ? 'white' : 'black'} ${NAMES[piece.type]}` : ''}`} onClick={() => pick(square)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(event, square)} className={`square ${light ? 'square-light' : 'square-dark'} ${selected === square ? 'selected-square' : ''} ${last ? 'last-move' : ''} ${chess.isCheck() && piece?.type === 'k' && piece.color === chess.turn() ? 'checked-king' : ''}`}>{column === 0 && <span className={`rank-label ${light ? 'dark-label' : 'light-label'}`}>{rank}</span>}{row === 7 && <span className={`file-label ${light ? 'dark-label' : 'light-label'}`}>{file}</span>}{move && <span className={move.captured || piece ? 'legal-capture' : 'legal-dot'} />}{piece && <span draggable onDragStart={(event) => dragStart(event, square)} className={`piece piece-${piece.color}`}>{PIECES[piece.color][piece.type]}</span>}</button>; }))}
    </div></div></section>
    <aside className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1"><section className="panel sm:col-span-2 lg:col-span-1"><div className="flex justify-between"><h2>Players</h2><span className="text-sm text-slate-400">{gameState.turn === 'w' ? 'White' : 'Black'} to move</span></div><div className={`mt-3 rounded-xl border px-3 py-2 ${gameState.turn === 'w' ? 'border-amber-400 bg-amber-500/10' : 'border-slate-700 bg-slate-800/60'}`}><div className="flex items-center justify-between"><p>♔ {gameState.whiteName}</p><span className={`font-mono text-sm ${whiteLowTime ? 'text-rose-300' : 'text-emerald-300'}`}>{formatClock(gameState.whiteTimeMs)}</span></div></div><div className={`mt-2 rounded-xl border px-3 py-2 ${gameState.turn === 'b' ? 'border-amber-400 bg-amber-500/10' : 'border-slate-700 bg-slate-800/60'}`}><div className="flex items-center justify-between"><p className="text-slate-300">♚ {gameState.blackName ?? 'Waiting for opponent'}</p><span className={`font-mono text-sm ${blackLowTime ? 'text-rose-300' : 'text-emerald-300'}`}>{formatClock(gameState.blackTimeMs)}</span></div></div><div className="mt-3 text-xs uppercase tracking-[.2em] text-slate-400">Time control: {gameState.timeControl === 'unlimited' ? 'Unlimited' : gameState.timeControl}</div><button type="button" onClick={() => setFlipped((value) => !value)} className="action-button action-secondary mt-4 w-full">Flip board</button></section><section className="panel"><h2>Captured by White</h2><Captured moves={capturesByWhite} /><h2 className="mt-5">Captured by Black</h2><Captured moves={capturesByBlack} /></section><section className="panel min-h-48 sm:col-span-2 lg:col-span-1"><h2>Move history</h2><ol className="move-list">{Array.from({ length: Math.ceil(gameState.moves.length / 2) }, (_, index) => <li key={index}><span>{index + 1}.</span><b>{gameState.moves[index * 2]?.san}</b><b>{gameState.moves[index * 2 + 1]?.san ?? ''}</b></li>)}{!gameState.moves.length && <li className="empty-history">Moves will appear here.</li>}</ol></section></aside></div>
  </div>{promotion && <div className="promotion-backdrop" role="dialog" aria-modal="true"><section className="promotion-dialog"><p className="text-sm font-bold tracking-[.18em] text-amber-400">PAWN PROMOTION</p><h2>Choose a piece</h2><div className="mt-5 grid grid-cols-4 gap-2">{(['q', 'r', 'b', 'n'] as PromotionPiece[]).map((piece) => <button key={piece} type="button" onClick={() => requestMove(promotion.from, promotion.to, piece)} className="promotion-choice">{PIECES[color!][piece]}</button>)}</div></section></div>}{gameState.status === 'finished' && (() => {
    const showOpponentRequest = opponentRematchRequested && !myRematchRequested;
    const showWaiting = myRematchRequested && !opponentRematchRequested;
    const showDefaultRequest = !myRematchRequested && !opponentRematchRequested;

    return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"><div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center shadow-2xl shadow-black/40"><p className="text-xs font-bold tracking-[.28em] text-amber-400">GAME OVER</p><h2 className="mt-3 text-3xl font-bold">Winner: {gameState.winner === 'draw' ? 'Draw' : gameState.winner === 'w' ? 'White' : 'Black'}</h2><p className="mt-2 text-slate-300">Reason: {gameState.reason ?? 'Game finished'}</p>{showOpponentRequest && <p className="mt-4 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">Opponent wants a rematch.</p>}{showWaiting && <p className="mt-4 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">Rematch requested. Waiting for opponent approval.</p>}{showOpponentRequest ? <div className="mt-4 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={() => respondToRematch(true)} className="action-button action-primary flex-1">[ ACCEPT REMATCH ]</button><button type="button" onClick={() => respondToRematch(false)} className="action-button action-secondary flex-1">[ DECLINE ]</button></div> : showWaiting ? <div className="mt-6 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={requestRematch} className="action-button action-primary flex-1" disabled>[ REMATCH REQUESTED ]</button><button type="button" onClick={leaveRoom} className="action-button action-secondary flex-1">[ RETURN HOME ]</button></div> : showDefaultRequest ? <div className="mt-6 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={requestRematch} className="action-button action-primary flex-1">[ REMATCH ]</button><button type="button" onClick={leaveRoom} className="action-button action-secondary flex-1">[ RETURN HOME ]</button></div> : <div className="mt-6 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={leaveRoom} className="action-button action-secondary flex-1">[ RETURN HOME ]</button></div>}</div></div>; })()}</main>;}

function Captured({ moves }: { moves: GameMove[] }) { return <div className="captured-pieces">{moves.length ? moves.map((move, index) => <span key={`${move.from}-${move.to}-${index}`} title={NAMES[move.captured!] as string}>{PIECES[move.color === 'w' ? 'b' : 'w'][move.captured!]}</span>) : <span className="text-sm text-slate-500">None</span>}</div>; }
