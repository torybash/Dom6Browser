// The calculated unit values shown by the app. Static (no DMI), so the UI can import it directly.
import * as F from './formulas';
import type { Confidence, DerivedResult, DerivedValue } from './types';

export const UNIT_DERIVED: DerivedValue[] = [
  {
    id: 'patrol',
    field: 'calc_patrol',
    label: 'Patrol strength',
    confidence: 'LIKELY',
    formula: '(precision + map move, or 30 if flying) / 20; ×2 for commanders; ×½ if undisciplined or mindless; + patrol bonus',
    source: 'Dominions 6 manual p.51',
    decimals: 1,
    compute: F.patrol,
  },
  {
    id: 'siege',
    field: 'calc_siege',
    label: 'Siege strength',
    confidence: 'LIKELY',
    formula: 'strength² / 100 (×2 if flying) + siege bonus',
    source: 'Dominions 6 manual p.71; illwiki (Dom5) siege page',
    decimals: 1,
    compute: F.siege,
  },
  {
    id: 'siegedef',
    field: 'calc_siegedef',
    label: 'Siege defence',
    confidence: 'LIKELY',
    formula: '(strength² / 100 (×2 if flying, ÷8 if mindless, ÷2 if animal, ÷2 if undisciplined) + castle defence) / 2',
    source: 'Dominions 6 manual p.71; illwiki (Dom5) siege page',
    decimals: 1,
    compute: F.siegeDefence,
  },
  {
    id: 'upkeep',
    field: 'calc_upkeep',
    label: 'Upkeep (gold/year)',
    confidence: 'LIKELY',
    formula: 'gold cost / 15 per month, half for sacred units and slaves; per year: ⌊(gold × 12 + 7) / 15⌋',
    source: "Dominions 6 manual p.24; Loggy's exe notes (illwiki)",
    decimals: 0,
    compute: F.upkeep,
  },
  {
    id: 'supply',
    field: 'calc_supply',
    label: 'Supply usage',
    confidence: 'LIKELY',
    formula: '(size, minus 1 if above 1, + gluttony) / 2, ÷2 for animals, rounded down to ½; rider + mount; − supply bonus',
    source: 'illwiki Dom6 Gluttony page (the manual says size − 2)',
    decimals: 1,
    compute: F.supply,
  },
  {
    id: 'castingenc',
    field: 'calc_castingenc',
    label: 'Casting encumbrance',
    confidence: 'CONFIRMED',
    formula: 'encumbrance + 2 × armour encumbrance',
    source: 'Dominions 6 manual p.76',
    decimals: 0,
    compute: F.castingEnc,
  },
];

/** A result can only lower its definition's confidence, never raise it. */
export function resolveConfidence(def: DerivedValue, r: DerivedResult): Confidence {
  return def.confidence === 'LIKELY' || r.confidence === 'LIKELY' ? 'LIKELY' : 'CONFIRMED';
}

export function formatDerived(def: DerivedValue, r: DerivedResult): string {
  if (r.value == null) return '';
  const v = String(Number(r.value.toFixed(def.decimals)));
  return resolveConfidence(def, r) === 'LIKELY' ? '≈' + v : v;
}
