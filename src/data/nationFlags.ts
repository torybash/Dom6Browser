// Nation emblems: the symbol on each nation's in-game flag, from flag.trs
// (scripts/extract-trs.py --nation-flags -> public/gameicons/flags/<id>.png).

// vanilla nation ids with an extracted emblem (unused slots have none)
const IDS = new Set([
  ...range(5, 34), ...range(40, 44), ...range(50, 81), ...range(85, 89), ...range(95, 121), ...range(123, 128),
]);

function range(a: number, b: number) {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

export function nationFlagUrl(id: unknown): string | null {
  const n = Number(id);
  return IDS.has(n) ? `gameicons/flags/${n}.png` : null;
}

/** `<img>` for legacy HTML strings; '' when the nation has no emblem. */
export function nationFlagHtml(id: unknown): string {
  const url = nationFlagUrl(id);
  return url ? `<img class="nflag" src="${url}" alt="">` : '';
}
