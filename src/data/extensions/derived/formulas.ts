// Formulas for calculated unit values. Each is a pure function of normalised unit inputs, so in-game
// measurements can adjust one without touching the others. Sources: MAN = Dominions 6 manual,
// WIKI5/WIKI6 = illwiki.com dom5/dom6 pages, LOGGY = Loggy's exe notes on illwiki.
import type { DerivedResult, UnitInputs } from './types';

const none: DerivedResult = { value: null };

/** The game rounds patrol strength up to one decimal. */
const roundUp1 = (v: number) => Math.ceil(v * 10 - 1e-9) / 10;

/** Patrol strength (MAN p.51): shown in game when clicking Precision. */
export function patrol(i: UnitInputs): DerivedResult {
  let v = (i.prec + (i.flying ? 30 : i.mapmove)) / 20;
  if (i.commander) v *= 2;
  if (i.undisciplined || i.mindless) v *= 0.5;
  const value = roundUp1(v + i.patrolbonus);
  // mounted units use their mount's map move and lower precision in game; old units lose map move
  if (i.mounted) return { value, confidence: 'LIKELY', note: 'mounted: the game uses values this formula does not have' };
  if (i.old) return { value, confidence: 'LIKELY', note: 'old age lowers map move in game' };
  return { value };
}

const oldNote = { confidence: 'LIKELY', note: 'old age lowers strength in game' } as const;

/** Siege strength, i.e. wall reduction per turn in "humans" (MAN p.71 structure, WIKI5 scaling). */
export function siege(i: UnitInputs): DerivedResult {
  const value = (i.str * i.str * (i.flying ? 2 : 1)) / 100 + i.siegebonus;
  return i.old ? { value, ...oldNote } : { value };
}

/** Siege defence, i.e. wall repair per turn (MAN p.71 structure, WIKI5 scaling). */
export function siegeDefence(i: UnitInputs): DerivedResult {
  const div = (i.mindless ? 8 : 1) * (i.animal ? 2 : 1) * (i.undisciplined ? 2 : 1);
  const value = ((i.str * i.str * (i.flying ? 2 : 1)) / div / 100 + i.castledef) / 2;
  if (i.old) return { value, ...oldNote };
  // monkeys are animals the game does not halve
  if (i.animal) return { value, confidence: 'LIKELY', note: 'animals count half, except monkeys' };
  return { value };
}

/**
 * Gold the monthly upkeep is based on (pays a fifteenth of it per month): each part halved, rounding
 * down, once if sacred and once more if a slave. Measured in game from the nation's total upkeep.
 */
export function upkeepGold(i: UnitInputs): number | null {
  if (!i.upkeepParts) return null;
  let total = 0;
  i.upkeepParts.forEach((p, n) => {
    // extra upkeep (#addupkeep) is taken to belong to the unit itself, not its mount
    let g = p.gold + (n === 0 ? i.addupkeep : 0);
    if (p.sacred) g = Math.floor(g / 2);
    if (p.slave) g = Math.floor(g / 2);
    total += g;
  });
  return Math.max(0, total);
}

/** Upkeep in gold per year, rounded to the nearest gold (MAN p.24 rule; measured in game, 6.37). */
export function upkeep(i: UnitInputs): DerivedResult {
  const gold = upkeepGold(i);
  if (gold == null) return none;
  const value = Math.floor((gold * 12 + 7) / 15);
  if (i.addupkeep) return { value, confidence: 'LIKELY', note: 'extra upkeep from #addupkeep not measured in game' };
  if (i.extraRiders) return { value, confidence: 'LIKELY', note: 'extra riders not measured in game' };
  return { value };
}

/** Supply eaten by one body (WIKI6 Gluttony rule; the manual's "size minus 2" disagrees above size 3). */
export function bodySupply(size: number, appetite: number, animal: boolean, neednoteat: boolean): number {
  if (neednoteat && appetite <= 0) return 0;
  let s = ((size > 1 ? size - 1 : size) + appetite) / 2;
  if (animal) s /= 2;
  return Math.max(0, Math.floor(s * 2) / 2);
}

/**
 * Supply usage per month as the unit sheet shows it (Size popup); negative means the unit provides
 * supply. The sheet counts the rider only; armies also feed the mount.
 */
export function supply(i: UnitInputs): DerivedResult {
  const value = bodySupply(i.size, i.appetite, i.animal, i.neednoteat) - i.supplybonus;
  if (!i.mount) return { value };
  const m = bodySupply(i.mount.size, i.mount.appetite, i.mount.animal, i.mount.neednoteat);
  return m ? { value, note: `the mount eats ${m} more (armies count both)` } : { value };
}

/**
 * Commander points on the recruitment screen (fitted on 71 commanders measured in game). Only for
 * commanders in a nation's recruitment list.
 */
export function commanderPoints(i: UnitInputs): DerivedResult {
  if (!i.commander || !i.recruitableCommander) return none;
  const mage = i.magicLevels > 0 || i.sureRandomPath;
  const thin = !mage && (i.holyLevel >= 2 || i.leader >= 150);
  const value = (mage || thin ? 2 : 1) * (i.slowRecruit ? 2 : 1);
  // the Holy and leadership thresholds rest on 3-4 measured commanders each
  return thin ? { value, confidence: 'LIKELY', note: 'decided by Holy 2+ or leadership 150+, seen on few units' } : { value };
}

/** Encumbrance when casting spells: base encumbrance plus twice the armour's (MAN p.76). */
export function castingEnc(i: UnitInputs): DerivedResult {
  return { value: i.castingEnc };
}
