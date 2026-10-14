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
  /** Treat the unit as recruitable (e.g. a mod adds it to a recruitment list). */
  recruitable?: boolean;
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
  /** Map move as shown on the unit sheet for this role (commanders +2, armour penalty included). */
  mapmove: number;
  flying: boolean;
  /** Past its maximum age: the game lowers its stats and map move in ways legacy does not fully model. */
  old: boolean;
  mounted: boolean;
  animal: boolean;
  undisciplined: boolean;
  mindless: boolean;
  patrolbonus: number;
  siegebonus: number;
  castledef: number;
  /**
   * What the game charges upkeep on: the rider and its mount separately, each with its own rounded gold
   * for this role and its own sacred/slave flags. Empty when the unit costs nothing; null for pretenders,
   * as a pretender god seemed to cost none in game (as ordinary commanders the game charges them like any other commander).
   */
  upkeepParts: UpkeepPart[] | null;
  addupkeep: number;
  /** Has extra riders (#nofriders); their upkeep has not been measured in game. */
  extraRiders: boolean;
  summoned: boolean;
  size: number;
  appetite: number;
  neednoteat: boolean;
  /** Supply bonus; includes +10 per Nature level for commanders only, as in game. */
  supplybonus: number;
  mount: { size: number; appetite: number; animal: boolean; neednoteat: boolean } | null;
  /** In some nation's commander recruitment list. */
  recruitableCommander: boolean;
  /** Sum of magic path levels other than Holy. */
  magicLevels: number;
  /** Has a random magic path with a 100% chance. */
  sureRandomPath: boolean;
  holyLevel: number;
  /** Leadership without magic bonuses. */
  leader: number;
  slowRecruit: boolean;
}

export interface UpkeepPart {
  gold: number;
  sacred: boolean;
  slave: boolean;
}

export interface DerivedValue {
  id: string;
  /** Property name on unit objects; also the column id and filter key. */
  field: string;
  label: string;
  /** Table column header. */
  shortLabel: string;
  confidence: Confidence;
  /** Human-readable formula for the tooltip. */
  formula: string;
  source: string;
  decimals: number;
  compute(i: UnitInputs, ctx: DerivedContext): DerivedResult;
}
