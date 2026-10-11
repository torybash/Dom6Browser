#!/usr/bin/env node
// Fetches the upstream dom6inspector repo at the pinned SHA and copies its
// game data and images into public/. Usage: npm run sync [-- --force]
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { repo, sha } = JSON.parse(readFileSync(join(root, 'upstream.json'), 'utf8'));
const vendor = join(root, 'vendor', 'dom6inspector');
const force = process.argv.includes('--force');

const git = (...args) => execFileSync('git', args, { cwd: vendor, stdio: 'inherit' });

function currentSha() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: vendor }).toString().trim();
  } catch {
    return null;
  }
}

if (force || currentSha() !== sha) {
  rmSync(vendor, { recursive: true, force: true });
  mkdirSync(vendor, { recursive: true });
  git('init', '-q');
  git('remote', 'add', 'origin', repo);
  git('fetch', '-q', '--depth', '1', 'origin', sha);
  git('checkout', '-q', 'FETCH_HEAD');
  console.log(`Fetched ${repo} @ ${sha}`);
} else {
  console.log(`vendor already at ${sha}`);
}

for (const dir of ['gamedata', 'images']) {
  const dest = join(root, 'public', dir);
  rmSync(dest, { recursive: true, force: true });
  cpSync(join(vendor, dir), dest, { recursive: true });
  console.log(`Copied ${dir}/ -> public/${dir}/`);
}

if (!existsSync(join(root, 'public'))) mkdirSync(join(root, 'public'));
writeFileSync(
  join(root, 'public', 'gamedata', 'VERSION.json'),
  JSON.stringify({ upstream: repo, sha, synced: new Date().toISOString() }, null, 2),
);
console.log('Done.');
