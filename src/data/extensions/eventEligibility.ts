// New in this app: the Events page "eligibility checker".
// The user describes a province (owner nation, turn, scales, dominion, terrain, buildings, a commander…)
// and each event's requirements are checked against it: met, failed, or not modelled.
// Semantics follow the Dominions 6 Event Modding Manual (v6.36) plus the exe findings in events.ts:
// - scale reqs: `req_luck N` needs luck >= N; a negative N also allows that much of the opposite scale,
//   `req_unluck N` is the same on the misfortune side (so `req_luck 0` = "no misfortune").
// - `minpop`/`maxpop` are in dekapop (x10 people); events need >= 50 people unless `pop0ok`.
// - `minunrest`/`maxunrest`/`mindef`/`maxdef` vary +/-25% each check, so values in that band are "maybe".
// - seasons 0 spring .. 3 winter; months 0..11 (4 = mid summer, 10 = mid winter), season = month / 3.
// - `land 1` land, `land 0` sea; terrain flags 1 = must have, 0 = must not have.
// - `fort/temple/lab/capital` 1 = must, 0 = must not; `mydominion 1` owner's dominion, 0 = not.
// - `story`: uses the event's *effective* level (inherited along chains, see events.ts).
// Anything that depends on things the state cannot describe (units, sites, world codes, enchantments…)
// is "unmodelled": shown, but never blocks an event.
import type { EventInfo } from './events';

export type ScaleAxis = 'order' | 'prod' | 'heat' | 'growth' | 'luck' | 'magic';
export type TerrainFlag =
  | 'sea' | 'plains' | 'coast' | 'mountain' | 'forest' | 'farm' | 'swamp' | 'waste' | 'cave' | 'freshwater'
  | 'deep' | 'kelp' | 'gorge' | 'drip' | 'caveforest';

export interface ProvinceState {
  /** province owner: a nation id, or 'indep' for an independent province */
  nation?: number | 'indep';
  /** owner's era (1 early, 2 middle, 3 late), when the nation is known and DMI was passed */
  era?: number;
  turn?: number;
  /** story events setting: 0 off, 1 minor, 2 all (the Events page default is All) */
  story: 0 | 1 | 2;
  /** signed province scales, positive = Order / Productivity / Heat / Growth / Luck / Magic */
  scales: Partial<Record<ScaleAxis, number>>;
  /** dominion in candles: positive = owner's dominion, negative = enemy dominion */
  dom?: number;
  /** undefined = terrain not specified; otherwise every flag not in the set is absent */
  terrain?: Set<TerrainFlag>;
  season?: number;
  month?: number;
  fort?: boolean;
  temple?: boolean;
  lab?: boolean;
  capital?: boolean;
  /** population in people (not dekapop) */
  pop?: number;
  unrest?: number;
  pd?: number;
  troops?: number;
  /** a (non-sneaking) commander is present */
  commander?: boolean;
  /** the commander's order (targorder numbers) */
  order?: number;
  /** best mage/priest levels present, letters FAWESDNGBH */
  paths?: Partial<Record<string, number>>;
  /** only fully modelled events pass the table filter */
  strict: boolean;
  /** hide events that need a storyline already running here */
  noChain: boolean;
  names?: { nation?: (id: number) => string | undefined; unit?: (id: number) => string | undefined };
}

export interface ReqCheck {
  key: string;
  value: string;
  label: string;
}

export interface CheckResult {
  verdict: 'eligible' | 'blocked' | 'unknown';
  met: ReqCheck[];
  failed: ReqCheck[];
  unmodelled: ReqCheck[];
  /** needs an event code (or a delayed trigger) from an earlier event in this province */
  needsChain: boolean;
}

/** Filter keys used by the eligibility panel (besides `story`). */
export const ELIGIBILITY_KEYS = [
  'p_nation', 'p_turn', 'p_order', 'p_prod', 'p_heat', 'p_growth', 'p_luck', 'p_magic', 'p_dom', 'p_terrain',
  'p_season', 'p_month', 'p_fort', 'p_temple', 'p_lab', 'p_capital', 'p_pop', 'p_unrest', 'p_pd', 'p_troops',
  'p_cmd', 'p_cmdorder', 'p_paths', 'p_strict', 'p_nochain',
] as const;

/** [positive name, negative name, positive req key, negative req key] */
export const SCALES: [ScaleAxis, string, string, string][] = [
  ['order', 'Order', 'Turmoil', 'chaos'],
  ['prod', 'Productivity', 'Sloth', 'lazy'],
  ['heat', 'Heat', 'Cold', 'cold'],
  ['growth', 'Growth', 'Death', 'death'],
  ['luck', 'Luck', 'Misfortune', 'unluck'],
  ['magic', 'Magic', 'Drain', 'unmagic'],
];

