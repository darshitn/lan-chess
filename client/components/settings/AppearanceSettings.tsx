import React from 'react';
import type { BoardTheme, PieceSetId, UiThemeId, UserPreferences } from '../../types/preferences.js';
import { BUILTIN_BOARD_THEMES, getActiveBoardTheme, ONE_CLICK_PRESETS, resetAppearancePreferences } from '../../services/preferences.js';
import { ChessPiece, type PieceSymbol } from '../chess/ChessPiece.js';

export function BoardSample({ theme, pieceSet }: { theme: BoardTheme; pieceSet: PieceSetId }) {
  const pieces: (PieceSymbol | null)[] = ['r', null, 'k', null, null, 'n', null, 'p'];
  return <span className={`board-sample pieceset-${pieceSet}`} aria-hidden="true">
    {pieces.map((piece, index) => <span key={index} style={{ backgroundColor: (index + Math.floor(index / 4)) % 2 ? theme.darkSquare : theme.lightSquare }}>
      {piece && <ChessPiece type={piece} color={index < 4 ? 'b' : 'w'} pieceSet={pieceSet} />}
    </span>)}
  </span>;
}

const PIECES: Record<PieceSetId, string> = {
  classic: 'Staunton', modern: 'Modern', minimal: 'Minimal', glass: 'Glass',
  wood: 'Wood', neon: 'Neon', cyber: 'Cyber', silhouette: 'Silhouette',
};
const PALETTES: Record<UiThemeId, string> = {
  slate: 'Slate', ivory: 'Ivory', walnut: 'Walnut', dark: 'Tournament sage', royal: 'Royal lilac', light: 'Light',
  midnight: 'Midnight', oled: 'OLED black', glass: 'Frosted glass', cyber: 'Cyber neon',
};
const STYLES = ['classic', 'soft', 'bright', 'minimal', 'neon'] as const;
type Props = {
  preferences: UserPreferences;
  customThemes: BoardTheme[];
  onChange: (next: UserPreferences) => void;
  openBuilder: () => void;
};

