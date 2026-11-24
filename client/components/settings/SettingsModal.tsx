import React, { useEffect, useState } from 'react';
import type { BoardTheme, UserPreferences } from '../../types/preferences.js';
import { applyUiThemeToDom } from '../../services/preferences.js';
import { useModalBehavior } from '../../utils/modal-behavior.js';
import { invalidateSoundVolumeCache, playMoveSound } from '../../utils/sound.js';
import { CustomBoardBuilder } from '../themes/CustomBoardBuilder.js';
import { AppearanceSettings } from './AppearanceSettings.js';
import { UpdateSettings } from './UpdateSettings.js';
import './settings.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'appearance' | 'updates';
  preferences: UserPreferences;
  customThemes: BoardTheme[];
  onUpdatePreferences: (newPrefs: UserPreferences) => void;
  onSaveCustomTheme: (theme: BoardTheme) => void;
  onDeleteCustomTheme: (themeId: string) => void;
  isGameActive?: boolean;
}

const sections = {
  appearance: 'Appearance', builder: 'Custom board', sound: 'Sound',
  gameplay: 'Gameplay', analysis: 'Analysis', updates: 'Updates',
} as const;
type Section = keyof typeof sections;
const sectionIds = Object.keys(sections) as Section[];
const avatars = [['♟','Pawn'],['♞','Knight'],['♝','Bishop'],['♜','Rook'],['♛','Queen'],['♚','King']];

export function SettingsModal({ isOpen, onClose, initialTab='appearance', preferences, customThemes,
  onUpdatePreferences, onSaveCustomTheme, onDeleteCustomTheme, isGameActive=false }: SettingsModalProps) {
  const [section, setSection] = useState<Section>(initialTab);
  const modalRef = useModalBehavior(onClose, true, isOpen);
  useEffect(() => { if (isOpen) setSection(initialTab); }, [initialTab, isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [isOpen]);
  if (!isOpen) return null;
  const update = (next: UserPreferences) => {
    if (next.uiTheme !== preferences.uiTheme) applyUiThemeToDom(next.uiTheme);
    if (next.sound.volume !== preferences.sound.volume) invalidateSoundVolumeCache();
    onUpdatePreferences(next);
  };
  const sound = preferences.sound;
  const animation = preferences.animation;
  return <div className="settings-backdrop" onClick={onClose}>
    <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="settings-title" tabIndex={-1}
      className="settings-dialog" onClick={event => event.stopPropagation()}>
      <header className="settings-header"><h2 id="settings-title">Settings</h2>
        <button type="button" className="settings-close" aria-label="Close settings" onClick={onClose}>×</button>
      </header>
      <div className="settings-body">
        <nav className="settings-nav" aria-label="Settings sections">{sectionIds.map(id =>
          <button type="button" key={id} aria-current={section===id ? 'page' : undefined} onClick={()=>setSection(id)}>{sections[id]}</button>
        )}</nav>
        <label className="settings-mobile-nav">Section<select value={section} onChange={e=>setSection(e.target.value as Section)}>
          {sectionIds.map(id => <option key={id} value={id}>{sections[id]}</option>)}</select>
        </label>
        <div key={section} className="settings-pane" role="region" aria-label={sections[section]}>
          {section==='appearance' && <AppearanceSettings preferences={preferences} customThemes={customThemes} onChange={update} openBuilder={()=>setSection('builder')}/>}
          {section==='builder' && <CustomBoardBuilder customThemes={customThemes} pieceSet={preferences.pieceSet} activeThemeId={preferences.activeThemeId}
            onSaveTheme={onSaveCustomTheme} onDeleteTheme={onDeleteCustomTheme} onSelectTheme={id=>update({...preferences,activeThemeId:id})}/>}
          {section==='sound' && <section className="setting-stack"><h3>Sound</h3>
            <label className="setting-row">Game audio<input type="checkbox" checked={sound.master} onChange={e=>update({...preferences,sound:{...sound,master:e.target.checked}})}/></label>
            <label className="setting-row">Master volume <output>{Math.round(sound.volume*100)}%</output>
              <input type="range" disabled={!sound.master} min="0" max="100" value={Math.round(sound.volume*100)}
                onChange={e=>update({...preferences,sound:{...sound,volume:Number(e.target.value)/100}})}/></label>
            <fieldset className="setting-list" disabled={!sound.master}><legend>Sound cues</legend>
              {([['move','Moves'],['capture','Captures'],['check','Check'],['gameEnd','Game over']] as const).map(([key,label]) =>
                <label key={key} className="setting-row">{label}<input type="checkbox" checked={sound[key]} onChange={e=>update({...preferences,sound:{...sound,[key]:e.target.checked}})}/></label>)}
            </fieldset>
            <button type="button" className="action-button action-secondary" disabled={!sound.master || sound.volume===0} onClick={playMoveSound}>Preview move sound</button>
          </section>}
          {section==='gameplay' && <section className="setting-stack"><h3>Gameplay</h3>
            <label className="setting-row">Player name<input className="field" maxLength={24} type="text" value={preferences.playerName} onChange={e=>update({...preferences,playerName:e.target.value})}/></label>
            <fieldset className="setting-list"><legend>Profile piece</legend><div className="avatar-options">
              {avatars.map(([symbol,name])=><button type="button" key={symbol} aria-label={name} aria-pressed={preferences.avatar===symbol} onClick={()=>update({...preferences,avatar:symbol})}>{symbol}</button>)}
            </div></fieldset>
            <label className="setting-row">Board orientation<select value={preferences.preferredColor} onChange={e=>update({...preferences,preferredColor:e.target.value as UserPreferences['preferredColor']})}>
              <option value="random">My side</option><option value="w">White at bottom</option><option value="b">Black at bottom</option>
            </select></label>
            <label className="setting-row">Board animations<input type="checkbox" checked={animation.enabled} onChange={e=>update({...preferences,animation:{...animation,enabled:e.target.checked}})}/></label>
            <label className="setting-row">Animation speed<select disabled={!animation.enabled} value={animation.speed} onChange={e=>update({...preferences,animation:{...animation,speed:e.target.value as typeof animation.speed}})}>
              <option value="instant">Instant</option><option value="fast">Fast</option><option value="smooth">Smooth</option>
            </select></label>
          </section>}
          {section==='analysis' && <section className="setting-stack"><div><h3>Game analysis</h3><p>Choose how far the offline Stockfish engine searches when you open a new game review.</p></div>
            <label className="setting-row">Default search depth<select value={preferences.analysisDepth} onChange={e=>update({...preferences,analysisDepth:Number(e.target.value) as UserPreferences['analysisDepth']})}>
              <option value={10}>Quick · 10</option><option value={12}>Standard · 12</option><option value={15}>Deep · 15</option>
            </select></label><p>You can change the depth for an individual game in Review.</p>
          </section>}
          {section==='updates' && <UpdateSettings gameActive={isGameActive}/>}
        </div>
      </div>
    </div>
  </div>;
}
