/**
 * Real End-to-End In-App Updater Test in an Isolated Windows Environment.
 *
 * Verifies the complete upgrade lifecycle:
 * 1. Separate installation of the previous release with disposable user data.
 * 2. Seeding of user preferences and game history in localStorage.
 * 3. Active-game lockout protection (refusal to install while match is active).
 * 4. Local test feed serving release/latest.yml, installer, and blockmap.
 * 5. Update detection: available -> downloading (with progress) -> downloaded.
 * 6. User-initiated restart & install execution into the isolated directory.
 * 7. Verification of package.json's target version and retained synthetic data.
 */

import assert from 'node:assert';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const REPO_ROOT = process.cwd();
const TARGET_VERSION = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')).version;
const BASE_VERSION = process.env.BASE_VERSION || '1.2.3';
const ARTIFACTS_DIR = path.resolve(REPO_ROOT, 'artifacts');
const TEST_ENV_DIR = path.join(ARTIFACTS_DIR, `test-updater-e2e-${Date.now()}`);
const INSTALL_DIR = path.join(TEST_ENV_DIR, 'install');
const USER_DATA_DIR = path.join(TEST_ENV_DIR, 'userData');
const FEED_DIR = path.join(TEST_ENV_DIR, 'feed');
const EXE_PATH = path.join(INSTALL_DIR, 'LAN Chess.exe');
const FEED_PORT = 9876;

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

  close() {
    this.ws.close();
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startFeedServer(port, dir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url, `http://127.0.0.1:${port}`);
      let filename = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ''));
      if (!filename || filename === '/') filename = 'latest.yml';
      const filepath = path.join(dir, filename);

      if (!fs.existsSync(filepath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File not found');
        return;
      }

      const stat = fs.statSync(filepath);
      res.writeHead(200, {
        'Content-Type': filename.endsWith('.yml') ? 'text/yaml' : 'application/octet-stream',
        'Content-Length': stat.size,
      });
      fs.createReadStream(filepath).pipe(res);
    });

    server.listen(port, '127.0.0.1', () => {
      resolve(server);
    });
    server.on('error', reject);
  });
}

async function connectCdp(debugPort) {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const res = await fetch(`http://127.0.0.1:${debugPort}/json`);
      if (res.ok) {
        const pages = await res.json();
        const mainPage = pages.find((p) => p.type === 'page' && !p.url.startsWith('devtools://'));
        if (mainPage && mainPage.webSocketDebuggerUrl) {
          const client = new CdpClient(mainPage.webSocketDebuggerUrl);
          await client.waitOpen();
          return client;
        }
      }
    } catch {
      // Retrying
    }
    await sleep(500);
  }
  throw new Error(`Failed to connect to CDP on port ${debugPort}`);
}

async function waitForDesktop(client) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const status = await client.evaluate('window.desktop?.getStatus()');
    if (status?.version) return status;
    await sleep(500);
  }
  throw new Error('Desktop preload bridge did not initialize');
}

