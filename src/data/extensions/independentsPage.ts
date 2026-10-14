// New in this app: the Independents page. The grid (one row per population type), its filters and the detail
// pane are defined here, on top of the DMI.Independents read model (./independents). Only lists are shown:
// no probabilities anywhere.
import type { DMI } from '../load';
import type { Era, PathLetter, PoptypeInfo, Terrain, UnitRef } from './independents';

const TERRAIN_NAMES: Record<Terrain, string> = {
  deepsea: 'deep sea',
  sea: 'sea',
  cave: 'cave',
  farm: 'farm',
  forest: 'forest',
  mountain: 'mountain',
  swamp: 'swamp',
  waste: 'waste',
  plains: 'plains',
};
const ERA_NAMES: Record<Era, string> = { EA: 'Early era', MA: 'Middle era', LA: 'Late era' };
const PD_LEVELS = [1, 5, 10, 20];
/** The poptype's own PD commander only joins the defenders from this province defence level (measured in game). */
export const PD_COMMANDER_FROM = 20;

export const NOT_SHOWN_NOTE = 'The independent garrison you fight before conquest is generated separately and is not shown yet.';

export interface PoptypeRow {
  id: number;
  /** disambiguated label; also what displayName() and global search use */
  name: string;
  fullname: string;
  info: PoptypeInfo;
  searchable: string;
  recruits_txt: string;
  commanders_txt: string;
  mpaths_html: string;
  mpaths_sort: number;
  pdunits_txt: string;
  pdcom_txt: string;
  terrain_txt: string;
  recruits_sort: string;
  commanders_sort: string;
  pdunits_sort: string;
  pdcom_sort: string;
  terrain_sort: string;
  renderOverlay: (o: PoptypeRow) => string;
}

const esc = (s: unknown) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const terrainList = (list: Terrain[]) => list.map((t) => TERRAIN_NAMES[t]).join(', ');
const multText = (tenths: number) => String(tenths / 10);

/** Unit names for a table cell; names that repeat inside the list get their id ("Barbarian #140"). */
function unitNames(list: UnitRef[]): string[] {
  const seen = new Map<string, number>();
  for (const u of list) seen.set(u.name, (seen.get(u.name) ?? 0) + 1);
  return list.map((u) => (seen.get(u.name)! > 1 ? `${u.name} #${u.id}` : u.name));
}

/** Era names grouped by equal terrain lists: [["EA","MA","LA"], ["cave"]] */
function eraGroups(info: PoptypeInfo): { eras: Era[]; terrains: Terrain[] }[] {
  const groups: { eras: Era[]; terrains: Terrain[] }[] = [];
  for (const era of info.availability.eras) {
    const t = info.availability.byEra[era];
    const g = groups.find((x) => x.terrains.join() === t.join());
    if (g) g.eras.push(era);
    else groups.push({ eras: [era], terrains: t });
  }
  return groups;
}