export const TERRAINS: [TerrainFlag, string][] = [
  ['plains', 'Plains'], ['sea', 'Sea'], ['coast', 'Coast'], ['mountain', 'Mountain'], ['forest', 'Forest'],
  ['farm', 'Farmland'], ['swamp', 'Swamp'], ['waste', 'Waste'], ['cave', 'Cave'], ['freshwater', 'Fresh water'],
  ['deep', 'Deep sea'], ['kelp', 'Kelp'], ['gorge', 'Gorge'], ['drip', 'Drip cave'], ['caveforest', 'Forest cave'],
];

export const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'];
export const MONTHS = SEASONS.flatMap((s) => [`Early ${s.toLowerCase()}`, `Mid ${s.toLowerCase()}`, `Late ${s.toLowerCase()}`]);

/** targorder numbers (Event Modding Manual); 104 is undocumented, probably Withdraw */
export const ORDERS: [number, string][] = [
  [0, 'Defend'], [2, 'Sneak'], [3, 'Patrol'], [4, 'Research'], [6, 'Preach'], [7, 'Site search'], [8, 'Blood hunt'],
  [14, 'Call God'], [17, 'Summon allies'], [18, 'Build lab'], [19, 'Build temple'], [20, 'Build fort'],
  [44, 'Demolish fort'], [45, 'Demolish lab'], [50, 'Enter site'], [52, 'Void summon'],
  [100, 'Investigate'], [101, 'Continue'], [102, 'Accept'], [103, 'Decline'], [104, 'Withdraw (?)'], [105, 'Attack'],
  [106, 'Diplomacy'], [107, 'Subterfuge'], [108, 'Magic'],
];
const ORDER_NAME = new Map(ORDERS);

export const PATH_LETTERS = 'FAWESDNGBH';
const PATH_WORDS = ['Fire', 'Air', 'Water', 'Earth', 'Astral', 'Death', 'Nature', 'Glamour', 'Blood', 'Holy'];
/** targpath path numbers beyond 0..9 */
const PATH_GROUPS: Record<number, [string, string]> = {
  50: ['FAWESDNGB', 'any path'],
  51: ['FAWE', 'an elemental path'],
  52: ['SDNGB', 'a sorcery path'],
  53: ['FAWESDNGB', 'any path'],
};
const PROVINCE_PATH_REQ: Record<string, number> = {
  fire: 0, air: 1, water: 2, earth: 3, astral: 4, death: 5, nature: 6, glamour: 7, blood: 8, holy: 9,
};

// ---------------------------------------------------------------------------------------------------
// state

const int = (v: any): number | undefined => {
  if (v === undefined || v === null || v === '' || v === false) return undefined;
  const n = parseInt(String(v), 10);
  return isNaN(n) ? undefined : n;
};
const bool = (v: any): boolean | undefined => (v === '1' || v === 1 || v === true ? true : v === '0' || v === 0 ? false : undefined);

/** Parses "F2S1H1" into {F: 2, S: 1, H: 1}. */
export function parsePaths(v: string): Partial<Record<string, number>> {
  const out: Partial<Record<string, number>> = {};
  for (const m of String(v).toUpperCase().matchAll(/([FAWESDNGBH])(\d+)/g)) out[m[1]] = parseInt(m[2], 10);
  return out;
}
export const formatPaths = (p: Partial<Record<string, number>>) =>
  PATH_LETTERS.split('').filter((l) => (p[l] ?? 0) > 0).map((l) => l + p[l]).join('');

export const hasProvinceState = (filters: Record<string, any> | undefined) =>
  !!filters && Object.keys(filters).some((k) => k.startsWith('p_') && filters[k] !== '' && filters[k] !== undefined && filters[k] !== null && filters[k] !== false);

const parseCache = new WeakMap<object, ProvinceState | null>();

/** The province described by the `p_*` filter keys (and `story`); null when no `p_` key is set. */
export function parseProvinceState(filters: Record<string, any>, DMI?: any): ProvinceState | null {
  if (!filters || !hasProvinceState(filters)) return null;
  const cached = parseCache.get(filters);
  if (cached !== undefined && (!DMI || cached?.names)) return cached;
  const f = filters;
  const nation = f.p_nation === 'indep' ? 'indep' : int(f.p_nation);
  const storyRaw = String(f.story ?? '');
  const s: ProvinceState = {
    nation,
    turn: int(f.p_turn),
    story: storyRaw === 'off' ? 0 : storyRaw === 'minor' ? 1 : 2,
    scales: {},
    dom: int(f.p_dom),
    season: int(f.p_season),
    month: int(f.p_month),
    fort: bool(f.p_fort),
    temple: bool(f.p_temple),
    lab: bool(f.p_lab),
    capital: bool(f.p_capital),
    pop: int(f.p_pop),
    unrest: int(f.p_unrest),
    pd: int(f.p_pd),
    troops: int(f.p_troops),
    commander: bool(f.p_cmd),
    order: int(f.p_cmdorder),
    strict: !!bool(f.p_strict),
    noChain: !!bool(f.p_nochain),
  };
  for (const [axis] of SCALES) {
    const v = int(f['p_' + axis]);
    if (v !== undefined) s.scales[axis] = Math.max(-3, Math.min(3, v));
  }
  if (f.p_terrain) s.terrain = new Set(String(f.p_terrain).split(',').filter(Boolean) as TerrainFlag[]);
  if (f.p_paths) s.paths = parsePaths(f.p_paths);
  if (s.month !== undefined) s.season = Math.floor(s.month / 3);
  // an order implies a commander (a sneaking one does not count for req_commander)
  if (s.order !== undefined && s.commander === undefined && s.order !== 2) s.commander = true;
  if (DMI) {
    const ml = DMI.modctx?.nationlookup ?? {};
    if (typeof nation === 'number') s.era = int(ml[nation]?.era);
    s.names = {
      nation: (id) => ml[id]?.fullname ?? ml[id]?.name,
      unit: (id) => DMI.modctx?.unitlookup?.[id]?.name,
    };
  }
  parseCache.set(filters, s);
  return s;
}

