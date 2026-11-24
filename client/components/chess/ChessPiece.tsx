import React from 'react';
import { GlassPiece } from './GlassPiece.js';
import type { PlayerColor } from '../../../shared/types.js';
import type { PieceSetId } from '../../types/preferences.js';

export type PieceSymbol = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export interface ChessPieceProps {
  type: PieceSymbol;
  color: PlayerColor;
  pieceSet?: PieceSetId;
  className?: string;
  style?: React.CSSProperties;
}

// Cut silhouettes leave a clear profile at phone-board sizes. Each piece has
// a separate outline so the geometric sets also work without color cues.
const geometricProfiles: Record<PieceSymbol, string> = {
  p: 'M12 37h21l-2-5-5-3-1-8a6 6 0 1 0-5 0l-1 8-5 3z',
  n: 'M9 37h28l-2-12-2-10-7-8-5-2 1 6-7 2-8 10 5 5 9-6-2 8-7 3z',
  b: 'M10 37h25l-2-5-7-3-1-6c7-5 5-11-1-16l-2-3-3 6 4 6-2 2-4-5c-5 7-2 10 2 12l-2 5-5 2z',
  r: 'M9 37h27l-2-5-5-2-1-13 5-4V6h-5v5h-4V6h-4v5h-4V6h-5v7l5 4-1 13-4 2z',
  q: 'M8 37h29l-2-5-4-2 5-19-9 8-5-13-5 13-9-8 5 19-3 2z',
  k: 'M10 37h25l-2-5-5-3 1-9 4-7-8 2V9h4V6h-4V2h-4v4h-4v3h4v6l-8-2 4 7 1 9-6 3z',
};

export const PIECE_UNICODE_FALLBACK: Record<PlayerColor, Record<PieceSymbol, string>> = {
  w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
  b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' },
};

/**
 * Staunton Vector SVG pieces tailored for LAN Chess.
 * Based on Cburnett's classic Staunton vector set (CC BY-SA 3.0 / GPL).
 * Filled ivory white pieces with crisp dark outlines;
 * filled charcoal black pieces with crisp contrasting edge highlights.
 */
