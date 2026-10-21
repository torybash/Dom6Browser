// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { UNIT_DERIVED } from '../src/data/extensions/derived/registry';
import { enhance, renderRef } from '../src/ui/legacy';
import { markDiffs } from '../src/ui/Compare';
import { vanilla } from './helpers';

const STATS = new Set(['mapmove', 'str', 'goldcost', 'size', 'leader', 'enc']);

async function card(ref: string) {
  const DMI = await vanilla();
  const root = document.createElement('div');
  root.innerHTML = renderRef(DMI, ref, false)!.html;
  enhance(root);
  return root;
}

const tip = (row: Element) => (row.querySelector(':scope > template.stat-tip-src') as HTMLTemplateElement).content;

describe('derived stat tooltips', () => {
  it('registry entries name a legacy stat row', () => {
    for (const d of UNIT_DERIVED) expect(STATS.has(d.stat!), d.id).toBe(true);
  });

  it('attaches tips to the Spearman stat rows', async () => {
    const root = await card('unit 61');
    const val = (k: string) => root.querySelector<HTMLElement>(`.calc-row[data-key=${k}]`)!.dataset.value;
    const str = root.querySelector<HTMLElement>('.ustat[data-key=str]')!;
    expect(str.dataset.tip).toBe('1');
    expect(str.hasAttribute('title')).toBe(false);
    expect(str.classList.contains('has-derived')).toBe(true);
    const t = tip(str);
    expect(t.querySelector('.tip-head')!.textContent).toBeTruthy();
    const text = t.textContent!;
    expect(text).toContain('Siege strength');
    expect(text).toContain('Siege defence');
    const values = Array.from(t.querySelectorAll('.tip-value')).map((e) => e.textContent);
    expect(values).toEqual([val('calc_siege'), val('calc_siegedef')]);
    expect(tip(root.querySelector('.ustat[data-key=mapmove]')!).textContent).toContain('Patrol strength');
    for (const k of ['goldcost', 'size', 'leader', 'enc']) {
      const r = root.querySelector(`.ustat[data-key=${k}]`);
      if (r?.classList.contains('has-derived')) expect(r.getAttribute('title')).toBeNull();
    }
    expect(root.querySelector('.ustat[data-key=goldcost]')!.classList.contains('has-derived')).toBe(true);
    expect(root.querySelector('.ustat[data-key=size]')!.classList.contains('has-derived')).toBe(true);
  });

  it('keeps the Calculated section as a closed details', async () => {
    const root = await card('unit 61');
    const sec = root.querySelector('.calc-section')!;
    expect(sec.tagName).toBe('DETAILS');
    expect(sec.hasAttribute('open')).toBe(false);
    expect(sec.querySelector('summary.calc-head')).not.toBeNull();
    expect(sec.querySelector('[data-key=calc_siege]')).not.toBeNull();
  });

  it('Compare opens the Calculated section when a calc row differs', async () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    for (const [el, ref] of [[a, 'unit 61'], [b, 'unit 22']] as const) el.innerHTML = (await card(ref)).innerHTML;
    markDiffs([a, b]);
    expect(a.querySelector('.calc-section')!.hasAttribute('open')).toBe(true);
  });
});

describe('ability chip tooltips', () => {
  it('every ability and flag icon has a description', async () => {
    const { ABILITY_ICONS, FLAG_ICONS } = await import('../src/ui/unitCard');
    const { ABILITY_TIPS, FLAG_TIPS } = await import('../src/ui/abilityTips');
    for (const k of Object.keys(ABILITY_ICONS)) expect(ABILITY_TIPS[k], k).toBeTruthy();
    for (const k of Object.keys(FLAG_ICONS)) expect(FLAG_TIPS[k], k).toBeTruthy();
  });

  it('chips get a styled tooltip and cards drop the basecost row', async () => {
    const DMI = await vanilla();
    for (const u of DMI.modctx.unitdata.filter((o: any) => o.wastesurvival)) {
      const root = await card('unit ' + u.id);
      const chip = root.querySelector<HTMLElement>('.uchip[data-key=wastesurvival]');
      if (!chip) continue;
      expect(chip.dataset.tip).toBe('1');
      expect(chip.hasAttribute('title')).toBe(false);
      const t = tip(chip);
      expect(t.querySelector('.tip-head')!.textContent).toBe('Wasteland survival');
      expect(t.textContent).toContain('reduces the map move cost');
      expect(chip.getAttribute('aria-label')).toContain('map move cost');
      expect(root.querySelector('tr.gcost')).toBeNull();
      expect(root.textContent).not.toMatch(/basecost/i);
      return;
    }
    throw new Error('no unit with wastesurvival found');
  });
});
