const fs = require('fs');
const { PNG } = require('pngjs');

const sourcePath = 'C:/Users/91934/.gemini/antigravity/brain/3b69e1e3-7c53-4b69-b262-f402afe6f089/.user_uploaded/media_1790702955396.png';
const data = fs.readFileSync(sourcePath);
const src = PNG.sync.read(data);

let minX = src.width, maxX = 0, minY = src.height, maxY = 0;
for (let y = 0; y < 594; y++) {
  for (let x = 0; x < src.width; x++) {
    const idx = (src.width * y + x) << 2;
    if (src.data[idx + 3] > 20) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}

console.log(`Shield emblem bounds: x=[${minX}, ${maxX}], y=[${minY}, ${maxY}] (w=${maxX - minX + 1}, h=${maxY - minY + 1})`);
