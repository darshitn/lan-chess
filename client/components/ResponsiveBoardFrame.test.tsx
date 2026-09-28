// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ResponsiveBoardFrame } from './ResponsiveBoardFrame.js';
import { DEFAULT_MIN_BOARD_SIZE, DEFAULT_MAX_BOARD_SIZE, FOCUS_MAX_BOARD_SIZE } from '../services/board-sizing.js';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ResponsiveBoardFrame component', () => {
  it('renders drag handle with complete WAI-ARIA slider attributes including aria-valuemax', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const handleResizeCustom = vi.fn();

    await act(async () => {
      root.render(
        <ResponsiveBoardFrame
          focusBoard={false}
          onResizeCustom={handleResizeCustom}
          showDragHandle={true}
        >
          <div data-testid="chess-child">Chessboard</div>
        </ResponsiveBoardFrame>
      );
    });

    const handle = container.querySelector('[role="slider"]') as HTMLDivElement;
    expect(handle).not.toBeNull();
    expect(handle.getAttribute('aria-label')).toBe('Drag to resize chessboard');
    expect(handle.getAttribute('aria-valuemin')).toBe(String(DEFAULT_MIN_BOARD_SIZE));
    expect(handle.getAttribute('aria-valuemax')).toBe(String(DEFAULT_MAX_BOARD_SIZE));
    expect(handle.getAttribute('aria-valuenow')).not.toBeNull();
  });

  it('updates drag handle aria-valuemax to FOCUS_MAX_BOARD_SIZE in focus board mode', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const handleResizeCustom = vi.fn();

    await act(async () => {
      root.render(
        <ResponsiveBoardFrame
          focusBoard={true}
          onResizeCustom={handleResizeCustom}
          showDragHandle={true}
        >
          <div data-testid="chess-child">Chessboard</div>
        </ResponsiveBoardFrame>
      );
    });

    const handle = container.querySelector('[role="slider"]') as HTMLDivElement;
    expect(handle).not.toBeNull();
    expect(handle.getAttribute('aria-valuemax')).toBe(String(FOCUS_MAX_BOARD_SIZE));
  });

  it('handles keyboard arrow navigation on the drag handle slider', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const handleResizeCustom = vi.fn();

    await act(async () => {
      root.render(
        <ResponsiveBoardFrame
          focusBoard={false}
          customSize={560}
          onResizeCustom={handleResizeCustom}
          showDragHandle={true}
        >
          <div>Board</div>
        </ResponsiveBoardFrame>
      );
    });

    const handle = container.querySelector('[role="slider"]') as HTMLDivElement;
    expect(handle).not.toBeNull();

    // ArrowRight / ArrowUp should increase size
    act(() => {
      handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(handleResizeCustom).toHaveBeenCalledWith(576); // 560 + 16

    act(() => {
      handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    });
    expect(handleResizeCustom).toHaveBeenCalledWith(576);

    // ArrowLeft / ArrowDown should decrease size
    act(() => {
      handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    });
    expect(handleResizeCustom).toHaveBeenCalledWith(544); // 560 - 16

    act(() => {
      handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    });
    expect(handleResizeCustom).toHaveBeenCalledWith(544);
  });
});
