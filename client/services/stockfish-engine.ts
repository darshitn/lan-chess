import { Chess } from 'chess.js';
import { isKnownBookSequence } from '../utils/openings.js';

export type MoveClassification =
  | 'brilliant'
  | 'excellent'
  | 'good'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'unavailable';

export type EngineScore =
  | { type: 'cp'; value: number } // value in centipawns, White-positive (+150 = White +1.50)
  | { type: 'mate'; value: number }; // moves to mate, White-positive (+1 = White mates in 1, -2 = Black mates in 2)

export interface EngineDiagnostics {
  engineVersion: string;
  depth: number;
  nodes?: number;
  nps?: number;
  timeMs?: number;
  rawUci: string;
  error?: string;
}

export interface PositionAnalysis {
  ply: number;
  fen: string; // FEN before the move was played
  fenAfter: string; // FEN after the move was played
  san: string; // The move actually played
  playedBy: 'w' | 'b';
  evaluation: EngineScore | null; // Evaluation AFTER the move, White-positive; null when the engine failed
  bestMoveSan: string | null; // Engine's best move in SAN; null when the engine failed
  bestMoveUci: string | null;
  cpLoss: number | null; // Centipawn loss from mover's perspective (0 = best move); null when unavailable
  classification: MoveClassification;
  diagnostics?: EngineDiagnostics;
}

export interface GameAnalysisReport {
  positions: PositionAnalysis[];
  whiteAccuracy: number; // 0 to 100%
  blackAccuracy: number; // 0 to 100%
  classificationCounts: {
    w: Record<MoveClassification, number>;
    b: Record<MoveClassification, number>;
  };
}

export interface EngineEval {
  score: EngineScore; // White-positive
  bestMoveSan: string;
  bestMoveUci: string;
  pv: string[];
  depth: number;
  diagnostics: EngineDiagnostics;
}

/**
 * Minimal worker surface used by the engine service. Tests inject a fake
 * implementation; the browser default wraps a real Worker.
 */
export interface EngineWorkerLike {
  postMessage(data: string): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  removeEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  addEventListener(type: 'error', listener: (event: unknown) => void): void;
  removeEventListener(type: 'error', listener: (event: unknown) => void): void;
  terminate(): void;
}

export type WorkerFactory = () => EngineWorkerLike;

const DEFAULT_WORKER_URL = '/stockfish.wasm.js';

function defaultWorkerFactory(): EngineWorkerLike {
  return new Worker(DEFAULT_WORKER_URL) as unknown as EngineWorkerLike;
}

/**
 * Formats an EngineScore into human-readable notation:
 * cp: "+1.5", "-0.8", "0.0"
 * mate: "M#1", "M#3", "-M#2"
 */
export function formatEngineScore(score: EngineScore): string {
  if (score.type === 'mate') {
    return score.value > 0 ? `M#${score.value}` : `-M#${Math.abs(score.value)}`;
  }
  const pawns = score.value / 100;
  if (pawns > 0) return `+${pawns.toFixed(1)}`;
  if (pawns < 0) return pawns.toFixed(1);
  return '0.0';
}

/**
 * Converts an EngineScore to a numeric value in centipawns for graph plotting and diff calculations.
 * Clamps forced mates smoothly to +/- 1000 centipawns (+/- 10 pawns).
 */
export function scoreToNumeric(score: EngineScore, mateCeiling = 1000): number {
  if (score.type === 'cp') {
    return score.value;
  }
  // For mate, closer mates receive slightly higher values
  if (score.value > 0) {
    return Math.max(mateCeiling - score.value * 10, 800);
  } else {
    return Math.min(-mateCeiling + Math.abs(score.value) * 10, -800);
  }
}

/**
 * Converts a UCI move string (e.g. "e2e4", "g1f3", "e1g1", "e7e8q")
 * to standard algebraic notation (SAN, e.g. "e4", "Nf3", "O-O", "e8=Q")
 * using the position's legal moves.
 */
export function convertUciToSan(fen: string, uciMove: string): string {
  if (!uciMove || uciMove === '(none)') return uciMove;

  try {
    const chess = new Chess(fen);
    const from = uciMove.slice(0, 2);
    const to = uciMove.slice(2, 4);
    const promotion = uciMove.length >= 5 ? uciMove[4] : undefined;

    const legalMoves = chess.moves({ verbose: true });
    const match = legalMoves.find(
      (m) =>
        m.from === from &&
        m.to === to &&
        (!promotion || m.promotion === promotion)
    );

    return match?.san ?? uciMove;
  } catch {
    return uciMove;
  }
}

