const fs = require('node:fs');
const path = require('node:path');

const output = path.resolve(__dirname, '../dist/marketing');
fs.mkdirSync(output, { recursive: true });
for (const file of ['index.html', 'styles.css', 'script.js']) {
  fs.copyFileSync(path.join(__dirname, file), path.join(output, file));
}
const assets = ['club-knight.jpg', 'sans.woff2', 'display.woff2', 'sans-license.txt', 'display-license.txt', 'icon.png', 'finish-glass.png', 'finish-walnut.png', 'demo.mp4', 'waiting-room.png', 'active-match.png', 'focus-mode.png', 'play-vs-computer.png'];
fs.mkdirSync(path.join(output, 'assets'), { recursive: true });
for (const file of [...assets, 'desktop-lobby.png']) {
  fs.copyFileSync(path.join(__dirname, 'assets', file), path.join(output, 'assets', file));
}