// ---------------------------------------------------------------------------------------------------
// checks

type Outcome = 'met' | 'failed' | 'unmodelled';
const MAYBE: Outcome = 'unmodelled';
const test = (known: boolean, ok: boolean): Outcome => (!known ? MAYBE : ok ? 'met' : 'failed');

const ONE_OF = new Set(['fornation', 'targorder', 'code', 'season', 'month', 'era', 'godismnr', 'pretismnr']);

function siteName(o: any): string {
  const m = String(o?.description ?? '').match(/\[([^\]]+)\]\s*$/);
  return m ? m[1] : 'the site';
}

function scaleLabel(name: string, other: string, n: number) {
  if (n > 0) return `${name} ≥ ${n}`;
  if (n === 0) return `no ${other}`;
  return `${other} ≤ ${-n} (or any ${name})`;
}

function fuzzy(v: number | undefined, n: number, dir: 'min' | 'max'): Outcome {
  if (v === undefined) return MAYBE;
  const lo = n * 0.75;
  const hi = n * 1.25;
  if (dir === 'min') return v >= hi ? 'met' : v < lo ? 'failed' : MAYBE;
  return v <= lo ? 'met' : v > hi ? 'failed' : MAYBE;
}

const yesNo = (v: number, yes: string, no: string) => (v ? yes : no);

