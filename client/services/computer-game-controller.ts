import { Chess, type Square } from 'chess.js';
import type {
  CapturedPiece,
  GameMove,
  GameResult,
  PlayerColor,
  PromotionPiece,
  TimeControl,
} from '../../shared/types.js';
import { identifyOpening } from '../utils/openings.js';
import { saveCompletedGame, type SavedGame } from './game-history.js';
import {
  type ComputerDifficulty,
  type ComputerMoveResult,
  type ComputerPlayerService,
  DIFFICULTY_CONFIGS,
} from './computer-player.js';

export type ComputerGameStatus = 'idle' | 'active' | 'finished';
export type PlayerColorChoice = 'w' | 'b' | 'random';

export interface ComputerGameConfig {
  playerName: string;
  colorChoice: PlayerColorChoice;
  difficulty: ComputerDifficulty;
  timeControl: TimeControl;
}

export interface ComputerGameState {
  fen: string;
  turn: PlayerColor;
  status: ComputerGameStatus;
  humanColor: PlayerColor;
  computerColor: PlayerColor;
  difficulty: ComputerDifficulty;
  timeControl: TimeControl;
  whiteTimeMs: number | null;
  blackTimeMs: number | null;
  moves: GameMove[];
  winner: GameResult | null;
  reason: string | null;
  isEngineThinking: boolean;
  engineError: string | null;
}

export type GameSoundEvent = 'move' | 'capture' | 'check' | 'gameover';

/** A modest human-readable pace; elapsed waiting is charged to the engine's clock. */
export function getMinimumComputerTurnMs(difficulty: ComputerDifficulty, tc: TimeControl): number {
  const base: Record<ComputerDifficulty, number> = {
    beginner: 700,
    easy: 1100,
    medium: 1900,
    hard: 2300,
    expert: 2700,
  };
  const { incrementMs } = parseTimeControlParams(tc);
  return Math.max(base[difficulty], Math.min(incrementMs, 2000) + 400);
}

export function parseTimeControlParams(tc: TimeControl): {
  initialMs: number | null;
  incrementMs: number;
} {
  if (tc === 'unlimited') return { initialMs: null, incrementMs: 0 };
  const parts = tc.split('+');
  const minutes = Number(parts[0]) || 0;
  const incrementSec = Number(parts[1]) || 0;
  return {
    initialMs: minutes * 60 * 1000,
    incrementMs: incrementSec * 1000,
  };
}

export function formatPgnTimeControl(tc: TimeControl): string {
  if (tc === 'unlimited') return '-';
  const parts = tc.split('+');
  const minutes = Number(parts[0]) || 0;
  const baseSec = minutes * 60;
  if (parts[1] !== undefined) {
    const incSec = Number(parts[1]) || 0;
    return `${baseSec}+${incSec}`;
  }
  return `${baseSec}`;
}