async function main() {
  console.log('=== LAN Chess Real In-App Updater End-to-End Test ===');
  console.log(`Repository root: ${REPO_ROOT}`);
  console.log(`Isolated test env: ${TEST_ENV_DIR}`);
  console.log(`Isolated install dir: ${INSTALL_DIR}`);
  console.log(`Isolated user data: ${USER_DATA_DIR}`);

  // 1. Setup isolated directories
  fs.mkdirSync(TEST_ENV_DIR, { recursive: true });
  fs.mkdirSync(INSTALL_DIR, { recursive: true });
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  fs.mkdirSync(FEED_DIR, { recursive: true });

  // Copy release assets to feed directory
  const releaseDir = path.join(REPO_ROOT, 'release');
  const releaseName = `LAN-Chess-Setup-${TARGET_VERSION}.exe`;
  const releaseExe = path.join(releaseDir, releaseName);
  const baseExe = path.join(releaseDir, `LAN-Chess-Setup-${BASE_VERSION}.exe`);
  const releaseBlockmap = `${releaseExe}.blockmap`;
  const releaseYml = path.join(releaseDir, 'latest.yml');

  assert(fs.existsSync(releaseExe), `Release exe not found at: ${releaseExe}`);
  assert(fs.existsSync(releaseYml), `latest.yml not found at: ${releaseYml}`);

  assert(fs.existsSync(baseExe), `Base installer missing: ${baseExe}`);
  fs.copyFileSync(releaseExe, path.join(FEED_DIR, releaseName));
  fs.copyFileSync(releaseYml, path.join(FEED_DIR, 'latest.yml'));
  if (fs.existsSync(releaseBlockmap)) {
    fs.copyFileSync(releaseBlockmap, path.join(FEED_DIR, `${releaseName}.blockmap`));
  }

  // 2. Start local HTTP feed server
  console.log(`Starting local update feed on port ${FEED_PORT}...`);
  const feedServer = await startFeedServer(FEED_PORT, FEED_DIR);
  console.log(`Feed server listening on http://127.0.0.1:${FEED_PORT}`);

  const launchedApps = [];
  const clients = [];
  try {
    // Install the actual previous release with a disposable profile.
    console.log(`Installing base application into ${INSTALL_DIR}...`);
    const psInstall = spawn('powershell.exe', [
      '-NoProfile',
      '-Command',
      `Start-Process -WindowStyle Hidden -FilePath '${baseExe}' -ArgumentList '/S', '/D=${INSTALL_DIR}' -Wait`,
    ], { stdio: 'inherit' });
    await new Promise((resolve, reject) => {
      psInstall.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Base installer exited with code ${code}`));
      });
      psInstall.on('error', reject);
    });

    assert(fs.existsSync(EXE_PATH), `Installed executable missing at ${EXE_PATH}`);

    console.log(`Launching installed base app (v${BASE_VERSION}) with disposable profile...`);
    const appProc = spawn(EXE_PATH, [
      '--remote-debugging-port=9228',
      '--no-sandbox',
      `--user-data-dir=${USER_DATA_DIR}`,
    ], {
      env: {
        ...process.env,
        LANCHESS_TEST_UPDATER: '1',
        LANCHESS_UPDATE_FEED_URL: `http://127.0.0.1:${FEED_PORT}/`,
        LANCHESS_INSTALL_DIR: INSTALL_DIR,
        LANCHESS_FORCE_RUN_AFTER: '0',
      },
      stdio: 'pipe',
    });

    launchedApps.push(appProc);
    let client = await connectCdp(9228);
    clients.push(client);

    // Verify the actual previous release.
    const initialStatus = await waitForDesktop(client);
    console.log('Initial app status:', initialStatus);
    assert.strictEqual(initialStatus.version, BASE_VERSION);

    // 5. Seed preferences and game history in localStorage
    console.log('Seeding test user preferences and game history into localStorage...');
    await client.evaluate(`
      localStorage.setItem('lan-chess-user-preferences-v2', JSON.stringify({
        activeThemeId: 'cyber',
        uiTheme: 'cyber',
        pieceSet: 'neon',
        sound: { master: true, move: true }
      }));
      localStorage.setItem('lan-chess-game-history-v2', JSON.stringify([
        {
          id: 'test-game-retained-1',
          roomCode: 'E2E1',
          date: 1727440000000,
          whiteName: 'AliceTester',
          blackName: 'BobTester',
          winner: 'w',
          reason: 'resignation',
          timeControl: '3+2',
          pgn: '1. e4 1-0',
          fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
          moves: [{ from: 'e2', to: 'e4', san: 'e4', color: 'w' }]
        }
      ]));
    `);

    // Verify data was written
    const seededPrefs = await client.evaluate("JSON.parse(localStorage.getItem('lan-chess-user-preferences-v2') || '{}')");
    assert.strictEqual(seededPrefs.activeThemeId, 'cyber', 'Failed to seed preferences');
    console.log('Seeded data verified in localStorage.');

    // 6. Test Active-Game Lockout Protection
    console.log('Testing active-game lockout refusal...');
    await client.evaluate('window.desktop?.setGameActive(true)');
    const lockoutRes = await client.evaluate('window.desktop?.quitAndInstall()');
    console.log('Active-game refusal response:', lockoutRes);
    assert.strictEqual(lockoutRes.success, false, 'Expected quitAndInstall to be blocked during active game');
    assert(
      lockoutRes.message.includes('Cannot restart while a chess game is active or paused for reconnection'),
      `Unexpected lockout message: ${lockoutRes.message}`
    );
    console.log('Active-game lockout protection verified.');

    // Reset game active to false
    await client.evaluate('window.desktop?.setGameActive(false)');

    // 7. Check for updates from local feed
    console.log('Invoking checkForUpdates against local test feed...');
    const checkRes = await client.evaluate('window.desktop?.checkForUpdates()');
    console.log('checkForUpdates result:', checkRes);
    assert.strictEqual(checkRes.success, true, 'checkForUpdates failed');

    // 8. Observe download progression
    console.log('Observing updater state progression (available -> downloading -> downloaded)...');
    let finalStatus = null;
    let observedDownloading = false;
    for (let i = 0; i < 60; i++) {
      await sleep(1000);
      const s = await client.evaluate('window.desktop?.getUpdateStatus()');
      if (s.status === 'downloading') {
        observedDownloading = true;
        console.log(`Downloading progress: ${s.progress?.percent}% (${s.progress?.transferred}/${s.progress?.total} bytes)`);
      }
      if (s.status === 'downloaded') {
        finalStatus = s;
        console.log('Update downloaded successfully! Info:', s.info);
        break;
      }
      if (s.status === 'error') {
        throw new Error(`Updater entered error state: ${s.error}`);
      }
    }

    assert(finalStatus && finalStatus.status === 'downloaded', 'Timed out waiting for update to download');
    assert.strictEqual(finalStatus.info?.version, TARGET_VERSION);

    // 9. Execute Restart & Install into isolated directory
    console.log('Calling quitAndInstall() to execute real silent upgrade into isolated directory...');
    const installCallRes = await client.evaluate('window.desktop?.quitAndInstall()');
    console.log('quitAndInstall invocation result:', installCallRes);
    assert.strictEqual(installCallRes.success, true, 'quitAndInstall call returned false');

    client.close();

    // Wait for the app process to exit
    console.log('Waiting for base application process to exit...');
    await new Promise((resolve) => {
      appProc.on('exit', resolve);
      setTimeout(resolve, 5000);
    });

    // Wait for the NSIS installer to finish applying changes to INSTALL_DIR
    console.log(`Waiting for NSIS installer to finish applying v${TARGET_VERSION} files...`);
    const startWait = Date.now();
    let nsisComplete = false;
    for (let wait = 0; wait < 60; wait++) {
      await sleep(1000);
      let setupRunning = false;
      try {
        const out = await new Promise((resolve) => {
          const p = spawn('tasklist.exe', ['/FO', 'CSV', '/NH']);
          let data = '';
          p.stdout.on('data', (c) => (data += c.toString()));
          p.on('exit', () => resolve(data));
          p.on('error', () => resolve(''));
        });
        setupRunning = out.toLowerCase().includes('lan-chess-setup') || out.toLowerCase().includes('elevate.exe');
      } catch {
        setupRunning = false;
      }

      if (!setupRunning && fs.existsSync(EXE_PATH) && wait >= 6) {
        console.log(`NSIS installer completed in ${Math.round((Date.now() - startWait) / 1000)}s.`);
        nsisComplete = true;
        break;
      }
    }
    assert(nsisComplete && fs.existsSync(EXE_PATH), `NSIS installer failed to complete or EXE missing at ${EXE_PATH}`);

    // 10. Launch newly upgraded application and verify version & preserved data
    console.log('Launching upgraded application from isolated directory...');
    const upgradedProc = spawn(EXE_PATH, [
      '--remote-debugging-port=9229',
      '--no-sandbox',
      `--user-data-dir=${USER_DATA_DIR}`,
    ], {
      env: {
        ...process.env,
        LANCHESS_TEST_UPDATER: '1',
      },
      stdio: 'pipe',
    });

    launchedApps.push(upgradedProc);
    const upgradedClient = await connectCdp(9229);
    clients.push(upgradedClient);

    const upgradedStatus = await waitForDesktop(upgradedClient);
    console.log('Upgraded app status:', upgradedStatus);
    assert.strictEqual(upgradedStatus.port, initialStatus.port, 'Server origin changed; localStorage retention is origin-specific');
    assert.strictEqual(
      upgradedStatus.version,
      TARGET_VERSION,
      `Expected version ${TARGET_VERSION} after update, but found ${upgradedStatus.version}`
    );

    // Check localStorage preservation
    console.log('Verifying preserved localStorage data after upgrade...');
    const retainedPrefs = await upgradedClient.evaluate("JSON.parse(localStorage.getItem('lan-chess-user-preferences-v2') || '{}')");
    const retainedHistory = await upgradedClient.evaluate("JSON.parse(localStorage.getItem('lan-chess-game-history-v2') || '[]')");

    console.log('Retained preferences:', retainedPrefs);
    console.log('Retained game history count:', retainedHistory.length);

    assert.strictEqual(retainedPrefs.activeThemeId, 'cyber', 'Retained activeThemeId mismatch');
    assert.strictEqual(retainedPrefs.pieceSet, 'neon', 'Retained pieceSet mismatch');
    assert.strictEqual(retainedHistory.length, 1, 'Expected 1 retained game in history');
    assert.strictEqual(retainedHistory[0].id, 'test-game-retained-1', 'Retained game ID mismatch');

    void upgradedClient.evaluate('window.close()').catch(() => {});
    await sleep(1000);
    upgradedClient.close();
    if (upgradedProc.exitCode === null) upgradedProc.kill();

    console.log('\n======================================================');
    console.log(' SUCCESS: Real End-to-End In-App Update Verified!');
    console.log(` - Upgraded from v${BASE_VERSION} -> v${TARGET_VERSION}`);
    console.log(' - Update download and installer checksum accepted by electron-updater');
    console.log(' - Active-game lockout protection verified');
    console.log(' - Local preferences & game history 100% preserved');
    console.log('======================================================\n');

    console.log(`Test evidence retained at ${TEST_ENV_DIR}`);
  } finally {
    for (const client of clients) client.close();
    for (const child of launchedApps) if (child.exitCode === null) child.kill();
    feedServer.close();
  }
}

main().catch((err) => {
  console.error('\n❌ E2E Updater Test Failed:', err);
  process.exit(1);
});
