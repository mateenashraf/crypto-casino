#!/usr/bin/env node
/**
 * Local dev server with no-cache headers so browsers always load fresh files.
 * Proxies /api/* to the backend when running on port 5080.
 * Usage: node scripts/dev-server.mjs [port]
 */
import { createServer, request as httpRequest } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.argv[2]) || 8080;
const API_TARGET = process.env.NEONDRAW_API || 'http://127.0.0.1:5080';

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

const BLOCKED_PREFIXES = ['/backend', '/blockchain', '/.git', '/.cursor', '/dist', '/node_modules'];

function isBlocked(pathname) {
  const lower = pathname.toLowerCase();
  if (lower.endsWith('.map') || lower.includes('/.env')) return true;
  return BLOCKED_PREFIXES.some((p) => lower === p || lower.startsWith(`${p}/`));
}

function proxyApi(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const target = new URL(url.pathname + url.search, API_TARGET);
  const proxyReq = httpRequest(
    {
      hostname: target.hostname,
      port: target.port,
      path: target.pathname + target.search,
      method: req.method,
      headers: { ...req.headers, host: target.host },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on('error', () => {
    res.writeHead(502, NO_CACHE);
    res.end('API unavailable');
  });
  req.pipe(proxyReq);
}

createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);

    if (pathname.startsWith('/api/')) {
      proxyApi(req, res);
      return;
    }

    if (isBlocked(pathname)) {
      res.writeHead(404, NO_CACHE);
      res.end('Not found');
      return;
    }

    if (pathname.endsWith('/')) pathname += 'index.html';
    if (pathname === '/index.html' || pathname === '/') pathname = '/index.html';

    const filePath = normalize(join(ROOT, pathname));
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
  console.log(`  API proxy → ${API_TARGET}`);
});
