// Data pipeline (port of upstream scripts/loaddata.js parseData without the UI state machine).
// Creates a fresh DMI namespace per load, so reloading with a different mod set never leaks state.
import { install as installUtils } from './legacy/Utils';
import { install as installFormat } from './legacy/Format';
import { install as installConstants } from './legacy/modconstants';
import { install as installParseMod } from './legacy/parsemod';
import { install as installGrid } from './legacy/Grid';
import { install as installAffliction } from './legacy/MAffliction';
import { install as installWpn } from './legacy/MWpn';
import { install as installArmor } from './legacy/MArmor';
import { install as installItem } from './legacy/MItem';
import { install as installSpellTables } from './legacy/SpellTables';
import { install as installSpell } from './legacy/MSpell';
import { install as installUnit } from './legacy/MUnit';
import { install as installNation } from './legacy/MNation';
import { install as installSite } from './legacy/MSite';
import { install as installMerc } from './legacy/MMerc';
import { install as installEvent } from './legacy/MEvent';
import { parseTextToTable, createLookup } from './tsv';
import { installNationExtensions } from './extensions/nations';
import { installDerived, snapshotRawUnitFields } from './extensions/derived';
import { installCarries, snapshotStartItemClasses } from './extensions/carries';
import { installIndependents, loadVanillaPoptypes } from './extensions/independents';
import { installIndependentsPage } from './extensions/independentsPage';

export type DMI = any;

export interface ModFile {
  name: string;
  text: string;
}

export interface ModMessage {
  mod: string;
  modnum: number;
  line: number;
  level: 'warning' | 'error';
  msg: string;
  text: string;
}

export interface LoadOptions {
  /** Fetches a game data file (path relative to the site root, e.g. "gamedata/BaseU.csv"). */
  fetchText: (path: string) => Promise<string>;
  mods?: ModFile[];
  onProgress?: (stage: string, fraction: number) => void;
}

/** Table name on modctx, file, lookup key(s). Mirrors upstream parseData. */
const TABLES: [string, string, string?, string?, string?][] = [
  // [modctx key, file, lookup key, lookup key 2, lookup name override]
  ['itemdata', 'BaseI.csv', 'id', 'name', 'itemlookup'],
  ['armordata', 'armors.csv', 'id', 'name', 'armorlookup'],
  ['protections_by_armor', 'protections_by_armor.csv'],
  ['unitdata', 'BaseU.csv', 'id', 'name', 'unitlookup'],
  ['wpndata', 'weapons.csv', 'id', 'name', 'wpnlookup'],
  ['attributes_by_weapon', 'attributes_by_weapon.csv'],
  ['attributes_by_armor', 'attributes_by_armor.csv'],
  ['spelldata', 'spells.csv', 'id', 'name', 'spelllookup'],
  ['sitedata', 'MagicSites.csv', 'id', 'name', 'sitelookup'],
  ['mercdata', 'Mercenary.csv', 'id', 'name', 'merclookup'],
  ['eventdata', 'events.csv', 'id', 'name', 'eventlookup'],
  ['nationdata', 'nations.csv', 'id', 'nationname', 'nationlookup'],
  ['effects_weapons', 'effects_weapons.csv', 'record_id'],
  ['effects_spells', 'effects_spells.csv', 'record_id'],
  ['effect_modifier_bits', 'effect_modifier_bits.csv', 'bit_value'],
  ['effects_info', 'effects_info.csv', 'number'],
  ['attribute_keys', 'attribute_keys.csv', 'number'],
  ['attributes_by_spell', 'attributes_by_spell.csv'],
  ['afflictions', 'afflictions.csv', 'bit_value'],
  ['buffs_1_types', 'buffs_1_types.csv', 'bit_value'],
  ['buffs_2_types', 'buffs_2_types.csv', 'bit_value'],
  ['enchantments', 'enchantments.csv', 'number'],
  ['magic_paths', 'magic_paths.csv'],
  ['special_damage_types', 'special_damage_types.csv', 'bit_value'],
  ['anon_province_events', 'anon_province_events.csv', 'number'],
  ['monster_tags', 'monster_tags.csv', 'number'],
  ['special_unique_summons', 'special_unique_summons.csv', 'number'],
  ['terrain_specific_summons', 'terrain_specific_summons.csv', 'number'],
  ['other_planes', 'other_planes.csv', 'number'],
  ['map_terrain_types', 'map_terrain_types.csv', 'bit_value'],
  ['site_terrain_types', 'site_terrain_types.csv', 'bit_value'],
  ['attributes_by_nation', 'attributes_by_nation.csv'],
  ['fort_leader_types_by_nation', 'fort_leader_types_by_nation.csv'],
  ['fort_troop_types_by_nation', 'fort_troop_types_by_nation.csv'],
  ['coast_leader_types_by_nation', 'coast_leader_types_by_nation.csv'],
  ['coast_troop_types_by_nation', 'coast_troop_types_by_nation.csv'],
  ['nonfort_leader_types_by_nation', 'nonfort_leader_types_by_nation.csv'],
  ['nonfort_troop_types_by_nation', 'nonfort_troop_types_by_nation.csv'],
  ['pretender_types_by_nation', 'pretender_types_by_nation.csv'],
  ['unpretender_types_by_nation', 'unpretender_types_by_nation.csv'],
  ['realms', 'realms.csv'],
  ['nametypedata', 'nametypes.csv', 'id', undefined, 'nametypelookup'],
  ['unit_effects', 'unit_effects.csv', 'number'],
];

