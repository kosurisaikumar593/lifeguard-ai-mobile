const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const sourcePath = 'C:/Users/91934/.gemini/antigravity/brain/3b69e1e3-7c53-4b69-b262-f402afe6f089/.user_uploaded/media_1790702955396.png';
const projectRoot = path.resolve(__dirname, '..');

const srcData = fs.readFileSync(sourcePath);
const src = PNG.sync.read(srcData);

// Save full original uploaded logo to assets/logo.png
fs.copyFileSync(sourcePath, path.join(projectRoot, 'assets', 'logo.png'));
console.log('Saved assets/logo.png');

// Bilinear interpolation resampler
function sampleBilinear(src, sx, sy) {
  const x0 = Math.max(0, Math.min(src.width - 1, Math.floor(sx)));
  const x1 = Math.max(0, Math.min(src.width - 1, x0 + 1));
  const y0 = Math.max(0, Math.min(src.height - 1, Math.floor(sy)));
  const y1 = Math.max(0, Math.min(src.height - 1, y0 + 1));

  const fx = sx - x0;
  const fy = sy - y0;

  function getRGBA(x, y) {
    const idx = (src.width * y + x) << 2;
    const a = src.data[idx + 3] / 255;
    return [
      src.data[idx] * a,
      src.data[idx + 1] * a,
      src.data[idx + 2] * a,
      src.data[idx + 3],
    ];
  }

  const p00 = getRGBA(x0, y0);
  const p10 = getRGBA(x1, y0);
  const p01 = getRGBA(x0, y1);
  const p11 = getRGBA(x1, y1);

  const w00 = (1 - fx) * (1 - fy);
  const w10 = fx * (1 - fy);
  const w01 = (1 - fx) * fy;
  const w11 = fx * fy;

  const a = p00[3] * w00 + p10[3] * w10 + p01[3] * w01 + p11[3] * w11;
  if (a <= 0.001) return [0, 0, 0, 0];

  const r = (p00[0] * w00 + p10[0] * w10 + p01[0] * w01 + p11[0] * w11) / (a / 255);
  const g = (p00[1] * w00 + p10[1] * w10 + p01[1] * w01 + p11[1] * w11) / (a / 255);
  const b = (p00[2] * w00 + p10[2] * w10 + p01[2] * w01 + p11[2] * w11) / (a / 255);

  return [Math.round(r), Math.round(g), Math.round(b), Math.round(a)];
}

function renderImage({
  srcBounds,      // { x, y, w, h }
  dstSize,        // number (square)
  scaleFactor,    // relative scale inside canvas (e.g. 0.70 for 70% fit)
  isRound,        // boolean (circle mask)
  bgColor,        // [r, g, b, a] or null for transparent
}) {
  const dst = new PNG({ width: dstSize, height: dstSize });
  const cx = dstSize / 2;
  const cy = dstSize / 2;
  const radius = dstSize / 2;

  // Compute destination dimensions preserving aspect ratio
  const aspect = srcBounds.w / srcBounds.h;
  let dw, dh;
  if (aspect > 1) {
    dw = dstSize * scaleFactor;
    dh = dw / aspect;
  } else {
    dh = dstSize * scaleFactor;
    dw = dh * aspect;
  }

  const ox = cx - dw / 2;
  const oy = cy - dh / 2;

  for (let y = 0; y < dstSize; y++) {
    for (let x = 0; x < dstSize; x++) {
      const idx = (dstSize * y + x) << 2;
      const distFromCenter = Math.hypot(x - cx, y - cy);

      // Circle clipping check
      if (isRound && distFromCenter > radius) {
        dst.data[idx] = 0;
        dst.data[idx + 1] = 0;
        dst.data[idx + 2] = 0;
        dst.data[idx + 3] = 0;
        continue;
      }

      // Fill base background if specified
      if (bgColor) {
        dst.data[idx] = bgColor[0];
        dst.data[idx + 1] = bgColor[1];
        dst.data[idx + 2] = bgColor[2];
        dst.data[idx + 3] = bgColor[3];
      } else {
        dst.data[idx] = 0;
        dst.data[idx + 1] = 0;
        dst.data[idx + 2] = 0;
        dst.data[idx + 3] = 0;
      }

      // Check if inside image bounding box
      if (x >= ox && x < ox + dw && y >= oy && y < oy + dh) {
        const u = (x - ox) / dw;
        const v = (y - oy) / dh;
        const sx = srcBounds.x + u * srcBounds.w;
        const sy = srcBounds.y + v * srcBounds.h;

        const [sr, sg, sb, sa] = sampleBilinear(src, sx, sy);
        if (sa > 0) {
          const alpha = sa / 255;
          const bgA = dst.data[idx + 3] / 255;
          const outA = alpha + bgA * (1 - alpha);
          if (outA > 0) {
            dst.data[idx] = Math.round((sr * alpha + dst.data[idx] * bgA * (1 - alpha)) / outA);
            dst.data[idx + 1] = Math.round((sg * alpha + dst.data[idx + 1] * bgA * (1 - alpha)) / outA);
            dst.data[idx + 2] = Math.round((sb * alpha + dst.data[idx + 2] * bgA * (1 - alpha)) / outA);
            dst.data[idx + 3] = Math.round(outA * 255);
          }
        }
      }

      // Antialiased circle edge
      if (isRound && distFromCenter >= radius - 1 && distFromCenter <= radius) {
        const edgeAlpha = Math.max(0, Math.min(1, radius - distFromCenter));
        dst.data[idx + 3] = Math.round(dst.data[idx + 3] * edgeAlpha);
      }
    }
  }

  return dst;
}