/**
 * Normalizes a raw score from Stockfish UCI output (which is from the perspective
 * of the side to move) into a universal White-positive score.
 */
export function normalizeScore(
  rawType: 'cp' | 'mate',
  rawValue: number,
  sideToMove: 'w' | 'b'
): EngineScore {
  const isWhite = sideToMove === 'w';
  const normalizedValue = isWhite ? rawValue : -rawValue;
  return {
    type: rawType,
    value: normalizedValue,
  };
}

function sideToMoveOf(fen: string): 'w' | 'b' {
  return (fen.split(' ')[1] || 'w') as 'w' | 'b';
}

interface ActiveSearch {
  fen: string;
  requestedDepth: number;
  restrictedMove: string | null;
  resolve: (result: EngineEval | null) => void;
  settled: boolean;
  sawInfo: boolean;
  lastInfoLine: string;
  rawType: 'cp' | 'mate';
  rawValue: number;
  depthReached: number;
  nodes: number;
  nps: number;
  timeMs: number;
  pv: string[];
  safetyTimer: ReturnType<typeof setTimeout> | null;
}

type EngineState = 'idle' | 'initializing' | 'ready' | 'disposed';

// After a search settles, output generated by it may still be in flight in the
// event queue. A new search must not register until that window has passed, or
// it could consume stale info/bestmove lines from the previous search.
const SEARCH_QUIESCENCE_MS = 25;

export interface StockfishEngineOptions {
  workerFactory?: WorkerFactory;
  initTimeoutMs?: number;
  searchSafetyTimeoutMs?: number;
}

/**
 * UCI engine client with a strict search lifecycle:
 *
 *   ensureReady (uci/uciok, options, ucinewgame/isready) -> search (position/go -> bestmove)
 *
 * A single permanent message listener routes every engine line to exactly one
 * consumer: the init handshake, the single active search, or nowhere. All engine
 * operations run through a FIFO mutex, so two searches can never overlap and a
 * search can only ever receive output from its own `go` command. The worker is
 * terminated on cancellation/safety-timeout, which guarantees no stale output
 * can leak into a later search.
 */
export class StockfishEngineService {
  private worker: EngineWorkerLike | null = null;
  private state: EngineState = 'idle';
  private engineVersion = 'Stockfish (WASM)';
  private activeSearch: ActiveSearch | null = null;
  private sessionCounter = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private uciokResolve: (() => void) | null = null;
  private readyokResolve: (() => void) | null = null;
  private quiescentAt = 0;
  private readonly workerFactory: WorkerFactory;
  private readonly initTimeoutMs: number;
  private readonly searchSafetyTimeoutMs: number;

  constructor(options: StockfishEngineOptions = {}) {
    this.workerFactory = options.workerFactory ?? defaultWorkerFactory;
    this.initTimeoutMs = options.initTimeoutMs ?? 10000;
    this.searchSafetyTimeoutMs = options.searchSafetyTimeoutMs ?? 120000;
  }

  getEngineVersion(): string {
    return this.engineVersion;
  }

  get isBusy(): boolean {
    return this.activeSearch !== null;
  }

  // Method (not a property compare) so control-flow narrowing cannot hide that
  // state may change across an `await` via cancelAnalysis()/dispose().
  private isDisposed(): boolean {
    return this.state === 'disposed';
  }

  private handleMessage = (event: { data: unknown }) => {
    const line = typeof event.data === 'string' ? event.data : '';
    if (!line) return;

    // readyok is awaited both during init and after the per-session ucinewgame;
    // no search is active while a readyok waiter exists, so routing first is safe.
    if (this.readyokResolve && line.startsWith('readyok')) {
      const resolve = this.readyokResolve;
      this.readyokResolve = null;
      resolve();
      return;
    }

    if (this.state === 'initializing') {
      if (line.includes('id name ')) {
        const match = /id name ([^\r\n]*)/.exec(line);
        if (match) this.engineVersion = match[1].trim();
      } else if (line.startsWith('uciok')) {
        this.uciokResolve?.();
        this.uciokResolve = null;
      }
      return;
    }

    // Stray lines (e.g. leftovers from a terminated search) have no owner: drop them.
    if (this.activeSearch) {
      this.handleSearchLine(line);
    }
  };

