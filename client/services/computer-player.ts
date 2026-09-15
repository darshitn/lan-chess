import type { PromotionPiece } from '../../shared/types.js';
import type { EngineWorkerLike, WorkerFactory } from './stockfish-engine.js';

export type ComputerDifficulty = 'beginner' | 'easy' | 'medium' | 'hard' | 'expert';

export interface DifficultyConfig {
  id: ComputerDifficulty;
  name: string;
  depth: number;
  moveTimeMs: number;
  skillLevel: number; // 0 to 20
  description: string;
}

export const DIFFICULTY_CONFIGS: Record<ComputerDifficulty, DifficultyConfig> = {
  beginner: {
    id: 'beginner',
    name: 'Beginner',
    depth: 1,
    moveTimeMs: 200,
    skillLevel: 0,
    description: 'Makes frequent mistakes (Depth 1, Skill 0)',
  },
  easy: {
    id: 'easy',
    name: 'Easy',
    depth: 3,
    moveTimeMs: 400,
    skillLevel: 4,
    description: 'Casual player (Depth 3, Skill 4)',
  },
  medium: {
    id: 'medium',
    name: 'Medium',
    depth: 6,
    moveTimeMs: 700,
    skillLevel: 9,
    description: 'Intermediate club player (Depth 6, Skill 9)',
  },
  hard: {
    id: 'hard',
    name: 'Hard',
    depth: 10,
    moveTimeMs: 1200,
    skillLevel: 15,
    description: 'Advanced tactical player (Depth 10, Skill 15)',
  },
  expert: {
    id: 'expert',
    name: 'Expert',
    depth: 14,
    moveTimeMs: 2000,
    skillLevel: 20,
    description: 'Maximum engine strength (Depth 14, Skill 20)',
  },
};

export interface UciEngineCapabilities {
  engineName: string;
  hasSkillLevel: boolean;
  skillLevelMin: number;
  skillLevelMax: number;
  hasLimitStrength: boolean;
  hasElo: boolean;
  eloMin?: number;
  eloMax?: number;
}

export interface ComputerMoveResult {
  uci: string;
  from: string;
  to: string;
  promotion?: PromotionPiece;
}

const DEFAULT_WORKER_URL = '/stockfish.wasm.js';

function defaultWorkerFactory(): EngineWorkerLike {
  return new Worker(DEFAULT_WORKER_URL) as unknown as EngineWorkerLike;
}

export interface ComputerPlayerOptions {
  workerFactory?: WorkerFactory;
  initTimeoutMs?: number;
  searchSafetyTimeoutMs?: number;
}

interface PendingSearch {
  token: number;
  resolve: (res: ComputerMoveResult | null) => void;
  reject: (err: Error) => void;
  safetyTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * Dedicated offline Stockfish controller for computer gameplay.
 *
 * Runs its own isolated worker instance so gameplay searches never collide with
 * or compromise the FIFO mutex of review/practice analysis.
 *
 * Discovers UCI options on initialization (specifically discovering whether
 * UCI_LimitStrength / UCI_Elo or Skill Level are supported) rather than claiming
 * fake Elo numbers.
 */
export class ComputerPlayerService {
  private worker: EngineWorkerLike | null = null;
  private workerFactory: WorkerFactory;
  private initTimeoutMs: number;
  private searchSafetyTimeoutMs: number;
  private isInitializing = false;
  private isDisposed = false;
  private activeSearchToken = 0;
  private activeSearch: PendingSearch | null = null;
  private capabilities: UciEngineCapabilities | null = null;

  private uciokResolve: (() => void) | null = null;
  private readyokResolve: (() => void) | null = null;

  constructor(options: ComputerPlayerOptions = {}) {
    this.workerFactory = options.workerFactory ?? defaultWorkerFactory;
    this.initTimeoutMs = options.initTimeoutMs ?? 10000;
    this.searchSafetyTimeoutMs = options.searchSafetyTimeoutMs ?? 15000;
  }

  getCapabilities(): UciEngineCapabilities | null {
    return this.capabilities;
  }

  get isBusy(): boolean {
    return this.activeSearch !== null;
  }

