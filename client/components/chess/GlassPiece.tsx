import { useId, type CSSProperties } from 'react';
import type { PlayerColor } from '../../../shared/types.js';
import type { PieceSymbol } from './ChessPiece.js';

// Each carving has its own shoulder, crown and cut line, with a common footing.
const carvings: Record<PieceSymbol, { body: string; cut: string }> = {
  p: {
    body: 'M14 34c1-3 5-6 5-11l-3-2 1-2h2a6 6 0 1 1 7 0h2l1 2-3 2c0 5 3 8 5 11z',
    cut: 'M18 21h9M19.5 14a3.5 3.5 0 0 1 3-3.6',
  },
  r: {
    body: 'M11 34l4-4 1-14-5-3V5h5v4h4V5h5v4h4V5h5v8l-5 3 1 14 4 4z',
    cut: 'M13 13h19M17 16h10M19 18l-1 11',
  },
  n: {
    body: 'M10 34c1-5 5-9 10-13l1-3-7 5-3-1-3 2-3-4 7-9 5-3 1-5 4 4 3-3 1 5c7 5 10 13 10 25z',
    cut: 'M25 12c4 4 6 11 7 17M13.8 14.3l2.4-1.4M8.6 19.8l1.2-.9',
  },
  b: {
    body: 'M11 34l6-5 2-5-4-3c-4-5 2-12 7.5-17l1.7 1.6-3.4 7.4 1.7 1.4 4-6.4c6 6 7 11 3 15l-3 2 2 5 5 5z',
    cut: 'M17 23q5.5 2 11 0M16 31q6.5 1.8 13 0',
  },
  q: {
    body: 'M10 34l5-5 1-5L9 10l8 6 1-11 5 10 5-10 1 11 8-6-7 14 1 5 4 5z',
    cut: 'M15 20q7.5 3 15 0M16 24q6.5 2 13 0M17 29h12',
  },
  k: {
    body: 'M10 34l6-5 1-6-4-5c-3-5 1-9 7-6l1 1V8h-4V5h4V2h3v3h4v3h-4v5l1-1c6-3 10 1 7 6l-4 5 1 6 6 5z',
    cut: 'M17 21q5.5 2 11 0M18 25h9M16 31h13',
  },
};

interface Props {
  type: PieceSymbol;
  color: PlayerColor;
  className: string;
  style?: CSSProperties;
}

export function GlassPiece({ type, color, className, style }: Props) {
  const id = useId();
  const white = color === 'w';
  const { body, cut } = carvings[type];
  const paint = `url(#${id})`;
  return (
    <svg viewBox="0 0 45 45" className={className} style={style} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id} x1="0%" y1="35%" x2="100%" y2="65%">
          <stop stopColor={white ? '#87afb7' : '#162836'} />
          <stop offset=".22" stopColor={white ? '#f7fffc' : '#4a7179'} />
          <stop offset=".43" stopColor={white ? '#e5f8f4' : '#264453'} />
          <stop offset=".46" stopColor={white ? '#bbdbdc' : '#142d3b'} />
          <stop offset=".8" stopColor={white ? '#b0d0d6' : '#142533'} />
          <stop offset="1" stopColor={white ? '#f4ffff' : '#52777e'} />
        </linearGradient>
      </defs>
      <g strokeLinejoin="round" strokeLinecap="round">
        <path d={body} fill={paint} stroke={white ? '#31505c' : '#a7c9cb'} strokeWidth="1.4" />
        <path d={cut} fill="none" stroke={white ? '#527a81' : '#97bfc4'} strokeWidth="1.15" />
        <path d="M11.5 33.8q11-2.6 22 0l2.7 4.3-1.2 1.2H10l-1.2-1.2z"
          fill={paint} stroke={white ? '#31505c' : '#a7c9cb'} strokeWidth="1.4" />
        <path d="M12.3 35.2q6-1.3 11.6-1.1" stroke={white ? '#fff' : '#bfdcda'} fill="none" />
      </g>
    </svg>
  );
}
