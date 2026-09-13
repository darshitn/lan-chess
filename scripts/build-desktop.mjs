/**
 * Stages the desktop server bundle:
 *
 *   desktop/server/server.cjs   — the compiled Node/Express server bundled to a
 *                                 single CommonJS file (esbuild), so the packaged
 *                                 app needs no node_modules at runtime
 *   desktop/server/client/**    — the production frontend build (vite output,
 *                                 which already includes /stockfish.wasm*,
 *                                 /puzzles/, CSS, and JS)
 *
 * The Express server resolves its static directory from its cwd, so it is
 * launched with cwd = desktop/server — zero server code changes required.
 */
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';

const serverEntry = path.resolve('dist/server/server/index.js');
const clientBuild = path.resolve('dist/client');
const outDir = path.resolve('desktop/server');
const outFile = path.join(outDir, 'server.cjs');
const clientOut = path.join(outDir, 'client');

if (!existsSync(serverEntry)) {
  console.error('server build missing — run "npm run build" first');
  process.exit(1);
}
if (!existsSync(clientBuild)) {
  console.error('client build missing — run "npm run build" first');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [serverEntry],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  outfile: outFile,
  sourcemap: false,
  minify: false,
  legalComments: 'none',
  logLevel: 'info',
});

rmSync(clientOut, { recursive: true, force: true });
cpSync(clientBuild, clientOut, { recursive: true });

const kb = (p) => Math.round(statSync(p).size / 1024);
console.log(`desktop server bundle: ${outFile} (${kb(outFile)} KB)`);
console.log(`desktop client assets: ${clientOut} (staged)`);
