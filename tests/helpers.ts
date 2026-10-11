import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadData, type ModFile } from '../src/data/load';

const PUBLIC = join(__dirname, '..', 'public');

export const fetchText = (path: string) => readFile(join(PUBLIC, path), 'utf8');

let cached: Promise<any> | null = null;
/** Vanilla data, loaded once per test file. */
export function vanilla() {
  return (cached ??= loadData({ fetchText }));
}

export function withMods(mods: ModFile[]) {
  return loadData({ fetchText, mods });
}
