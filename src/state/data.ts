import { create } from 'zustand';
import { loadData, type DMI, type ModFile, type ModMessage } from '../data/load';

interface DataState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  stage: string;
  progress: number;
  error?: string;
  DMI?: DMI;
  /** increments on every successful load so memoised views recompute */
  version: number;
  modMessages: ModMessage[];
  loadedModNames: string[];
  dataVersion?: { sha: string; synced: string };
  load: (mods: ModFile[]) => Promise<void>;
}

const base = import.meta.env.BASE_URL;
const textCache = new Map<string, Promise<string>>();

/** Fetches a site-relative text file (game data, descriptions). Cached for the session. */
export function fetchText(path: string): Promise<string> {
  let p = textCache.get(path);
  if (!p) {
    p = fetch(base + path).then((r) => {
      if (!r.ok) throw new Error(`${r.status} loading ${path}`);
      return r.text();
    });
    p.catch(() => textCache.delete(path));
    textCache.set(path, p);
  }
  return p;
}

let loadSeq = 0;

export const useData = create<DataState>((set, get) => ({
  status: 'idle',
  stage: '',
  progress: 0,
  version: 0,
  modMessages: [],
  loadedModNames: [],
  load: async (mods) => {
    const seq = ++loadSeq;
    set({ status: 'loading', stage: 'Starting', progress: 0, error: undefined });
    try {
      if (!get().dataVersion) {
        fetchText('gamedata/VERSION.json')
          .then((t) => set({ dataVersion: JSON.parse(t) }))
          .catch(() => {});
      }
      const DMI = await loadData({
        fetchText,
        mods,
        onProgress: (stage, progress) => seq === loadSeq && set({ stage, progress }),
      });
      if (seq !== loadSeq) return; // superseded by a newer load
      set({
        status: 'ready',
        DMI,
        version: get().version + 1,
        modMessages: DMI.modMessages,
        loadedModNames: [...DMI.modctx.loadedmods],
      });
    } catch (e: any) {
      if (seq !== loadSeq) return;
      console.error(e);
      set({ status: 'error', error: String(e?.message ?? e) });
    }
  },
}));
