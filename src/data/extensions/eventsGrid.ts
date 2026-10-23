// New in this app: table columns and filters for the Events page. Reads the event model `o.ev`
// (src/data/extensions/events.ts) at render/filter time, so legacy event objects stay unchanged and
// the golden suite never sees these values. Used by MEvent.grid (src/data/legacy/MEvent.ts).
import {
  BookOpen, CalendarDays, Castle, Coins, Crown, Flag, Flame, Gem, Globe, Hourglass, Link, MapPin, Megaphone,
  Mountain, Scale, Skull, Sparkles, Swords, TrendingUp, User, Users, Wand,
} from 'lucide-static';
import {
  REWARD_LABELS, TRIGGER_LABELS, type EventInfo, type EventKind, type RewardCategory, type StorylineRole, type TriggerCategory,
} from './events';
import { checkEvent, parseProvinceState, type ProvinceState } from './eventEligibility';

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const svg = (s: string) => s.replace(/\s*\n\s*/g, ' ').replace(/width="24"/, 'width="1em"').replace(/height="24"/, 'height="1em"').trim();

export const TRIGGER_ICONS: Record<TriggerCategory, string> = {
  order: Megaphone, path: Sparkles, site: MapPin, unit: User, scale: Scale, dominion: Flame, enchantment: Wand,
  building: Castle, terrain: Mountain, season: CalendarDays, nation: Flag, worldflag: Link, population: Users,
  turn: Hourglass,
};
export const REWARD_ICONS: Record<RewardCategory, string> = {
  units: Users, commander: Crown, item: Swords, gems: Gem, gold: Coins, site: MapPin, scale: Scale, dominion: Flame,
  boost: TrendingUp, harm: Skull, world: Globe, storyflag: BookOpen,
};

export const KIND_ORDER: EventKind[] = ['good', 'always', 'bad', 'global'];
export const KIND_LABELS: Record<EventKind, string> = { good: 'Good', bad: 'Bad', always: 'Always', global: 'Global' };
export const ROLE_LABELS: Record<StorylineRole, string> = { standalone: 'Standalone', start: 'Starts a storyline', middle: 'Middle of a storyline', end: 'Ends a storyline' };
export const ROLE_GLYPHS: Record<StorylineRole, string> = { standalone: '', start: '▶', middle: '•', end: '■' };

/** Options for multi-select chip filters (value, label, svg icon). */
export interface ChipOption {
  value: string;
  label: string;
  title?: string;
  icon?: string;
  className?: string;
}
export const KIND_OPTIONS: ChipOption[] = KIND_ORDER.map((k) => ({ value: k, label: KIND_LABELS[k], className: `ev-kind ev-kind-${k}` }));
export const ROLE_OPTIONS: ChipOption[] = (['standalone', 'start', 'middle', 'end'] as StorylineRole[]).map((r) => ({
  value: r,
  label: (ROLE_GLYPHS[r] ? ROLE_GLYPHS[r] + ' ' : '') + r[0].toUpperCase() + r.slice(1),
  title: ROLE_LABELS[r],
}));
export const TRIGGER_OPTIONS: ChipOption[] = (Object.keys(TRIGGER_LABELS) as TriggerCategory[]).map((c) => ({
  value: c, label: TRIGGER_LABELS[c], icon: svg(TRIGGER_ICONS[c]), className: `evi-t evi-t-${c}`,
}));
export const REWARD_OPTIONS: ChipOption[] = (Object.keys(REWARD_LABELS) as RewardCategory[]).map((c) => ({
  value: c, label: REWARD_LABELS[c], icon: svg(REWARD_ICONS[c]), className: `evi-r evi-r-${c}`,
}));

/** Rarity -> sort rank: good first, then always, bad, global. */
const RARITY_RANK: Record<string, number> = { '-1': 0, '-2': 1, '0': 2, '5': 3, '1': 4, '2': 5, '10': 6, '11': 7, '12': 8, '13': 9, '14': 10, '15': 11 };
const KIND_SUFFIX: Record<string, string> = {
  '-2': 'uncommon', '2': 'uncommon', '5': '∞', '10': 'always', '11': 'common', '12': 'uncommon', '13': 'immediate', '14': 'special', '15': 'seasonal',
};

/** Trigger categories shown for an event: `ev.triggers`, plus world flags it needs. */
export function eventTriggers(ev: EventInfo): TriggerCategory[] {
  const t = [...ev.triggers];
  if (!t.includes('worldflag') && ev.worldFlags.some((w) => w.use === 'needs' || w.use === 'needsnot')) t.push('worldflag');
  return t;
}

