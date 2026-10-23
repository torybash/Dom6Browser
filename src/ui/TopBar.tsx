import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { Check, Monitor, Moon, Package, PanelLeft, Search, Settings, Sun } from 'lucide-react';
import { useData } from '../state/data';
import { useMods } from '../state/mods';
import { useSettings, type Theme } from '../state/settings';
import { useGlobalSearch } from './GlobalSearch';
import { useModsDialog } from './ModsDialog';

export function TopBar({ onToggleSidebar, compact }: { onToggleSidebar?: () => void; compact?: boolean }) {
  const setSearchOpen = useGlobalSearch((s) => s.setOpen);
  const setModsOpen = useModsDialog((s) => s.setOpen);
  const mods = useMods((s) => s.mods);
  const messages = useData((s) => s.modMessages);
  const enabled = mods.filter((m) => m.enabled).length;
  const errors = messages.filter((m) => m.level === 'error').length;
  const warnings = messages.length - errors;

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-panel px-2 sm:px-3">
      {onToggleSidebar && (
        <button className="btn-ghost" onClick={onToggleSidebar} title="Toggle sidebar" aria-label="Toggle sidebar">
          <PanelLeft size={18} />
        </button>
      )}
      <div className="flex items-center gap-2 pr-2">
        <img src="images/magicicons/Path_S.png" alt="" className="h-6 w-6" />
        <div className="leading-none">
          <div className="font-display text-[15px] font-bold tracking-wide">Dom6 Browser</div>
          {!compact && <div className="text-[10px] text-muted">Dominions 6 data reference</div>}
        </div>
      </div>

      <button
        className="ml-auto flex h-8 min-w-0 max-w-[460px] flex-1 items-center gap-2 rounded-md border border-line bg-raised px-2.5 text-sm text-muted transition-colors hover:border-accent/60 sm:ml-4"
        onClick={() => setSearchOpen(true)}
        aria-label="Search everything"
      >
        <Search size={15} />
        <span className="truncate">{compact ? 'Search…' : 'Search everything…'}</span>
        {!compact && (
          <span className="ml-auto flex gap-0.5">
            <span className="kbd">Ctrl</span>
            <span className="kbd">K</span>
          </span>
        )}
      </button>

      <button
        className={'btn-ghost relative ' + (enabled ? 'text-fg' : '')}
        onClick={() => setModsOpen(true)}
        title="Load mods"
        aria-label="Mods"
      >
        <Package size={17} />
        {!compact && <span>{enabled ? `${enabled} mod${enabled > 1 ? 's' : ''}` : 'Mods'}</span>}
        {enabled > 0 && (errors > 0 || warnings > 0) && (
          <span className={'absolute right-0.5 top-0.5 h-2 w-2 rounded-full ' + (errors ? 'bg-bad' : 'bg-accent')} title={`${errors} errors, ${warnings} warnings`} />
        )}
      </button>
      <SettingsMenu />
    </header>
  );
}

