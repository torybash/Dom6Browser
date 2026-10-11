import { memo, useEffect, useLayoutEffect, useRef } from 'react';
import { enhance, revealList, runContentJobs, toggleSprite, type ContentJob } from './legacy';

export interface RefEventInfo {
  ref: string;
  /** shift/ctrl/meta click or middle click */
  alt: boolean;
  anchor: HTMLElement;
}

interface Props {
  html: string;
  jobs?: ContentJob[];
  className?: string;
  onRef?: (info: RefEventInfo) => void;
  onHover?: (info: RefEventInfo | null) => void;
  /** called after the html was inserted and enhanced */
  onRendered?: (root: HTMLElement) => void;
}

/**
 * Renders html produced by the ported upstream renderers and wires up its interactive bits via event
 * delegation: ref links, "show" buttons for long lists, sprite toggles and async descriptions.
 */
export const LegacyHtml = memo(function LegacyHtml({ html, jobs, className, onRef, onHover, onRendered }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const handlers = useRef({ onRef, onHover });
  handlers.current = { onRef, onHover };

  useLayoutEffect(() => {
    const el = ref.current!;
    let alive = true;
    el.innerHTML = html;
    enhance(el);
    if (jobs?.length) runContentJobs(el, jobs, () => alive);
    onRendered?.(el);
    return () => {
      alive = false;
    };
    // jobs/onRendered are tied to html
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html]);

  useEffect(() => {
    const el = ref.current!;
    const refInfo = (e: MouseEvent): RefEventInfo | null => {
      const a = (e.target as HTMLElement).closest<HTMLElement>('a.ref[data-ref]');
      if (!a || !el.contains(a)) return null;
      return { ref: a.dataset.ref!, alt: e.shiftKey || e.ctrlKey || e.metaKey || e.button === 1, anchor: a };
    };
    const click = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const action = t.closest<HTMLElement>('[data-action]');
      if (action?.dataset.action === 'reveal') {
        revealList(action);
        return;
      }
      if (action?.dataset.action === 'toggle-sprite') {
        toggleSprite(action as HTMLImageElement);
        return;
      }
      const info = refInfo(e);
      if (info) {
        e.preventDefault();
        handlers.current.onHover?.(null);
        handlers.current.onRef?.(info);
      }
    };
    const aux = (e: MouseEvent) => {
      if (e.button !== 1) return;
      const info = refInfo(e);
      if (info) {
        e.preventDefault();
        handlers.current.onRef?.(info);
      }
    };
    let hovering: HTMLElement | null = null;
    const over = (e: MouseEvent) => {
      const info = refInfo(e);
      if (info && info.anchor !== hovering) {
        hovering = info.anchor;
        handlers.current.onHover?.(info);
      }
    };
    const out = (e: MouseEvent) => {
      if (!hovering) return;
      const to = e.relatedTarget as Node | null;
      if (to && hovering.contains(to)) return;
      hovering = null;
      handlers.current.onHover?.(null);
    };
    el.addEventListener('click', click);
    el.addEventListener('auxclick', aux);
    el.addEventListener('mouseover', over);
    el.addEventListener('mouseout', out);
    return () => {
      el.removeEventListener('click', click);
      el.removeEventListener('auxclick', aux);
      el.removeEventListener('mouseover', over);
      el.removeEventListener('mouseout', out);
    };
  }, []);

  return <div ref={ref} className={'legacy ' + (className ?? '')} />;
});
