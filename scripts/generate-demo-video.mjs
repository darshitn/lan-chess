import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const ARTIFACTS_DIR = path.join(ROOT_DIR, 'artifacts', 'demo-video');
const SCREENSHOTS_DIR = path.join(ROOT_DIR, 'artifacts', 'screenshots');
const OUTPUT_VIDEO = path.join(ARTIFACTS_DIR, 'lan_chess_demo_v1.2.4.mp4');

const FONT_BOLD = 'C\\:/Windows/Fonts/segoeuib.ttf';
const FONT_REG = 'C\\:/Windows/Fonts/segoeui.ttf';

if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

console.log('=== LAN Chess Demo Video Generator (video_skill) ===');
console.log(`Working Directory: ${ROOT_DIR}`);
console.log(`Output Directory: ${ARTIFACTS_DIR}`);

const scenes = [
  {
    id: 1,
    duration: 8,
    image: path.join(SCREENSHOTS_DIR, 'desktop_1280x800.png'),
    badge: 'LAN CHESS v1.2.4',
    badgeColor: '0x38bdf8',
    title: 'Zero-Cloud Local Multiplayer Chess & Stockfish Suite',
    subtitle: 'Private peer-to-peer chess across your home or dorm Wi-Fi with server-authoritative rules.',
    footer: 'React 19 • Express 5 • Socket.IO • Stockfish WASM • Electron Desktop',
    footerColor: '0x38bdf8'
  },
  {
    id: 2,
    duration: 8,
    image: path.join(SCREENSHOTS_DIR, 'waiting_1366x768.png'),
    badge: 'CRAZY FEATURE #1: INSTANT QR CODE ONBOARDING',
    badgeColor: '0xf59e0b',
    title: 'Zero-Config Room Joining via Mobile Camera Scan',
    subtitle: 'No manual IP or port typing! Scan the host screen with any phone camera to instantly enter the match.',
    footer: 'Host LAN IP Detection • Auto-Prefilled Join Form • Multi-Tier Clipboard Copy',
    footerColor: '0xfbbf24'
  },
  {
    id: 3,
    duration: 8,
    image: path.join(SCREENSHOTS_DIR, 'active_multiplayer_1366x768.png'),
    badge: 'CRAZY FEATURE #2: LIVE IN-MATCH TIME TRAVEL',
    badgeColor: '0x06b6d4',
    title: 'Live In-Game History Scrubbing & Move Replay',
    subtitle: 'Scrub backward through prior moves mid-game without stalling clocks or disconnecting! Click Live to resume.',
    footer: 'Server-Authoritative Clocks • Fischer Increments • Resilient Premoves • Real-Time Spectators',
    footerColor: '0x22d3ee'
  },
  {
    id: 4,
    duration: 8,
    image: path.join(SCREENSHOTS_DIR, 'play_vs_computer_1366x768.png'),
    badge: 'CRAZY FEATURE #3: STOCKFISH AI COMPLETELY OFFLINE',
    badgeColor: '0xa855f7',
    title: 'WASM Stockfish Worker with Human-Like Pacing',
    subtitle: 'Real UCI Stockfish running in a Web Worker: 5 difficulty tiers, natural turn pacing, and 0 external server calls.',
    footer: 'Immediate Worker Termination on Restart • Low-Time Automatic Delay Clamping • Zero Server Cost',
    footerColor: '0xc084fc'
  },
  {
    id: 5,
    duration: 8,
    image: path.join(SCREENSHOTS_DIR, 'board-desktop-1920-focus.png'),
    badge: 'CRAZY FEATURE #4: DYNAMIC DRAG SIZING & FOCUS MODE',
    badgeColor: '0x10b981',
    title: 'Focus Board Mode & Corner Drag Resizing',
    subtitle: 'Fluid corner drag handle for pixel-perfect board sizing. Focus Mode collapses sidebars with unread chat alerts.',
    footer: 'Zero Network Impact • Automatically Clamps to Viewport • Fullscreen API Integration',
    footerColor: '0x34d399'
  },
  {
    id: 6,
    duration: 8,
    image: path.join(SCREENSHOTS_DIR, 'board-laptop-1280-custom-enlarged.png'),
    badge: 'CRAZY FEATURE #5: 19 THEMES & 8 CUSTOM PIECE SETS',
    badgeColor: '0xec4899',
    title: '19 Board Themes & 8 Custom Vector Piece Sets',
    subtitle: 'Cyber, Neon, Glass, Wood, Stone, Silhouette, Minimal & Classic Staunton vector SVG geometries.',
    footer: 'Interactive Custom Board Builder • Scalable Vector Pieces • 100 Percent Pure Local Storage',
    footerColor: '0xf472b6'
  },
  {
    id: 7,
    duration: 8,
    image: path.join(SCREENSHOTS_DIR, 'updater_settings_tab.png'),
    badge: 'CRAZY FEATURE #6: DIFFERENTIAL IN-APP AUTO-UPDATER',
    badgeColor: '0xeab308',
    title: 'SHA-512 Blockmap Updates with Match Lockout',
    subtitle: 'Downloads only changed binary chunks via GitHub Releases. Refuses restarts mid-game to protect active blitz matches.',
    footer: 'Cryptographic SHA-512 Verification • Electron Main Process Safety Bridge • Graceful Offline Handling',
    footerColor: '0xfacc15'
  },
  {
    id: 8,
    duration: 8,
    image: path.join(SCREENSHOTS_DIR, 'installed_electron_1280x800.png'),
    badge: 'DEPLOYMENT READY — LAN CHESS v1.2.4',
    badgeColor: '0x10b981',
    title: 'Play Anywhere — Standalone Windows & Web',
    subtitle: '283 Passed Vitest Tests • Real PGN Export • 1,320 Tactical Puzzles • Post-Game Stockfish Review',
    footer: 'Open Source • github.com/darshitn/lan-chess • Download LAN-Chess-Setup-1.2.4.exe',
    footerColor: '0x34d399'
  }
];

