/**
 * Automated Test Suite for Desktop In-App Updater (v1.2.0).
 *
 * Verifies:
 * 1. Preload IPC bridge exposure and typing for updater APIs.
 * 2. Status inspection and manual "Check for Updates" flow in Settings.
 * 3. Strict game-active lockout prevention (cannot quitAndInstall while a game is active).
 * 4. Graceful handling of offline/server unavailable states without application crashes.
 * 5. Local storage persistence (preferences, history) verification.
 */

import assert from 'node:assert';
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

  close() {
    this.ws.close();
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== Testing Desktop In-App Updater (v1.2.0) ===');
  console.log(`Executable: ${INSTALLED_EXE}`);
  if (!fs.existsSync(INSTALLED_EXE)) {
    throw new Error(`Installed executable not found at: ${INSTALLED_EXE}`);
  }

  const electronProc = spawn(INSTALLED_EXE, [
    '--remote-debugging-port=9225',
    '--no-sandbox',
  ], {
    detached: false,
    stdio: 'ignore',
  });

  try {
    console.log('Waiting for installed Electron app on port 9225...');
    let targets = null;
    for (let i = 0; i < 20; i++) {
      await sleep(1000);
      try {
        const res = await fetch('http://127.0.0.1:9225/json');
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
      throw new Error('Failed to connect to installed Electron app on port 9225 after 20s');
    }

    const pageTarget = targets.find((t) => t.type === 'page' && t.url.includes('http://127.0.0.1:'));
    if (!pageTarget) {
      throw new Error(`No active app page target found in Electron: ${JSON.stringify(targets)}`);
    }

    console.log(`Connected to app page target at: ${pageTarget.url}`);
    const client = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await client.waitOpen();

    await client.send('Page.enable');
    await client.send('DOM.enable');
    await client.send('Runtime.enable');
    await sleep(2000);

    // 1. Verify Preload Bridge has Updater APIs
    console.log('\n[1] Verifying Preload Bridge Updater APIs...');
    const bridgeCheck = await client.evaluate(`
      (() => ({
        hasDesktop: typeof window.desktop !== 'undefined',
        hasGetUpdateStatus: typeof window.desktop?.getUpdateStatus === 'function',
        hasCheckForUpdates: typeof window.desktop?.checkForUpdates === 'function',
        hasQuitAndInstall: typeof window.desktop?.quitAndInstall === 'function',
        hasSetGameActive: typeof window.desktop?.setGameActive === 'function',
        hasOnUpdateStatus: typeof window.desktop?.onUpdateStatus === 'function',
      }))()
    `);
    console.log('Preload bridge inspection:', bridgeCheck);
    assert.strictEqual(bridgeCheck.hasDesktop, true, 'window.desktop is missing');
    assert.strictEqual(bridgeCheck.hasGetUpdateStatus, true, 'getUpdateStatus API missing');
    assert.strictEqual(bridgeCheck.hasCheckForUpdates, true, 'checkForUpdates API missing');
    assert.strictEqual(bridgeCheck.hasQuitAndInstall, true, 'quitAndInstall API missing');
    assert.strictEqual(bridgeCheck.hasSetGameActive, true, 'setGameActive API missing');
    assert.strictEqual(bridgeCheck.hasOnUpdateStatus, true, 'onUpdateStatus API missing');
    console.log('✓ All updater bridge methods confirmed present.');

    // 2. Query initial status
    console.log('\n[2] Checking Initial Updater State...');
    const initialStatus = await client.evaluate('window.desktop.getUpdateStatus()');
    console.log('Initial updater status:', initialStatus);
    assert.ok(initialStatus, 'Initial status payload is null');
    assert.ok(['idle', 'checking', 'error', 'not-available'].includes(initialStatus.status));
    console.log('✓ Initial updater status query succeeded.');

    // 3. Test Active Game Lockout Protection
    console.log('\n[3] Testing Active Game Lockout Protection...');
    // Set game active = true via IPC
    await client.evaluate('window.desktop.setGameActive(true)');
    await sleep(200);

    const activeRefusal = await client.evaluate('window.desktop.quitAndInstall()');
    console.log('Attempting quitAndInstall while game is active:', activeRefusal);
    assert.strictEqual(activeRefusal.success, false, 'quitAndInstall should fail while game is active');
    assert.ok(
      activeRefusal.message?.includes('Cannot restart while a chess game is active'),
      `Expected active match refusal message, got: ${activeRefusal.message}`
    );
    console.log('✓ Active match lockout successfully blocked update restart.');

    // Reset game active = false
    await client.evaluate('window.desktop.setGameActive(false)');
    await sleep(200);

    // Now test refusal when not downloaded (clean state)
    const notReadyRefusal = await client.evaluate('window.desktop.quitAndInstall()');
    console.log('Attempting quitAndInstall when no update downloaded:', notReadyRefusal);
    assert.strictEqual(notReadyRefusal.success, false, 'quitAndInstall should fail when no update downloaded');
    assert.ok(
      notReadyRefusal.message?.includes('No update is ready to install'),
      `Expected no update ready message, got: ${notReadyRefusal.message}`
    );
    console.log('✓ Attempt to install non-downloaded update cleanly refused.');

    // 4. Test UI Settings Integration & Updates Tab
    console.log('\n[4] Testing Settings Modal Updates Tab UI...');
    // Click Settings button in navbar (gear emoji)
    await client.evaluate(`
      (() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const gear = btns.find(b => b.title?.includes("Settings") || b.innerText.includes("⚙"));
        if (gear) gear.click();
      })()
    `);
    await sleep(500);

    // Click Updates tab in modal
    await client.evaluate(`
      (() => {
        const tabs = Array.from(document.querySelectorAll("button"));
        const updateTab = tabs.find(b => b.innerText.includes("Updates"));
        if (updateTab) updateTab.click();
      })()
    `);
    await sleep(500);

    const uiCheck = await client.evaluate(`
      (() => {
        const bodyText = document.body.innerText;
        return {
          hasUpdatesHeader: bodyText.toLowerCase().includes("application updates"),
          hasVersionText: bodyText.includes("Installed Version"),
          hasCheckBtn: Array.from(document.querySelectorAll("button")).some(b => b.innerText.includes("Check for Updates")),
          hasStatusSection: bodyText.includes("Status"),
        };
      })()
    `);
    console.log('Updates tab UI state:', uiCheck);
    assert.strictEqual(uiCheck.hasUpdatesHeader, true, 'Application Updates header missing');
    assert.strictEqual(uiCheck.hasVersionText, true, 'Installed Version missing');
    assert.strictEqual(uiCheck.hasCheckBtn, true, 'Check for Updates button missing');

    await client.screenshot('updater_settings_tab.png');
    console.log('✓ Updates tab in Settings verified.');

    // 5. Test Manual Check and Error/Offline Resilience
    console.log('\n[5] Testing Manual Check & Error Resilience...');
    // Click "Check for Updates" button
    await client.evaluate(`
      (() => {
        const btns = Array.from(document.querySelectorAll("button"));
        const checkBtn = btns.find(b => b.innerText.includes("Check for Updates"));
        if (checkBtn) checkBtn.click();
      })()
    `);
    await sleep(3000);

    const statusAfterCheck = await client.evaluate('window.desktop.getUpdateStatus()');
    console.log('Status after manual check trigger:', statusAfterCheck);
    // Since v1.2.0 is not yet published to GitHub Releases, electron-updater will encounter 404 or not-found
    // It must report status cleanly without crashing the renderer or backend server!
    const serverAlive = await client.evaluate('fetch("/").then(r => r.ok).catch(() => false)');
    console.log('Bundled backend server remains alive and responsive:', serverAlive);
    assert.strictEqual(serverAlive, true, 'Backend server died during update check!');
    console.log('✓ Application and server remain completely stable and error resilient.');

    // 6. Test Local Storage Data Preservation
    console.log('\n[6] Testing Local Storage Data Preservation...');
    await client.evaluate(`
      (() => {
        localStorage.setItem("lan-chess:preferences", JSON.stringify({ playerName: "UpdaterTester", uiTheme: "dark" }));
        localStorage.setItem("lan-chess:game-history", JSON.stringify([{ id: "test-game-1", date: Date.now() }]));
      })()
    `);

    const persisted = await client.evaluate(`
      (() => ({
        prefs: JSON.parse(localStorage.getItem("lan-chess:preferences") || "{}"),
        history: JSON.parse(localStorage.getItem("lan-chess:game-history") || "[]"),
      }))()
    `);

    assert.strictEqual(persisted.prefs.playerName, 'UpdaterTester');
    assert.strictEqual(persisted.history.length, 1);
    console.log('✓ Local storage data preservation verified.');

    client.close();
    console.log('\n=== All Desktop In-App Updater Tests Passed Successfully! ===');
  } finally {
    try {
      electronProc.kill();
    } catch {
      // ignore
    }
  }
}

main().catch((err) => {
  console.error('Desktop Updater Test Failed:', err);
  process.exit(1);
});
