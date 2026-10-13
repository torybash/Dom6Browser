// New in this app: calculated unit values (see registry.ts). Each value is exposed on every unit object
// as a lazy, non-enumerable property (e.g. o.calc_patrol), so sorting and property filters can use it
// while legacy code, which only walks enumerable keys, and the golden parity tests never see it.
import type { DMI } from '../../load';
import { readUnitInputs, snapshotRawUnitFields, type RawUnitFields } from './inputs';
import { UNIT_DERIVED, resolveConfidence } from './registry';
import type { DerivedContext, DerivedResult, DerivedValue } from './types';

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
  const byId = new Map(UNIT_DERIVED.map((d) => [d.id, d]));
  const cache = new WeakMap<object, Map<string, ResolvedResult>>();

  const compute = (o: any, def: DerivedValue, ctx: DerivedContext): ResolvedResult => {
    let r: DerivedResult;
    try {
      r = def.compute(readUnitInputs(DMI, raw, o, ctx), ctx);
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
    for (const def of UNIT_DERIVED) {
      Object.defineProperty(o, def.field, {
        get: () => api.get(o, def.id).value ?? undefined,
        enumerable: false,
        configurable: true,
      });
    }
  }
}
