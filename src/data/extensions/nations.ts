// New in this app: a Nations page. Upstream had no nation list and its nation pane only showed the
// name and capital gems; the recruitment data computed by MNation.prepareData_PostMod is shown here.
import type { DMI } from '../load';

const SECTIONS: [string, string][] = [
  ['pretenders', 'Pretenders'],
  ['commanders', 'Commanders'],
  ['units', 'Troops'],
  ['capcommanders', 'Capital-only commanders'],
  ['capunits', 'Capital-only troops'],
  ['futurecapcommanders', 'Future-capital commanders'],
  ['futurecapunits', 'Future-capital troops'],
  ['foreigncommanders', 'Foreign commanders'],
  ['foreignunits', 'Foreign troops'],
  ['heroes', 'Heroes'],
  ['multiheroes', 'Multi-heroes'],
  ['forestcom', 'Forest commanders'],
  ['forestrec', 'Forest troops'],
  ['mountaincom', 'Mountain commanders'],
  ['mountainrec', 'Mountain troops'],
  ['swampcom', 'Swamp commanders'],
  ['swamprec', 'Swamp troops'],
  ['wastecom', 'Waste commanders'],
  ['wasterec', 'Waste troops'],
  ['cavecom', 'Cave commanders'],
  ['caverec', 'Cave troops'],
  ['plainscom', 'Plains commanders'],
  ['plainsrec', 'Plains troops'],
  ['coastcom', 'Coastal commanders'],
  ['coastrec', 'Coastal troops'],
  ['landcom', 'Land commanders'],
  ['landunit', 'Land troops'],
  ['uwcom', 'Underwater commanders'],
  ['uwunit', 'Underwater troops'],
];

export function installNationExtensions(DMI: DMI) {
  const { modctx, Utils, MNation } = DMI;
  const upstreamRender = MNation.renderOverlay;

  const refList = (ids: any[], ref: (id: any) => string) =>
    ids
      .filter((id) => id != null && id !== '')
      .map((id) => `<span>${ref(String(id).replace(/^#/, ''))}</span>`)
      .join('');

  const section = (title: string, body: string) =>
    body ? `<div class="nation-section"><h4>${title}</h4><div class="refs">${body}</div></div>` : '';

  const render = (o: any) => {
    let h = upstreamRender(o);
    let extra = '<div class="overlay-main nation-extra">';
    extra += `<p class="firstline">${o.epithet ? o.epithet + ' · ' : ''}${modctx_era(o)}</p>`;
    extra += section('Capital sites', refList(o.sites || [], (id) => Utils.siteRef(id)));
    extra += section('Future capital sites', refList(o.futuresites || [], (id) => Utils.siteRef(id)));
    for (const [key, title] of SECTIONS) {
      const ids = Array.isArray(o[key]) ? Array.from(new Set(o[key].map(String))) : [];
      extra += section(`${title} <span class="text-muted">(${ids.filter((x) => x && x !== 'null').length})</span>`, refList(ids.filter((x) => x !== 'null'), (id) => Utils.unitRef(id)));
    }
    extra += section('National spells', refList(o.spells || [], (id) => Utils.spellRef(id)));
    extra += '</div>';
    // insert before the final closing </div> of the upstream pane
    const i = h.lastIndexOf('</div>');
    h = i >= 0 ? h.slice(0, i) + extra + h.slice(i) : h + extra;
    return h;
  };

  function modctx_era(o: any) {
    return DMI.modconstants.eranames[o.era] ?? '';
  }

  MNation.renderOverlay = render;
  for (const o of modctx.nationdata) {
    o.renderOverlay = render;
    o.searchable = String(o.fullname || o.name || '').toLowerCase();
    o.erasort = parseInt(o.era) * 1000 + parseInt(o.id);
  }

  DMI.Nations = {
    grid: {
      page: 'nation',
      // only playable nations (the table also holds independents, special monsters and unused slots)
      data: () => modctx.nationdata.filter((o: any) => ['1', '2', '3'].includes(String(o.era)) && !/^nation_\d+$/.test(o.name)),
      columns: [
        { id: 'name', width: 140, name: 'Nation', field: 'name', sortable: true, sortCmp: 'text' },
        { id: 'epithet', width: 160, name: 'Epithet', field: 'epithet', sortable: true, sortCmp: 'text' },
        {
          id: 'era',
          width: 50,
          name: 'Era',
          field: 'erasort',
          sortable: true,
          formatter: (_r: any, _c: any, _v: any, _d: any, o: any) => o.eracode || '',
        },
        {
          id: 'gems',
          width: 90,
          name: 'Capital gems',
          field: 'gems',
          sortable: true,
          formatter: (_r: any, _c: any, v: any) => DMI.Format.Gems(v || ''),
        },
      ],
      initialSort: 'era',
      getSearchArgs: (f: any) => ({
        str: (f.str || '').toLowerCase().trim(),
        era: f.era || '',
        properties: DMI.buildPropertyArgs(f.properties),
        customjs: f.customjs,
      }),
      searchFilter: (o: any, args: any) => {
        if (args.era && String(o.era) !== args.era) return false;
        if (!o.matchProperty) o.matchProperty = DMI.matchProperty;
        return DMI.basicSearchFilter(o, args);
      },
    },
  };
}
