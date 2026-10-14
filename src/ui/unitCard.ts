// Restyles the upstream unit pane into a card modelled on the in-game unit window:
//   three icon+label+value stat columns with the sprite on the right, a row of item slot boxes,
//   a row of magic path and ability icons, weapons and armor side by side on a parchment strip,
//   then any remaining abilities and the description.
// Only layout changes: all upstream content (links, tooltips, advanced-mode classes) is kept, and
// abilities without an icon stay as regular text rows.
import {
  Anchor, Bird, BookOpen, Bug, CircleDot, CloudLightning, Drama, Droplets, Eye, Feather, Ghost,
  Hammer, HeartPulse, Hexagon, Hourglass, Infinity as InfinityIcon, Mountain, Snowflake, Sparkles,
  Sun, Waves, Wind,
} from 'lucide-static';

type IconDef = [svg: string, color: string];
/** 'game': use the in-game icon public/gameicons/abil-<key>.png */
type ChipIcon = IconDef | 'game';

const Venus =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="9" r="5"/><path d="M12 14v7M9 18h6"/></svg>';

/** Main stats (the three upstream stat tables) with an in-game icon, public/gameicons/stat-<key>.png. */
const GAME_STAT_ICONS = new Set([
  'goldcost', 'hp', 'size', 'prot', 'mr', 'mor', 'leader', 'rcost', 'str', 'att', 'def', 'prec', 'ap',
  'magicleader', 'rpcost', 'mapmove', 'enc', 'maxage', 'undeadleader',
]);

/** Column of each main stat, following the in-game window. Unknown keys join the previous row's column. */
const STAT_COLUMN: Record<string, number> = {
  id: 0, goldcost: 0, hp: 0, size: 0, prot: 0, mr: 0, mor: 0, leader: 0,
  rcost: 1, str: 1, att: 1, def: 1, prec: 1, ap: 1, magicleader: 1,
  rpcost: 2, mapmove: 2, enc: 2, maxage: 2, undeadleader: 2,
};

/** Ability rows (key: value) shown as icon chips. */
const ABILITY_ICONS: Record<string, ChipIcon> = {
  fireres: 'game',
  coldres: 'game',
  shockres: 'game',
  poisonres: 'game',
  acidres: [Droplets, '#a9d343'],
  diseaseres: 'game',
  darkvision: 'game',
  stealthy: 'game',
  supplybonus: 'game',
  fear: 'game',
  awe: 'game',
  animalawe: [Sun, '#c9e08a'],
  berserk: 'game',
  regeneration: 'game',
  heat: 'game',
  cold: 'game',
  fireshield: 'game',
  iceprot: 'game',
  poisoncloud: 'game',
  poisonarmor: 'game',
  invulnerable: 'game',
  siegebonus: 'game',
  castledef: 'game',
  patrolbonus: 'game',
  pillagebonus: 'game',
  mastersmith: 'game',
  inspirational: 'game',
  standard: 'game',
  magicpower: 'game',
  firepower: 'game',
  coldpower: [Snowflake, '#82d4f2'],
  stormpower: [CloudLightning, '#f2d443'],
  darkpower: 'game',
  chaospower: 'game',
  waterbreathing: [Waves, '#4f97df'],
  autohealer: [HeartPulse, '#66c486'],
  autodishealer: [Bug, '#66c486'],
  ambidextrous: 'game',
  heretic: [BookOpen, '#c96565'],
  douse: 'game',
  voidsanity: 'game',
  taskmaster: 'game',
  beastmaster: [Bird, '#c5b08a'],
  bodyguard: 'game',
  formationfighter: 'game',
  skirmisher: [Wind, '#c7d6e0'],
  seduce: 'game',
  patience: [Hourglass, '#ddd5c7'],
  blind: 'game',
  eyes: [Eye, '#ddd5c7'],
};

/** Abilities with a crossed-out in-game icon for negative values ("Susceptible to Fire"), public/gameicons/neg-<key>.png. */
const NEGATIVE_ICON = new Set(['fireres', 'coldres', 'shockres', 'poisonres', 'acidres', 'patrolbonus', 'inspirational']);

