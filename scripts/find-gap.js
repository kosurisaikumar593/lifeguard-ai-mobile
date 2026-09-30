const fs = require('fs');
const { PNG } = require('pngjs');

const sourcePath = 'C:/Users/91934/.gemini/antigravity/brain/3b69e1e3-7c53-4b69-b262-f402afe6f089/.user_uploaded/media_1790702955396.png';
const data = fs.readFileSync(sourcePath);
const src = PNG.sync.read(data);

// Scan horizontal row counts of non-transparent pixels
const rowCounts = [];
for (let y = 0; y < src.height; y++) {
  let count = 0;
  for (let x = 0; x < src.width; x++) {
    const idx = (src.width * y + x) << 2;
    if (src.data[idx + 3] > 30) count++;
  }
  rowCounts.push({ y, count });
}

// Find rows where count dips to 0 between y=500 and y=700 (gap between shield tip and "LifeGuard AI" text)
for (let y = 500; y < 700; y++) {
  if (rowCounts[y].count < 10) {
    console.log(`Gap row at y=${y}: count=${rowCounts[y].count}`);
  }
}
