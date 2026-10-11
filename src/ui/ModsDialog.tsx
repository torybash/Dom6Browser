import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, ArrowDown, ArrowUp, FileUp, Trash2, X, XCircle } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { create } from 'zustand';
import { useData } from '../state/data';
import { useMods } from '../state/mods';
import { Toggle } from './FilterPanel';

export const useModsDialog = create<{ open: boolean; setOpen: (o: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

export function ModsDialog() {
  const open = useModsDialog((s) => s.open);
  const setOpen = useModsDialog((s) => s.setOpen);
  const { mods, addFiles, remove, toggle, move, setAll } = useMods();
  const messages = useData((s) => s.modMessages);
  const loadedNames = useData((s) => s.loadedModNames);
  const status = useData((s) => s.status);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const byMod = useMemo(() => {
    const m = new Map<string, typeof messages>();
    for (const msg of messages) m.set(msg.mod, [...(m.get(msg.mod) ?? []), msg]);
    return m;
  }, [messages]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[86vh] w-[680px] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-2xl animate-in">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <div>
              <Dialog.Title className="font-display text-lg font-bold">Mods</Dialog.Title>
              <Dialog.Description className="text-xs text-muted">
                Load Dominions 6 mod files (.dm) to see how they change the data. Mods are applied in order and stored in this browser.
              </Dialog.Description>
            </div>
            <Dialog.Close className="btn-ghost" aria-label="Close">
              <X size={18} />
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div
              className={'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ' + (drag ? 'border-accent bg-accent/10' : 'border-line')}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                addFiles(e.dataTransfer.files);
              }}
            >
              <FileUp size={26} className="text-muted" />
              <p className="text-sm">
                Drop <span className="font-mono">.dm</span> files here or{' '}
                <button className="font-medium text-accent underline-offset-2 hover:underline" onClick={() => fileRef.current?.click()}>
                  browse
                </button>
              </p>
              <p className="text-xs text-muted">Custom sprites inside mods can't be shown; their units use a placeholder.</p>
              <input
                ref={fileRef}
                type="file"
                accept=".dm,.txt"
                multiple
                hidden
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>

            {mods.length > 0 && (
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="section-label">Loaded files ({mods.filter((m) => m.enabled).length}/{mods.length} enabled)</span>
                  <div className="flex gap-1">
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setAll(true)}>
                      Enable all
                    </button>
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setAll(false)}>
                      Disable all
                    </button>
                  </div>
                </div>
                <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
                  {mods.map((m, i) => {
                    const msgs = m.enabled ? (byMod.get(m.name) ?? []) : [];
                    const errors = msgs.filter((x) => x.level === 'error');
                    const warnings = msgs.filter((x) => x.level === 'warning');
                    return (
                      <li key={m.id} className="bg-raised">
                        <div className="flex items-center gap-3 px-3 py-2">
                          <Toggle checked={m.enabled} onChange={() => toggle(m.id)} label={`Enable ${m.name}`} />
                          <div className="min-w-0 flex-1">
                            <div className={'truncate text-sm font-medium ' + (m.enabled ? '' : 'text-muted line-through')}>{m.name}</div>
                            <div className="flex gap-3 text-xs text-muted">
                              <span>{m.text.split('\n').length.toLocaleString()} lines</span>
                              {errors.length > 0 && (
                                <span className="inline-flex items-center gap-1 text-bad">
                                  <XCircle size={12} /> {errors.length} error{errors.length > 1 ? 's' : ''}
                                </span>
                              )}
                              {warnings.length > 0 && (
                                <span className="inline-flex items-center gap-1 text-accent">
                                  <AlertTriangle size={12} /> {warnings.length} warning{warnings.length > 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          </div>
                          <button className="btn-ghost p-1" disabled={i === 0} onClick={() => move(m.id, -1)} title="Load earlier" aria-label="Move up">
                            <ArrowUp size={15} />
                          </button>
                          <button className="btn-ghost p-1" disabled={i === mods.length - 1} onClick={() => move(m.id, 1)} title="Load later" aria-label="Move down">
                            <ArrowDown size={15} />
                          </button>
                          <button className="btn-ghost p-1 hover:text-bad" onClick={() => remove(m.id)} title="Remove" aria-label={`Remove ${m.name}`}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                        {msgs.length > 0 && (
                          <details className="border-t border-line px-3 py-1.5 text-xs">
                            <summary className="cursor-pointer select-none text-muted">Show parser messages</summary>
                            <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto font-mono text-[11px]">
                              {msgs.slice(0, 500).map((x, j) => (
                                <li key={j} className={x.level === 'error' ? 'text-bad' : 'text-accent'}>
                                  <span className="text-muted">line {x.line}:</span> {x.msg}
                                  <div className="truncate text-muted">{x.text.split('\n')[0]}</div>
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 text-xs text-muted">
            <span className="truncate">
              {status === 'loading' ? 'Applying…' : loadedNames.length ? `Active: ${loadedNames.join(', ')}` : 'No mods active'}
            </span>
            <Dialog.Close className="btn-primary">Done</Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
