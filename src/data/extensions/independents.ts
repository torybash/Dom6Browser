// New in this app: independents (province population types, "poptypes"). Vanilla poptypes are not in the
// game's data files; they are compiled into Dominions6.exe and extracted by scripts/extract-poptypes.py into
// a generated mod-syntax file (src/data/poptypes/vanilla.dm) plus a sidecar (poptypes.meta.json). The .dm is
// loaded through the real mod parser before user mods, so mods edit and add poptypes the way the game does.
// This module loads it and builds DMI.Independents, the read model of the Independents page.
import type { DMI } from '../load';
import vanillaDm from '../poptypes/vanilla.dm?raw';
import metaJson from '../poptypes/poptypes.meta.json';

export type Era = 'EA' | 'MA' | 'LA';
export type Terrain = 'deepsea' | 'sea' | 'cave' | 'farm' | 'forest' | 'mountain' | 'swamp' | 'waste' | 'plains';
export type PathLetter = 'F' | 'A' | 'W' | 'E' | 'S' | 'D' | 'N' | 'G' | 'B' | 'H';

/** A unit id with its (possibly missing) unit object. */
export interface UnitRef {
  id: number;
  /** modctx.unitdata entry, or null when the id names no unit (e.g. a mod references an undefined unit) */
  unit: any | null;
  /** unit name, or "Unit <id>" when unknown */
  name: string;
}

export type PdSlot = 'a' | 'b' | 'c';

/** One province-defence troop slot: defunit1 / defunit1b / defunit1c with its multiplier. */
export interface PdUnit {
  slot: PdSlot;
  unitKey: 'defunit1' | 'defunit1b' | 'defunit1c';
  unit: UnitRef;
  multKey: 'defmult1' | 'defmult1b' | 'defmult1c';
  /** multiplier in tenths: 10 = one troop per PD point. 10 when no defmult key is set (the engine default) */
  mult: number;
  /** false when the multiplier is the default because no defmult key is set */
  multExplicit: boolean;
}

export interface PdCommander {
  unit: UnitRef;
  /** where it comes from: defcom1, or the engine-only alternative commander (key 235) that overrides defcom1 */
  source: 'defcom1' | 'altPdCommander';
  /** the defcom1 unit that the alternative commander replaced, if both are set */
  overridesDefcom1: UnitRef | null;
  /** true when the poptype was edited by a mod: the engine-only key cannot be edited or cleared by mods, so the override may not match the real game */
  uncertain: boolean;
}

export interface ShadowedPair {
  /** mod command name, e.g. defunit1b */
  key: string;
  value: number;
  /** resolved unit for the defunit and defcom keys */
  unit: UnitRef | null;
}

export interface PdCount {
  slot: PdSlot;
  unit: UnitRef;
  mult: number;
  count: number;
}

export interface RandomPath {
  /** path letters that can be picked, e.g. "SDN"; "FAWESDNG" is a pick of any non-holy path */
  paths: string;
  levels: number;
  /** percent */
  chance: number;
  /** the commander it belongs to */
  commander: UnitRef;
}

export interface PoptypePaths {
  /** highest fixed level over the recruitable commanders, per path; only paths above 0 */
  fixed: Partial<Record<PathLetter, number>>;
  /** random picks of the recruitable commanders */
  random: RandomPath[];
  /** every path a recruitable commander can have, fixed or random, in F A W E S D N G B H order */
  letters: PathLetter[];
}

export interface Verification {
  recruits: string;
  pd: string;
  shadowedPd?: string;
  altPdCommander?: string;
}

