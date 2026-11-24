import React, { useState } from 'react';
import { Chess } from 'chess.js';
import { ChessPiece } from './chess/ChessPiece.js';
import { BUILTIN_BOARD_THEMES } from '../services/preferences.js';
import type { BoardTheme, PieceSetId } from '../types/preferences.js';

const line = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'];
const game = new Chess();
const pieces = game.board().flat().flatMap(piece => piece ? [{ ...piece, id: piece.square }] : []);
const frames = [pieces];
for (const san of line) {
  const move = game.move(san);
  frames.push(frames[frames.length - 1].map(piece =>
    piece.square === move.from ? { ...piece, square: move.to } : piece
  ));
}

const finishes = [
  { board: 'sea-glass', pieces: 'glass' },
  { board: 'walnut', pieces: 'wood' },
] as const;

export function LobbyBoard({theme, pieceSet, flipped, onCustomize}: {
  theme: BoardTheme;
  pieceSet: PieceSetId;
  flipped: boolean;
  onCustomize: () => void;
}) {
  const [ply, setPly] = useState(5);
  const [finish, setFinish] = useState('saved');
  const selected = finishes.find(item => item.board === finish);
  const board = BUILTIN_BOARD_THEMES.find(item => item.id === selected?.board) ?? theme;
  const set = selected?.pieces ?? pieceSet;
  return (
    <figure className="opening-study">
      <div className="study-heading"><h2>The Italian Game</h2><button type="button" onClick={onCustomize}>Customize</button></div>
      <div className="study-frame">
        <div className={'study-diagram pieceset-' + set} role="img" aria-label={'Italian Game opening, ' + (ply ? 'after ' + line[ply - 1] : 'starting position') + ', ' + (flipped ? 'Black' : 'White') + ' perspective'}>
          {Array.from({length:64}, (_, i) => {
            const col = i % 8, row = Math.floor(i / 8);
            const light = (row + col) % 2 === 0;
            return <span className="study-square" key={i} style={{background: light ? board.lightSquare : board.darkSquare, color: light ? board.darkSquare : board.lightSquare}}>
              {col === 0 && <b>{flipped ? row + 1 : 8 - row}</b>}
              {row === 7 && <i>{'abcdefgh'[flipped ? 7 - col : col]}</i>}
            </span>;
          })}
          {frames[ply].map(piece => {
            const file = piece.square.charCodeAt(0) - 97;
            const rank = Number(piece.square[1]) - 1;
            return <span className="study-piece" key={piece.id} style={{transform: 'translate(' + (flipped ? 7-file : file)*100 + '%, ' + (flipped ? rank : 7-rank)*100 + '%)'}}>
              <ChessPiece type={piece.type} color={piece.color} pieceSet={set} />
            </span>;
          })}
        </div>
        <div className="study-line" aria-label="Explore the opening">
          <button type="button" aria-label="Starting position" aria-pressed={ply===0} onClick={()=>setPly(0)}>Start</button>
          {line.map((san,i)=><button type="button" key={i} aria-pressed={ply===i+1} aria-label={'Preview move ' + (i+1) + ', ' + san} onClick={()=>setPly(i+1)}>{i%2===0 && <small>{Math.floor(i/2)+1}.</small>}{san}</button>)}
        </div>
      </div>
      <figcaption>
        <span>Preview finish</span>
        <div className="study-finishes">{[{id:'saved',name:'Yours',color:theme.darkSquare}, ...finishes.map(f=>{
          const t=BUILTIN_BOARD_THEMES.find(item=>item.id===f.board)!;
          return {id:t.id,name:t.name,color:t.darkSquare};
        })].map(f=><button key={f.id} type="button" aria-pressed={finish===f.id} onClick={()=>setFinish(f.id)}><i style={{background:f.color}}/>{f.name}</button>)}</div>
      </figcaption>
    </figure>
  );
}
