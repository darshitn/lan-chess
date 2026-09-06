import React, { useEffect, useRef } from 'react';
import type { GameMove } from '../../shared/types.js';

interface MoveHistoryProps {
  moves: GameMove[];
}

export const MoveHistory: React.FC<MoveHistoryProps> = React.memo(({ moves }) => {
  const containerRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [moves.length]);

  // Pair moves into rounds: [moveNumber, whiteMove, blackMove]
  const rounds: Array<{ round: number; white: string; black?: string }> = [];
  for (let i = 0; i < moves.length; i += 2) {
    rounds.push({
      round: Math.floor(i / 2) + 1,
      white: moves[i].san,
      black: moves[i + 1]?.san,
    });
  }

  return (
    <div className="panel">
      <div className="flex items-center justify-between">
        <h2>Move History</h2>
        <span className="text-xs font-semibold text-slate-400">
          {moves.length} {moves.length === 1 ? 'move' : 'moves'}
        </span>
      </div>
      <ol ref={containerRef} className="move-list" aria-label="Game moves">
        {rounds.length === 0 ? (
          <li className="empty-history text-sm italic">No moves played yet.</li>
        ) : (
          rounds.map(({ round, white, black }) => (
            <li key={round} className="text-sm">
              <span className="font-mono font-bold text-slate-500">{round}.</span>
              <span className="font-mono font-medium text-slate-200">{white}</span>
              <span className="font-mono font-medium text-slate-300">{black ?? ''}</span>
            </li>
          ))
        )}
      </ol>
    </div>
  );
});

MoveHistory.displayName = 'MoveHistory';