/** Boolean flags shown as icons (label in the tooltip). */
const FLAG_ICONS: Record<string, ChipIcon> = {
  holy: 'game',
  female: [Venus, '#e88fb8'],
  neednoteat: 'game',
  forestsurvival: 'game',
  spiritsight: 'game',
  amphibian: 'game',
  pooramphibian: 'game',
  aquatic: 'game',
  swimming: 'game',
  flying: 'game',
  float: [Feather, '#b3d4f2'],
  mountainsurvival: 'game',
  wastesurvival: 'game',
  swampsurvival: 'game',
  snowmove: 'game',
  magicbeing: 'game',
  undead: 'game',
  demon: 'game',
  inanimate: 'game',
  stonebeing: [Mountain, '#8a8f99'],
  animal: 'game',
  mind: 'game',
  coldblood: 'game',
  ethereal: 'game',
  spiritform: [Ghost, '#9aa8d6'],
  pierceres: 'game',
  bluntres: [Hammer, '#cfd4db'],
  slashres: 'game',
  heal: 'game',
  noheal: 'game',
  trample: 'game',
  stormimmune: 'game',
  immobile: [Anchor, '#a5aeb9'],
  truesight: 'game',
  immortal: [InfinityIcon, '#f2d483'],
  glamour: 'game',
  illusion: [Drama, '#c79ae0'],
  spy: 'game',
  unseen: 'game',
  assassin: 'game',
  teleport: [Sparkles, '#82d4f2'],
  slave: 'game',
  undisciplined: 'game',
};

/** Item slot words from the "item slots" row -> in-game icon (public/gameicons/slot-<name>.png), tooltip. */
const SLOT_ICONS: [RegExp, string, string][] = [
  [/hand/, 'hand', 'hand'],
  [/bow/, 'bow', 'bow (missile weapon)'],
  [/crown/, 'head', 'crown'],
  [/head/, 'head', 'head'],
  [/body/, 'body', 'body'],
  [/feet/, 'feet', 'feet'],
  [/misc/, 'misc', 'miscellaneous'],
];

const icon = ([svg, color]: IconDef, cls = 'uicon') =>
  `<span class="${cls}" style="color:${color}">${svg.replace(/width="24"/, 'width="1em"').replace(/height="24"/, 'height="1em"')}</span>`;

const gameIcon = (name: string) => `<span class="uicon gicon"><img src="gameicons/${name}.png" alt=""></span>`;

const chipIcon = (key: string, def: ChipIcon) => (def === 'game' ? gameIcon('abil-' + key) : icon(def));

const rowKey = (el: Element) => (el.getAttribute('class') ?? '').trim().split(/\s+/)[0];

function el(tag: string, cls: string, html = '') {
  const e = document.createElement(tag);
  e.className = cls;
  e.innerHTML = html;
  return e;
}

