import React from 'react';
import type { Square } from 'chess.js';
import { FILES, RANKS } from '../../utils/chess-helpers.js';

export interface ArrowAnnotation {
  from: Square;
  to: Square;
}

interface BoardAnnotationsProps {
  arrows: ArrowAnnotation[];
  markers: Set<Square>;
  flipped: boolean;
}

export const BoardAnnotations: React.FC<BoardAnnotationsProps> = React.memo(({
  arrows,
  markers,
  flipped,
}) => {
  const displayFiles = flipped ? [...FILES].reverse() : FILES;
  const displayRanks = flipped ? [...RANKS].reverse() : RANKS;

  const getSquareCenter = (square: Square): { x: number; y: number } => {
    const file = square[0] as typeof FILES[number];
    const rank = square[1] as typeof RANKS[number];
    const colIndex = displayFiles.indexOf(file);
    const rowIndex = displayRanks.indexOf(rank);

    // Coordinate in 0..100 percentage
    return {
      x: (colIndex + 0.5) * (100 / 8),
      y: (rowIndex + 0.5) * (100 / 8),
    };
  };

  return (
    <svg
      className="board-annotations-overlay"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="4"
          markerHeight="4"
          refX="2.5"
          refY="2"
          orient="auto"
        >
          <polygon points="0 0.5, 3.5 2, 0 3.5" fill="#f59e0b" opacity="0.88" />
        </marker>
        <marker
          id="arrowhead-ghost"
          markerWidth="4"
          markerHeight="4"
          refX="2.5"
          refY="2"
          orient="auto"
        >
          <polygon points="0 0.5, 3.5 2, 0 3.5" fill="#38bdf8" opacity="0.7" />
        </marker>
      </defs>

      {/* Square highlight markers */}
      {Array.from(markers).map((sq) => {
        const center = getSquareCenter(sq);
        const radius = (100 / 8) * 0.44;
        return (
          <circle
            key={`marker-${sq}`}
            cx={center.x}
            cy={center.y}
            r={radius}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="1.2"
            opacity="0.85"
          />
        );
      })}

      {/* Directional Arrows */}
      {arrows.map((arrow, i) => {
        const start = getSquareCenter(arrow.from);
        const end = getSquareCenter(arrow.to);

        // Slightly shorten end point so arrowhead doesn't overshoot piece center
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const shorten = Math.min(2.5, dist * 0.2);
        const targetX = end.x - (dx / dist) * shorten;
        const targetY = end.y - (dy / dist) * shorten;

        return (
          <line
            key={`arrow-${i}-${arrow.from}-${arrow.to}`}
            x1={start.x}
            y1={start.y}
            x2={targetX}
            y2={targetY}
            stroke="#f59e0b"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.88"
            markerEnd="url(#arrowhead)"
          />
        );
      })}
    </svg>
  );
});

BoardAnnotations.displayName = 'BoardAnnotations';
