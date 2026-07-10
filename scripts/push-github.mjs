#!/usr/bin/env node
/**
 * Push project files to GitHub via REST API (no local git required).
 * Usage: GITHUB_TOKEN=... node scripts/push-github.mjs [repo-name]
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const REPO_NAME = process.argv[2] || 'crypto-casino';
const TOKEN = process.env.GITHUB_TOKEN || tryGhToken();
const API = 'https://api.github.com';

function tryGhToken() {
  try {
    return execSync('gh auth token', { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${TOKEN}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...opts.headers,
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.message || `${res.status} ${path}`);
  return data;
}

async function collectFiles(dir, base = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.name === 'node_modules' || e.name === '.git') continue;
    if (e.isDirectory()) files.push(...(await collectFiles(full, base)));
    else files.push(relative(base, full));
  }
  return files;
}

async function main() {
  if (!TOKEN) {
    console.error('Not authenticated. Run: gh auth login');
    process.exit(1);
  }

  const user = await api('/user');
  const owner = user.login;
  console.log(`Authenticated as ${owner}`);

  try {
    await api(`/repos/${owner}/${REPO_NAME}`);
    console.log(`Repo ${owner}/${REPO_NAME} already exists`);
  } catch {
    await api('/user/repos', {
      method: 'POST',
      body: JSON.stringify({
        name: REPO_NAME,
        description: 'BitStarz-inspired crypto casino demo with Web3 wallet payments',
        private: false,
        auto_init: false,
      }),
    });
    console.log(`Created https://github.com/${owner}/${REPO_NAME}`);
  }

  const files = await collectFiles(ROOT);
  console.log(`Uploading ${files.length} files...`);

  for (const file of files.sort()) {
    const content = await readFile(join(ROOT, file));
    const isBinary = content.includes(0);
    const body = {
      message: `Add ${file}`,
      content: isBinary
        ? content.toString('base64')
        : Buffer.from(content).toString('base64'),
    };

    let sha;
    try {
      const existing = await api(`/repos/${owner}/${REPO_NAME}/contents/${file}`);
      sha = existing.sha;
      body.message = `Update ${file}`;
    } catch {
      /* new file */
    }
    if (sha) body.sha = sha;

    await api(`/repos/${owner}/${REPO_NAME}/contents/${encodeURIComponent(file).replace(/%2F/g, '/')}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    console.log(`  ✓ ${file}`);
  }

  console.log(`\nDone: https://github.com/${owner}/${REPO_NAME}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