const ORDERED_TRIGGERS = Object.keys(TRIGGER_LABELS) as TriggerCategory[];
const ORDERED_REWARDS = Object.keys(REWARD_LABELS) as RewardCategory[];

function iconStrip(cats: string[], order: string[], icons: Record<string, string>, labels: Record<string, string>, cls: string) {
  if (!cats.length) return '';
  const sorted = order.filter((c) => cats.includes(c));
  let h = `<span class="evi-strip">`;
  for (const c of sorted) h += `<span class="evi ${cls} ${cls}-${c}" title="${esc(labels[c])}">${svg(icons[c])}</span>`;
  return h + '</span>';
}

const nationName = (DMI: any, id: number) => DMI.modctx.nationlookup?.[id];

/** Builds MEvent.grid. */
export function eventGrid(DMI: any, data: () => any[]) {
  const ev = (o: any): EventInfo | undefined => o?.ev;
  const storylines = () => (DMI.eventStorylines ?? []) as { id: number; name: string; events: number[] }[];

  const columns = [
    {
      id: 'description', width: 150, name: 'Title', field: 'description', sortable: true, sortCmp: 'text',
      sortValue: (o: any) => (ev(o)?.title ?? o.description ?? '').toLowerCase(),
      formatter: (_r: number, _c: number, _v: any, _col: any, o: any) =>
        `<span class="ev-title" title="${esc(o.description)}">${esc(ev(o)?.title ?? o.description)}</span>`,
    },
    {
      id: 'rarity', width: 110, name: 'Kind', field: 'rarity', sortable: true,
      title: 'Event kind and rarity; sorts good → always → bad → global',
      sortValue: (o: any) => (RARITY_RANK[String(o.rarity)] ?? 50) + 1,
      formatter: (_r: number, _c: number, _v: any, _col: any, o: any) => {
        const e = ev(o);
        if (!e) return esc(o.rarity);
        const suf = KIND_SUFFIX[String(o.rarity)];
        return `<span class="ev-kind ev-kind-${e.kind}" title="${esc(e.rarityLabel)}">${KIND_LABELS[e.kind]}${suf ? ` <small>${esc(suf)}</small>` : ''}</span>`;
      },
    },
    {
      id: 'chance', width: 40, name: 'Chance', field: 'chance', sortable: true, cssClass: 'numeric',
      title: 'req_rare: percent chance the event happens when rolled',
      sortValue: (o: any) => ev(o)?.chance ?? -1,
      formatter: (_r: number, _c: number, _v: any, _col: any, o: any) => {
        const c = ev(o)?.chance;
        return c === undefined ? '' : `${c}%`;
      },
    },
    {
      id: 'story', width: 50, name: 'Story', field: 'story', sortable: true,
      title: 'Story event setting needed: Minor (Minor or All) or All',
      sortValue: (o: any) => {
        const e = ev(o);
        return e ? e.storyEffective * 10 + e.story + 1 : 0;
      },
      formatter: (_r: number, _c: number, _v: any, _col: any, o: any) => {
        const e = ev(o);
        if (!e || !e.storyEffective) return '';
        const inherited = e.storyEffective > e.story;
        const label = e.storyEffective === 1 ? 'Minor' : 'All';
        const tip = `Needs story events: ${e.storyEffective === 1 ? 'Minor or All' : 'All'}` + (inherited ? ' (inherited: every way to reach this event needs it)' : '');
        return `<span class="ev-story ev-story-${e.storyEffective}${inherited ? ' ev-story-inh' : ''}" title="${esc(tip)}">${label}${inherited ? '<sup>↳</sup>' : ''}</span>`;
      },
    },
    {
      id: 'storyline', width: 110, name: 'Storyline', field: 'storyline', sortable: true, sortCmp: 'num',
      title: 'Chain of events linked by codes and delays; ▶ start, • middle, ■ end. Sorting groups each storyline in id order',
      sortValue: (o: any) => {
        const e = ev(o);
        return e?.storyline === undefined ? 1e9 + Number(o.id) : (e.storyline + 1) * 1e5 + Number(o.id);
      },
      formatter: (_r: number, _c: number, _v: any, _col: any, o: any) => {
        const e = ev(o);
        if (!e || e.storyline === undefined) return '';
        const sl = storylines()[e.storyline];
        if (!sl) return '';
        return `<span class="ev-sl ev-sl-${e.role}" title="${esc(`${sl.name} — ${ROLE_LABELS[e.role].toLowerCase()} (${sl.events.length} events)`)}"><span class="ev-sl-glyph">${ROLE_GLYPHS[e.role]}</span>${esc(sl.name)}</span>`;
      },
    },
    {
      id: 'triggers', width: 90, name: 'Triggers', field: 'triggers', sortable: true, sortCmp: 'text',
      title: 'What the event requires (hover an icon for its meaning)',
      sortValue: (o: any) => {
        const e = ev(o);
        return e ? ORDERED_TRIGGERS.filter((c) => eventTriggers(e).includes(c)).join(',') : '';
      },
      formatter: (_r: number, _c: number, _v: any, _col: any, o: any) => {
        const e = ev(o);
        return e ? iconStrip(eventTriggers(e), ORDERED_TRIGGERS, TRIGGER_ICONS, TRIGGER_LABELS, 'evi-t') : '';
      },
    },
    {
      id: 'rewards', width: 90, name: 'Rewards', field: 'rewards', sortable: true, sortCmp: 'text',
      title: 'What the event does (red: harmful)',
      sortValue: (o: any) => {
        const e = ev(o);
        return e ? ORDERED_REWARDS.filter((c) => e.rewards.includes(c)).join(',') : '';
      },
      formatter: (_r: number, _c: number, _v: any, _col: any, o: any) => {
        const e = ev(o);
        return e ? iconStrip(e.rewards, ORDERED_REWARDS, REWARD_ICONS, REWARD_LABELS, 'evi-r') : '';
      },
    },
    {
      id: 'turn', width: 40, name: 'Turn', field: 'turn', sortable: true, cssClass: 'numeric', defaultHidden: true,
      title: 'Earliest (≥) and latest (≤) turn the event can happen',
      sortValue: (o: any) => ev(o)?.minTurn ?? 0,
      formatter: (_r: number, _c: number, _v: any, _col: any, o: any) => {
        const e = ev(o);
        if (!e) return '';
        const lo = e.minTurn, hi = e.maxTurn;
        if (lo !== undefined && hi !== undefined) return `${lo}–${hi}`;
        if (lo !== undefined) return `≥${lo}`;
        if (hi !== undefined) return `≤${hi}`;
        return '';
      },
    },
    {
      id: 'unique', width: 35, name: 'Unique', field: 'unique', sortable: true, cssClass: 'numeric', defaultHidden: true,
      title: 'req_unique: at most this many times per game',
      sortValue: (o: any) => ev(o)?.unique ?? 0,
      formatter: (_r: number, _c: number, _v: any, _col: any, o: any) => {
        const u = ev(o)?.unique;
        return u === undefined ? '' : `<span title="${esc(`at most ${u}× per game`)}">${u}×</span>`;
      },
    },
    {
      id: 'nations', width: 90, name: 'Nation', field: 'nations', sortable: true, sortCmp: 'text', defaultHidden: true,
      title: 'req_fornation: only for these nations',
      sortValue: (o: any) => {
        const e = ev(o);
        return e?.forNations.length ? String(nationName(DMI, e.forNations[0])?.name ?? e.forNations[0]).toLowerCase() : '';
      },
      formatter: (_r: number, _c: number, _v: any, _col: any, o: any) => {
        const e = ev(o);
        if (!e?.forNations.length) return '';
        const names = e.forNations.map((id) => nationName(DMI, id));
        const short = names.map((n, i) => n?.name ?? `#${e.forNations[i]}`).join(', ');
        const full = names.map((n, i) => n?.fullname ?? n?.name ?? `Nation ${e.forNations[i]}`).join('\n');
        return `<span title="${esc(full)}">${esc(short)}</span>`;
      },
    },
    {
      id: 'fulldesc', width: 200, name: 'Description', field: 'description', sortable: true, sortCmp: 'text', defaultHidden: true,
      formatter: (_r: number, _c: number, v: any) => `<span title="${esc(v)}">${esc(v)}</span>`,
    },
  ];

  return {
    page: 'event',
    data,
    columns,
    getSearchArgs: (f: any) => eventSearchArgs(DMI, f),
    searchFilter: (o: any, args: EventSearchArgs) => eventSearchFilter(DMI, o, args),
  };
}

