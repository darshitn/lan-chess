// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { Lobby, getStoredLobbyMode, type LobbyProps } from './Lobby.js';
import type { TimeControl } from '../../shared/types.js';

// @ts-ignore
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Lobby Component Redesign & Interactions', () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  const defaultProps: LobbyProps = {
    playerName: 'Alice',
    onNameChange: vi.fn(),
    roomCode: 'ABCD',
    onRoomCodeChange: vi.fn(),
    timeControl: '3+0' as TimeControl,
    onTimeControlChange: vi.fn(),
    recentTimeControls: ['3+0', '5+0'] as TimeControl[],
    allowTakebacks: true,
    onAllowTakebacksChange: vi.fn(),
    onCreateGame: vi.fn(),
    onJoinGame: vi.fn(),
    onJoinSpectator: vi.fn(),
    onStartComputerGame: vi.fn(),
    onOpenSettings: vi.fn(),
    hostUrl: 'http://192.168.1.100:3001',
    error: null,
    isConnecting: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    container.remove();
  });

  // Helper to mount Lobby into real DOM
  function mount(props: Partial<LobbyProps> = {}) {
    const combined: LobbyProps = { ...defaultProps, ...props };
    act(() => {
      root!.render(<Lobby {...combined} />);
    });
    return container;
  }

  /* -------------------------------------------------------------
     1. Real Interactive Mode Switching & Arrow Key Navigation
     ------------------------------------------------------------- */
  describe('Interactive Mode Switching and Keyboard Navigation', () => {
    it('switches mode on click, updates aria-selected, and toggles hidden on corresponding panels', () => {
      mount();

      const tabCreate = container.querySelector<HTMLButtonElement>('#tab-create')!;
      const tabJoin = container.querySelector<HTMLButtonElement>('#tab-join')!;
      const tabComp = container.querySelector<HTMLButtonElement>('#tab-computer')!;

      // All three panels exist simultaneously in DOM
      const panelCreate = container.querySelector<HTMLDivElement>('#panel-create')!;
      const panelJoin = container.querySelector<HTMLDivElement>('#panel-join')!;
      const panelComp = container.querySelector<HTMLDivElement>('#panel-computer')!;

      expect(panelCreate).not.toBeNull();
      expect(panelJoin).not.toBeNull();
      expect(panelComp).not.toBeNull();

      // Initially in Create mode: only panelCreate is visible, others are hidden
      expect(tabCreate.getAttribute('aria-selected')).toBe('true');
      expect(panelCreate.hidden).toBe(false);
      expect(panelJoin.hidden).toBe(true);
      expect(panelComp.hidden).toBe(true);

      // Click Join tab
      act(() => {
        tabJoin.click();
      });

      expect(tabJoin.getAttribute('aria-selected')).toBe('true');
      expect(tabCreate.getAttribute('aria-selected')).toBe('false');
      expect(panelJoin.hidden).toBe(false);
      expect(panelCreate.hidden).toBe(true);
      expect(panelComp.hidden).toBe(true);

      // Click Computer tab
      act(() => {
        tabComp.click();
      });

      expect(tabComp.getAttribute('aria-selected')).toBe('true');
      expect(tabJoin.getAttribute('aria-selected')).toBe('false');
      expect(panelComp.hidden).toBe(false);
      expect(panelJoin.hidden).toBe(true);
      expect(panelCreate.hidden).toBe(true);
    });

    it('ensures every tab aria-controls always references an existing mounted panel in the DOM', () => {
      mount();

      const tablist = container.querySelector<HTMLDivElement>('[role="tablist"]')!;
      expect(tablist).not.toBeNull();
      expect(tablist.getAttribute('aria-orientation')).toBe('horizontal');

      const tabs = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
      expect(tabs.length).toBe(3);

      for (const tab of tabs) {
        const controlsId = tab.getAttribute('aria-controls');
        expect(controlsId).toBeTruthy();

        // Target panel must exist in the DOM at all times
        const panel = container.querySelector<HTMLDivElement>(`#${controlsId}`);
        expect(panel).not.toBeNull();
        expect(panel?.getAttribute('role')).toBe('tabpanel');
        expect(panel?.getAttribute('aria-labelledby')).toBe(tab.id);

        const isSelected = tab.getAttribute('aria-selected') === 'true';
        expect(panel?.hidden).toBe(!isSelected);
        if (!isSelected) {
          expect(panel?.className).toContain('hidden');
        }
      }
    });

    it('navigates mode tabs with Right Arrow, Left Arrow, Home, and End keys (horizontal roving tabindex)', () => {
      mount({ initialMode: 'create' });

      const tabCreate = container.querySelector<HTMLButtonElement>('#tab-create')!;
      const tabJoin = container.querySelector<HTMLButtonElement>('#tab-join')!;
      const tabComp = container.querySelector<HTMLButtonElement>('#tab-computer')!;

      // Initial roving tabindex
      expect(tabCreate.getAttribute('tabindex')).toBe('0');
      expect(tabJoin.getAttribute('tabindex')).toBe('-1');
      expect(tabComp.getAttribute('tabindex')).toBe('-1');

      // Press ArrowRight from Create tab
      let event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
      act(() => {
        tabCreate.focus();
        tabCreate.dispatchEvent(event);
      });

      expect(event.defaultPrevented).toBe(true);
      expect(tabJoin.getAttribute('aria-selected')).toBe('true');
      expect(tabJoin.getAttribute('tabindex')).toBe('0');
      expect(tabCreate.getAttribute('tabindex')).toBe('-1');
      expect(document.activeElement).toBe(tabJoin);

      // Press ArrowRight from Join tab -> should wrap/move to Computer
      event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
      act(() => {
        tabJoin.dispatchEvent(event);
      });

      expect(event.defaultPrevented).toBe(true);
      expect(tabComp.getAttribute('aria-selected')).toBe('true');
      expect(document.activeElement).toBe(tabComp);

      // Press ArrowLeft from Computer tab -> should move back to Join
      event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
      act(() => {
        tabComp.dispatchEvent(event);
      });

      expect(event.defaultPrevented).toBe(true);
      expect(tabJoin.getAttribute('aria-selected')).toBe('true');
      expect(document.activeElement).toBe(tabJoin);

      // Press Home key -> should move to first tab (Create)
      event = new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true });
      act(() => {
        tabJoin.dispatchEvent(event);
      });

      expect(event.defaultPrevented).toBe(true);
      expect(tabCreate.getAttribute('aria-selected')).toBe('true');
      expect(document.activeElement).toBe(tabCreate);

      // Press End key -> should move to last tab (Computer)
      event = new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true });
      act(() => {
        tabCreate.dispatchEvent(event);
      });

      expect(event.defaultPrevented).toBe(true);
      expect(tabComp.getAttribute('aria-selected')).toBe('true');
      expect(document.activeElement).toBe(tabComp);
    });

    it('does not intercept ArrowUp or ArrowDown on horizontal tablist, leaving them for page scrolling', () => {
      mount({ initialMode: 'create' });

      const tabCreate = container.querySelector<HTMLButtonElement>('#tab-create')!;
      const tabJoin = container.querySelector<HTMLButtonElement>('#tab-join')!;

      // Focus tabCreate
      act(() => {
        tabCreate.focus();
      });
      expect(document.activeElement).toBe(tabCreate);
      expect(tabCreate.getAttribute('aria-selected')).toBe('true');

      // Dispatch ArrowDown
      const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
      act(() => {
        tabCreate.dispatchEvent(downEvent);
      });

      // Crucial: default must NOT be prevented, tab selection must NOT change
      expect(downEvent.defaultPrevented).toBe(false);
      expect(tabCreate.getAttribute('aria-selected')).toBe('true');
      expect(tabJoin.getAttribute('aria-selected')).toBe('false');
      expect(document.activeElement).toBe(tabCreate);

      // Dispatch ArrowUp
      const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true });
      act(() => {
        tabCreate.dispatchEvent(upEvent);
      });

      // Crucial: default must NOT be prevented, tab selection must NOT change
      expect(upEvent.defaultPrevented).toBe(false);
      expect(tabCreate.getAttribute('aria-selected')).toBe('true');
      expect(tabJoin.getAttribute('aria-selected')).toBe('false');
      expect(document.activeElement).toBe(tabCreate);
    });
  });

  /* -------------------------------------------------------------
     2. Value Preservation Across Mode Switches
     ------------------------------------------------------------- */
  describe('Form Value Retention Across Mode Switches', () => {
    it('preserves player name, room code, and computer options when switching back and forth', () => {
      let currentName = 'Grandmaster';
      let currentCode = 'TEST1';

      const onNameChange = vi.fn((n) => { currentName = n; });
      const onRoomCodeChange = vi.fn((c) => { currentCode = c; });

      // Start in Join mode
      mount({
        initialMode: 'join',
        playerName: currentName,
        onNameChange,
        roomCode: currentCode,
        onRoomCodeChange,
      });

      const tabComp = container.querySelector<HTMLButtonElement>('#tab-computer')!;
      const tabJoin = container.querySelector<HTMLButtonElement>('#tab-join')!;

      // In Join mode: verify player name and room code are rendered
      const nameInput = container.querySelector<HTMLInputElement>('#player-name-input')!;
      const codeInput = container.querySelector<HTMLInputElement>('#room-code-input')!;
      expect(nameInput.value).toBe('Grandmaster');
      expect(codeInput.value).toBe('TEST1');

      // Switch to Computer mode
      act(() => {
        tabComp.click();
      });

      // Verify name is still present in Computer mode
      const nameInComp = container.querySelector<HTMLInputElement>('#player-name-input')!;
      expect(nameInComp.value).toBe('Grandmaster');

      // Select Black side in Computer panel
      const blackBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('#panel-computer button'))
        .find((b) => b.textContent?.includes('Black'))!;
      act(() => {
        blackBtn.click();
      });

      // Select Expert difficulty
      const expertBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('#panel-computer button'))
        .find((b) => b.textContent?.includes('Expert'))!;
      act(() => {
        expertBtn.click();
      });

      // Select 10+0 time control
      const tc10Btn = Array.from(container.querySelectorAll<HTMLButtonElement>('#panel-computer button'))
        .find((b) => b.textContent?.trim() === '10 min')!;
      act(() => {
        tc10Btn.click();
      });

      // Switch back to Join mode
      act(() => {
        tabJoin.click();
      });

      // Room code input is still "TEST1"
      const codeInputAfter = container.querySelector<HTMLInputElement>('#room-code-input')!;
      expect(codeInputAfter.value).toBe('TEST1');

      // Switch back to Computer mode and verify options were remembered in state
      act(() => {
        tabComp.click();
      });

      // Start computer game and verify handler receives the retained choices
      const onStartComputerGame = vi.fn();
      act(() => {
        root!.render(
          <Lobby
            {...defaultProps}
            playerName="Grandmaster"
            onStartComputerGame={onStartComputerGame}
          />
        );
      });

      const startCompBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('#panel-computer button'))
        .find((b) => b.textContent?.includes('Start Match vs Computer'))!;
      act(() => {
        startCompBtn.click();
      });

      expect(onStartComputerGame).toHaveBeenCalledWith(
        expect.objectContaining({
          playerName: 'Grandmaster',
          colorChoice: 'b',
          difficulty: 'expert',
          timeControl: '10+0',
        })
      );
    });

    it('preserves native form disclosure state and maintains identical DOM panel references across mode switches', () => {
      mount({ initialMode: 'create' });

      const tabJoin = container.querySelector<HTMLButtonElement>('#tab-join')!;
      const tabCreate = container.querySelector<HTMLButtonElement>('#tab-create')!;
      const createPanel = container.querySelector<HTMLDivElement>('#panel-create')!;
      const joinPanel = container.querySelector<HTMLDivElement>('#panel-join')!;
      const compPanel = container.querySelector<HTMLDivElement>('#panel-computer')!;

      // Open the "More options" details disclosure in Create panel
      const details = container.querySelector<HTMLDetailsElement>('#panel-create details')!;
      expect(details.open).toBe(false);
      act(() => {
        details.open = true;
      });
      expect(details.open).toBe(true);

      // Switch to Join mode
      act(() => {
        tabJoin.click();
      });

      // Panels remain identical DOM nodes (not unmounted/recreated)
      expect(container.querySelector('#panel-create')).toBe(createPanel);
      expect(container.querySelector('#panel-join')).toBe(joinPanel);
      expect(container.querySelector('#panel-computer')).toBe(compPanel);

      // Create panel is hidden
      expect(createPanel.hidden).toBe(true);
      expect(joinPanel.hidden).toBe(false);

      // Switch back to Create mode
      act(() => {
        tabCreate.click();
      });

      // Create panel is visible again and its details disclosure state remains open
      expect(createPanel.hidden).toBe(false);
      expect(container.querySelector<HTMLDetailsElement>('#panel-create details')!.open).toBe(true);
    });
  });

  /* -------------------------------------------------------------
     3. Handler Invocations with Exact Settings
     ------------------------------------------------------------- */
  describe('Game Handler Invocations', () => {
    it('invokes onCreateGame when Create Game button is clicked in Create mode', () => {
      const onCreateGame = vi.fn();
      mount({ initialMode: 'create', playerName: 'HostPlayer', onCreateGame });

      const createBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('#panel-create button'))
        .find((b) => b.textContent?.includes('Create Game'))!;

      act(() => {
        createBtn.click();
      });

      expect(onCreateGame).toHaveBeenCalledTimes(1);
    });

    it('invokes onJoinGame when Join Game button is clicked in Join mode', () => {
      const onJoinGame = vi.fn();
      mount({ initialMode: 'join', playerName: 'Guest', roomCode: 'ROOM', onJoinGame });

      const joinBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('#panel-join button'))
        .find((b) => b.textContent?.includes('Join Game'))!;

      act(() => {
        joinBtn.click();
      });

      expect(onJoinGame).toHaveBeenCalledTimes(1);
    });

    it('invokes onJoinSpectator when Watch Game button is clicked in Join mode', () => {
      const onJoinSpectator = vi.fn();
      mount({ initialMode: 'join', roomCode: 'ROOM', onJoinSpectator });

      const watchBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('#panel-join button'))
        .find((b) => b.textContent?.includes('Watch Game'))!;

      act(() => {
        watchBtn.click();
      });

      expect(onJoinSpectator).toHaveBeenCalledTimes(1);
    });

    it('invokes onStartComputerGame with selected settings in Computer mode', () => {
      const onStartComputerGame = vi.fn();
      mount({ initialMode: 'computer', playerName: 'Player1', onStartComputerGame });

      // Click White side
      const whiteBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('#panel-computer button'))
        .find((b) => b.textContent?.includes('White'))!;
      act(() => {
        whiteBtn.click();
      });

      // Click Easy difficulty
      const easyBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('#panel-computer button'))
        .find((b) => b.textContent?.includes('Easy'))!;
      act(() => {
        easyBtn.click();
      });

      const startBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('#panel-computer button'))
        .find((b) => b.textContent?.includes('Start Match vs Computer'))!;
      act(() => {
        startBtn.click();
      });

      expect(onStartComputerGame).toHaveBeenCalledWith({
        playerName: 'Player1',
        colorChoice: 'w',
        difficulty: 'easy',
        timeControl: '3+2',
      });
    });
  });

  /* -------------------------------------------------------------
     4. Content & Presentation Refinements
     ------------------------------------------------------------- */
  describe('Content and Icon Refinements', () => {
    it('uses honest, accurate description for Expert difficulty', () => {
      const html = renderToStaticMarkup(<Lobby {...defaultProps} initialMode="computer" />);

      expect(html).toContain('Deepest search (14 ply, 2s)');
      expect(html).not.toContain('Full Stockfish strength');
    });

    it('uses SVG icons instead of platform-dependent emojis', () => {
      const html = renderToStaticMarkup(<Lobby {...defaultProps} />);

      // Should contain SVGs inside the mode tabs
      expect(html).toContain('<svg');
      // Should not contain the old emoji characters in mode buttons
      expect(html).not.toContain('🌐');
      expect(html).not.toContain('🔗');
      expect(html).not.toContain('🤖');
    });

    it('getStoredLobbyMode falls back to create safely without stored preference', () => {
      expect(getStoredLobbyMode()).toBe('create');
    });
  });
});