export function buildComputerPgn(
  chess: Chess,
  whiteName: string,
  blackName: string,
  winner: GameResult | null,
  reason: string | null,
  timeControl: TimeControl,
  date?: Date
): string {
  const d = date ?? new Date();
  const dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
    d.getDate()
  ).padStart(2, '0')}`;
  const result =
    winner === 'w' ? '1-0' : winner === 'b' ? '0-1' : winner === 'draw' ? '1/2-1/2' : '*';

  chess.setHeader('Event', 'Offline Play vs Computer');
  chess.setHeader('Site', 'LAN Chess Offline');
  chess.setHeader('Date', dateStr);
  chess.setHeader('White', whiteName);
  chess.setHeader('Black', blackName);
  chess.setHeader('Result', result);
  chess.setHeader('TimeControl', formatPgnTimeControl(timeControl));
  if (reason) chess.setHeader('Termination', reason);
  return chess.pgn();
}

/**
 * Controller for offline Play vs Computer games.
 *
 * Provides typed, deterministic management of chess rules, Fischer clocks,
 * engine turn orchestration, timeout racing guards, and completed game persistence.
 */
export class ComputerGameController {
  private chess: Chess;
  private state: ComputerGameState;
  private playerService: ComputerPlayerService;
  private config: ComputerGameConfig;

  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private lastClockTick = 0;
  private incrementMs = 0;
  private searchToken = 0;
  private completedGame: SavedGame | null = null;
  private minimumTurnMs: (difficulty: ComputerDifficulty, tc: TimeControl) => number;

  private stateListeners = new Set<(state: ComputerGameState) => void>();
  private soundListeners = new Set<(event: GameSoundEvent) => void>();
  private finishListeners = new Set<(game: SavedGame) => void>();

  constructor(
    playerService: ComputerPlayerService,
    initialConfig: ComputerGameConfig,
    options: { minimumTurnMs?: (difficulty: ComputerDifficulty, tc: TimeControl) => number } = {}
  ) {
    this.playerService = playerService;
    this.minimumTurnMs = options.minimumTurnMs ?? (() => 0);
    this.config = { ...initialConfig };
    this.chess = new Chess();

    const humanColor = this.resolveHumanColor(initialConfig.colorChoice);
    const computerColor: PlayerColor = humanColor === 'w' ? 'b' : 'w';
    const { initialMs, incrementMs } = parseTimeControlParams(initialConfig.timeControl);
    this.incrementMs = incrementMs;

    this.state = {
      fen: this.chess.fen(),
      turn: 'w',
      status: 'idle',
      humanColor,
      computerColor,
      difficulty: initialConfig.difficulty,
      timeControl: initialConfig.timeControl,
      whiteTimeMs: initialMs,
      blackTimeMs: initialMs,
      moves: [],
      winner: null,
      reason: null,
      isEngineThinking: false,
      engineError: null,
    };
  }

  private resolveHumanColor(choice: PlayerColorChoice): PlayerColor {
    if (choice === 'w') return 'w';
    if (choice === 'b') return 'b';
    return Math.random() < 0.5 ? 'w' : 'b';
  }

  getState(): ComputerGameState {
    return { ...this.state, moves: [...this.state.moves] };
  }

  getChess(): Chess {
    return this.chess;
  }

  getCompletedGame(): SavedGame | null {
    return this.completedGame;
  }

  subscribeState(listener: (state: ComputerGameState) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.getState());
    return () => this.stateListeners.delete(listener);
  }

  subscribeSound(listener: (event: GameSoundEvent) => void): () => void {
    this.soundListeners.add(listener);
    return () => this.soundListeners.delete(listener);
  }

  subscribeFinish(listener: (game: SavedGame) => void): () => void {
    this.finishListeners.add(listener);
    return () => this.finishListeners.delete(listener);
  }

  private notifyState(): void {
    const s = this.getState();
    for (const l of this.stateListeners) l(s);
  }

  private emitSound(event: GameSoundEvent): void {
    for (const l of this.soundListeners) l(event);
  }

  async startNewGame(newConfig?: Partial<ComputerGameConfig>): Promise<void> {
    this.stopClock();
    this.searchToken += 1;
    this.playerService.cancelSearch();
    this.completedGame = null;

    if (newConfig) {
      this.config = { ...this.config, ...newConfig };
    }

    this.chess = new Chess();
    const humanColor = this.resolveHumanColor(this.config.colorChoice);
    const computerColor: PlayerColor = humanColor === 'w' ? 'b' : 'w';
    const { initialMs, incrementMs } = parseTimeControlParams(this.config.timeControl);
    this.incrementMs = incrementMs;

    this.state = {
      fen: this.chess.fen(),
      turn: 'w',
      status: 'active',
      humanColor,
      computerColor,
      difficulty: this.config.difficulty,
      timeControl: this.config.timeControl,
      whiteTimeMs: initialMs,
      blackTimeMs: initialMs,
      moves: [],
      winner: null,
      reason: null,
      isEngineThinking: false,
      engineError: null,
    };

    this.startClock();
    this.notifyState();

    // If computer plays White, trigger initial search
    if (computerColor === 'w') {
      await this.triggerComputerMove();
    }
  }

  private settleClock(now = Date.now()): { timedOut: boolean } {
    if (this.state.status !== 'active') return { timedOut: false };
    if (this.state.whiteTimeMs === null || this.state.blackTimeMs === null) {
      return { timedOut: false };
    }

    const elapsed = Math.max(0, now - this.lastClockTick);
    this.lastClockTick = now;

    if (elapsed === 0) return { timedOut: false };

    if (this.state.turn === 'w') {
      this.state.whiteTimeMs = Math.max(0, this.state.whiteTimeMs - elapsed);
      if (this.state.whiteTimeMs === 0) {
        this.finishGame('b', 'White ran out of time');
        return { timedOut: true };
      }
    } else if (this.state.turn === 'b') {
      this.state.blackTimeMs = Math.max(0, this.state.blackTimeMs - elapsed);
      if (this.state.blackTimeMs === 0) {
        this.finishGame('w', 'Black ran out of time');
        return { timedOut: true };
      }
    }

    return { timedOut: false };
  }

  async makeHumanMove(
    from: Square,
    to: Square,
    promotion?: PromotionPiece
  ): Promise<{ success: boolean; error?: string }> {
    if (this.state.status !== 'active') {
      return { success: false, error: 'Game is not active' };
    }
    if (this.state.turn !== this.state.humanColor) {
      return { success: false, error: 'Not your turn' };
    }

    // Settle elapsed time for current player up to now BEFORE accepting move
    const { timedOut } = this.settleClock(Date.now());
    if (timedOut || this.state.status !== 'active') {
      return { success: false, error: 'Time expired' };
    }

    try {
      const move = this.chess.move({ from, to, promotion: promotion ?? 'q' });
      if (!move) {
        return { success: false, error: 'Illegal move' };
      }

      // Add Fischer increment only AFTER confirming move was made before deadline
      if (this.incrementMs > 0) {
        if (this.state.humanColor === 'w' && this.state.whiteTimeMs !== null) {
          this.state.whiteTimeMs += this.incrementMs;
        } else if (this.state.humanColor === 'b' && this.state.blackTimeMs !== null) {
          this.state.blackTimeMs += this.incrementMs;
        }
      }

      const gameMove: GameMove = {
        from: move.from,
        to: move.to,
        san: move.san,
        color: this.state.humanColor,
        captured: move.captured as CapturedPiece | undefined,
        promotion: move.promotion as PromotionPiece | undefined,
      };

      this.state.moves.push(gameMove);
      this.state.fen = this.chess.fen();
      this.state.turn = this.state.computerColor;
      this.lastClockTick = Date.now();

      // Check game termination
      if (this.checkGameEnding(this.state.humanColor)) {
        return { success: true };
      }

      // Play appropriate sound
      if (this.chess.isCheck()) {
        this.emitSound('check');
      } else if (move.captured) {
        this.emitSound('capture');
      } else {
        this.emitSound('move');
      }

      this.notifyState();

      // Trigger computer move asynchronously
      void this.triggerComputerMove();
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  async retryComputerMove(): Promise<void> {
    if (
      this.state.status !== 'active' ||
      this.state.turn !== this.state.computerColor ||
      this.state.isEngineThinking
    ) {
      return;
    }
    this.state.engineError = null;
    await this.triggerComputerMove();
  }

  private async triggerComputerMove(): Promise<void> {
    if (this.state.status !== 'active') return;

    const currentToken = ++this.searchToken;
    const turnStartedAt = Date.now();
    this.state.isEngineThinking = true;
    this.state.engineError = null;
    this.notifyState();

    const fenBeforeSearch = this.chess.fen();
    let result: ComputerMoveResult | null = null;
    try {
      result = await this.playerService.requestMove(
        fenBeforeSearch,
        this.state.difficulty,
        currentToken
      );
    } catch (err) {
      if (this.state.status !== 'active' || this.searchToken !== currentToken) {
        return;
      }
      this.state.isEngineThinking = false;
      this.state.engineError = (err as Error).message || 'Stockfish engine error occurred';
      this.notifyState();
      return;
    }

    // Stale or cancelled search check:
    // If the game ended (e.g. timeout race, resign) or a new search was requested,
    // this engine result is strictly discarded.
    if (
      this.state.status !== 'active' ||
      this.searchToken !== currentToken ||
      this.chess.fen() !== fenBeforeSearch
    ) {
      return;
    }

    if (result) {
      const minimumMs = Math.max(0, this.minimumTurnMs(this.state.difficulty, this.state.timeControl));
      const elapsedMs = Date.now() - turnStartedAt;
      const computerTimeMs = this.state.computerColor === 'w'
        ? this.state.whiteTimeMs
        : this.state.blackTimeMs;
      // Do not deliberately flag a low-clock engine. The final clock settlement
      // below still charges all actual elapsed time, including this delay.
      const remainingBudgetMs = computerTimeMs === null
        ? Infinity
        : Math.max(0, computerTimeMs - (Date.now() - this.lastClockTick) - 400);
      const waitMs = Math.min(Math.max(0, minimumMs - elapsedMs), remainingBudgetMs);
      if (waitMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
      }
      if (
        this.state.status !== 'active' ||
        this.searchToken !== currentToken ||
        this.chess.fen() !== fenBeforeSearch
      ) return;
    }

    // Settle elapsed time for computer up to now BEFORE accepting move or applying increment
    const { timedOut } = this.settleClock(Date.now());
    if (timedOut || this.state.status !== 'active') {
      return;
    }

    this.state.isEngineThinking = false;

    if (!result) {
      // If the engine failed to reply, retry once or surface engine error
      this.state.engineError = 'Computer engine failed to produce a move. You can retry or restart.';
      this.notifyState();
      return;
    }

    try {
      const move = this.chess.move({
        from: result.from,
        to: result.to,
        promotion: result.promotion ?? 'q',
      });

      if (!move) {
        // Fallback: engine suggested an illegal move (extremely rare / corrupted fen)
        this.state.engineError = 'Engine generated an invalid move.';
        this.notifyState();
        return;
      }

      // Add Fischer increment if clocks active
      if (this.incrementMs > 0) {
        if (this.state.computerColor === 'w' && this.state.whiteTimeMs !== null) {
          this.state.whiteTimeMs += this.incrementMs;
        } else if (this.state.computerColor === 'b' && this.state.blackTimeMs !== null) {
          this.state.blackTimeMs += this.incrementMs;
        }
      }

      const gameMove: GameMove = {
        from: move.from,
        to: move.to,
        san: move.san,
        color: this.state.computerColor,
        captured: move.captured as CapturedPiece | undefined,
        promotion: move.promotion as PromotionPiece | undefined,
      };

      this.state.moves.push(gameMove);
      this.state.fen = this.chess.fen();
      this.state.turn = this.state.humanColor;
      this.lastClockTick = Date.now();

      if (this.checkGameEnding(this.state.computerColor)) {
        return;
      }

      if (this.chess.isCheck()) {
        this.emitSound('check');
      } else if (move.captured) {
        this.emitSound('capture');
      } else {
        this.emitSound('move');
      }

      this.notifyState();
    } catch (err) {
      this.state.engineError = `Error applying engine move: ${(err as Error).message}`;
      this.notifyState();
    }
  }

  private checkGameEnding(lastMover: PlayerColor): boolean {
    if (this.chess.isCheckmate()) {
      this.finishGame(lastMover, 'Checkmate');
      return true;
    }
    if (this.chess.isStalemate()) {
      this.finishGame('draw', 'Draw by stalemate');
      return true;
    }
    if (this.chess.isThreefoldRepetition()) {
      this.finishGame('draw', 'Draw by threefold repetition');
      return true;
    }
    if (this.chess.isInsufficientMaterial()) {
      this.finishGame('draw', 'Draw by insufficient material');
      return true;
    }
    if (this.chess.isDraw()) {
      this.finishGame('draw', 'Draw by 50-move rule');
      return true;
    }
    return false;
  }

  resign(): void {
    if (this.state.status !== 'active') return;
    const winner: GameResult = this.state.computerColor;
    const reason = `${this.state.humanColor === 'w' ? 'White' : 'Black'} resigned`;
    this.finishGame(winner, reason);
  }

  private finishGame(winner: GameResult, reason: string): void {
    this.stopClock();
    this.searchToken += 1; // Invalidate any running engine search token
    this.playerService.cancelSearch();

    this.state.status = 'finished';
    this.state.winner = winner;
    this.state.reason = reason;
    this.state.isEngineThinking = false;

    // Save game to history
    const diffConfig = DIFFICULTY_CONFIGS[this.state.difficulty];
    const engineLabel = `Stockfish (${diffConfig.name})`;
    const whiteName = this.state.humanColor === 'w' ? this.config.playerName : engineLabel;
    const blackName = this.state.humanColor === 'b' ? this.config.playerName : engineLabel;

    const pgn = buildComputerPgn(
      this.chess,
      whiteName,
      blackName,
      winner,
      reason,
      this.state.timeControl
    );

    const savedGame: SavedGame = {
      id: `offline-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      roomCode: 'VS-AI',
      date: Date.now(),
      whiteName,
      blackName,
      winner,
      reason,
      timeControl: this.state.timeControl,
      pgn,
      moves: [...this.state.moves],
      fen: this.chess.fen(),
      opening: identifyOpening(this.state.moves.map((m) => m.san)),
    };

    this.completedGame = savedGame;
    saveCompletedGame(savedGame);

    this.emitSound('gameover');
    this.notifyState();

    for (const l of this.finishListeners) l(savedGame);
  }

  private startClock(): void {
    if (this.state.whiteTimeMs === null || this.state.blackTimeMs === null) return;
    this.lastClockTick = Date.now();
    this.clockTimer = setInterval(() => this.tickClock(), 100);
  }

  private stopClock(): void {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
  }

  private tickClock(): void {
    if (this.state.status !== 'active') {
      this.stopClock();
      return;
    }

    const { timedOut } = this.settleClock(Date.now());
    if (!timedOut) {
      this.notifyState();
    }
  }

  dispose(): void {
    this.stopClock();
    this.searchToken += 1;
    this.playerService.cancelSearch();
    this.stateListeners.clear();
    this.soundListeners.clear();
    this.finishListeners.clear();
  }
}
