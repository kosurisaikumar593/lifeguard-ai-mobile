const fs = require('fs');
const { PNG } = require('pngjs');

const sourcePath = 'C:/Users/91934/.gemini/antigravity/brain/3b69e1e3-7c53-4b69-b262-f402afe6f089/.user_uploaded/media_1790702955396.png';
const data = fs.readFileSync(sourcePath);
const src = PNG.sync.read(data);

console.log(`Top-left pixel: R=${src.data[0]}, G=${src.data[1]}, B=${src.data[2]}, A=${src.data[3]}`);

// Bounding box of non-white / content
let minX = src.width, maxX = 0, minY = src.height, maxY = 0;
for (let y = 0; y < src.height; y++) {
  for (let x = 0; x < src.width; x++) {
    const idx = (src.width * y + x) << 2;
    const r = src.data[idx];
    const g = src.data[idx + 1];
    const b = src.data[idx + 2];
    const a = src.data[idx + 3];
    // Check if pixel is not pure white or transparent
    if (a > 20 && !(r > 248 && g > 248 && b > 248)) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
console.log(`Content bounding box: x=[${minX}, ${maxX}], y=[${minY}, ${maxY}] (width=${maxX - minX + 1}, height=${maxY - minY + 1})`);
