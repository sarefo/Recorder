"""Read a single-staff score image: staff lines, noteheads, barlines, pitch names.

Usage:
  py staff_scan.py band.png [--clef bass] [--xstart 320] [--tint tinted.png]

Input is a horizontal crop containing exactly ONE five-line staff (crop each
system's staff to its own band first; ~25px between staff lines after a 3x
upscale works well). Prints one line per detected notehead — x position, pitch
name (diatonic letter for the clef; apply the key signature yourself), and
filled/hollow — plus the barline x positions, so heads can be grouped into bars
and bar lengths sanity-checked against the meter.

Detection strategy: staff lines from full-width dark rows; staff lines removed
(keeping vertically-continuous pixels) so shapes separate; hollow heads found
as enclosed white holes; filled heads found at stem ends (ellipse fill check,
with a horizontal-extent test so beam ends are not mistaken for heads).

It MISSES some heads — hollow heads whose rim the line-removal nicks, graces,
flagged eighths at odd angles. Treat the output as one of two reads: also
generate the --tint image (background stripes coloured per diatonic step, same
letter = same colour, labels in the margin) and read that visually. Every note
should be confirmed by both reads or by a dedicated zoom; every bar must sum to
the meter; ties must join equal pitches. That triple check is what stands in
for a source-MIDI diff when the only source is paper.
"""
from PIL import Image, ImageDraw
import os, sys
from collections import deque

TREBLE = {-6:'D6',-5:'C6',-4:'B5',-3:'A5',-2:'G5',-1:'G5',0:'F5',1:'E5',2:'D5',3:'C5',
          4:'B4',5:'A4',6:'G4',7:'F4',8:'E4',9:'D4',10:'C4',11:'B3',12:'A3'}
BASS = {-6:'F4',-5:'E4',-4:'D4',-3:'C4',-2:'B3',-1:'B3',0:'A3',1:'G3',2:'F3',3:'E3',
        4:'D3',5:'C3',6:'B2',7:'A2',8:'G2',9:'F2',10:'E2',11:'D2',12:'C2'}
PALETTE = {'C':(255,170,170),'D':(255,210,120),'E':(255,255,120),'F':(150,255,150),
           'G':(120,230,255),'A':(170,170,255),'B':(240,170,255)}
SEQ_TREBLE = ['F','E','D','C','B','A','G']   # letter at step 0, 1, 2... (top line down)
SEQ_BASS = ['A','G','F','E','D','C','B']


def staff_lines(px, w, h):
    hits = []
    for y in range(h):
        cnt = n = 0
        for x in range(300, w - 10, 4):
            n += 1
            if px[x, y] < 180:
                cnt += 1
        if n and cnt / n > 0.5:
            hits.append(y)
    groups = []
    start = prev = hits[0]
    for y in hits[1:]:
        if y - prev > 3:
            groups.append((start + prev) / 2)
            start = y
        prev = y
    groups.append((start + prev) / 2)
    return groups