export interface PoptypeInfo {
  id: number;
  /** official name (modding manual v6.36) for vanilla ids, "Poptype <id>" for ids a mod adds */
  name: string;
  /** name made unique among poptypes sharing a name, e.g. "Tritons (+ Triton Guard, Triton Trooper)" */
  label: string;
  /** e.g. "manual v6.36"; null for mod-added ids */
  nameSource: string | null;
  /** exists in the vanilla game (has a vanilla entry), even if a mod edited it */
  vanilla: boolean;
  /** a mod added or edited it */
  modded: boolean;
  modfiles: string[];
  recruits: UnitRef[];
  commanders: UnitRef[];
  pd: {
    units: PdUnit[];
    /** the effective PD commander (alternative commander if set, else defcom1), or null */
    commander: PdCommander | null;
    /** the ordered (key, value) list as mods see it (first occurrence per key, engine order) */
    raw: [string, number][];
    /** later duplicates of a key in the vanilla row: ignored by the game */
    shadowed: ShadowedPair[];
    /** engine key 230: data the game never reads, kept for completeness */
    unusedData: UnitRef | null;
  };
  availability: {
    /** terrains where the map generator can give this poptype, per era (lists only, no probabilities) */
    byEra: Record<Era, Terrain[]>;
    /** union over the eras */
    terrains: Terrain[];
    /** eras with at least one terrain */
    eras: Era[];
    /** eras where the rare "special province" roll (on land) can give it */
    specialEras: Era[];
    /** no map-generator source at all: only events, sites and mods can place it */
    never: boolean;
  };
  paths: PoptypePaths;
  /** a recruitable commander has a non-holy magic path (fixed, or a random pick with any chance) */
  isMage: boolean;
  /** a recruitable commander has holy (priest) level, fixed or as a random pick */
  isPriest: boolean;
  verification: Verification;
  /** troops of each defence slot at a given province defence level */
  pdCounts(pdLevel: number): PdCount[];
}

export interface UnitPoptypes {
  /** poptypes whose recruit list has the unit */
  recruit: PoptypeInfo[];
  /** poptypes whose commander list has the unit */
  commander: PoptypeInfo[];
  /** poptypes with the unit in a PD troop slot */
  pdUnit: PoptypeInfo[];
  /** poptypes whose effective PD commander is the unit */
  pdCommander: PoptypeInfo[];
}

export interface IndependentsApi {
  eras: Era[];
  terrains: Terrain[];
  /** vanilla extraction provenance (exe hash, manual source, terrain notes) */
  provenance: any;
  /** every poptype (vanilla and mod-added), by id */
  all: PoptypeInfo[];
  get(id: number): PoptypeInfo | undefined;
  /** reverse index; every list is empty for a unit no poptype uses */
  byUnit(unitId: number): UnitPoptypes;
  /** troops for a defence slot: the one place that rounds PD * mult / 10 */
  pdTroopCount(pdLevel: number, mult: number): number;
}

interface PoptypeMeta {
  name: string | null;
  nameSource: string | null;
  terrain: Record<Era, Terrain[]>;
  specialEras: Era[];
  shadowedPd: [string, number][];
  altPdCommander: number | null;
  unusedPdData: number | null;
  otherKeys: [number, number][];
  verification: Verification;
}

const META = metaJson as unknown as { provenance: any; eras: Era[]; terrains: Terrain[]; poptypes: Record<string, PoptypeMeta> };

const ERAS: Era[] = META.eras;
const PATH_ORDER: PathLetter[] = ['F', 'A', 'W', 'E', 'S', 'D', 'N', 'G', 'B', 'H'];
const PD_SLOTS: { slot: PdSlot; unitKey: PdUnit['unitKey']; multKey: PdUnit['multKey'] }[] = [
  { slot: 'a', unitKey: 'defunit1', multKey: 'defmult1' },
  { slot: 'b', unitKey: 'defunit1b', multKey: 'defmult1b' },
  { slot: 'c', unitKey: 'defunit1c', multKey: 'defmult1c' },
];
/** Multiplier of a defence slot without a defmult key: one troop per PD point. */
const DEFAULT_PD_MULT = 10;

/**
 * Troops a defence slot gives at a province defence level. Confirmed in game for mult 5-15 at ordinary
 * PD levels; how the engine rounds at very low PD is still being measured. Change it here only.
 */
export function pdTroopCount(pdLevel: number, mult: number): number {
  return Math.floor((pdLevel * mult) / 10);
}