export const ChessPiece: React.FC<ChessPieceProps> = React.memo(({
  type,
  color,
  pieceSet = 'classic',
  className = '',
  style,
}) => {
  const isWhite = color === 'w';

  // If piece set is legacy silhouette, render high-contrast silhouette
  // If piece set is modern/minimal/glass/wood/neon/cyber, we can style the SVG with classes
  const colorClass = isWhite ? 'piece-svg-w' : 'piece-svg-b';
  const combinedClass = `chess-piece-svg ${colorClass} pieceset-piece-${pieceSet} ${className}`.trim();

  if (pieceSet === 'glass') {
    return <GlassPiece type={type} color={color} className={combinedClass} style={style} />;
  }

  if (pieceSet === 'modern' || pieceSet === 'minimal' || pieceSet === 'silhouette' || pieceSet === 'cyber') {
    return (
      <svg viewBox="0 0 45 45" className={combinedClass} style={style} aria-hidden="true" focusable="false">
        <path d={geometricProfiles[type]} className="piece-profile" strokeLinejoin={pieceSet === 'minimal' ? 'round' : 'miter'} />
        {(pieceSet === 'modern' || pieceSet === 'cyber') && (
          <path d="M14 32h17" className="piece-engraving" fill="none" strokeWidth="1.7" />
        )}
      </svg>
    );
  }

  switch (type) {
    case 'k':
      return isWhite ? (
        <svg viewBox="0 0 45 45" className={combinedClass} style={style} aria-hidden="true" focusable="false">
          <g fill="none" fillRule="evenodd" stroke="#1c1917" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22.5 11.63V6M20 8h5" strokeLinejoin="miter" />
            <path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" fill="#fdfbf7" strokeLinecap="butt" strokeLinejoin="miter" />
            <path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V23.5c-2.5-7.5-12-10.5-16-4-3 6 6 10.5 6 10.5v7" fill="#fdfbf7" />
            <path d="M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0" />
          </g>
        </svg>
      ) : (
        <svg viewBox="0 0 45 45" className={combinedClass} style={style} aria-hidden="true" focusable="false">
          <g fill="none" fillRule="evenodd" stroke="#18181b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22.5 11.63V6" strokeLinejoin="miter" />
            <path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" fill="#262629" strokeLinecap="butt" strokeLinejoin="miter" />
            <path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V23.5c-2.5-7.5-12-10.5-16-4-3 6 6 10.5 6 10.5v7" fill="#262629" />
            <path d="M20 8h5" strokeLinejoin="miter" />
            <path d="M32 29.5c.5 0 1 .5 1 1s-.5 1-1 1-1-.5-1-1 .5-1 1-1m-19 0c.5 0 1 .5 1 1s-.5 1-1 1-1-.5-1-1 .5-1 1-1" fill="#f4f4f5" stroke="#f4f4f5" />
            <path d="M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0" stroke="#f4f4f5" />
          </g>
        </svg>
      );

    case 'q':
      return isWhite ? (
        <svg viewBox="0 0 45 45" className={combinedClass} style={style} aria-hidden="true" focusable="false">
          <g fill="#fdfbf7" fillRule="evenodd" stroke="#1c1917" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zm16.5-4.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM41 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zm-25 1a2 2 0 1 1-4 0 2 2 0 1 1 4 0zm14 0a2 2 0 1 1-4 0 2 2 0 1 1 4 0z" stroke="none" />
            <path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-14V25L7 14l2 12z" strokeLinecap="butt" />
            <path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 2-1 .5-2.5 0 0 0-1.5-1.5-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" strokeLinecap="butt" />
            <path d="M11 38.5a35 35 1 0 0 23 0" fill="none" strokeLinecap="butt" />
            <path d="M11 29a35 35 1 0 1 23 0m-21.5 2.5h20m-21 3a35 35 1 0 0 22 0m-23 3a35 35 1 0 0 24 0" fill="none" />
          </g>
        </svg>
      ) : (
        <svg viewBox="0 0 45 45" className={combinedClass} style={style} aria-hidden="true" focusable="false">
          <g fill="#262629" fillRule="evenodd" stroke="#18181b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zm16.5-4.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM41 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zm-25 1a2 2 0 1 1-4 0 2 2 0 1 1 4 0zm14 0a2 2 0 1 1-4 0 2 2 0 1 1 4 0z" stroke="none" />
            <path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-14V25L7 14l2 12z" strokeLinecap="butt" />
            <path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 2-1 .5-2.5 0 0 0-1.5-1.5-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" strokeLinecap="butt" />
            <path d="M11.5 30c3.5-1 18.5-1 22 0m-21.5 3.5c4-1 15.5-1 21 0m-21 3a35 35 1 0 0 21 0" fill="none" stroke="#f4f4f5" />
          </g>
        </svg>
      );

    case 'r':
      return isWhite ? (
        <svg viewBox="0 0 45 45" className={combinedClass} style={style} aria-hidden="true" focusable="false">
          <g fill="#fdfbf7" fillRule="evenodd" stroke="#1c1917" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 39h27v-3H9v3zm3-3v-4.5h21V36H12zm2-4.5v-10h17v10H14zm-3-10V11h23v10.5H11z" strokeLinecap="butt" />
            <path d="M14 29.5v-13h17v13H14z" strokeLinecap="butt" strokeLinejoin="miter" />
            <path d="M14 16.5h17m-17 4h17m-17 4h17m-17 4h17" fill="none" strokeLinejoin="miter" />
            <path d="M11 14h23M9 11h27v-3h-3v2h-4V8h-3v2h-4V8h-3v2h-4V8H9v3z" strokeLinecap="butt" />
            <path d="M12 35.5h21m-20-4h19m-18-2.5h17m-17-7.5h17" fill="none" />
          </g>
        </svg>
      ) : (
        <svg viewBox="0 0 45 45" className={combinedClass} style={style} aria-hidden="true" focusable="false">
          <g fill="#262629" fillRule="evenodd" stroke="#18181b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 39h27v-3H9v3zm3.5-7 1.5-17.5h17l1.5 17.5h-20zm-.5 4v-4h21v4H12z" strokeLinecap="butt" />
            <path d="M14 29.5v-13h17v13H14z" strokeLinecap="butt" strokeLinejoin="miter" />
            <path d="M14 16.5h17m-17 4h17m-17 4h17m-17 4h17" fill="none" stroke="#f4f4f5" strokeLinejoin="miter" />
            <path d="M11 14h23M9 11h27v-3h-3v2h-4V8h-3v2h-4V8h-3v2h-4V8H9v3z" strokeLinecap="butt" />
            <path d="M12 35.5h21m-20-4h19m-17-15h15" fill="none" stroke="#f4f4f5" />
          </g>
        </svg>
      );

    case 'b':
      return isWhite ? (
        <svg viewBox="0 0 45 45" className={combinedClass} style={style} aria-hidden="true" focusable="false">
          <g fill="none" fillRule="evenodd" stroke="#1c1917" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <g fill="#fdfbf7" strokeLinecap="butt">
              <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.35.49-2.32.47-3-.5 1.35-1.94 3-2 3-2z" />
              <path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z" />
              <path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z" />
            </g>
            <path d="M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5" strokeLinejoin="miter" />
          </g>
        </svg>
      ) : (
        <svg viewBox="0 0 45 45" className={combinedClass} style={style} aria-hidden="true" focusable="false">
          <g fill="none" fillRule="evenodd" stroke="#18181b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <g fill="#262629" strokeLinecap="butt">
              <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.35.49-2.32.47-3-.5 1.35-1.94 3-2 3-2z" />
              <path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z" />
              <path d="M25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z" />
            </g>
            <path d="M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5" stroke="#f4f4f5" strokeLinejoin="miter" />
          </g>
        </svg>
      );

    case 'n':
      return (
        <svg viewBox="0 0 45 45" className={combinedClass} style={style} aria-hidden="true" focusable="false">
          <g stroke={isWhite ? '#1c1917' : '#18181b'} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
            <path fill={isWhite ? '#fdfbf7' : '#262629'}
              d="M9 36c.8-5.4 4-9 8.4-12.1l3.2-3.8-6.1 3.7-2.3-.4-3.7 1.3-3.1-3.6 7-9.1 4.8-3.4.6-5.1 3.7 3.8 3.2-3.1.7 4.8c8.3 5.2 10.8 15.3 10.8 27z" />
            <path d="M25 11.3c4.3 4.1 6.7 11 7.2 18.1M13.6 15.4l2.4-1.6M8.5 21.1l1.4-1"
              stroke={isWhite ? '#38352c' : '#e2e0da'} fill="none" />
            <path d="M9 35.4h26.5l2.2 3.7H7.1z" fill={isWhite ? '#fdfbf7' : '#262629'} />
          </g>
        </svg>
      );

    case 'p':
    default:
      return isWhite ? (
        <svg viewBox="0 0 45 45" className={combinedClass} style={style} aria-hidden="true" focusable="false">
          <g fill="#fdfbf7" fillRule="evenodd" stroke="#1c1917" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38-1.95 1.12-3.28 3.21-3.28 5.62 0 2.03.93 3.84 2.38 5.03-3.03 1.3-5.38 4.15-5.88 7.97h21c-.5-3.82-2.85-6.67-5.88-7.97 1.45-1.19 2.38-3 2.38-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" />
          </g>
        </svg>
      ) : (
        <svg viewBox="0 0 45 45" className={combinedClass} style={style} aria-hidden="true" focusable="false">
          <g fill="#262629" fillRule="evenodd" stroke="#18181b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38-1.95 1.12-3.28 3.21-3.28 5.62 0 2.03.93 3.84 2.38 5.03-3.03 1.3-5.38 4.15-5.88 7.97h21c-.5-3.82-2.85-6.67-5.88-7.97 1.45-1.19 2.38-3 2.38-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" />
          </g>
        </svg>
      );
  }
});

ChessPiece.displayName = 'ChessPiece';
