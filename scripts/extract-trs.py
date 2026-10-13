#!/usr/bin/env python3
"""Extract images from Dominions 6 ``.trs`` texture archives to PNG.

Usage:
    python -I extract-trs.py OUT_DIR ARCHIVE.trs [ARCHIVE.trs ...] [--sheet]
    python -I extract-trs.py --unit-icons GAME_DATA_DIR OUT_DIR

The first form writes ``OUT_DIR/<archive>/<archive>_<index>.png`` for every
image. With ``--sheet`` it also writes ``OUT_DIR/<archive>_sheet.png``, a labeled
contact sheet (index under each image, mid-gray background).

The second form writes the named unit-card icons listed in UNIT_ICONS (this is
how public/gameicons/ is produced), e.g.
    python -I scripts/extract-trs.py --unit-icons ".../Dominions6/data" public/gameicons

Requires Pillow. Game assets are copyrighted by Illwinter Game Design.

TCSF format (reverse engineered, all integers big-endian)
---------------------------------------------------------
Header (12 bytes):
    0   4  magic "TCSF"
    4   2  u16 image count N
    6   2  u16 (always 4 so far, probably a version)
    8   4  unknown (e.g. 03 20 00 00)
Then N directory entries of 12 bytes each:
    0   1  width  (0 means 256)
    1   1  height (0 means 256)
    2   2  u16 flags: 0 = 16-bit pixels (RGB565), 4 = 24-bit pixels (RGB888)
    4   8  u64 absolute file offset of the image block
A block's length is the distance to the next block's offset (the last block
runs to end of file). Block layout:
    u32 R     number of runs (for flags 4 the leading u32 reads 0x00010001;
              treat it as "1 run" - it is a single full-image run)
    R x run:  skip, count, then ``count`` pixels
A value (skip or count) is one byte, unless that byte is 0xFF, in which case a
24-bit value follows (0xFF b1 b2 b3 -> b1<<16|b2<<8|b3). Pixels are laid out
in a row-major w*h grid; ``skip`` advances over fully transparent pixels,
``count`` pixels are opaque. Pixel data is raw RGB565 (2 bytes, big-endian) or
RGB888 (3 bytes). There is no partial alpha: every pixel is either opaque or
transparent (runs not covered are transparent). Rows are not delimited; runs
simply continue across row ends.

This decodes misc.trs, misc2.trs, res.trs and blast.trs. item.trs, sites.trs,
build.trs, tree.trs and mapstuff.trs use a different (undecoded) variant.
Other useful ranges: res.trs 396-400 leadership banners with 0-4 stars,
401-410 magic paths F A W E S D N G B H; most of res.trs is ability icons.
"""
import os
import struct
import sys

from PIL import Image, ImageDraw

# Unit-card icons: output name -> (archive, index). Stat names are the upstream
# stat row keys used by src/ui/unitCard.ts.
UNIT_ICONS = {
    'stat-goldcost': ('misc', 160), 'stat-rcost': ('misc', 161), 'stat-leader': ('misc', 162),
    'stat-rpcost': ('misc', 166), 'stat-undeadleader': ('misc', 170), 'stat-magicleader': ('misc', 171),
    'stat-hp': ('res', 381), 'stat-size': ('res', 382), 'stat-prot': ('res', 383), 'stat-mr': ('res', 384),
    'stat-mor': ('res', 385), 'stat-str': ('res', 386), 'stat-att': ('res', 387), 'stat-def': ('res', 388),
    'stat-prec': ('res', 389), 'stat-ap': ('res', 390), 'stat-mapmove': ('res', 391), 'stat-enc': ('res', 392),
    'stat-fatigue': ('res', 393), 'stat-maxage': ('res', 394), 'stat-xp': ('res', 395),
    'slot-hand': ('misc2', 0), 'slot-offhand': ('misc2', 1), 'slot-bow': ('misc2', 2), 'slot-head': ('misc2', 3),
    'slot-body': ('misc2', 4), 'slot-feet': ('misc2', 5), 'slot-misc': ('misc2', 6),
    # abilities and flags (ability row keys / flag names in the upstream html), checked against in-game
    # hover tooltips; supplybonus, siegebonus, mastersmith, swampsurvival, aquatic and demon are visual guesses
    'abil-fireres': ('res', 1), 'abil-coldres': ('res', 2), 'abil-poisonres': ('res', 3), 'abil-shockres': ('res', 4),
    'abil-diseaseres': ('res', 237), 'abil-heat': ('res', 11), 'abil-cold': ('res', 10), 'abil-fireshield': ('res', 59),
    'abil-poisoncloud': ('res', 101), 'abil-poisonarmor': ('res', 116), 'abil-invulnerable': ('res', 164),
    'abil-darkvision': ('res', 96), 'abil-blind': ('res', 97), 'abil-supplybonus': ('res', 87), 'abil-stealthy': ('res', 30),
    'abil-fear': ('res', 6), 'abil-awe': ('res', 40), 'abil-standard': ('res', 41), 'abil-berserk': ('res', 62),
    'abil-regeneration': ('res', 463), 'abil-bodyguard': ('res', 184), 'abil-ambidextrous': ('res', 219),
    'abil-patrolbonus': ('res', 90), 'abil-siegebonus': ('res', 81), 'abil-castledef': ('res', 88),
    'abil-mastersmith': ('res', 89), 'abil-seduce': ('res', 95), 'abil-magicpower': ('res', 196),
    'abil-firepower': ('res', 113), 'abil-darkpower': ('res', 115),
    'abil-holy': ('res', 17), 'abil-forestsurvival': ('res', 73), 'abil-mountainsurvival': ('res', 72),
    'abil-wastesurvival': ('res', 71), 'abil-swampsurvival': ('res', 74), 'abil-flying': ('res', 28),
    'abil-aquatic': ('res', 14), 'abil-amphibian': ('res', 15), 'abil-pooramphibian': ('res', 16),
    'abil-demon': ('res', 57), 'abil-ethereal': ('res', 21), 'abil-unseen': ('res', 337), 'abil-spiritsight': ('res', 300),
    'abil-magicbeing': ('res', 36), 'abil-trample': ('res', 25), 'abil-coldblood': ('res', 19),
    'abil-stormimmune': ('res', 217), 'abil-neednoteat': ('res', 43),
    # "Susceptible to ..." (negative resistance); fire, cold and acid checked in game
    'sus-fireres': ('res', 75), 'sus-coldres': ('res', 76), 'sus-poisonres': ('res', 109),
    'sus-shockres': ('res', 110), 'sus-acidres': ('res', 370),
}


