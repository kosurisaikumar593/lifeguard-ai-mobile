const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

function isInsideShield(x, y, cx, cy, w, h) {
  const nx = (x - cx) / (w / 2);
  const ny = (y - cy) / (h / 2);
  
  if (ny < -0.9 || ny > 0.95 || Math.abs(nx) > 0.85) return false;
  
  // Top curve / slope: peaks at (0, -0.9), slopes to (+/-0.85, -0.65)
  const topLimit = -0.9 + 0.3 * Math.abs(nx / 0.85);
  if (ny < topLimit) return false;
  
  // Bottom taper / curve
  if (ny > 0.1) {
    const bottomFactor = (ny - 0.1) / 0.85;
    const allowedWidth = 0.85 * (1 - Math.pow(bottomFactor, 1.6));
    if (Math.abs(nx) > allowedWidth) return false;
  }
  return true;
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1)*(x2 - x1) + (y2 - y1)*(y2 - y1);
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

function renderIcon(size, mode) {
  // mode: 'LAUNCHER' | 'ROUND' | 'FOREGROUND' | 'NOTIFICATION'
  const png = new PNG({ width: size, height: size });
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.46;
  const checkWidth = Math.max(2, size * 0.08);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      const d = Math.hypot(x - cx, y - cy);

      if (mode === 'NOTIFICATION') {
        // Pure white silhouette of shield + checkmark cutout on transparent
        const shieldScale = size * 0.52;
        const inShield = isInsideShield(x, y, cx, cy, shieldScale * 1.5, shieldScale * 1.7);
        if (inShield) {
          const p1 = [cx - shieldScale * 0.28, cy + shieldScale * 0.04];
          const p2 = [cx - shieldScale * 0.07, cy + shieldScale * 0.28];
          const p3 = [cx + shieldScale * 0.35, cy - shieldScale * 0.22];
          const dCheck1 = distToSegment(x, y, p1[0], p1[1], p2[0], p2[1]);
          const dCheck2 = distToSegment(x, y, p2[0], p2[1], p3[0], p3[1]);
          const minCheck = Math.min(dCheck1, dCheck2);

          if (minCheck < checkWidth * 0.8) {
            // Cutout
            png.data[idx] = 0;
            png.data[idx + 1] = 0;
            png.data[idx + 2] = 0;
            png.data[idx + 3] = 0;
          } else {
            // Solid pure white
            png.data[idx] = 255;
            png.data[idx + 1] = 255;
            png.data[idx + 2] = 255;
            png.data[idx + 3] = 255;
          }
        } else {
          png.data[idx] = 0;
          png.data[idx + 1] = 0;
          png.data[idx + 2] = 0;
          png.data[idx + 3] = 0;
        }
      } else if (mode === 'FOREGROUND') {
        // Adaptive foreground: transparent canvas with centered shield emblem
        const shieldScale = size * 0.42;
        const inShield = isInsideShield(x, y, cx, cy, shieldScale * 1.4, shieldScale * 1.6);
        if (inShield) {
          const p1 = [cx - shieldScale * 0.26, cy + shieldScale * 0.04];
          const p2 = [cx - shieldScale * 0.07, cy + shieldScale * 0.26];
          const p3 = [cx + shieldScale * 0.32, cy - shieldScale * 0.20];
          const dCheck1 = distToSegment(x, y, p1[0], p1[1], p2[0], p2[1]);
          const dCheck2 = distToSegment(x, y, p2[0], p2[1], p3[0], p3[1]);
          const minCheck = Math.min(dCheck1, dCheck2);

          if (minCheck < checkWidth * 0.9) {
            // White checkmark
            png.data[idx] = 255;
            png.data[idx + 1] = 255;
            png.data[idx + 2] = 255;
            png.data[idx + 3] = 255;
          } else {
            // Shield fill in bright safety blue #FFFFFF with slight tint
            png.data[idx] = 255;
            png.data[idx + 1] = 255;
            png.data[idx + 2] = 255;
            png.data[idx + 3] = 240;
          }
        } else {
          png.data[idx] = 0;
          png.data[idx + 1] = 0;
          png.data[idx + 2] = 0;
          png.data[idx + 3] = 0;
        }
      } else {
        // LAUNCHER or ROUND
        let inBounds = false;
        if (mode === 'ROUND') {
          inBounds = d <= radius;
        } else {
          // Rounded rect (squircle)
          const cornerR = size * 0.22;
          const qx = Math.max(0, Math.abs(x - cx) - (size * 0.44 - cornerR));
          const qy = Math.max(0, Math.abs(y - cy) - (size * 0.44 - cornerR));
          inBounds = Math.hypot(qx, qy) <= cornerR;
        }

        if (inBounds) {
          // Border check
          const isEdge = mode === 'ROUND' 
            ? (d >= radius - Math.max(2, size * 0.035))
            : false;
          
          if (isEdge) {
            // Cyan accent border #00D4FF
            png.data[idx] = 0;
            png.data[idx + 1] = 212;
            png.data[idx + 2] = 255;
            png.data[idx + 3] = 255;
          } else {
            const shieldScale = size * 0.50;
            const inShield = isInsideShield(x, y, cx, cy, shieldScale * 1.35, shieldScale * 1.55);
            if (inShield) {
              const p1 = [cx - shieldScale * 0.26, cy + shieldScale * 0.04];
              const p2 = [cx - shieldScale * 0.07, cy + shieldScale * 0.26];
              const p3 = [cx + shieldScale * 0.32, cy - shieldScale * 0.20];
              const dCheck1 = distToSegment(x, y, p1[0], p1[1], p2[0], p2[1]);
              const dCheck2 = distToSegment(x, y, p2[0], p2[1], p3[0], p3[1]);
              const minCheck = Math.min(dCheck1, dCheck2);

              if (minCheck < checkWidth) {
                // White checkmark
                png.data[idx] = 255;
                png.data[idx + 1] = 255;
                png.data[idx + 2] = 255;
                png.data[idx + 3] = 255;
              } else {
                // Inner shield in vibrant safety cyan/blue #0099FF
                png.data[idx] = 0;
                png.data[idx + 1] = 160;
                png.data[idx + 2] = 255;
                png.data[idx + 3] = 255;
              }
            } else {
              // Deep Safety Navy Background #0A3F9C
              png.data[idx] = 10;
              png.data[idx + 1] = 63;
              png.data[idx + 2] = 156;
              png.data[idx + 3] = 255;
            }
          }
        } else {
          png.data[idx] = 0;
          png.data[idx + 1] = 0;
          png.data[idx + 2] = 0;
          png.data[idx + 3] = 0;
        }
      }
    }
  }
  return PNG.sync.write(png);
}