export interface EventSearchArgs {
  str: string;
  properties: any[];
  customjs?: string;
  /** max story level shown: 0 Off, 1 Minor, 2 All */
  story: number;
  kinds: string[];
  /** nation ids the event must be usable by (any of); null = no nation filter */
  nations: Set<number> | null;
  roles: string[];
  storyline: number | null;
  triggers: string[];
  rewards: string[];
  turn: number | null;
  chanceMin: number | null;
  chanceMax: number | null;
  /** Province eligibility state (p_* keys), see eventEligibility.ts */
  province: ProvinceState | null;
}

const list = (v: any): string[] => (v ? String(v).split(',').map((s) => s.trim()).filter(Boolean) : []);
const int = (v: any): number | null => {
  const n = parseInt(String(v ?? ''), 10);
  return isNaN(n) ? null : n;
};

export const STORY_LEVELS: Record<string, number> = { off: 0, minor: 1, all: 2, '': 2 };

export function eventSearchArgs(DMI: any, f: any): EventSearchArgs {
  let nations: Set<number> | null = null;
  if (f.nation) {
    const group = (DMI.modctx.nationOptions ?? []).find((g: any) => g.code === f.nation);
    nations = new Set(group ? group.nations.map((n: any) => Number(n.id)) : [Number(f.nation)]);
  }
  const [cmin, cmax] = String(f.chance ?? '').split('~');
  return {
    str: (f.str || '').toLowerCase().trim(),
    properties: DMI.buildPropertyArgs(f.properties),
    customjs: f.customjs,
    story: STORY_LEVELS[String(f.story ?? '')] ?? 2,
    kinds: list(f.kind),
    nations,
    roles: list(f.role),
    storyline: int(f.storyline),
    triggers: list(f.trig),
    rewards: list(f.rew),
    turn: int(f.turn),
    chanceMin: int(cmin),
    chanceMax: int(cmax),
    province: parseProvinceState(f, DMI),
  };
}

