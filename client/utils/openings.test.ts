import { describe, expect, it } from 'vitest';
import { identifyOpening, isKnownBookSequence } from './openings.js';

describe('identifyOpening', () => {
  it('returns null for empty moves', () => {
    expect(identifyOpening([])).toBeNull();
  });

  it('identifies Ruy Lopez correctly', () => {
    const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'];
    const result = identifyOpening(moves);
    expect(result).not.toBeNull();
    expect(result?.name).toBe('Ruy Lopez');
    expect(result?.eco).toBe('C60');
  });

  it('identifies Italian Game: Giuoco Piano', () => {
    const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'];
    const result = identifyOpening(moves);
    expect(result).not.toBeNull();
    expect(result?.name).toBe('Italian Game');
    expect(result?.variation).toBe('Giuoco Piano');
  });

  it('identifies Sicilian Defense: Najdorf Variation', () => {
    const moves = ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'];
    const result = identifyOpening(moves);
    expect(result).not.toBeNull();
    expect(result?.name).toBe('Sicilian Defense');
    expect(result?.variation).toBe('Najdorf');
  });

  it('identifies Queen Gambit correctly', () => {
    const moves = ['d4', 'd5', 'c4'];
    const result = identifyOpening(moves);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Queen's Gambit");
  });
});

describe('isKnownBookSequence', () => {
  it('recognizes the common first moves as book', () => {
    expect(isKnownBookSequence(['e4'])).toBe(true);
    expect(isKnownBookSequence(['d4'])).toBe(true);
    expect(isKnownBookSequence(['Nf3'])).toBe(true);
    expect(isKnownBookSequence(['c4'])).toBe(true);
  });

  it('recognizes full database lines and their prefixes', () => {
    expect(isKnownBookSequence(['e4', 'e5'])).toBe(true);
    expect(isKnownBookSequence(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'])).toBe(true);
    expect(isKnownBookSequence(['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'])).toBe(true);
  });

  it('rejects moves that leave every known opening line', () => {
    expect(isKnownBookSequence(['a3'])).toBe(false);
    expect(isKnownBookSequence(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6'])).toBe(false);
    expect(isKnownBookSequence(['e4', 'e5', 'Qh5'])).toBe(false);
  });

  it('returns false for an empty sequence', () => {
    expect(isKnownBookSequence([])).toBe(false);
  });
});
