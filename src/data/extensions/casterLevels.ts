// "Caster" path filter for spells and items: the levels a mage has (e.g. E3 N2), every other path
// counting as 0. An entry passes when the mage meets every path it needs; with a boost of n it also
// passes when the missing levels add up to at most n (boosters, empowerment), and is shown as a near miss.

export const PATH_ORDER = 'FAWESDNGBH';
export type CasterLevels = Record<string, number>;

/** path → level pairs an entry needs (spells: path1/path2, items: mainpath/secondarypath). */
export function pathNeeds(o: any): [string, number][] {
  const out: [string, number][] = [];
  const add = (p: any, n: any) => {
    const lv = parseInt(n);
    if (p && PATH_ORDER.includes(p) && lv > 0) out.push([p, lv]);
  };
  if ('path1' in o) {
    add(o.path1, o.pathlevel1);
    add(o.path2, o.pathlevel2);
  } else {
    add(o.mainpath, o.mainlevel);
    add(o.secondarypath, o.secondarylevel);
  }
  return out;
}

/** levels still missing per path (empty when the caster can use the entry outright). */
export function missingLevels(o: any, lv: CasterLevels): [string, number][] {
  return pathNeeds(o)
    .map(([p, n]): [string, number] => [p, n - (lv[p] ?? 0)])
    .filter(([, d]) => d > 0);
}

export function shortfall(o: any, lv: CasterLevels): number {
  return missingLevels(o, lv).reduce((a, [, d]) => a + d, 0);
}

export const isCasterSet = (lv: unknown): lv is CasterLevels => !!lv && typeof lv === 'object' && Object.values(lv).some((n) => Number(n) > 0);

/** "E3N2" in path order */
export function casterCode(lv: CasterLevels): string {
  return PATH_ORDER.split('')
    .filter((p) => (lv[p] ?? 0) > 0)
    .map((p) => p + lv[p])
    .join('');
}

/**
 * Path sets a unit can have: its fixed paths plus each combination of its guaranteed random picks
 * (chance 100; a "levels" pick adds that many levels). Partial-chance picks are left out.
 */
export function unitCasterOptions(o: any, max = 24): CasterLevels[] {
  const base: CasterLevels = {};
  for (const p of PATH_ORDER) {
    const n = parseInt(o[p]);
    if (n > 0) base[p] = n;
  }
  let opts: CasterLevels[] = [base];
  for (const r of o.randompaths ?? []) {
    if (parseInt(r.chance) < 100 || !r.paths) continue;
    const add = Math.max(1, parseInt(r.levels) || 1);
    const next: CasterLevels[] = [];
    for (const lv of opts) for (const p of r.paths as string) next.push({ ...lv, [p]: (lv[p] ?? 0) + add });
    const seen = new Set<string>();
    opts = next.filter((lv) => !seen.has(casterCode(lv)) && !!seen.add(casterCode(lv)));
    if (opts.length > max) return [base];
  }
  return opts.filter(isCasterSet);
}
