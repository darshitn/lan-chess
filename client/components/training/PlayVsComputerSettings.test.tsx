// @vitest-environment happy-dom
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { PlayVsComputer } from './PlayVsComputer.js';
import { SettingsModal } from '../settings/SettingsModal.js';
import { DEFAULT_PREFERENCES, BUILTIN_BOARD_THEMES } from '../../services/preferences.js';
import type { UserPreferences } from '../../types/preferences.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('PlayVsComputer and SettingsModal integration', () => {
  it('calls onOpenSettings when Settings button is clicked in PlayVsComputer', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const onOpenSettings = vi.fn();

    await act(async () => {
      root.render(
        <PlayVsComputer
          initialConfig={{
            playerName: 'Player',
            colorChoice: 'w',
            difficulty: 'easy',
            timeControl: 'unlimited',
          }}
          theme={BUILTIN_BOARD_THEMES[0]}
          pieceSet="classic"
          highlightStyle="classic"
          boardSettings={DEFAULT_PREFERENCES.boardSettings}
          soundSettings={DEFAULT_PREFERENCES.sound}
          onBackToLobby={() => {}}
          onReviewGame={() => {}}
          onOpenSettings={onOpenSettings}
        />
      );
    });

    const settingsBtn = container.querySelector('button[title="Settings & Themes"]') as HTMLButtonElement;
    expect(settingsBtn).not.toBeNull();

    await act(async () => {
      settingsBtn.click();
    });

    expect(onOpenSettings).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders SettingsModal alongside PlayVsComputer and toggles it cleanly', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    function TestContainer() {
      const [isSettingsOpen, setIsSettingsOpen] = useState(false);
      const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);

      return (
        <div>
          <PlayVsComputer
            initialConfig={{
              playerName: 'Player',
              colorChoice: 'w',
              difficulty: 'easy',
              timeControl: 'unlimited',
            }}
            theme={BUILTIN_BOARD_THEMES[0]}
            pieceSet={prefs.pieceSet}
            highlightStyle={prefs.highlightStyle}
            boardSettings={prefs.boardSettings}
            soundSettings={prefs.sound}
            onBackToLobby={() => {}}
            onReviewGame={() => {}}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />

          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            preferences={prefs}
            customThemes={[]}
            onUpdatePreferences={setPrefs}
            onSaveCustomTheme={() => {}}
            onDeleteCustomTheme={() => {}}
            isGameActive={true}
          />
        </div>
      );
    }

    await act(async () => {
      root.render(<TestContainer />);
    });

    // Modal dialog should not be in DOM initially
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    // Click settings button
    const settingsBtn = container.querySelector('button[title="Settings & Themes"]') as HTMLButtonElement;
    expect(settingsBtn).not.toBeNull();

    await act(async () => {
      settingsBtn.click();
    });

    // Modal is now open
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Settings');

    // Close button works
    const closeBtn = dialog?.querySelector('button[aria-label="Close settings"]') as HTMLButtonElement;
    expect(closeBtn).not.toBeNull();

    await act(async () => {
      closeBtn.click();
    });

    // Modal is closed
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    // PlayVsComputer board remains mounted and intact
    expect(container.querySelector('.chessboard')).not.toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
