import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const INSTALLED_EXE = process.env.INSTALLED_EXE || path.join(
  process.env.LOCALAPPDATA || '',
  'Programs',
  'LAN Chess',
  'LAN Chess.exe'
);

const OUTPUT_DIR = process.env.SCREENSHOTS_DIR || path.resolve(process.cwd(), 'artifacts', 'screenshots');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
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

  async screenshot(filename) {
    const filepath = path.join(OUTPUT_DIR, filename);
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filepath, Buffer.from(res.data, 'base64'));
    console.log(`Saved screenshot: ${filepath}`);
    return filepath;
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
    this.ws.close();
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== Testing Installed Electron App (v1.1.1) ===');
  console.log(`Executable: ${INSTALLED_EXE}`);
  if (!fs.existsSync(INSTALLED_EXE)) {
    throw new Error(`Installed executable not found at: ${INSTALLED_EXE}`);
  }

  // Launch the installed Electron executable with remote debugging on port 9224
  const electronProc = spawn(INSTALLED_EXE, [
    '--remote-debugging-port=9224',
    '--no-sandbox',
  ], {
    detached: false,
    stdio: 'ignore',
  });

  try {
    console.log('Waiting for installed Electron app and bundled server to initialize...');
    let targets = null;
    for (let i = 0; i < 20; i++) {
      await sleep(1000);
      try {
        const res = await fetch('http://127.0.0.1:9224/json');
        if (res.ok) {
          targets = await res.json();
          if (targets.some((t) => t.type === 'page' && t.url.includes('http://127.0.0.1:'))) {
            break;
          }
        }
      } catch {
        // retry
      }
    }

    if (!targets) {
      throw new Error('Failed to connect to installed Electron app on port 9224 after 20s');
    }

    const pageTarget = targets.find((t) => t.type === 'page' && t.url.includes('http://127.0.0.1:'));
    if (!pageTarget) {
      throw new Error(`No active app page target found in Electron: ${JSON.stringify(targets)}`);
    }

    console.log(`Connected to installed Electron window target at: ${pageTarget.url}`);
    const client = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await client.waitOpen();

    await client.send('Page.enable');
    await client.send('DOM.enable');
    await client.send('Runtime.enable');

    await sleep(2000);

    // 1. Verify Electron preload desktop bridge is present
    const hasDesktopBridge = await client.evaluate('typeof window.desktop !== "undefined" && typeof window.desktop.copyText === "function"');
    console.log(`Electron preload IPC desktop bridge (copyText) active: ${hasDesktopBridge}`);
    if (!hasDesktopBridge) {
      throw new Error('Installed Electron app missing desktop.copyText preload bridge!');
    }

    // 2. Measure default window dimensions
    const initialDims = await client.evaluate(`({ width: window.innerWidth, height: window.innerHeight, outerW: window.outerWidth, outerH: window.outerHeight })`);
    console.log(`Installed Electron window dimensions: outer=${initialDims.outerW}x${initialDims.outerH}, inner=${initialDims.width}x${initialDims.height}`);

    // Set player name and create room
    await client.evaluate(`
      const input = document.getElementById("player-name-input");
      if (input) {
        input.value = "ElectronHost";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    `);
    await sleep(300);

    // Click "Create Room"
    await client.evaluate(`
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Create Room"));
      if (btn) btn.click();
    `);
    await sleep(2500);

    // 3. Verify Waiting Panel in Installed Electron App
    const isWaiting = await client.evaluate('document.body.innerText.includes("Waiting for an opponent")');
    console.log(`Waiting for an opponent panel displayed: ${isWaiting}`);
    if (!isWaiting) throw new Error('Waiting for opponent panel was not displayed in Electron app!');

    const roomCode = await client.evaluate('document.querySelector("[data-testid=\'room-code\']")?.innerText');
    const lanUrl = await client.evaluate('document.querySelector("[data-testid=\'lan-url\']")?.innerText');
    const hasWifiNote = await client.evaluate('document.body.innerText.includes("Guest or public Wi-Fi")');

    console.log(`Installed Electron Room Code: ${roomCode}`);
    console.log(`Installed Electron Visible LAN URL: ${lanUrl}`);
    console.log(`Wi-Fi isolation advisory note present: ${hasWifiNote}`);

    if (!roomCode || roomCode.length !== 4) throw new Error(`Invalid room code in Electron: ${roomCode}`);
    if (!lanUrl || !lanUrl.startsWith('http://') || lanUrl.includes('localhost') || lanUrl.includes('127.0.0.1')) {
      throw new Error(`Invalid or non-LAN URL in Electron: ${lanUrl}`);
    }

    // 4. Test Copy Link via native desktop IPC
    await client.evaluate(`
      const copyLinkBtn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.trim() === "Copy Link");
      if (copyLinkBtn) copyLinkBtn.click();
    `);
    await sleep(500);

    const linkStatusText = await client.evaluate('document.querySelector("[role=\'status\']")?.innerText');
    console.log(`Copy Link feedback in Electron (role="status"): "${linkStatusText}"`);
    if (!linkStatusText?.includes('LAN link copied')) {
      throw new Error(`Expected 'LAN link copied' feedback, got: "${linkStatusText}"`);
    }

    // 5. Test Copy Full Invite via native desktop IPC
    await client.evaluate(`
      const copyFullBtn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.trim() === "Copy Full Invite");
      if (copyFullBtn) copyFullBtn.click();
    `);
    await sleep(500);

    const inviteStatusText = await client.evaluate('document.querySelector("[role=\'status\']")?.innerText');
    console.log(`Copy Full Invite feedback in Electron (role="status"): "${inviteStatusText}"`);
    if (!inviteStatusText?.includes('Invite copied')) {
      throw new Error(`Expected 'Invite copied' feedback, got: "${inviteStatusText}"`);
    }

    // 6. Visual verification at 1280x800 in installed Electron
    const metrics1280x800 = await client.evaluate(`
      (() => {
        const board = document.querySelector(".chessboard");
        const bRect = board ? board.getBoundingClientRect() : null;
        const bottomCard = document.querySelectorAll(".player-card")[1];
        const bcRect = bottomCard ? bottomCard.getBoundingClientRect() : null;
        const ranks = Array.from(document.querySelectorAll(".rank-label")).map(r => r.innerText);
        const files = Array.from(document.querySelectorAll(".file-label")).map(f => f.innerText);
        return {
          boardW: bRect ? bRect.width : 0,
          boardH: bRect ? bRect.height : 0,
          boardBottom: bRect ? bRect.bottom : 0,
          bottomCardBottom: bcRect ? bcRect.bottom : 0,
          viewportH: window.innerHeight,
          viewportW: window.innerWidth,
          rankCount: ranks.length,
          fileCount: files.length,
          hasHScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          hasVScroll: document.documentElement.scrollHeight > document.documentElement.clientHeight,
        };
      })()
    `);

    console.log('Metrics at 1280x800 in Installed Electron:', {
      boardSize: `${Math.round(metrics1280x800.boardW)}x${Math.round(metrics1280x800.boardH)}`,
      boardBottom: `${Math.round(metrics1280x800.boardBottom)}px`,
      bottomCardBottom: `${Math.round(metrics1280x800.bottomCardBottom)}px`,
      viewportH: `${metrics1280x800.viewportH}px`,
      horizontalScroll: metrics1280x800.hasHScroll,
      verticalScroll: metrics1280x800.hasVScroll,
      rankLabels: metrics1280x800.rankCount,
      fileLabels: metrics1280x800.fileCount,
    });

    if (metrics1280x800.hasHScroll) {
      throw new Error('Horizontal scrollbar detected in installed Electron at 1280x800!');
    }
    if (metrics1280x800.bottomCardBottom > metrics1280x800.viewportH) {
      throw new Error(`Bottom player card pushed below viewport fold at 1280x800: ${metrics1280x800.bottomCardBottom} > ${metrics1280x800.viewportH}`);
    }

    await client.screenshot('installed_electron_1280x800.png');

    // 7. Visual verification at smaller effective viewport (1024x680 / Windows scaling)
    console.log('Testing installed Electron at smaller effective viewport (1024x680)...');
    await client.setViewport(1024, 680);
    await sleep(600);

    const metricsSmall = await client.evaluate(`
      (() => {
        const board = document.querySelector(".chessboard");
        const bRect = board ? board.getBoundingClientRect() : null;
        const bottomCard = document.querySelectorAll(".player-card")[1];
        const bcRect = bottomCard ? bottomCard.getBoundingClientRect() : null;
        return {
          boardW: bRect ? bRect.width : 0,
          boardH: bRect ? bRect.height : 0,
          boardBottom: bRect ? bRect.bottom : 0,
          bottomCardBottom: bcRect ? bcRect.bottom : 0,
          viewportH: window.innerHeight,
          viewportW: window.innerWidth,
          hasHScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      })()
    `);

    console.log('Metrics at 1024x680 in Installed Electron:', {
      boardSize: `${Math.round(metricsSmall.boardW)}x${Math.round(metricsSmall.boardH)}`,
      boardBottom: `${Math.round(metricsSmall.boardBottom)}px`,
      bottomCardBottom: `${Math.round(metricsSmall.bottomCardBottom)}px`,
      viewportH: `${metricsSmall.viewportH}px`,
      horizontalScroll: metricsSmall.hasHScroll,
    });

    if (metricsSmall.hasHScroll) {
      throw new Error('Horizontal scrollbar detected in installed Electron at 1024x680!');
    }

    await client.screenshot('installed_electron_small_viewport.png');

    client.close();
    console.log('=== Installed Electron App Validation Completed Successfully! ===');
  } finally {
    try {
      electronProc.kill();
    } catch {
      // ignore
    }
  }
}

main().catch((err) => {
  console.error('Installed Electron App Test Failed:', err);
  process.exit(1);
});
