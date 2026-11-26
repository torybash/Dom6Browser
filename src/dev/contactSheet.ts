// Dev-only contact sheet (contact-sheet.html): every piece of game art from one folder, drawn on
// the light and the dark theme side by side, with and without the art backing (--art-halo /
// --art-glow). "Worst first" scores each image by how much of it melts into each theme's panel.
import '../styles/index.css';

interface ArtSet {
  dir: string;
  label: string;
  /** large art also gets the spotlight */
  large: boolean;
  size: number;
  filter?: (f: string) => boolean;
}

const SETS: ArtSet[] = [
  { dir: 'gameicons', label: 'Game icons', large: false, size: 20 },
  { dir: 'images/magicicons', label: 'Path & gem icons', large: false, size: 20 },
  { dir: 'images/items', label: 'Items', large: true, size: 48 },
  { dir: 'images/sprites', label: 'Unit sprites (thumb)', large: false, size: 28, filter: (f) => /_1\.png$/.test(f) },
  { dir: 'images/sprites', label: 'Unit sprites (card)', large: true, size: 96, filter: (f) => /_1\.png$/.test(f) },
  { dir: 'images/sites', label: 'Sites', large: true, size: 48 },
];

/** contrast below this against the panel counts as melted */
const MELT_CONTRAST = 1.6;

const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

function panelLuminance(el: HTMLElement) {
  const [r, g, b] = getComputedStyle(el).getPropertyValue('--panel').trim().split(/\s+/).map(Number);
  return luminance(r, g, b);
}

type Score = { light: number; dark: number };
const scoreCache = new Map<string, Score>();

/** fraction of opaque pixels that melt into the light / dark panel */
async function score(png: Blob, light: number, dark: number): Promise<Score> {
  const bmp = await createImageBitmap(png);
  const ctx = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  const d = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
  let n = 0, ml = 0, md = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] <= 128) continue;
    const y = luminance(d[i], d[i + 1], d[i + 2]);
    n++;
    if (contrast(y, light) < MELT_CONTRAST) ml++;
    if (contrast(y, dark) < MELT_CONTRAST) md++;
  }
  return { light: n ? ml / n : 0, dark: n ? md / n : 0 };
}

/** scores urls (all from `dir`), fetching the pngs in batches through the dev server's /__art */
async function scoreAll(dir: string, urls: string[], light: number, dark: number, progress: (done: number) => void) {
  const todo = urls.filter((u) => !scoreCache.has(u));
  const batches: string[][] = [];
  for (let i = 0; i < todo.length; i += 150) batches.push(todo.slice(i, i + 150));
  let done = urls.length - todo.length;
  const worker = async () => {
    for (let batch; (batch = batches.shift()); ) {
      const files = batch.map((u) => u.slice(dir.length + 1));
      const q = `dir=${encodeURIComponent(dir)}&files=${files.map(encodeURIComponent).join(',')}`;
      const pngs: Record<string, string> = await fetch(`/__art?${q}`)
        .then((r) => r.json())
        .catch(() => ({}));
      for (const f of files) {
        const b64 = pngs[f];
        const s = b64
          ? await score(new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))]), light, dark).catch(() => ({ light: 0, dark: 0 }))
          : { light: 0, dark: 0 };
        scoreCache.set(`${dir}/${f}`, s);
      }
      progress((done += batch.length));
    }
  };
  await Promise.all(Array.from({ length: 3 }, worker));
  return new Map(urls.map((u) => [u, scoreCache.get(u)!]));
}

const state = { set: 0, sort: 'file' as 'file' | 'dark' | 'light', backing: true, limit: 300, offset: 0 };
let renderId = 0;

