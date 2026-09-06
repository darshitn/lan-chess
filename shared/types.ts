export type PlayerColor = 'w' | 'b';
export type PromotionPiece = 'q' | 'r' | 'b' | 'n';
export type CapturedPiece = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type ConnectionStatus = 'connected' | 'connecting' | 'reconnecting' | 'disconnected';
export type TimeControl = 'unlimited' | '3+0' | '5+0' | '10+0' | '15+10';

export interface ServerStatus { online: boolean; lanIp: string | null; port: number; }
export interface ClockUpdate { roomCode: string; whiteTimeMs: number | null; blackTimeMs: number | null; }
export interface GameMove { from: string; to: string; san: string; color: PlayerColor; captured?: CapturedPiece; promotion?: PromotionPiece; }
export type GameResult = PlayerColor | 'draw';

export interface ChatMessage {
  id: string;
  sender: string;
  senderSessionId: string;
  message: string;
  color: PlayerColor | 'system';
  sentAt: number;
}

export interface GameState {
  roomCode: string;
  fen: string;
  moves: GameMove[];
  whiteName: string;
  blackName: string | null;
  turn: PlayerColor;
  status: 'waiting' | 'active' | 'finished';
  message: string;
  timeControl: TimeControl;
  whiteTimeMs: number | null;
  blackTimeMs: number | null;
  winner: GameResult | null;
  reason: string | null;
  drawOfferBy: PlayerColor | null;
  takebackRequestedBy: PlayerColor | null;
  allowTakebacks: boolean;
  rematchRequests: Record<PlayerColor, boolean>;
  chatMessages: ChatMessage[];
  spectatorCount: number;
}
export interface RoomCreated { roomCode: string; playerColor: PlayerColor; sessionId: string; hostUrl: string | null; }
export interface RoomJoined { roomCode: string; playerColor: PlayerColor | null; sessionId: string; role: 'player' | 'spectator'; }
export interface ConnectionStatusPayload { status: ConnectionStatus; message?: string; }

export interface ClientToServerEvents {
  'create-game': (payload: { playerName: string; sessionId?: string | null; timeControl?: TimeControl; allowTakebacks?: boolean }) => void;
  'join-game': (payload: { roomCode: string; playerName: string; sessionId?: string | null }) => void;
  'join-spectator': (payload: { roomCode: string; playerName?: string; sessionId?: string | null }) => void;
  'identify-session': (payload: { sessionId: string | null }) => void;
  'make-move': (payload: { from: string; to: string; promotion?: PromotionPiece }) => void;
  'resign-game': () => void;
  'offer-draw': () => void;
  'respond-draw': (payload: { accept: boolean }) => void;
  'request-takeback': () => void;
  'respond-takeback': (payload: { accept: boolean }) => void;
  'request-rematch': () => void;
  'respond-rematch': (payload: { accept: boolean }) => void;
  'send-chat': (payload: { message: string }) => void;
  'leave-room': () => void;
}

export interface ServerToClientEvents {
  'room-created': (payload: RoomCreated) => void;
  'room-joined': (payload: RoomJoined) => void;
  'game-state': (state: GameState) => void;
  'clock-update': (payload: ClockUpdate) => void;
  'game-error': (payload: { message: string }) => void;
  'connection-status': (payload: ConnectionStatusPayload) => void;
}

export const SOCKET_EVENTS = {
  CREATE_GAME: 'create-game',
  JOIN_GAME: 'join-game',
  JOIN_SPECTATOR: 'join-spectator',
  IDENTIFY_SESSION: 'identify-session',
  MAKE_MOVE: 'make-move',
  RESIGN_GAME: 'resign-game',
  OFFER_DRAW: 'offer-draw',
  RESPOND_DRAW: 'respond-draw',
  REQUEST_TAKEBACK: 'request-takeback',
  RESPOND_TAKEBACK: 'respond-takeback',
  REQUEST_REMATCH: 'request-rematch',
  RESPOND_REMATCH: 'respond-rematch',
  SEND_CHAT: 'send-chat',
  LEAVE_ROOM: 'leave-room',
  ROOM_CREATED: 'room-created',
  ROOM_JOINED: 'room-joined',
  GAME_STATE: 'game-state',
  CLOCK_UPDATE: 'clock-update',
  GAME_ERROR: 'game-error',
  CONNECTION_STATUS: 'connection-status',
} as const;
