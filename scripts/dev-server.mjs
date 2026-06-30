#!/usr/bin/env node
/**
 * Local dev server with no-cache headers so browsers always load fresh files.
 * Usage: node scripts/dev-server.mjs [port]
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.argv[2]) || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    if (pathname === '/index.html' || pathname === '/') pathname = '/index.html';

    const filePath = join(ROOT, pathname);
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403, NO_CACHE);
      res.end('Forbidden');
      return;
    }

    await stat(filePath);
    const data = await readFile(filePath);
    const type = MIME[extname(filePath)] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': type, ...NO_CACHE });
    res.end(data);
  } catch {
    res.writeHead(404, NO_CACHE);
    res.end('Not found');
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(`NeonDraw dev server (no cache)`);
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  → http://127.0.0.1:${PORT}`);
});
