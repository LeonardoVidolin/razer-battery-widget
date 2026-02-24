/**
 * Creates assets/tray-icon.png (32x32 Razer-green battery icon) for the system tray.
 * Run: node scripts/create-tray-icon.js
 */
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const SIZE = 32;
const GREEN = { r: 0, g: 255, b: 0 };
const DARK = { r: 20, g: 30, b: 20 };

function crc32(buf, start, len) {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  let c = 0 ^ (-1);
  for (let i = 0; i < len; i++) c = table[(c ^ buf[start + i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function writeU32BE(buf, offset, val) {
  buf[offset] = (val >>> 24) & 0xff;
  buf[offset + 1] = (val >>> 16) & 0xff;
  buf[offset + 2] = (val >>> 8) & 0xff;
  buf[offset + 3] = val & 0xff;
}

function pixel(x, y) {
  const bodyLeft = 6, bodyRight = 26, bodyTop = 10, bodyBottom = 28;
  const tipLeft = 12, tipRight = 20, tipBottom = 10;
  const stroke = 2;
  const inBody = x >= bodyLeft + stroke && x <= bodyRight - stroke && y >= bodyTop + stroke && y <= bodyBottom - stroke;
  const onBodyEdge =
    (x >= bodyLeft && x <= bodyRight && (y <= bodyTop + stroke || y >= bodyBottom - stroke)) ||
    (y >= bodyTop && y <= bodyBottom && (x <= bodyLeft + stroke || x >= bodyRight - stroke));
  const onTip = y >= 2 && y <= tipBottom && x >= tipLeft && x <= tipRight && (x <= tipLeft + stroke || x >= tipRight - stroke || y >= tipBottom - stroke);
  if (onBodyEdge || onTip) return GREEN;
  if (inBody) return DARK;
  return null;
}

// PNG scanlines: each row = filter byte (0) + SIZE * 4 bytes RGBA
const raw = Buffer.alloc(SIZE * (1 + SIZE * 4));
let off = 0;
for (let y = 0; y < SIZE; y++) {
  raw[off++] = 0;
  for (let x = 0; x < SIZE; x++) {
    const p = pixel(x, y);
    if (p) {
      raw[off++] = p.r;
      raw[off++] = p.g;
      raw[off++] = p.b;
      raw[off++] = 255;
    } else {
      raw[off++] = 0;
      raw[off++] = 0;
      raw[off++] = 0;
      raw[off++] = 0;
    }
  }
}

const deflated = zlib.deflateSync(raw, { level: 9 });

// PNG signature
const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// IHDR chunk: length(4) + "IHDR"(4) + data(13) + crc(4)
// Data: width(4), height(4), bitDepth(1), colorType(1)=6, compression(1)=0, filter(1)=0, interlace(1)=0
const ihdrData = Buffer.alloc(13);
writeU32BE(ihdrData, 0, SIZE);
writeU32BE(ihdrData, 4, SIZE);
ihdrData[8] = 8;
ihdrData[9] = 6;
ihdrData[10] = 0;
ihdrData[11] = 0;
ihdrData[12] = 0;
const ihdrChunk = Buffer.alloc(12 + 13);
writeU32BE(ihdrChunk, 0, 13);
ihdrChunk.write('IHDR', 4);
ihdrData.copy(ihdrChunk, 8);
writeU32BE(ihdrChunk, 21, crc32(ihdrChunk, 4, 17));

// IDAT chunk
const idatChunk = Buffer.alloc(12 + deflated.length);
writeU32BE(idatChunk, 0, deflated.length);
idatChunk.write('IDAT', 4);
deflated.copy(idatChunk, 8);
writeU32BE(idatChunk, 8 + deflated.length, crc32(idatChunk, 4, 4 + deflated.length));

// IEND chunk
const iendChunk = Buffer.alloc(12);
iendChunk.write('IEND', 4);
writeU32BE(iendChunk, 8, crc32(iendChunk, 4, 4));

const out = Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
const assetsDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(assetsDir, { recursive: true });
fs.writeFileSync(path.join(assetsDir, 'tray-icon.png'), out);
console.log('Created assets/tray-icon.png');
