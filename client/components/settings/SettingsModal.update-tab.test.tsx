// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { loadUserPreferences } from '../../services/preferences.js';
import { SettingsModal } from './SettingsModal.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Settings update deep link', () => {
  it('opens directly on Updates and resets to Appearance for a normal opening', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const preferences = loadUserPreferences();
    const props = {
      onClose: vi.fn(),
      preferences,
      customThemes: [],
      onUpdatePreferences: vi.fn(),
      onSaveCustomTheme: vi.fn(),
      onDeleteCustomTheme: vi.fn(),
    };

    await act(async () => {
      root.render(<SettingsModal {...props} isOpen initialTab="updates" />);
    });
    expect(container.textContent).toContain('Application Updates');

    await act(async () => {
      root.render(<SettingsModal {...props} isOpen={false} initialTab="appearance" />);
      root.render(<SettingsModal {...props} isOpen initialTab="appearance" />);
    });
    expect(container.textContent).not.toContain('Application Updates');
    expect(container.textContent).toContain('Current Appearance');

    act(() => root.unmount());
    container.remove();
  });
});
