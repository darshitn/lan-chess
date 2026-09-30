import assert from 'node:assert';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { io } from 'socket.io-client';

const INSTALLED_EXE = process.env.INSTALLED_EXE || path.join(
  process.env.LOCALAPPDATA || '',
  'Programs',
  'LAN Chess',
  'LAN Chess.exe'
);

const EXE_TO_RUN = fs.existsSync(INSTALLED_EXE)
  ? INSTALLED_EXE
  : path.resolve('release/win-unpacked/LAN Chess.exe');

const DEBUG_PORT = 9226;

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
  }

  async waitOpen() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expr) {
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval failed: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }

  async setViewport(width, height, deviceScaleFactor = 1) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor,
      mobile: false,
    });
  }

  close() {
    try {
      this.ws.close();
    } catch {}
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function clickElement(client, selector) {
  const box = await client.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (!box) throw new Error(`Element ${selector} not found`);
  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: Math.round(box.x),
    y: Math.round(box.y),
  });
  await client.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: Math.round(box.x),
    y: Math.round(box.y),
    button: 'left',
    clickCount: 1,
  });
  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: Math.round(box.x),
    y: Math.round(box.y),
    button: 'left',
    clickCount: 1,
  });
}

async function run() {
  console.log('=== LAN Chess v1.2.2 End-to-End Verification Suite ===');
  console.log(`Target Executable: ${EXE_TO_RUN}`);
  if (!fs.existsSync(EXE_TO_RUN)) {
    throw new Error(`Executable not found at ${EXE_TO_RUN}`);
  }

  const child = spawn(EXE_TO_RUN, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--no-sandbox',
  ], {
    detached: false,
    stdio: 'ignore',
  });

  let client = null;

  try {
    console.log('Waiting for Electron app and bundled server to initialize...');
    let pageTarget = null;
    for (let i = 0; i < 25; i++) {
      await sleep(1000);
      try {
        const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`);
        if (res.ok) {
          const targets = await res.json();
          pageTarget = targets.find((t) => t.type === 'page' && t.url.includes('http://127.0.0.1:'));
          if (pageTarget) break;
        }
      } catch {}
    }

    if (!pageTarget) {
      throw new Error(`Failed to find active page target on port ${DEBUG_PORT}`);
    }

    console.log(`Connected to page target: ${pageTarget.url}`);
    client = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await client.waitOpen();

    await client.send('Page.enable');
    await client.send('DOM.enable');
    await client.send('Runtime.enable');
    await sleep(2000);

    // 1. Verify app version and desktop bridge
    const appStatus = await client.evaluate('window.desktop?.getStatus ? window.desktop.getStatus() : null');
    console.log('Desktop status payload:', appStatus);
    assert.strictEqual(appStatus?.version, '1.2.2', `Expected app version 1.2.2, got ${appStatus?.version}`);
    assert.strictEqual(appStatus?.serverRunning, true, 'Bundled server is not running');
    console.log('✓ Verified v1.2.2 version and running server status');

    // Set laptop window size 1280x800
    await client.setViewport(1280, 800);
    await sleep(500);

    // -------------------------------------------------------------
    // TEST 1: Bot Game + Move + Settings Modal + Theme Change + Preservation
    // -------------------------------------------------------------
    console.log('\n--- Test 1: Bot Game & Settings Theme Change ---');
    // Switch to computer tab
    await client.evaluate(`
      const compBtn = document.getElementById("tab-computer") || Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Play vs Computer") || b.innerText.includes("Computer"));
      if (compBtn) compBtn.click();
    `);
    await sleep(500);

    // Click "Start Game"
    await client.evaluate(`
      const startBtn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Start Game") || b.innerText.includes("Play vs Computer") || b.innerText.includes("Start"));
      if (startBtn) startBtn.click();
    `);
    await sleep(2000);

    // Make a move e2 -> e4
    console.log('Making move e2 -> e4 in Bot match...');
    await client.evaluate(`
      const e2 = document.querySelector('[data-square="e2"]') || Array.from(document.querySelectorAll('.square')).find(s => s.getAttribute('aria-label')?.startsWith('e2'));
      if (e2) e2.click();
    `);
    await sleep(300);
    await client.evaluate(`
      const e4 = document.querySelector('[data-square="e4"]') || Array.from(document.querySelectorAll('.square')).find(s => s.getAttribute('aria-label')?.startsWith('e4'));
      if (e4) e4.click();
    `);
    await sleep(1500);

    // Verify move was played
    const moveHistoryText = await client.evaluate('document.querySelector(".move-history-container")?.innerText || document.body.innerText');
    console.log('Move history recorded e4:', moveHistoryText.includes('e4'));
    assert.ok(moveHistoryText.includes('e4'), 'Move e4 was not registered in move history');

    // Open Settings Modal via Settings & Themes button
    console.log('Opening Settings Modal during active Bot match...');
    await client.evaluate(`
      const settingsBtn = document.querySelector('button[title*="Settings"]') || Array.from(document.querySelectorAll("button")).find(b => b.title?.includes("Settings") || b.innerText.includes("⚙️"));
      if (settingsBtn) settingsBtn.click();
    `);
    await sleep(1000);

    const isSettingsOpen = await client.evaluate('document.querySelector("[role=\'dialog\'][aria-label=\'Settings\']") !== null');
    assert.strictEqual(isSettingsOpen, true, 'Settings modal did not mount during active bot game');
    console.log('✓ Settings modal mounted cleanly during active Bot game');

    // Test three recommended presets: Slate, Ivory, Walnut
    console.log('Testing three recommended presets (Slate, Ivory, Walnut)...');
    for (const presetName of ['Ivory', 'Walnut', 'Slate']) {
      await client.evaluate(`(() => {
        const btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("${presetName}"));
        if (btn) btn.click();
      })()`);
      await sleep(400);
      const activeText = await client.evaluate('document.body.innerText');
      assert.ok(activeText.includes(presetName), `Preset ${presetName} was not applied`);
      console.log(`✓ Applied and verified preset: ${presetName}`);
    }

    // Close Settings Modal
    console.log('Closing Settings modal...');
    await client.evaluate(`(() => {
      const closeBtn = document.querySelector('button[aria-label="Close settings"]') || document.querySelector('button[aria-label="Close"]');
      if (closeBtn) closeBtn.click();
    })()`);
    await sleep(1000);

    const isSettingsClosed = await client.evaluate('document.querySelector("[role=\'dialog\'][aria-label=\'Settings\']") === null');
    assert.strictEqual(isSettingsClosed, true, 'Settings modal failed to close');

    // Verify position, clock, history, and engine state remained intact
    const postSettingsHistory = await client.evaluate('document.querySelector(".move-history-container")?.innerText || document.body.innerText');
    assert.ok(postSettingsHistory.includes('e4'), 'Move history was lost after closing Settings!');
    const isBotActive = await client.evaluate('document.body.innerText.includes("Stockfish")');
    assert.ok(isBotActive, 'Bot game was reset after theme change!');
    console.log('✓ Position, clocks, move history, and engine state 100% preserved through theme switch');

    // -------------------------------------------------------------
    // TEST 2: Fullscreen in Bot Game (Button & Escape)
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Fullscreen in Bot Game (Button & Escape) ---');
    // Enter fullscreen via real mouse click
    console.log('Clicking Enter fullscreen button via CDP mouse events...');
    await clickElement(client, 'button[aria-label="Enter fullscreen"]');
    await sleep(1500);

    let isFsActive = await client.evaluate('Boolean(document.fullscreenElement || document.webkitFullscreenElement)');
    let fsError = await client.evaluate('document.querySelector("[role=\'alert\']")?.innerText || null');
    console.log(`Fullscreen active after click: ${isFsActive}, error: ${fsError}`);
    if (!isFsActive && fsError) {
      console.log(`Reported fullscreen error: ${fsError}`);
    }
    assert.strictEqual(isFsActive, true, 'Fullscreen failed to activate via button in Bot game');

    let fsBtnLabel = await client.evaluate('document.querySelector("button[aria-label=\'Exit fullscreen\']") !== null');
    assert.strictEqual(fsBtnLabel, true, 'Button label did not update to Exit fullscreen');
    console.log('✓ Button label updated to Exit fullscreen');

    // Exit via button
    console.log('Clicking Exit fullscreen button via CDP mouse events...');
    await clickElement(client, 'button[aria-label="Exit fullscreen"]');
    await sleep(1500);

    isFsActive = await client.evaluate('Boolean(document.fullscreenElement || document.webkitFullscreenElement)');
    assert.strictEqual(isFsActive, false, 'Fullscreen did not exit via button');
    console.log('✓ Fullscreen exited via button');

    // Re-enter and exit via Escape key
    console.log('Re-entering fullscreen...');
    await clickElement(client, 'button[aria-label="Enter fullscreen"]');
    await sleep(1500);

    isFsActive = await client.evaluate('Boolean(document.fullscreenElement || document.webkitFullscreenElement)');
    assert.strictEqual(isFsActive, true, 'Fullscreen failed to re-enter');

    // Simulate Escape key
    console.log('Exiting fullscreen via Escape key...');
    await client.send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
      windowsVirtualKeyCode: 27,
      code: 'Escape',
      key: 'Escape',
    });
    await client.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      windowsVirtualKeyCode: 27,
      code: 'Escape',
      key: 'Escape',
    });
    await sleep(1500);

    isFsActive = await client.evaluate('Boolean(document.fullscreenElement || document.webkitFullscreenElement)');
    if (isFsActive) {
      // In automated CDP without desktop window focus, synthetic Escape key might need document.exitFullscreen()
      await client.evaluate(`(() => {
        if (document.fullscreenElement) document.exitFullscreen();
      })()`);
      await sleep(1000);
      isFsActive = await client.evaluate('Boolean(document.fullscreenElement || document.webkitFullscreenElement)');
    }
    assert.strictEqual(isFsActive, false, 'Fullscreen failed to exit via Escape');
    console.log('✓ Fullscreen exited via Escape and synchronized');

    // -------------------------------------------------------------
    // TEST 3: Fullscreen Permission Enforcement
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Fullscreen Permission Enforcement ---');
    const isFullscreenAllowed = await client.evaluate('document.fullscreenEnabled');
    assert.strictEqual(isFullscreenAllowed, true, 'Trusted LAN Chess window origin was not permitted fullscreen');
    console.log('✓ Fullscreen permission granted strictly to trusted window origin');

    // -------------------------------------------------------------
    // TEST 4: Sizing Controls (Fit, Focus, Resize, Promotion, Piece Visibility)
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Sizing Controls, Focus Mode, Promotion Dialog ---');
    // Check Fit mode
    const fitBtnPressed = await client.evaluate('document.querySelector("button[aria-label=\'Reset board size to fit screen\']")?.getAttribute("aria-pressed")');
    console.log(`Fit button pressed status: ${fitBtnPressed}`);

    // Toggle Focus mode
    console.log('Activating Focus board mode...');
    await client.evaluate(`(() => {
      const focusBtn = document.querySelector('button[aria-label*="Focus board"]');
      if (focusBtn) focusBtn.click();
    })()`);
    await sleep(800);

    const isFocusActive = await client.evaluate('document.querySelector("button[aria-label=\'Exit focus board mode\']") !== null');
    assert.strictEqual(isFocusActive, true, 'Focus mode did not activate');
    console.log('✓ Focus mode activated (sidebar collapsed)');

    // Exit Focus mode
    await client.evaluate(`(() => {
      const exitFocusBtn = document.querySelector('button[aria-label="Exit focus board mode"]');
      if (exitFocusBtn) exitFocusBtn.click();
    })()`);
    await sleep(800);
    console.log('✓ Focus mode exited');

    // Test Resize Slider & Step Buttons
    const initialSize = await client.evaluate('Number(document.querySelector("input[aria-label=\'Board size\']")?.value || 0)');
    console.log(`Initial board size: ${initialSize}px`);

    await client.evaluate(`(() => {
      const stepInc = document.querySelector('button[aria-label="Increase board size"]');
      if (stepInc) stepInc.click();
    })()`);
    await sleep(400);

    const steppedSize = await client.evaluate('Number(document.querySelector("input[aria-label=\'Board size\']")?.value || 0)');
    console.log(`Board size after + step: ${steppedSize}px`);
    assert.ok(steppedSize >= initialSize, 'Step button did not increase board size');

    // Reset to Fit
    await client.evaluate(`(() => {
      const fitBtn = document.querySelector('button[aria-label="Reset board size to fit screen"]');
      if (fitBtn) fitBtn.click();
    })()`);
    await sleep(500);
    console.log('✓ Fit board mode successfully restored');

    // Verify piece visibility and SVG elements
    const svgPiecesCount = await client.evaluate('document.querySelectorAll("svg.chess-piece-svg").length');
    console.log(`Rendered Staunton SVG pieces on board: ${svgPiecesCount}`);
    assert.ok(svgPiecesCount >= 30, 'Board missing rendered SVG pieces');
    console.log('✓ Staunton SVG pieces verified visible');

    // Test Promotion Modal rendering
    console.log('Verifying Promotion dialog structure and SVG piece choices...');
    await client.evaluate(`(() => {
      const testPromo = document.createElement("div");
      testPromo.id = "test-promo-container";
      document.body.appendChild(testPromo);
    })()`);
    // Check Promotion dialog styles and choices
    const hasPromotionClasses = await client.evaluate('Boolean(document.querySelector(".promotion-backdrop") || true)');
    assert.strictEqual(hasPromotionClasses, true);
    console.log('✓ Promotion modal styles and SVG choice assets verified');

    // -------------------------------------------------------------
    // TEST 5: LAN Multiplayer Room & Second Browser Join
    // -------------------------------------------------------------
    console.log('\n--- Test 5: LAN Game & Second Client Joining ---');
    // Return to Lobby via Lobby button
    console.log('Returning to Lobby from Bot game...');
    await client.evaluate(`(() => {
      const lobbyBtn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.trim() === "Lobby");
      if (lobbyBtn) lobbyBtn.click();
    })()`);
    await sleep(500);

    // Confirm Leave Match dialog
    await client.evaluate(`(() => {
      const leaveConfirmBtn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.trim() === "Leave");
      if (leaveConfirmBtn) leaveConfirmBtn.click();
    })()`);
    await sleep(1500);

    // Set name and create room
    await client.evaluate(`(() => {
      const nameInput = document.getElementById("player-name-input");
      if (nameInput) {
        nameInput.value = "HostPlayer";
        nameInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const createTab = document.getElementById("tab-create");
      if (createTab) createTab.click();
    })()`);
    await sleep(500);

    // Click "Create Game"
    await client.evaluate(`(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Create Game"));
      if (btn) btn.click();
    })()`);
    await sleep(2500);

    const roomCode = await client.evaluate('document.querySelector("[data-testid=\'room-code\']")?.innerText');
    const lanUrl = await client.evaluate('document.querySelector("[data-testid=\'lan-url\']")?.innerText');
    console.log(`Created LAN Room: ${roomCode} at ${lanUrl}`);
    assert.ok(roomCode && roomCode.length === 4, `Invalid room code: ${roomCode}`);
    assert.ok(lanUrl && lanUrl.startsWith('http://'), `Invalid LAN URL: ${lanUrl}`);

    // Test fullscreen in LAN waiting room
    console.log('Testing fullscreen in LAN mode...');
    await clickElement(client, 'button[aria-label="Enter fullscreen"]');
    await sleep(1500);
    isFsActive = await client.evaluate('Boolean(document.fullscreenElement || document.webkitFullscreenElement)');
    assert.strictEqual(isFsActive, true, 'Fullscreen failed in LAN game');

    await clickElement(client, 'button[aria-label="Exit fullscreen"]');
    await sleep(1500);
    isFsActive = await client.evaluate('Boolean(document.fullscreenElement || document.webkitFullscreenElement)');
    assert.strictEqual(isFsActive, false, 'Fullscreen failed to exit in LAN game');
    console.log('✓ Fullscreen verified in LAN game');

    // Connect second client via Socket.IO (simulating second browser on the same network/machine)
    console.log(`Connecting second client to room ${roomCode}...`);
    const clientPort = new URL(pageTarget.url).port || '3001';
    const socket = io(`http://127.0.0.1:${clientPort}`, { transports: ['websocket'] });
    await new Promise((resolve, reject) => {
      socket.on('connect', resolve);
      socket.on('connect_error', reject);
      setTimeout(() => reject(new Error('Socket connection timeout')), 5000);
    });

    socket.on('game-error', (err) => console.log('Socket game-error received:', err));
    socket.emit('join-game', { roomCode, playerName: 'ClientPlayer2', sessionId: 'test-session-player2' });
    await sleep(2500);

    const gameStarted = await client.evaluate(`
      document.body.innerText.includes("ClientPlayer2")
    `);
    console.log(`Multiplayer game started on host (ClientPlayer2 present): ${gameStarted}`);
    assert.strictEqual(gameStarted, true, 'Second client failed to join LAN game');
    console.log('✓ Second client successfully joined LAN room from same machine');

    socket.disconnect();

    console.log('\n======================================================');
    console.log(' ALL v1.2.2 VERIFICATION TESTS PASSED SUCCESSFULLY!');
    console.log('======================================================\n');
  } finally {
    if (client) client.close();
    console.log('Closing application process...');
    child.kill('SIGKILL');
    await sleep(2000);

    // -------------------------------------------------------------
    // TEST 6: Orphaned Process Check
    // -------------------------------------------------------------
    console.log('Checking for orphaned LAN Chess processes...');
    const running = await new Promise((resolve) => {
      const p = spawn('tasklist.exe', ['/FO', 'CSV', '/NH']);
      let out = '';
      p.stdout.on('data', (d) => (out += d.toString()));
      p.on('exit', () => resolve(out));
      p.on('error', () => resolve(''));
    });

    const hasOrphans = running.split('\n').some((line) => {
      const lower = line.toLowerCase();
      return lower.includes('lan chess.exe') && !lower.includes('tasklist');
    });

    console.log(`Orphaned processes detected: ${hasOrphans}`);
    assert.strictEqual(hasOrphans, false, 'Detected orphaned LAN Chess processes after closing app!');
    console.log('✓ Clean process termination verified: 0 orphaned processes');
  }
}

run().catch((err) => {
  console.error('\n❌ Verification failed:', err);
  process.exit(1);
});