/** Checks one requirement key with all its values. */
function checkReq(key: string, values: string[], o: any, ev: EventInfo, s: ProvinceState): { outcome: Outcome; label: string } {
  const v = values[0];
  const n = parseInt(v, 10);
  const nums = values.map((x) => parseInt(x, 10));
  const nationName = (id: number) => s.names?.nation?.(id) ?? `nation ${id}`;
  const unitName = (id: number) => (isNaN(id) ? String(id) : s.names?.unit?.(id) ?? `unit ${id}`);
  const own = typeof s.nation === 'number' ? s.nation : undefined;
  const ownerKnown = s.nation !== undefined;
  const t = s.terrain;
  const terr = (flag: TerrainFlag, label: string) => {
    const has = !!t && (t.has(flag) || (flag === 'deep' && t.has('gorge')));
    return { outcome: test(!!t, has === !!n), label: n ? `${label} terrain` : `not ${label.toLowerCase()} terrain` };
  };
  const building = (val: boolean | undefined, label: string) => ({ outcome: test(val !== undefined, val === !!n), label: n ? `needs a ${label}` : `no ${label}` });
  const noCmd = s.commander === false;
  const lvl = (p: number) => s.paths?.[PATH_LETTERS[p]] ?? 0;

  // scales
  for (const [axis, pos, neg, negKey] of SCALES) {
    if (key === axis || key === negKey) {
      const sign = key === axis ? 1 : -1;
      const label = key === axis ? scaleLabel(pos, neg, n) : scaleLabel(neg, pos, n);
      const cur = s.scales[axis];
      if (Math.abs(n) > 3) return { outcome: MAYBE, label: `${label} (beyond the normal ±3 range)` };
      return { outcome: test(cur !== undefined, (cur ?? 0) * sign >= n), label };
    }
  }

  switch (key) {
    // --- game / nation ---------------------------------------------------------------------------
    case 'story': {
      const need = Math.max(Math.min(2, n), ev.storyEffective);
      return { outcome: s.story >= need ? 'met' : 'failed', label: need >= 2 ? 'Story events: All' : 'Story events: Minor or All' };
    }
    case 'turn':
      return { outcome: test(s.turn !== undefined, (s.turn ?? 0) >= n), label: `turn ≥ ${n}` };
    case 'maxturn':
      return { outcome: test(s.turn !== undefined, (s.turn ?? 0) <= n), label: `turn ≤ ${n}` };
    case 'pregame':
      return { outcome: test(s.turn !== undefined, false), label: 'only before turn 1' };
    case 'fornation':
      return { outcome: test(ownerKnown, own !== undefined && nums.includes(own)), label: `only for ${nums.map(nationName).join(' / ')}` };
    case 'notfornation':
    case 'notnation':
    case 'notforally':
      return { outcome: test(ownerKnown, own === undefined || !nums.includes(own)), label: `not for ${nums.map(nationName).join(' / ')}` };
    case 'nation':
      return { outcome: own === n ? 'met' : MAYBE, label: `${nationName(n)} in play` };
    case 'nonation':
      return { outcome: own === n ? 'failed' : MAYBE, label: `${nationName(n)} not in play` };
    case 'era':
      return { outcome: test(s.era !== undefined, nums.includes(s.era ?? -1)), label: `${nums.map((e) => ['', 'Early', 'Middle', 'Late'][e] ?? e).join(' / ')} era only` };
    case 'noera':
      return { outcome: test(s.era !== undefined, !nums.includes(s.era ?? -1)), label: `not in ${nums.map((e) => ['', 'Early', 'Middle', 'Late'][e] ?? e).join(' / ')} era` };
    case 'fullowner':
      return {
        outcome: !ownerKnown ? MAYBE : own !== n ? 'failed' : s.dom === undefined ? MAYBE : s.dom > 0 ? 'met' : 'failed',
        label: `${nationName(n)} owns the province (and its dominion)`,
      };
    case 'domowner':
      return {
        outcome: own === n ? test(s.dom !== undefined, (s.dom ?? 0) > 0) : ownerKnown && (s.dom ?? 0) > 0 ? 'failed' : MAYBE,
        label: `${nationName(n)} has dominion here`,
      };
    // --- season ----------------------------------------------------------------------------------
    case 'season':
      return { outcome: test(s.season !== undefined, nums.includes(s.season ?? -1)), label: nums.map((x) => SEASONS[x] ?? x).join(' / ') };
    case 'noseason':
      return { outcome: test(s.season !== undefined, !nums.includes(s.season ?? -1)), label: `not in ${nums.map((x) => SEASONS[x] ?? x).join(' / ')}` };
    case 'month': {
      const label = nums.map((x) => MONTHS[x] ?? `month ${x}`).join(' / ');
      if (s.month !== undefined) return { outcome: nums.includes(s.month) ? 'met' : 'failed', label };
      if (s.season !== undefined) return { outcome: nums.some((x) => Math.floor(x / 3) === s.season) ? MAYBE : 'failed', label };
      return { outcome: MAYBE, label };
    }
    // --- terrain ---------------------------------------------------------------------------------
    case 'land':
      return { outcome: test(!!t, !t?.has('sea') === !!n), label: n ? 'land province' : 'sea province' };
    case 'coast': return terr('coast', 'Coastal');
    case 'mountain': return terr('mountain', 'Mountain');
    case 'forest': return terr('forest', 'Forest');
    case 'farm': return terr('farm', 'Farmland');
    case 'swamp': return terr('swamp', 'Swamp');
    case 'waste': return terr('waste', 'Waste');
    case 'cave': return terr('cave', 'Cave');
    case 'freshwater': return terr('freshwater', 'Fresh water');
    case 'deep': return terr('deep', 'Deep sea');
    case 'kelp': return terr('kelp', 'Kelp');
    case 'gorge': return terr('gorge', 'Gorge');
    case 'drip': return terr('drip', 'Drip cave');
    case 'caveforest': return terr('caveforest', 'Forest cave');
    // --- buildings -------------------------------------------------------------------------------
    case 'fort': return building(s.fort, 'fort');
    case 'temple': return building(s.temple, 'temple');
    case 'lab': return building(s.lab, 'lab');
    case 'capital':
      return { outcome: test(s.capital !== undefined, s.capital === !!n), label: n ? 'capital province' : 'not a capital' };
    case 'owncapital':
      return { outcome: n ? (s.capital === false ? 'failed' : s.capital ? 'met' : MAYBE) : s.capital === false ? 'met' : MAYBE, label: n ? "owner's own capital" : "not the owner's capital" };
    case 'nearbycapital':
      return { outcome: s.capital ? (n ? 'met' : 'failed') : MAYBE, label: n ? 'at or next to a capital' : 'not at or next to a capital' };
    // --- dominion --------------------------------------------------------------------------------
    case 'mydominion':
      if (n <= 1) return { outcome: test(s.dom !== undefined, ((s.dom ?? 0) > 0) === !!n), label: n ? "owner's dominion" : "no owner's dominion" };
      return { outcome: test(s.dom !== undefined, (s.dom ?? 0) >= n), label: `owner's dominion ≥ ${n} (assumed candles)` };
    case 'dominion':
      return { outcome: n <= 0 ? 'met' : test(s.dom !== undefined, (s.dom ?? 0) >= n), label: `owner's dominion ≥ ${n}` };
    case 'maxdominion':
      return { outcome: test(s.dom !== undefined, (s.dom ?? 0) <= n), label: n >= 0 ? `dominion ≤ ${n}` : `enemy dominion ≥ ${-n}` };
    // --- population ------------------------------------------------------------------------------
    case 'minpop':
      return { outcome: test(s.pop !== undefined, (s.pop ?? 0) >= n * 10), label: `population ≥ ${n * 10}` };
    case 'maxpop':
      return { outcome: test(s.pop !== undefined, (s.pop ?? 0) <= n * 10), label: `population ≤ ${n * 10}` };
    case 'minunrest':
      return { outcome: fuzzy(s.unrest, n, 'min'), label: `unrest ≥ ${n} (±25%)` };
    case 'maxunrest':
      return { outcome: fuzzy(s.unrest, n, 'max'), label: `unrest ≤ ${n} (±25%)` };
    case 'mindef':
      return { outcome: fuzzy(s.pd, n, 'min'), label: `province defence ≥ ${n} (±25%)` };
    case 'maxdef':
      return { outcome: fuzzy(s.pd, n, 'max'), label: `province defence ≤ ${n} (±25%)` };
    case 'mintroops':
      return { outcome: test(s.troops !== undefined, (s.troops ?? 0) >= n), label: `≥ ${n} troops present` };
    case 'maxtroops':
      return { outcome: test(s.troops !== undefined, (s.troops ?? 0) <= n), label: `≤ ${n} troops present` };
    // --- commander -------------------------------------------------------------------------------
    case 'commander':
      if (n > 1) return { outcome: noCmd ? 'failed' : MAYBE, label: `a ${unitName(n)} commander present` };
      return { outcome: test(s.commander !== undefined, s.commander === !!n), label: n ? 'a (non-sneaking) commander present' : 'no commander present' };
    case 'targorder': {
      const label = `needs a ${nums.map((x) => ORDER_NAME.get(x) ?? `order ${x}`).join(' / ')} order`;
      if (noCmd) return { outcome: 'failed', label };
      return { outcome: test(s.order !== undefined, nums.includes(s.order ?? -1)), label };
    }
    case 'targnoorder':
      return { outcome: test(s.order !== undefined, !nums.includes(s.order ?? -1)), label: `commander not on ${ORDER_NAME.get(n) ?? n}` };
    case 'researcher':
      return { outcome: noCmd ? 'failed' : s.order === 4 ? 'met' : MAYBE, label: 'a researcher present' };
    case 'humanoidres':
      return { outcome: noCmd ? 'failed' : MAYBE, label: 'a humanoid researcher present' };
    case 'preach':
      return {
        outcome: noCmd ? 'failed' : s.order === undefined ? MAYBE : s.order === 6 ? 'met' : 'failed',
        label: `a priest preaching (${n}% per priest level)`,
      };
    case 'targforeignok':
      return { outcome: 'met', label: 'target may be foreign' };
  }

  // commander paths
  const tp = key.match(/^targ(no)?path([1-4])$/);
  if (tp) {
    const k = parseInt(tp[2], 10);
    const group = PATH_GROUPS[n];
    const pathLabel = n >= 0 && n <= 9 ? PATH_WORDS[n] : group?.[1];
    if (!pathLabel || (key === 'targpath4' && n === 0))
      return { outcome: noCmd && !tp[1] ? 'failed' : MAYBE, label: `${key} ${v} (meaning unclear)` };
    const letters = group ? group[0].split('') : [PATH_LETTERS[n]];
    const best = Math.max(...letters.map((l) => s.paths?.[l] ?? 0));
    if (tp[1]) return { outcome: test(!!s.paths, best < k), label: `commander below ${pathLabel} ${k}` };
    return { outcome: noCmd ? 'failed' : test(!!s.paths, best >= k), label: `commander with ${pathLabel} ${k}+` };
  }
  const pp = key.match(/^(no)?path(fire|air|water|earth|astral|death|nature|glamour|blood|holy|all)$/);
  if (pp) {
    const word = pp[2] === 'all' ? 'any path' : pp[2] === 'holy' ? 'Priest' : PATH_WORDS[PROVINCE_PATH_REQ[pp[2]]];
    const best = pp[2] === 'all' ? Math.max(0, ...PATH_LETTERS.split('').map((l) => s.paths?.[l] ?? 0)) : lvl(PROVINCE_PATH_REQ[pp[2]]);
    const known = !!s.paths || noCmd;
    if (pp[1]) return { outcome: test(known, best < n), label: `no ${word} ${n}+ mage here` };
    return { outcome: test(known, best >= n), label: `a ${word} ${n}+ mage here` };
  }
  if (key.startsWith('targ')) return { outcome: noCmd ? 'failed' : MAYBE, label: `target commander: ${key.slice(4)} ${v}` };

  // --- not modelled --------------------------------------------------------------------------------
  const site = siteName(o);
  const unmod: Record<string, string> = {
    code: '', // handled by caller
    notcode: `province event code is not ${v}`,
    anycode: `event code ${values.join(' / ')} somewhere in the world`,
    notanycode: `event code ${v} nowhere in the world`,
    nearbycode: `neighbour has event code ${v}`,
    nearowncode: `this or an own neighbour has event code ${v}`,
    foundsite: yesNo(n, `${site} here and found`, `${site} not found here`),
    hiddensite: yesNo(n, `${site} here, still hidden`, `${site} not hidden here`),
    site: yesNo(n, `${site} here`, `no ${site} here`),
    nearbysite: yesNo(n, `${site} here or adjacent`, `no ${site} nearby`),
    claimedthrone: `${site} claimed`,
    unclaimedthrone: `${site} unclaimed`,
    unclaimedthronesite: 'an unclaimed throne here',
    freesites: `≥ ${n} free site slot${n === 1 ? '' : 's'}`,
    nositenbr: `no site #${v} here`,
    monster: `${unitName(n)} present`,
    '2monsters': `2+ ${unitName(n)} present`,
    '5monsters': `5+ ${unitName(n)} present`,
    monsterbs: `${unitName(n)} present`,
    nomonster: `no ${unitName(n)} present`,
    mnr: `${unitName(n)} exists in the world`,
    mnrbs: `${unitName(n)} exists in the world`,
    nomnr: `no ${unitName(n)} in the world`,
    deadmnr: `${unitName(n)} has ever existed`,
    godismnr: `pretender is a ${values.map((x) => unitName(parseInt(x, 10))).join(' / ')}`,
    poptype: `population type ${values.join(' / ')}`,
    notpoptype: `population type not ${v}`,
    gem: `a ${['Fire', 'Air', 'Water', 'Earth', 'Astral', 'Death', 'Nature', 'Glamour', 'Blood slave'][n] ?? v} gem in the treasury`,
    ench: `global enchantment ${v} active`,
    noench: `global enchantment ${v} not active`,
    enchtarget: `global enchantment ${v} cast from here`,
    enchdom: `enchantment ${v} in its owner's dominion`,
    minglobals: `≥ ${v} global enchantments`,
    siege: n ? 'under siege' : 'not under siege (?)',
    void: 'only on the void plane',
    nativesoil: "owner's native soil",
    ai: n ? 'AI players only' : 'human players only',
    cataclysmturn: `cataclysm turn ${v} (?)`,
    playerturn: `player turn ${v} (?)`,
    unique: `max ${v} per game`,
  };
  return { outcome: MAYBE, label: unmod[key] || `${key} ${values.join(', ')}` };
}