export function AppearanceSettings({ preferences, customThemes, onChange, openBuilder }: Props) {
  const { activeThemeId, pieceSet, highlightStyle, uiTheme, boardSettings } = preferences;
  const theme = getActiveBoardTheme(activeThemeId, customThemes);
  const selectedPreset = ONE_CLICK_PRESETS.find(p => p.themeId === activeThemeId && p.pieceSet === pieceSet && p.highlightStyle === highlightStyle && p.uiTheme === uiTheme);
  const updateBoard = (patch: Partial<typeof boardSettings>) => onChange({ ...preferences, boardSettings: { ...boardSettings, ...patch } });
  return <div className="setting-stack">
    <section>
      <div className="setting-heading">
        <div><h3>Current Appearance</h3><p>{selectedPreset ? selectedPreset.name + ' preset' : theme.name + ' · Custom combination'}</p></div>
        <button type="button" className="setting-link" onClick={() => onChange(resetAppearancePreferences(preferences))}>Reset appearance</button>
      </div>
      <div className="preset-gallery" aria-label="Appearance presets">
        {ONE_CLICK_PRESETS.map(p => <button type="button" key={p.id} className="preset-tile" aria-pressed={selectedPreset?.id === p.id}
          onClick={() => onChange({ ...preferences, activeThemeId: p.themeId, pieceSet: p.pieceSet, highlightStyle: p.highlightStyle, uiTheme: p.uiTheme })}>
          <BoardSample theme={getActiveBoardTheme(p.themeId)} pieceSet={p.pieceSet} />
          <span className="preset-name">{p.name}<span aria-hidden="true" className="selection-mark">✓</span></span>
        </button>)}
      </div>
    </section>
    <details className="setting-fold"><summary>Board colors <span>{theme.name}</span></summary>
      <div className="swatch-list">{[...BUILTIN_BOARD_THEMES, ...customThemes].map(board => <button type="button" key={board.id}
        aria-pressed={activeThemeId === board.id} onClick={() => onChange({ ...preferences, activeThemeId: board.id })}>
        <span className="square-pair" aria-hidden="true" style={{backgroundImage: `conic-gradient(${board.darkSquare} 25%, ${board.lightSquare} 0 50%, ${board.darkSquare} 0 75%, ${board.lightSquare} 0)`}}/>
        {board.name}</button>)}</div>
      <button type="button" className="setting-link" onClick={openBuilder}>Create a custom board</button>
    </details>
    <details className="setting-fold"><summary>Pieces <span>{PIECES[pieceSet]}</span></summary>
      <figure className="piece-study" aria-label={PIECES[pieceSet] + ' pieces on the ' + theme.name + ' board'}>
        {(['k', 'q', 'r', 'b', 'n', 'p'] as const).map((type, column) => (
          <div key={type}>
            {(['w', 'b'] as const).map((color, row) => (
              <span key={color} style={{ backgroundColor: (row + column) % 2 ? theme.darkSquare : theme.lightSquare }}>
                <ChessPiece type={type} color={color} pieceSet={pieceSet} style={{ transform: 'scale(' + boardSettings.pieceScale + ')' }} />
              </span>
            ))}
          </div>
        ))}
      </figure>
      <div className="piece-list">{(Object.keys(PIECES) as PieceSetId[]).map(set => <button type="button" key={set} aria-pressed={pieceSet === set}
        onClick={() => onChange({ ...preferences, pieceSet: set })}>
        <span className={`piece-pair pieceset-${set}`} aria-hidden="true"><ChessPiece type="k" color="w" pieceSet={set}/><ChessPiece type="n" color="b" pieceSet={set}/></span>
        {PIECES[set]}</button>)}</div>
      <label className="setting-row">Piece size <output>{Math.round(boardSettings.pieceScale * 100)}%</output>
        <input type="range" min="80" max="120" step="5" value={Math.round(boardSettings.pieceScale*100)} onChange={e=>updateBoard({pieceScale:Number(e.target.value)/100})}/>
      </label>
    </details>
    <details className="setting-fold"><summary>Interface & highlights <span>{PALETTES[uiTheme]}</span></summary>
      <label className="setting-row">Interface palette<select value={uiTheme} onChange={e => onChange({...preferences, uiTheme: e.target.value as UiThemeId})}>
        {(Object.keys(PALETTES) as UiThemeId[]).map(id => <option key={id} value={id}>{PALETTES[id]}</option>)}
      </select></label>
      <label className="setting-row">Move highlights<select value={highlightStyle} onChange={e => onChange({...preferences, highlightStyle: e.target.value as typeof highlightStyle})}>
        {STYLES.map(style => <option key={style} value={style}>{style[0].toUpperCase()+style.slice(1)}</option>)}
      </select></label>
    </details>
    <details className="setting-fold"><summary>Board display</summary>
      <label className="setting-row">Coordinates<input type="checkbox" checked={boardSettings.coordinates} onChange={e => updateBoard({coordinates:e.target.checked})}/></label>
      <label className="setting-row">Coordinate style<select disabled={!boardSettings.coordinates} value={boardSettings.coordinateStyle} onChange={e=>updateBoard({coordinateStyle:e.target.value as typeof boardSettings.coordinateStyle})}>
        <option value="inside">Inside</option><option value="outside">Outside</option><option value="small">Small</option><option value="large">Large</option>
      </select></label>
      {([['boardBorder','Board frame'],['boardShadow','Board shadow'],['roundedCorners','Rounded corners']] as const).map(([key,label])=><label className="setting-row" key={key}>{label}
        <input type="checkbox" checked={boardSettings[key]} onChange={e=>updateBoard({[key]:e.target.checked})}/></label>)}
    </details>
  </div>;
}
