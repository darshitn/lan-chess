/**
 * Works around a known electron-builder issue on Windows without admin
 * rights or Developer Mode: the winCodeSign vendor archive contains macOS
 * dylib *symlinks* that 7za cannot extract without SeCreateSymbolicLink
 * privilege, aborting the Windows build even though those files are never
 * used when signing is disabled.
 *
 * This patch points getSignVendorPath() at a pre-extracted copy of the
 * archive (symlinks simply skipped — everything Windows needs, e.g.
 * rcedit-x64.exe and the windows-10 signtool directory, extracts fine).
 *
 * Idempotent: safe to run on every build. Applied automatically by
 * `npm run electron:build`.
 */
const { execFileSync } = require('node:child_process');
const { existsSync, readdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const MARKER = 'LANCHESS_WINCODESIGN_PATCH';
const target = path.resolve('node_modules/app-builder-lib/out/codeSign/windowsSignToolManager.js');
let source = readSafe(target);
if (source == null) {
  console.error('windowsSignToolManager.js not found — is app-builder-lib installed?');
  process.exit(1);
}
if (source.includes(MARKER)) {
  console.log('electron-builder already patched for symlink-free winCodeSign');
  process.exit(0);
}

// Ensure a fully-extracted winCodeSign copy exists (symlink errors ignored).
const cacheRoot = path.join(process.env.LOCALAPPDATA ?? '', 'electron-builder', 'Cache', 'winCodeSign');
let extracted = null;
if (existsSync(cacheRoot)) {
  for (const entry of readdirSync(cacheRoot)) {
    const dir = path.join(cacheRoot, entry);
    if (!entry.endsWith('.7z') && existsSync(path.join(dir, 'rcedit-x64.exe'))) {
      extracted = dir;
      break;
    }
  }
  if (!extracted) {
    const sevenZip = path.resolve('node_modules/7zip-bin/win/x64/7za.exe');
    const archive = readdirSync(cacheRoot).find((f) => f.endsWith('.7z'));
    if (archive) {
      const dir = path.join(cacheRoot, archive.replace('.7z', ''));
      try {
        execFileSync(sevenZip, ['x', '-y', path.join(cacheRoot, archive), `-o${dir}`], { stdio: 'ignore' });
      } catch {
        // symlink sub-items fail on Windows without privileges — ignored on purpose
      }
      if (existsSync(path.join(dir, 'rcedit-x64.exe'))) extracted = dir;
    }
  }
}
if (!extracted) {
  console.error('No extracted winCodeSign cache found. Run the build once to populate the cache, then re-run.');
  process.exit(1);
}

const patched =
  `function getSignVendorPath() {\n` +
  `    // ${MARKER}: use a pre-extracted vendor copy (Windows cannot extract\n` +
  `    // the archive's macOS symlink entries without elevated privileges).\n` +
  `    return Promise.resolve(${JSON.stringify(extracted)});\n` +
  `}`;

writeFileSync(target, source.replace('function getSignVendorPath() {', patched, 1));
console.log(`patched getSignVendorPath -> ${extracted}`);

function readSafe(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}
