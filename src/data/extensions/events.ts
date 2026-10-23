// New in this app: an event model for the Events page.
// - events.csv writes commands the dumper had no name for as raw little-endian opcodes ("9600" = 0x96).
//   They were identified from the command table in Dominions6.exe; requirement and effect opcodes are
//   separate namespaces. Legacy MEvent keeps them as `req_9600` / `A300` (and the golden suite expects
//   that), so the names are applied here and in the event card only.
// - Event chains: events set a province "code" and follow-ups require it. Chains are grouped into
//   storylines. A few negative codes are shared by dozens of events as world-state markers (demon cult,
//   War in Hell, …); they would glue unrelated storylines into one blob, so they become "world flags".
// - Story level: `req_story 1` needs Minor or All story events, `2`+ needs All (exe check, not the
//   manual's yes/no). Placing the book flag (`flagland 1`) also needs Minor. Follow-ups inherit the
//   level of everything that can lead to them.

export type Confidence = 'high' | 'medium' | 'low';

/** Requirement opcode token -> command name without `req_`. */
export const EVENT_REQ_OPS: Record<string, [string, Confidence]> = {
  '9600': ['rare', 'high'],
  '4700': ['indepok', 'high'],
  E500: ['targaff', 'high'],
  '1200': ['nation', 'high'],
  '9C00': ['voidok', 'high'],
  '6500': ['month', 'high'],
  '8100': ['maxturn', 'high'],
  E300: ['targhumanoid', 'high'],
  E400: ['targmale', 'high'],
  EB00: ['targdemon', 'high'],
  E000: ['targpath3', 'high'],
  '7F00': ['ench', 'high'],
  '5F00': ['enchtarget', 'high'],
  E800: ['targmanygems', 'high'],
  '0601': ['targseductions', 'high'],
  '6100': ['mnr', 'high'],
  '6200': ['2monsters', 'high'],
  '8000': ['noench', 'high'],
  '7700': ['godismnr', 'high'],
  '5C00': ['notcode', 'high'],
  '6800': ['notanycode', 'high'],
  '9900': ['turnrare', 'high'],
  EF00: ['targimmobile', 'high'],
  EA00: ['targundead', 'high'],
  F600: ['targmaxmorale', 'high'],
  E900: ['targsight', 'high'],
  '4B00': ['nopathwater', 'high'],
  '3F00': ['unclaimedthrone', 'high'],
  '5200': ['nopathholy', 'high'],
  '5A00': ['enchdom', 'high'],
  '6600': ['5monsters', 'high'],
  '6900': ['deadmnr', 'high'],
  BB00: ['monsterbs', 'high'],
  BA00: ['mnrbs', 'high'],
  B000: ['minglobals', 'high'],
  AD00: ['caveforest', 'high'],
  AF00: ['drip', 'high'],
  '6300': ['cataclysmturn', 'medium'],
  '6000': ['unclaimedthronesite', 'medium'],
  '9D00': ['void', 'medium'],
  E700: ['targsneaking', 'medium'],
  F400: ['targfreeitemslot', 'medium'],
  '7600': ['playerturn', 'low'],
};

/** Effect opcode token -> command name. */
export const EVENT_EFF_OPS: Record<string, [string, Confidence]> = {
  A300: ['4d6units', 'high'],
  '6B00': ['flagland', 'high'],
  AB00: ['12d6units', 'high'],
  '9C00': ['1d3units', 'high'],
  A600: ['7d6units', 'high'],
  '9B00': ['1unit', 'high'],
  '4200': ['hiddensite', 'high'],
  '8A00': ['extramsg', 'high'],
  '6E00': ['delay', 'high'],
  '6F00': ['delay25', 'high'],
  '7000': ['delay50', 'high'],
  A100: ['2d6units', 'high'],
  A700: ['8d6units', 'high'],
  A400: ['5d6units', 'high'],
  A900: ['10d6units', 'high'],
  '9E00': ['3d3units', 'high'],
  '9F00': ['4d3units', 'high'],
  C300: ['addgeo', 'high'],
  '7900': ['removesite', 'high'],
  '5E00': ['code2', 'high'],
  D100: ['addseductions', 'high'],
  '8200': ['poison', 'high'],
  '0600': ['assfollower1d3', 'high'],
  '0400': ['assfollower2', 'high'],
  e3: ['assfollower1', 'high'],
  '7500': ['gainmark', 'high'],
  '8100': ['claimthrone', 'high'],
  '0700': ['killpop', 'high'],
  '2A00': ['gold', 'high'],
  CA00: ['maybeaddsite', 'high'],
  D700: ['maybehiddensite', 'high'],
  '8300': ['xp', 'high'],
  '8000': ['cleartarg', 'high'],
  '7300': ['purgecalendar', 'high'],
  '7400': ['purgedelayed', 'high'],
  '7700': ['tempunits', 'high'],
  '8400': ['kill2d6mon', 'high'],
  '8500': ['arena', 'high'],
  '8600': ['arena2', 'high'],
  '8700': ['resolvearena1', 'high'],
  '8800': ['resolvearena2', 'high'],
  '8900': ['delayskip', 'high'],
  '8D00': ['codedelay', 'high'],
  '8F00': ['resetcodedelay', 'high'],
  '9000': ['resetcodedelay2', 'high'],
  '9300': ['setpoptype', 'high'],
  D500: ['dispglobals', 'high'],
  '2700': ['assassinationbattle', 'medium'],
  B300: ['20d6units', 'medium'],
  '3100': ['gemloss1d6', 'medium'],
  '1400': ['allvis', 'medium'],
  C200: ['sinkprovince', 'medium'],
  '9100': ['worldstorm', 'medium'],
  '8C00': ['eventnation', 'low'],
};

