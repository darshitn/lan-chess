/**
 * Generates the original LAN Chess application icon (build/icon.ico).
 *
 * Design: a stylized amber-rimmed navy tile with a white chess pawn and three
 * small network dots (LAN motif) — drawn procedurally, no third-party assets.
 *
 * Output: 256x256 RGBA PNG embedded in a Vista-style .ico container.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import path from 'node:path';

const SIZE = 256;

// ---------- tiny PNG encoder ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- icon drawing ----------
const px = Buffer.alloc(SIZE * SIZE * 4);

function put(x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  // alpha blend over existing
  const sa = a / 255;
  const da = px[i + 3] / 255;
  const oa = sa + da * (1 - sa);
  if (oa === 0) return;
  px[i] = Math.round((r * sa + px[i] * da * (1 - sa)) / oa);
  px[i + 1] = Math.round((g * sa + px[i + 1] * da * (1 - sa)) / oa);
  px[i + 2] = Math.round((b * sa + px[i + 2] * da * (1 - sa)) / oa);
  px[i + 3] = Math.round(oa * 255);
}

const inRoundedRect = (x, y, x0, y0, x1, y1, rad) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.max(x0 + rad, Math.min(x, x1 - rad));
  const cy = Math.max(y0 + rad, Math.min(y, y1 - rad));
  return (x - cx) ** 2 + (y - cy) ** 2 <= rad ** 2 || (x >= x0 + rad && x <= x1 - rad) || (y >= y0 + rad && y <= y1 - rad);
};

// Background: navy tile with amber rim
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    if (inRoundedRect(x, y, 8, 8, 248, 248, 52)) {
      // subtle vertical gradient on the tile
      const t = (y - 8) / 240;
      const r = Math.round(13 + t * 6);
      const g = Math.round(20 + t * 10);
      const b = Math.round(38 + t * 16);
      put(x, y, r, g, b, 255);
    }
    // amber rim (outer 4px ring)
    if (
      inRoundedRect(x, y, 8, 8, 248, 248, 52) &&
      !inRoundedRect(x, y, 14, 14, 242, 242, 47)
    ) {
      put(x, y, 251, 191, 36, 255);
    }
  }
}

// Chess pawn (white with soft shadow edge)
const PAWN = (x, y, r, g, b) => {
  // head
  if ((x - 128) ** 2 + (y - 96) ** 2 <= 30 ** 2) return true;
  // neck (flared trapezoid)
  if (y >= 118 && y <= 142 && Math.abs(x - 128) <= 14 + (y - 118) * 0.42) return true;
  // collar
  if (y >= 142 && y <= 154 && Math.abs(x - 128) <= 40) return true;
  // body flare
  if (y > 154 && y <= 196 && Math.abs(x - 128) <= 24 + (y - 154) * 0.52) return true;
  // base
  if (y > 196 && y <= 212 && Math.abs(x - 128) <= 58) return true;
  if (y > 212 && y <= 222 && Math.abs(x - 128) <= 66) return true;
  return false;
};

for (let y = 60; y <= 226; y++) {
  for (let x = 40; x <= 216; x++) {
    if (PAWN(x + 1, y + 1, 0, 0, 0)) put(x, y, 2, 6, 23, 140); // drop shadow
    if (PAWN(x, y, 255, 255, 255)) put(x, y, 248, 250, 252, 255);
  }
}

// LAN motif: three connected nodes, bottom-left
const node = (cx, cy, rad) => {
  for (let y = cy - rad - 1; y <= cy + rad + 1; y++)
    for (let x = cx - rad - 1; x <= cx + rad + 1; x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= rad ** 2) put(x, y, 56, 189, 248, 255);
};
const link = (x1, y1, x2, y2) => {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x1 + ((x2 - x1) * i) / steps);
    const y = Math.round(y1 + ((y2 - y1) * i) / steps);
    put(x, y, 56, 189, 248, 230);
    put(x, y + 1, 56, 189, 248, 160);
  }
};
link(58, 222, 84, 206);
link(84, 206, 110, 222);
node(58, 222, 7);
node(84, 206, 7);
node(110, 222, 7);

// ---------- write .ico (256px PNG layer) ----------
const png = encodePng(SIZE, SIZE, px);
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // count
const entry = Buffer.alloc(16);
entry[0] = 0; // width 256 -> 0
entry[1] = 0; // height 256 -> 0
entry[2] = 0; // palette
entry[3] = 0; // reserved
entry.writeUInt16LE(1, 4); // planes
entry.writeUInt16LE(32, 6); // bpp
entry.writeUInt32LE(png.length, 8);
entry.writeUInt32LE(22, 12); // offset

const outDir = path.resolve('build');
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'icon.ico'), Buffer.concat([header, entry, png]));
// also emit the raw PNG for previews/docs
writeFileSync(path.join(outDir, 'icon.png'), png);
console.log(`wrote build/icon.ico (${(header.length + entry.length + png.length) / 1024} KiB) and build/icon.png`);
