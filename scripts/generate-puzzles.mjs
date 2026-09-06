/**
 * Builds the bundled puzzle library from the official Lichess puzzle database
 * (CC0 / public domain): https://database.lichess.org/
 *
 * Usage:
 *   1. Download https://database.lichess.org/lichess_db_puzzle.csv.zst
 *   2. Decompress: zstd -d lichess_db_puzzle.csv.zst
 *   3. node scripts/generate-puzzles.mjs <path-to-lichess_db_puzzle.csv>
 *
 * Writes public/puzzles/lichess-puzzles.json with a curated, chess.js-validated
 * slice: every puzzle is replayed move by move before it is accepted.
 *
 * Lichess CSV columns:
 *   PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
 * The FEN is the position BEFORE the opponent's setup move; Moves[0] (UCI) is
 * that setup move, then solver and opponent alternate. We emit the position
 * AFTER the setup move (solver to move) with the solution in SAN.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { createReadStream } from 'node:fs';
import { Chess } from 'chess.js';
import path from 'node:path';

const input = process.argv[2] ?? '.puzzle-build/lichess_db_puzzle.csv';
const OUT_DIR = path.resolve('public/puzzles');
const OUT_FILE = path.join(OUT_DIR, 'lichess-puzzles.json');

// Lichess theme lists often start with positional descriptors; prefer the
// tactical motif for display.
const GENERIC_THEMES = new Set(['long', 'short', 'veryShort', 'oneMove', 'normal', 'middlegame', 'endgame', 'opening']);
function pickPrimaryTheme(themes) {
  const mate = themes.find((t) => /mate/i.test(t));
  if (mate) return mate;
  const tactical = themes.find((t) => !GENERIC_THEMES.has(t));
  return tactical ?? themes[0] ?? 'tactic';
}

const FILTER = {
  minRating: 900,
  maxRating: 1900,
  minPopularity: 85, // 0-100
  minPlays: 50,
  maxSolverMoves: 3,
  perRatingBucket: 120, // 100-rating-wide buckets
};

function toSanList(fen, uciMoves) {
  // Replays the full UCI sequence and returns { san, solverSans, replies, finalFen }
  const chess = new Chess(fen);
  const san = [];
  for (const uci of uciMoves) {
    const move = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length >= 5 ? uci[4] : undefined,
    });
    if (!move) throw new Error(`illegal move ${uci}`);
    san.push(move.san);
  }
  // Moves[0] is the opponent's setup move; odd indices are the solver's.
  const solverSans = san.filter((_, i) => i % 2 === 1);
  const replies = san.filter((_, i) => i % 2 === 0 && i > 0);
  return { solverSans, replies, finalFen: chess.fen() };
}

function positionAfterSetup(fen, setupUci) {
  const chess = new Chess(fen);
  const move = chess.move({
    from: setupUci.slice(0, 2),
    to: setupUci.slice(2, 4),
    promotion: setupUci.length >= 5 ? setupUci[4] : undefined,
  });
  if (!move) throw new Error(`illegal setup move ${setupUci}`);
  return chess.fen();
}

const buckets = new Map(); // ratingBucket -> rows
let total = 0;
let accepted = 0;
let rejected = 0;

const rl = createInterface({ input: createReadStream(input), crlfDelay: Infinity });

let first = true;
for await (const line of rl) {
  if (first) {
    first = false; // header
    continue;
  }
  total++;
  if (total % 500_000 === 0) {
    console.log(`  scanned ${total} rows, accepted ${accepted}...`);
  }
  const cols = line.split(',');
  if (cols.length < 9) continue;
  const [, fen, movesUci, ratingStr, ratingDevStr, popularityStr, nbPlaysStr, themesStr] = cols;
  const rating = Number(ratingStr);
  const ratingDev = Number(ratingDevStr);
  const popularity = Number(popularityStr);
  const nbPlays = Number(nbPlaysStr);

  if (rating < FILTER.minRating || rating > FILTER.maxRating) continue;
  if (ratingDev > 150) continue;
  if (popularity < FILTER.minPopularity || nbPlays < FILTER.minPlays) continue;

  const uciMoves = movesUci.split(' ');
  const solverMoveCount = Math.floor((uciMoves.length - 1 + 1) / 2); // excluding setup move
  if (solverMoveCount < 1 || solverMoveCount > FILTER.maxSolverMoves) continue;

  const themes = themesStr.split(' ');
  // Material-gain puzzles with quiet solutions are confusing to present;
  // require the final solver move to be decisive (mate or capture) OR a
  // clearly tactical theme set. Keep it simple: require the last solver move
  // to be a capture or mate, which reads well in a tactics trainer.
  try {
    const { solverSans, replies } = toSanList(fen, uciMoves);
    if (solverSans.some((s) => /[a-h]8=[rbn]/i.test(s))) continue; // skip underpromotions (trainer auto-queens)
    const last = solverSans[solverSans.length - 1];
    if (!last.includes('#') && !last.includes('x')) continue;

    const solverFen = positionAfterSetup(fen, uciMoves[0]);
    const bucket = Math.floor(rating / 100) * 100;
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    const list = buckets.get(bucket);
    if (list.length >= FILTER.perRatingBucket) continue;
    list.push({
      id: `lich-${cols[0]}`,
      title: `${pickPrimaryTheme(themes)} · ${rating}`,
      theme: pickPrimaryTheme(themes),
      fen: solverFen,
      moves: solverSans,
      replies,
      rating,
      themes: themes.slice(0, 4),
    });
    accepted++;
  } catch {
    rejected++;
  }
}

const puzzles = [...buckets.keys()]
  .sort((a, b) => a - b)
  .flatMap((bucket) => buckets.get(bucket));

console.log(`scanned ${total} rows -> accepted ${accepted} (rejected ${rejected} malformed)`);
console.log(`emitting ${puzzles.length} puzzles across ${buckets.size} rating buckets`);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, JSON.stringify(puzzles));
console.log(`wrote ${OUT_FILE} (${Math.round(readFileSync(OUT_FILE).length / 1024)} KB)`);
