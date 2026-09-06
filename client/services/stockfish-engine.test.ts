import { describe, expect, it } from 'vitest';
import {
  formatEngineScore,
  scoreToNumeric,
  convertUciToSan,
  normalizeScore,
  StockfishEngineService,
  type EngineWorkerLike,
} from './stockfish-engine.js';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const AFTER_D4_FEN = 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Emit = (line: string) => void;

interface ScriptedReply {
  // UCI score clause, e.g. 'score cp 30' or 'score mate -2' (side-to-move perspective)
  score: string;
  best: string; // UCI bestmove
  infoOnly?: boolean; // emit info but never a bestmove
  extraStrayLines?: string[]; // emitted after bestmove (leftovers from a "previous" search)
}

/**
 * Deterministic fake UCI engine. The scenario callback receives the last
 * `position fen` value and the raw command (so it can distinguish full searches
 * from `go ... searchmoves X` restricted searches).
 */
function fakeEngineWorker(
  scenario: (fen: string, cmd: string) => ScriptedReply | 'silent' | undefined
): FakeWorker {
  let lastFen = '';
  return new FakeWorker((cmd: string, emit: Emit) => {
    if (cmd.startsWith('position fen ')) {
      lastFen = cmd.slice('position fen '.length);
      return;
    }
    if (cmd === 'uci') {
      emit('id name Testfish 1.0');
      emit('uciok');
      return;
    }
    if (cmd === 'isready') {
      emit('readyok');
      return;
    }
    if (cmd.startsWith('go')) {
      const reply = scenario(lastFen, cmd);
      if (!reply || reply === 'silent') return;
      emit(
        `info depth 12 seldepth 15 multipv 1 ${reply.score} nodes 50000 nps 250000 tbhits 0 time 200 pv ${reply.best} d7d5`
      );
      if (reply.infoOnly) return;
      emit(`bestmove ${reply.best}`);
      for (const stray of reply.extraStrayLines ?? []) emit(stray);
    }
  });
}

class FakeWorker implements EngineWorkerLike {
  sent: string[] = [];
  terminated = false;
  private messageListeners = new Set<(event: { data: unknown }) => void>();
  private errorListeners = new Set<(event: unknown) => void>();

  constructor(private readonly onCommand: (cmd: string, emit: Emit) => void) {}

