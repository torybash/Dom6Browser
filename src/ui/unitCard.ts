// Restyles the upstream unit pane into a card modelled on the in-game unit window:
//   three icon+label+value stat columns with the sprite on the right, a row of item slot boxes,
//   a row of magic path and ability icons, weapons and armor side by side on a parchment strip,
//   then any remaining abilities and the description.
// Only layout changes: all upstream content (links, tooltips, advanced-mode classes) is kept, and
// abilities without an icon stay as regular text rows.
import {
  Anchor, Angry, Axe, BicepsFlexed, Biohazard, Bird, Bone, BookOpen, Brain, Bug, Castle, CircleDot, CloudLightning, Coins, Compass,
  Crosshair, Crown, Dna, Drama, Droplet, Droplets, Eye, EyeOff, Feather, Fish, Flag, Flame, Footprints, Gauge, Gem, Ghost, Hammer, Hand,
  HardHat, HeartPulse, Hexagon, Hourglass, Infinity as InfinityIcon, Leaf, Lock, Megaphone, Moon, Mountain, Pentagon,
  PersonStanding, ScanEye, Shield, ShieldHalf, Shirt, Skull, Snowflake, Sparkles, Sprout, Sun, Sword, Swords, Target, Tent,
  TreePine, Users, WandSparkles, Waves, Weight, Wheat, Wind, Wrench, Zap,
} from 'lucide-static';

type IconDef = [svg: string, color: string];

const Venus =
  '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="9" r="5"/><path d="M12 14v7M9 18h6"/></svg>';

/** Main stats (the three upstream stat tables). */
const STAT_ICONS: Record<string, IconDef> = {
  id: [Hexagon, '#8a8f99'],
  goldcost: [Coins, '#e2b33e'],
  hp: [Droplet, '#e0443a'],
  size: [PersonStanding, '#b9a98f'],
  prot: [Shield, '#a9b3bf'],
  mr: [Pentagon, '#c86ad8'],
  mor: [Flag, '#e8e2d4'],
  leader: [Megaphone, '#e0503f'],
  rcost: [Hammer, '#a5aeb9'],
  str: [BicepsFlexed, '#e58a3d'],
  att: [Sword, '#cfd4db'],
  def: [ShieldHalf, '#5d93df'],
  prec: [Crosshair, '#dca469'],
  ap: [Gauge, '#cdb48b'],
  magicleader: [WandSparkles, '#9a86ea'],
  rpcost: [Tent, '#e58a3d'],
  mapmove: [Footprints, '#cba66b'],
  enc: [Weight, '#a5aeb9'],
  maxage: [Hourglass, '#ddd5c7'],
  undeadleader: [Skull, '#b67fdd'],
};

/** Column of each main stat, following the in-game window. Unknown keys join the previous row's column. */
const STAT_COLUMN: Record<string, number> = {
  id: 0, goldcost: 0, hp: 0, size: 0, prot: 0, mr: 0, mor: 0, leader: 0,
  rcost: 1, str: 1, att: 1, def: 1, prec: 1, ap: 1, magicleader: 1,
  rpcost: 2, mapmove: 2, enc: 2, maxage: 2, undeadleader: 2,
};

/** Ability rows (key: value) shown as icon chips. */
const ABILITY_ICONS: Record<string, IconDef> = {
  fireres: [Flame, '#f07a2a'],
  coldres: [Snowflake, '#82d4f2'],
  shockres: [Zap, '#f2d443'],
  poisonres: [Biohazard, '#6fc24c'],
  acidres: [Droplets, '#a9d343'],
  diseaseres: [Bug, '#9fbf6a'],
  darkvision: [Eye, '#b3baff'],
  stealthy: [EyeOff, '#a5aeb9'],
  supplybonus: [Wheat, '#dcb84c'],
  fear: [Ghost, '#c7c7d6'],
  awe: [Sun, '#f2d483'],
  animalawe: [Sun, '#c9e08a'],
  berserk: [Angry, '#e5513f'],
  regeneration: [HeartPulse, '#e65d6c'],
  heat: [Flame, '#ff9147'],
  cold: [Snowflake, '#a8e4ff'],
  fireshield: [Flame, '#ff6a2a'],
  iceprot: [Snowflake, '#cdeeff'],
  poisoncloud: [Biohazard, '#93d04c'],
  poisonarmor: [Biohazard, '#5fae3c'],
  invulnerable: [ShieldHalf, '#f2f2f2'],
  siegebonus: [Castle, '#c5b08a'],
  castledef: [Castle, '#a5aeb9'],
  patrolbonus: [Compass, '#cba66b'],
  pillagebonus: [Coins, '#e58a3d'],
  mastersmith: [Hammer, '#e2b33e'],
  inspirational: [Megaphone, '#f2d483'],
  standard: [Flag, '#f2d483'],
  magicpower: [Sparkles, '#c86ad8'],
  firepower: [Flame, '#f07a2a'],
  coldpower: [Snowflake, '#82d4f2'],
  stormpower: [CloudLightning, '#f2d443'],
  darkpower: [Moon, '#9a86ea'],
  chaospower: [InfinityIcon, '#e5513f'],
  waterbreathing: [Waves, '#4f97df'],
  autohealer: [HeartPulse, '#66c486'],
  autodishealer: [Bug, '#66c486'],
  ambidextrous: [Swords, '#cfd4db'],
  heretic: [BookOpen, '#c96565'],
  douse: [Droplet, '#b3262a'],
  voidsanity: [Brain, '#b3baff'],
  taskmaster: [Hand, '#cba66b'],
  beastmaster: [Bird, '#c5b08a'],
  bodyguard: [ShieldHalf, '#cba66b'],
  formationfighter: [Users, '#a5aeb9'],
  skirmisher: [Wind, '#c7d6e0'],
  seduce: [Drama, '#e57fb8'],
  patience: [Hourglass, '#ddd5c7'],
  blind: [ScanEye, '#a5aeb9'],
  eyes: [Eye, '#ddd5c7'],
};