  private handleMessage = (event: { data: unknown }) => {
    const line = typeof event.data === 'string' ? event.data.trim() : '';
    if (!line) return;

    if (this.readyokResolve && line.startsWith('readyok')) {
      const resolve = this.readyokResolve;
      this.readyokResolve = null;
      resolve();
      return;
    }

    if (this.isInitializing) {
      if (line.startsWith('id name ')) {
        if (!this.capabilities) {
          this.capabilities = {
            engineName: line.slice('id name '.length).trim(),
            hasSkillLevel: false,
            skillLevelMin: 0,
            skillLevelMax: 20,
            hasLimitStrength: false,
            hasElo: false,
          };
        } else {
          this.capabilities.engineName = line.slice('id name '.length).trim();
        }
      } else if (line.startsWith('option name ')) {
        this.parseOptionLine(line);
      } else if (line.startsWith('uciok')) {
        const resolve = this.uciokResolve;
        this.uciokResolve = null;
        resolve?.();
      }
      return;
    }

    if (line.startsWith('bestmove')) {
      this.handleBestmoveLine(line);
    }
  };

  private parseOptionLine(line: string): void {
    if (!this.capabilities) {
      this.capabilities = {
        engineName: 'Stockfish',
        hasSkillLevel: false,
        skillLevelMin: 0,
        skillLevelMax: 20,
        hasLimitStrength: false,
        hasElo: false,
      };
    }

    if (line.includes('name Skill Level')) {
      this.capabilities.hasSkillLevel = true;
      const minMatch = /min (-?\d+)/.exec(line);
      const maxMatch = /max (-?\d+)/.exec(line);
      if (minMatch) this.capabilities.skillLevelMin = Number(minMatch[1]);
      if (maxMatch) this.capabilities.skillLevelMax = Number(maxMatch[1]);
    } else if (line.includes('name UCI_LimitStrength')) {
      this.capabilities.hasLimitStrength = true;
    } else if (line.includes('name UCI_Elo')) {
      this.capabilities.hasElo = true;
      const minMatch = /min (-?\d+)/.exec(line);
      const maxMatch = /max (-?\d+)/.exec(line);
      if (minMatch) this.capabilities.eloMin = Number(minMatch[1]);
      if (maxMatch) this.capabilities.eloMax = Number(maxMatch[1]);
    }
  }

  private handleBestmoveLine(line: string): void {
    const search = this.activeSearch;
    if (!search) return; // Stale or unsolicited bestmove

    const parts = line.split(/\s+/);
    const uciMove = parts[1] ?? '';

    this.settleSearch(search, uciMove);
  }

  private settleSearch(search: PendingSearch, uciMove: string): void {
    if (this.activeSearch !== search) return;
    this.activeSearch = null;

    if (search.safetyTimer) {
      clearTimeout(search.safetyTimer);
      search.safetyTimer = null;
    }

    if (!uciMove || uciMove === '(none)' || uciMove.length < 4) {
      search.resolve(null);
      return;
    }

    const from = uciMove.slice(0, 2);
    const to = uciMove.slice(2, 4);
    const rawPromotion = uciMove.length >= 5 ? uciMove[4].toLowerCase() : undefined;
    const promotion =
      rawPromotion === 'q' || rawPromotion === 'r' || rawPromotion === 'b' || rawPromotion === 'n'
        ? (rawPromotion as PromotionPiece)
        : undefined;

    search.resolve({
      uci: uciMove,
      from,
      to,
      promotion,
    });
  }

  private workerInstanceId = 0;

  private handleError = (err: unknown) => {
    const errorMsg =
      err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
        ? String((err as any).message)
        : typeof err === 'string'
        ? err
        : 'Stockfish worker error';

    if (this.activeSearch) {
      const search = this.activeSearch;
      this.activeSearch = null;
      if (search.safetyTimer) clearTimeout(search.safetyTimer);
      search.reject(new Error(errorMsg));
    }
    this.teardownWorker();
  };

  private initPromise: Promise<EngineWorkerLike> | null = null;

  private boundMessageHandler: ((event: { data: unknown }) => void) | null = null;
  private boundErrorHandler: ((err: unknown) => void) | null = null;

  private teardownWorker(): void {
    const w = this.worker;
    const msgH = this.boundMessageHandler;
    const errH = this.boundErrorHandler;
    this.worker = null;
    this.boundMessageHandler = null;
    this.boundErrorHandler = null;
    this.isInitializing = false;
    this.initPromise = null;
    this.uciokResolve = null;
    this.readyokResolve = null;
    this.workerInstanceId++;
    if (!w) return;
    try {
      if (msgH) w.removeEventListener('message', msgH);
      if (errH) w.removeEventListener('error', errH);
    } catch {
      // ignore
    }
    try {
      w.terminate();
    } catch {
      // ignore
    }
  }

  async ensureReady(): Promise<EngineWorkerLike> {
    if (this.isDisposed) throw new Error('Computer player has been disposed');
    if (this.worker && !this.isInitializing) return this.worker;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doEnsureReady().finally(() => {
      this.initPromise = null;
    });
    return this.initPromise;
  }

