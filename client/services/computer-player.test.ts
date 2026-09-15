import { describe, expect, it, vi } from 'vitest';
import {
  ComputerPlayerService,
  DIFFICULTY_CONFIGS,
  type ComputerDifficulty,
} from './computer-player.js';
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

describe('ComputerPlayerService', () => {
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  it('discovers UCI capabilities during initialization (Skill Level supported, no fake Elo)', async () => {
    const worker = new FakeWorker((cmd, emit) => {
      if (cmd === 'uci') {
        emit('id name Stockfish WASM');
        emit('option name Threads type spin default 1 min 1 max 1');
        emit('option name Skill Level type spin default 20 min 0 max 20');
        emit('option name Contempt type spin default 24 min -100 max 100');
        emit('uciok');
        return;
      }
      if (cmd === 'isready') {
        emit('readyok');
      }
    });

    const service = new ComputerPlayerService({
      workerFactory: () => worker,
    });

    await service.ensureReady();

    const caps = service.getCapabilities();
    expect(caps).not.toBeNull();
    expect(caps?.engineName).toBe('Stockfish WASM');
    expect(caps?.hasSkillLevel).toBe(true);
    expect(caps?.skillLevelMin).toBe(0);
    expect(caps?.skillLevelMax).toBe(20);
    expect(caps?.hasLimitStrength).toBe(false);
    expect(caps?.hasElo).toBe(false);

    service.dispose();
  });

  it('configures difficulty levels with verified depth, movetime, and skill levels', () => {
    const difficulties: ComputerDifficulty[] = ['beginner', 'easy', 'medium', 'hard', 'expert'];
    let prevDepth = 0;
    let prevSkill = -1;

    for (const diff of difficulties) {
      const config = DIFFICULTY_CONFIGS[diff];
      expect(config).toBeDefined();
      expect(config.depth).toBeGreaterThan(prevDepth);
      expect(config.skillLevel).toBeGreaterThan(prevSkill);
      expect(config.moveTimeMs).toBeGreaterThan(0);
      expect(config.skillLevel).toBeLessThanOrEqual(20);
      prevDepth = config.depth;
      prevSkill = config.skillLevel;
    }
  });

  it('requests a move and parses UCI move correctly', async () => {
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
        emit('info depth 6 score cp 35 pv e2e4');
        emit('bestmove e2e4');
      }
    });

    const service = new ComputerPlayerService({
      workerFactory: () => worker,
    });

    const res = await service.requestMove(START_FEN, 'easy', 1);
    expect(res).toEqual({
      uci: 'e2e4',
      from: 'e2',
      to: 'e4',
      promotion: undefined,
    });

    // Verify engine commands sent
    expect(worker.sent).toContain('setoption name Contempt value 0');
    expect(worker.sent).toContain('setoption name Skill Level value 4');
    expect(worker.sent).toContain(`position fen ${START_FEN}`);
    expect(worker.sent).toContain('go depth 3 movetime 400');

    service.dispose();
  });

  it('handles promotion UCI moves (e.g. e7e8q)', async () => {
    const worker = new FakeWorker((cmd, emit) => {
      if (cmd === 'uci') {
        emit('id name Stockfish WASM');
        emit('uciok');
        return;
      }
      if (cmd === 'isready') {
        emit('readyok');
        return;
      }
      if (cmd.startsWith('go ')) {
        emit('bestmove e7e8q');
      }
    });

    const service = new ComputerPlayerService({
      workerFactory: () => worker,
    });

    const res = await service.requestMove('4k3/4P3/8/8/8/8/8/4K3 w - - 0 1', 'medium', 1);
    expect(res).toEqual({
      uci: 'e7e8q',
      from: 'e7',
      to: 'e8',
      promotion: 'q',
    });

    service.dispose();
  });

  it('rejects stale search results when cancelSearch is called', async () => {
    let capturedEmit: Emit | null = null;
    const worker = new FakeWorker((cmd, emit) => {
      if (cmd === 'uci') {
        emit('uciok');
        return;
      }
      if (cmd === 'isready') {
        emit('readyok');
        return;
      }
      if (cmd.startsWith('go ')) {
        // Delay response to allow cancellation test
        capturedEmit = emit;
      }
    });

    const service = new ComputerPlayerService({
      workerFactory: () => worker,
    });

    const movePromise = service.requestMove(START_FEN, 'medium', 1);

    // Cancel before bestmove is emitted
    service.cancelSearch();

    const res = await movePromise;
    expect(res).toBeNull();

    // Even if engine emits bestmove late, it is ignored
    if (capturedEmit) {
      (capturedEmit as Emit)('bestmove d2d4');
    }

    service.dispose();
  });

  it('prevents overlapping searches by cancelling previous search when a new one starts', async () => {
    const worker = new FakeWorker((cmd, emit) => {
      if (cmd === 'uci') {
        emit('uciok');
        return;
      }
      if (cmd === 'isready') {
        emit('readyok');
        return;
      }
      if (cmd.startsWith('go ')) {
        if (cmd.includes('depth 1')) {
          // Slow first search
          setTimeout(() => emit('bestmove a2a3'), 50);
        } else if (cmd.includes('depth 6')) {
          // Fast second search
          emit('bestmove e2e4');
        }
      }
    });

    const service = new ComputerPlayerService({
      workerFactory: () => worker,
    });

    const firstPromise = service.requestMove(START_FEN, 'beginner', 1);
    const secondPromise = service.requestMove(START_FEN, 'medium', 2);

    const [res1, res2] = await Promise.all([firstPromise, secondPromise]);

    expect(res1).toBeNull(); // First search was cancelled
    expect(res2?.uci).toBe('e2e4'); // Second search succeeded

    service.dispose();
  });

  it('handles worker initialization failure cleanly and can recover', async () => {
    let failInit = true;
    const worker = new FakeWorker((cmd, emit) => {
      if (cmd === 'uci') {
        if (failInit) {
          // Do not reply to uci to trigger timeout
          return;
        }
        emit('uciok');
        return;
      }
      if (cmd === 'isready') {
        emit('readyok');
        return;
      }
      if (cmd.startsWith('go ')) {
        emit('bestmove g1f3');
      }
    });

    const service = new ComputerPlayerService({
      workerFactory: () => worker,
      initTimeoutMs: 50, // Short timeout for test
    });

    // First attempt times out during init
    const res1 = await service.requestMove(START_FEN, 'easy', 1);
    expect(res1).toBeNull();

    // Now fix worker response and retry
    failInit = false;
    const res2 = await service.requestMove(START_FEN, 'easy', 2);
    expect(res2?.uci).toBe('g1f3');

    service.dispose();
  });
});