def main():
    args = sys.argv[1:]
    clef = 'treble'
    xstart = 320
    tint_out = None
    files = []
    i = 0
    while i < len(args):
        if args[i] == '--clef':
            clef = args[i + 1]; i += 2
        elif args[i] == '--xstart':
            xstart = int(args[i + 1]); i += 2
        elif args[i] == '--tint':
            tint_out = args[i + 1]; i += 2
        else:
            files.append(args[i]); i += 1
    names = BASS if clef == 'bass' else TREBLE
    seq = SEQ_BASS if clef == 'bass' else SEQ_TREBLE

    for fname in files:
        im = Image.open(fname).convert('L')
        w, h = im.size
        px = im.load()
        lines = staff_lines(px, w, h)
        if len(lines) != 5:
            print(f'{fname}: expected 5 staff lines, found {len(lines)}: {lines}')
            continue
        s = (lines[4] - lines[0]) / 4
        top = lines[0]

        if tint_out:
            out = Image.new('RGB', (w, h), (255, 255, 255))
            po = out.load()
            for y in range(h):
                step = round((y - top) / (s / 2))
                band = PALETTE[seq[step % 7]] if -5 <= step <= 12 else (255, 255, 255)
                for x in range(w):
                    v = px[x, y]
                    po[x, y] = band if v > 170 else (v, v, v)
            dr = ImageDraw.Draw(out)
            for st, nm in names.items():
                y = top + st * s / 2
                if 0 <= y < h:
                    dr.text((3, y - 7), nm, fill=(0, 0, 0))
                    dr.text((w - 30, y - 7), nm, fill=(0, 0, 0))
            out.save(tint_out)

        ymin = max(0, int(top - 2.8 * s))
        ymax = min(h, int(lines[4] + 2.4 * s))
        dark = [[False] * w for _ in range(h)]
        linerows = set()
        for ly in lines:
            for yy in range(int(ly) - 2, int(ly) + 4):
                linerows.add(yy)
        for y in range(ymin, ymax):
            for x in range(xstart, w):
                if px[x, y] < 150:
                    if y in linerows:
                        if (y - 3 >= 0 and px[x, y - 3] < 150) or (y + 3 < h and px[x, y + 3] < 150):
                            dark[y][x] = True
                    else:
                        dark[y][x] = True

        heads = []

        # hollow heads: enclosed white holes
        lab = [[0] * w for _ in range(h)]
        q = deque()
        for x in range(xstart, w):
            for yb in (ymin, ymax - 1):
                if not dark[yb][x] and lab[yb][x] == 0:
                    lab[yb][x] = 1; q.append((x, yb))
        for yy in range(ymin, ymax):
            for xb in (xstart, w - 1):
                if not dark[yy][xb] and lab[yy][xb] == 0:
                    lab[yy][xb] = 1; q.append((xb, yy))
        while q:
            x, y = q.popleft()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if xstart <= nx < w and ymin <= ny < ymax and not dark[ny][nx] and lab[ny][nx] == 0:
                    lab[ny][nx] = 1; q.append((nx, ny))
        for y0 in range(ymin, ymax):
            for x0 in range(xstart, w):
                if not dark[y0][x0] and lab[y0][x0] == 0:
                    q2 = deque([(x0, y0)]); lab[y0][x0] = 2
                    minx = maxx = x0; miny = maxy = y0; cnt = sx = sy = 0
                    while q2:
                        x, y = q2.popleft()
                        cnt += 1; sx += x; sy += y
                        minx = min(minx, x); maxx = max(maxx, x)
                        miny = min(miny, y); maxy = max(maxy, y)
                        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                            nx, ny = x + dx, y + dy
                            if xstart <= nx < w and ymin <= ny < ymax and not dark[ny][nx] and lab[ny][nx] == 0:
                                lab[ny][nx] = 2; q2.append((nx, ny))
                    bw = maxx - minx + 1; bh = maxy - miny + 1
                    if 120 < cnt < 900 and 0.5 * s < bw < 2.2 * s and 0.35 * s < bh < 1.2 * s:
                        heads.append((sx / cnt, sy / cnt, 'hollow', cnt))

        # stems -> filled heads
        stemcols = {}
        for x in range(xstart, w):
            y = ymin
            while y < ymax:
                if dark[y][x]:
                    y2 = y
                    while y2 + 1 < ymax and dark[y2 + 1][x]:
                        y2 += 1
                    if y2 - y >= int(2.0 * s):
                        stemcols.setdefault(x, []).append((y, y2))
                    y = y2 + 1
                else:
                    y += 1
        xs = sorted(stemcols)
        groups = []
        cur = []
        for x in xs:
            if cur and x - cur[-1] > 2:
                groups.append(cur); cur = []
            cur.append(x)
        if cur:
            groups.append(cur)

        def headcheck(cx, cy):
            c = n = 0
            for dy in range(int(-0.38 * s), int(0.38 * s) + 1, 2):
                for dx in range(int(-0.5 * s), int(0.5 * s) + 1, 2):
                    if (dx / (0.55 * s)) ** 2 + (dy / (0.4 * s)) ** 2 <= 1:
                        n += 1
                        xx, yy = int(cx + dx), int(cy + dy)
                        if 0 <= xx < w and 0 <= yy < h and dark[yy][xx]:
                            c += 1
            return c / n if n else 0

        for grp in groups:
            if len(grp) > 7:
                continue
            gx = sum(grp) / len(grp)
            runs = []
            for x in grp:
                runs.extend(stemcols[x])
            ytop = min(r[0] for r in runs); ybot = max(r[1] for r in runs)
            if ybot - ytop < 2.4 * s:
                continue
            for endy, side in ((ybot, 'up'), (ytop, 'down')):
                cx = gx - 0.55 * s if side == 'up' else gx + 0.55 * s
                cy0 = endy - 0.1 * s if side == 'up' else endy + 0.1 * s
                f = headcheck(cx, cy0)
                far = 0
                for sgn in (-1, 1):
                    xx = int(cx + sgn * 1.5 * s)
                    c2 = sum(1 for yy in range(int(cy0 - 0.3 * s), int(cy0 + 0.3 * s))
                             if 0 <= xx < w and 0 <= yy < h and dark[yy][xx])
                    far = max(far, c2 / (0.6 * s))
                if f > 0.75 and far < 0.5:
                    sx = sy = cnt = 0
                    for yy in range(int(endy - 0.9 * s), int(endy + 0.9 * s)):
                        for xx in range(int(cx - 0.9 * s), int(cx + 0.9 * s)):
                            if 0 <= xx < w and 0 <= yy < h and dark[yy][xx] and abs(xx - gx) > 2:
                                sx += xx; sy += yy; cnt += 1
                    if cnt:
                        heads.append((sx / cnt, sy / cnt, f'filled-{side}', cnt))

        heads.sort()
        kept = []
        for hx, hy, kind, cnt in heads:
            if not any(abs(hx - ox) < 0.9 * s and abs(hy - oy) < 0.8 * s for ox, oy, _, _ in kept):
                kept.append((hx, hy, kind, cnt))

        # barlines: full-staff verticals with clear space either side
        bars = []
        y0b, y1b = int(lines[0]), int(lines[4])
        x = xstart + 2
        while x < w - 20:
            if all(any(px[xx, y] < 150 for xx in (x - 1, x, x + 1)) for y in range(y0b, y1b)):
                x2 = x
                while x2 + 2 < w - 2 and all(any(px[xx, y] < 150 for xx in (x2, x2 + 1)) for y in range(y0b, y1b)):
                    x2 += 1
                mid = (x + x2) // 2
                clear = tot = 0
                for y in range(y0b + 3, y1b - 2, 4):
                    tot += 1
                    if all(px[mid + dx, y] >= 150 for dx in (8, 12, 16) if 0 <= mid + dx < w) and \
                       all(px[mid + dx, y] >= 150 for dx in (-8, -12, -16) if 0 <= mid + dx < w):
                        clear += 1
                if tot and clear / tot > 0.55:
                    bars.append(mid)
                x = x2 + 2
            x += 1

        print(f'== {fname}  spacing={s:.1f}  lines={[round(l, 1) for l in lines]}')
        print(f'   barlines: {bars}')
        for hx, hy, kind, cnt in kept:
            step = round((hy - top) / (s / 2))
            print(f'   x={hx:6.0f}  {names.get(step, "step" + str(step)):3s}  {kind:11s} y={hy:.0f} n={cnt}')


if __name__ == '__main__':
    main()
