// Normalises rendered html/derived values so upstream (jQuery) and ported output can be compared.
// Only presentation differences introduced deliberately by the port are erased here.

const UPSTREAM_REF = /<a class="ref" style="cursor:pointer;"><input value="([^"]*)" type="hidden" \/>/g;
const UPSTREAM_DASHED_REF = /<a-class="ref"-style="cursor:pointer;"><input-value="([^"]*)"-type="hidden"-\/>/g;
const PORT_REF = /<a class="ref" data-ref="([^"]*)">/g;

export function normalizeHtml(h) {
  if (typeof h !== 'string') return h;
  return h
    .replace(UPSTREAM_REF, (_, r) => `<a ref="${r}">`)
    // upstream bug: flag labels dash every space, mangling embedded refs (fixed in the port)
    .replace(UPSTREAM_DASHED_REF, (_, r) => `<a ref="${r.replace('-', ' ')}">`)
    .replace(PORT_REF, (_, r) => `<a ref="${r.replace(/&quot;/g, '"')}">`)
    // random description container classes
    .replace(/\b[cd]0\d+/g, 'cUID')
    // "show" buttons: inline jQuery onclick vs data-action
    .replace(/ onclick="\$\(this\)[^"]*"/g, '')
    .replace(/ data-action="reveal"( data-keep="1")?/g, '')
    // unit sprite toggles
    .replace(/<img style="float:right; clear:right; vertical-align:top; margin-right:25px" title="([^"]*)" src="([^"]*)"[^>]*\/>/g, '<img title="$1" src="$2"/>')
    .replace(/<img class="unit-sprite[^"]*" title="([^"]*)" data-action="toggle-sprite" data-src1="[^"]*" data-src2="[^"]*" src="([^"]*)"\/>/g, '<img title="$1" src="$2"/>')
    .replace(/\s+/g, ' ')
    // mod command lists: jQuery show/hide links vs <details>
    .replace(/\s*<a class="show-mod-commands".*?<p class="mod-cmds"[^>]*>\s*(.*?)\s*<\/p>\s*/g, '[[modded:$1]]')
    .replace(/\s*<details class="mod-cmds-block"[^>]*><summary>.*?<\/summary><p class="mod-cmds">\s*(.*?)\s*<\/p><\/details>\s*/g, '[[modded:$1]]')
    .replace(/<span style="color:red;font-weight:bold;">ERROR:<\/span>|<span class="mod-error">ERROR:<\/span>/g, 'ERROR:');
}

/** Flattens an entity into comparable primitive fields (refs become ids, html is normalised). */
export function serializeEntity(o) {
  const out = {};
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (typeof v === 'function' || k === 'dupes') continue;
    out[k] = serializeValue(v, 0);
  }
  return out;
}

function serializeValue(v, depth) {
  if (v == null || typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v === 'string') return normalizeHtml(v);
  if (typeof v === 'function') return undefined;
  if (depth > 0) {
    if (Array.isArray(v)) return `[${v.length}]`;
    return v.id !== undefined ? `#${v.id}` : v.name !== undefined ? `@${v.name}` : '{obj}';
  }
  if (Array.isArray(v)) return v.map((x) => serializeValue(x, depth + 1));
  if (v.id !== undefined && v.name !== undefined) return `#${v.id}`;
  const o = {};
  for (const k of Object.keys(v)) {
    if (typeof v[k] !== 'function') o[k] = serializeValue(v[k], depth + 1);
  }
  return o;
}

/** Entity kinds compared by the golden suite: [modctx data key, display name]. */
export const KINDS = [
  ['wpndata', 'wpn'],
  ['armordata', 'armor'],
  ['itemdata', 'item'],
  ['unitdata', 'unit'],
  ['spelldata', 'spell'],
  ['sitedata', 'site'],
  ['mercdata', 'merc'],
  ['eventdata', 'event'],
  ['nationdata', 'nation'],
];