/** Requirements that only change the odds or permit things, not checks. */
const NOT_CHECKS = new Set(['rare', 'turnrare', 'permonth', 'domchance', 'indepok', 'voidok', 'pop0ok', 'targforeignok']);
/** Requirements assumed met (limits that almost always hold for a fresh province). */
const ASSUMED = new Set(['unique']);

/** Checks an event against a province state. */
export function checkEvent(o: any, s: ProvinceState): CheckResult {
  const ev: EventInfo | undefined = o?.ev;
  const res: CheckResult = { verdict: 'eligible', met: [], failed: [], unmodelled: [], needsChain: false };
  if (!ev) return { ...res, verdict: 'unknown' };
  const push = (outcome: Outcome, key: string, values: string[], label: string) =>
    (outcome === 'met' ? res.met : outcome === 'failed' ? res.failed : res.unmodelled).push({ key, value: values.join(','), label });

  // implicit rules
  if (s.nation === 'indep') push(ev.reqs.indepok?.[0] === '1' ? 'met' : 'failed', 'indepok', ev.reqs.indepok ?? ['0'], ev.reqs.indepok?.[0] === '1' ? 'can hit independents' : 'never hits independents');
  if (s.pop !== undefined && s.pop < 50 && !ev.reqs.pop0ok) push('failed', 'pop0ok', ['0'], 'population ≥ 50 (no pop0ok)');
  if (ev.storyEffective > 0 && !ev.reqs.story) {
    const ok = s.story >= ev.storyEffective;
    push(ok ? 'met' : 'failed', 'story', [String(ev.storyEffective)], ev.storyEffective >= 2 ? 'Story events: All (storyline)' : 'Story events: Minor or All (storyline)');
  }
  const delayedFrom = ev.prev.filter((p) => p.via === 'delay' || p.via === 'delayskip');
  if (delayedFrom.length) {
    res.needsChain = true;
    push(MAYBE, 'delay', delayedFrom.map((p) => String(p.id)), `fires as a delayed follow-up of #${delayedFrom.map((p) => p.id).join(' / #')}`);
  }

  for (const [key, all] of Object.entries(ev.reqs)) {
    const values = [...new Set(all)];
    if (NOT_CHECKS.has(key)) continue;
    if (key === 'code') {
      const codes = values.map((x) => parseInt(x, 10));
      if (codes.includes(0)) push('met', key, values, 'no storyline running here (assumed)');
      else {
        res.needsChain = true;
        push(MAYBE, key, values, `storyline already running here (event code ${values.join(' / ')})`);
      }
      continue;
    }
    if (ASSUMED.has(key)) {
      push('met', key, values, `max ${values[0]} per game (assumed not used up)`);
      continue;
    }
    const groups = ONE_OF.has(key) || key.startsWith('not') || key === 'noseason' || key === 'noera' ? [values] : values.map((x) => [x]);
    for (const g of groups) {
      const { outcome, label } = checkReq(key, g, o, ev, s);
      push(outcome, key, g, label);
    }
  }
  res.verdict = res.failed.length ? 'blocked' : res.unmodelled.length || res.needsChain ? 'unknown' : 'eligible';
  return res;
}