/** Parses the generated vanilla poptype file with the mod parser. Call before the user mods. */
export function loadVanillaPoptypes(DMI: DMI): void {
  const { modctx } = DMI;
  const messagesBefore = DMI.modMessages.length;
  modctx.parseMod(vanillaDm.replace(/\r\n?/g, '\n'), 0, 'vanilla poptypes');
  // the parser marks everything it touches as modded by that file; these are the base game
  for (const o of modctx.poptypedata) {
    o.modded = false;
    delete o.modfiles;
  }
  modctx.currentmod = '';
  // a problem in the generated file is a bug in this app, not something for the user's mod list
  for (const m of DMI.modMessages.splice(messagesBefore)) DMI.errors.push(`vanilla poptypes line ${m.line}: ${m.msg}`);
}

/** Builds DMI.Independents. Call after unit data is final. */
export function installIndependents(DMI: DMI): void {
  const { modctx } = DMI;

  const ref = (id: number): UnitRef => {
    const unit = modctx.unitlookup[id] ?? null;
    return { id, unit, name: unit ? String(unit.name) : `Unit ${id}` };
  };

  const pathsOf = (commanders: UnitRef[]): PoptypePaths => {
    const fixed: Partial<Record<PathLetter, number>> = {};
    const random: RandomPath[] = [];
    const letters = new Set<PathLetter>();
    for (const c of commanders) {
      const u = c.unit;
      if (!u) continue;
      // mpath holds the fixed levels with magic boosts applied, e.g. "S2 N1 H1 U0 R9 " (U and R are not paths)
      for (const m of String(u.mpath || '').matchAll(/([FAWESDNGBH])(-?\d+)/g)) {
        const lvl = parseInt(m[2]);
        if (lvl > 0) {
          const p = m[1] as PathLetter;
          fixed[p] = Math.max(fixed[p] ?? 0, lvl);
          letters.add(p);
        }
      }
      for (const r of u.randompaths || []) {
        const chance = parseInt(r.chance);
        if (!(chance > 0)) continue;
        random.push({ paths: r.paths, levels: parseInt(r.levels) || 1, chance, commander: c });
        for (const ch of r.paths) if (PATH_ORDER.includes(ch as PathLetter)) letters.add(ch as PathLetter);
      }
    }
    return { fixed, random, letters: PATH_ORDER.filter((p) => letters.has(p)) };
  };

  const build = (o: any): PoptypeInfo => {
    const meta: PoptypeMeta | undefined = META.poptypes[String(o.id)];
    const recruits = (o.recunits as number[]).map(ref);
    const commanders = (o.reccoms as number[]).map(ref);
    const pdMap = new Map<string, number>();
    for (const [k, v] of o.pd as [string, number][]) if (!pdMap.has(k)) pdMap.set(k, v);

    const units: PdUnit[] = [];
    for (const s of PD_SLOTS) {
      const id = pdMap.get(s.unitKey);
      if (id == null) continue;
      const explicit = pdMap.has(s.multKey);
      units.push({
        slot: s.slot,
        unitKey: s.unitKey,
        unit: ref(id),
        multKey: s.multKey,
        mult: explicit ? pdMap.get(s.multKey)! : DEFAULT_PD_MULT,
        multExplicit: explicit,
      });
    }
    const defcom = pdMap.get('defcom1');
    let commander: PdCommander | null = null;
    if (meta?.altPdCommander != null) {
      commander = {
        unit: ref(meta.altPdCommander),
        source: 'altPdCommander',
        overridesDefcom1: defcom != null ? ref(defcom) : null,
        uncertain: !!o.modded,
      };
    } else if (defcom != null) {
      commander = { unit: ref(defcom), source: 'defcom1', overridesDefcom1: null, uncertain: false };
    }

    const byEra: Record<Era, Terrain[]> = meta ? meta.terrain : { EA: [], MA: [], LA: [] };
    const terrains = META.terrains.filter((t) => ERAS.some((e) => byEra[e].includes(t)));
    const specialEras = meta ? meta.specialEras : [];
    const paths = pathsOf(commanders);
    const letters = paths.letters;
    const isMage = letters.some((p) => p !== 'H');
    const isPriest = letters.includes('H');

    const info: PoptypeInfo = {
      id: o.id,
      name: meta?.name ?? `Poptype ${o.id}`,
      label: '', // set once all names are known
      nameSource: meta?.nameSource ?? null,
      vanilla: !!meta,
      modded: !!o.modded,
      modfiles: o.modfiles ? [...o.modfiles] : [],
      recruits,
      commanders,
      pd: {
        units,
        commander,
        raw: (o.pd as [string, number][]).map(([k, v]) => [k, v]),
        shadowed: (meta?.shadowedPd ?? []).map(([key, value]) => ({
          key,
          value,
          unit: /^def(unit|com)/.test(key) ? ref(value) : null,
        })),
        unusedData: meta?.unusedPdData != null ? ref(meta.unusedPdData) : null,
      },
      availability: {
        byEra,
        terrains,
        eras: ERAS.filter((e) => byEra[e].length > 0),
        specialEras,
        never: terrains.length === 0 && specialEras.length === 0,
      },
      paths,
      isMage,
      isPriest,
      verification: meta?.verification ?? { recruits: 'defined by a mod', pd: 'defined by a mod' },
      pdCounts: (pdLevel: number) =>
        units.map((u) => ({ slot: u.slot, unit: u.unit, mult: u.mult, count: pdTroopCount(pdLevel, u.mult) })),
    };
    return info;
  };

  const all: PoptypeInfo[] = [...modctx.poptypedata].sort((a: any, b: any) => a.id - b.id).map(build);
  assignLabels(all);

  const byId = new Map(all.map((p) => [p.id, p]));
  const index = new Map<number, UnitPoptypes>();
  const slot = (id: number): UnitPoptypes => {
    let s = index.get(id);
    if (!s) index.set(id, (s = { recruit: [], commander: [], pdUnit: [], pdCommander: [] }));
    return s;
  };
  const push = (list: PoptypeInfo[], p: PoptypeInfo) => {
    if (!list.includes(p)) list.push(p);
  };
  for (const p of all) {
    for (const r of p.recruits) push(slot(r.id).recruit, p);
    for (const c of p.commanders) push(slot(c.id).commander, p);
    for (const u of p.pd.units) push(slot(u.unit.id).pdUnit, p);
    if (p.pd.commander) push(slot(p.pd.commander.unit.id).pdCommander, p);
  }
  const none: UnitPoptypes = { recruit: [], commander: [], pdUnit: [], pdCommander: [] };

  const api: IndependentsApi = {
    eras: ERAS,
    terrains: META.terrains,
    provenance: META.provenance,
    all,
    get: (id) => byId.get(id),
    byUnit: (unitId) => index.get(unitId) ?? none,
    pdTroopCount,
  };
  DMI.Independents = api;
}