/** Fields legacy MEvent puts on an event that are not commands. */
const NON_COMMAND_KEYS = new Set([
  'id', 'name', 'rarity', 'description', 'requirements', 'effects', 'end', 'modded', 'searchable',
  'renderOverlay', 'matchProperty', 'linkedReqCodes', 'linkedCodes', 'linkedResetCodes', 'eff_id',
]);

export type EventKind = 'good' | 'bad' | 'always' | 'global';
export type StorylineRole = 'standalone' | 'start' | 'middle' | 'end';

export interface EventLink {
  id: number;
  /** How `id` leads here / follows: shared code, neighbour code, delayed follow-up, or world flag. */
  via: 'code' | 'nearbycode' | 'nearowncode' | 'delay' | 'delayskip' | 'anycode';
  code?: number;
  /** delay turns for `delay` links */
  turns?: number;
}

export interface WorldFlagUse {
  code: number;
  use: 'sets' | 'needs' | 'needsnot' | 'clears';
}

export interface EventInfo {
  /** Readable title from the description (the CSV name is cut at 30 characters). */
  title: string;
  kind: EventKind;
  rarityLabel: string;
  /** `req_rare`: percent chance when rolled. */
  chance?: number;
  /** Own story requirement: 0 none, 1 Minor or All, 2 All only. */
  story: 0 | 1 | 2;
  /** Story level after inheriting from everything that can lead here. */
  storyEffective: 0 | 1 | 2;
  unique?: number;
  minTurn?: number;
  maxTurn?: number;
  /** `req_fornation` nation ids. */
  forNations: number[];
  /** Requirements by command name without `req_` (opcodes named), values as strings. */
  reqs: Record<string, string[]>;
  /** Effects by command name (opcodes named). */
  effs: Record<string, string[]>;
  prev: EventLink[];
  next: EventLink[];
  worldFlags: WorldFlagUse[];
  storyline?: number;
  role: StorylineRole;
  triggers: TriggerCategory[];
  rewards: RewardCategory[];
}

export interface Storyline {
  id: number;
  name: string;
  /** event ids, ascending */
  events: number[];
  starts: number[];
}

export type TriggerCategory =
  | 'order' | 'path' | 'site' | 'unit' | 'scale' | 'dominion' | 'enchantment' | 'building' | 'terrain'
  | 'season' | 'nation' | 'worldflag' | 'population' | 'turn';
export type RewardCategory =
  | 'units' | 'commander' | 'item' | 'gems' | 'gold' | 'site' | 'scale' | 'dominion' | 'boost' | 'harm'
  | 'world' | 'storyflag';

export const TRIGGER_LABELS: Record<TriggerCategory, string> = {
  order: 'Commander order', path: 'Mage path', site: 'Magic site', unit: 'Unit present', scale: 'Scales',
  dominion: 'Dominion', enchantment: 'Global enchantment', building: 'Fort / temple / lab',
  terrain: 'Terrain', season: 'Season', nation: 'Nation', worldflag: 'World flag', population: 'Population / unrest',
  turn: 'Turn',
};
export const REWARD_LABELS: Record<RewardCategory, string> = {
  units: 'Units', commander: 'Commander', item: 'Magic item', gems: 'Gems', gold: 'Gold', site: 'Magic site',
  scale: 'Scale change', dominion: 'Dominion', boost: 'Research / path boost', harm: 'Harmful',
  world: 'World-wide', storyflag: 'Story flag (book icon)',
};

