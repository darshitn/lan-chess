/**
 * LAN Chess — Electron main process.
 *
 * Role (deliberately thin): desktop window + local server lifecycle.
 * It is NOT the game engine: all multiplayer state, chess rules, and clocks
 * live in the bundled Node/Express server (Room Manager + chess.js), reached
 * by the React UI over Socket.IO exactly like the browser version.
 */
const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const http = require('node:http');
const {
  pickPort,
  parseConnectArg,
  isAllowedNavigation,
  isSafeExternalUrl,
  resolveIconPath,
} = require('./desktop-utils.cjs');

const PREFERRED_PORT = 3001;
const SERVER_READY_TIMEOUT_MS = 15000;

let serverProcess = null;
let serverPort = null;
let mainWindow = null;
let quitting = false;

const isDev = !app.isPackaged || process.env.LANCHESS_DEV === '1';

// Allow launching the UI straight onto a remote host's table:
//   LAN Chess.exe --connect=192.168.1.66:3001
const connectArg = process.argv.find((a) => a.startsWith('--connect='));
let connectTarget = null;
if (connectArg) {
  const parsed = parseConnectArg(connectArg, PREFERRED_PORT);
  if (parsed) {
    connectTarget = parsed.url;
  }
}

function log(...args) {
  if (isDev) console.log('[lan-chess]', ...args);
}

// ---------- asset paths (dev tree vs packaged install) ----------
function assetPaths() {
  if (isDev) {
    return {
      serverScript: path.join(__dirname, '..', 'desktop', 'server', 'server.cjs'),
      serverCwd: path.join(__dirname, '..', 'desktop', 'server'),
    };
  }
  const resources = process.resourcesPath; // extracted outside app.asar (plain Node must read them)
  const dir = path.join(resources, 'app-assets');
  return { serverScript: path.join(dir, 'server.cjs'), serverCwd: dir };
}

function getAppIcon() {
  const candidates = [
    path.join(__dirname, '..', 'build', 'icon.ico'),
    path.join(process.resourcesPath, 'icon.ico'),
    path.join(process.resourcesPath, '..', 'icon.ico'),
    path.join(process.resourcesPath, '..', 'build', 'icon.ico'),
  ];
  return resolveIconPath(candidates) || undefined;
}


function waitForServerReady(port, timeoutMs) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/api/status', timeout: 1500 }, (res) => {
        res.resume();
        if (res.statusCode === 200) return resolve();
        retry();
      });
      req.on('error', retry);
      req.on('timeout', () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) return reject(new Error('timeout'));
      setTimeout(attempt, 250);
    };
    attempt();
  });
}

// ---------- server child process (plain Node via Electron runtime) ----------
function startServer(port) {
  const { serverScript, serverCwd } = assetPaths();
  const child = spawn(process.execPath, [serverScript], {
    cwd: serverCwd, // server resolves ./client static assets relative to its cwd
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  child.stdout?.on('data', (d) => log(`server: ${String(d).trim()}`));
  child.stderr?.on('data', (d) => log(`server(error): ${String(d).trim()}`));

  child.on('exit', (code) => {
    serverProcess = null;
    log(`server exited (code=${code})`);
    if (!quitting && mainWindow && !mainWindow.isDestroyed()) {
      dialog
        .showMessageBox(mainWindow, {
          type: 'error',
          title: 'LAN Chess',
          message: 'The local server stopped unexpectedly.',
          detail: 'Multiplayer hosting is unavailable until it is restarted.',
          buttons: ['Restart Server', 'Quit LAN Chess'],
          defaultId: 0,
          noLink: true,
        })
        .then(async ({ response }) => {
          if (response === 0) {
            await restartServer();
          } else {
            app.quit();
          }
        })
        .catch(() => {});
    }
  });

  return child;
}

async function restartServer() {
  const { port, preferred } = await pickPort(PREFERRED_PORT);
  serverPort = port;
  serverProcess = startServer(port);

  try {
    await waitForServerReady(port, SERVER_READY_TIMEOUT_MS);
    const target = connectTarget ?? `http://127.0.0.1:${serverPort}`;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(target);
    } else {
      createWindow();
    }
  } catch {
    showServerFailedDialog(port, preferred);
  }
}

function showServerFailedDialog(port, preferred) {
  dialog.showMessageBoxSync({
    type: 'error',
    title: 'LAN Chess',
    message: 'LAN Chess could not start its local server.',
    detail: [
      `Port used: ${port}${preferred ? '' : ' (default port 3001 was busy)'}`,
      '',
      'Possible causes:',
      '• Antivirus or security software blocked the bundled server',
      '• A firewall rule prevented binding a local port',
      '• The installation is damaged — reinstall LAN Chess',
    ].join('\n'),
    buttons: ['Quit'],
    noLink: true,
  });
  app.quit();
}

async function launchServerAndWindow() {
  const { port, preferred } = await pickPort(PREFERRED_PORT);
  serverPort = port;

  serverProcess = startServer(port);

  try {
    await waitForServerReady(port, SERVER_READY_TIMEOUT_MS);
  } catch {
    showServerFailedDialog(port, preferred);
    return;
  }

  createWindow();
}

// ---------- window ----------
function createWindow() {
  const target = connectTarget ?? `http://127.0.0.1:${serverPort}`;
  const allowedOrigins = [`http://127.0.0.1:${serverPort}`];
  if (connectTarget) {
    try {
      allowedOrigins.push(new URL(connectTarget).origin);
    } catch {
      // ignore
    }
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 980,
    minHeight: 640,
    show: false,
    backgroundColor: '#020617',
    title: 'LAN Chess',
    icon: getAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      log(`window open -> ${target}`);
    }
  });

  // Strict origin check prevents permissive string-prefix navigation confusion.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url, allowedOrigins)) {
      event.preventDefault();
      if (isSafeExternalUrl(url)) {
        shell.openExternal(url).catch(() => {});
      }
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      shell.openExternal(url).catch(() => {});
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    log('permission denied:', permission);
    callback(false);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadURL(target);
}

// ---------- IPC (minimal, read-only) ----------
ipcMain.handle('desktop:get-status', () => ({
  version: app.getVersion(),
  serverRunning: serverProcess !== null,
  port: serverPort,
  platform: process.platform,
}));

// ---------- app lifecycle ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  if (!isDev) Menu.setApplicationMenu(null);

  app.whenReady().then(() => {
    log(`starting (dev=${isDev}, version=${app.getVersion()})`);
    launchServerAndWindow();
  });

  app.on('before-quit', () => {
    quitting = true;
    if (serverProcess) {
      try {
        serverProcess.kill();
      } catch {
        // process may already be gone
      }
      serverProcess = null;
    }
  });

  app.on('window-all-closed', () => {
    quitting = true;
    if (serverProcess) {
      try {
        serverProcess.kill();
      } catch {
        // process may already be gone
      }
      serverProcess = null;
    }
    app.quit();
  });
}

