const http = require('http');
const fs = require('fs');
const path = require('path');

const apkPath = path.join(__dirname, '..', 'LifeGuard-AI.apk');
const port = 8080;

const server = http.createServer((req, res) => {
  if (req.url === '/download' || req.url === '/LifeGuard-AI.apk') {
    if (!fs.existsSync(apkPath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('APK file not found');
    }
    const stat = fs.statSync(apkPath);
    res.writeHead(200, {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Length': stat.size,
      'Content-Disposition': 'attachment; filename="LifeGuard-AI.apk"',
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(apkPath).pipe(res);
  } else {
    // Landing page
    const stat = fs.existsSync(apkPath) ? fs.statSync(apkPath) : { size: 0 };
    const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Download LifeGuard AI APK</title>
  <style>
    body { font-family: sans-serif; background: #0B132B; color: #FFF; text-align: center; padding: 40px 16px; margin: 0; }
    .card { max-width: 440px; margin: 0 auto; background: #1C2541; padding: 32px 20px; border-radius: 20px; border: 1px solid #3A506B; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    h1 { margin: 0 0 6px 0; font-size: 26px; }
    p { color: #94A3B8; font-size: 14px; margin: 0 0 24px 0; }
    .btn { display: inline-block; background: #0D52D6; color: #FFF; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 14px rgba(13,82,214,0.4); }
    .info { margin-top: 24px; font-size: 12px; color: #64748B; line-height: 1.6; text-align: left; background: #0A1128; padding: 14px; border-radius: 10px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🛡️ LifeGuard AI</h1>
    <p>“Your Safety, Our Priority” — Standalone Android Release APK</p>
    <a class="btn" href="/download">⬇️ Download APK (${sizeMb} MB)</a>
    <div class="info">
      <strong>Installation Steps on Android:</strong><br>
      1. Tap the download button above.<br>
      2. Once downloaded, tap the notification or open your <em>Downloads</em> folder.<br>
      3. Tap <strong>Install</strong> (enable "Install unknown apps" if prompted).<br>
      4. Open LifeGuard AI on your phone!
    </div>
  </div>
</body>
</html>`);
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log('APK Download server running on http://0.0.0.0:' + port);
});
