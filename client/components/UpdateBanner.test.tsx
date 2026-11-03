// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UpdateStatusPayload } from '../../shared/types.js';
import { UpdateBanner } from './UpdateBanner.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const makeStatus = (status: UpdateStatusPayload['status']): UpdateStatusPayload => ({
  status,
  info: { version: '1.2.4' },
  progress: null,
  error: null,
  checkedAt: Date.now(),
});

describe('desktop update notification', () => {
  let container: HTMLDivElement;
  let root: Root;
  let publishStatus: (status: UpdateStatusPayload) => void;
  let dismissedKey: string | null;
  let currentStatus: UpdateStatusPayload;
  const openSettings = vi.fn();
  const install = vi.fn().mockResolvedValue({ success: true });

  const render = async (isGameActive = false) => {
    await act(async () => {
      root.render(
        <UpdateBanner
          isGameActive={isGameActive}
          onOpenSettings={openSettings}
          dismissedKey={dismissedKey}
          onDismiss={(key) => {
            dismissedKey = key;
            void render(isGameActive);
          }}
        />
      );
    });
  };

  beforeEach(async () => {
    openSettings.mockClear();
    install.mockClear();
    dismissedKey = null;
    currentStatus = makeStatus('idle');
    Object.defineProperty(window, 'desktop', {
      configurable: true,
      value: {
        getUpdateStatus: vi.fn(async () => currentStatus),
        onUpdateStatus: vi.fn((callback: typeof publishStatus) => {
          publishStatus = callback;
          return () => {};
        }),
        quitAndInstall: install,
      },
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await render();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    Reflect.deleteProperty(window, 'desktop');
  });

  it('appears on an update event, opens update settings, and can be dismissed', async () => {
    expect(container.querySelector('[role="status"]')).toBeNull();
    act(() => publishStatus(makeStatus('available')));
    expect(container.textContent).toContain('New version available');

    act(() => container.querySelector<HTMLButtonElement>('button')!.click());
    await act(async () => {});
    expect(container.querySelector('[role="status"]')).toBeNull();

    act(() => publishStatus(makeStatus('downloading')));
    expect(container.querySelector('[role="status"]')).toBeNull();

    act(() => publishStatus(makeStatus('downloaded')));
    expect(container.textContent).toContain('Update ready to install');
    const viewButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'View update');
    act(() => viewButton!.click());
    expect(openSettings).toHaveBeenCalledOnce();
  });

  it('prevents restart during an active game and allows it afterward', async () => {
    await render(true);
    act(() => publishStatus(makeStatus('downloaded')));
    const restartButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Game in Progress') as HTMLButtonElement;
    expect(restartButton.disabled).toBe(true);
    expect(install).not.toHaveBeenCalled();

    await render(false);
    const enabledButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Restart to Update') as HTMLButtonElement;
    expect(enabledButton.disabled).toBe(false);
    await act(async () => enabledButton.click());
    expect(install).toHaveBeenCalledOnce();
  });
});