// Bounds definitions
// Shield emblem alone (for adaptive launcher icons): x=[290, 727], y=[88, 593]
const shieldBounds = { x: 290, y: 88, w: 438, h: 506 };

// Full logo with text: x=[57, 961], y=[88, 851]
const fullLogoBounds = { x: 57, y: 88, w: 905, h: 764 };

// 1. Assets
// assets/icon.png: 1024x1024 (Full logo on crisp white background)
const iconPng = renderImage({
  srcBounds: fullLogoBounds,
  dstSize: 1024,
  scaleFactor: 0.85,
  isRound: false,
  bgColor: [255, 255, 255, 255],
});
fs.writeFileSync(path.join(projectRoot, 'assets', 'icon.png'), PNG.sync.write(iconPng));
console.log('Generated assets/icon.png (1024x1024)');

// assets/adaptive-icon.png: 1024x1024 (Shield emblem centered with 66% safe zone on transparent)
const adaptiveIconPng = renderImage({
  srcBounds: shieldBounds,
  dstSize: 1024,
  scaleFactor: 0.65,
  isRound: false,
  bgColor: null,
});
fs.writeFileSync(path.join(projectRoot, 'assets', 'adaptive-icon.png'), PNG.sync.write(adaptiveIconPng));
console.log('Generated assets/adaptive-icon.png (1024x1024)');

// assets/splash.png: 1024x1024 (Full logo centered on crisp white)
const splashPng = renderImage({
  srcBounds: fullLogoBounds,
  dstSize: 1024,
  scaleFactor: 0.75,
  isRound: false,
  bgColor: [255, 255, 255, 255],
});
fs.writeFileSync(path.join(projectRoot, 'assets', 'splash.png'), PNG.sync.write(splashPng));
console.log('Generated assets/splash.png (1024x1024)');

// 2. Android Mipmap Densities
const densities = [
  { name: 'mdpi', launcher: 48, foreground: 108 },
  { name: 'hdpi', launcher: 72, foreground: 162 },
  { name: 'xhdpi', launcher: 96, foreground: 216 },
  { name: 'xxhdpi', launcher: 144, foreground: 324 },
  { name: 'xxxhdpi', launcher: 192, foreground: 432 },
];

for (const d of densities) {
  const dir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', `mipmap-${d.name}`);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // A. ic_launcher.png (Square / soft rounded on white background)
  const launcherPng = renderImage({
    srcBounds: shieldBounds,
    dstSize: d.launcher,
    scaleFactor: 0.78,
    isRound: false,
    bgColor: [255, 255, 255, 255],
  });
  fs.writeFileSync(path.join(dir, 'ic_launcher.png'), PNG.sync.write(launcherPng));

  // B. ic_launcher_round.png (Circle masked on white background)
  const roundPng = renderImage({
    srcBounds: shieldBounds,
    dstSize: d.launcher,
    scaleFactor: 0.72,
    isRound: true,
    bgColor: [255, 255, 255, 255],
  });
  fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), PNG.sync.write(roundPng));

  // C. ic_launcher_foreground.png (Transparent adaptive foreground)
  const fgPng = renderImage({
    srcBounds: shieldBounds,
    dstSize: d.foreground,
    scaleFactor: 0.65,
    isRound: false,
    bgColor: null,
  });
  fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), PNG.sync.write(fgPng));

  console.log(`Generated mipmap-${d.name} (launcher: ${d.launcher}px, fg: ${d.foreground}px)`);
}

console.log('All icons successfully generated!');
