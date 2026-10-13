// Types for calculated unit values: numbers the game computes and shows in-game that the data files
// don't hold directly (patrol strength, siege strength, upkeep, ...).

/**
 * CONFIRMED: documented formula, or checked against in-game values. LIKELY: community-derived or partly
 * unverified; shown with "≈". Formulas whose confidence would be UNKNOWN are never shipped.
 */
export type Confidence = 'CONFIRMED' | 'LIKELY';

export interface DerivedResult {
  /** null = not applicable to this unit (no row on the card, blank cell, ignored by filters). */
  value: number | null;
  /** Per-unit downgrade of the definition's confidence (only CONFIRMED → LIKELY is honoured). */
  confidence?: Confidence;
  note?: string;
}

/**
 * Situation a value is computed for. v1 computes base values only (neutral context); the reserved keys
 * let a later context panel (items, scales, province) plug in without changing the formula signatures.
 */
export interface DerivedContext {
  role?: 'commander' | 'troop';
  scales?: Record<string, number>;
  province?: { pd?: number; unrest?: number };
  items?: string[];
}

/** Unit fields a formula may read, normalised to numbers/booleans by inputs.ts. */
export interface UnitInputs {
  commander: boolean;
  /** Unit sheet values (after natural gear, old age and starting afflictions). */
  str: number;
  prec: number;
  enc: number;
  /** Spellcasting encumbrance; null when the unit has no magic paths. */
  castingEnc: number | null;
  /** Effective map move as shown on the unit sheet (includes the commander bonus and armour penalty). */
  mapmove: number;
  immobile: boolean;
  flying: boolean;
  mounted: boolean;
  animal: boolean;
  undisciplined: boolean;
  mindless: boolean;
  patrolbonus: number;
  siegebonus: number;
  castledef: number;
  /** Gold cost for this role; null when the unit has none (pretenders). */
  goldcost: number | null;
  addupkeep: number;
  sacred: boolean;
  slave: boolean;
  summoned: boolean;
  size: number;
  appetite: number;
  neednoteat: boolean;
  /** Includes the Nature magic bonus (+10 per level). */
  supplybonus: number;
  mount: { size: number; appetite: number; animal: boolean; neednoteat: boolean } | null;
}

export interface DerivedValue {
  id: string;
  /** Property name on unit objects; also the column id and filter key. */
  field: string;
  label: string;
  confidence: Confidence;
  /** Human-readable formula for the tooltip. */
  formula: string;
  source: string;
  decimals: number;
  compute(i: UnitInputs, ctx: DerivedContext): DerivedResult;
}
