// New in this app: which units carry which items. BaseU.csv gives a few units a `startitem` class number
// and BaseI.csv gives some items the same column. Equal class numbers are INFERRED to pair up (each class
// holds exactly one item in vanilla). Legacy MUnit.prepareData_PreMod overwrites the unit's class with the
// linked item id, so the raw class is captured before it runs. `randomitems` is a value (e.g. 300) for
// magic items rolled at recruitment, not an item id.
import type { DMI } from '../load';

export interface CarriesApi {
  /** Item class a unit carries one of (inferred), if any. */
  unitClass(o: any): number | undefined;
  /** Items sharing the unit's class. */
  itemsFor(o: any): any[];
  /** Units that could carry the item (same class). */
  unitsFor(o: any): any[];
}

/** unit id -> startitem class, from the vanilla table. Call before legacy PreMod. */
export function snapshotStartItemClasses(DMI: DMI): Map<number, number> {
  const classes = new Map<number, number>();
  for (const o of DMI.modctx.unitdata) {
    const c = parseInt(o.startitem);
    if (c > 0) classes.set(parseInt(o.id), c);
  }
  return classes;
}

const itemClass = (o: any): number | undefined => {
  const c = parseInt(o.startitem);
  return c > 0 ? c : undefined;
};

export function installCarries(DMI: DMI, unitClasses: Map<number, number>) {
  const { modctx } = DMI;
  const unitClass = (o: any) => unitClasses.get(parseInt(o.id));
  DMI.Carries = {
    unitClass,
    itemsFor(o) {
      const c = unitClass(o);
      return c === undefined ? [] : modctx.itemdata.filter((i: any) => itemClass(i) === c);
    },
    unitsFor(o) {
      const c = itemClass(o);
      return c === undefined ? [] : modctx.unitdata.filter((u: any) => unitClass(u) === c);
    },
  } satisfies CarriesApi;
}

const section = (title: string, body: string) =>
  `<div class="carries-section nation-section"><h4>${title}</h4><div class="refs">${body}</div></div>`;

/** Html for the unit's "Carries" section, or ''. The start item class needs no section: the legacy
 *  pane already shows it as a "starts with" row (each class holds exactly one item in vanilla). */
export function renderUnitCarries(_DMI: DMI, o: any): string {
  const random = parseInt(o.randomitems);
  return random > 0 ? section('Carries', `<span>Random magic items (value ${random})</span>`) : '';
}

/** Html for the item's "Can be carried by" section, or ''. */
export function renderItemCarriedBy(DMI: DMI, o: any): string {
  const units: any[] = DMI.Carries.unitsFor(o);
  if (!units.length) return '';
  const { Utils } = DMI;
  return section(
    'Can be carried by <span class="text-muted">(inferred: matching start item class)</span>',
    units.map((u) => `<span>${Utils.unitRef(u.id, u.fullname || u.name)}</span>`).join(''),
  );
}

/** Inserts the Carries sections into a rendered unit or item pane, before the footer. */
export function withCarries(DMI: DMI, o: any, html: string): string {
  if (!o || !DMI.Carries) return html;
  const section = DMI.modctx.unitlookup[o.id] === o ? renderUnitCarries(DMI, o) : DMI.modctx.itemlookup[o.id] === o ? renderItemCarriedBy(DMI, o) : '';
  const at = html.indexOf('<div class="overlay-footer">');
  return section && at >= 0 ? html.slice(0, at) + section + html.slice(at) : html;
}