/** Builds a DMI namespace with every module installed but no data loaded. */
export function createDMI(): DMI {
  const DMI: DMI = { errors: [], modMessages: [], Options: {} };
  installUtils(DMI);
  installFormat(DMI);
  installConstants(DMI);
  installParseMod(DMI); // creates DMI.modctx
  installGrid(DMI);
  installAffliction(DMI);
  installWpn(DMI);
  installArmor(DMI);
  installItem(DMI);
  installSpellTables(DMI);
  installSpell(DMI);
  installUnit(DMI);
  installNation(DMI);
  installSite(DMI);
  installMerc(DMI);
  installEvent(DMI);
  return DMI;
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

export async function loadData(opts: LoadOptions): Promise<DMI> {
  const progress = opts.onProgress ?? (() => {});
  const DMI = createDMI();
  const modctx = DMI.modctx;

  progress('Downloading game data', 0);
  let done = 0;
  const texts = await Promise.all(
    TABLES.map(async ([, file]) => {
      const t = await opts.fetchText('gamedata/' + file);
      progress('Downloading game data', ++done / TABLES.length);
      return t;
    }),
  );

  progress('Parsing tables', 0);
  await tick();
  TABLES.forEach(([key, , k1, k2, lookupName], i) => {
    modctx[key] = parseTextToTable(texts[i]);
    if (k1) modctx[lookupName ?? key + '_lookup'] = createLookup(modctx[key], k1, k2);
  });
  modctx.school_lookup = DMI.modconstants[15];
  const startItemClasses = snapshotStartItemClasses(DMI); // legacy PreMod replaces the class with an item id

  progress('Preparing data', 0.1);
  await tick();
  //before applying mod (order is important!)
  DMI.MWpn.prepareData_PreMod();
  DMI.MArmor.prepareData_PreMod();
  DMI.MItem.prepareData_PreMod();
  DMI.MUnit.prepareData_PreMod();
  DMI.MSpell.prepareData_PreMod();
  DMI.MSite.prepareData_PreMod();
  DMI.MNation.prepareData_PreMod();
  DMI.MMerc.prepareData_PreMod();
  DMI.MEvent.prepareData_PreMod();

  loadVanillaPoptypes(DMI); // vanilla population types go through the mod parser first, so mods edit them

  const mods = opts.mods ?? [];
  if (mods.length) {
    progress('Applying mods', 0.3);
    await tick();
    mods.forEach((m, i) => modctx.parseMod(m.text.replace(/\r\n?/g, '\n'), i + 1, m.name));
  }

  progress('Finalising data', 0.5);
  await tick();
  const rawUnits = snapshotRawUnitFields(DMI);
  //after applying mod (order is important!)
  DMI.MWpn.prepareData_PostMod();
  DMI.MArmor.prepareData_PostMod();
  DMI.MItem.prepareData_PostMod();
  DMI.MUnit.prepareData_PostMod();
  DMI.MSpell.prepareData_PostMod();
  DMI.MNation.prepareData_PostMod();
  DMI.MSite.prepareData_PostMod();
  DMI.MMerc.prepareData_PostMod();
  DMI.MEvent.prepareData_PostMod();

  installNationExtensions(DMI);
  installCarries(DMI, startItemClasses);
  installDerived(DMI, rawUnits);
  installIndependents(DMI);
  installIndependentsPage(DMI);

  progress('Ready', 1);
  return DMI;
}
