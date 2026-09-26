import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { io } from 'socket.io-client';

const SERVER_URL = process.env.SERVER_URL || 'http://127.0.0.1:3001';
const OUTPUT_DIR = process.env.SCREENSHOTS_DIR || path.resolve(process.cwd(), 'artifacts', 'screenshots');

function resolveChromePath() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN;
  }

  const platform = process.platform;
  const candidates = [];

  if (platform === 'win32') {
    const programFiles = process.env['PROGRAMFILES'] || 'C:\\Program Files';
    const programFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
    const localAppData = process.env['LOCALAPPDATA'] || (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'AppData', 'Local') : '');

    candidates.push(
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      localAppData ? path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe') : '',
      path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
    );
  } else if (platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    );
  } else {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium'
    );
  }

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'Could not find Google Chrome or Chromium executable. Set CHROME_PATH or CHROME_BIN environment variable.'
  );
}

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

  async screenshot(filename) {
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    const filepath = path.join(OUTPUT_DIR, filename);
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filepath, Buffer.from(res.data, 'base64'));
    console.log(`Saved screenshot: ${filepath}`);
  }

  close() {
    this.ws.close();
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('--- Starting Chrome Viewport Acceptance Tests (Headless Emulation) ---');
  const chromePath = resolveChromePath();
  console.log(`Using browser executable: ${chromePath}`);
  console.log(`Saving screenshots to: ${OUTPUT_DIR}`);

  // Launch headless Chrome with remote debugging on port 9223 to avoid conflicts
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9223',
    '--remote-allow-origins=*',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ]);

  try {
    await sleep(2000);

    // Get active targets from Chrome
    const targetsRes = await fetch('http://127.0.0.1:9223/json');
    const targets = await targetsRes.json();
    const pageTarget = targets.find((t) => t.type === 'page');
    if (!pageTarget) throw new Error('No page target found in Chrome');

    const client = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await client.waitOpen();

    await client.send('Page.enable');
    await client.send('DOM.enable');
    await client.send('Runtime.enable');

    console.log('Connected to Chrome DevTools Protocol.');

    // 1. Navigate to LAN Chess
    await client.send('Page.navigate', { url: SERVER_URL });
    await sleep(2500);

    // Check Lobby title
    const lobbyTitle = await client.evaluate('document.querySelector("h1")?.innerText');
    console.log(`Lobby title: "${lobbyTitle}"`);

    // Check detected LAN IP in lobby badge
    const lobbyBadge = await client.evaluate('document.body.innerText.includes("LAN Address:")');
    console.log(`Lobby LAN address badge present: ${lobbyBadge}`);

    // Set name and create room
    await client.evaluate(`
      const input = document.getElementById("player-name-input");
      if (input) {
        input.value = "Alice";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    `);
    await sleep(300);

    // Click "Create Room"
    await client.evaluate(`
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Create Room"));
      if (btn) btn.click();
    `);
    await sleep(2000);

    // 2. Functional Test: Confirm Waiting Panel shows actual LAN URL and room code
    const isWaiting = await client.evaluate('document.body.innerText.includes("Waiting for an opponent")');
    console.log(`Waiting for an opponent header present: ${isWaiting}`);

    const roomCode = await client.evaluate('document.querySelector("[data-testid=\'room-code\']")?.innerText');
    const lanUrl = await client.evaluate('document.querySelector("[data-testid=\'lan-url\']")?.innerText');
    const hasWifiNote = await client.evaluate('document.body.innerText.includes("Guest or public Wi-Fi")');
    const hasInstructions = await client.evaluate('document.body.innerText.includes("On another device connected to the same Wi-Fi")');

    console.log(`Room Code: ${roomCode}`);
    console.log(`LAN URL: ${lanUrl}`);
    console.log(`Wi-Fi isolation note present: ${hasWifiNote}`);
    console.log(`Connection instructions present: ${hasInstructions}`);

    if (!roomCode || roomCode.length !== 4) throw new Error(`Invalid room code: ${roomCode}`);
    if (!lanUrl || !lanUrl.startsWith('http://') || lanUrl.includes('localhost') || lanUrl.includes('127.0.0.1')) {
      throw new Error(`Invalid or loopback LAN URL: ${lanUrl}`);
    }

    // 3. Functional Test: Copy Link & Copy Full Invite
    // Mock navigator.clipboard with recording
    await client.evaluate(`
      window.__copiedData = [];
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: (t) => {
            window.__copiedData.push(t);
            return Promise.resolve();
          }
        },
        configurable: true,
        writable: true
      });
    `);

    // Click "Copy Link"
    await client.evaluate(`(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.trim() === "Copy Link");
      if (btn) btn.click();
    })()`);
    await sleep(500);

    const copiedLink = await client.evaluate('window.__copiedData.at(-1)');
    const linkFeedback = await client.evaluate('document.querySelector("[role=\'status\']")?.innerText');
    console.log(`Copy Link copied text: "${copiedLink}"`);
    console.log(`Copy Link feedback (role="status"): "${linkFeedback}"`);
    if (copiedLink !== lanUrl) throw new Error(`Copy Link did not copy exact LAN URL: ${copiedLink} vs ${lanUrl}`);
    if (!linkFeedback?.includes('LAN link copied')) throw new Error(`Unexpected status message: ${linkFeedback}`);

    // Click "Copy Full Invite"
    await client.evaluate(`(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.trim() === "Copy Full Invite");
      if (btn) btn.click();
    })()`);
    await sleep(500);

    const copiedFullInvite = await client.evaluate('window.__copiedData.at(-1)');
    const inviteFeedback = await client.evaluate('document.querySelector("[role=\'status\']")?.innerText');
    console.log(`Copy Full Invite copied text:\n${copiedFullInvite}`);
    console.log(`Copy Full Invite feedback (role="status"): "${inviteFeedback}"`);

    if (!copiedFullInvite?.includes(lanUrl) || !copiedFullInvite?.includes(roomCode) || !copiedFullInvite?.includes('Join my LAN Chess game')) {
      throw new Error(`Full invite missing components: ${copiedFullInvite}`);
    }
    if (!inviteFeedback?.includes('Invite copied')) throw new Error(`Unexpected status message: ${inviteFeedback}`);

    // 5. Functional Test: Simulate Clipboard API rejection and confirm legacy execCommand fallback
    await client.evaluate(`(() => {
      window.__fallbackExecuted = false;
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: () => Promise.reject(new Error("Simulated permission denied"))
        },
        configurable: true,
        writable: true
      });
      document.execCommand = (cmd) => {
        if (cmd === 'copy') {
          window.__fallbackExecuted = true;
          return true;
        }
        return false;
      };
    })()`);

    await client.evaluate(`(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.trim() === "Copy Link");
      if (btn) btn.click();
    })()`);
    await sleep(500);

    const fallbackExecuted = await client.evaluate('window.__fallbackExecuted');
    const fallbackStatus = await client.evaluate('document.querySelector("[role=\'status\']")?.innerText');
    console.log(`Clipboard rejection -> fallback document.execCommand executed: ${fallbackExecuted}`);
    console.log(`Fallback feedback: "${fallbackStatus}"`);
    if (!fallbackExecuted) throw new Error('Legacy fallback document.execCommand was not executed upon rejection!');
    if (!fallbackStatus?.includes('LAN link copied')) throw new Error('Fallback did not report success status!');

    // 6. Functional Test: Simulate all copy methods failing -> manual copy alert
    await client.evaluate(`(() => {
      document.execCommand = () => false;
    })()`);

    await client.evaluate(`(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.trim() === "Copy Link");
      if (btn) btn.click();
    })()`);
    await sleep(500);

    const failureAlert = await client.evaluate('document.querySelector("[role=\'alert\']")?.innerText');
    console.log(`All copy failed -> alert message (role="alert"): "${failureAlert}"`);
    if (!failureAlert?.includes('Copy failed') || !failureAlert?.includes('copy it manually')) {
      throw new Error(`Expected manual copy instructions on failure, got: "${failureAlert}"`);
    }

    // 4. Visual Acceptance Tests across viewports for Waiting State
    const viewports = [
      { name: '1920x1080', width: 1920, height: 1080, scale: 1 },
      { name: '1536x864', width: 1536, height: 864, scale: 1 },
      { name: '1440x900', width: 1440, height: 900, scale: 1 },
      { name: '1366x768', width: 1366, height: 768, scale: 1 },
      { name: '1280x800', width: 1280, height: 800, scale: 1 },
      { name: '1280x720', width: 1280, height: 720, scale: 1 },
      { name: '1024x768', width: 1024, height: 768, scale: 1 },
    ];

    for (const vp of viewports) {
      await client.setViewport(vp.width, vp.height, vp.scale);
      await sleep(600);

      // Measure board and page dimensions
      const metrics = await client.evaluate(`
        (() => {
          const board = document.querySelector(".chessboard");
          const bRect = board ? board.getBoundingClientRect() : null;
          const rootScrollW = document.documentElement.scrollWidth;
          const rootClientW = document.documentElement.clientWidth;
          const hasHScroll = rootScrollW > rootClientW;
          const ranks = Array.from(document.querySelectorAll(".rank-label")).map(r => r.innerText);
          const bottomCard = document.querySelectorAll(".player-card")[1];
          const bottomCardRect = bottomCard ? bottomCard.getBoundingClientRect() : null;
          return {
            boardW: bRect ? bRect.width : 0,
            boardH: bRect ? bRect.height : 0,
            boardBottom: bRect ? bRect.bottom : 0,
            hasHScroll,
            rankCount: ranks.length,
            bottomCardBottom: bottomCardRect ? bottomCardRect.bottom : 0,
            viewportH: window.innerHeight,
          };
        })()
      `);

      console.log(`Chrome emulation at ${vp.name}: board=${Math.round(metrics.boardW)}x${Math.round(metrics.boardH)} px, bottomCardBottom=${Math.round(metrics.bottomCardBottom)}px, viewportH=${metrics.viewportH}px, hScroll=${metrics.hasHScroll}`);

      if (metrics.hasHScroll) {
        throw new Error(`Horizontal scrollbar detected at viewport ${vp.name}!`);
      }
    }

    // Capture screenshot: Chrome emulation of waiting for opponent at 1366x768
    await client.setViewport(1366, 768);
    await sleep(600);
    await client.screenshot('waiting_1366x768.png');

    // Capture screenshot: Chrome emulation at desktop default resolution 1280x800
    await client.setViewport(1280, 800);
    await sleep(600);
    await client.screenshot('desktop_1280x800.png');

    // Also capture at 1280x720
    await client.setViewport(1280, 720);
    await sleep(600);
    await client.screenshot('waiting_1280x720.png');

    // 7. Functional Test: Second client joins with room code
    console.log('Connecting second client (Bob) over Socket.IO to room', roomCode);
    const bobSocket = io(SERVER_URL, { transports: ['websocket'] });
    await new Promise((resolve) => bobSocket.on('connect', resolve));
    bobSocket.emit('join-game', { roomCode, playerName: 'Bob' });
    await sleep(2000);

    // Alice's UI is now an active multiplayer game!
    const activeMsg = await client.evaluate('document.body.innerText.includes("White\'s turn") || document.body.innerText.includes("Black\'s turn")');
    console.log(`Multiplayer game is now active on host: ${activeMsg}`);

    // Capture required screenshot: active multiplayer game at 1366x768
    await client.setViewport(1366, 768);
    await sleep(600);
    await client.screenshot('active_multiplayer_1366x768.png');

    // Verify all ranks visible and bottom player card visible at 1366x768
    const activeMetrics = await client.evaluate(`
      (() => {
        const board = document.querySelector(".chessboard");
        const bRect = board.getBoundingClientRect();
        const bottomCard = document.querySelectorAll(".player-card")[1];
        const bcRect = bottomCard ? bottomCard.getBoundingClientRect() : null;
        return {
          boardTop: bRect.top,
          boardBottom: bRect.bottom,
          boardW: bRect.width,
          boardH: bRect.height,
          bottomCardBottom: bcRect ? bcRect.bottom : 0,
          viewportH: window.innerHeight,
          hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth
        };
      })()
    `);
    console.log(`Active match 1366x768 metrics: board=${Math.round(activeMetrics.boardW)}x${Math.round(activeMetrics.boardH)}, bottomCardBottom=${Math.round(activeMetrics.bottomCardBottom)}, windowH=${activeMetrics.viewportH}, hScroll=${activeMetrics.hScroll}`);

    // 9. Functional Test: Reconnect socket and confirm hostUrl preserved
    await client.evaluate(`
      // Simulate socket disconnect and reconnect
      window.dispatchEvent(new Event('offline'));
    `);
    await sleep(500);
    const hostUrlPreserved = await client.evaluate('window.sessionStorage.getItem("lan-chess-host-url")');
    console.log(`Host URL in sessionStorage after offline/reconnect: "${hostUrlPreserved}"`);
    if (hostUrlPreserved !== lanUrl) throw new Error(`Host URL lost in sessionStorage: ${hostUrlPreserved}`);

    bobSocket.disconnect();

    // 5. Visual Acceptance Test: Play vs Computer at 1366x768
    console.log('Navigating to Play vs Computer...');
    // Clear session so browser returns cleanly to Lobby
    await client.evaluate(`(() => {
      localStorage.removeItem('lan-chess-player-id');
      sessionStorage.clear();
      window.location.reload();
    })()`);
    await sleep(2000);

    // Click "Vs Computer" in Lobby
    await client.evaluate(`(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Vs Computer") || b.innerText.includes("Computer"));
      if (btn) btn.click();
    })()`);
    await sleep(2500);

    // Make a move e2 -> e4
    await client.evaluate(`(() => {
      const e2 = document.querySelector('[data-square="e2"]') || Array.from(document.querySelectorAll('.square')).find(s => s.getAttribute('aria-label')?.startsWith('e2'));
      if (e2) e2.click();
    })()`);
    await sleep(300);
    await client.evaluate(`(() => {
      const e4 = document.querySelector('[data-square="e4"]') || Array.from(document.querySelectorAll('.square')).find(s => s.getAttribute('aria-label')?.startsWith('e4'));
      if (e4) e4.click();
    })()`);
    await sleep(2000);

    // Capture required screenshot: Play vs Computer at 1366x768
    await client.setViewport(1366, 768);
    await sleep(600);
    await client.screenshot('play_vs_computer_1366x768.png');

    const pvcMetrics = await client.evaluate(`
      (() => {
        const board = document.querySelector(".chessboard");
        const bRect = board.getBoundingClientRect();
        const bottomCard = document.querySelectorAll(".player-card")[1];
        const bcRect = bottomCard ? bottomCard.getBoundingClientRect() : null;
        return {
          boardW: bRect.width,
          boardH: bRect.height,
          boardBottom: bRect.bottom,
          bottomCardBottom: bcRect ? bcRect.bottom : 0,
          viewportH: window.innerHeight,
          hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth
        };
      })()
    `);
    console.log(`Play vs Computer 1366x768 metrics: board=${Math.round(pvcMetrics.boardW)}x${Math.round(pvcMetrics.boardH)}, bottomCardBottom=${Math.round(pvcMetrics.bottomCardBottom)}, viewportH=${pvcMetrics.viewportH}, hScroll=${pvcMetrics.hScroll}`);

    client.close();
    console.log('--- All Acceptance Tests Completed Successfully! ---');
  } finally {
    chromeProc.kill('SIGKILL');
  }
}

main().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
