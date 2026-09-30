const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function makePng(width, height, drawPixel) {
  // 1. Signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // 2. IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8 bits per channel
  ihdrData.writeUInt8(6, 9); // RGBA
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace

  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // 3. IDAT (Scanlines)
  const rowBytes = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowBytes);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData.writeUInt8(0, rowOffset); // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawPixel(x, y, width, height);
      const pixelOffset = rowOffset + 1 + x * 4;
      rawData.writeUInt8(r, pixelOffset);
      rawData.writeUInt8(g, pixelOffset + 1);
      rawData.writeUInt8(b, pixelOffset + 2);
      rawData.writeUInt8(a, pixelOffset + 3);
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressedData);

  // 4. IEND
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const toCrc = Buffer.concat([typeBuf, data]);
  const crcVal = zlib.crc32(toCrc);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal >>> 0, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

// Ensure assets directory
const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// 1. App Icon (1024x1024)
// LifeGuard AI Shield Logo on Safety Blue background (#0D52D6)
console.log('Generating assets/icon.png...');
const iconBuffer = makePng(1024, 1024, (x, y, w, h) => {
  // Center is (512, 512)
  const cx = 512;
  const cy = 512;
  const dx = Math.abs(x - cx);
  const dy = y - cy;

  // Background: Deep Safety Blue (#0D52D6 = rgb(13, 82, 214))
  // Draw Shield outline and interior
  // Shield shape: for y in [200, 824], width expands then tapers to point at bottom
  let inShield = false;
  let inBorder = false;
  let inCross = false;

  if (y >= 220 && y <= 800) {
    let maxDx;
    if (y < 460) {
      // Top half of shield: curved outward
      maxDx = 280;
    } else {
      // Bottom half: tapers to point at y = 800
      const taperFactor = 1 - Math.pow((y - 460) / 340, 1.4);
      maxDx = 280 * Math.max(0, taperFactor);
    }

    if (dx <= maxDx) {
      inShield = true;
      if (dx >= maxDx - 24 || y <= 244) {
        inBorder = true;
      }
    }
  }

  // Cross in the center of shield
  if (inShield && !inBorder) {
    const crossWidth = 44;
    const crossHeight = 220;
    if (dx <= crossWidth / 2 && Math.abs(y - 480) <= crossHeight / 2) {
      inCross = true;
    }
    if (dx <= crossHeight / 2 && Math.abs(y - 480) <= crossWidth / 2) {
      inCross = true;
    }
  }

  if (inCross) {
    return [255, 255, 255, 255]; // White cross
  }
  if (inBorder) {
    return [255, 255, 255, 230]; // White shield border
  }
  if (inShield) {
    return [23, 106, 255, 255]; // Inner shield lighter safety blue
  }

  // Rounded outer app icon corners or background
  return [13, 82, 214, 255]; // Background #0D52D6
});
fs.writeFileSync(path.join(assetsDir, 'icon.png'), iconBuffer);
console.log('✓ assets/icon.png created (' + iconBuffer.length + ' bytes)');

// 2. Adaptive Icon (1024x1024)
// Foreground on transparent background or safety blue
console.log('Generating assets/adaptive-icon.png...');
const adaptiveBuffer = makePng(1024, 1024, (x, y, w, h) => {
  const cx = 512;
  const cy = 512;
  const dx = Math.abs(x - cx);

  let inShield = false;
  let inBorder = false;
  let inCross = false;

  if (y >= 260 && y <= 760) {
    let maxDx;
    if (y < 460) {
      maxDx = 240;
    } else {
      const taperFactor = 1 - Math.pow((y - 460) / 300, 1.4);
      maxDx = 240 * Math.max(0, taperFactor);
    }

    if (dx <= maxDx) {
      inShield = true;
      if (dx >= maxDx - 20 || y <= 280) {
        inBorder = true;
      }
    }
  }

  if (inShield && !inBorder) {
    const crossWidth = 36;
    const crossHeight = 180;
    if (dx <= crossWidth / 2 && Math.abs(y - 480) <= crossHeight / 2) {
      inCross = true;
    }
    if (dx <= crossHeight / 2 && Math.abs(y - 480) <= crossWidth / 2) {
      inCross = true;
    }
  }

  if (inCross) return [255, 255, 255, 255];
  if (inBorder) return [255, 255, 255, 240];
  if (inShield) return [23, 106, 255, 255];

  // Transparent background for adaptive foreground
  return [0, 0, 0, 0];
});
fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), adaptiveBuffer);
console.log('✓ assets/adaptive-icon.png created (' + adaptiveBuffer.length + ' bytes)');

// 3. Splash Screen (1024x1024)
console.log('Generating assets/splash.png...');
const splashBuffer = makePng(1024, 1024, (x, y, w, h) => {
  const cx = 512;
  const cy = 480;
  const dx = Math.abs(x - cx);

  let inShield = false;
  let inBorder = false;
  let inCross = false;

  if (y >= 280 && y <= 680) {
    let maxDx;
    if (y < 440) {
      maxDx = 180;
    } else {
      const taperFactor = 1 - Math.pow((y - 440) / 240, 1.4);
      maxDx = 180 * Math.max(0, taperFactor);
    }

    if (dx <= maxDx) {
      inShield = true;
      if (dx >= maxDx - 16 || y <= 296) {
        inBorder = true;
      }
    }
  }

  if (inShield && !inBorder) {
    const crossWidth = 28;
    const crossHeight = 140;
    if (dx <= crossWidth / 2 && Math.abs(y - 450) <= crossHeight / 2) {
      inCross = true;
    }
    if (dx <= crossHeight / 2 && Math.abs(y - 450) <= crossWidth / 2) {
      inCross = true;
    }
  }

  if (inCross) return [255, 255, 255, 255];
  if (inBorder) return [255, 255, 255, 240];
  if (inShield) return [23, 106, 255, 255];

  return [13, 82, 214, 255]; // Background #0D52D6
});
fs.writeFileSync(path.join(assetsDir, 'splash.png'), splashBuffer);
console.log('✓ assets/splash.png created (' + splashBuffer.length + ' bytes)');
