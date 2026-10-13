import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'system' | 'light' | 'dark';
/** panel: docked detail panel; cards: dom6inspector-style floating cards (desktop only) */
export type ViewMode = 'panel' | 'cards';

export interface Settings {
  /** upstream "advanced": ids, hidden rows, property filters */
  advanced: boolean;
  /** upstream "mod cmds": expand mod command lists (advanced only) */
  modCmds: boolean;
  /** upstream "more info": modder details, spell mask filters */
  moreInfo: boolean;
  /** upstream "show keys": database keys next to labels */
  showKeys: boolean;
  hideDescriptions: boolean;
  /** upstream ?customjs=1: javascript filter box (advanced only) */
  customJs: boolean;
  theme: Theme;
  textScale: number;
  thumbnails: boolean;
  hoverPreviews: boolean;
  viewMode: ViewMode;
  set: (patch: Partial<Omit<Settings, 'set'>>) => void;
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      advanced: false,
      modCmds: false,
      moreInfo: false,
      showKeys: false,
      hideDescriptions: false,
      customJs: false,
      theme: 'system',
      textScale: 1,
      thumbnails: true,
      hoverPreviews: true,
      viewMode: 'panel',
      set: (patch) => set(patch),
    }),
    { name: 'dom6browser:settings', version: 1 },
  ),
);
