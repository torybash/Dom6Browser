// BigInt replacement for upstream bitfields.js (a Closure-compiled goog.math.Long helper).
// Values are parsed as decimal strings and treated as signed 64-bit integers.

function toLong(v: unknown): bigint {
  const s = String(v ?? '0').trim();
  if (!/^-?\d+$/.test(s)) return 0n;
  return BigInt.asIntN(64, BigInt(s));
}

export const bitfields = {
  /** Names (`bit_name`) of every entry in `masks` whose key bit is set in `value`. */
  bitfieldValues(value: unknown, masks: Record<string, { bit_name: string }>): string[] {
    const v = toLong(value);
    const out: string[] = [];
    for (const key in masks) {
      if ((toLong(key) & v) !== 0n) out.push(masks[key].bit_name);
    }
    return out;
  },
  longOr(a: unknown, b: unknown): string {
    return BigInt.asIntN(64, toLong(a) | toLong(b)).toString();
  },
};