function SettingsMenu() {
  const s = useSettings();
  const item = 'flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-row-hover data-[disabled]:opacity-40';
  const check = (on: boolean) => <span className="flex w-4 justify-center">{on && <Check size={14} className="text-accent" />}</span>;
  const themes: [Theme, string, typeof Sun][] = [
    ['system', 'System', Monitor],
    ['light', 'Light', Sun],
    ['dark', 'Dark', Moon],
  ];

  return (
    <Dropdown.Root>
      <Dropdown.Trigger className="btn-ghost" aria-label="Settings" title="Display & advanced options">
        <Settings size={17} />
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content align="end" sideOffset={6} className="z-50 w-72 rounded-lg border border-line bg-panel p-1.5 shadow-xl animate-in">
          <Dropdown.Label className="section-label px-2 pb-1 pt-1">Theme</Dropdown.Label>
          <div className="grid grid-cols-3 gap-1 px-1 pb-1">
            {themes.map(([t, label, Icon]) => (
              <button
                key={t}
                className={'flex flex-col items-center gap-0.5 rounded-md border py-1.5 text-xs ' + (s.theme === t ? 'border-accent bg-accent/10' : 'border-line hover:bg-row-hover')}
                onClick={() => s.set({ theme: t })}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between px-2 py-1.5 text-sm">
            <span>Text size</span>
            <div className="flex items-center gap-1">
              {[0.9, 1, 1.15, 1.3].map((v) => (
                <button key={v} className={'rounded px-1.5 py-0.5 text-xs ' + (s.textScale === v ? 'bg-accent text-white dark:text-bg' : 'hover:bg-row-hover')} onClick={() => s.set({ textScale: v })}>
                  {Math.round(v * 100)}%
                </button>
              ))}
            </div>
          </div>
          <Dropdown.CheckboxItem className={item} checked={s.thumbnails} onCheckedChange={(v) => s.set({ thumbnails: v })} onSelect={(e) => e.preventDefault()}>
            {check(s.thumbnails)} Sprite thumbnails in tables
          </Dropdown.CheckboxItem>
          <Dropdown.CheckboxItem className={item} checked={s.hoverPreviews} onCheckedChange={(v) => s.set({ hoverPreviews: v })} onSelect={(e) => e.preventDefault()}>
            {check(s.hoverPreviews)} Preview links on hover
          </Dropdown.CheckboxItem>
          <Dropdown.CheckboxItem className={item} checked={s.hideDescriptions} onCheckedChange={(v) => s.set({ hideDescriptions: v })} onSelect={(e) => e.preventDefault()}>
            {check(s.hideDescriptions)} Hide in-game descriptions
          </Dropdown.CheckboxItem>
          <Dropdown.CheckboxItem className={item} checked={s.showFormulas} onCheckedChange={(v) => s.set({ showFormulas: v })} onSelect={(e) => e.preventDefault()}>
            {check(s.showFormulas)} Explain calculated values in tooltips
          </Dropdown.CheckboxItem>
          <Dropdown.CheckboxItem className={item} checked={s.unitStatLabels} onCheckedChange={(v) => s.set({ unitStatLabels: v })} onSelect={(e) => e.preventDefault()}>
            {check(s.unitStatLabels)} Stat names on unit cards
          </Dropdown.CheckboxItem>

          <Dropdown.Separator className="my-1.5 h-px bg-line" />
          <Dropdown.Label className="section-label px-2 pb-1">Advanced</Dropdown.Label>
          <Dropdown.CheckboxItem className={item} checked={s.advanced} onCheckedChange={(v) => s.set({ advanced: v })} onSelect={(e) => e.preventDefault()}>
            {check(s.advanced)}
            <span>
              Advanced mode
              <span className="block text-[11px] text-muted">ids, hidden details, property filters</span>
            </span>
          </Dropdown.CheckboxItem>
          <Dropdown.CheckboxItem className={item} disabled={!s.advanced} checked={s.modCmds} onCheckedChange={(v) => s.set({ modCmds: v })} onSelect={(e) => e.preventDefault()}>
            {check(s.modCmds)} Expand mod commands
          </Dropdown.CheckboxItem>
          <Dropdown.CheckboxItem className={item} checked={s.moreInfo} onCheckedChange={(v) => s.set({ moreInfo: v })} onSelect={(e) => e.preventDefault()}>
            {check(s.moreInfo)}
            <span>
              More info
              <span className="block text-[11px] text-muted">modder details, effect/mask filters</span>
            </span>
          </Dropdown.CheckboxItem>
          <Dropdown.CheckboxItem className={item} checked={s.showKeys} onCheckedChange={(v) => s.set({ showKeys: v })} onSelect={(e) => e.preventDefault()}>
            {check(s.showKeys)}
            <span>
              Show keys
              <span className="block text-[11px] text-muted">database keys, usable in property filters</span>
            </span>
          </Dropdown.CheckboxItem>
          <Dropdown.CheckboxItem className={item} disabled={!s.advanced} checked={s.customJs} onCheckedChange={(v) => s.set({ customJs: v })} onSelect={(e) => e.preventDefault()}>
            {check(s.customJs)} Custom JS filter
          </Dropdown.CheckboxItem>
          <Dropdown.Separator className="my-1.5 h-px bg-line" />
          <ShortcutHelp />
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

function ShortcutHelp() {
  const rows: [string, string][] = [
    ['Ctrl K  or  /', 'search everything'],
    ['↑ ↓  (Ctrl in search box)', 'move through results'],
    ['Enter', 'pin selected'],
    ['Alt ← →', 'detail history'],
    ['Ctrl ← →', 'switch page'],
    ['Esc', 'close / clear search'],
    ['Alt + drag', 'move a card without snapping'],
    ['Dbl-click title', 'collapse a card'],
  ];
  return (
    <div className="px-2 pb-1 text-[11px] text-muted">
      <div className="section-label mb-1">Keyboard</div>
      {rows.map(([k, d]) => (
        <div key={k} className="flex justify-between gap-2 py-0.5">
          <span className="font-mono">{k}</span>
          <span>{d}</span>
        </div>
      ))}
    </div>
  );
}

export function LoadingScreen() {
  const { stage, progress, status, error } = useData();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
      <img src="images/magicicons/Path_S.png" alt="" className="h-12 w-12 animate-pulse" />
      <div className="font-display text-2xl font-bold">Dom6 Browser</div>
      {status === 'error' ? (
        <div className="max-w-md text-center text-sm">
          <p className="font-medium text-bad">Failed to load game data</p>
          <p className="mt-1 text-muted">{error}</p>
          <p className="mt-3 text-xs text-muted">
            If you are running from source, fetch the data first with <code className="kbd">npm run sync</code>.
          </p>
        </div>
      ) : (
        <div className="w-64">
          <div className="h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.max(4, stageProgress(stage, progress) * 100)}%` }} />
          </div>
          <p className="mt-2 text-center text-xs text-muted">{stage || 'Starting'}…</p>
        </div>
      )}
    </div>
  );
}

const STAGES = ['Downloading game data', 'Parsing tables', 'Preparing data', 'Applying mods', 'Finalising data', 'Ready'];
function stageProgress(stage: string, p: number) {
  const i = Math.max(0, STAGES.indexOf(stage));
  if (i === 0) return p * 0.6;
  return 0.6 + (i / (STAGES.length - 1)) * 0.4;
}