const any = <T>(xs: T[], ys: T[]) => xs.some((x) => ys.includes(x));

export function eventSearchFilter(DMI: any, o: any, args: EventSearchArgs): boolean {
  //type in id to ignore filters
  if (args.str && args.str === String(o.id)) return true;
  const e: EventInfo | undefined = o.ev;
  if (args.str && !String(o.searchable ?? '').includes(args.str) && !(e && e.title.toLowerCase().includes(args.str))) return false;

  if (e) {
    if (e.storyEffective > args.story) return false;
    if (args.kinds.length && !args.kinds.includes(e.kind)) return false;
    if (args.nations) {
      if (e.forNations.length && !e.forNations.some((n) => args.nations!.has(n))) return false;
      const not = (e.reqs.notfornation ?? []).map(Number);
      if (not.length && [...args.nations].every((n) => not.includes(n))) return false;
    }
    if (args.roles.length && !args.roles.includes(e.role)) return false;
    if (args.storyline !== null && e.storyline !== args.storyline) return false;
    if (args.triggers.length && !any(eventTriggers(e), args.triggers as TriggerCategory[])) return false;
    if (args.rewards.length && !any(e.rewards, args.rewards as RewardCategory[])) return false;
    if (args.turn !== null) {
      if (e.minTurn !== undefined && e.minTurn > args.turn) return false;
      if (e.maxTurn !== undefined && e.maxTurn < args.turn) return false;
    }
    if (args.chanceMin !== null || args.chanceMax !== null) {
      const c = e.chance ?? 100;
      if (args.chanceMin !== null && c < args.chanceMin) return false;
      if (args.chanceMax !== null && c > args.chanceMax) return false;
    }
  }

  if (args.province) {
    const r = checkEvent(o, args.province);
    if (r.verdict === 'blocked') return false;
    if (args.province.noChain && r.needsChain) return false;
    if (args.province.strict && r.verdict !== 'eligible') return false;
  }

  if (!DMI.propertySearchFilter(o, args)) return false;
  return DMI.customSearchFilter(o, args);
}

/** Storyline select options: every storyline by name, sorted. */
export function storylineOptions(DMI: any): { value: string; label: string; title?: string }[] {
  const sls: { id: number; name: string; events: number[] }[] = DMI?.eventStorylines ?? [];
  return [
    { value: '', label: 'All storylines' },
    ...[...sls]
      .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
      .map((s) => ({ value: String(s.id), label: `${s.name} (${s.events.length})`, title: `events ${s.events.join(', ')}` })),
  ];
}
