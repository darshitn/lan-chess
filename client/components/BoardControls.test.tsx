// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { BoardControls } from './BoardControls.js';
import { BOARD_SIZE_STEP } from '../services/board-sizing.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('BoardControls component', () => {
  it('renders all controls with accessible attributes and handles interactions', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const onSetSizeMode = vi.fn();
    const onCustomSizeChange = vi.fn();
    const onStepSize = vi.fn();
    const onResetToFit = vi.fn();
    const onToggleFocusBoard = vi.fn();
    const onToggleFullscreen = vi.fn();

    await act(async () => {
      root.render(
        <BoardControls
          sizeMode="fit"
          currentSize={560}
          fitSize={560}
          maxAllowedWidth={800}
          focusBoard={false}
          isFullscreen={false}
          isFullscreenSupported={true}
          onSetSizeMode={onSetSizeMode}
          onCustomSizeChange={onCustomSizeChange}
          onStepSize={onStepSize}
          onResetToFit={onResetToFit}
          onToggleFocusBoard={onToggleFocusBoard}
          onToggleFullscreen={onToggleFullscreen}
        />
      );
    });

    // Check presence of elements
    const fitBtn = container.querySelector('button[aria-label="Reset board size to fit screen"]') as HTMLButtonElement;
    expect(fitBtn).not.toBeNull();
    expect(fitBtn.getAttribute('aria-pressed')).toBe('true');

    const minusBtn = container.querySelector('button[aria-label="Decrease board size"]') as HTMLButtonElement;
    expect(minusBtn).not.toBeNull();
    expect(minusBtn.disabled).toBe(false);

    const plusBtn = container.querySelector('button[aria-label="Increase board size"]') as HTMLButtonElement;
    expect(plusBtn).not.toBeNull();
    expect(plusBtn.disabled).toBe(false);

    const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider).not.toBeNull();
    expect(slider.value).toBe('560');

    const focusBtn = container.querySelector('button[aria-label="Focus board (collapse sidebar)"]') as HTMLButtonElement;
    expect(focusBtn).not.toBeNull();
    expect(focusBtn.getAttribute('aria-pressed')).toBe('false');

    const fullBtn = container.querySelector('button[aria-label="Enter fullscreen"]') as HTMLButtonElement;
    expect(fullBtn).not.toBeNull();

    // Trigger click on minus button
    act(() => {
      minusBtn.click();
    });
    expect(onStepSize).toHaveBeenCalledWith(-BOARD_SIZE_STEP);

    // Trigger click on plus button
    act(() => {
      plusBtn.click();
    });
    expect(onStepSize).toHaveBeenCalledWith(BOARD_SIZE_STEP);

    // Trigger click on fit button
    act(() => {
      fitBtn.click();
    });
    expect(onResetToFit).toHaveBeenCalled();

    // Trigger click on focus button
    act(() => {
      focusBtn.click();
    });
    expect(onToggleFocusBoard).toHaveBeenCalled();

    // Trigger click on fullscreen button
    act(() => {
      fullBtn.click();
    });
    expect(onToggleFullscreen).toHaveBeenCalled();

    // Clean up
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('disables minus button when size is at or below minimum', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <BoardControls
          sizeMode="custom"
          currentSize={280}
          fitSize={560}
          maxAllowedWidth={800}
          focusBoard={true}
          isFullscreen={false}
          isFullscreenSupported={false}
          onSetSizeMode={() => {}}
          onCustomSizeChange={() => {}}
          onStepSize={() => {}}
          onResetToFit={() => {}}
          onToggleFocusBoard={() => {}}
          onToggleFullscreen={() => {}}
        />
      );
    });

    const minusBtn = container.querySelector('button[aria-label="Decrease board size"]') as HTMLButtonElement;
    expect(minusBtn.disabled).toBe(true);

    const plusBtn = container.querySelector('button[aria-label="Increase board size"]') as HTMLButtonElement;
    expect(plusBtn.disabled).toBe(false);

    // Fullscreen button should not be rendered when not supported
    const fullBtn = container.querySelector('button[aria-label="Enter fullscreen"]');
    expect(fullBtn).toBeNull();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders Exit state when isFullscreen is true', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <BoardControls
          sizeMode="fit"
          currentSize={560}
          fitSize={560}
          maxAllowedWidth={800}
          focusBoard={false}
          isFullscreen={true}
          isFullscreenSupported={true}
          onSetSizeMode={() => {}}
          onCustomSizeChange={() => {}}
          onStepSize={() => {}}
          onResetToFit={() => {}}
          onToggleFocusBoard={() => {}}
          onToggleFullscreen={() => {}}
        />
      );
    });

    const exitBtn = container.querySelector('button[aria-label="Exit fullscreen"]') as HTMLButtonElement;
    expect(exitBtn).not.toBeNull();
    expect(exitBtn.getAttribute('aria-pressed')).toBe('true');
    expect(exitBtn.textContent).toContain('Exit');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders fullscreen error alert and allows dismissing it', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onClearError = vi.fn();

    await act(async () => {
      root.render(
        <BoardControls
          sizeMode="fit"
          currentSize={560}
          fitSize={560}
          maxAllowedWidth={800}
          focusBoard={false}
          isFullscreen={false}
          isFullscreenSupported={true}
          fullscreenError="Permissions check failed"
          onClearFullscreenError={onClearError}
          onSetSizeMode={() => {}}
          onCustomSizeChange={() => {}}
          onStepSize={() => {}}
          onResetToFit={() => {}}
          onToggleFocusBoard={() => {}}
          onToggleFullscreen={() => {}}
        />
      );
    });

    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain('Permissions check failed');

    const dismissBtn = container.querySelector('button[aria-label="Dismiss fullscreen error"]') as HTMLButtonElement;
    expect(dismissBtn).not.toBeNull();
    act(() => {
      dismissBtn.click();
    });
    expect(onClearError).toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
