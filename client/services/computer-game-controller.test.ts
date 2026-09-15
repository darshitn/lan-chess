import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Chess } from 'chess.js';
import {
  ComputerGameController,
  type ComputerGameConfig,
  type ComputerGameState,
  parseTimeControlParams,
  formatPgnTimeControl,
  buildComputerPgn,
} from './computer-game-controller.js';
import { ComputerPlayerService } from './computer-player.js';
import { getSavedGames } from './game-history.js';
import type { EngineWorkerLike } from './stockfish-engine.js';

type Emit = (line: string) => void;

class FakeWorker implements EngineWorkerLike {
  sent: string[] = [];
  terminated = false;
  private messageListeners = new Set<(event: { data: unknown }) => void>();
  private errorListeners = new Set<(event: unknown) => void>();

  constructor(private readonly onCommand: (cmd: string, emit: Emit) => void) {}

  postMessage(data: string): void {
    this.sent.push(data);
    this.onCommand(data, (line: string) => {
      setTimeout(() => {
        for (const listener of this.messageListeners) listener({ data: line });
      }, 0);
    });
  }

  addEventListener(type: 'message' | 'error', listener: (...args: any[]) => void): void {
    if (type === 'message') this.messageListeners.add(listener);
    if (type === 'error') this.errorListeners.add(listener);
  }

  removeEventListener(type: 'message' | 'error', listener: (...args: any[]) => void): void {
    if (type === 'message') this.messageListeners.delete(listener);
    if (type === 'error') this.errorListeners.delete(listener);
  }

  terminate(): void {
    this.terminated = true;
    this.messageListeners.clear();
    this.errorListeners.clear();
  }

  triggerError(err: unknown): void {
    for (const listener of this.errorListeners) listener(err);
  }
}

function createMockPlayerService(onGo?: (cmd: string, emit: Emit) => void): ComputerPlayerService {
  const worker = new FakeWorker((cmd, emit) => {
    if (cmd === 'uci') {
      emit('id name Stockfish WASM');
      emit('option name Skill Level type spin default 20 min 0 max 20');
      emit('uciok');
      return;
    }
    if (cmd === 'isready') {
      emit('readyok');
      return;
    }
    if (cmd.startsWith('go ')) {
      if (onGo) {
        onGo(cmd, emit);
      } else {
        // Default reply: 1... e7e5 or 1. e2e4
        emit('bestmove e7e5');
      }
    }
  });

  return new ComputerPlayerService({
    workerFactory: () => worker,
  });
}

function installFakeStorage(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  (globalThis as Record<string, unknown>).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
    },
  };
  return store;
}

