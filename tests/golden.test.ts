// Golden parity: the port must derive the same data and render the same detail html as upstream.
// Fixtures come from `npm run golden` (runs the original scripts in jsdom). Skipped if missing.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { KINDS, normalizeHtml, serializeEntity } from './golden/normalize.mjs';
import { vanilla, withMods } from './helpers';

const fixture = (name: string) => join(__dirname, 'golden', 'fixtures', name);

/** Known, intentional differences: kind -> field names ignored in the field comparison. */
const IGNORED_FIELDS: Record<string, string[]> = {
  // added by src/data/extensions/nations.ts for the new Nations page
  nation: ['searchable', 'erasort'],
  // per-spell structured summon list used by the Spells page Summons column
  spell: ['summons'],
  // single protection number for the Armor page Prot column
  armor: ['protval'],
};

paritySuite('vanilla', 'vanilla.json', () => vanilla());
paritySuite('with golden-test.dm', 'mods.json', () =>
  withMods([
    {
      name: 'golden-test.dm',
      text: readFileSync(join(__dirname, 'golden', 'mods', 'golden-test.dm'), 'utf8'),
    },
  ]),
);

function paritySuite(label: string, file: string, load: () => Promise<any>) {
  const path = fixture(file);
  describe.skipIf(!existsSync(path))(`golden parity with upstream (${label})`, async () => {
    const golden = JSON.parse(readFileSync(path, 'utf8'));
    const DMI = await load();
    const m = DMI.modctx;

    // same order as the dumper: render everything, then capture fields
    const html: Record<string, Record<string, string | null>> = {};
    for (const [key, kind] of KINDS as [string, string][]) {
      html[kind] = {};
      for (const o of m[key]) {
        let h: string | null = null;
        if (kind !== 'nation') {
          try {
            h = normalizeHtml(o.renderOverlay(o));
          } catch (e) {
            h = 'THREW: ' + e;
          }
        }
        html[kind][o.id] = h;
      }
    }
    DMI.takeContentJobs();

    for (const [key, kind] of KINDS as [string, string][]) {
      it(`${kind}: same entities`, () => {
        expect(m[key].map((o: any) => String(o.id)).sort()).toEqual(Object.keys(golden.html[kind]).sort());
      });

      it(`${kind}: same derived fields`, () => {
        const ignored = new Set(IGNORED_FIELDS[kind] ?? []);
        const diffs: string[] = [];
        for (const o of m[key]) {
          const mine = serializeEntity(o);
          const theirs = golden.fields[kind][o.id] ?? {};
          for (const k of new Set([...Object.keys(mine), ...Object.keys(theirs)])) {
            if (ignored.has(k)) continue;
            const a = JSON.stringify(mine[k]);
            const b = JSON.stringify(theirs[k]);
            if (a !== b)
              diffs.push(`${kind} ${o.id} .${k}: port=${a?.slice(0, 120)} upstream=${b?.slice(0, 120)}`);
          }
        }
        expect(diffs.slice(0, 15)).toEqual([]);
      });

      it(`${kind}: same detail html`, () => {
        const diffs: string[] = [];
        for (const id of Object.keys(golden.html[kind])) {
          const a = html[kind][id];
          const b = golden.html[kind][id];
          if (a !== b) {
            let i = 0;
            while (i < Math.min(a?.length ?? 0, b?.length ?? 0) && a![i] === b[i]) i++;
            diffs.push(
              `${kind} ${id} @${i}: port=…${a?.slice(Math.max(0, i - 60), i + 80)}… upstream=…${b?.slice(Math.max(0, i - 60), i + 80)}…`,
            );
          }
        }
        expect(diffs.slice(0, 8)).toEqual([]);
      });
    }
  });
}