/**
 * Official names repeat (27/28/29 are all "Militia, Archers, Hvy Inf"). Within a group of equal names the
 * label adds what sets a poptype apart: the units it has that not every member of the group has
 * ("+ Scout"); if that is still not unique, its recruit ids.
 */
function assignLabels(all: PoptypeInfo[]): void {
  const groups = new Map<string, PoptypeInfo[]>();
  for (const p of all) {
    const g = groups.get(p.name);
    if (g) g.push(p);
    else groups.set(p.name, [p]);
  }
  for (const [name, group] of groups) {
    if (group.length === 1) {
      group[0].label = name;
      continue;
    }
    const unitNames = (p: PoptypeInfo) => [...new Set([...p.recruits, ...p.commanders].map((u) => u.name))];
    const common = unitNames(group[0]).filter((n) => group.every((p) => unitNames(p).includes(n)));
    const extras = new Map(group.map((p) => [p, unitNames(p).filter((n) => !common.includes(n))]));
    const suffix = new Map(group.map((p) => [p, extras.get(p)!.length ? '+ ' + extras.get(p)!.join(', ') : '']));
    const count = new Map<string, number>();
    for (const s of suffix.values()) count.set(s, (count.get(s) ?? 0) + 1);
    for (const p of group) {
      let s = suffix.get(p)!;
      if (count.get(s)! > 1) s = (s ? s + '; ' : '') + 'units ' + p.recruits.map((u) => u.id).join('/');
      p.label = s ? `${name} (${s})` : name;
    }
  }
}
