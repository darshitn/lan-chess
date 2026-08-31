export type PlayerColor = 'w' | 'b';
export type PromotionPiece = 'q' | 'r' | 'b' | 'n';
export type CapturedPiece = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';
export type TimeControl = 'unlimited' | '3+0' | '5+0' | '10+0';

export interface ServerStatus { online: boolean; lanIp: string | null; port: number; }
export interface GameMove { from: string; to: string; san: string; color: PlayerColor; captured?: CapturedPiece; promotion?: PromotionPiece; }
export type GameResult = PlayerColor | 'draw';

export interface ChatMessage {
  id: string;
  sender: string;
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
  rematchRequests: Record<PlayerColor, boolean>;
  chatMessages: ChatMessage[];
  spectatorCount: number;
}
export interface RoomCreated { roomCode: string; playerColor: PlayerColor; sessionId: string; hostUrl: string | null; }
export interface RoomJoined { roomCode: string; playerColor: PlayerColor | null; sessionId: string; role: 'player' | 'spectator'; }
export interface ConnectionStatusPayload { status: ConnectionStatus; message?: string; }
export interface ClientToServerEvents {
  'create-game': (payload: { playerName: string; sessionId?: string | null; timeControl?: TimeControl }) => void;
  'join-game': (payload: { roomCode: string; playerName: string; sessionId?: string | null }) => void;
  'join-spectator': (payload: { roomCode: string; playerName?: string; sessionId?: string | null }) => void;
  'identify-session': (payload: { sessionId: string | null }) => void;
  'make-move': (payload: { from: string; to: string; promotion?: PromotionPiece }) => void;
  'resign-game': () => void;
  'offer-draw': () => void;
  'respond-draw': (payload: { accept: boolean }) => void;
  'request-rematch': () => void;
  'respond-rematch': (payload: { accept: boolean }) => void;
  'send-chat': (payload: { message: string }) => void;
  'leave-room': () => void;
}
export interface ServerToClientEvents {
  'room-created': (payload: RoomCreated) => void;
  'room-joined': (payload: RoomJoined) => void;
  'game-state': (state: GameState) => void;
  'game-error': (payload: { message: string }) => void;
  'connection-status': (payload: ConnectionStatusPayload) => void;
}
