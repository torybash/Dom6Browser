// Page registry: every browsable entity type, its upstream grid module and its filter controls.
// Filter keys and option values mirror upstream index.html so the ported searchFilter()s work as-is.
import type { LucideIcon } from 'lucide-react';
import { Crown, Flag, Gem, MapPin, ScrollText, Shield, Sparkles, Swords, Tent, Users, Coins } from 'lucide-react';
import { ERA_FILTER_OPTIONS, TERRAIN_FILTER_OPTIONS } from './data/extensions/independentsPage';
import { KIND_OPTIONS, REWARD_OPTIONS, ROLE_OPTIONS, TRIGGER_OPTIONS, storylineOptions, type ChipOption } from './data/extensions/eventsGrid';

export type PageId = 'unit' | 'spell' | 'item' | 'site' | 'merc' | 'event' | 'nation' | 'wpn' | 'armor' | 'independents';

export interface SelectOption {
  value: string;
  label: string;
  title?: string;
  divider?: boolean;
}

export type FilterDef =
  | { type: 'nation'; key: string }
  | { type: 'select'; key: string; label: string; options: SelectOption[] }
  | { type: 'paths'; key: string; paths: string; icon: 'Path' | 'Gem'; label: string; inclusiveKey?: string }
  | { type: 'pathLevels'; key: string; paths: string; label: string }
  | { type: 'scope'; nationalKey: string; genericKey: string }
  | { type: 'number'; key: string; label: string; title: string; mask?: boolean; moreInfo?: boolean }
  /** min/max ranges for calculated unit values (src/data/extensions/derived) */
  | { type: 'calculated' }
  /** one choice from a few, shown as a segmented control ('' = default) */
  | { type: 'segmented'; key: string; label: string; options: SelectOption[]; hint?: string }
  /** any number of choices as toggle chips; stored comma-separated in one key */
  | { type: 'multi'; key: string; label: string; options: ChipOption[]; hint?: string }
  /** a select whose options come from the loaded data */
  | { type: 'dataSelect'; key: string; label: string; options: (DMI: any) => SelectOption[]; hint?: string }
  /** a number range stored as "min~max", or a single number with `single` */
  | { type: 'range'; key: string; label: string; hint?: string; single?: boolean; placeholder?: string };

export interface PageDef {
  id: PageId;
  label: string;
  singular: string;
  icon: LucideIcon;
  /** DMI module holding `.grid` (upstream CGrid replacement); nations use a grid defined in the app. */
  module: string;
  /** Ref prefix used by upstream ref links ("unit 12"). */
  refKind: string;
  group: 'main' | 'reference';
  filters: FilterDef[];
  /** Small image for the table/search results. */
  thumb?: (o: any, DMI: any) => string | undefined;
}

const UNIT_TYPES = {
  available:
    'cmdr (cap only),cmdr (future cap only),cmdr (foreign),cmdr (forest),cmdr (mountain),cmdr (swamp),cmdr (waste),cmdr (plains), cmdr (cave),cmdr (coast),cmdr (land),commander,Commander,cmdr (Magic site),cmdr (Summon),cmdr (Battle Summon),cmdr (u-water),Mage (Magic site),Mage (Summon),Mage,Priest (Magic site),Priest (Summon),Scout (Summon),unit (cap only),unit (future cap only),unit,Unit,unit (u-water),unit (Summon),Unit (Battle Summon),Unit (Magic site),unit (foreign),unit (forest),unit (mountain),unit (swamp),unit (waste),unit (plains),unit (cave),unit (coast),unit (land)',
  recruitable:
    'cmdr (cap only),cmdr (future cap only),cmdr (foreign),cmdr (forest),cmdr (mountain),cmdr (swamp),cmdr (waste),cmdr (plains),cmdr (cave),cmdr (coast),cmdr (land),commander,Commander,cmdr (u-water),unit (cap only),unit (future cap only),unit,Unit,unit (u-water),unit (foreign),unit (forest),unit (mountain),unit (swamp),unit (waste),unit (plains),unit (cave),unit (coast),unit (land)',
  commanders:
    'cmdr (cap only),cmdr (future cap only),cmdr (foreign),cmdr (forest),cmdr (mountain),cmdr (swamp),cmdr (waste),cmdr (plains),cmdr (cave),cmdr (coast),commander,Commander,cmdr (Recruitment),cmdr (Magic site),cmdr (Prophetization),cmdr (Special),cmdr (Summon),cmdr (Wish),cmdr (item),cmdr (Mercenary),cmdr (mercenary),cmdr (Battle Summon),cmdr (Event),cmdr (?),cmdr (u-water),Mage (Recruitment),Mage (Magic site),Mage (Prophetization),Mage (Special),Mage (Summon),Mage (item),Mage (Event),Mage (ritual),Mage (?),Mage,Priest (Event),Priest (Freespawn),Priest (Magic site),Priest (Recruitment),Priest (Summon),priest (Prophetization),Scout (Recruitment),Scout (Summon)',
  units:
    'unit (cap only),unit (future cap only),unit (foreign),unit (forest),unit (mountain),unit (swamp),unit (waste),unit (plains),unit (cave),unit (coast),unit,Unit,unit (u-water),Unit (Recruitment),Unit (Summon),Unit (Battle Summon),Unit (Event),Unit (Freespawn),Unit (Magic site),Unit (Mercenary),Unit (mercenary),Unit (Special),Unit (?)',
  summoned:
    'Commander (Summon),Mage (Summon),Priest (Summon),Scout (Summon),Unit (Summon),Horror (Summon),horror (Summon),cmdr (Summon),unit (Summon)',
  pretenders: 'Pretender',
  heroes: 'hero (unique),hero (multi),Hero (Event),Hero (item)',
};

