#!/usr/bin/env node
/**
 * Build production assets into dist/ — minified JS, no dev tools, no source maps.
 * Usage: node scripts/build-production.mjs
 */
import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');
const JS_DIR = join(ROOT, 'js');
const EXCLUDE_JS = new Set(['dev-grants.js']);

async function minifyFile(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', [
      '--yes', 'terser', inputPath,
      '--compress', 'passes=2',
      '--mangle',
      '--format', 'comments=false',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('close', async (code) => {
      if (code !== 0) {
        const src = await readFile(inputPath, 'utf8');
        await writeFile(outputPath, src);
        resolve(false);
        return;
      }
      await writeFile(outputPath, out);
      resolve(true);
    });
    child.on('error', reject);
  });
}

async function copyTree(src, dest, filter) {
  await mkdir(dest, { recursive: true });
  const { readdir, stat } = await import('node:fs/promises');
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    if (filter && !filter(from, entry)) continue;
    if (entry.isDirectory()) {
      await copyTree(from, to, filter);
    } else {
      await cp(from, to);
    }
  }
}

async function buildJs() {
  const { readdir } = await import('node:fs/promises');
  const files = await readdir(JS_DIR);
  await mkdir(join(DIST, 'js'), { recursive: true });
  for (const file of files) {
    if (!file.endsWith('.js') || EXCLUDE_JS.has(file)) continue;
    const input = join(JS_DIR, file);
    const output = join(DIST, 'js', file);
    await minifyFile(input, output);
  }
}

async function patchIndexHtml() {
  const src = join(ROOT, 'index.html');
  let html = await readFile(src, 'utf8');
  html = html.replace(/<script defer src="js\/dev-grants\.js[^"]*"><\/script>\s*/g, '');
  if (!html.includes('secure-runtime.js')) {
    html = html.replace(
      '<script defer src="https://cdn.jsdelivr.net/npm/chart.js',
      '<script src="js/secure-runtime.js"></script>\n  <script src="js/secure-storage.js"></script>\n  <script src="js/env-bootstrap.js"></script>\n  <script defer src="https://cdn.jsdelivr.net/npm/chart.js',
    );
  }
  await writeFile(join(DIST, 'index.html'), html);
}

async function main() {
  if (existsSync(DIST)) await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  await copyTree(join(ROOT, 'css'), join(DIST, 'css'));
  await buildJs();
  await patchIndexHtml();

  const optional = ['assets', 'img', 'favicon.ico', 'robots.txt'];
  for (const item of optional) {
    const p = join(ROOT, item);
    if (existsSync(p)) {
      const dest = join(DIST, item);
      const { stat } = await import('node:fs/promises');
      const s = await stat(p);
      if (s.isDirectory()) await copyTree(p, dest);
      else await cp(p, dest);
    }
  }

  console.log('Production build complete → dist/');
  console.log('Run: node scripts/production-server.mjs');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
