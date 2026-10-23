// Event detail card: readable additions around the legacy MEvent renderer.
// The golden suite pins `o.renderOverlay(o)`, so legacy rendering is untouched. Here the renderer is called with
// a *view* of the event: opcode tokens renamed to their command names (`req_9600` -> `req_rare`), and the keys
// this module explains better (story, chance, codes, delays, rarity, orders) taken out and rendered as rows of
// our own. A story map of the event's chain links goes under the description.
import {
  EVENT_EFF_OPS,
  EVENT_REQ_OPS,
  type Confidence,
  type EventInfo,
  type EventLink,
  type Storyline,
  type WorldFlagUse,
} from '../data/extensions/events';

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const HEX = /^[0-9A-F]{4}$/;

/** Shared world-state codes with a name from the event research; others show as "world flag N". */
export const WORLD_FLAG_NAMES: Record<number, string> = {
  [-7]: 'bad omens',
  [-14]: 'Northmen / Idol',
  [-15]: 'Northmen raids',
  [-20]: 'Time of Strife (Throne of War)',
  [-26]: 'fertility festival',
  [-33]: 'war omens (land)',
  [-34]: 'war omens (sea)',
  [-36]: 'plague',
  [-44]: 'War in Hell / demons',
  [-49]: 'demon cult',
  [-64]: 'necromancer',
  [-85]: 'Idol of the Northmen',
  [-95]: 'werewolf curse',
  [-199]: 'arena death match',
};

export const ORDER_NAMES: Record<number, string> = {
  0: 'Defend', 2: 'Sneak', 3: 'Patrol', 4: 'Research', 6: 'Preach', 7: 'Site search', 8: 'Blood hunt',
  14: 'Call God', 17: 'Summon allies', 18: 'Build lab', 19: 'Build temple', 20: 'Build fort',
  44: 'Demolish fort', 45: 'Demolish lab', 50: 'Enter site', 52: 'Void summon',
  100: 'Investigate', 101: 'Continue', 102: 'Accept', 103: 'Decline', 104: 'Withdraw', 105: 'Attack',
  106: 'Diplomacy', 107: 'Subterfuge', 108: 'Magic',
};

const STORY_LABEL = ['', 'Minor or All story events', 'All story events only'];
const ROLE_LABEL: Record<string, string> = { start: 'start', middle: 'step', end: 'end', standalone: '' };
const PATHS: Record<string, string> = {
  fire: 'Fire', air: 'Air', water: 'Water', earth: 'Earth', astral: 'Astral', death: 'Death',
  nature: 'Nature', blood: 'Blood', holy: 'Holy', glamour: 'Glamour',
};

/** Keys the card renders itself (removed from the legacy view). */
const OWN_REQS = ['story', 'rare', 'code', 'notcode', 'nearbycode', 'nearowncode', 'anycode', 'notanycode', 'targorder'];
const OWN_EFFS = ['delay', 'delay25', 'delay50', 'delayskip'];

const MAX_PREV = 5;
const MAX_NEXT = 6;
const MAX_HOP2 = 3;