const root = document.getElementById('root')!;
root.className = 'min-h-full bg-bg text-fg font-sans text-sm';
root.innerHTML = `
  <header class="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-line bg-panel px-4 py-2">
    <h1 class="font-display text-lg font-bold">Art contact sheet</h1>
    <select class="input !w-auto" data-k="set">${SETS.map((s, i) => `<option value="${i}">${s.label}</option>`).join('')}</select>
    <select class="input !w-auto" data-k="sort">
      <option value="file">File order</option>
      <option value="dark">Worst on dark first</option>
      <option value="light">Worst on light first</option>
    </select>
    <label class="flex items-center gap-1.5"><input type="checkbox" data-k="backing" checked> Art backing</label>
    <label class="flex items-center gap-1.5">Show <input class="input !w-20" type="number" min="1" data-k="limit" value="${state.limit}"></label>
    <label class="flex items-center gap-1.5">from <input class="input !w-20" type="number" min="0" data-k="offset" value="0"></label>
    <span class="text-muted" id="status"></span>
  </header>
  <main class="grid grid-cols-1 md:grid-cols-2">
    <section class="bg-panel p-3" id="light"></section>
    <section class="dark bg-panel p-3 text-fg" id="dark" style="color-scheme: dark"></section>
  </main>`;

const status = root.querySelector<HTMLElement>('#status')!;
const panes = { light: root.querySelector<HTMLElement>('#light')!, dark: root.querySelector<HTMLElement>('#dark')! };

root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-k]').forEach((el) =>
  el.addEventListener('change', () => {
    const k = el.dataset.k as keyof typeof state;
    if (k === 'backing') state.backing = (el as HTMLInputElement).checked;
    else if (k === 'sort') state.sort = el.value as typeof state.sort;
    else state[k] = Number(el.value) as never;
    if (k === 'set') state.offset = 0;
    render();
  }),
);

const lists = new Map<string, Promise<string[]>>();
const listDir = (dir: string) => {
  if (!lists.has(dir)) lists.set(dir, fetch(`/__art?dir=${encodeURIComponent(dir)}`).then((r) => r.json()));
  return lists.get(dir)!;
};
const naturalOrder = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

async function render() {
  const id = ++renderId;
  const set = SETS[state.set];
  let urls = (await listDir(set.dir)).filter(set.filter ?? (() => true)).sort(naturalOrder).map((f) => `${set.dir}/${f}`);
  const total = urls.length;
  let scores = new Map<string, { light: number; dark: number }>();
  const light = panelLuminance(panes.light), dark = panelLuminance(panes.dark);
  if (state.sort !== 'file') {
    scores = await scoreAll(set.dir, urls, light, dark, (n) => id === renderId && (status.textContent = `scoring ${n} / ${total}…`));
    const k = state.sort;
    urls = [...urls].sort((a, b) => scores.get(b)![k] - scores.get(a)![k]);
  }
  if (id !== renderId) return;
  const shown = urls.slice(state.offset, state.offset + state.limit);
  if (state.sort === 'file') scores = await scoreAll(set.dir, shown, light, dark, () => {});
  if (id !== renderId) return;
  const melted = (k: 'light' | 'dark') => [...scores.values()].filter((s) => s[k] > 0.5).length;
  status.textContent =
    `${shown.length} of ${total} shown` +
    ` · >50% melted${state.sort === 'file' ? ' (shown)' : ''}: light ${melted('light')}, dark ${melted('dark')}`;

  for (const k of ['light', 'dark'] as const) {
    const tile = (u: string) => {
      const s = scores.get(u)?.[k] ?? 0;
      const name = u.split('/').pop()!.replace(/\.png$/, '');
      const img = `<img src="${u}" alt="" loading="lazy" style="image-rendering:pixelated;max-width:${set.size * 1.4}px;max-height:${set.size}px" class="art-halo">`;
      return `<figure class="flex flex-col items-center gap-0.5" title="${name} · ${Math.round(s * 100)}% melted">
        <span class="flex items-end justify-center ${set.large ? 'art-spot' : ''}" style="width:${set.size * 1.5}px;height:${set.size * 1.1}px">${img}</span>
        <figcaption class="max-w-full truncate text-[10px] ${s > 0.5 ? 'font-semibold text-bad' : 'text-muted'}">${name}</figcaption>
      </figure>`;
    };
    panes[k].innerHTML = `<h2 class="section-label mb-2">${k} theme</h2>
      <div class="${state.backing ? '' : 'no-backing'} grid gap-2" style="grid-template-columns:repeat(auto-fill,minmax(${set.size * 1.5 + 8}px,1fr))">${shown.map(tile).join('')}</div>`;
  }
}

const style = document.createElement('style');
style.textContent = `body { overflow: auto } .no-backing .art-halo { filter: none } .no-backing .art-spot { background: none }`;
document.head.append(style);

render();
