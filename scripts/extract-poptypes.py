#!/usr/bin/env python3
"""Extract the vanilla Dominions 6 population types (poptypes) from Dominions6.exe.

Usage:
    python -I scripts/extract-poptypes.py DOMINIONS6_EXE BASEU_CSV OUT_DIR [--inputs FILE]

    e.g. python -I scripts/extract-poptypes.py \
             "C:/Program Files (x86)/Steam/steamapps/common/Dominions6/Dominions6.exe" \
             public/gamedata/BaseU.csv src/data/poptypes

Writes (this is how src/data/poptypes/ is produced; both files are committed):
    OUT_DIR/vanilla.dm           the vanilla poptypes as mod commands (#selectpoptype ... #end). The app loads it
                                 through the same parser as user mods, before them (src/data/load.ts).
    OUT_DIR/poptypes.meta.json   everything a mod file cannot carry: official names, terrain and era availability,
                                 shadowed duplicate pairs, extra engine keys, verification status, provenance.

--inputs defaults to scripts/poptype-inputs.json (next to this script). It holds the data that is not read from the
exe by this script: the official names (modding manual v6.36, p.62), the in-game verification list and the
terrain/era availability, decoded earlier from the map generator by abstract interpretation of the disassembly (that
decoder is not part of this repo; the file records the generator function addresses and the exe hash it was run on).
The script warns when the exe hash differs from the one the terrain data was decoded from.

Where the data lives in the exe (x64 PE, imagebase 0x140000000)
---------------------------------------------------------------
The mod parser function that prints "Bad #selectpoptype command" initialises two static tables for all 250 ids with
a memcpy from a static default image: `mov r8d, <size>` followed by `lea rdx, [rip+disp]`. Each table is found by
the size (size / 250 = row stride), so the script survives rebuilds that move the tables.
    recruit table, stride 168 bytes = 42 x i32: unit ids, then -2, then commander ids, then -1 (0 pads the rest)
    PD table,      stride  68 bytes = 17 x i32: up to 8 (key, value) pairs, key 0 ends the list
PD keys: 215 defunit1, 216 defmult1, 217 defcom1, 218 defunit1b, 219 defmult1b, 220 defunit1c, 221 defmult1c have
mod commands. 235 is an alternative PD commander that overrides defcom1 (confirmed in game: poptype 88 defends
with unit 1609 although its defcom1 is not set). 230 is never read by the engine (rows 103 and 105). The engine
takes the FIRST pair matching a key and vanilla rows 38, 58 and 86 repeat keys; the mod command #defunit1 etc.
replaces the first match, so only the first occurrence of a key is written to the .dm and the later ones go to the
meta file as shadowed pairs.

Game data is copyrighted by Illwinter Game Design; only ids, numbers and the manual's labels are extracted.
"""
import csv
import hashlib
import json
import os
import re
import struct
import sys

PD_KEYS = {
    215: 'defunit1', 216: 'defmult1', 217: 'defcom1',
    218: 'defunit1b', 219: 'defmult1b',
    220: 'defunit1c', 221: 'defmult1c',
}
ALT_PD_COMMANDER_KEY = 235
UNUSED_PD_KEY = 230
STRIDES = {168: 'recruit', 68: 'pd'}
ROWS = 250
ERAS = ('EA', 'MA', 'LA')
TERRAINS = ('deepsea', 'sea', 'cave', 'farm', 'forest', 'mountain', 'swamp', 'waste', 'plains')


class PE:
    """Minimal x64 PE reader: section table and RVA/offset conversion."""

    def __init__(self, path):
        with open(path, 'rb') as f:
            self.d = d = f.read()
        e = struct.unpack_from('<I', d, 0x3C)[0]
        if d[e:e + 4] != b'PE\0\0':
            raise SystemExit('not a PE file: ' + path)
        nsec, = struct.unpack_from('<H', d, e + 6)
        osz, = struct.unpack_from('<H', d, e + 20)
        so = e + 24 + osz
        self.secs = []  # (name, rva, vsize, file offset, raw size)
        for i in range(nsec):
            n, vs, va, rs, ro = struct.unpack_from('<8sIIII', d, so + i * 40)
            self.secs.append((n.rstrip(b'\0').decode(), va, vs, ro, rs))

    def off2rva(self, off):
        for _, va, _, ro, rs in self.secs:
            if ro <= off < ro + rs:
                return va + off - ro
        raise ValueError('offset outside sections')

    def rva2off(self, rva):
        for _, va, vs, ro, rs in self.secs:
            if va <= rva < va + max(vs, rs):
                return ro + rva - va
        raise ValueError('rva outside sections')


