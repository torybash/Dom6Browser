import * as Popover from '@radix-ui/react-popover';
import { ArrowLeft, ArrowRight, Check, Link2, Pin, PinOff, Sparkles, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useData } from '../state/data';
import { useSettings } from '../state/settings';
import { useView, type Filters } from '../state/view';
import { usePreview } from './HoverPreview';
import { renderRef } from './legacy';
import { LegacyHtml, type RefEventInfo } from './LegacyHtml';
import { PAGES, pageForRefKind } from '../pages';
import { PATH_ORDER, casterCode, unitCasterOptions, type CasterLevels } from '../data/extensions/casterLevels';

export function useRefHandlers() {
  const navigate = useView((s) => s.navigate);
  const togglePin = useView((s) => s.togglePin);
  const showPreview = usePreview((s) => s.show);
  const onRef = useCallback(
    (info: RefEventInfo) => {
      if (info.alt) togglePin(info.ref);
      else navigate(info.ref);
    },
    [navigate, togglePin],
  );
  return { onRef, onHover: showPreview };
}

export function DetailPanel({ onClose }: { onClose?: () => void }) {
  const DMI = useData((s) => s.DMI);
  const version = useData((s) => s.version);
  const detailRef = useView((s) => s.detailRef);
  const canBack = useView((s) => s.historyIndex > 0);
  const canForward = useView((s) => s.historyIndex < s.history.length - 1);
  const back = useView((s) => s.back);
  const forward = useView((s) => s.forward);
  const pins = useView((s) => s.pins);
  const togglePin = useView((s) => s.togglePin);
  const showModCmds = useSettings((s) => s.advanced);
  const { onRef, onHover } = useRefHandlers();
  const [copied, setCopied] = useState(false);

  const pane = useMemo(
    () => (DMI && detailRef ? renderRef(DMI, detailRef, showModCmds) : null),
    // version: re-render after data reloads (mods)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [DMI, version, detailRef, showModCmds],
  );

  const kindPage = pane ? PAGES.find((p) => p.id === pageForRefKind(pane.kind)) : undefined;
  const pinned = detailRef ? pins.includes(detailRef) : false;

  const copyLink = () => {
    navigator.clipboard?.writeText(location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  };

  return (
    <section className="flex h-full min-h-0 flex-col bg-panel" aria-label="Details">
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-line px-2">
        {onClose && (
          <button className="btn-ghost font-medium text-fg" onClick={onClose} title="Back to list" aria-label="Back to list">
            <X size={16} /> List
          </button>
        )}
        <button className="btn-ghost" disabled={!canBack} onClick={back} title="Back (Alt+←)" aria-label="Back">
          <ArrowLeft size={16} />
        </button>
        <button className="btn-ghost" disabled={!canForward} onClick={forward} title="Forward (Alt+→)" aria-label="Forward">
          <ArrowRight size={16} />
        </button>
        <div className="ml-1 flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted">
          {kindPage && <kindPage.icon size={14} className="shrink-0" />}
          <span className="truncate">{kindPage?.singular ?? (pane ? pane.kind : '')}</span>
          {pane && pane.o?.id !== undefined && <span className="hidden tabular-nums opt-advanced-only">#{pane.o.id}</span>}
        </div>
        {pane?.kind === 'unit' && <CastableSpells o={pane.o} />}
        {detailRef && (
          <>
            <button className="btn-ghost" onClick={copyLink} title="Copy link to this view">
              {copied ? <Check size={16} className="text-good" /> : <Link2 size={16} />}
            </button>
            <button
              className={'btn-ghost ' + (pinned ? 'text-accent' : '')}
              onClick={() => togglePin(detailRef)}
              title={pinned ? 'Unpin' : 'Pin for comparison (Enter)'}
            >
              {pinned ? <PinOff size={16} /> : <Pin size={16} />}
            </button>
          </>
        )}
        {!onClose && detailRef && (
          <button className="btn-ghost" onClick={() => useView.setState({ detailRef: null })} title="Close" aria-label="Close details">
            <X size={16} />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {pane ? (
          <LegacyHtml key={detailRef} html={pane.html} jobs={pane.jobs} onRef={onRef} onHover={onHover} className="animate-in" />
        ) : (
          <EmptyDetail missing={!!detailRef} />
        )}
      </div>
    </section>
  );
}

function EmptyDetail({ missing }: { missing: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-muted">
      <img src="images/magicicons/Path_S.png" alt="" className="h-10 w-10 opacity-40" />
      <p className="text-sm">{missing ? 'That entry does not exist in the loaded data.' : 'Select a row to see its details.'}</p>
      <p className="text-xs">
        Click links to follow them · <span className="kbd">Shift</span>+click to pin · hover to preview
      </p>
    </div>
  );
}

/** Opens the spells page filtered to what this unit can cast (one entry per guaranteed random-path outcome). */
function CastableSpells({ o }: { o: any }) {
  const options = useMemo(() => unitCasterOptions(o), [o]);
  const [open, setOpen] = useState(false);
  if (!options.length) return null;
  const go = (lv: CasterLevels) => {
    const s = useView.getState();
    const spell: Filters = { ...s.filters.spell, mlevels: lv };
    delete spell.mboost;
    useView.setState({ filters: { ...s.filters, spell } });
    s.setPage('spell');
    setOpen(false);
  };
  const button = (
    <button
      className="btn-ghost text-xs"
      onClick={options.length === 1 ? () => go(options[0]) : undefined}
      title={options.length === 1 ? `Spells castable with ${casterCode(options[0])}` : 'Spells castable by this unit (pick its random paths)'}
    >
      <Sparkles size={15} /> Spells
    </button>
  );
  if (options.length === 1) return button;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{button}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={4} className="z-50 max-h-80 overflow-y-auto rounded-lg border border-line bg-panel p-1 shadow-xl animate-in">
          <div className="px-2 py-1 text-xs text-muted">Random paths as</div>
          {options.map((lv) => (
            <button key={casterCode(lv)} className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs hover:bg-row-hover" onClick={() => go(lv)}>
              {PATH_ORDER.split('')
                .filter((p) => lv[p])
                .map((p) => (
                  <span key={p} className="inline-flex items-center font-semibold tabular-nums">
                    <span className={`pathicon Path_${p}`}>{p}</span>
                    {lv[p]}
                  </span>
                ))}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