function sanitizeForFfmpeg(str) {
  return str.replace(/'/g, "\\'").replace(/:/g, '\\:').replace(/%/g, '%%');
}

const renderedSceneFiles = [];

for (const scene of scenes) {
  const sceneFile = path.join(ARTIFACTS_DIR, `scene_${String(scene.id).padStart(2, '0')}.mp4`);
  console.log(`Rendering Scene ${scene.id}/${scenes.length}: ${scene.badge}...`);

  const safeBadge = sanitizeForFfmpeg(scene.badge);
  const safeTitle = sanitizeForFfmpeg(scene.title);
  const safeSubtitle = sanitizeForFfmpeg(scene.subtitle);
  const safeFooter = sanitizeForFfmpeg(scene.footer);

  // Construct FFmpeg filter complex:
  // 1. Dark tech canvas (1920x1080)
  // 2. Scale screenshot to fit nicely in 1340 width
  // 3. Draw header bar (top 155px)
  // 4. Draw badge pill & text
  // 5. Draw main title & subtitle
  // 6. Draw footer bar (bottom 65px)
  const filterComplex = [
    `[1:v]scale=1360:-1[scr]`,
    `[0:v][scr]overlay=(W-w)/2:175[base]`,
    `[base]drawbox=x=0:y=0:w=1920:h=155:color=0x070b14@0.94:t=fill,` +
    `drawbox=x=90:y=20:w=620:h=34:color=${scene.badgeColor}@0.18:t=fill,` +
    `drawbox=x=90:y=20:w=620:h=34:color=${scene.badgeColor}:t=2,` +
    `drawtext=fontfile='${FONT_BOLD}':text='${safeBadge}':fontsize=17:fontcolor=${scene.badgeColor}:x=105:y=28,` +
    `drawtext=fontfile='${FONT_BOLD}':text='${safeTitle}':fontsize=36:fontcolor=white:x=90:y=64,` +
    `drawtext=fontfile='${FONT_REG}':text='${safeSubtitle}':fontsize=21:fontcolor=0x94a3b8:x=90:y=112,` +
    `drawbox=x=0:y=1015:w=1920:h=65:color=0x070b14@0.95:t=fill,` +
    `drawbox=x=0:y=1014:w=1920:h=1:color=${scene.footerColor}@0.4:t=fill,` +
    `drawtext=fontfile='${FONT_REG}':text='${safeFooter}':fontsize=20:fontcolor=${scene.footerColor}:x=(w-text_w)/2:y=1036`
  ].join(';');

  const args = [
    '-y',
    '-f', 'lavfi',
    '-i', `color=c=0x0b1120:s=1920x1080:d=${scene.duration}`,
    '-i', scene.image,
    '-filter_complex', filterComplex,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-t', String(scene.duration),
    sceneFile
  ];

  const result = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`FFmpeg failed on Scene ${scene.id} with exit code ${result.status}`);
  }
  renderedSceneFiles.push(sceneFile);
}