export function enhanceUnitCard(main: HTMLElement) {
  const statTable = main.querySelector(':scope > table.overlay-table');
  if (!statTable || !statTable.querySelector('table') || main.dataset.card) return;
  main.dataset.card = '1';
  const card = el('div', 'ucard');

  /* ---- top: stat columns + sprite ---- */
  const top = el('div', 'ucard-top');
  // (the upstream html nests three tables in a malformed way, so columns are assigned by key)
  const columns = [el('div', 'ucol'), el('div', 'ucol'), el('div', 'ucol')];
  let col = 0;
  statTable.querySelectorAll('tr').forEach((tr) => {
    const th = tr.querySelector(':scope > th');
    const td = tr.querySelector(':scope > td');
    if (!th || !td || td.querySelector('table')) return;
    const key = rowKey(tr);
    col = STAT_COLUMN[key] ?? col;
    const row = el('div', 'ustat' + (tr.classList.contains('hidden-row') ? ' hidden-row' : ''));
    row.dataset.key = key;
    const title = tr.getAttribute('title');
    if (title) row.title = title.trim();
    const label = th.innerHTML.replace(/:\s*$/, '');
    // renderDetailsRows2 puts the [key] span in the next row
    const keySpan = tr.nextElementSibling?.querySelector(':scope > th > .internal-inline');
    row.innerHTML =
      (GAME_STAT_ICONS.has(key) ? gameIcon('stat-' + key) : icon([key === 'id' ? Hexagon : CircleDot, '#8a8f99'])) +
      `<span class="ustat-label">${label}${keySpan ? keySpan.outerHTML : ''}</span>` +
      `<span class="stat-value">${td.innerHTML}</span>`;
    columns[col].appendChild(row);
  });
  columns.forEach((c) => c.childElementCount && top.appendChild(c));

  const sprites = Array.from(main.querySelectorAll<HTMLImageElement>(':scope > img.unit-sprite'));
  const spriteBox = el('div', 'usprite');
  sprites.forEach((img) => spriteBox.appendChild(img));
  top.appendChild(spriteBox);
  card.appendChild(top);
  statTable.remove();

  /* ---- item slots ---- */
  const slotsRow = main.querySelector('tr.slots');
  if (slotsRow) {
    const text = slotsRow.querySelector('td')?.textContent ?? '';
    const bar = el('div', 'uslots');
    bar.dataset.key = 'slots';
    for (const part of text.split(',').map((s) => s.trim()).filter(Boolean)) {
      const m = /^(\d+)\s+(.*)$/.exec(part);
      const n = m ? Math.min(6, parseInt(m[1])) : 1;
      const word = m ? m[2] : part;
      const slot = SLOT_ICONS.find(([re]) => re.test(word));
      for (let i = 0; i < n; i++) {
        // like the in-game window, the second hand slot shows a shield
        const name = slot && (slot[1] === 'hand' && i === 1 ? 'offhand' : slot[1]);
        bar.appendChild(el('span', 'uslot', name ? gameIcon('slot-' + name) : `<span class="text-[10px]">${word}</span>`)).title = slot ? slot[2] : word;
      }
    }
    bar.appendChild(el('span', 'stat-value uslots-text', text));
    card.appendChild(bar);
    slotsRow.remove();
  }

  /* ---- magic paths + ability icons ---- */
  const iconsRow = el('div', 'uicons');
  const mpath = main.querySelector('tr.mpath');
  if (mpath) {
    const paths = el('span', 'upaths', mpath.querySelector('td')?.innerHTML ?? '');
    paths.dataset.key = 'mpath';
    paths.title = 'Magic paths';
    iconsRow.appendChild(paths);
    mpath.remove();
  }
  main.querySelectorAll<HTMLTableRowElement>('table.overlay-table tr[class]').forEach((tr) => {
    const key = rowKey(tr);
    const def = ABILITY_ICONS[key];
    const th = tr.querySelector(':scope > th');
    const td = tr.querySelector(':scope > td');
    if (!def || !th || !td || td.querySelector('a, table')) return;
    const label = (th.textContent ?? key).replace(/\[.*?\]/, '').replace(/:\s*$/, '').trim();
    // like the game, a negative value (e.g. "susceptible to fire") shows a crossed-out icon
    const negative = NEGATIVE_ICON.has(key) && parseFloat(td.textContent ?? '') < 0;
    const chip = el('span', 'uchip', (negative ? gameIcon('neg-' + key) : chipIcon(key, def)) + `<span class="stat-value">${td.innerHTML}</span>`);
    chip.dataset.key = key;
    chip.title = `${label}: ${td.textContent?.trim()}` + (tr.title ? `\n${tr.title}` : '');
    chip.setAttribute('aria-label', chip.title);
    const keySpan = th.querySelector('.internal-inline');
    if (keySpan) chip.appendChild(keySpan.cloneNode(true));
    iconsRow.appendChild(chip);
    tr.remove();
  });
  const flagParents = new Set<HTMLElement>();
  main.querySelectorAll<HTMLElement>('span.flag[title]').forEach((f) => {
    const key = f.getAttribute('title')!;
    const def = FLAG_ICONS[key];
    if (!def) return;
    if (f.parentElement) flagParents.add(f.parentElement);
    const label = (f.firstChild?.textContent ?? key).replace(/-/g, ' ').trim();
    const name = label.charAt(0).toUpperCase() + label.slice(1);
    const chip = el('span', 'uchip uflag', chipIcon(key, def));
    chip.dataset.key = key;
    chip.title = name;
    chip.setAttribute('aria-label', name);
    const keySpan = f.querySelector('.internal-inline');
    if (keySpan) chip.appendChild(keySpan.cloneNode(true));
    iconsRow.appendChild(chip);
    f.remove();
  });
  // remove the "(", ", " and ")" separators left behind; drop containers that became empty
  flagParents.forEach((p) => {
    Array.from(p.childNodes).forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE && /^[\s(),]*$/.test(n.textContent ?? '')) n.remove();
    });
    if (!p.textContent?.trim() && !p.querySelector('img')) p.remove();
  });
  if (iconsRow.childElementCount) card.appendChild(iconsRow);

  /* ---- weapons | armor ---- */
  const equip = Array.from(main.querySelectorAll<HTMLTableElement>('table.overlay-table')).filter((t) => {
    const first = t.rows[0]?.cells[0]?.textContent?.trim();
    return first === 'Weapon' || first === 'Armor';
  });
  if (equip.length) {
    const strip = el('div', 'uequip');
    equip.forEach((t) => {
      t.classList.add('equip-table');
      strip.appendChild(t);
    });
    card.appendChild(strip);
  }

  main.prepend(card);

  // drop rows/tables emptied by the moves above
  main.querySelectorAll('table.overlay-table').forEach((t) => {
    if (!t.closest('.ucard') && !t.querySelector('tr td, tr th')) t.remove();
  });
}