const TRIGGER_KEYS: [TriggerCategory, RegExp][] = [
  ['order', /^targorder$/],
  ['path', /^(targpath\d|path\w+|nopath\w+|targmanygems)$/],
  ['site', /^(site|foundsite|hiddensite|nearbysite|claimedthrone|unclaimedthrone|unclaimedthronesite|nositenbr|freesites)$/],
  ['unit', /^(monster|2monsters|5monsters|monsterbs|mnr|mnrbs|deadmnr|godismnr|commander|nomonster|nomnr|targ\w+|humanoidres|researcher|preach)$/],
  ['scale', /^(luck|unluck|order|chaos|magic|unmagic|growth|death|heat|cold|prod|lazy)$/],
  ['dominion', /^(dominion|maxdominion|mydominion|domowner)$/],
  ['enchantment', /^(ench|noench|enchtarget|enchdom|minglobals)$/],
  ['building', /^(temple|lab|fort|capital|owncapital)$/],
  ['terrain', /^(land|coast|mountain|forest|farm|swamp|waste|cave|caveforest|freshwater|drip|void|voidok)$/],
  ['season', /^(season|noseason|month)$/],
  ['nation', /^(fornation|notfornation|nation|notnation|nonation)$/],
  ['population', /^(minpop|maxpop|poptype|minunrest|maxunrest|mintroops|maxtroops|mindef|maxdef|gem)$/],
  ['turn', /^(turn|maxturn|playerturn|cataclysmturn)$/],
];
const REWARD_KEYS: [RewardCategory, RegExp][] = [
  ['units', /^(\d+d\d+units|1unit|tempunits)$/],
  ['commander', /^(\d?com|stealthcom)$/],
  ['item', /^(magicitem|addequip)$/],
  ['gems', /^(\d+d\d+vis|allvis)$/],
  ['gold', /^(gold|landgold|taxboost|landprod)$/],
  ['site', /^(newsite|addsite|revealsite|hiddensite|maybeaddsite|maybehiddensite)$/],
  ['scale', /^(incscale\d?|decscale\d?)$/],
  ['dominion', /^(incdom|newdom)$/],
  ['boost', /^(\w+boost|xp|lab|temple|fort|incpop|researchaff)$/],
  ['harm', /^(kill\w*|unrest|disease|curse|gemloss\w*|assassin|banished|emigration|revolt|poison|gainaff|defence|sinkprovince)$/],
  ['world', /^world\w+$/],
  ['storyflag', /^flagland$/],
];

const RARITY: Record<string, [EventKind, string]> = {
  '0': ['always', 'always'],
  '5': ['always', 'always (unlimited)'],
  '1': ['bad', 'common bad'],
  '2': ['bad', 'uncommon bad'],
  '-1': ['good', 'common good'],
  '-2': ['good', 'uncommon good'],
  '10': ['global', 'always global'],
  '11': ['global', 'common global'],
  '12': ['global', 'uncommon global'],
  '13': ['global', 'immediate global'],
  '14': ['global', 'special global'],
  '15': ['global', 'seasonal global'],
};

/** Negative codes shared by this many setters or requirers are world flags, not storyline links. */
const HUB_SETTERS = 10;
const HUB_REQUIRERS = 20;

const vals = (v: any): string[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v.map(String) : [String(v)]);
const num = (v: string[] | undefined) => (v && v.length ? parseInt(v[0], 10) : undefined);

/** Requirement and effect commands of an event, with opcode tokens replaced by their names. */
export function eventCommands(o: any): { reqs: Record<string, string[]>; effs: Record<string, string[]> } {
  const reqs: Record<string, string[]> = {};
  const effs: Record<string, string[]> = {};
  const add = (m: Record<string, string[]>, k: string, v: any) => (m[k] ??= []).push(...vals(v));
  for (const key of Object.keys(o)) {
    if (NON_COMMAND_KEYS.has(key) || typeof o[key] === 'function') continue;
    if (key.startsWith('req_')) {
      const raw = key.slice(4);
      add(reqs, EVENT_REQ_OPS[raw]?.[0] ?? raw, o[key]);
    } else {
      add(effs, EVENT_EFF_OPS[key]?.[0] ?? key, o[key]);
    }
  }
  if (o.eff_id !== undefined) add(effs, 'id', o.eff_id);
  return { reqs, effs };
}