// Create concat list file
const concatFilePath = path.join(ARTIFACTS_DIR, 'concat_list.txt');
const concatContent = renderedSceneFiles.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n');
fs.writeFileSync(concatFilePath, concatContent, 'utf-8');

console.log('Concatenating all scenes into combined video...');
const unstitchedVideo = path.join(ARTIFACTS_DIR, 'unstitched.mp4');
const concatArgs = [
  '-y',
  '-f', 'concat',
  '-safe', '0',
  '-i', concatFilePath,
  '-c', 'copy',
  unstitchedVideo
];
const concatResult = spawnSync('ffmpeg', concatArgs, { stdio: 'inherit' });
if (concatResult.status !== 0) {
  throw new Error(`FFmpeg concat failed with exit code ${concatResult.status}`);
}

const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);
console.log(`Total Video Duration: ${totalDuration} seconds. Synthesizing soundtrack...`);

// Synthesize musical ambient soundtrack
const audioFile = path.join(ARTIFACTS_DIR, 'soundtrack.aac');
const audioSynthExpr = [
  '0.14*sin(2*PI*110*t)',
  '0.10*sin(2*PI*164.81*t)',
  '0.09*sin(2*PI*220*t*(1+0.012*sin(2*PI*1.8*t)))',
  '0.06*sin(2*PI*329.63*t)',
  '0.03*sin(2*PI*440*t*(1+0.008*sin(2*PI*2.4*t)))'
].join('+');

const audioFilter = `lowpass=f=1400,highpass=f=50,aecho=0.8:0.7:120:0.3,afade=t=in:ss=0:d=1.5,afade=t=out:st=${totalDuration - 2}:d=2,volume=1.4`;

const audioArgs = [
  '-y',
  '-f', 'lavfi',
  '-i', `aevalsrc=exprs='${audioSynthExpr}':s=44100:d=${totalDuration}`,
  '-af', audioFilter,
  '-c:a', 'aac',
  '-b:a', '192k',
  audioFile
];

const audioResult = spawnSync('ffmpeg', audioArgs, { stdio: 'inherit' });
if (audioResult.status !== 0) {
  throw new Error(`FFmpeg audio synthesis failed with exit code ${audioResult.status}`);
}

console.log('Muxing video and audio into final demo video...');
const finalMuxArgs = [
  '-y',
  '-i', unstitchedVideo,
  '-i', audioFile,
  '-c:v', 'copy',
  '-c:a', 'copy',
  '-movflags', '+faststart',
  OUTPUT_VIDEO
];

const muxResult = spawnSync('ffmpeg', finalMuxArgs, { stdio: 'inherit' });
if (muxResult.status !== 0) {
  throw new Error(`FFmpeg final mux failed with exit code ${muxResult.status}`);
}

// Copy to public folder if exists
const publicDir = path.join(ROOT_DIR, 'public');
if (fs.existsSync(publicDir)) {
  const publicVideo = path.join(publicDir, 'lan_chess_demo.mp4');
  fs.copyFileSync(OUTPUT_VIDEO, publicVideo);
  console.log(`Copied demo video to web public folder: ${publicVideo}`);
}

const stats = fs.statSync(OUTPUT_VIDEO);
console.log(`SUCCESS! Demo video generated: ${OUTPUT_VIDEO}`);
console.log(`Size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
