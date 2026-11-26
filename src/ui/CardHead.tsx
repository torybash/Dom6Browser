import type { ReactNode } from 'react';
import { PAGES, pageForRefKind } from '../pages';
import { useData } from '../state/data';
import type { RenderedPane } from './legacy';
import { LegacyHtml, type RefEventInfo } from './LegacyHtml';

interface Props {
  pane: RenderedPane;
  onRef?: (info: RefEventInfo) => void;
  onHover?: (info: RefEventInfo | null) => void;
  /** buttons on the right */
  children?: ReactNode;
  className?: string;
}

/** Card header: picture, title and subtitle line (nation, school, slot). Shared by every view of a pane. */
export function CardHead({ pane, onRef, onHover, children, className }: Props) {
  const DMI = useData((s) => s.DMI);
  const page = PAGES.find((p) => p.id === pageForRefKind(pane.kind));
  const thumb = !pane.head.sprites && DMI && page?.thumb ? page.thumb(pane.o, DMI) : undefined;
  return (
    <div className={'chead ' + (className ?? '')}>
      <div className="chead-pic art-spot">
        {pane.head.sprites ? (
          <LegacyHtml html={pane.head.sprites} />
        ) : thumb ? (
          <img src={thumb} alt="" className="sprite-thumb" />
        ) : page ? (
          <page.icon size={22} className="text-muted" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1 self-center">
        <div className="chead-title" title={pane.head.title}>
          {pane.head.title}
        </div>
        {pane.head.sub && <LegacyHtml html={pane.head.sub} onRef={onRef} onHover={onHover} className="chead-sub" />}
      </div>
      {children}
    </div>
  );
}
