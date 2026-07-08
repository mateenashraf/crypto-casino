#!/usr/bin/env node
/**
 * Production static server — security headers, blocked paths, serves dist/ or project root.
 * Usage: node scripts/production-server.mjs [port]
 */
import { createServer, request as httpRequest } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const SERVE_ROOT = existsSync(join(DIST, 'index.html')) ? DIST : ROOT;
const PORT = Number(process.argv[2]) || 8080;
const API_TARGET = process.env.NEONDRAW_API || 'http://127.0.0.1:5080';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self' https: wss:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
};

const BLOCKED_PREFIXES = [
  '/backend',
  '/blockchain',
  '/scripts',
  '/.git',
  '/.cursor',
  '/dist',
  '/node_modules',
];

const BLOCKED_FILES = new Set([
  '/js/dev-grants.js',
  '/package.json',
  '/package-lock.json',
]);

function isBlocked(pathname) {
  const lower = pathname.toLowerCase();
  if (BLOCKED_FILES.has(lower)) return true;
  if (lower.endsWith('.md') || lower.endsWith('.map') || lower.endsWith('.csproj')) return true;
  if (lower.includes('/.env')) return true;
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
      res.writeHead(proxyRes.statusCode || 502, { ...SECURITY_HEADERS, ...proxyRes.headers });
      proxyRes.pipe(res);
    },
  );
  proxyReq.on('error', () => {
    res.writeHead(502, SECURITY_HEADERS);
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

    if (pathname.endsWith('/')) pathname += 'index.html';

    if (isBlocked(pathname)) {
      res.writeHead(404, SECURITY_HEADERS);
      res.end('Not found');
      return;
    }

    const filePath = normalize(join(SERVE_ROOT, pathname));
    if (!filePath.startsWith(SERVE_ROOT)) {
      res.writeHead(403, SECURITY_HEADERS);
      res.end('Forbidden');
      return;
    }

    await stat(filePath);
    const data = await readFile(filePath);
    const type = MIME[extname(filePath)] || 'application/octet-stream';
    const cache = extname(filePath) === '.html'
      ? { 'Cache-Control': 'no-store' }
      : { 'Cache-Control': 'public, max-age=3600, immutable' };

    res.writeHead(200, { 'Content-Type': type, ...SECURITY_HEADERS, ...cache });
    res.end(data);
  } catch {
    res.writeHead(404, SECURITY_HEADERS);
    res.end('Not found');
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(`NeonDraw production server`);
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  Serving: ${SERVE_ROOT}`);
  console.log(`  API proxy → ${API_TARGET}`);
});