describe('ComputerGameController', () => {
  beforeEach(() => {
    installFakeStorage();
  });

  it('parses time control parameters accurately', () => {
    expect(parseTimeControlParams('unlimited')).toEqual({ initialMs: null, incrementMs: 0 });
    expect(parseTimeControlParams('3+2')).toEqual({ initialMs: 180000, incrementMs: 2000 });
    expect(parseTimeControlParams('10+0')).toEqual({ initialMs: 600000, incrementMs: 0 });
    expect(parseTimeControlParams('1+1')).toEqual({ initialMs: 60000, incrementMs: 1000 });
  });

  it('initializes game with chosen color and difficulty', async () => {
    const service = createMockPlayerService();
    const config: ComputerGameConfig = {
      playerName: 'Player1',
      colorChoice: 'w',
      difficulty: 'medium',
      timeControl: '5+0',
    };

    const controller = new ComputerGameController(service, config);
    await controller.startNewGame();

    const state = controller.getState();
    expect(state.status).toBe('active');
    expect(state.humanColor).toBe('w');
    expect(state.computerColor).toBe('b');
    expect(state.difficulty).toBe('medium');
    expect(state.timeControl).toBe('5+0');
    expect(state.turn).toBe('w');
    expect(state.whiteTimeMs).toBe(300000);
    expect(state.blackTimeMs).toBe(300000);

    controller.dispose();
    service.dispose();
  });

  it('triggers computer first move when player chooses Black', async () => {
    let computerSearched = false;
    const service = createMockPlayerService((cmd, emit) => {
      computerSearched = true;
      emit('bestmove e2e4');
    });

    const config: ComputerGameConfig = {
      playerName: 'Player1',
      colorChoice: 'b',
      difficulty: 'easy',
      timeControl: 'unlimited',
    };

    const controller = new ComputerGameController(service, config);
    await controller.startNewGame();

    // Allow engine async reply
    await new Promise((r) => setTimeout(r, 20));

    const state = controller.getState();
    expect(computerSearched).toBe(true);
    expect(state.turn).toBe('b'); // Now Black's turn
    expect(state.moves.length).toBe(1);
    expect(state.moves[0].san).toBe('e4');
    expect(state.moves[0].color).toBe('w');

    controller.dispose();
    service.dispose();
  });

  it('resolves random color selection to either white or black', async () => {
    const service = createMockPlayerService();
    const config: ComputerGameConfig = {
      playerName: 'Player1',
      colorChoice: 'random',
      difficulty: 'easy',
      timeControl: 'unlimited',
    };

    const controller = new ComputerGameController(service, config);
    await controller.startNewGame();

    const state = controller.getState();
    expect(['w', 'b']).toContain(state.humanColor);
    expect(state.computerColor).toBe(state.humanColor === 'w' ? 'b' : 'w');

    controller.dispose();
    service.dispose();
  });

async function waitFor(fn: () => boolean, timeoutMs = 1000): Promise<void> {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, 10));
  }
}

  it('applies legal human move, updates state, and receives legal engine reply', async () => {
    const service = createMockPlayerService((cmd, emit) => {
      emit('bestmove c7c5'); // Sicilian defense response
    });

    const config: ComputerGameConfig = {
      playerName: 'Alice',
      colorChoice: 'w',
      difficulty: 'medium',
      timeControl: '3+2',
    };

    const controller = new ComputerGameController(service, config);
    await controller.startNewGame();

    // Human plays 1. e4
    const res = await controller.makeHumanMove('e2', 'e4');
    expect(res.success).toBe(true);

    const midState = controller.getState();
    expect(midState.moves.length).toBe(1);
    expect(midState.moves[0].san).toBe('e4');
    expect(midState.turn).toBe('b');

    // Wait for computer move
    await waitFor(() => controller.getState().moves.length === 2);

    const finalState = controller.getState();
    expect(finalState.moves.length).toBe(2);
    expect(finalState.moves[1].san).toBe('c5');
    expect(finalState.turn).toBe('w');
    expect(finalState.isEngineThinking).toBe(false);

    controller.dispose();
    service.dispose();
  });

  it('handles pawn promotion move correctly', async () => {
    const service = createMockPlayerService();
    const config: ComputerGameConfig = {
      playerName: 'Alice',
      colorChoice: 'w',
      difficulty: 'easy',
      timeControl: 'unlimited',
    };

    const controller = new ComputerGameController(service, config);
    await controller.startNewGame();

    // Set up position with pawn on 7th rank ready to promote (Black King on d8 so e8 is free)
    const chess = controller.getChess();
    chess.load('3k4/4P3/8/8/8/8/8/4K3 w - - 0 1');
    (controller as any).state.fen = chess.fen();

    const res = await controller.makeHumanMove('e7', 'e8', 'q');
    expect(res.success).toBe(true);

    const state = controller.getState();
    expect(state.moves.at(-1)?.promotion).toBe('q');
    expect(state.moves.at(-1)?.san).toBe('e8=Q+');

    controller.dispose();
    service.dispose();
  });

  it('detects checkmate by human and finishes game with history saved', async () => {
    const service = createMockPlayerService();
    const config: ComputerGameConfig = {
      playerName: 'Grandmaster',
      colorChoice: 'w',
      difficulty: 'hard',
      timeControl: 'unlimited',
    };

    const controller = new ComputerGameController(service, config);
    await controller.startNewGame();

    // Set up Scholar's Mate position: 1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6, White plays Qxf7#
    const chess = controller.getChess();
    chess.load('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4');
    (controller as any).state.fen = chess.fen();

    const res = await controller.makeHumanMove('h5', 'f7');
    expect(res.success).toBe(true);

    const state = controller.getState();
    expect(state.status).toBe('finished');
    expect(state.winner).toBe('w');
    expect(state.reason).toBe('Checkmate');

    // Verify game was saved into history
    const saved = getSavedGames();
    expect(saved.length).toBe(1);
    expect(saved[0].winner).toBe('w');
    expect(saved[0].reason).toBe('Checkmate');
    expect(saved[0].whiteName).toBe('Grandmaster');
    expect(saved[0].blackName).toContain('Stockfish');

    controller.dispose();
    service.dispose();
  });

  it('handles player resignation', async () => {
    const service = createMockPlayerService();
    const config: ComputerGameConfig = {
      playerName: 'Bob',
      colorChoice: 'w',
      difficulty: 'expert',
      timeControl: '5+0',
    };

    const controller = new ComputerGameController(service, config);
    await controller.startNewGame();

    controller.resign();

    const state = controller.getState();
    expect(state.status).toBe('finished');
    expect(state.winner).toBe('b');
    expect(state.reason).toBe('White resigned');

    const saved = getSavedGames();
    expect(saved.length).toBe(1);
    expect(saved[0].winner).toBe('b');
    expect(saved[0].reason).toBe('White resigned');

    controller.dispose();
    service.dispose();
  });

  it('handles timeout race condition: late engine move does not overwrite timeout result', async () => {
    let delayedEmit: Emit | null = null;
    const service = createMockPlayerService((cmd, emit) => {
      // Delay engine reply
      delayedEmit = emit;
    });

    const config: ComputerGameConfig = {
      playerName: 'Speedy',
      colorChoice: 'w',
      difficulty: 'medium',
      timeControl: '1+0',
    };

    const controller = new ComputerGameController(service, config);
    await controller.startNewGame();

    // Human plays 1. e4
    await controller.makeHumanMove('e2', 'e4');

    expect(controller.getState().isEngineThinking).toBe(true);

    // Simulate clock running out for Black while calculating
    (controller as any).state.blackTimeMs = 50;
    (controller as any).lastClockTick = Date.now() - 100;
    (controller as any).tickClock();

    // Verify game finished by timeout
    const timeoutState = controller.getState();
    expect(timeoutState.status).toBe('finished');
    expect(timeoutState.winner).toBe('w');
    expect(timeoutState.reason).toBe('Black ran out of time');

    // Now engine emits a late bestmove after game already timed out
    if (delayedEmit) {
      (delayedEmit as Emit)('bestmove e7e5');
    }
    await new Promise((r) => setTimeout(r, 20));

    // Result MUST NOT have changed or been overwritten by late engine move
    const finalState = controller.getState();
    expect(finalState.status).toBe('finished');
    expect(finalState.winner).toBe('w');
    expect(finalState.reason).toBe('Black ran out of time');
    expect(finalState.moves.length).toBe(1); // Only 1. e4 was recorded

    controller.dispose();
    service.dispose();
  });

  it('cleans up previous search when restart is triggered during engine calculation', async () => {
    let delayedEmit: Emit | null = null;
    const service = createMockPlayerService((cmd, emit) => {
      delayedEmit = emit;
    });

    const config: ComputerGameConfig = {
      playerName: 'Alice',
      colorChoice: 'w',
      difficulty: 'medium',
      timeControl: 'unlimited',
    };

    const controller = new ComputerGameController(service, config);
    await controller.startNewGame();

    // Human moves
    await controller.makeHumanMove('e2', 'e4');
    expect(controller.getState().isEngineThinking).toBe(true);

    // User restarts before engine replies
    await controller.startNewGame();

    const restartedState = controller.getState();
    expect(restartedState.moves.length).toBe(0);
    expect(restartedState.turn).toBe('w');
    expect(restartedState.isEngineThinking).toBe(false);

    // If old engine search emits now, it is completely ignored
    if (delayedEmit) {
      (delayedEmit as Emit)('bestmove e7e5');
    }
    await new Promise((r) => setTimeout(r, 20));

    expect(controller.getState().moves.length).toBe(0);

    controller.dispose();
    service.dispose();
  });

  it('builds valid PGN with full metadata headers for computer games', () => {
    const chess = new Chess();
    chess.move('e4');
    chess.move('e5');
    chess.move('Nf3');

    const pgn = buildComputerPgn(
      chess,
      'Alice',
      'Stockfish (Medium)',
      'w',
      'Black resigned',
      '3+2',
      new Date('2026-09-15T10:00:00Z')
    );

    expect(pgn).toContain('[Event "Offline Play vs Computer"]');
    expect(pgn).toContain('[Site "LAN Chess Offline"]');
    expect(pgn).toContain('[Date "2026.09.15"]');
    expect(pgn).toContain('[White "Alice"]');
    expect(pgn).toContain('[Black "Stockfish (Medium)"]');
    expect(pgn).toContain('[Result "1-0"]');
    expect(pgn).toContain('[TimeControl "180+2"]');
    expect(pgn).toContain('[Termination "Black resigned"]');
    expect(pgn).toContain('1. e4 e5 2. Nf3');
  });

  it('converts time controls to standard PGN format including Unlimited', () => {
    expect(formatPgnTimeControl('unlimited')).toBe('-');
    expect(formatPgnTimeControl('3+2')).toBe('180+2');
    expect(formatPgnTimeControl('1+0')).toBe('60+0');
    expect(formatPgnTimeControl('1+1')).toBe('60+1');
    expect(formatPgnTimeControl('5+0')).toBe('300+0');
    expect(formatPgnTimeControl('10+0')).toBe('600+0');
    expect(formatPgnTimeControl('15+10')).toBe('900+10');

    const chess = new Chess();
    const unlimitedPgn = buildComputerPgn(
      chess,
      'Alice',
      'Stockfish (Easy)',
      'w',
      'Normal',
      'unlimited'
    );
    expect(unlimitedPgn).toContain('[TimeControl "-"]');
  });

  describe('Clock correctness & timing tests', () => {
    it('settles elapsed time between ticks before accepting move and applying increment', async () => {
      const service = createMockPlayerService(() => {
        // Do not respond immediately so we can inspect intermediate state
      });

      const config: ComputerGameConfig = {
        playerName: 'Alice',
        colorChoice: 'w',
        difficulty: 'medium',
        timeControl: '3+2', // 180,000 ms + 2,000 ms inc
      };

      const controller = new ComputerGameController(service, config);
      await controller.startNewGame();

      // Simulate 1.5 seconds elapsed since game start WITHOUT tickClock firing
      (controller as any).lastClockTick = Date.now() - 1500;

      // Human makes move 1. e4
      const res = await controller.makeHumanMove('e2', 'e4');
      expect(res.success).toBe(true);

      const state = controller.getState();
      // 180,000ms - 1500ms elapsed + 2000ms increment = 180,500ms
      expect(state.whiteTimeMs).toBe(180500);

      controller.dispose();
      service.dispose();
    });

    it('rejects human move after deadline even if interval callback has not fired', async () => {
      const service = createMockPlayerService();
      const config: ComputerGameConfig = {
        playerName: 'Alice',
        colorChoice: 'w',
        difficulty: 'medium',
        timeControl: '1+0',
      };

      const controller = new ComputerGameController(service, config);
      await controller.startNewGame();

      // Player has 200ms left on clock
      (controller as any).state.whiteTimeMs = 200;
      // 350ms elapsed since last tick (tick callback was delayed and did not fire)
      (controller as any).lastClockTick = Date.now() - 350;

      // Player tries to move after deadline
      const res = await controller.makeHumanMove('e2', 'e4');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Time expired');

      const state = controller.getState();
      expect(state.status).toBe('finished');
      expect(state.winner).toBe('b');
      expect(state.reason).toBe('White ran out of time');
      expect(state.moves.length).toBe(0); // Move was NOT accepted

      controller.dispose();
      service.dispose();
    });

    it('handles Fischer increment near timeout: applies increment only if move made before deadline', async () => {
      const service = createMockPlayerService();
      const config: ComputerGameConfig = {
        playerName: 'Alice',
        colorChoice: 'w',
        difficulty: 'medium',
        timeControl: '3+2', // 2,000 ms increment
      };

      const controller = new ComputerGameController(service, config);
      await controller.startNewGame();

      // Case 1: Player has 100ms left, moves after 40ms (before deadline)
      (controller as any).state.whiteTimeMs = 100;
      (controller as any).lastClockTick = Date.now() - 40;

      const res1 = await controller.makeHumanMove('e2', 'e4');
      expect(res1.success).toBe(true);
      // Remaining: (100 - 40) + 2000 = 2060ms
      expect(controller.getState().whiteTimeMs).toBe(2060);

      controller.dispose();
      service.dispose();
    });

    it('settles engine elapsed time and rejects engine move if engine exceeds its clock deadline', async () => {
      let delayedEmit: Emit | null = null;
      const service = createMockPlayerService((cmd, emit) => {
        delayedEmit = emit;
      });

      const config: ComputerGameConfig = {
        playerName: 'Alice',
        colorChoice: 'w',
        difficulty: 'medium',
        timeControl: '1+1',
      };

      const controller = new ComputerGameController(service, config);
      await controller.startNewGame();

      // Human plays 1. e4
      await controller.makeHumanMove('e2', 'e4');
      expect(controller.getState().isEngineThinking).toBe(true);

      // Wait until go command is sent to engine
      await waitFor(() => delayedEmit !== null, 500);

      // Computer has 100ms left
      (controller as any).state.blackTimeMs = 100;
      // Engine search takes 250ms (interval did not fire yet)
      (controller as any).lastClockTick = Date.now() - 250;

      // Engine finishes and returns bestmove after its clock expired
      if (delayedEmit) {
        (delayedEmit as Emit)('bestmove e7e5');
      }
      await new Promise((r) => setTimeout(r, 20));

      const state = controller.getState();
      expect(state.status).toBe('finished');
      expect(state.winner).toBe('w');
      expect(state.reason).toBe('Black ran out of time');
      expect(state.moves.length).toBe(1); // Black's move was rejected and not recorded

      controller.dispose();
      service.dispose();
    });
  });

  describe('Engine error recovery & stale guards', () => {
    it('catches actual worker error during active search, clears thinking state, and exposes working retry action', async () => {
      let activeWorker: FakeWorker | null = null;
      let goCount = 0;

      const worker = new FakeWorker((cmd, emit) => {
        if (cmd === 'uci') {
          emit('id name Testfish');
          emit('uciok');
        } else if (cmd === 'isready') {
          emit('readyok');
        } else if (cmd.startsWith('go ')) {
          goCount++;
          if (goCount === 1) {
            // First search: simulate crash during search via error event
            setTimeout(() => {
              worker.triggerError(new Error('Engine crash: out of memory'));
            }, 10);
          } else {
            // Retry search: responds successfully
            setTimeout(() => {
              emit('bestmove e7e5');
            }, 10);
          }
        }
      });

      const service = new ComputerPlayerService({
        workerFactory: () => {
          activeWorker = worker;
          return worker;
        },
      });

      const config: ComputerGameConfig = {
        playerName: 'Alice',
        colorChoice: 'w',
        difficulty: 'medium',
        timeControl: 'unlimited',
      };

      const controller = new ComputerGameController(service, config);
      await controller.startNewGame();

      // Human plays 1. e4
      await controller.makeHumanMove('e2', 'e4');
      expect(controller.getState().isEngineThinking).toBe(true);

      // Wait for error to propagate
      await waitFor(() => !controller.getState().isEngineThinking, 500);

      const errorState = controller.getState();
      expect(errorState.isEngineThinking).toBe(false);
      expect(errorState.engineError).toContain('Engine crash: out of memory');
      expect(errorState.status).toBe('active'); // Game is still active

      // Trigger the recovery action: retryComputerMove
      await controller.retryComputerMove();

      // Wait for engine reply to succeed
      await waitFor(() => controller.getState().moves.length === 2, 500);

      const recoveredState = controller.getState();
      expect(recoveredState.engineError).toBeNull();
      expect(recoveredState.moves.length).toBe(2);
      expect(recoveredState.moves[1].san).toBe('e5');
      expect(recoveredState.turn).toBe('w');

      controller.dispose();
      service.dispose();
    });

    it('guards against stale game updates when engine error arrives after resignation', async () => {
      let activeWorker: FakeWorker | null = null;

      const worker = new FakeWorker((cmd, emit) => {
        if (cmd === 'uci') {
          emit('id name Testfish');
          emit('uciok');
        } else if (cmd === 'isready') {
          emit('readyok');
        } else if (cmd.startsWith('go ')) {
          // Do not reply immediately
        }
      });

      const service = new ComputerPlayerService({
        workerFactory: () => {
          activeWorker = worker;
          return worker;
        },
      });

      const config: ComputerGameConfig = {
        playerName: 'Alice',
        colorChoice: 'w',
        difficulty: 'medium',
        timeControl: 'unlimited',
      };

      const controller = new ComputerGameController(service, config);
      await controller.startNewGame();

      // Human moves
      await controller.makeHumanMove('e2', 'e4');
      expect(controller.getState().isEngineThinking).toBe(true);

      // Player resigns while engine is calculating
      controller.resign();
      expect(controller.getState().status).toBe('finished');
      expect(controller.getState().reason).toBe('White resigned');

      // Now worker triggers an error
      worker.triggerError(new Error('Late error after resignation'));
      await new Promise((r) => setTimeout(r, 20));

      // Resignation status must remain intact; engine error should not overwrite finished state
      const state = controller.getState();
      expect(state.status).toBe('finished');
      expect(state.reason).toBe('White resigned');
      expect(state.engineError).toBeNull();

      controller.dispose();
      service.dispose();
    });
  });
});
