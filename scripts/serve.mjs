// Zero-dependency static server for the built site in ./dist (default port 1350).
// Unknown extensionless paths fall back to index.html so client-side routes still load.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const PORT = Number(process.env.PORT) || 1350;
const HOST = process.env.HOST || '0.0.0.0';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
  console.error(`[serve] ${ROOT}/index.html not found — run \`npm run build\` first.`);
  process.exit(1);
}

function send(req, res, filePath, status = 200) {
  const ext = path.extname(filePath).toLowerCase();
  const isHashedAsset = filePath.startsWith(path.join(ROOT, 'assets') + path.sep);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': TYPES[ext] || 'application/octet-stream',
    'Content-Length': fs.statSync(filePath).size,
    // Vite fingerprints everything under /assets, so it can be cached forever; index.html
    // must always be revalidated or visitors would keep loading stale bundle names.
    'Cache-Control': isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { ...SECURITY_HEADERS, Allow: 'GET, HEAD' });
    return res.end();
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400, SECURITY_HEADERS);
    return res.end('Bad request');
  }

  const filePath = path.join(ROOT, path.normalize(pathname));
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403, SECURITY_HEADERS);
    return res.end('Forbidden');
  }

  let stat = null;
  try {
    stat = fs.statSync(filePath);
  } catch {
    // not found — handled below
  }
  if (stat && stat.isFile()) return send(req, res, filePath);
  if (stat && stat.isDirectory() && fs.existsSync(path.join(filePath, 'index.html'))) {
    return send(req, res, path.join(filePath, 'index.html'));
  }

  // Missing files with an extension are real 404s (a broken image shouldn't get HTML back);
  // extensionless paths are app routes and get the SPA shell.
  if (path.extname(pathname)) {
    res.writeHead(404, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Not found');
  }
  return send(req, res, path.join(ROOT, 'index.html'));
});

server.listen(PORT, HOST, () => {
  console.log(`OTT frontend serving ${ROOT} on http://${HOST}:${PORT}`);
});
