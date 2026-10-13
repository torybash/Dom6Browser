// The only place that knows how legacy unit objects store their fields. Legacy mixes numbers and
// strings ("0" is truthy), and computes several sheet values lazily in MUnit.prepareForRender.
import type { DMI } from '../../load';
import type { DerivedContext, UnitInputs } from './types';

const num = (v: any): number => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const flag = (v: any): boolean => !!v && v !== '0' && v !== 0;

/** Raw values that legacy PostMod overwrites, captured before it runs. */
export interface RawUnitFields {
  mapmove: Map<number, string>;
}

/** Call after mods are applied and before PostMod. */
export function snapshotRawUnitFields(DMI: DMI): RawUnitFields {
  const mapmove = new Map<number, string>();
  for (const o of DMI.modctx.unitdata) mapmove.set(parseInt(o.id), String(o.mapmove ?? ''));
  return { mapmove };
}

/**
 * Unit sheet values come from prepareForRender (natural gear, old age, starting afflictions). It mutates
 * the unit and a sprite object shared with nation clones, so it runs on a copy unless the card has
 * already prepared the unit.
 */
function prepared(DMI: DMI, o: any): any {
  if (!o.unprep) return o;
  const c = Object.assign({}, o);
  c.sprite = { ...o.sprite };
  DMI.MUnit.prepareForRender(c);
  return c;
}

function isCommander(o: any, ctx: DerivedContext): boolean {
  if (ctx.role) return ctx.role === 'commander';
  // nation lists hold separate commander ('c') and troop ('u') copies of a unit
  if (o.type === 'c') return true;
  if (o.type === 'u') return false;
  // summoned commanders count too (legacy isCmdr leaves them out)
  return /cmdr/.test(o.sorttype || '');
}

export function readUnitInputs(DMI: DMI, raw: RawUnitFields, o: any, ctx: DerivedContext = {}): UnitInputs {
  const p = prepared(DMI, o);
  const mountId = num(o.mountmnr);
  const m = mountId > 0 ? DMI.modctx.unitlookup[mountId] : null;
  const hasPaths = !!String(p.mpath || '').trim();
  return {
    commander: isCommander(o, ctx),
    str: num(p.str),
    prec: num(p.prec),
    enc: num(p.enc),
    castingEnc: hasPaths ? num(p.casting_enc ?? p.enc) : null,
    mapmove: num(o.mapmove),
    // legacy turns a raw map move of 0 into 2
    immobile: flag(o.immobile) || raw.mapmove.get(parseInt(o.id)) === '0',
    flying: flag(o.flying),
    mounted: !!m,
    animal: flag(o.animal),
    undisciplined: flag(o.undisciplined),
    mindless: flag(o.mind),
    patrolbonus: num(o.patrolbonus),
    siegebonus: num(o.siegebonus),
    castledef: num(o.castledef),
    goldcost: o.goldcost == null || o.goldcost === '' ? null : num(o.goldcost),
    addupkeep: num(o.addupkeep),
    sacred: flag(o.holy),
    slave: flag(o.slave),
    summoned: !!o.createdby,
    size: num(o.size),
    appetite: num(o.appetite),
    neednoteat: flag(o.neednoteat),
    supplybonus: num(p.supplybonus),
    mount: m ? { size: num(m.size), appetite: num(m.appetite), animal: flag(m.animal), neednoteat: flag(m.neednoteat) } : null,
  };
}
