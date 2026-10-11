// Minimal stand-in for the few jQuery utility functions the upstream data layer uses.
export const $ = {
  trim: (s: unknown) => (s == null ? '' : String(s).trim()),
  isArray: Array.isArray,
  isEmptyObject: (o: object) => {
    for (const _ in o) return false;
    return true;
  },
};