const GOD_WORDS: Record<string, string> = {
  godname: 'the God', fullgodname: 'the God', godname2: 'the other God', godname2b: 'the other God',
  disname: 'the God', goddisname: 'the God', godtit2: 'the other God', landname: 'the province',
  natname: 'the nation', profname: 'the prophet', profname2: 'the other prophet', targname: 'the commander',
  fulltargname: 'the commander', targhis: 'their',
};

/** A short readable title from an event description. */
export function eventTitle(description: string, max = 90): string {
  let s = String(description ?? '')
    .replace(/##(\w+)##/g, (_, w) => GOD_WORDS[w.toLowerCase()] ?? w)
    .replace(/\s*\[[^\]]*\]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  const sentence = s.match(/^.+?[.!?](?=\s|$)/);
  if (sentence) s = sentence[0];
  if (s.length > max) s = s.slice(0, s.lastIndexOf(' ', max - 1) > 40 ? s.lastIndexOf(' ', max - 1) : max - 1) + '…';
  s = s.replace(/\.$/, '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function categories<T extends string>(m: Record<string, string[]>, table: [T, RegExp][]): T[] {
  const out = new Set<T>();
  for (const k of Object.keys(m)) for (const [cat, re] of table) if (re.test(k)) out.add(cat);
  return [...out];
}

const nonZero = (xs: string[] | undefined) => (xs ?? []).map((x) => parseInt(x, 10)).filter((n) => n && !isNaN(n));

/** Builds `o.ev` (non-enumerable) on every event and `DMI.eventStorylines`. */
export function installEvents(DMI: any) {
  const events: any[] = DMI.modctx.eventdata;
  const byId = new Map<number, any>();
  const info = new Map<number, EventInfo>();

  for (const o of events) {
    const id = Number(o.id);
    byId.set(id, o);
    const { reqs, effs } = eventCommands(o);
    const [kind, rarityLabel] = RARITY[String(o.rarity)] ?? ['always', 'rarity ' + o.rarity];
    const ownStory = Math.min(2, Math.max(num(reqs.story) ?? 0, nonZero(effs.flagland).some((v) => v > 0) ? 1 : 0)) as 0 | 1 | 2;
    const ev: EventInfo = {
      title: eventTitle(o.description || o.name),
      kind,
      rarityLabel,
      chance: num(reqs.rare),
      story: ownStory,
      storyEffective: ownStory,
      unique: num(reqs.unique),
      minTurn: num(reqs.turn),
      maxTurn: num(reqs.maxturn),
      forNations: nonZero(reqs.fornation),
      reqs,
      effs,
      prev: [],
      next: [],
      worldFlags: [],
      role: 'standalone',
      triggers: categories(reqs, TRIGGER_KEYS),
      rewards: categories(effs, REWARD_KEYS),
    };
    if (ev.forNations.length && !ev.triggers.includes('nation')) ev.triggers.push('nation');
    info.set(id, ev);
  }

  // --- codes ---------------------------------------------------------------------------------
  const setters = new Map<number, Set<number>>();
  const requirers = new Map<number, Set<number>>();
  const bump = (m: Map<number, Set<number>>, c: number, id: number) => (m.get(c) ?? m.set(c, new Set()).get(c)!).add(id);
  const setCodes = (ev: EventInfo) => [...nonZero(ev.effs.code), ...nonZero(ev.effs.code2), ...nonZero(ev.effs.codedelay), ...nonZero(ev.effs.codedelay2)];
  const localReqs = (ev: EventInfo): [number, EventLink['via']][] => [
    ...nonZero(ev.reqs.code).map((c) => [c, 'code'] as [number, EventLink['via']]),
    ...nonZero(ev.reqs.nearbycode).map((c) => [c, 'nearbycode'] as [number, EventLink['via']]),
    ...nonZero(ev.reqs.nearowncode).map((c) => [c, 'nearowncode'] as [number, EventLink['via']]),
  ];
  for (const [id, ev] of info) {
    for (const c of setCodes(ev)) bump(setters, c, id);
    for (const [c] of localReqs(ev)) bump(requirers, c, id);
    for (const c of nonZero(ev.reqs.anycode)) bump(requirers, c, id);
  }
  const isFlag = (c: number) =>
    c < 0 && ((setters.get(c)?.size ?? 0) >= HUB_SETTERS || (requirers.get(c)?.size ?? 0) >= HUB_REQUIRERS);
  DMI.eventWorldFlags = new Set([...setters.keys(), ...requirers.keys()].filter(isFlag));

  // story inheritance uses every prerequisite, world flags and anycode included
  const storyPrev = new Map<number, Set<number>>();
  const addStoryPrev = (to: number, from: number) => from !== to && (storyPrev.get(to) ?? storyPrev.set(to, new Set()).get(to)!).add(from);

  const link = (from: number, to: number, l: Omit<EventLink, 'id'>) => {
    if (from === to || !info.has(from) || !info.has(to)) return;
    const a = info.get(from)!;
    const b = info.get(to)!;
    if (!a.next.some((x) => x.id === to && x.via === l.via)) a.next.push({ id: to, ...l });
    if (!b.prev.some((x) => x.id === from && x.via === l.via)) b.prev.push({ id: from, ...l });
  };

  for (const [id, ev] of info) {
    for (const [c, via] of localReqs(ev)) {
      for (const s of setters.get(c) ?? []) {
        addStoryPrev(id, s);
        if (isFlag(c)) continue;
        link(s, id, { via, code: c });
      }
      if (isFlag(c)) ev.worldFlags.push({ code: c, use: 'needs' });
    }
    for (const c of nonZero(ev.reqs.anycode)) {
      for (const s of setters.get(c) ?? []) addStoryPrev(id, s);
      ev.worldFlags.push({ code: c, use: 'needs' });
    }
    for (const c of nonZero(ev.reqs.notanycode)) ev.worldFlags.push({ code: c, use: 'needsnot' });
    for (const c of setCodes(ev)) if (isFlag(c) || (requirers.get(c) && [...requirers.get(c)!].some((r) => nonZero(info.get(r)!.reqs.anycode).includes(c))))
      ev.worldFlags.push({ code: c, use: 'sets' });
    for (const c of [...nonZero(ev.effs.resetcode), ...nonZero(ev.effs.resetcodedelay), ...nonZero(ev.effs.resetcodedelay2)])
      if (isFlag(c)) ev.worldFlags.push({ code: c, use: 'clears' });
    // `delay N`: the next event id fires N turns later; `delayskip` may pick the one after
    for (const k of ['delay', 'delay25', 'delay50']) {
      const t = num(ev.effs[k]);
      if (t !== undefined) {
        link(id, id + 1, { via: 'delay', turns: t });
        addStoryPrev(id + 1, id);
      }
    }
    if (ev.effs.delayskip) {
      link(id, id + 2, { via: 'delayskip' });
      addStoryPrev(id + 2, id);
    }
  }

  // --- story inheritance: greatest fixpoint of eff(e) = max(own, min over prerequisites) -------
  for (const [id, ev] of info) if (storyPrev.has(id)) ev.storyEffective = 2;
  for (let changed = true; changed; ) {
    changed = false;
    for (const [id, ev] of info) {
      const ps = storyPrev.get(id);
      if (!ps) continue;
      let m = 2;
      for (const p of ps) m = Math.min(m, info.get(p)!.storyEffective);
      const v = Math.max(ev.story, m) as 0 | 1 | 2;
      if (v !== ev.storyEffective) {
        ev.storyEffective = v;
        changed = true;
      }
    }
  }

  // --- storylines: connected components over the non-flag links --------------------------------
  const storylines: Storyline[] = [];
  const seen = new Set<number>();
  for (const id of [...info.keys()].sort((a, b) => a - b)) {
    const ev = info.get(id)!;
    if (seen.has(id) || (!ev.prev.length && !ev.next.length)) continue;
    const comp: number[] = [];
    const stack = [id];
    seen.add(id);
    while (stack.length) {
      const x = stack.pop()!;
      comp.push(x);
      const e = info.get(x)!;
      for (const l of [...e.prev, ...e.next]) if (!seen.has(l.id)) (seen.add(l.id), stack.push(l.id));
    }
    comp.sort((a, b) => a - b);
    const starts = comp.filter((x) => !info.get(x)!.prev.length);
    const sl: Storyline = { id: storylines.length, name: info.get(starts[0] ?? comp[0])!.title, events: comp, starts };
    storylines.push(sl);
    for (const x of comp) {
      const e = info.get(x)!;
      e.storyline = sl.id;
      e.role = !e.prev.length ? 'start' : e.next.length ? 'middle' : 'end';
    }
  }
  DMI.eventStorylines = storylines;

  for (const [id, ev] of info) Object.defineProperty(byId.get(id), 'ev', { value: ev, enumerable: false, configurable: true });
}

/** The event's model, built by installEvents. */
export const eventInfo = (o: any): EventInfo | undefined => o?.ev;