  private handleError = () => {
    this.failActiveSearch('engine worker error');
    this.teardownWorker();
  };

  private handleSearchLine(line: string): void {
    const search = this.activeSearch;
    if (!search || search.settled) return;

    if (line.startsWith('info')) {
      search.sawInfo = true;
      search.lastInfoLine = line;

      const depthMatch = /depth (\d+)/.exec(line);
      if (depthMatch) search.depthReached = Number(depthMatch[1]);

      const nodesMatch = /nodes (\d+)/.exec(line);
      if (nodesMatch) search.nodes = Number(nodesMatch[1]);

      const npsMatch = /nps (\d+)/.exec(line);
      if (npsMatch) search.nps = Number(npsMatch[1]);

      const timeMatch = /time (\d+)/.exec(line);
      if (timeMatch) search.timeMs = Number(timeMatch[1]);

      if (line.includes('score cp')) {
        const match = /score cp (-?\d+)/.exec(line);
        if (match) {
          search.rawType = 'cp';
          search.rawValue = Number(match[1]);
        }
      } else if (line.includes('score mate')) {
        const match = /score mate (-?\d+)/.exec(line);
        if (match) {
          search.rawType = 'mate';
          search.rawValue = Number(match[1]);
        }
      }

      const pvIdx = line.indexOf(' pv ');
      if (pvIdx !== -1) {
        search.pv = line.slice(pvIdx + 4).trim().split(/\s+/);
      }
      return;
    }

    if (line.startsWith('bestmove')) {
      // A bestmove without any preceding info line of this search cannot be
      // trusted as this search's answer (this engine always emits info first),
      // so it is ignored and the search keeps waiting.
      if (!search.sawInfo) return;

      const bestMoveUci = line.split(/\s+/)[1] ?? '';
      this.settleSearch(search, bestMoveUci);
    }
  }

  private settleSearch(search: ActiveSearch, bestMoveUci: string): void {
    if (search.settled) return;
    search.settled = true;
    this.quiescentAt = Date.now() + SEARCH_QUIESCENCE_MS;
    if (search.safetyTimer) {
      clearTimeout(search.safetyTimer);
      search.safetyTimer = null;
    }
    if (this.activeSearch === search) {
      this.activeSearch = null;
    }

    if (!bestMoveUci || bestMoveUci === '(none)') {
      search.resolve(null);
      return;
    }

    const sanMove = search.restrictedMove ?? bestMoveUci;
    search.resolve({
      score: normalizeScore(search.rawType, search.rawValue, sideToMoveOf(search.fen)),
      bestMoveSan: convertUciToSan(search.fen, sanMove),
      bestMoveUci,
      pv: search.pv,
      depth: search.depthReached,
      diagnostics: {
        engineVersion: this.engineVersion,
        depth: search.depthReached,
        nodes: search.nodes,
        nps: search.nps,
        timeMs: search.timeMs,
        rawUci: search.lastInfoLine,
      },
    });
  }

  private failActiveSearch(reason: string): void {
    const search = this.activeSearch;
    if (!search) return;
    if (search.safetyTimer) {
      clearTimeout(search.safetyTimer);
      search.safetyTimer = null;
    }
    search.settled = true;
    this.activeSearch = null;
    this.quiescentAt = Date.now() + SEARCH_QUIESCENCE_MS;
    search.resolve(null);
    void reason;
  }

  private teardownWorker(): void {
    const worker = this.worker;
    this.worker = null;
    this.uciokResolve = null;
    this.readyokResolve = null;
    if (this.state !== 'disposed') {
      this.state = 'idle';
    }
    if (!worker) return;
    try {
      worker.removeEventListener('message', this.handleMessage);
      worker.removeEventListener('error', this.handleError);
    } catch {
      // ignore
    }
    try {
      worker.terminate();
    } catch {
      // ignore
    }
  }