  postMessage(data: string): void {
    this.sent.push(data);
    // Emit engine output asynchronously like a real worker.
    this.onCommand(data, (line: string) => {
      setTimeout(() => {
        for (const listener of this.messageListeners) listener({ data: line });
      }, 0);
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addEventListener(type: string, listener: (event: any) => void): void {
    if (type === 'message') this.messageListeners.add(listener);
    else this.errorListeners.add(listener);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  removeEventListener(type: string, listener: (event: any) => void): void {
    if (type === 'message') this.messageListeners.delete(listener);
    else this.errorListeners.delete(listener);
  }

  terminate(): void {
    this.terminated = true;
  }
}

function makeService(
  scenario: (fen: string, cmd: string) => ScriptedReply | 'silent' | undefined,
  options?: { searchSafetyTimeoutMs?: number }
) {
  const workers: FakeWorker[] = [];
  const service = new StockfishEngineService({
    workerFactory: () => {
      const worker = fakeEngineWorker(scenario);
      workers.push(worker);
      return worker;
    },
    initTimeoutMs: 2000,
    searchSafetyTimeoutMs: options?.searchSafetyTimeoutMs ?? 5000,
  });
  return { service, workers };
}

describe('StockfishEngineService - Logic & Math', () => {
  describe('normalizeScore', () => {
    it('normalizes score cp for White to move', () => {
      // Stockfish outputs +150 (side to move White has advantage)
      const score = normalizeScore('cp', 150, 'w');
      expect(score.type).toBe('cp');
      expect(score.value).toBe(150); // White +1.50
    });

    it('normalizes score cp for Black to move', () => {
      // Stockfish outputs +200 (side to move Black has advantage)
      const score = normalizeScore('cp', 200, 'b');
      expect(score.type).toBe('cp');
      expect(score.value).toBe(-200); // In universal convention, Black advantage is negative
    });

    it('normalizes score mate when White is delivering mate', () => {
      const score = normalizeScore('mate', 2, 'w');
      expect(score.type).toBe('mate');
      expect(score.value).toBe(2);
    });

    it('normalizes score mate when Black is delivering mate', () => {
      const score = normalizeScore('mate', 1, 'b');
      expect(score.type).toBe('mate');
      expect(score.value).toBe(-1);
    });

    it('normalizes score mate when Black is getting mated by White', () => {
      const score = normalizeScore('mate', -1, 'b');
      expect(score.type).toBe('mate');
      expect(score.value).toBe(1);
    });
  });

  describe('formatEngineScore', () => {
    it('formats positive and negative centipawns cleanly', () => {
      expect(formatEngineScore({ type: 'cp', value: 150 })).toBe('+1.5');
      expect(formatEngineScore({ type: 'cp', value: -80 })).toBe('-0.8');
      expect(formatEngineScore({ type: 'cp', value: 0 })).toBe('0.0');
    });

    it('formats forced mate notation cleanly', () => {
      expect(formatEngineScore({ type: 'mate', value: 1 })).toBe('M#1');
      expect(formatEngineScore({ type: 'mate', value: 3 })).toBe('M#3');
      expect(formatEngineScore({ type: 'mate', value: -2 })).toBe('-M#2');
    });
  });

  describe('scoreToNumeric', () => {
    it('returns raw centipawns for cp type', () => {
      expect(scoreToNumeric({ type: 'cp', value: 150 })).toBe(150);
      expect(scoreToNumeric({ type: 'cp', value: -320 })).toBe(-320);
    });

    it('clamps mate scores above standard pawn values without exploding graphs', () => {
      const mateIn1 = scoreToNumeric({ type: 'mate', value: 1 });
      const mateIn3 = scoreToNumeric({ type: 'mate', value: 3 });
      const blackMateIn1 = scoreToNumeric({ type: 'mate', value: -1 });

      expect(mateIn1).toBeGreaterThan(500);
      expect(mateIn1).toBeGreaterThan(mateIn3);
      expect(blackMateIn1).toBeLessThan(-500);
    });
  });

  describe('convertUciToSan', () => {
    const startFen = START_FEN;

    it('converts e2e4 to e4 in starting position', () => {
      expect(convertUciToSan(startFen, 'e2e4')).toBe('e4');
      expect(convertUciToSan(startFen, 'g1f3')).toBe('Nf3');
    });

    it('converts kingside castling e1g1 to O-O', () => {
      const castleFen = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
      expect(convertUciToSan(castleFen, 'e1g1')).toBe('O-O');
    });

    it('converts promotion move e7e8q to e8=Q+', () => {
      const promoFen = '3k4/4P3/8/8/8/8/8/4K3 w - - 0 1';
      expect(convertUciToSan(promoFen, 'e7e8q')).toBe('e8=Q+');
    });
  });
});

describe('StockfishEngineService - search lifecycle', () => {
  it('initializes the engine and parses a cp score with correct perspective', async () => {
    // Black to move: engine reports cp 25 from BLACK's perspective -> White is -0.25
    const { service, workers } = makeService((fen, cmd) => {
      if (fen === AFTER_E4_FEN && !cmd.includes('searchmoves')) {
        return { score: 'score cp 25', best: 'd7d5' };
      }
      return undefined;
    });

    const result = await service.evaluateFen(AFTER_E4_FEN, 12);
    expect(result).not.toBeNull();
    expect(result!.score).toEqual({ type: 'cp', value: -25 });
    expect(result!.bestMoveUci).toBe('d7d5');
    expect(result!.bestMoveSan).toBe('d5');
    expect(service.getEngineVersion()).toBe('Testfish 1.0');

    const worker = workers[0];
    expect(worker.terminated).toBe(false);
    // Full UCI handshake in the right order
    expect(worker.sent).toEqual([
      'uci',
      'setoption name Contempt value 0',
      'ucinewgame',
      'isready',
      `position fen ${AFTER_E4_FEN}`,
      'go depth 12',
    ]);
  });

  it('normalizes mate scores from both sides', async () => {
    // White to move, White mates in 3
    const { service: whiteService } = makeService((fen) =>
      fen === START_FEN ? { score: 'score mate 3', best: 'e2e4' } : undefined
    );
    const whiteResult = await whiteService.evaluateFen(START_FEN, 12);
    expect(whiteResult!.score).toEqual({ type: 'mate', value: 3 });

    // Black to move, Black gets mated in 2 -> White-positive +2
    const { service: blackService } = makeService((fen) =>
      fen === AFTER_E4_FEN ? { score: 'score mate -2', best: 'd7d5' } : undefined
    );
    const blackResult = await blackService.evaluateFen(AFTER_E4_FEN, 12);
    expect(blackResult!.score).toEqual({ type: 'mate', value: 2 });
  });

  it('handles negative cp for White to move', async () => {
    const { service } = makeService((fen) =>
      fen === START_FEN ? { score: 'score cp -130', best: 'g1f3' } : undefined
    );
    const result = await service.evaluateFen(START_FEN, 12);
    expect(result!.score).toEqual({ type: 'cp', value: -130 });
  });

  it('sends searchmoves and reports the restricted move', async () => {
    const { service, workers } = makeService((fen, cmd) => {
      if (fen === START_FEN && cmd.includes('searchmoves d2d4')) {
        return { score: 'score cp 20', best: 'd2d4' };
      }
      return undefined;
    });

    const result = await service.evaluateFen(START_FEN, 12, { searchMoves: ['d2d4'] });
    expect(result).not.toBeNull();
    expect(result!.bestMoveUci).toBe('d2d4');
    expect(result!.bestMoveSan).toBe('d4');
    expect(result!.score).toEqual({ type: 'cp', value: 20 });
    expect(workers[0].sent).toContain('go depth 12 searchmoves d2d4');
  });

  it('handles consecutive searches on a reused worker without cross-contamination', async () => {
    const { service, workers } = makeService((fen) => {
      if (fen === START_FEN) return { score: 'score cp 30', best: 'e2e4' };
      if (fen === AFTER_D4_FEN) return { score: 'score cp -20', best: 'd7d5' };
      return undefined;
    });

    const first = await service.evaluateFen(START_FEN, 12);
    const second = await service.evaluateFen(AFTER_D4_FEN, 12);

    expect(first!.score).toEqual({ type: 'cp', value: 30 });
    expect(second!.score).toEqual({ type: 'cp', value: 20 }); // -20 from Black's perspective
    expect(second!.bestMoveSan).toBe('d5');
    expect(workers).toHaveLength(1); // same worker reused
    expect(workers[0].terminated).toBe(false);

    // Both positions were sent, in order
    const positions = workers[0].sent.filter((c) => c.startsWith('position fen '));
    expect(positions).toEqual([`position fen ${START_FEN}`, `position fen ${AFTER_D4_FEN}`]);
  });

  it('ignores stray output that arrives after a search has completed', async () => {
    // After answering the first search the engine "leaks" late info/bestmove
    // lines from the previous search; they must not affect the next search.
    const { service } = makeService((fen) => {
      if (fen === START_FEN) {
        return {
          score: 'score cp 30',
          best: 'e2e4',
          extraStrayLines: ['info depth 20 score cp 424242 nodes 999999', 'bestmove a1a1'],
        };
      }
      if (fen === AFTER_D4_FEN) return { score: 'score cp -10', best: 'd7d5' };
      return undefined;
    });

    const first = await service.evaluateFen(START_FEN, 12);
    expect(first!.score).toEqual({ type: 'cp', value: 30 });

    const second = await service.evaluateFen(AFTER_D4_FEN, 12);
    expect(second!.score).toEqual({ type: 'cp', value: 10 }); // not 424242
    expect(second!.bestMoveUci).toBe('d7d5'); // not a1a1
  });

  it('resolves null and terminates the worker on the safety timeout', async () => {
    const { service, workers } = makeService(() => 'silent', { searchSafetyTimeoutMs: 150 });

    const result = await service.evaluateFen(START_FEN, 12);
    expect(result).toBeNull();
    expect(workers[0].terminated).toBe(true);
  });

  it('recovers with a fresh worker after a safety timeout', async () => {
    let failing = true;
    const { service, workers } = makeService((fen, cmd) => {
      if (failing) return 'silent';
      if (fen === START_FEN && !cmd.includes('searchmoves')) {
        return { score: 'score cp 30', best: 'e2e4' };
      }
      return undefined;
    }, { searchSafetyTimeoutMs: 150 });

    const failed = await service.evaluateFen(START_FEN, 12);
    expect(failed).toBeNull();
    expect(workers[0].terminated).toBe(true);

    failing = false;
    const recovered = await service.evaluateFen(START_FEN, 12);
    expect(recovered).not.toBeNull();
    expect(recovered!.score).toEqual({ type: 'cp', value: 30 });
    expect(workers).toHaveLength(2); // a fresh worker was created
  });

  it('cancellation resolves the pending search with null and allows re-analysis', async () => {
    let answering = false;
    const { service, workers } = makeService((fen, cmd) => {
      if (!answering) return 'silent';
      if (fen === START_FEN && !cmd.includes('searchmoves')) {
        return { score: 'score cp 30', best: 'e2e4' };
      }
      return undefined;
    });

    const pending = service.evaluateFen(START_FEN, 12);
    await wait(50); // init done, go sent, engine silent
    service.cancelAnalysis();
    const result = await pending;
    expect(result).toBeNull();
    expect(workers[0].sent).toContain('stop');
    expect(workers[0].terminated).toBe(true);

    answering = true;
    const next = await service.evaluateFen(START_FEN, 12);
    expect(next).not.toBeNull();
    expect(next!.score).toEqual({ type: 'cp', value: 30 });
    expect(workers.length).toBe(2); // fresh worker after cancellation
  });

  it('returns null when no worker can be created', async () => {
    const service = new StockfishEngineService({
      workerFactory: () => {
        throw new Error('no workers here');
      },
    });
    const result = await service.evaluateFen(START_FEN, 12);
    expect(result).toBeNull();
  });

  it('sends ucinewgame before each analysis session', async () => {
    const { service, workers } = makeService((fen) => {
      if (fen === START_FEN) return { score: 'score cp 30', best: 'e2e4' };
      return undefined;
    });

    const moves = [{ from: 'e2', to: 'e4', san: 'e4' }];
    await service.analyzeGame(START_FEN, moves, 10);
    await service.analyzeGame(START_FEN, moves, 10);

    const newGames = workers[0].sent.filter((c) => c === 'ucinewgame');
    expect(newGames.length).toBeGreaterThanOrEqual(2); // init + one per session
  });
});

describe('StockfishEngineService - analyzeGame', () => {
  it('reconstructs exact FENs, keeps perspectives White-positive, and classifies book opening moves', async () => {
    // 1. e4 is the engine's best move; 1...e5 is slightly worse than d7d5.
    const { service } = makeService((fen, cmd) => {
      if (fen === START_FEN && !cmd.includes('searchmoves')) {
        return { score: 'score cp 30', best: 'e2e4' };
      }
      if (fen === AFTER_E4_FEN) {
        if (cmd.includes('searchmoves e7e5')) return { score: 'score cp -28', best: 'e7e5' };
        return { score: 'score cp -25', best: 'd7d5' };
      }
      if (fen === 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2' && !cmd.includes('searchmoves')) {
        return { score: 'score cp 40', best: 'g1f3' };
      }
      if (fen === 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2') {
        if (cmd.includes('searchmoves b8c6')) return { score: 'score cp -20', best: 'b8c6' };
        return { score: 'score cp -20', best: 'b8c6' };
      }
      return undefined;
    });

    const moves = [
      { from: 'e2', to: 'e4', san: 'e4' },
      { from: 'e7', to: 'e5', san: 'e5' },
      { from: 'g1', to: 'f3', san: 'Nf3' },
      { from: 'b8', to: 'c6', san: 'Nc6' },
    ];

    const report = await service.analyzeGame(START_FEN, moves, 12);

    expect(report.positions).toHaveLength(4);

    // FEN replay: position before each move must be the exact reconstructed FEN
    expect(report.positions[0].fen).toBe(START_FEN);
    expect(report.positions[0].fenAfter).toBe(AFTER_E4_FEN);
    expect(report.positions[1].fen).toBe(AFTER_E4_FEN);
    expect(report.positions[1].fenAfter).toBe(
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
    );
    expect(report.positions[2].fenAfter).toBe(
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2'
    );

    // Side to move attribution
    expect(report.positions[0].playedBy).toBe('w');
    expect(report.positions[1].playedBy).toBe('b');

    // 1. e4 == engine best -> cpLoss 0, eval stays White-positive
    expect(report.positions[0].cpLoss).toBe(0);
    expect(report.positions[0].evaluation).toEqual({ type: 'cp', value: 30 });
    expect(report.positions[0].bestMoveSan).toBe('e4');

    // 1...e5: baseline -25 (Black persp) -> +25 White; played -28 -> +28 White.
    // Black's loss = 28 - 25 = 3. Perspective stays White-positive.
    expect(report.positions[1].cpLoss).toBe(3);
    expect(report.positions[1].evaluation).toEqual({ type: 'cp', value: 28 });
    expect(report.positions[1].bestMoveSan).toBe('d5');

    // All four moves follow known opening lines -> genuine book classification
    for (const position of report.positions) {
      expect(position.classification).toBe('book');
    }
    expect(report.classificationCounts.w.book).toBe(2);
    expect(report.classificationCounts.b.book).toBe(2);
    expect(report.whiteAccuracy).toBeGreaterThanOrEqual(95);
    expect(report.blackAccuracy).toBeGreaterThanOrEqual(95);
  });

  it('never labels the common opening moves 1.e4/1.d4/1.Nf3/1.c4 as mistakes', async () => {
    // Engine prefers e4; every alternative first move loses a handful of cp only
    // (same-position restricted search), and all of them are real book moves.
    const alternatives = [
      { from: 'd2', to: 'd4', san: 'd4', uci: 'd2d4', fen: AFTER_D4_FEN },
      { from: 'g1', to: 'f3', san: 'Nf3', uci: 'g1f3', fen: 'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1' },
      { from: 'c2', to: 'c4', san: 'c4', uci: 'c2c4', fen: 'rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq - 0 1' },
      { from: 'a2', to: 'a3', san: 'a3', uci: 'a2a3', fen: 'rnbqkbnr/pppppppp/8/8/8/P7/1PPPPPPP/RNBQKBNR b KQkq - 0 1' },
    ];

    for (const alt of alternatives) {
      const { service } = makeService((fen, cmd) => {
        if (fen === START_FEN && !cmd.includes('searchmoves')) {
          return { score: 'score cp 35', best: 'e2e4' };
        }
        if (fen === alt.fen && cmd === `go depth 12 searchmoves ${alt.uci}`) {
          return undefined; // restricted search happens on START_FEN, not after the move
        }
        if (fen === START_FEN && cmd === `go depth 12 searchmoves ${alt.uci}`) {
          return { score: 'score cp 20', best: alt.uci };
        }
        return undefined;
      });

      const report = await service.analyzeGame(START_FEN, [alt], 12);
      expect(report.positions).toHaveLength(1);
      const position = report.positions[0];
      expect(position.san).toBe(alt.san);
      expect(position.classification === 'mistake' || position.classification === 'blunder').toBe(false);
      if (alt.san === 'a3') {
        // Not a book move: 35 - 20 = 15cp loss -> still only "good"
        expect(position.classification).toBe('good');
      } else {
        expect(position.classification).toBe('book');
      }
    }
  });

  it('marks positions unavailable when the engine returns no best move (no masking)', async () => {
    const { service } = makeService(
      (fen) => (fen === START_FEN ? { score: 'score cp 30', best: 'e2e4', infoOnly: true } : undefined),
      { searchSafetyTimeoutMs: 200 }
    );

    const report = await service.analyzeGame(
      START_FEN,
      [{ from: 'e2', to: 'e4', san: 'e4' }],
      12,
      undefined
    );

    expect(report.positions).toHaveLength(1);
    const position = report.positions[0];
    expect(position.classification).toBe('unavailable');
    expect(position.bestMoveSan).toBeNull(); // must NOT fall back to the played move
    expect(position.bestMoveUci).toBeNull();
    expect(position.cpLoss).toBeNull();
    expect(position.evaluation).toBeNull();
    expect(position.diagnostics?.error).toBeTruthy();
  });

  it('detects a forced-mate blunder with mate score handling', async () => {
    // Back-rank mate in 1 available (Re8#); the player plays Ra1 instead.
    const mateFen = '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1';
    const { service } = makeService((fen, cmd) => {
      if (fen === mateFen && !cmd.includes('searchmoves')) {
        return { score: 'score mate 1', best: 'e1e8' };
      }
      if (fen === mateFen && cmd.includes('searchmoves e1a1')) {
        return { score: 'score cp 500', best: 'e1a1' };
      }
      return undefined;
    });

    const report = await service.analyzeGame(mateFen, [{ from: 'e1', to: 'a1', san: 'Ra1' }], 12);
    const position = report.positions[0];
    // mate 1 -> 990 numeric; played 500 -> loss 490
    expect(position.cpLoss).toBe(490);
    expect(position.classification).toBe('blunder');
  });

  it('finds the mating move with zero loss and stays White-positive for Black movers', async () => {
    const mateFen = '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1';
    const { service } = makeService((fen, cmd) => {
      if (fen === mateFen && !cmd.includes('searchmoves')) {
        return { score: 'score mate 1', best: 'e1e8' };
      }
      return undefined;
    });

    const report = await service.analyzeGame(mateFen, [{ from: 'e1', to: 'e8', san: 'Re8#' }], 12);
    const position = report.positions[0];
    expect(position.cpLoss).toBe(0);
    expect(position.evaluation).toEqual({ type: 'mate', value: 1 });
    expect(position.classification).toBe('excellent');
  });

  it('measures a Black move against a Black-side baseline without flipping signs', async () => {
    // Black to move: baseline score cp 40 (Black is +0.4); Black plays a move
    // measured at cp 10 -> Black lost 30cp. Normalized: baseline -40, played -10.
    const { service } = makeService((fen, cmd) => {
      if (fen === AFTER_E4_FEN && !cmd.includes('searchmoves')) {
        return { score: 'score cp 40', best: 'd7d5' };
      }
      if (fen === AFTER_E4_FEN && cmd.includes('searchmoves c7c6')) {
        return { score: 'score cp 10', best: 'c7c6' };
      }
      return undefined;
    });

    const report = await service.analyzeGame(AFTER_E4_FEN, [{ from: 'c7', to: 'c6', san: 'c6' }], 12);
    const position = report.positions[0];
    expect(position.playedBy).toBe('b');
    expect(position.cpLoss).toBe(30);
    expect(position.evaluation).toEqual({ type: 'cp', value: -10 }); // White-positive: -0.10
    expect(position.classification).toBe('good'); // 30 <= 35
  });
});
