import React, { useRef, useState } from 'react';
import type { BoardTheme, PieceSetId } from '../../types/preferences.js';
import { ChessPiece } from '../chess/ChessPiece.js';

interface CustomBoardBuilderProps {
  customThemes: BoardTheme[];
  pieceSet: PieceSetId;
  activeThemeId: string;
  onSaveTheme: (theme: BoardTheme) => void;
  onDeleteTheme: (themeId: string) => void;
  onSelectTheme: (themeId: string) => void;
}

const defaults = {
  name: 'My custom board', lightSquare: '#ebecd0', darkSquare: '#739552',
  selectedSquare: '#a9d0a6', lastMoveSquare: '#a7bc95', legalMoveColor: 'rgba(0, 0, 0, 0.28)',
  checkSquare: '#e55c57', checkmateSquare: '#cc2929',
};
const colors = [
  ['lightSquare','Light squares'], ['darkSquare','Dark squares'], ['selectedSquare','Selection'],
  ['lastMoveSquare','Last move'], ['legalMoveColor','Legal moves'], ['checkSquare','Check'], ['checkmateSquare','Checkmate'],
] as const;
const sixDigitHex = /^#[\da-f]{6}$/i;
function validColor(value: string) {
  if (/^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(value)) return true;
  const rgb = value.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0?\.\d+|[01](?:\.0+)?))?\s*\)$/i);
  return !!rgb && rgb.slice(1,4).every(channel => Number(channel) <= 255);
}
function pickerColor(value: string) {
  if (value.startsWith('#')) {
    const hex = value.length <= 5 ? '#' + [...value.slice(1)].map(c=>c+c).join('') : value;
    if (sixDigitHex.test(hex.slice(0,7))) return hex.slice(0,7);
  }
  const rgb = value.match(/^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/);
  return rgb ? '#' + rgb.slice(1,4).map(v => Math.min(255,Number(v)).toString(16).padStart(2,'0')).join('') : '#000000';
}
function luminance(value: string) {
  const hex = pickerColor(value);
  const rgb = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255)
    .map(c => c <= 0.04045 ? c/12.92 : ((c+0.055)/1.055)**2.4);
  return 0.2126*rgb[0] + 0.7152*rgb[1] + 0.0722*rgb[2];
}
function newThemeId() {
  return 'custom-' + (globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2));
}

export function CustomBoardBuilder({ customThemes, activeThemeId, pieceSet, onSaveTheme, onDeleteTheme, onSelectTheme }: CustomBoardBuilderProps) {
  const [draft, setDraft] = useState(defaults);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sample, setSample] = useState<'selectedSquare'|'lastMoveSquare'|'checkSquare'|'checkmateSquare'>('selectedSquare');
  const nameRef = useRef<HTMLInputElement>(null);
  const patch = (values: Partial<typeof defaults>) => {
    setDraft(current=>({...current,...values}));
    setError('');
    setMessage('');
  };
  const reset = () => {
    setEditingId(null); setDraft(defaults); setError(''); setMessage('');
  };
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const invalid = colors.find(([key])=>!validColor(draft[key].trim()));
    if (invalid) { setError(`Enter a valid hex or RGB color for ${invalid[1].toLowerCase()}.`); return; }
    const id = editingId ?? newThemeId();
    const theme = {...draft, name: draft.name.trim() || 'Custom board', id, isCustom: true};
    onSaveTheme(theme);
    setEditingId(id); setDraft(theme); setError(''); setMessage(`${theme.name} saved and applied.`);
  };
  const edit = (board: BoardTheme) => {
    setEditingId(board.id); setDraft(board); setError(''); setMessage('');
    nameRef.current?.focus();
  };
  const light = luminance(draft.lightSquare), dark = luminance(draft.darkSquare);
  const lowContrast = (Math.max(light,dark)+0.05)/(Math.min(light,dark)+0.05) < 1.35;
  return <div className="setting-stack">
    <div><h3>Custom board</h3><p>Mix square colors and move indicators, then save the board to this device.</p></div>
    <form onSubmit={save} className="builder-layout">
      <div className="builder-fields">
        <label className="setting-field">Board name<input ref={nameRef} className="field" maxLength={32} value={draft.name} onChange={e=>patch({name:e.target.value})}/></label>
        {colors.map(([key,label])=><div className="color-row" key={key}>
          <label htmlFor={'hex-'+key}>{label}</label>
          <div><input type="color" aria-label={label+' color picker'} value={pickerColor(draft[key])} onChange={e=>patch({[key]:e.target.value})}/>
            <input type="text" id={'hex-'+key} spellCheck={false} value={draft[key]} onChange={e=>patch({[key]:e.target.value})}/></div>
        </div>)}
      </div>
      <div className="builder-preview">
        <div className="builder-board" role="img" aria-label="Preview of your board colors and pieces">
          {Array.from({length:16},(_,i)=>{
            const marked = i===5;
            const bg = marked ? draft[sample] : (i+Math.floor(i/4))%2 ? draft.darkSquare : draft.lightSquare;
            return <span key={i} style={{backgroundColor:validColor(bg.trim()) ? bg : 'var(--surface-raised)'}}>
              {marked && <ChessPiece type={sample==='checkSquare' || sample==='checkmateSquare' ? 'k' : 'n'} color="w" pieceSet={pieceSet}/>}
              {i===3 && <ChessPiece type="k" color="b" pieceSet={pieceSet}/>}
              {i===13 && <ChessPiece type="p" color="w" pieceSet={pieceSet}/>}
              {i===11 && <i style={{backgroundColor:draft.legalMoveColor}}/>}
            </span>;
          })}
        </div>
        <label className="setting-field">Preview state<select value={sample} onChange={e=>setSample(e.target.value as typeof sample)}>
          <option value="selectedSquare">Selection</option><option value="lastMoveSquare">Last move</option>
          <option value="checkSquare">Check</option><option value="checkmateSquare">Checkmate</option>
        </select></label>
      </div>
      <div className="builder-actions">
        {lowContrast && <p>The two square colors are close in brightness. A lighter or darker shade will make the board easier to read.</p>}
        {error && <p role="alert">{error}</p>}
        <button type="submit" className="action-button action-primary">{editingId ? 'Save changes' : 'Save & apply board'}</button>
        <button type="button" className="setting-link" onClick={reset}>{editingId ? 'New board' : 'Reset colors'}</button>
        <p role="status">{message}</p>
      </div>
    </form>
    {customThemes.length>0 && <section><h4>Saved boards</h4>
      {customThemes.map(board=><div className="saved-board" key={board.id}>
        <b>{board.name}</b><div>
          <button type="button" aria-pressed={activeThemeId===board.id} onClick={()=>onSelectTheme(board.id)}>{activeThemeId===board.id ? 'Applied' : 'Apply'}</button>
          <button type="button" onClick={()=>edit(board)}>Edit</button>
          <button type="button" onClick={()=>{const copy={...board,id:newThemeId(),name:board.name+' (copy)'};onSaveTheme(copy);edit(copy);setMessage('Copy saved and applied.');}}>Copy</button>
          <button type="button" onClick={()=>{onDeleteTheme(board.id);if(editingId===board.id)reset();setMessage(board.name+' deleted.');}}>Delete</button>
        </div>
      </div>)}
    </section>}
  </div>;
}