const arr = (v: any): string[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v.map(String) : [String(v)]);
const ints = (v: any) => [...new Set(arr(v).map((x) => parseInt(x, 10)).filter((n) => !isNaN(n)))];
/** Legacy formatters that call `v.map` (only reached when the opcode is renamed). */
const ARRAY_KEYS = new Set(['req_godismnr', 'req_pretismnr']);
/** Display title (events.ts keeps a leading quote from quoted descriptions). */
const titleOf = (ev: EventInfo) => ev.title.replace(/^["“']+/, '');

/** "7200" (little-endian opcode as the CSV writes it) -> "0x72". */
export function opcodeLabel(token: string) {
  return '0x' + parseInt(token.slice(2, 4) + token.slice(0, 2), 16).toString(16).toUpperCase();
}

const row = (key: string, label: string, value: string, attrs = '') =>
  ` <tr class="${key} evc-row"${attrs}> <th>${label}<span class="internal-inline"> [${key}]</span>: </th> <td>${value}</td> </tr> `;

export function flagName(code: number) {
  return WORLD_FLAG_NAMES[code] ?? 'world flag ' + code;
}

function flagBadge(f: WorldFlagUse) {
  const verb = { sets: 'sets', needs: 'needs', needsnot: 'needs no', clears: 'clears' }[f.use];
  const tip = `Shared world-state code ${f.code}: ${verb === 'needs' ? 'must be set in some province' : verb === 'needs no' ? 'must not be set anywhere' : verb + ' it'}`;
  return `<span class="evc-badge evc-flag evc-flag-${f.use}" title="${escapeHtml(tip)}">${verb} <b>${escapeHtml(flagName(f.code))}</b></span>`;
}

function kindBadge(ev: EventInfo, extra = '') {
  return `<span class="evc-badge evc-kind evc-kind-${ev.kind}${extra}">${escapeHtml(ev.rarityLabel)}</span>`;
}

function eventLink(DMI: any, id: number, text?: string) {
  const o = DMI.modctx.eventlookup[id];
  if (!o) return '#' + id;
  return DMI.Utils.ref('event ' + id, escapeHtml(text ?? (o.ev ? titleOf(o.ev) : o.name)));
}

const orderList = (vals: number[]) => vals.map((v) => ORDER_NAMES[v] ?? 'order ' + v).join(' or ');

/** Short "what makes it fire" text for a chain step: chance, commander order, mage path. */
function triggerBits(ev: EventInfo): string[] {
  const bits: string[] = [];
  const orders = ints(ev.reqs.targorder);
  if (orders.length) bits.push('commander orders ' + orderList(orders));
  for (const [k, v] of Object.entries(ev.reqs)) {
    const m = k.match(/^(?:targ)?path(\w+)$/);
    if (m && PATHS[m[1]]) bits.push(`${PATHS[m[1]]} ${v[0]}+ mage`);
  }
  if (ev.chance !== undefined && ev.chance < 100) bits.push(ev.chance + '% chance');
  return bits;
}

/** Copy of the event with opcode keys renamed and the keys rendered by this module removed. */
function legacyView(o: any, ev: EventInfo, mapped: boolean) {
  const view: any = {};
  const guesses: [string, Confidence, string][] = [];
  const put = (k: string, v: any) => {
    if (k in view) view[k] = [...arr(view[k]), ...arr(v)];
    else view[k] = v;
  };
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (k.startsWith('req_')) {
      const raw = k.slice(4);
      if (HEX.test(raw)) {
        const op = EVENT_REQ_OPS[raw];
        if (!op) continue; // rendered as "unknown requirement"
        if (OWN_REQS.includes(op[0])) continue;
        if (op[1] !== 'high') guesses.push(['req_' + op[0], op[1], opcodeLabel(raw)]);
        put('req_' + op[0], ARRAY_KEYS.has('req_' + op[0]) ? arr(v) : v);
        continue;
      }
      if (OWN_REQS.includes(raw)) continue;
    } else if (HEX.test(k) || k === 'e3') {
      const op = EVENT_EFF_OPS[k];
      if (!op) continue;
      if (OWN_EFFS.includes(op[0])) continue;
      if (op[1] !== 'high') guesses.push([op[0], op[1], k === 'e3' ? 'e3' : opcodeLabel(k)]);
      put(op[0], v);
      continue;
    } else if (OWN_EFFS.includes(k) || k === 'rarity') continue;
    else if (k.startsWith('linked') && Array.isArray(v)) {
      // the story map replaces the code links; empty lists are dropped
      if (!v.length || (mapped && k !== 'linkedResetCodes')) continue;
    }
    put(k, v);
  }
  view.name = escapeHtml(titleOf(ev));
  return { view, guesses };
}

function unknownOps(o: any) {
  const reqs: string[] = [];
  const effs: string[] = [];
  for (const k of Object.keys(o)) {
    const raw = k.startsWith('req_') ? k.slice(4) : null;
    if (raw !== null && HEX.test(raw) && !EVENT_REQ_OPS[raw])
      reqs.push(row(k, `unknown command ${opcodeLabel(raw)}`, escapeHtml(arr(o[k]).join(', ')), ' title="Command not identified in the game executable"'));
    else if (raw === null && HEX.test(k) && !EVENT_EFF_OPS[k])
      effs.push(row(k, `unknown command ${opcodeLabel(k)}`, escapeHtml(arr(o[k]).join(', ')), ' title="Command not identified in the game executable"'));
  }
  return { reqs, effs };
}

const titleName = (sl: Storyline) => sl.name.replace(/^["“']+/, '');

function storylineOf(DMI: any, ev: EventInfo): Storyline | undefined {
  return ev.storyline === undefined ? undefined : DMI.eventStorylines?.[ev.storyline];
}

function requirementRows(DMI: any, o: any, ev: EventInfo) {
  const h: string[] = [];
  const sl = storylineOf(DMI, ev);
  if (ev.storyEffective || ev.story) {
    let v = escapeHtml(STORY_LABEL[ev.story || ev.storyEffective]);
    const from = sl ? 'inherited from storyline: ' + eventLink(DMI, sl.starts[0] ?? sl.events[0], titleName(sl)) : 'inherited from the events that lead here';
    if (!ev.story && ev.storyEffective) v = `${escapeHtml(STORY_LABEL[ev.storyEffective])} <span class="evc-note">${from}</span>`;
    else if (ev.storyEffective > ev.story) v += `; <span class="evc-note">${escapeHtml(STORY_LABEL[ev.storyEffective])}, ${from}</span>`;
    const tip = 'Game setting “Story events”. ' + (ev.story ? '' : 'This event has no requirement of its own but can only follow events that need it.');
    h.push(row('req_story', 'story events', v, ` title="${escapeHtml(tip)}"`));
  }
  if (ev.chance !== undefined) h.push(row('req_rare', 'chance', `${ev.chance}% chance`, ' title="req_rare: percent chance each time the event is rolled"'));
  const orders = ints(ev.reqs.targorder);
  if (orders.length) h.push(row('req_targorder', 'commander order', escapeHtml(orderList(orders))));
  const codes = ints(ev.reqs.code);
  if (codes.length)
    h.push(row('req_code', 'province code', codes.map((c) => (c === 0 ? 'none (starts a chain)' : String(c))).join(' or ')));
  for (const c of ints(ev.reqs.notcode)) h.push(row('req_notcode', 'province code', 'not ' + c));
  const near = ints(ev.reqs.nearbycode);
  if (near.length) h.push(row('req_nearbycode', 'neighbour code', 'a neighbouring province has code ' + near.join(' or ')));
  const nearOwn = ints(ev.reqs.nearowncode);
  if (nearOwn.length) h.push(row('req_nearowncode', 'own area code', 'this or a neighbouring own province has code ' + nearOwn.join(' or ')));
  const flags = new Set(ev.worldFlags.map((f) => f.code));
  const any = ints(ev.reqs.anycode);
  if (any.length)
    h.push(row('req_anycode', 'code anywhere', any.map((c) => (flags.has(c) ? flagBadge({ code: c, use: 'needs' }) : `<span class="evc-badge evc-flag" title="Some province in the world has code ${c}">code ${c} anywhere</span>`)).join(' ')));
  const notAny = ints(ev.reqs.notanycode);
  if (notAny.length) h.push(row('req_notanycode', 'code nowhere', notAny.map((c) => flagBadge({ code: c, use: 'needsnot' })).join(' ')));
  const otherFlags = ev.worldFlags.filter((f) => f.use === 'needs' && !any.includes(f.code));
  if (otherFlags.length) h.push(row('ev_flags_req', 'world flags', otherFlags.map(flagBadge).join(' ')));
  return h.join('');
}

function effectRows(DMI: any, o: any, ev: EventInfo) {
  const h: string[] = [];
  const id = Number(o.id);
  for (const [k, spread] of [['delay', ''], ['delay25', ' (±25%)'], ['delay50', ' (±50%)']] as const) {
    for (const t of ints(ev.effs[k]))
      h.push(row(k, 'next event', `${eventLink(DMI, id + 1)} <span class="evc-note">#${id + 1}, after ${t} turn${t === 1 ? '' : 's'}${spread}</span>`));
  }
  for (const p of ints(ev.effs.delayskip))
    h.push(row('delayskip', 'skip ahead', `${p}% chance of ${eventLink(DMI, id + 2)} <span class="evc-note">#${id + 2}</span> instead`));
  const codes = ints(o.code);
  if (codes.length) h.push(row('code', 'province code', codes.map((c) => (c === 0 ? 'cleared (chain ends)' : 'set to ' + c)).join(', ')));
  const flagCodes = new Set(ev.worldFlags.map((f) => f.code));
  const resets = ints(o.resetcode).filter((c) => c && !flagCodes.has(c));
  if (resets.length) h.push(row('resetcode', 'code reset', 'clears code ' + resets.join(', ') + ' everywhere'));
  const flags = ev.worldFlags.filter((f) => f.use === 'sets' || f.use === 'clears');
  if (flags.length) h.push(row('ev_flags_eff', 'world flags', flags.map(flagBadge).join(' ')));
  return h.join('');
}

/* ---- story map --------------------------------------------------------------------------- */

function viaLabel(l: EventLink, from: EventInfo | undefined, dir: 'in' | 'out'): string {
  switch (l.via) {
    case 'code':
      return dir === 'out' ? `same province code ${l.code}` : `sets code ${l.code}`;
    case 'nearbycode':
      return dir === 'out' ? `neighbour has code ${l.code}` : `code ${l.code} next door`;
    case 'nearowncode':
      return `own area has code ${l.code}`;
    case 'delay': {
      const spread = from ? (from.effs.delay25 ? ' ±25%' : from.effs.delay50 ? ' ±50%' : '') : '';
      return `${l.turns} turn${l.turns === 1 ? '' : 's'} later${spread}`;
    }
    case 'delayskip': {
      const p = from ? ints(from.effs.delayskip)[0] : undefined;
      return p !== undefined ? `skip ahead (${p}%)` : 'skip ahead';
    }
    default:
      return l.via;
  }
}

/** Groups links to the same event (an event can be linked by several codes). */
function group(links: EventLink[]) {
  const m = new Map<number, EventLink[]>();
  for (const l of links) m.set(l.id, [...(m.get(l.id) ?? []), l]);
  return [...m.entries()];
}

function node(DMI: any, id: number, cls: string, labels: string[]) {
  const o = DMI.modctx.eventlookup[id];
  const ev: EventInfo | undefined = o?.ev;
  if (!ev) return '';
  const role = ROLE_LABEL[ev.role];
  return (
    `<div class="evc-node evc-kind-${ev.kind} ${cls}">` +
    (labels.length ? `<div class="evc-edge">${labels.map((l) => `<span>${escapeHtml(l)}</span>`).join('')}</div>` : '') +
    `<div class="evc-node-title">${eventLink(DMI, id)}</div>` +
    `<div class="evc-node-meta"><span class="evc-id">#${id}</span>${role ? `<span class="evc-role evc-role-${ev.role}">${role}</span>` : ''}<span class="evc-kind-label">${escapeHtml(ev.rarityLabel)}</span></div>` +
    '</div>'
  );
}

function capped(items: string[], max: number, cls: string) {
  if (items.length <= max) return items.join('');
  return items.slice(0, max).join('') + `<details class="evc-more ${cls}"><summary>+${items.length - max} more</summary><div class="evc-more-list">${items.slice(max).join('')}</div></details>`;
}

export function storyMap(DMI: any, o: any): string {
  const ev: EventInfo | undefined = o?.ev;
  if (!ev || (!ev.prev.length && !ev.next.length)) return '';
  const id = Number(o.id);
  const info = (x: number): EventInfo | undefined => DMI.modctx.eventlookup[x]?.ev;
  const sl = storylineOf(DMI, ev);

  const head =
    '<div class="evc-map-head">' +
    (sl
      ? `<span>Storyline: ${sl.starts.includes(id) || !sl.starts.length ? escapeHtml(titleName(sl)) : eventLink(DMI, sl.starts[0], titleName(sl))} · ${sl.events.length} events</span>`
      : '') +
    (ev.worldFlags.length ? `<span class="evc-map-flags">${ev.worldFlags.map(flagBadge).join(' ')}</span>` : '') +
    '</div>';

  // via labels shared by every node of a group are shown once, in the group label
  const lift = (lists: string[][]) => {
    const common = lists.length > 1 ? lists[0].filter((l) => lists.every((ls) => ls.includes(l))) : [];
    return { common, rest: lists.map((ls) => ls.filter((l) => !common.includes(l))) };
  };
  const groupLabel = (title: string, common: string[]) =>
    `<div class="evc-map-label">${title}${common.length ? ` <span class="evc-map-via">· ${escapeHtml(common.join(', '))}</span>` : ''}</div>`;

  const prevGroups = group(ev.prev);
  const prevVia = lift(prevGroups.map(([pid, ls]) => [...new Set(ls.map((l) => viaLabel(l, info(pid), 'in')))]));
  const prev = prevGroups.map(([pid], i) => node(DMI, pid, 'evc-prev', prevVia.rest[i]));

  const shown = new Set<number>([id, ...ev.next.map((l) => l.id)]);
  // most likely first: no chance roll, then by chance
  const nextGroups = group(ev.next).sort(([a], [b]) => (info(b)?.chance ?? 100) - (info(a)?.chance ?? 100));
  const nextVia = lift(nextGroups.map(([, ls]) => [...new Set(ls.map((l) => viaLabel(l, ev, 'out')))]));
  const next = nextGroups.map(([nid], i) => {
    const nev = info(nid);
    const labels = [...nextVia.rest[i], ...(nev ? triggerBits(nev) : [])];
    let hop2 = '';
    if (nev) {
      const later = group(nev.next).filter(([x]) => !shown.has(x));
      if (later.length) {
        const chips = later.map(([x, l2]) => {
          const xev = info(x);
          return `<li class="evc-kind-${xev?.kind ?? 'always'}"><span class="evc-hop-via">${escapeHtml(viaLabel(l2[0], nev, 'out'))}</span> ${eventLink(DMI, x)}</li>`;
        });
        hop2 =
          `<ul class="evc-hop2"><li class="evc-hop2-label">then</li>${chips.slice(0, MAX_HOP2).join('')}` +
          (chips.length > MAX_HOP2 ? `<li class="evc-hop2-more">+${chips.length - MAX_HOP2} more</li>` : '') +
          '</ul>';
      }
    }
    return `<div class="evc-branch">${node(DMI, nid, 'evc-next', labels)}${hop2}</div>`;
  });

  const cur = node(DMI, id, 'evc-cur', triggerBits(ev));
  return (
    '<section class="evc-map" aria-label="Story map">' +
    '<h3 class="evc-map-title">Story map</h3>' +
    head +
    (prev.length ? `<div class="evc-map-group">${groupLabel('Comes after', prevVia.common)}${capped(prev, MAX_PREV, 'evc-prev-more')}</div><div class="evc-arrow" aria-hidden="true"></div>` : '') +
    cur +
    (next.length ? `<div class="evc-arrow" aria-hidden="true"></div><div class="evc-map-group">${groupLabel('Leads to', nextVia.common)}${capped(next, MAX_NEXT, 'evc-next-more')}</div>` : '') +
    '</section>'
  );
}

/* ---- card -------------------------------------------------------------------------------- */

/** Renders the event card: legacy rows (with readable names) plus story, chance, code rows and the story map. */
export function renderEventCard(DMI: any, o: any): string {
  const ev: EventInfo | undefined = o?.ev;
  if (!ev) return o.renderOverlay(o);
  const map = storyMap(DMI, o);
  const { view, guesses } = legacyView(o, ev, !!map);
  let html: string = o.renderOverlay(view);

  // header: full title + rarity badge
  html = html.replace(
    `<div class="h2replace">${view.name}</div>`,
    `<div class="h2replace">${view.name}</div><div class="evc-head-badges">${kindBadge(ev)}${
      ev.storyEffective ? `<span class="evc-badge evc-story" title="Needs the “Story events” game setting">${escapeHtml(STORY_LABEL[ev.storyEffective])}</span>` : ''
    }${ev.unique ? `<span class="evc-badge">max ${ev.unique} per game</span>` : ''}</div>`,
  );

  // rarity row before the first spacer, own requirement/effect rows at the top of their sections
  const unknown = unknownOps(o);
  const rarity = row('rarity', 'rarity', kindBadge(ev), ` title="rarity ${escapeHtml(String(o.rarity))}"`);
  html = html.replace('<tr><th>&nbsp;</th></td>', rarity + '<tr><th>&nbsp;</th></td>');
  html = html.replace('<tr><th><u>Requirements:</u></th></td>', (m) => m + requirementRows(DMI, o, ev) + unknown.reqs.join(''));
  html = html.replace('<tr><th><u>Effects:</u></th></td>', (m) => m + effectRows(DMI, o, ev) + unknown.effs.join(''));

  // command names identified with medium/low confidence
  for (const [k, conf, op] of guesses) {
    html = html.replace(
      new RegExp(`<tr class="${k} ([^"]*)" ?> <th>`),
      `<tr class="${k} $1 evc-guess" title="Opcode ${op} identified as ${k.replace(/^req_/, '')} with ${conf} confidence"> <th>≈ `,
    );
  }

  if (map) {
    const end = html.lastIndexOf('\t</div></div> ');
    html = end >= 0 ? html.slice(0, end) + map + html.slice(end) : html + map;
  }
  return html;
}