/** Boolean flags shown as icons (label in the tooltip). */
const FLAG_ICONS: Record<string, IconDef | 'holy'> = {
  holy: 'holy',
  female: [Venus, '#e88fb8'],
  neednoteat: [Leaf, '#9fbf6a'],
  forestsurvival: [TreePine, '#5fa556'],
  spiritsight: [Eye, '#b3baff'],
  amphibian: [Waves, '#4f97df'],
  pooramphibian: [Waves, '#7f9fbf'],
  aquatic: [Fish, '#4fb4df'],
  swimming: [Fish, '#7fc9e8'],
  flying: [Feather, '#e6e6e6'],
  float: [Feather, '#b3d4f2'],
  mountainsurvival: [Mountain, '#ad9d85'],
  wastesurvival: [Sun, '#e2b33e'],
  swampsurvival: [Sprout, '#7fa645'],
  snowmove: [Snowflake, '#e6f6ff'],
  magicbeing: [Sparkles, '#c86ad8'],
  undead: [Skull, '#b67fdd'],
  demon: [Flame, '#c83434'],
  inanimate: [Wrench, '#a5aeb9'],
  stonebeing: [Mountain, '#8a8f99'],
  animal: [Bone, '#dccb9f'],
  mind: [Brain, '#8a8f99'],
  coldblood: [Dna, '#6fc2a8'],
  ethereal: [Ghost, '#c7d6ff'],
  spiritform: [Ghost, '#9aa8d6'],
  pierceres: [Target, '#cfd4db'],
  bluntres: [Hammer, '#cfd4db'],
  slashres: [Axe, '#cfd4db'],
  heal: [HeartPulse, '#66c486'],
  noheal: [HeartPulse, '#7a7f88'],
  trample: [Footprints, '#cba66b'],
  stormimmune: [CloudLightning, '#c7d6e0'],
  immobile: [Anchor, '#a5aeb9'],
  truesight: [ScanEye, '#f2d483'],
  immortal: [InfinityIcon, '#f2d483'],
  glamour: [Drama, '#c79ae0'],
  illusion: [Drama, '#c79ae0'],
  spy: [EyeOff, '#a5aeb9'],
  unseen: [EyeOff, '#c7c7d6'],
  assassin: [Sword, '#c83434'],
  teleport: [Sparkles, '#82d4f2'],
  slave: [Lock, '#8a8f99'],
  undisciplined: [Angry, '#c9a46a'],
};

/** Item slot words from the "item slots" row. */
const SLOT_ICONS: [RegExp, string, string][] = [
  [/hand/, Sword, 'hand'],
  [/bow/, Crosshair, 'bow (missile weapon)'],
  [/crown/, Crown, 'crown'],
  [/head/, HardHat, 'head'],
  [/body/, Shirt, 'body'],
  [/feet/, Footprints, 'feet'],
  [/misc/, Gem, 'miscellaneous'],
];

const icon = ([svg, color]: IconDef, cls = 'uicon') =>
  `<span class="${cls}" style="color:${color}">${svg.replace(/width="24"/, 'width="1em"').replace(/height="24"/, 'height="1em"')}</span>`;

const holyIcon = '<span class="uicon"><span class="abilityicon holy">&nbsp;</span></span>';

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
      icon(STAT_ICONS[key] ?? [CircleDot, '#8a8f99']) +
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
        bar.appendChild(el('span', 'uslot', slot ? icon([slot[1], 'currentColor'], 'uicon') : `<span class="text-[10px]">${word}</span>`)).title = slot ? slot[2] : word;
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
    const chip = el('span', 'uchip', icon(def) + `<span class="uchip-label">${label}</span><span class="stat-value">${td.innerHTML}</span>`);
    chip.dataset.key = key;
    chip.title = `${label}: ${td.textContent?.trim()}` + (tr.title ? `\n${tr.title}` : '');
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
    const chip = el('span', 'uchip uflag', (def === 'holy' ? holyIcon : icon(def)) + `<span class="uchip-label">${name}</span>`);
    chip.dataset.key = key;
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