  private runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  private waitWithTimeout(promise: Promise<void>, ms: number, what: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${what} timeout`)), ms);
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

  private async ensureReady(): Promise<EngineWorkerLike> {
    if (this.state === 'disposed') {
      throw new Error('Engine has been disposed');
    }
    if (this.state === 'ready' && this.worker) {
      return this.worker;
    }

    this.teardownWorker();
    const worker = this.workerFactory();
    this.worker = worker;
    this.state = 'initializing';
    worker.addEventListener('message', this.handleMessage);
    worker.addEventListener('error', this.handleError);

    try {
      worker.postMessage('uci');
      await this.waitWithTimeout(
        new Promise<void>((resolve) => {
          this.uciokResolve = resolve;
        }),
        this.initTimeoutMs,
        'uciok'
      );

      // This multi-variant build defaults to Contempt 24, which biases scores
      // toward the side to move and would corrupt before/after comparisons.
      worker.postMessage('setoption name Contempt value 0');
      worker.postMessage('ucinewgame');
      worker.postMessage('isready');
      await this.waitWithTimeout(
        new Promise<void>((resolve) => {
          this.readyokResolve = resolve;
        }),
        this.initTimeoutMs,
        'readyok'
      );

      this.state = 'ready';
      return worker;
    } catch (err) {
      this.teardownWorker();
      throw err;
    }
  }

  private async waitForReadyok(): Promise<void> {
    const worker = this.worker;
    if (!worker) throw new Error('Engine worker is not available');
    worker.postMessage('isready');
    await this.waitWithTimeout(
      new Promise<void>((resolve) => {
        this.readyokResolve = resolve;
      }),
      this.initTimeoutMs,
      'readyok'
    );
  }

  /**
   * Evaluates a single FEN position. Returns null when the engine could not
   * produce a trustworthy result (init failure, no bestmove, safety timeout,
   * cancellation) — callers must treat null as "analysis unavailable" rather
   * than substituting their own data.
   *
   * `options.searchMoves` restricts the search to the given UCI move(s); the
   * returned score is then the evaluation of playing that move in this exact
   * position, from the same side-to-move perspective as an unrestricted search.
   */
  async evaluateFen(
    fen: string,
    depth = 12,
    options?: { searchMoves?: string[] }
  ): Promise<EngineEval | null> {
    return this.runExclusive(() => this.evaluateFenExclusive(fen, depth, options));
  }

  private async evaluateFenExclusive(
    fen: string,
    depth: number,
    options?: { searchMoves?: string[] }
  ): Promise<EngineEval | null> {
    if (this.state === 'disposed') return null;

    // Terminal positions need no engine: the result is exact.
    try {
      const testChess = new Chess(fen);
      if (testChess.isCheckmate()) {
        const sideToMove = testChess.turn();
        return {
          score: { type: 'mate', value: sideToMove === 'w' ? -1 : 1 },
          bestMoveSan: '(checkmate)',
          bestMoveUci: '(none)',
          pv: [],
          depth: 0,
          diagnostics: {
            engineVersion: this.engineVersion,
            depth: 0,
            rawUci: 'Terminal checkmate',
          },
        };
      }
      if (testChess.isDraw()) {
        return {
          score: { type: 'cp', value: 0 },
          bestMoveSan: '(draw)',
          bestMoveUci: '(none)',
          pv: [],
          depth: 0,
          diagnostics: {
            engineVersion: this.engineVersion,
            depth: 0,
            rawUci: 'Terminal draw',
          },
        };
      }
    } catch {
      // Invalid FEN: let the engine reject it and surface the failure.
    }

    let worker: EngineWorkerLike;
    try {
      worker = await this.ensureReady();
    } catch {
      return null;
    }

    // Let in-flight output from the previous search drain before registering.
    const quietIn = this.quiescentAt - Date.now();
    if (quietIn > 0) {
      await new Promise((resolve) => setTimeout(resolve, quietIn));
    }
    // Cancellation or a safety timeout may have replaced the worker while we
    // slept — a search posted to a terminated worker would never complete.
    if (this.isDisposed() || this.worker !== worker) {
      return null;
    }

    return new Promise<EngineEval | null>((resolve) => {
      const search: ActiveSearch = {
        fen,
        requestedDepth: depth,
        restrictedMove: options?.searchMoves?.[0] ?? null,
        resolve,
        settled: false,
        sawInfo: false,
        lastInfoLine: '',
        rawType: 'cp',
        rawValue: 0,
        depthReached: 0,
        nodes: 0,
        nps: 0,
        timeMs: 0,
        pv: [],
        safetyTimer: null,
      };

      search.safetyTimer = setTimeout(() => {
        // Safety net only — the normal completion path is `bestmove`. Terminating
        // the worker guarantees partial output can never leak into later searches.
        this.failActiveSearch(`no bestmove within ${this.searchSafetyTimeoutMs}ms`);
        this.teardownWorker();
      }, this.searchSafetyTimeoutMs);

      this.activeSearch = search;
      worker.postMessage(`position fen ${fen}`);
      const goCommand =
        options?.searchMoves && options.searchMoves.length > 0
          ? `go depth ${depth} searchmoves ${options.searchMoves.join(' ')}`
          : `go depth ${depth}`;
      worker.postMessage(goCommand);
    });
  }

  cancelAnalysis(): void {
    this.sessionCounter += 1; // invalidate any running analyzeGame loop
    const search = this.activeSearch;
    if (search) {
      try {
        this.worker?.postMessage('stop');
      } catch {
        // ignore
      }
      this.failActiveSearch('cancelled');
    }
    // terminate() guarantees no further engine output can leak into later searches.
    this.teardownWorker();
  }

  dispose(): void {
    this.sessionCounter += 1;
    this.failActiveSearch('disposed');
    this.state = 'disposed';
    this.teardownWorker();
  }

  /**
   * Analyzes an entire sequence of game positions.
   *
   * For every move the position BEFORE the move is searched without restrictions
   * (best move + baseline eval); the played move is then measured with a
   * `searchmoves`-restricted search of the SAME position, so both scores come
   * from the same side to move and can be compared directly.
   */
  async analyzeGame(
    initialFen: string,
    moves: Array<{ from: string; to: string; san: string; promotion?: string }>,
    depth = 12,
    onProgress?: (progress: { current: number; total: number; percent: number }) => void
  ): Promise<GameAnalysisReport> {
    const session = ++this.sessionCounter;
    const isStale = () => session !== this.sessionCounter;

    const positions: PositionAnalysis[] = [];
    const counts = {
      w: { brilliant: 0, excellent: 0, good: 0, book: 0, inaccuracy: 0, mistake: 0, blunder: 0, unavailable: 0 },
      b: { brilliant: 0, excellent: 0, good: 0, book: 0, inaccuracy: 0, mistake: 0, blunder: 0, unavailable: 0 },
    };
    const moveAccuraciesW: number[] = [];
    const moveAccuraciesB: number[] = [];

    const chess = new Chess(initialFen);
    const playedSans: string[] = [];

    // Reset engine state for a new analysis session.
    try {
      await this.runExclusive(async () => {
        if (isStale()) return;
        const worker = await this.ensureReady();
        worker.postMessage('ucinewgame');
        await this.waitForReadyok();
      });
    } catch {
      if (isStale()) {
        return { positions, whiteAccuracy: 85, blackAccuracy: 85, classificationCounts: counts };
      }
    }

    for (let i = 0; i < moves.length; i++) {
      if (isStale()) break;

      const m = moves[i];
      const fenBefore = chess.fen();
      const mover: 'w' | 'b' = chess.turn();

      // Step 1: search the position BEFORE the move for the engine's best move and baseline eval.
      const evalBest = await this.evaluateFen(fenBefore, depth);
      if (isStale()) break;

      // Step 2: replay the played move on the board.
      let moveResult;
      try {
        moveResult = chess.move({ from: m.from, to: m.to, promotion: m.promotion });
      } catch {
        break;
      }
      if (!moveResult) break;

      const fenAfter = chess.fen();
      const playedUci = `${m.from}${m.to}${m.promotion ?? ''}`;
      playedSans.push(moveResult.san);

      let cpLoss: number | null = null;
      let evalPlayedScore: EngineScore | null = null;
      let bestMoveSan: string | null = null;
      let bestMoveUci: string | null = null;
      let diagnostics: EngineDiagnostics | undefined = evalBest?.diagnostics;

      if (evalBest && evalBest.bestMoveUci) {
        bestMoveUci = evalBest.bestMoveUci;
        bestMoveSan = evalBest.bestMoveSan;

        if (playedUci === bestMoveUci) {
          // The player found the engine's best move: loss is exactly zero and no
          // second search is needed.
          cpLoss = 0;
          evalPlayedScore = evalBest.score;
        } else {
          // Step 3: measure the played move with a restricted search of the same
          // position — same side to move, same perspective as the baseline.
          const evalPlayed = await this.evaluateFen(fenBefore, depth, {
            searchMoves: [playedUci],
          });
          if (isStale()) break;

          if (evalPlayed) {
            evalPlayedScore = evalPlayed.score;
            diagnostics = evalPlayed.diagnostics;

            const numBest = scoreToNumeric(evalBest.score);
            const numPlayed = scoreToNumeric(evalPlayed.score);
            const loss = mover === 'w' ? numBest - numPlayed : numPlayed - numBest;
            cpLoss = Math.max(0, loss);
          } else {
            diagnostics = {
              engineVersion: this.engineVersion,
              depth,
              rawUci: 'restricted search failed',
              error: 'Engine analysis failed for the played move',
            };
          }
        }
      } else if (evalBest) {
        // Full search answered but without a usable best move. Do NOT substitute
        // the played move — the analysis is explicitly unavailable.
        diagnostics = {
          ...evalBest.diagnostics,
          error: 'Engine returned no best move',
        };
      } else {
        diagnostics = {
          engineVersion: this.engineVersion,
          depth,
          rawUci: 'search failed',
          error: 'Engine analysis failed for this position',
        };
      }

      // Step 4: classify the move (thresholds unchanged).
      let classification: MoveClassification = 'unavailable';
      if (cpLoss !== null && evalPlayedScore) {
        const inBook = isKnownBookSequence(playedSans);
        const numPlayed = scoreToNumeric(evalPlayedScore);

        const hadForcedWin =
          !!evalBest &&
          evalBest.score.type === 'mate' &&
          ((mover === 'w' && evalBest.score.value > 0) ||
            (mover === 'b' && evalBest.score.value < 0));

        const keptForcedWin =
          evalPlayedScore.type === 'mate' &&
          ((mover === 'w' && evalPlayedScore.value > 0) ||
            (mover === 'b' && evalPlayedScore.value < 0));

        if (hadForcedWin && !keptForcedWin) {
          classification = 'blunder';
        } else if (inBook) {
          classification = 'book';
        } else if (cpLoss <= 12) {
          // Check for brilliant sacrifice: capture/check keeping a strong eval
          const isPieceSacrifice =
            (moveResult.san.includes('x') || moveResult.san.includes('+')) &&
            ((mover === 'w' && numPlayed >= 150) ||
              (mover === 'b' && numPlayed <= -150));

          classification = isPieceSacrifice && cpLoss <= 5 ? 'brilliant' : 'excellent';
        } else if (cpLoss <= 35) {
          classification = 'good';
        } else if (cpLoss <= 90) {
          classification = 'inaccuracy';
        } else if (cpLoss <= 200) {
          classification = 'mistake';
        } else {
          classification = 'blunder';
        }
      }

      counts[mover][classification]++;

      // Move accuracy calculation: 100 * exp(-0.0035 * cpLoss)
      if (cpLoss !== null) {
        const moveAccuracy = Math.max(0, Math.min(100, Math.round(100 * Math.exp(-0.0035 * cpLoss))));
        if (mover === 'w') moveAccuraciesW.push(moveAccuracy);
        else moveAccuraciesB.push(moveAccuracy);
      }

      positions.push({
        ply: i + 1,
        fen: fenBefore,
        fenAfter,
        san: moveResult.san,
        playedBy: mover,
        evaluation: evalPlayedScore,
        bestMoveSan,
        bestMoveUci,
        cpLoss: cpLoss !== null ? Math.round(cpLoss) : null,
        classification,
        diagnostics,
      });

      if (onProgress) {
        const percent = Math.round(((i + 1) / moves.length) * 100);
        onProgress({ current: i + 1, total: moves.length, percent });
      }
    }

    const whiteAccuracy =
      moveAccuraciesW.length > 0
        ? Math.round(moveAccuraciesW.reduce((a, b) => a + b, 0) / moveAccuraciesW.length)
        : 85;

    const blackAccuracy =
      moveAccuraciesB.length > 0
        ? Math.round(moveAccuraciesB.reduce((a, b) => a + b, 0) / moveAccuraciesB.length)
        : 85;

    return {
      positions,
      whiteAccuracy,
      blackAccuracy,
      classificationCounts: counts,
    };
  }
}

export const stockfishEngine = new StockfishEngineService();
