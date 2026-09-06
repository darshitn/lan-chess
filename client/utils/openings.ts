export interface OpeningInfo {
  eco: string;
  name: string;
  variation?: string;
}

interface OpeningEntry {
  moves: string[]; // SAN moves
  eco: string;
  name: string;
  variation?: string;
}

const OPENING_DATABASE: OpeningEntry[] = [
  // E4 Openings
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'], eco: 'C60', name: 'Ruy Lopez' },
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'], eco: 'C50', name: 'Italian Game', variation: 'Giuoco Piano' },
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'], eco: 'C55', name: 'Italian Game', variation: 'Two Knights Defense' },
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'], eco: 'C50', name: 'Italian Game' },
  { moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'], eco: 'C44', name: 'Scotch Game' },
  { moves: ['e4', 'e5', 'Nf3', 'Nf6'], eco: 'C42', name: "Petroff's Defense" },
  { moves: ['e4', 'e5', 'f4'], eco: 'C20', name: "King's Gambit" },
  { moves: ['e4', 'e5', 'Nc3'], eco: 'C25', name: 'Vienna Game' },
  { moves: ['e4', 'e5', 'd4'], eco: 'C21', name: 'Center Game' },
  { moves: ['e4', 'e5'], eco: 'C20', name: "King's Pawn Game" },

  // Sicilian
  { moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'], eco: 'B90', name: 'Sicilian Defense', variation: 'Najdorf' },
  { moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'g6'], eco: 'B70', name: 'Sicilian Defense', variation: 'Dragon' },
  { moves: ['e4', 'c5', 'Nf3', 'e6'], eco: 'B40', name: 'Sicilian Defense', variation: 'French' },
  { moves: ['e4', 'c5', 'c3'], eco: 'B22', name: 'Sicilian Defense', variation: 'Alapin' },
  { moves: ['e4', 'c5', 'Nc3'], eco: 'B23', name: 'Sicilian Defense', variation: 'Closed' },
  { moves: ['e4', 'c5'], eco: 'B20', name: 'Sicilian Defense' },

  // Other 1. e4 responses
  { moves: ['e4', 'e6', 'd4', 'd5'], eco: 'C00', name: 'French Defense' },
  { moves: ['e4', 'e6'], eco: 'C00', name: 'French Defense' },
  { moves: ['e4', 'c6', 'd4', 'd5'], eco: 'B10', name: 'Caro-Kann Defense' },
  { moves: ['e4', 'c6'], eco: 'B10', name: 'Caro-Kann Defense' },
  { moves: ['e4', 'd5'], eco: 'B01', name: 'Scandinavian Defense' },
  { moves: ['e4', 'd6'], eco: 'B07', name: 'Pirc Defense' },
  { moves: ['e4', 'Nf6'], eco: 'B02', name: "Alekhine's Defense" },
  { moves: ['e4'], eco: 'B00', name: "King's Pawn Opening" },

  // D4 Openings
  { moves: ['d4', 'd5', 'c4', 'e6'], eco: 'D30', name: "Queen's Gambit Declined" },
  { moves: ['d4', 'd5', 'c4', 'c6'], eco: 'D10', name: 'Slav Defense' },
  { moves: ['d4', 'd5', 'c4', 'dxc4'], eco: 'D20', name: "Queen's Gambit Accepted" },
  { moves: ['d4', 'd5', 'c4'], eco: 'D06', name: "Queen's Gambit" },
  { moves: ['d4', 'd5', 'Bf4'], eco: 'D02', name: 'London System' },
  { moves: ['d4', 'Nf6', 'Bf4'], eco: 'A48', name: 'London System' },
  { moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7'], eco: 'E60', name: "King's Indian Defense" },
  { moves: ['d4', 'Nf6', 'c4', 'g6'], eco: 'E60', name: "King's Indian Defense" },
  { moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'], eco: 'E20', name: 'Nimzo-Indian Defense' },
  { moves: ['d4', 'Nf6', 'c4', 'e6', 'Nf3', 'b6'], eco: 'E12', name: "Queen's Indian Defense" },
  { moves: ['d4', 'Nf6', 'c4', 'c5'], eco: 'A56', name: 'Benoni Defense' },
  { moves: ['d4', 'f5'], eco: 'A80', name: 'Dutch Defense' },
  { moves: ['d4', 'd5'], eco: 'D00', name: "Queen's Pawn Game" },
  { moves: ['d4'], eco: 'A40', name: "Queen's Pawn Opening" },

  // Flank Openings
  { moves: ['c4', 'e5'], eco: 'A20', name: 'English Opening', variation: 'King\'s English' },
  { moves: ['c4'], eco: 'A10', name: 'English Opening' },
  { moves: ['Nf3', 'd5', 'g3'], eco: 'A04', name: 'Réti Opening' },
  { moves: ['Nf3'], eco: 'A04', name: 'Zukertort Opening' },
  { moves: ['f4'], eco: 'A02', name: "Bird's Opening" },
  { moves: ['b3'], eco: 'A01', name: 'Nimzo-Larsen Attack' },
];

/**
 * Recognizes the chess opening based on the array of SAN moves played so far.
 * Finds the longest matching sequence in the database.
 */
export function identifyOpening(movesSan: string[]): OpeningInfo | null {
  if (!movesSan || movesSan.length === 0) return null;

  let bestMatch: OpeningEntry | null = null;

  for (const entry of OPENING_DATABASE) {
    if (entry.moves.length > movesSan.length) continue;

    let matches = true;
    for (let i = 0; i < entry.moves.length; i++) {
      if (entry.moves[i] !== movesSan[i]) {
        matches = false;
        break;
      }
    }

    if (matches) {
      if (!bestMatch || entry.moves.length > bestMatch.moves.length) {
        bestMatch = entry;
      }
    }
  }

  if (!bestMatch) return null;

  return {
    eco: bestMatch.eco,
    name: bestMatch.name,
    variation: bestMatch.variation,
  };
}

// Every prefix of every database line is a "book" position: the moves played so
// far still follow a known opening.
const BOOK_PREFIXES: ReadonlySet<string> = (() => {
  const prefixes = new Set<string>();
  for (const entry of OPENING_DATABASE) {
    for (let i = 1; i <= entry.moves.length; i++) {
      prefixes.add(entry.moves.slice(0, i).join(' '));
    }
  }
  return prefixes;
})();

/**
 * True when the SAN sequence played so far exactly follows a known opening
 * line from the database. Used for genuine book-move detection in game review
 * (as opposed to "anything in the first 6 plies").
 */
export function isKnownBookSequence(movesSan: string[]): boolean {
  if (!movesSan || movesSan.length === 0) return false;
  return BOOK_PREFIXES.has(movesSan.join(' '));
}
