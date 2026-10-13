// New in this app: calculated unit values (see registry.ts). Each value is exposed on every unit object
// as a lazy, non-enumerable property (e.g. o.calc_patrol), so sorting and property filters can use it
// while legacy code, which only walks enumerable keys, and the golden parity tests never see it.
import type { DMI } from '../../load';
import { readUnitInputs, recruitableCommanders, snapshotRawUnitFields, type RawUnitFields } from './inputs';
import { UNIT_DERIVED, formatDerived, resolveConfidence } from './registry';
import type { DerivedContext, DerivedResult, DerivedValue, UnitInputs } from './types';

export { snapshotRawUnitFields, UNIT_DERIVED };
export type { DerivedValue, DerivedResult, DerivedContext };

export interface ResolvedResult extends DerivedResult {
  confidence: 'CONFIRMED' | 'LIKELY';
}

export interface DerivedApi {
  defs: DerivedValue[];
  /** Value for the neutral context is cached per unit; other contexts are computed each call. */
  get(o: any, id: string, ctx?: DerivedContext): ResolvedResult;
  /** Every applicable value for a unit, in registry order. */
  all(o: any): { def: DerivedValue; result: ResolvedResult }[];
}

export function installDerived(DMI: DMI, raw: RawUnitFields) {
  raw.recCommanders = recruitableCommanders(DMI);
  const byId = new Map(UNIT_DERIVED.map((d) => [d.id, d]));
  const cache = new WeakMap<object, Map<string, ResolvedResult>>();
  const neutralInputs = new WeakMap<object, UnitInputs>();
  const inputsFor = (o: any, ctx: DerivedContext): UnitInputs => {
    if (Object.keys(ctx).length) return readUnitInputs(DMI, raw, o, ctx);
    let i = neutralInputs.get(o);
    if (!i) neutralInputs.set(o, (i = readUnitInputs(DMI, raw, o, ctx)));
    return i;
  };

  const compute = (o: any, def: DerivedValue, ctx: DerivedContext): ResolvedResult => {
    let r: DerivedResult;
    try {
      r = def.compute(inputsFor(o, ctx), ctx);
    } catch (e) {
      console.warn(`calculated ${def.id} failed for unit ${o.id}`, e);
      r = { value: null };
    }
    if (r.value != null && !Number.isFinite(r.value)) r = { value: null };
    return { ...r, confidence: resolveConfidence(def, r) };
  };

  const api: DerivedApi = {
    defs: UNIT_DERIVED,
    get(o, id, ctx) {
      const def = byId.get(id);
      if (!def) throw new Error('unknown calculated value ' + id);
      if (ctx && Object.keys(ctx).length) return compute(o, def, ctx);
      let m = cache.get(o);
      if (!m) cache.set(o, (m = new Map()));
      let r = m.get(id);
      if (!r) m.set(id, (r = compute(o, def, {})));
      return r;
    },
    all(o) {
      return UNIT_DERIVED.map((def) => ({ def, result: api.get(o, def.id) })).filter((x) => x.result.value != null);
    },
  };
  DMI.Derived = api;

  for (const o of DMI.modctx.unitdata) {
    // legacy matchProperty treats a value of 0 as missing; calculated values are often 0
    const legacyMatch = o.matchProperty;
    if (typeof legacyMatch === 'function') {
      o.matchProperty = (u: any, key: string, comp: (v: any, c: any) => any, match: any) => {
        if (!/^calc_/.test(key)) return legacyMatch(u, key, comp, match);
        const v = u[key];
        return v === undefined ? undefined : comp(v, match) ? true : undefined;
      };
    }
    for (const def of UNIT_DERIVED) {
      Object.defineProperty(o, def.field, {
        get: () => api.get(o, def.id).value ?? undefined,
        enumerable: false,
        configurable: true,
      });
    }
  }

  // table columns, hidden until chosen in the column picker
  for (const def of UNIT_DERIVED) {
    DMI.MUnit.grid.columns.push({
      id: def.field,
      field: def.field,
      name: def.shortLabel,
      title: `${def.label}: ${def.formula}`,
      width: 44,
      sortable: true,
      cssClass: 'numeric',
      derived: true,
      formatter: (_row: number, _cell: number, _v: any, _col: any, o: any) => formatDerived(def, api.get(o, def.id)),
    });
  }

  // units without a value sort last in either direction
  const makeSortCmp = DMI.makeSortCmp;
  DMI.makeSortCmp = (column: any, asc: boolean, prev?: (a: any, b: any) => number) => {
    if (!column.derived) return makeSortCmp(column, asc, prev);
    const f = column.field;
    return (a: any, b: any) => {
      const x = a[f], y = b[f];
      if (x === y) return prev ? prev(a, b) : 0;
      if (x === undefined) return 1;
      if (y === undefined) return -1;
      return (x > y ? 1 : -1) * (asc ? 1 : -1);
    };
  };

  // legacy >= / <= property filters compare integers; calculated values have decimals
  const buildPropertyArgs = DMI.buildPropertyArgs;
  DMI.buildPropertyArgs = (rows: any[] = []) => {
    const isCalc = (r: any) => /^calc_/i.test(String(r.key ?? '').trim()) && (r.comp === '>=' || r.comp === '<=');
    const args = buildPropertyArgs(rows.filter((r) => !isCalc(r)));
    for (const r of rows.filter(isCalc)) {
      const c = parseFloat(r.val);
      if (!Number.isFinite(c)) continue;
      const comp = r.comp === '>=' ? (v: any) => parseFloat(v) >= c : (v: any) => parseFloat(v) <= c;
      args.push({ key: String(r.key).toLowerCase().trim(), not: r.not ? 1 : 0, val: c, comp });
    }
    return args;
  };
}

/* Range filters: filter key = field (calc_patrol), value "min~max" with either side optional. */

export function parseRange(v: unknown): { min?: number; max?: number } | null {
  if (typeof v !== 'string' || !v.includes('~')) return null;
  const [a, b] = v.split('~').map((s) => (s.trim() === '' ? undefined : parseFloat(s)));
  const min = Number.isFinite(a) ? a : undefined;
  const max = Number.isFinite(b) ? b : undefined;
  return min === undefined && max === undefined ? null : { min, max };
}

export function formatRange(min: string, max: string): string {
  return min.trim() || max.trim() ? `${min.trim()}~${max.trim()}` : '';
}

/** True if the unit passes every calculated-value range in the filters; units without a value fail. */
export function inCalcRanges(o: any, filters: Record<string, any>): boolean {
  for (const def of UNIT_DERIVED) {
    const r = parseRange(filters[def.field]);
    if (!r) continue;
    const v = o[def.field];
    if (v === undefined) return false;
    if (r.min !== undefined && v < r.min - 1e-9) return false;
    if (r.max !== undefined && v > r.max + 1e-9) return false;
  }
  return true;
}
