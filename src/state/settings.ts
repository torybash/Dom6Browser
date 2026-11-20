import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  /** upstream "advanced", "more info", "show keys" and "mod cmds" in one: ids, hidden rows, modder info, database keys, property filters */
  advanced: boolean;
  hideDescriptions: boolean;
  /** upstream ?customjs=1: javascript filter box (advanced only) */
  customJs: boolean;
  theme: Theme;
  /** stat names on unit cards; off shows only icon + value in a tighter grid */
  unitStatLabels: boolean;
  set: (patch: Partial<Omit<Settings, 'set'>>) => void;
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      advanced: false,
      hideDescriptions: false,
      customJs: false,
      theme: 'system',
      unitStatLabels: true,
      set: (patch) => set(patch),
    }),
    { name: 'dom6browser:settings', version: 1 },
  ),
);