def find_tables(p):
    """Returns {stride: rva} for the recruit and PD default tables."""
    d = p.d
    name, tva, _, tro, trs = next(s for s in p.secs if s[0] == '.text')
    tb = d[tro:tro + trs]

    # string xref: lea reg, [rip+disp] pointing at the error string of the #selectpoptype handler
    s_off = d.find(b'Bad #selectpoptype command\0')
    if s_off < 0:
        raise SystemExit('"Bad #selectpoptype command" not found; this exe layout is not supported')
    s_rva = p.off2rva(s_off)
    fn = None
    for m in re.finditer(rb'[\x48\x4c]\x8d[\x05\x0d\x15\x1d\x25\x2d\x35\x3d]', tb):
        i = m.start()
        disp = struct.unpack_from('<i', tb, i + 3)[0]
        if tva + i + 7 + disp == s_rva:
            fn = i
            break
    if fn is None:
        raise SystemExit('no code references the "Bad #selectpoptype command" string')

    # memcpy-from-default sequences around it: mov r8d,imm32 ; lea rdx,[rip+disp]
    found = {}
    for m in re.finditer(rb'\x41\xB8(.{4})', tb[max(0, fn - 0x600):fn + 0x600], re.S):
        i = max(0, fn - 0x600) + m.start()
        size, = struct.unpack_from('<I', tb, i + 2)
        if size % ROWS or size // ROWS not in STRIDES:
            continue
        j = tb.find(b'\x48\x8d\x15', i + 6, i + 30)
        if j < 0:
            continue
        disp = struct.unpack_from('<i', tb, j + 3)[0]
        found[size // ROWS] = tva + j + 7 + disp
    if set(found) != set(STRIDES):
        raise SystemExit('could not locate both poptype tables, found strides %s' % sorted(found))
    return found


def read_poptypes(p):
    tabs = find_tables(p)
    out = {}
    rec_off, pd_off = p.rva2off(tabs[168]), p.rva2off(tabs[68])
    for i in range(ROWS):
        r = struct.unpack_from('<42i', p.d, rec_off + i * 168)
        units, coms = [], []
        cur = units
        for v in r:
            if v == -2:
                cur = coms
            elif v in (-1, 0):
                break
            else:
                cur.append(v)
        pairs = []
        pr = struct.unpack_from('<17i', p.d, pd_off + i * 68)
        for k in range(0, 16, 2):
            if pr[k] == 0:
                break
            pairs.append((pr[k], pr[k + 1]))
        if units or coms or pairs:
            out[i] = dict(recunits=units, reccoms=coms, pairs=pairs)
    return out, tabs


def split_pairs(pairs):
    """-> (pd list for the .dm: first occurrence per mod key, shadowed, alt commander, unused data, other keys)."""
    seen, pd, shadowed, other = set(), [], [], []
    alt = unused = None
    for key, val in pairs:
        if key == ALT_PD_COMMANDER_KEY:
            alt = val
        elif key == UNUSED_PD_KEY:
            unused = val
        elif key in PD_KEYS:
            name = PD_KEYS[key]
            if name in seen:
                shadowed.append([name, val])
            else:
                seen.add(name)
                pd.append([name, val])
        else:
            other.append([key, val])
    return pd, shadowed, alt, unused, other


def load_unit_names(path):
    names = {}
    with open(path, encoding='utf-8', errors='replace', newline='') as f:
        for r in list(csv.reader(f, delimiter='\t'))[1:]:
            try:
                names[int(r[0])] = r[1]
            except (ValueError, IndexError):
                pass
    return names


def comment_name(names, uid):
    n = names.get(uid)
    return ' -- ' + n.replace('"', "'").replace('\n', ' ') if n else ''


def build_dm(pops, names, pop_names, header):
    lines = ['-- ' + h for h in header] + ['']
    for pid in sorted(pops):
        row = pops[pid]
        pd, _, _, _, _ = split_pairs(row['pairs'])
        label = pop_names.get(str(pid))
        lines.append('#selectpoptype %d%s' % (pid, ' -- ' + label if label else ''))
        for u in row['recunits']:
            lines.append('#addrecunit %d%s' % (u, comment_name(names, u)))
        for u in row['reccoms']:
            lines.append('#addreccom %d%s' % (u, comment_name(names, u)))
        for key, val in pd:
            is_unit = key.startswith(('defunit', 'defcom'))
            lines.append('#%s %d%s' % (key, val, comment_name(names, val) if is_unit else ''))
        lines.append('#end')
        lines.append('')
    return '\n'.join(lines)


def invert_terrain(terr):
    """byEra {era: {terrain: [ids]}} -> {id: {era: [terrains in TERRAINS order]}}."""
    res = {}
    for era in ERAS:
        for t in TERRAINS:
            for pid in terr['byEra'][era][t]:
                res.setdefault(pid, {e: [] for e in ERAS})[era].append(t)
    return res


def main(argv):
    args = [a for a in argv[1:] if not a.startswith('--')]
    inputs_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'poptype-inputs.json')
    if '--inputs' in argv:
        inputs_path = argv[argv.index('--inputs') + 1]
        args.remove(inputs_path)
    if len(args) != 3:
        raise SystemExit(__doc__)
    exe, baseu, outdir = args
    with open(inputs_path, encoding='utf-8') as f:
        inputs = json.load(f)

    p = PE(exe)
    sha = hashlib.sha256(p.d).hexdigest()
    size = len(p.d)
    pops, tabs = read_poptypes(p)
    names = load_unit_names(baseu)
    pop_names = inputs['names']['names']
    terr = inputs['terrain']
    if terr['exe']['sha256'] != sha:
        print('warning: the terrain data was decoded from an exe with sha256 %s, this one is %s; '
              'terrain/era lists may be stale' % (terr['exe']['sha256'], sha), file=sys.stderr)
    missing = sorted(set(pops) - {int(k) for k in pop_names})
    if missing:
        print('warning: no official name for poptypes %s' % missing, file=sys.stderr)

    header = [
        'Vanilla Dominions 6 population types (poptypes). GENERATED, do not edit.',
        'Generated by scripts/extract-poptypes.py from Dominions6.exe',
        'exe size: %d bytes, sha256: %s' % (size, sha),
        'Only the first pair of a repeated province defence key is written (the engine uses the first match);',
        'engine keys 230 and 235 have no mod command and are in poptypes.meta.json.',
        'Official names (modding manual v6.36) are in the #selectpoptype comments; see poptypes.meta.json.',
    ]
    os.makedirs(outdir, exist_ok=True)
    dm = build_dm(pops, names, pop_names, header)
    with open(os.path.join(outdir, 'vanilla.dm'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(dm)

    by_id = invert_terrain(terr)
    special = {pid: [e for e in ERAS if pid in terr['special']['byEra'][e]] for pid in pops}
    ver = inputs['verification']
    meta_pops = {}
    for pid in sorted(pops):
        pd, shadowed, alt, unused, other = split_pairs(pops[pid]['pairs'])
        v = {'recruits': 'extracted from exe', 'pd': 'extracted from exe'}
        if pid in ver['pdConfirmed']:
            v['pd'] = 'confirmed in game (units, multipliers, commander)'
        elif pid in ver['pdUnitsOnly']:
            v['pd'] = 'units confirmed in game, commander unconfirmed'
        if pid in ver['firstMatchDuplicateConfirmed']:
            v['shadowedPd'] = 'first match confirmed in game'
        if pid in ver['altPdCommanderConfirmed']:
            v['altPdCommander'] = 'confirmed in game'
        entry = {
            'name': pop_names.get(str(pid)),
            'nameSource': inputs['names']['nameSource'] if str(pid) in pop_names else None,
            'terrain': by_id.get(pid, {e: [] for e in ERAS}),
            'specialEras': special[pid],
            'shadowedPd': shadowed,
            'altPdCommander': alt,
            'unusedPdData': unused,
            'otherKeys': other,
            'verification': v,
        }
        meta_pops[str(pid)] = entry
    meta = {
        'provenance': {
            'generator': 'scripts/extract-poptypes.py',
            'exe': {'file': os.path.basename(exe), 'size': size, 'sha256': sha},
            'tables': {STRIDES[s]: '0x%X' % va for s, va in sorted(tabs.items())},
            'names': inputs['names']['source'],
            'terrain': {
                'note': terr['provenance'],
                'special': terr['special']['note'],
                'decodedFromExeSha256': terr['exe']['sha256'],
            },
            'verification': ver['note'],
        },
        'terrains': list(TERRAINS),
        'eras': list(ERAS),
        'poptypes': meta_pops,
    }
    with open(os.path.join(outdir, 'poptypes.meta.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(meta, f, indent=1)
        f.write('\n')
    print('%d poptypes -> %s' % (len(pops), outdir), file=sys.stderr)


if __name__ == '__main__':
    main(sys.argv)