  private async doEnsureReady(): Promise<EngineWorkerLike> {
    this.teardownWorker();
    const worker = this.workerFactory();
    this.worker = worker;
    this.isInitializing = true;
    const instanceId = this.workerInstanceId;

    const onMessage = (event: { data: unknown }) => {
      if (this.workerInstanceId !== instanceId || this.worker !== worker) return;
      this.handleMessage(event);
    };
    const onError = (err: unknown) => {
      if (this.workerInstanceId !== instanceId || this.worker !== worker) return;
      this.handleError(err);
    };

    this.boundMessageHandler = onMessage;
    this.boundErrorHandler = onError;
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);

    try {
      worker.postMessage('uci');
      await this.waitWithTimeout(
        new Promise<void>((resolve) => {
          this.uciokResolve = resolve;
        }),
        this.initTimeoutMs,
        'Stockfish uci initialization'
      );

      // Disable contempt to prevent score bias
      worker.postMessage('setoption name Contempt value 0');
      worker.postMessage('ucinewgame');
      worker.postMessage('isready');

      await this.waitWithTimeout(
        new Promise<void>((resolve) => {
          this.readyokResolve = resolve;
        }),
        this.initTimeoutMs,
        'Stockfish isready'
      );

      this.isInitializing = false;
      return worker;
    } catch (err) {
      this.teardownWorker();
      throw err;
    }
  }

  private waitWithTimeout(promise: Promise<void>, ms: number, what: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms}ms`)), ms);
      promise.then(
        () => {
          clearTimeout(timer);
          resolve();
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        }
      );
    });
  }

  /**
   * Requests a computer move for a specific position and difficulty.
   *
   * @param fen The current chess board FEN.
   * @param difficulty The chosen difficulty level.
   * @param searchToken Unique token identifying this move request. If cancelled or superseded, the result is dropped.
   */
  async requestMove(
    fen: string,
    difficulty: ComputerDifficulty,
    searchToken: number
  ): Promise<ComputerMoveResult | null> {
    if (this.isDisposed) return null;

    // Cancel any previous search
    this.cancelSearch();

    this.activeSearchToken = searchToken;

    let worker: EngineWorkerLike;
    try {
      worker = await this.ensureReady();
    } catch (err) {
      console.error('Failed to initialize computer engine:', err);
      return null;
    }

    if (this.isDisposed || this.activeSearchToken !== searchToken) {
      return null;
    }

    const config = DIFFICULTY_CONFIGS[difficulty];

    return new Promise<ComputerMoveResult | null>((resolve, reject) => {
      const search: PendingSearch = {
        token: searchToken,
        resolve,
        reject,
        safetyTimer: null,
      };

      search.safetyTimer = setTimeout(() => {
        // Safety timeout in case engine never replies: stop and tear down cleanly
        if (this.activeSearch === search) {
          this.activeSearch = null;
          try {
            worker.postMessage('stop');
          } catch {
            // ignore
          }
          this.teardownWorker();
          resolve(null);
        }
      }, this.searchSafetyTimeoutMs);

      this.activeSearch = search;

      // Configure strength options honestly based on discovered capabilities
      if (this.capabilities?.hasLimitStrength && this.capabilities.hasElo) {
        worker.postMessage('setoption name UCI_LimitStrength value true');
        // If elo supported, clamp to calibrated range
        const targetElo = 1000 + config.skillLevel * 75;
        worker.postMessage(`setoption name UCI_Elo value ${targetElo}`);
      } else if (this.capabilities?.hasSkillLevel) {
        worker.postMessage(`setoption name Skill Level value ${config.skillLevel}`);
      }

      worker.postMessage(`position fen ${fen}`);
      worker.postMessage(`go depth ${config.depth} movetime ${config.moveTimeMs}`);
    });
  }

  /**
   * Cancels any active engine search. Replaces the cancelled worker and terminates
   * pending promises so delayed engine responses can never arrive or resolve a newer search.
   */
  cancelSearch(): void {
    this.activeSearchToken += 1;
    const search = this.activeSearch;
    if (search) {
      this.activeSearch = null;
      if (search.safetyTimer) {
        clearTimeout(search.safetyTimer);
        search.safetyTimer = null;
      }
      try {
        this.worker?.postMessage('stop');
      } catch {
        // ignore
      }
      // Replace the cancelled worker so no delayed bestmove can ever leak into subsequent searches
      this.teardownWorker();
      search.resolve(null);
    }
  }

  dispose(): void {
    this.isDisposed = true;
    this.cancelSearch();
    this.teardownWorker();
  }
}
