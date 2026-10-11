#!/usr/bin/env node
// Runs the ORIGINAL upstream dom6inspector scripts (vendor/, from `npm run sync`) inside jsdom with
// jQuery, renders every entity, and writes fixtures used by tests/golden.test.ts to check that the
// port in src/data/legacy produces identical derived data and detail-pane html.
//
// Usage: npm run golden                        (vanilla data -> fixtures/vanilla.json)
//        node tests/golden/dump-upstream.mjs a.dm b.dm   (with mods -> fixtures/mods.json)
import { JSDOM } from 'jsdom';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KINDS, normalizeHtml, serializeEntity } from './normalize.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const vendor = join(here, '..', '..', 'vendor', 'dom6inspector');
const outDir = join(here, 'fixtures');
const modFiles = process.argv.slice(2).map((f) => resolve(f));
const modQuery = modFiles.map((f) => '&mod=' + encodeURIComponent(basename(f))).join('');

const dom = new JSDOM('<!doctype html><html><body><div id="primary-details"></div></body></html>', {
  url: 'http://localhost/?loadEvents=1' + modQuery,
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const { window } = dom;
window.isMobileDevice = false;
window.versionCode = '?v=30';
window.console = { ...console, log() {} }; // upstream is chatty

const run = (rel) => window.eval(readFileSync(join(vendor, rel), 'utf8') + `\n//# sourceURL=${rel}`);

run('scripts/slickgrid/lib/jquery-1.7.min.js');
run('scripts/slickgrid/lib/jquery-ui-1.8.16.custom.min.js');
run('scripts/ParsedQueryString.js');
run('scripts/jquery.cookie.js');

// serve data files from disk instead of the network
const $ = window.jQuery;
const readData = (url) => {
  const path = decodeURIComponent(url.split('?')[0]);
  // upstream loads server mods from mods/<name>; serve the files given on the command line
  if (path.startsWith('mods/')) return readFileSync(modFiles.find((f) => basename(f) === path.slice(5)), 'utf8');
  return readFileSync(join(vendor, path), 'utf8');
};
$.ajax = (opts) => {
  try {
    const text = readData(opts.url);
    setTimeout(() => opts.success && opts.success(text), 0);
  } catch (e) {
    setTimeout(() => opts.error && opts.error({ responseText: String(e) }, 'error', e), 0);
  }
};
$.get = () => {}; // descriptions are not part of the comparison

for (const f of [
  'scripts/PaneManager.js', 'scripts/DMI/Utils.js', 'scripts/DMI/Format.js', 'scripts/modconstants.js',
  'scripts/parsemod.js', 'scripts/loaddata.js', 'scripts/DMI/CGrid.js', 'scripts/DMI/MAffliction.js',
  'scripts/DMI/MWpn.js', 'scripts/DMI/MArmor.js', 'scripts/DMI/MItem.js', 'scripts/DMI/SpellTables.js',
  'scripts/DMI/MSpell.js', 'scripts/DMI/MUnit.js', 'scripts/DMI/MNation.js', 'scripts/DMI/MSite.js',
  'scripts/DMI/MMerc.js', 'scripts/DMI/MEvent.js', 'scripts/DMI/bitfields.js',
]) run(f);

const DMI = window.DMI;
await new Promise((resolve) => {
  DMI.initGrids = resolve;
  DMI.continueLoading();
});

const modctx = DMI.modctx;
const fixtures = { html: {}, fields: {} };
for (const [key, kind] of KINDS) {
  fixtures.html[kind] = {};
  fixtures.fields[kind] = {};
  for (const o of modctx[key]) {
    let html = null;
    if (kind !== 'nation') {
      try {
        html = normalizeHtml(o.renderOverlay(o));
      } catch (e) {
        html = 'THREW: ' + e;
      }
    }
    fixtures.html[kind][o.id] = html;
  }
  // fields are captured after rendering everything, since rendering mutates (prepareForRender)
}
for (const [key, kind] of KINDS) {
  for (const o of modctx[key]) fixtures.fields[kind][o.id] = serializeEntity(o);
}

mkdirSync(outDir, { recursive: true });
const outFile = modFiles.length ? 'mods.json' : 'vanilla.json';
fixtures.mods = modFiles.map((f) => basename(f));
writeFileSync(join(outDir, outFile), JSON.stringify(fixtures));
const counts = Object.fromEntries(KINDS.map(([, k]) => [k, Object.keys(fixtures.html[k]).length]));
console.info('wrote', outFile, counts);
window.close();
process.exit(0);
