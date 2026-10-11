// Locally loaded .dm mods, persisted in IndexedDB (upstream used localStorage and hit quota limits).
import { create } from 'zustand';
import { get as idbGet, set as idbSet } from 'idb-keyval';

export interface ModEntry {
  id: string;
  name: string;
  text: string;
  enabled: boolean;
  addedAt: number;
}

interface ModsState {
  ready: boolean;
  mods: ModEntry[];
  init: () => Promise<void>;
  addFiles: (files: FileList | File[]) => Promise<void>;
  remove: (id: string) => void;
  toggle: (id: string) => void;
  move: (id: string, delta: number) => void;
  setAll: (enabled: boolean) => void;
}

const KEY = 'dom6browser:mods';

export const useMods = create<ModsState>((set, get) => {
  const save = (mods: ModEntry[]) => {
    set({ mods });
    idbSet(KEY, mods).catch((e) => console.error('saving mods failed', e));
  };
  return {
    ready: false,
    mods: [],
    init: async () => {
      try {
        const mods = ((await idbGet(KEY)) as ModEntry[] | undefined) ?? [];
        set({ mods, ready: true });
      } catch (e) {
        console.error('reading mods failed', e);
        set({ ready: true });
      }
    },
    addFiles: async (files) => {
      const list = Array.from(files).filter((f) => /\.(dm|txt)$/i.test(f.name) || !f.name.includes('.'));
      const texts = await Promise.all(list.map((f) => f.text()));
      const mods = [...get().mods];
      list.forEach((f, i) => {
        // re-adding a file with the same name replaces it in place (keeps its position)
        const existing = mods.findIndex((m) => m.name === f.name);
        const entry: ModEntry = { id: crypto.randomUUID(), name: f.name, text: texts[i], enabled: true, addedAt: Date.now() };
        if (existing >= 0) mods[existing] = { ...entry, id: mods[existing].id };
        else mods.push(entry);
      });
      save(mods);
    },
    remove: (id) => save(get().mods.filter((m) => m.id !== id)),
    toggle: (id) => save(get().mods.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m))),
    move: (id, delta) => {
      const mods = [...get().mods];
      const i = mods.findIndex((m) => m.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= mods.length) return;
      [mods[i], mods[j]] = [mods[j], mods[i]];
      save(mods);
    },
    setAll: (enabled) => save(get().mods.map((m) => ({ ...m, enabled }))),
  };
});

export const enabledMods = (mods: ModEntry[]) => mods.filter((m) => m.enabled);
