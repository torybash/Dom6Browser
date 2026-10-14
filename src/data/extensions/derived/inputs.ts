// The only place that knows how legacy unit objects store their fields. Legacy mixes numbers and
// strings ("0" is truthy), and computes several sheet values lazily in MUnit.prepareForRender.
import type { DMI } from '../../load';
import type { DerivedContext, UnitInputs, UpkeepPart } from './types';

const num = (v: any): number => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const flag = (v: any): boolean => !!v && v !== '0' && v !== 0;

/** Raw values that legacy PostMod overwrites, captured before it runs. */
export interface RawUnitFields {
  supplybonus: Map<number, string>;
  leader: Map<number, string>;
  /** ids in any nation's commander recruitment lists; filled after PostMod */
  recCommanders?: Set<number>;
}

/** Call after mods are applied and before PostMod. */
export function snapshotRawUnitFields(DMI: DMI): RawUnitFields {
  const supplybonus = new Map<number, string>();
  const leader = new Map<number, string>();
  for (const o of DMI.modctx.unitdata) {
    supplybonus.set(parseInt(o.id), String(o.supplybonus ?? ''));
    leader.set(parseInt(o.id), String(o.leader ?? ''));
  }
  return { supplybonus, leader };
}

const COMMANDER_LISTS = [
  'commanders', 'capcommanders', 'futurecapcommanders', 'foreigncommanders', 'forestcom', 'mountaincom', 'swampcom',
  'wastecom', 'cavecom', 'plainscom', 'coastcom', 'landcom', 'uwcom',
];

/** Call after MNation PostMod has built the nation recruitment lists. */
export function recruitableCommanders(DMI: DMI): Set<number> {
  const ids = new Set<number>();
  for (const n of DMI.modctx.nationdata) {
    for (const k of COMMANDER_LISTS) for (const id of n[k] || []) if (id) ids.add(parseInt(String(id).replace('#', '')));
  }
  return ids;
}

const NON_HOLY_PATHS = ['F', 'A', 'W', 'E', 'S', 'D', 'N', 'G', 'B'];

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

/** Legacy MUnit isCmdr: decides whether legacy added the commander +2 to map move. */
const legacyCommander = (o: any) => /cmdr/.test(o.sorttype || '') && !o.createdby;

function isCommander(o: any, ctx: DerivedContext): boolean {
  if (ctx.role) return ctx.role === 'commander';
  // nation lists hold separate commander ('c') and troop ('u') copies of a unit
  if (o.type === 'c') return true;
  if (o.type === 'u') return false;
  // summoned commanders count too (legacy isCmdr leaves them out)
  return /cmdr/.test(o.sorttype || '');
}

/**
 * Legacy MUnit.goldCost prices rider and mount together and rounds the sum. For upkeep the game rounds
 * each part on its own (commanders and anything above 30 gold down to a multiple of 5), and halves
 * each part by its own sacred/slave flags.
 */
function upkeepParts(DMI: DMI, o: any, mount: any, commander: boolean): UpkeepPart[] | null {
  // legacy clears the gold cost of pretenders
  if (o.typechar === 'Pretender') return null;
  const MU = DMI.MUnit;
  let rider = MU.monsterGoldCost(o, commander, 'worst');
  if (commander) rider = Math.trunc((rider + 3 * MU.monsterGoldCost(o, commander, 'best')) / 4);
  // extra riders (#nofriders) are priced like legacy goldCost does; not measured in game
  const riders = num(o.nofriders);
  if (riders > 1) {
    const co = num(o.coridermnr) > 0 ? DMI.modctx.unitlookup[o.coridermnr] : o;
    if (co) rider += MU.monsterGoldCost(co, false, 'worst') * (riders - 1);
  }
  const round = (g: number, cmd: boolean) => (cmd || g > 30 ? MU.round(g) : g);
  const parts: UpkeepPart[] = [{ gold: round(rider, commander), sacred: flag(o.holy), slave: flag(o.slave) }];
  if (mount) {
    const g = MU.monsterGoldCost(mount, false, 'worst') + num(o.mountgoldcost);
    parts.push({ gold: round(g, false), sacred: flag(mount.holy), slave: flag(mount.slave) });
  }
  return parts.filter((p) => p.gold > 0);
}

export function readUnitInputs(DMI: DMI, raw: RawUnitFields, o: any, ctx: DerivedContext = {}): UnitInputs {
  const p = prepared(DMI, o);
  const mountId = num(o.mountmnr);
  const m = mountId > 0 ? DMI.modctx.unitlookup[mountId] : null;
  const hasPaths = !!String(p.mpath || '').trim();
  const commander = isCommander(o, ctx);
  // legacy adds the commander +2 by unit type; in game it depends on how the unit is used
  let mapmove = num(o.mapmove);
  if (mapmove < 100) mapmove += (commander ? 2 : 0) - (legacyCommander(o) ? 2 : 0);
  return {
    commander,
    str: num(p.str),
    prec: num(p.prec),
    enc: num(p.enc),
    castingEnc: hasPaths ? num(p.casting_enc ?? p.enc) : null,
    mapmove,
    flying: flag(o.flying),
    old: flag(p.isold),
    mounted: !!m,
    animal: flag(o.animal),
    undisciplined: flag(o.undisciplined),
    mindless: flag(o.mind),
    patrolbonus: num(o.patrolbonus),
    siegebonus: num(o.siegebonus),
    castledef: num(o.castledef),
    upkeepParts: upkeepParts(DMI, o, m, commander),
    addupkeep: num(o.addupkeep),
    extraRiders: num(o.nofriders) > 1,
    summoned: !!o.createdby,
    size: num(o.size),
    appetite: num(o.appetite),
    neednoteat: flag(o.neednoteat),
    // prepareForRender adds +10 per Nature level; in game that only applies to commanders
    supplybonus: commander ? num(p.supplybonus) : num(raw.supplybonus.get(parseInt(o.id)) ?? o.supplybonus),
    mount: m ? { size: num(m.size), appetite: num(m.appetite), animal: flag(m.animal), neednoteat: flag(m.neednoteat) } : null,
    recruitableCommander: ctx.recruitable ?? !!raw.recCommanders?.has(parseInt(o.id)),
    magicLevels: NON_HOLY_PATHS.reduce((s, k) => s + num(o[k]), 0),
    sureRandomPath: (o.randompaths || []).some((r: any) => num(r.chance) >= 100),
    holyLevel: num(o.H),
    leader: num(raw.leader.get(parseInt(o.id)) ?? o.leader),
    slowRecruit: flag(o.slow_to_recruit),
  };
}