/** Unit type select: values are short ids in the URL, expanded to upstream typechar lists. */
export const UNIT_TYPE_VALUES: Record<string, string> = UNIT_TYPES;

export const ALL_PATHS = 'FAWESDNGBH';

export const PAGES: PageDef[] = [
  {
    id: 'unit',
    label: 'Units',
    singular: 'Unit',
    icon: Users,
    module: 'MUnit',
    refKind: 'unit',
    group: 'main',
    filters: [
      { type: 'nation', key: 'nation' },
      {
        type: 'select',
        key: 'types',
        label: 'Type',
        options: [
          { value: '', label: 'All units' },
          { value: 'available', label: 'Available', title: 'units available via recruitment/summoning' },
          { value: 'recruitable', label: 'Recruitable', title: 'units recruitable in capital or provinces' },
          { value: '-', label: '', divider: true },
          { value: 'commanders', label: 'Commanders' },
          { value: 'units', label: 'Units' },
          { value: 'summoned', label: 'Summoned' },
          { value: '--', label: '', divider: true },
          { value: 'pretenders', label: 'Pretenders' },
          { value: 'heroes', label: 'Heroes' },
        ],
      },
      { type: 'scope', nationalKey: 'national', genericKey: 'generic' },
      { type: 'calculated' },
    ],
    thumb: (o, DMI) => {
      DMI.MUnit.prepareForRender(o);
      return o.sprite?.url1;
    },
  },
  {
    id: 'spell',
    label: 'Spells',
    singular: 'Spell',
    icon: Sparkles,
    module: 'MSpell',
    refKind: 'spell',
    group: 'main',
    filters: [
      { type: 'nation', key: 'nation' },
      {
        type: 'select',
        key: 'schools',
        label: 'School',
        options: [
          { value: '', label: 'All schools' },
          { value: '-', label: '', divider: true },
          { value: '0', label: 'Conjuration' },
          { value: '1', label: 'Alteration' },
          { value: '2', label: 'Evocation' },
          { value: '3', label: 'Construction' },
          { value: '4', label: 'Enchantment' },
          { value: '5', label: 'Thaumaturgy' },
          { value: '6', label: 'Blood' },
          { value: '7', label: 'Divine' },
          { value: '--', label: '', divider: true },
          { value: '-1', label: 'Unresearchable' },
          { value: '-1,0,1,2,3,4,5,6,7', label: 'Any (incl. unresearchable)' },
        ],
      },
      {
        type: 'select',
        key: 'type',
        label: 'Kind',
        options: [
          { value: '', label: 'Ritual & combat' },
          { value: 'Ritual', label: 'Rituals' },
          { value: 'Combat', label: 'Combat spells' },
        ],
      },
      {
        type: 'select',
        key: 'aquatic',
        label: 'Where',
        options: [
          { value: '', label: 'Underwater & land' },
          { value: 'uw', label: 'Works underwater' },
          { value: 'land', label: 'Works on dry land' },
        ],
      },
      {
        type: 'select',
        key: 'summons',
        label: 'Summons',
        options: [
          { value: '', label: 'Any spell' },
          { value: 'any', label: 'Summons anything' },
          { value: 'cmdr', label: 'Summons commanders' },
          { value: 'unit', label: 'Summons units' },
          { value: 'temp', label: 'Summons temporary/attackers' },
          { value: 'none', label: 'No summons' },
        ],
      },
      { type: 'scope', nationalKey: 'national', genericKey: 'generic' },
      { type: 'paths', key: 'mpaths', paths: ALL_PATHS, icon: 'Path', label: 'Paths', inclusiveKey: 'inclusive' },
      { type: 'pathLevels', key: 'mlevels', paths: ALL_PATHS, label: 'Max path level' },
      { type: 'number', key: 'effect', label: 'Effect no', title: 'find spells that use a specific effect', moreInfo: true },
      { type: 'number', key: 'effect_mask', label: 'Damage mask', title: 'match masks on damage (use effect no 10 / 11 / 23). Numpad +/- doubles/halves', mask: true, moreInfo: true },
      { type: 'number', key: 'special_mask', label: 'Spec mask', title: 'match masks on special. Numpad +/- doubles/halves', mask: true, moreInfo: true },
    ],
  },
  {
    id: 'item',
    label: 'Items',
    singular: 'Item',
    icon: Crown,
    module: 'MItem',
    refKind: 'item',
    group: 'main',
    filters: [
      { type: 'nation', key: 'nation' },
      {
        type: 'select',
        key: 'type',
        label: 'Type',
        options: [
          { value: '', label: 'All item types' },
          { value: '-', label: '', divider: true },
          { value: 'misc', label: 'Miscellaneous' },
          { value: 'helm', label: 'Helmets' },
          { value: 'crown', label: 'Crowns' },
          { value: 'armor', label: 'Armor' },
          { value: 'shield', label: 'Shields' },
          { value: 'boots', label: 'Boots' },
          { value: '1-h wpn', label: '1-h weapons' },
          { value: '2-h wpn', label: '2-h weapons' },
          { value: 'missile', label: 'Missile' },
          { value: 'barding', label: 'Barding' },
          { value: '--', label: '', divider: true },
          { value: 'melee', label: 'All melee weapons' },
          { value: 'missile,missile', label: 'All missile weapons' },
        ],
      },
      {
        type: 'select',
        key: 'constlevel',
        label: 'Construction',
        options: [
          { value: '', label: 'Construction 9 (all forgeable)' },
          { value: '7', label: 'Construction 7' },
          { value: '5', label: 'Construction 5' },
          { value: '3', label: 'Construction 3' },
          { value: '1', label: 'Construction 1' },
          { value: '-', label: '', divider: true },
          { value: '16', label: 'Include unforgeable items' },
        ],
      },
      { type: 'scope', nationalKey: 'national', genericKey: 'generic' },
      { type: 'paths', key: 'mpaths', paths: 'FAWESDNGB', icon: 'Path', label: 'Paths', inclusiveKey: 'inclusive' },
      { type: 'pathLevels', key: 'mlevels', paths: ALL_PATHS, label: 'Max path level' },
    ],
    thumb: (o) => o.sprite,
  },
  {
    id: 'site',
    label: 'Sites',
    singular: 'Site',
    icon: MapPin,
    module: 'MSite',
    refKind: 'site',
    group: 'main',
    filters: [
      { type: 'paths', key: 'mpaths', paths: 'FAWESDNGB', icon: 'Gem', label: 'Gem income (any of)' },
      {
        type: 'select',
        key: 'sitepath',
        label: 'Path',
        options: [{ value: '', label: 'All paths' }].concat(
          ['Fire', 'Air', 'Water', 'Earth', 'Astral', 'Death', 'Nature', 'Glamour', 'Blood', 'Holy'].map((v) => ({ value: v, label: v })),
        ),
      },
      {
        type: 'select',
        key: 'sitescale',
        label: 'Scale',
        options: [
          { value: '', label: 'All scales' },
          { value: 'noscales', label: 'No scales' },
          { value: '-', label: '', divider: true },
        ].concat(
          ['Turmoil', 'Order', 'Sloth', 'Productivity', 'Cold', 'Heat', 'Death', 'Growth', 'Misfortune', 'Luck', 'Drain', 'Magic'].map((v) => ({
            value: v,
            label: v,
          })),
        ),
      },
      {
        type: 'select',
        key: 'siteterrain',
        label: 'Terrain',
        options: [
          { value: '', label: 'All terrains' },
          { value: '1', label: 'Plain' },
          { value: '2', label: 'Forest' },
          { value: '4', label: 'Mountain' },
          { value: '8', label: 'Waste' },
          { value: '16', label: 'Farm' },
          { value: '32', label: 'Sea' },
          { value: '64', label: 'Coast' },
          { value: '128', label: 'Swamp' },
          { value: '256', label: 'Deep sea' },
          { value: '512', label: 'Cave' },
          { value: '16384', label: 'Unique' },
        ],
      },
      {
        type: 'select',
        key: 'sitetype',
        label: 'Kind',
        options: [
          { value: '', label: 'All types' },
          { value: 'Normal', label: 'Normal' },
          { value: 'Capitals', label: 'Capitals' },
          { value: 'Thrones', label: 'Thrones' },
        ],
      },
    ],
    thumb: (o) => o.url,
  },
  {
    id: 'independents',
    label: 'Independents',
    singular: 'Population type',
    icon: Tent,
    module: 'IndependentsPage',
    refKind: 'poptype',
    group: 'main',
    filters: [
      { type: 'paths', key: 'mpaths', paths: ALL_PATHS, icon: 'Path', label: 'Mage paths', inclusiveKey: 'inclusive' },
      {
        type: 'select',
        key: 'caster',
        label: 'Commanders',
        options: [
          { value: '', label: 'Any' },
          { value: 'mage', label: 'Has a mage' },
          { value: 'priest', label: 'Has a priest' },
          { value: 'none', label: 'No mage or priest' },
        ],
      },
      {
        type: 'select',
        key: 'source',
        label: 'Source',
        options: [
          { value: '', label: 'Vanilla and mods' },
          { value: 'base', label: 'Unmodified vanilla' },
          { value: 'edited', label: 'Vanilla, edited by a mod' },
          { value: 'added', label: 'Added by a mod' },
        ],
      },
      {
        type: 'select',
        key: 'terrain',
        label: 'Terrain',
        options: [
          { value: '', label: 'All terrains' },
          ...TERRAIN_FILTER_OPTIONS,
          { value: '-', label: '', divider: true },
          { value: 'none', label: 'Not placed by the map generator' },
        ],
      },
      { type: 'select', key: 'era', label: 'Era', options: [{ value: '', label: 'All eras' }, ...ERA_FILTER_OPTIONS] },
    ],
  },
  { id: 'merc', label: 'Mercenaries', singular: 'Mercenary', icon: Coins, module: 'MMerc', refKind: 'merc', group: 'main', filters: [] },
  {
    id: 'event',
    label: 'Events',
    singular: 'Event',
    icon: ScrollText,
    module: 'MEvent',
    refKind: 'event',
    group: 'main',
    filters: [
      {
        type: 'segmented',
        key: 'story',
        label: 'Story events setting',
        hint: 'the game setting: hides events (and whole storylines) that need a higher story event level',
        options: [
          { value: 'off', label: 'Off' },
          { value: 'minor', label: 'Minor' },
          { value: '', label: 'All' },
        ],
      },
      { type: 'multi', key: 'kind', label: 'Kind', options: KIND_OPTIONS },
      { type: 'nation', key: 'nation' },
      { type: 'multi', key: 'trig', label: 'Triggered by (any of)', options: TRIGGER_OPTIONS, hint: 'events with any of these requirements' },
      { type: 'multi', key: 'rew', label: 'Rewards (any of)', options: REWARD_OPTIONS, hint: 'events with any of these effects' },
      { type: 'multi', key: 'role', label: 'Storyline role', options: ROLE_OPTIONS },
      { type: 'dataSelect', key: 'storyline', label: 'Storyline', options: storylineOptions, hint: 'show one storyline’s events' },
      { type: 'range', key: 'turn', label: 'Can happen by turn', single: true, placeholder: 'turn', hint: 'events whose earliest turn is at or before this and whose latest turn (if any) is not earlier' },
      { type: 'range', key: 'chance', label: 'Chance %', hint: 'req_rare chance when rolled (events without one count as 100%)' },
    ],
  },
  {
    id: 'nation',
    label: 'Nations',
    singular: 'Nation',
    icon: Flag,
    module: 'Nations',
    refKind: 'nation',
    group: 'main',
    filters: [
      {
        type: 'select',
        key: 'era',
        label: 'Era',
        options: [
          { value: '', label: 'All eras' },
          { value: '1', label: 'Early era' },
          { value: '2', label: 'Middle era' },
          { value: '3', label: 'Late era' },
        ],
      },
    ],
  },
  { id: 'wpn', label: 'Weapons', singular: 'Weapon', icon: Swords, module: 'MWpn', refKind: 'wpn', group: 'reference', filters: [] },
  { id: 'armor', label: 'Armor', singular: 'Armor', icon: Shield, module: 'MArmor', refKind: 'armor', group: 'reference', filters: [] },
];

export const PAGE_BY_ID = Object.fromEntries(PAGES.map((p) => [p.id, p])) as Record<PageId, PageDef>;

/** Maps an upstream ref kind (including unit type words like "cmdr") to the page that lists it. */
export function pageForRefKind(kind: string): PageId {
  const direct = PAGES.find((p) => p.refKind === kind);
  if (direct) return direct.id;
  if (kind === 'affliction') return 'unit';
  if (kind === 'rndmagic') return 'unit';
  return 'unit'; // unit type words: unit, cmdr, commander, pretender, …
}

export const GEM_ICON = Gem;
