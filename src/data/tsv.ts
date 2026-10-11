// Ports of upstream loaddata.js parseTextToTable / createLookup.
// Game data files are tab separated with a header row (despite the .csv extension).

export type Row = Record<string, any>;

/** Parses a TSV file into row objects. Empty cells are omitted; all values stay strings. */
export function parseTextToTable(str: string): Row[] {
  const t: Row[] = [];
  const lines = str.split('\n');
  const keynames = lines[0].split('\t');

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split('\t');
    if (values[0] == '') continue;

    const o: Row = {};
    for (let j = 0; j < keynames.length; j++) {
      const val = values[j];
      // parity with upstream: a trailing "\r" stays on non-empty last cells, and short rows
      // get keys with undefined values
      if (val != '' && val != '\r') o[keynames[j]] = val;
    }
    t.push(o);
  }
  return t;
}

/** Lookup by k1 and, optionally, by lowercased k2. First occurrence wins. */
export function createLookup(t: Row[], k1: string, k2?: string): Record<string, Row> {
  const lookup: Record<string, Row> = {};
  for (const line of t) {
    const v1 = line[k1];
    if (v1 && !lookup[v1]) lookup[v1] = line;

    if (k2) {
      let v2 = line[k2];
      if (v2) {
        v2 = v2.toLowerCase();
        if (!lookup[v2]) lookup[v2] = line;
      }
    }
  }
  return lookup;
}
