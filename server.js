/**
 * server.js — Local HTTP server for MediaLite
 *
 * Menambahkan header wajib agar SharedArrayBuffer tersedia di browser:
 *   Cross-Origin-Opener-Policy: same-origin
 *   Cross-Origin-Embedder-Policy: require-corp
 *
 * Jalankan dengan: node server.js
 * Kemudian buka:   http://localhost:8787
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT    = 8787;
const ROOT    = __dirname;

const MIME = {
  '.html' : 'text/html; charset=utf-8',
  '.css'  : 'text/css',
  '.js'   : 'application/javascript',
  '.wasm' : 'application/wasm',
  '.json' : 'application/json',
  '.png'  : 'image/png',
  '.jpg'  : 'image/jpeg',
  '.jpeg' : 'image/jpeg',
  '.webp' : 'image/webp',
  '.svg'  : 'image/svg+xml',
  '.ico'  : 'image/x-icon',
  '.md'   : 'text/markdown',
};

const server = http.createServer((req, res) => {
  // Tambahkan header keamanan WASM / SharedArrayBuffer
  res.setHeader('Cross-Origin-Opener-Policy',   'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy',  'require-corp');

  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(ROOT, urlPath);
  const ext      = path.extname(filePath).toLowerCase();
  const mimeType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500);
        res.end('500 Internal Server Error');
      }
      console.log(`[404] ${req.method} ${req.url}`);
      return;
    }

    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(data);
    console.log(`[200] ${req.method} ${req.url}`);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  ┌─────────────────────────────────────────┐');
  console.log('  │                                         │');
  console.log(`  │   MediaLite Server berjalan!            │`);
  console.log('  │                                         │');
  console.log(`  │   Buka: http://localhost:${PORT}          │`);
  console.log('  │                                         │');
  console.log('  │   COOP/COEP headers: ✅ AKTIF           │');
  console.log('  │   SharedArrayBuffer:  ✅ TERSEDIA        │');
  console.log('  │                                         │');
  console.log('  └─────────────────────────────────────────┘');
  console.log('');
  console.log('  Tekan Ctrl+C untuk menghentikan server.');
  console.log('');
});