export function installIndependentsPage(DMI: DMI): void {
  const { Utils, Format } = DMI;
  const api = DMI.Independents;

  const unitLink = (u: UnitRef): string => (u.unit ? Utils.unitRef(u.id) : `<span class="text-muted">${esc(u.name)}</span>`);

  const pathIcons = (letters: string) => Format.Paths(letters);

  /** Fixed paths of a commander with their levels, then its random picks (icons only, no chances). */
  const commanderPaths = (u: UnitRef): string => {
    if (!u.unit) return '';
    let h = '';
    for (const m of String(u.unit.mpath || '').matchAll(/([FAWESDNGBH])(-?\d+)/g)) {
      if (parseInt(m[2]) > 0) h += `<span class="pt-path">${pathIcons(m[1])}${m[2]}</span>`;
    }
    for (const r of u.unit.randompaths || []) {
      if (!(parseInt(r.chance) > 0)) continue;
      h += `<span class="pt-path pt-random" title="random pick">${pathIcons(String(r.paths).replace(/[^FAWESDNGBH]/g, ''))}</span>`;
    }
    return h;
  };

  const badge = (text: string, cls = '', title = '') =>
    `<span class="pt-badge ${cls}"${title ? ` title="${esc(title)}"` : ''}>${esc(text)}</span>`;

  const section = (title: string, body: string, cls = '') =>
    body ? `<div class="nation-section poptype-section ${cls}"><h4>${title}</h4>${body}</div>` : '';

  function pdSection(p: PoptypeInfo): string {
    const { units, commander, shadowed, unusedData } = p.pd;
    let body = '';
    if (!units.length) {
      body += '<p class="text-muted">No province defence troops defined.</p>';
    } else {
      const counts = PD_LEVELS.map((lv) => p.pdCounts(lv));
      body += '<table class="overlay-table pt-pd-table"><tr><th>Troops</th><th class="num" title="Troops per province defence point">per PD</th>';
      for (const lv of PD_LEVELS) body += `<th class="num">PD ${lv}</th>`;
      body += '</tr>';
      units.forEach((u, i) => {
        body +=
          `<tr><td>${unitLink(u.unit)}</td>` +
          `<td class="num"${u.multExplicit ? '' : ' title="no multiplier set: one troop per PD point"'}>${multText(u.mult)}</td>`;
        for (let j = 0; j < PD_LEVELS.length; j++) {
          const n = counts[j][i].count;
          body += `<td class="num${n === 0 ? ' text-muted' : ''}"${n === 0 ? ' title="absent at this PD"' : ''}>${n}</td>`;
        }
        body += '</tr>';
      });
      if (commander) {
        body += `<tr><td>${unitLink(commander.unit)} <span class="text-muted">(PD commander)</span></td><td class="num text-muted">&ndash;</td>`;
        for (const lv of PD_LEVELS) body += lv >= PD_COMMANDER_FROM ? '<td class="num">1</td>' : '<td class="num text-muted">&ndash;</td>';
        body += '</tr>';
      }
      body += '</table>';
      body += `<p class="pt-note">Troops = PD &times; multiplier / 10, rounded down. A group with 0 troops is absent at that PD.</p>`;
    }

    if (commander) {
      let line = `<span class="text-muted">PD commander (from PD ${PD_COMMANDER_FROM}):</span> ${unitLink(commander.unit)}`;
      if (commander.source === 'altPdCommander' && commander.overridesDefcom1) {
        line += ` <span class="text-muted">(overrides defcom1: ${unitLink(commander.overridesDefcom1)})</span>`;
      }
      if (commander.uncertain) {
        line += ' ' + badge('unverified', 'pt-warn', 'A mod edited this poptype; the engine-only override commander cannot be edited by mods, so this may not match the real game.');
      }
      body += `<p>${line}</p>`;
    } else {
      body += '<p class="text-muted">No PD commander defined.</p>';
    }
    body += `<p class="pt-note">Your nation also adds its own PD commander, and from PD ${PD_COMMANDER_FROM} (PD&minus;${PD_COMMANDER_FROM - 1}) of each of its own PD units.</p>`;

    const unusedBadge = (title: string) => badge('unverified', 'pt-warn', title);
    if (shadowed.length) {
      const items = shadowed
        .map((s) => `${esc(s.key)} ${s.unit ? (s.unit.unit ? Utils.unitRef(s.unit.id) : esc(s.unit.name)) : esc(s.value)}`)
        .join(', ');
      body += `<p class="pt-unused">unused data (the game uses the first entry): ${items} ${unusedBadge(p.verification.shadowedPd ?? 'a later duplicate of a key; the game reads the first one')}</p>`;
    }
    if (unusedData) {
      body += `<p class="pt-unused">unused data: key 230 ${unitLink(unusedData)} ${unusedBadge('Never seen among the defenders in game')}</p>`;
    }
    return section('Province defence (once you own it)', body);
  }

  function verificationHtml(p: PoptypeInfo): string {
    const v = p.verification;
    const chips: string[] = [];
    if (p.modded) {
      chips.push(badge(p.vanilla ? 'base game values, edited by a mod: not checked in game' : 'defined by a mod: not checked in game', 'pt-warn'));
    } else {
      chips.push(badge('recruits: ' + (v.recruits === 'extracted from exe' ? 'from game files, not checked in game' : v.recruits), 'pt-warn'));
      if (/^confirmed in game/.test(v.pd)) chips.push(badge('PD checked in game', 'pt-good'));
      else if (/^units confirmed in game/.test(v.pd)) chips.push(badge('PD units checked in game, commander not', 'pt-warn'));
      else chips.push(badge('PD from game files, not checked in game', 'pt-warn'));
      if (v.altPdCommander === 'confirmed in game') chips.push(badge('override PD commander checked in game', 'pt-good'));
    }
    return `<div class="pt-badges">${chips.join('')}</div>`;
  }

  function availabilityHtml(p: PoptypeInfo): string {
    const a = p.availability;
    if (a.never) return '<p class="text-muted">not placed by the random map generator</p>';
    let body = '';
    for (const g of eraGroups(p)) {
      body += `<p><span class="text-muted">${g.eras.join(', ')}:</span> ${esc(terrainList(g.terrains))}</p>`;
    }
    if (a.specialEras.length) {
      body += `<p class="text-muted">can also appear as a rare special in any land province (${a.specialEras.join('/')})</p>`;
    }
    return body;
  }

  function render(o: PoptypeRow): string {
    const p = o.info;
    const sub: string[] = [`Population type ${p.id}`];
    if (p.nameSource) sub.push(`name: ${esc(p.nameSource)}`);
    if (p.label !== p.name) sub.push(`official name &ldquo;${esc(p.name)}&rdquo;`);
    let h = '<div class="poptype overlay-contents">';
    h += `<div class="overlay-header" title="poptype id: ${p.id}"><div class="h2replace">${esc(p.label)}</div><p>${sub.join(' &middot; ')}</p></div>`;
    h += '<div class="overlay-main">';

    if (p.modded) {
      h += p.vanilla
        ? `<div class="modded pt-modbadge">modified by ${esc(p.modfiles.join(', '))}</div>`
        : `<div class="modded pt-modbadge">Poptype ${p.id} (mod: ${esc(p.modfiles.join(', '))})</div>`;
    }
    h += verificationHtml(p);

    h += section(
      `Recruitable units <span class="text-muted">(${p.recruits.length})</span>`,
      p.recruits.length ? `<div class="refs">${p.recruits.map((u) => `<span>${unitLink(u)}</span>`).join('')}</div>` : '<p class="text-muted">none</p>',
    );
    h += section(
      `Recruitable commanders <span class="text-muted">(${p.commanders.length})</span>`,
      p.commanders.length
        ? p.commanders.map((u) => `<div class="pt-commander">${unitLink(u)} ${commanderPaths(u)}</div>`).join('')
        : '<p class="text-muted">none</p>',
    );
    h += pdSection(p);
    h += section('Where it appears', availabilityHtml(p));

    h += `<p class="pt-note pt-garrison">${NOT_SHOWN_NOTE}</p>`;
    h += '<p class="pt-note">See also: <a href="#/merc">Mercenaries</a></p>';
    h += '</div></div>';
    return h;
  }

  /** Ref link to a poptype: same markup as the other entities' refs. */
  function poptypeRef(p: PoptypeInfo, text?: string): string {
    return `<span class="modding-inline refid">#${p.id}&nbsp;</span>${Utils.ref('poptype ' + p.id, esc(text ?? p.label))}`;
  }

  const makeRow = (p: PoptypeInfo): PoptypeRow => {
    const recruits = unitNames(p.recruits);
    const commanders = unitNames(p.commanders);
    const pdUnits = p.pd.units.map((u, i) => {
      const n = unitNames(p.pd.units.map((x) => x.unit))[i];
      return u.mult === 10 ? n : `${n} ×${multText(u.mult)}`;
    });
    const terrains = p.availability.terrains;
    const terrain_txt = terrains.length ? terrainList(terrains) : p.availability.specialEras.length ? 'special only' : '';
    const letters = p.paths.letters;
    const fixed = (Object.keys(p.paths.fixed) as PathLetter[]).join('');
    const randomOnly = letters.filter((l) => !fixed.includes(l)).join('');
    const mpaths_html =
      pathIcons(letters.filter((l) => fixed.includes(l)).join('')) +
      (randomOnly ? `<span class="pt-random" title="only as a random pick">${pathIcons(randomOnly)}</span>` : '');
    const pdcom = p.pd.commander?.unit.name ?? '';
    const row: PoptypeRow = {
      id: p.id,
      name: p.label,
      fullname: p.label,
      info: p,
      searchable: [
        p.label,
        p.name,
        ...p.recruits.map((u) => u.name),
        ...p.commanders.map((u) => u.name),
        ...p.pd.units.map((u) => u.unit.name),
        pdcom,
      ]
        .join('\n')
        .toLowerCase(),
      recruits_txt: recruits.join(', '),
      commanders_txt: commanders.join(', '),
      mpaths_html,
      mpaths_sort: letters.length,
      pdunits_txt: pdUnits.join(', '),
      pdcom_txt: pdcom,
      terrain_txt,
      recruits_sort: recruits.join(', ').toLowerCase(),
      commanders_sort: commanders.join(', ').toLowerCase(),
      pdunits_sort: pdUnits.join(', ').toLowerCase(),
      pdcom_sort: pdcom.toLowerCase(),
      terrain_sort: terrain_txt,
      renderOverlay: render,
    };
    return row;
  };

  const rows = api.all.map(makeRow);
  const lookup: Record<string, PoptypeRow> = Object.fromEntries(rows.map((r: PoptypeRow) => [String(r.id), r]));
  const titled = (field: string) => (_r: number, _c: number, _v: unknown, _d: unknown, o: any) => {
    const t = esc(o[field] ?? '');
    return t ? `<span title="${t}">${t}</span>` : '';
  };

  DMI.IndependentsPage = {
    rows,
    lookup,
    poptypeRef,
    grid: {
      page: 'independents',
      data: () => rows,
      columns: [
        { id: 'id', width: 36, name: 'Id', field: 'id', sortable: true, cssClass: 'numeric' },
        {
          id: 'name',
          width: 130,
          name: 'Name',
          field: 'name',
          sortable: true,
          sortCmp: 'text',
          formatter: (_r: number, _c: number, _v: unknown, _d: unknown, o: PoptypeRow) =>
            esc(o.name) + (o.info.modded ? ` <span class="pt-badge" title="${o.info.vanilla ? 'edited' : 'added'} by ${esc(o.info.modfiles.join(', '))}">${o.info.vanilla ? 'edited' : 'mod'}</span>` : ''),
        },
        { id: 'recruits', width: 110, name: 'Recruits', field: 'recruits_sort', sortable: true, sortCmp: 'text', formatter: titled('recruits_txt') },
        { id: 'commanders', width: 100, name: 'Commanders', field: 'commanders_sort', sortable: true, sortCmp: 'text', formatter: titled('commanders_txt') },
        {
          id: 'mpaths',
          width: 80,
          name: 'Mage paths',
          field: 'mpaths_sort',
          sortable: true,
          title: 'Paths of the recruitable commanders. Dimmed icons are only random picks',
          formatter: (_r: number, _c: number, _v: unknown, _d: unknown, o: PoptypeRow) => o.mpaths_html,
        },
        { id: 'pdunits', width: 110, name: 'PD units', field: 'pdunits_sort', sortable: true, sortCmp: 'text', title: 'Province defence troops; × is the per-PD multiplier', formatter: titled('pdunits_txt') },
        { id: 'pdcom', width: 90, name: 'PD commander', field: 'pdcom_sort', sortable: true, sortCmp: 'text', formatter: titled('pdcom_txt') },
        { id: 'terrain', width: 110, name: 'Terrain', field: 'terrain_sort', sortable: true, sortCmp: 'text', formatter: titled('terrain_txt') },
      ],
      initialSort: 'id',
      getSearchArgs: (f: any) => ({
        str: (f.str || '').toLowerCase().trim(),
        mpaths: f.mpaths || '',
        inclusive: !!f.inclusive,
        caster: f.caster || '',
        source: f.source || '',
        terrain: f.terrain || '',
        era: f.era || '',
        properties: DMI.buildPropertyArgs(f.properties),
        customjs: f.customjs,
      }),
      searchFilter: (o: PoptypeRow, args: any) => {
        const p = o.info;
        if (args.str && args.str === String(o.id)) return true; // typing an id ignores the other filters, like everywhere else
        if (args.str && !o.searchable.includes(args.str)) return false;
        if (args.mpaths) {
          const have: string[] = p.paths.letters;
          const want: string[] = args.mpaths.split('');
          if (!(args.inclusive ? want.some((l) => have.includes(l)) : want.every((l) => have.includes(l)))) return false;
        }
        if (args.caster === 'mage' && !p.isMage) return false;
        if (args.caster === 'priest' && !p.isPriest) return false;
        if (args.caster === 'none' && (p.isMage || p.isPriest)) return false;
        if (args.source === 'base' && p.modded) return false;
        if (args.source === 'edited' && !(p.vanilla && p.modded)) return false;
        if (args.source === 'added' && p.vanilla) return false;
        if (args.terrain === 'none') {
          if (!p.availability.never) return false;
        } else {
          const eras: Era[] = args.era ? [args.era] : p.availability.eras;
          if (args.terrain) {
            if (!eras.some((e) => p.availability.byEra[e as Era].includes(args.terrain))) return false;
          } else if (args.era) {
            if (!p.availability.byEra[args.era as Era].length && !p.availability.specialEras.includes(args.era)) return false;
          }
        }
        for (const prop of args.properties || []) {
          const r = DMI.matchProperty(o, prop.key, prop.comp, prop.val);
          if (prop.not ? r : !r) return false;
        }
        return DMI.customSearchFilter(o, args);
      },
    },
  };
}