def read_val(b, p):
    v = b[p]
    p += 1
    if v == 0xFF:
        v = (b[p] << 16) | (b[p + 1] << 8) | b[p + 2]
        p += 3
    return v, p


def decode_block(b, w, h, flags):
    bpp = 3 if flags & 4 else 2
    runs = struct.unpack('>I', b[:4])[0] if not flags & 4 else 1
    p = 4
    px = [None] * (w * h)
    pos = 0
    for _ in range(runs):
        skip, p = read_val(b, p)
        cnt, p = read_val(b, p)
        pos += skip
        for i in range(cnt):
            c = b[p:p + bpp]
            p += bpp
            if bpp == 3:
                r, g, bl = c
            else:
                v = (c[0] << 8) | c[1]
                r = (v >> 11) & 31
                g = (v >> 5) & 63
                bl = v & 31
                r = (r << 3) | (r >> 2)
                g = (g << 2) | (g >> 4)
                bl = (bl << 3) | (bl >> 2)
            if pos < len(px):
                px[pos] = (r, g, bl, 255)
            pos += 1
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    img.putdata([q if q else (0, 0, 0, 0) for q in px])
    return img, p == len(b)


def read_archive(path):
    d = open(path, 'rb').read()
    if d[:4] != b'TCSF':
        raise ValueError('not a TCSF archive: ' + path)
    n = struct.unpack('>H', d[4:6])[0]
    ents = []
    for i in range(n):
        e = d[12 + i * 12:24 + i * 12]
        ents.append((e[0] or 256, e[1] or 256, struct.unpack('>H', e[2:4])[0],
                     struct.unpack('>Q', e[4:])[0]))
    offs = [e[3] for e in ents] + [len(d)]
    for i, (w, h, fl, off) in enumerate(ents):
        yield i, w, h, fl, d[off:offs[i + 1]]


def make_sheet(images, path, cell=None):
    if not images:
        return
    cell = cell or max(max(im.size) for _, im in images)
    cell = min(cell, 128)
    cols = 12
    rows = (len(images) + cols - 1) // cols
    pad, label = 6, 14
    W = cols * (cell + pad) + pad
    H = rows * (cell + pad + label) + pad
    sheet = Image.new('RGBA', (W, H), (128, 128, 128, 255))
    dr = ImageDraw.Draw(sheet)
    for k, (idx, im) in enumerate(images):
        x = pad + (k % cols) * (cell + pad)
        y = pad + (k // cols) * (cell + pad + label)
        if max(im.size) > cell:
            s = cell / max(im.size)
            im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))))
        sheet.alpha_composite(im, (x, y))
        dr.text((x, y + cell + 1), str(idx), fill=(255, 255, 0, 255))
    sheet.save(path)


def extract_unit_icons(data_dir, out):
    os.makedirs(out, exist_ok=True)
    archives = {}
    for name, (arc, idx) in sorted(UNIT_ICONS.items()):
        if arc not in archives:
            archives[arc] = {i: (w, h, fl, blk) for i, w, h, fl, blk in
                             read_archive(os.path.join(data_dir, arc + '.trs'))}
        w, h, fl, blk = archives[arc][idx]
        decode_block(blk, w, h, fl)[0].save(os.path.join(out, name + '.png'), optimize=True)
    print('%d icons written to %s' % (len(UNIT_ICONS), out))


def main(argv):
    if argv[:1] == ['--unit-icons'] and len(argv) == 3:
        extract_unit_icons(argv[1], argv[2])
        return 0
    sheet = '--sheet' in argv
    args = [a for a in argv if a != '--sheet']
    if len(args) < 2:
        print(__doc__)
        return 1
    out = args[0]
    for path in args[1:]:
        name = os.path.splitext(os.path.basename(path))[0]
        odir = os.path.join(out, name)
        os.makedirs(odir, exist_ok=True)
        images, bad = [], 0
        for i, w, h, fl, blk in read_archive(path):
            try:
                im, ok = decode_block(blk, w, h, fl)
            except Exception:
                bad += 1
                continue
            if not ok:
                bad += 1
            im.save(os.path.join(odir, '%s_%d.png' % (name, i)))
            images.append((i, im))
        print('%s: %d images, %d with size/format anomalies' % (name, len(images), bad))
        if sheet:
            make_sheet(images, os.path.join(out, name + '_sheet.png'))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