/** Table filter: true when no province is described or the event is not blocked there. */
export function eligibilityFilter(o: any, filters: Record<string, any>, DMI?: any): boolean {
  const s = parseProvinceState(filters, DMI);
  if (!s) return true;
  const r = checkEvent(o, s);
  if (r.verdict === 'blocked') return false;
  if (s.noChain && r.needsChain) return false;
  if (s.strict && r.verdict !== 'eligible') return false;
  return true;
}

// ---------------------------------------------------------------------------------------------------
// odds

export interface EventOdds {
  /** ≈ percent per month for "always" events once all requirements hold; undefined for random events */
  pct?: number;
  /** percent chance once the event is picked (req_rare and similar), when known */
  ifPicked?: number;
  /** short display text, always marked ≈ */
  text: string;
  /** explanation of the components */
  parts: string[];
  confidence: 'medium' | 'low';
}

/**
 * Rough odds. Documented components only: rarity class (Event Modding Manual), `req_rare` / `req_turnrare`
 * / `req_preach` / `req_domchance` percentages, and the game settings from the Modding Manual
 * (#eventisrare 15, #turmoilevents 2, #luckevents 5, #misfortune 15). The base random event frequency
 * is not documented, so random (good/bad) events get no per-month number.
 */
export function eventOdds(o: any, s?: ProvinceState | null): EventOdds {
  const ev: EventInfo | undefined = o?.ev;
  const parts: string[] = [];
  if (!ev) return { text: '≈ ?', parts, confidence: 'low' };
  const r = ev.reqs;
  let p = 100;
  let pKnown = true;
  if (r.rare) {
    p = ev.chance ?? parseInt(r.rare[0], 10);
    parts.push(`req_rare: ${p}% when rolled`);
  }
  if (r.turnrare) {
    const base = parseInt(r.turnrare[0], 10);
    if (s?.turn !== undefined) {
      const tp = Math.max(0, Math.min(100, base + s.turn));
      p = (p * tp) / 100;
      parts.push(`req_turnrare ${base}: ${base} + turn ${s.turn} = ${tp}%`);
    } else {
      pKnown = false;
      parts.push(`req_turnrare ${base}: (${base} + turn)%`);
    }
  }
  if (r.preach) {
    const per = parseInt(r.preach[0], 10);
    const h = s?.paths?.H;
    if (h) {
      const pp = Math.min(100, per * h);
      p = (p * pp) / 100;
      parts.push(`req_preach: ${per}% × priest level ${h} = ${pp}%`);
    } else {
      pKnown = false;
      parts.push(`req_preach: ${per}% per priest level`);
    }
  }
  if (r.domchance) {
    const per = parseInt(r.domchance[0], 10);
    const d = s?.dom !== undefined ? Math.abs(s.dom) : undefined;
    if (d !== undefined) {
      const dp = Math.min(100, per * d);
      p = (p * dp) / 100;
      parts.push(`req_domchance: ${per}% × dominion ${d} = ${dp}%`);
    } else {
      pKnown = false;
      parts.push(`req_domchance: ${per}% per candle`);
    }
  }
  const round = (x: number) => (x >= 10 ? Math.round(x) : Math.round(x * 10) / 10);
  const rarity = parseInt(o.rarity, 10);
  const pctText = pKnown ? `${round(p)}%` : '?%';

  if (rarity === 0 || rarity === 5) {
    parts.unshift(
      rarity === 0
        ? 'Always event: checked every month in every province; at most one rarity-0 event per province per month'
        : 'Always (unlimited) event: checked every month, any number per province',
    );
    if ((ev.reqs.code ?? []).some((c) => c !== '0')) parts.push('only while its storyline is running here');
    return { pct: pKnown ? round(p) : undefined, ifPicked: pKnown ? round(p) : undefined, text: `≈ ${pctText}/month`, parts, confidence: 'medium' };
  }
  if (rarity >= 10) {
    const desc: Record<number, string> = {
      10: 'Always global event: planned 7 months ahead',
      11: 'Common global event: planned 7 months ahead when a global event is rolled',
      12: 'Uncommon global event: planned 7 months ahead when a global event is rolled',
      13: 'Immediate global event (not planned ahead)',
      14: 'Special global event (undocumented class)',
      15: 'Seasonal global event (undocumented class)',
    };
    parts.unshift(desc[rarity] ?? `Global event (rarity ${rarity})`);
    if (rarity === 10 || rarity === 13) return { pct: pKnown ? round(p) : undefined, ifPicked: pKnown ? round(p) : undefined, text: `≈ ${pctText}/month`, parts, confidence: 'low' };
    return { ifPicked: pKnown ? round(p) : undefined, text: `≈ ${pctText} if picked`, parts, confidence: 'low' };
  }
  // random good / bad events
  const good = rarity < 0;
  const common = Math.abs(rarity) === 1;
  parts.unshift(
    `${common ? 'Common' : 'Uncommon'} ${good ? 'good' : 'bad'} random event: needs the province to roll a random event (base rate undocumented)`,
    `then ${common ? '≈85% common' : '≈15% uncommon'} class (#eventisrare 15), then one eligible event of that class is picked`,
  );
  const luck = s?.scales.luck;
  const order = s?.scales.order;
  if (order !== undefined && order < 0) parts.push(`Turmoil ${-order}: more random events (#turmoilevents 2 per step)`);
  if (order !== undefined && order > 0) parts.push(`Order ${order}: fewer random events (#turmoilevents 2 per step)`);
  if (luck !== undefined && luck !== 0) {
    const favoured = (luck > 0) === good;
    parts.push(
      `${luck > 0 ? 'Luck' : 'Misfortune'} ${Math.abs(luck)}: ${good ? 'good' : 'bad'} events ${favoured ? 'favoured' : 'disfavoured'} (#misfortune 15 per step), frequency also shifts (#luckevents 5 per step)`,
    );
  }
  if (!good) parts.push('units with #nobadevents in the province can negate bad events');
  return { ifPicked: pKnown ? round(p) : undefined, text: `${common ? 'common' : 'uncommon'} ${good ? 'good' : 'bad'} · ≈ ${pctText} if picked`, parts, confidence: 'low' };
}