/** Options for the terrain filter select, in the page's filter definition. */
export const TERRAIN_FILTER_OPTIONS = (Object.keys(TERRAIN_NAMES) as Terrain[]).map((t) => ({
  value: t,
  label: TERRAIN_NAMES[t][0].toUpperCase() + TERRAIN_NAMES[t].slice(1),
}));
export const ERA_FILTER_OPTIONS = (Object.keys(ERA_NAMES) as Era[]).map((e) => ({ value: e, label: ERA_NAMES[e] }));

/** Html for a unit's "Independents" section (where population types use it), or ''. */
export function renderUnitIndependents(DMI: DMI, o: any): string {
  const api = DMI.Independents;
  const page = DMI.IndependentsPage;
  if (!api || !page) return '';
  const u = api.byUnit(Math.floor(Number(o.id)));
  const line = (label: string, list: PoptypeInfo[]) =>
    list.length ? `<p><span class="text-muted">${label}</span> ${list.map((p) => `<span class="pt-ref">${page.poptypeRef(p)}</span>`).join(', ')}</p>` : '';
  const body =
    line('Recruitable in:', u.recruit) + line('Commander in:', u.commander) + line('Province defence in:', [...u.pdUnit, ...u.pdCommander.filter((p: PoptypeInfo) => !u.pdUnit.includes(p))]);
  return body ? `<div class="independents-section nation-section"><h4>Independents</h4>${body}</div>` : '';
}

/** Inserts the Independents back-links into a rendered unit pane, before the footer. */
export function withIndependents(DMI: DMI, o: any, html: string): string {
  if (!o || DMI.modctx.unitlookup[o.id] !== o) return html;
  const section = renderUnitIndependents(DMI, o);
  const at = html.indexOf('<div class="overlay-footer">');
  return section && at >= 0 ? html.slice(0, at) + section + html.slice(at) : html;
}
