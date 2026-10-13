# Dom6 Browser

A reference browser for Illwinter's **Dominions 6**: units, spells, items, sites, mercenaries, events,
nations, weapons and armor, with mod (`.dm`) support. It is a rebuild of
[larzm42/dom6inspector](https://github.com/larzm42/dom6inspector) with a new interface. The game data and
the data-derivation logic come from that project, so this project is also licensed under **GPLv3**.

**Live site:** https://torybash.github.io/Dom6Browser/ (deployed from `master` by
`.github/workflows/deploy.yml`, which syncs the game data, runs the tests and builds).

## Running it

```bash
npm install
npm run sync      # fetches the upstream repo at the pinned commit (upstream.json) into vendor/ and copies
                  # gamedata/ + images/ into public/
npm run dev       # http://localhost:5173
```

`npm run build && npm run preview` serves a production build.

## What's different from the original

- **3-pane workspace.** Pages and filters sit on the left, a virtualized sortable table in the middle,
  and a docked detail panel on the right with back/forward history. This replaces the draggable popups.
- **Unit cards modelled on the in-game window.** Stats, item slots and abilities use the game's own icons,
  the sprite sits on the right, and there is a row of path/ability icons. Weapons and armor share a parchment strip.
- **Hover previews** for every link. **Shift+click** a link or row to pin it; **Compare** shows pinned
  entries side by side and highlights the values that differ.
- **Global search (Ctrl+K or /)** across every entity type.
- **The URL holds the whole view:** page, filters, sort, selection and pins. Any view can be bookmarked
  or shared, and the last view is restored on the next visit.
- **A Nations page** with recruitment lists, pretenders, heroes, capital sites and national spells.
- **Calculated values the game shows but the data files don't hold:** patrol strength, siege strength,
  siege defence, supply usage, upkeep and casting encumbrance. They appear in a Calculated section on
  unit cards, as optional table columns (column picker) and as min/max filters. Each value has its
  formula and source in a tooltip, and values not yet confirmed against the game are marked with ≈.
- **Mods are stored in IndexedDB.** You can reorder, enable or disable them, and parser errors and
  warnings are listed with line numbers.
- Light and dark themes, adjustable text size, and a mobile layout with bottom tabs and filter sheets.
- **Advanced options** in the settings menu: ids, mod commands, more info, database keys, property
  filters (`!`, `=~`, `==`, `>=`, `<=`) and an optional custom JS filter.

## How it is built

| Path | What |
| --- | --- |
| `src/data/legacy/` | Near-mechanical TypeScript port of upstream `scripts/DMI/*.js`, `parsemod.js` and `modconstants.js`. Data preparation, mod parsing and the html detail renderers are kept as-is; jQuery, the DOM and SlickGrid are removed. |
| `src/data/extensions/derived/` | Calculated unit values: pure formula functions (`formulas.ts`), their labels, confidence and sources (`registry.ts`), and how they read legacy unit fields (`inputs.ts`). Exposed on units as non-enumerable `calc_*` properties, so legacy code and the golden suite never see them. |
| `src/data/load.ts` | The loading pipeline (TSV tables → PreMod → mods → PostMod). It builds a fresh namespace for every load. |
| `src/ui/` | React UI. `legacy.ts` and `unitCard.ts` restyle the upstream html in the DOM without changing its content. |
| `public/gameicons/` | Stat, item-slot and ability icons extracted from the game's `.trs` texture archives with `scripts/extract-trs.py --unit-icons <Dominions6/data> public/gameicons`. Unlike `public/images/`, these are committed. |
| `tests/golden/` | Runs the **original** upstream scripts in jsdom and records every entity's derived fields and detail html. |

### Tests

```bash
npm test             # unit + parity tests
npm run golden       # regenerate golden fixtures from upstream (needs `npm run sync`)
npm run lint && npm run lint:legacy
```

The golden suite checks that, for vanilla data and for a test mod, the port produces the same derived
data and detail html as upstream for all ~12,000 entities.

`tests/fixtures/ingame-values.json` holds values read in the game itself (Dominions 6.37), and the
calculated values are tested against them. Entries marked `known` are mismatches with a recorded cause;
they run as expected failures, so a formula change that fixes one shows up. Intentional differences, such as markup for
the mod-command toggle, are normalised in `tests/golden/normalize.mjs`.