// 1. Generate root assets
console.log('Generating assets/icon.png (1024x1024)...');
fs.writeFileSync('assets/icon.png', renderIcon(1024, 'ROUND'));
console.log('Generating assets/adaptive-icon.png (1024x1024)...');
fs.writeFileSync('assets/adaptive-icon.png', renderIcon(1024, 'FOREGROUND'));

// 2. Generate Android notification icon vector
const vectorContent = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FFFFFFFF"
        android:pathData="M12,1L3,5v6c0,5.55 3.84,10.74 9,12c5.16,-1.26 9,-6.45 9,-12V5L12,1zM10,17l-4,-4l1.41,-1.41L10,14.17l6.59,-6.59L18,9L10,17z" />
</vector>
`;
fs.writeFileSync('android/app/src/main/res/drawable/notification_icon.xml', vectorContent);
console.log('Written android/app/src/main/res/drawable/notification_icon.xml');

// 3. Density maps
const densities = [
  { name: 'mdpi', launcher: 48, fg: 108, notif: 24 },
  { name: 'hdpi', launcher: 72, fg: 162, notif: 36 },
  { name: 'xhdpi', launcher: 96, fg: 216, notif: 48 },
  { name: 'xxhdpi', launcher: 144, fg: 324, notif: 72 },
  { name: 'xxxhdpi', launcher: 192, fg: 432, notif: 96 },
];

for (const d of densities) {
  const dirMipmap = path.join('android/app/src/main/res', `mipmap-${d.name}`);
  const dirDrawable = path.join('android/app/src/main/res', `drawable-${d.name}`);
  if (!fs.existsSync(dirMipmap)) fs.mkdirSync(dirMipmap, { recursive: true });
  if (!fs.existsSync(dirDrawable)) fs.mkdirSync(dirDrawable, { recursive: true });

  // Launcher PNG
  fs.writeFileSync(path.join(dirMipmap, 'ic_launcher.png'), renderIcon(d.launcher, 'LAUNCHER'));
  fs.writeFileSync(path.join(dirMipmap, 'ic_launcher_round.png'), renderIcon(d.launcher, 'ROUND'));
  fs.writeFileSync(path.join(dirMipmap, 'ic_launcher_foreground.png'), renderIcon(d.fg, 'FOREGROUND'));

  // Notification PNG
  fs.writeFileSync(path.join(dirDrawable, 'notification_icon.png'), renderIcon(d.notif, 'NOTIFICATION'));

  console.log(`Generated icons for ${d.name}`);
}

console.log('All icons successfully generated!');