// ---------------------------------------------------------------------------------------------------
// summaries for the card / a table column

export interface EligibilitySummary {
  tone: 'good' | 'bad' | 'unknown';
  text: string;
  title: string;
}

export function eligibilitySummary(r: CheckResult): EligibilitySummary {
  const lines = [
    ...r.failed.map((c) => '✗ ' + c.label),
    ...r.met.map((c) => '✓ ' + c.label),
    ...r.unmodelled.map((c) => '? ' + c.label),
  ];
  const title = lines.join('\n');
  if (r.verdict === 'blocked') return { tone: 'bad', text: `blocked · ${r.failed[0].label}${r.failed.length > 1 ? ` +${r.failed.length - 1}` : ''}`, title };
  if (r.verdict === 'eligible') return { tone: 'good', text: 'eligible', title };
  const bits = [r.needsChain ? 'needs storyline' : '', r.unmodelled.length - (r.needsChain ? 1 : 0) > 0 ? `${r.unmodelled.length - (r.needsChain ? 1 : 0)} unmodelled` : ''].filter(Boolean);
  return { tone: 'unknown', text: `possible · ${bits.join(' · ')}`, title };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** One-line badge HTML for the event card, or '' when no province is described. */
export function eligibilityBadgeHtml(o: any, filters: Record<string, any>, DMI?: any): string {
  const s = parseProvinceState(filters, DMI);
  if (!s || !o?.ev) return '';
  const sum = eligibilitySummary(checkEvent(o, s));
  return `<span class="elig-badge elig-${sum.tone}" title="${esc(sum.title)}">${esc(sum.text)}</span>`;
}

/** A requirement checklist + odds block (HTML) for the event card, or '' when no province is described. */
export function eligibilityDetailsHtml(o: any, filters: Record<string, any>, DMI?: any): string {
  const s = parseProvinceState(filters, DMI);
  if (!s || !o?.ev) return '';
  const r = checkEvent(o, s);
  const odds = eventOdds(o, s);
  const li = (cls: string, mark: string, c: ReqCheck) => `<li class="elig-${cls}"><span class="elig-mark">${mark}</span>${esc(c.label)}</li>`;
  return (
    `<div class="elig-details"><div class="elig-head">In this province: ${eligibilityBadgeHtml(o, filters, DMI)}` +
    `<span class="elig-odds" title="${esc(odds.parts.join('\n'))}">${esc(odds.text)}</span></div><ul>` +
    r.failed.map((c) => li('bad', '✗', c)).join('') +
    r.met.map((c) => li('good', '✓', c)).join('') +
    r.unmodelled.map((c) => li('unknown', '?', c)).join('') +
    '</ul></div>'
  );
}
