#!/usr/bin/env python3
"""Stdlib-only GLB inspector + software renderer (reads the GLB, never the bbmodel).

    python3 judge/tools/glbcheck.py check  model.glb
    python3 judge/tools/glbcheck.py render model.glb out.png [--anim NAME --time T] [--yaw DEG] [--pitch DEG] [--view-from -z|+z]
    python3 judge/tools/glbcheck.py preview model.glb out.png   # the 4-frame strip in dist/preview-glb.png

check : header/chunk alignment, buffer + bufferView + accessor bounds,
        POSITION min/max vs. data, index range, node/animation references,
        node-graph acyclicity. Exit code 1 on any failure.
render: orthographic z-buffered flat-shaded raster with NEAREST texture sampling,
        applying the node hierarchy and (optionally) one animation at time T
        (LINEAR/STEP sampling of the file's own channels).
"""
import json, math, struct, sys, zlib

CT = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def load(path):
    b = open(path, 'rb').read()
    magic, ver, length = struct.unpack_from('<4sII', b, 0)
    errs = []
    if magic != b'glTF' or ver != 2: errs.append('bad header %r v%d' % (magic, ver))
    if length != len(b): errs.append('header length %d != file %d' % (length, len(b)))
    off, chunks = 12, []
    while off < len(b):
        cl, ct = struct.unpack_from('<I4s', b, off)
        if cl % 4: errs.append('chunk %r length %d not 4-aligned' % (ct, cl))
        chunks.append((ct, b[off + 8: off + 8 + cl])); off += 8 + cl
    if off != len(b): errs.append('trailing bytes')
    if not chunks or chunks[0][0] != b'JSON': errs.append('first chunk is not JSON')
    if len(chunks) < 2 or chunks[1][0] != b'BIN\0': errs.append('second chunk is not BIN')
    g = json.loads(chunks[0][1].decode())
    return g, (chunks[1][1] if len(chunks) > 1 else b''), errs


def read_acc(g, bin_, i):
    a = g['accessors'][i]; v = g['bufferViews'][a['bufferView']]
    fmt, sz = CT[a['componentType']]; n = NC[a['type']]
    stride = v.get('byteStride') or sz * n
    base = v.get('byteOffset', 0) + a.get('byteOffset', 0)
    rows = []
    for k in range(a['count']):
        rows.append(struct.unpack_from('<%d%s' % (n, fmt), bin_, base + k * stride))
    return rows


def check(path):
    g, bin_, errs = load(path)
    err = errs.append
    if g['buffers'][0]['byteLength'] != len(bin_): err('buffer byteLength %d != BIN chunk %d' % (g['buffers'][0]['byteLength'], len(bin_)))
    for i, v in enumerate(g['bufferViews']):
        if v['byteOffset'] + v['byteLength'] > len(bin_): err('bufferView %d out of bounds' % i)
    for i, a in enumerate(g['accessors']):
        fmt, sz = CT[a['componentType']]; n = NC[a['type']]; v = g['bufferViews'][a['bufferView']]
        need = a.get('byteOffset', 0) + a['count'] * sz * n
        if need > v['byteLength']: err('accessor %d overruns its bufferView' % i)
        if (v['byteOffset'] + a.get('byteOffset', 0)) % sz: err('accessor %d misaligned' % i)
    nverts = 0; ntri = 0
    for mi, m in enumerate(g['meshes']):
        for p in m['primitives']:
            pa = p['attributes']['POSITION']; rows = read_acc(g, bin_, pa); a = g['accessors'][pa]
            nverts += len(rows); idx = [r[0] for r in read_acc(g, bin_, p['indices'])]; ntri += len(idx) // 3
            if idx and max(idx) >= len(rows): err('mesh %d index out of range' % mi)
            if len(idx) % 3: err('mesh %d index count not multiple of 3' % mi)
            for c in range(3):
                lo, hi = min(r[c] for r in rows), max(r[c] for r in rows)
                if abs(lo - a['min'][c]) > 1e-6 or abs(hi - a['max'][c]) > 1e-6: err('POSITION min/max mismatch mesh %d axis %d' % (mi, c))
            if not 0 <= p['material'] < len(g['materials']): err('bad material ref')
    nn = len(g['nodes'])
    for i, n in enumerate(g['nodes']):
        for c in n.get('children', []):
            if not 0 <= c < nn: err('node %d bad child' % i)
        if 'mesh' in n and not 0 <= n['mesh'] < len(g['meshes']): err('node %d bad mesh' % i)
    parent = {}
    for i, n in enumerate(g['nodes']):
        for c in n.get('children', []):
            if c in parent: err('node %d has two parents' % c)
            parent[c] = i
    for i in range(nn):
        seen, x = set(), i
        while x in parent:
            if x in seen: err('cycle at node %d' % i); break
            seen.add(x); x = parent[x]
    for an in g.get('animations', []):
        for ch in an['channels']:
            if not 0 <= ch['target']['node'] < nn: err('%s: channel targets missing node' % an['name'])
            s = an['samplers'][ch['sampler']]
            ti = read_acc(g, bin_, s['input']); ts = [t[0] for t in ti]
            if any(ts[k] >= ts[k + 1] for k in range(len(ts) - 1)): err('%s: times not strictly increasing' % an['name'])
            if len(read_acc(g, bin_, s['output'])) != len(ts): err('%s: sampler in/out count mismatch' % an['name'])
            if ch['target']['path'] == 'rotation':
                for q in read_acc(g, bin_, s['output']):
                    if abs(sum(x * x for x in q) - 1) > 1e-4: err('%s: non-unit quaternion' % an['name']); break
    print('%s: %d bytes, %d nodes, %d meshes, %d verts, %d tris, %d materials, %d images, %d animations' % (
        path, len(bin_), nn, len(g['meshes']), nverts, ntri, len(g['materials']), len(g['images']), len(g.get('animations', []))))
    for an in g.get('animations', []):
        d = max(read_acc(g, bin_, s['input'])[-1][0] for s in an['samplers'])
        print('  anim %-13s %2d channels, %.2fs' % (an['name'], len(an['channels']), d))
    print('FAIL' if errs else 'OK'); [print('  ERROR', e) for e in errs]
    return 1 if errs else 0


# ---------- renderer ----------
def png_decode(raw):
    assert raw[:8] == b'\x89PNG\r\n\x1a\n'
    pos, idat, w = 8, b'', None
    while pos < len(raw):
        ln, ty = struct.unpack_from('>I4s', raw, pos); d = raw[pos + 8: pos + 8 + ln]; pos += 12 + ln
        if ty == b'IHDR': w, h, bd, ct, _, _, il = struct.unpack('>IIBBBBB', d); assert bd == 8 and il == 0
        elif ty == b'IDAT': idat += d
    bpp = {2: 3, 6: 4, 0: 1, 4: 2}[ct]; data = zlib.decompress(idat); stride = w * bpp
    rows, prev = [], bytearray(stride)
    for y in range(h):
        f = data[y * (stride + 1)]; row = bytearray(data[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
        for x in range(stride):
            a = row[x - bpp] if x >= bpp else 0; b = prev[x]; c = prev[x - bpp] if x >= bpp else 0
            if f == 1: row[x] = (row[x] + a) & 255
            elif f == 2: row[x] = (row[x] + b) & 255
            elif f == 3: row[x] = (row[x] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c; pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                row[x] = (row[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        rows.append(row); prev = row
    def px(u, v):
        x = min(w - 1, max(0, int(u * w))); y = min(h - 1, max(0, int(v * h))); o = x * bpp
        r = rows[y]; return (r[o], r[o + 1], r[o + 2]) if bpp >= 3 else (r[o],) * 3
    return px


def qmul(a, b):
    ax, ay, az, aw = a; bx, by, bz, bw = b
    return (aw*bx + ax*bw + ay*bz - az*by, aw*by - ax*bz + ay*bw + az*bx, aw*bz + ax*by - ay*bx + az*bw, aw*bw - ax*bx - ay*by - az*bz)


def qrot(q, v):
    x, y, z, w = q
    tx = 2 * (y*v[2] - z*v[1]); ty = 2 * (z*v[0] - x*v[2]); tz = 2 * (x*v[1] - y*v[0])
    return (v[0] + w*tx + y*tz - z*ty, v[1] + w*ty + z*tx - x*tz, v[2] + w*tz + x*ty - y*tx)


def slerp(a, b, t):
    d = sum(x * y for x, y in zip(a, b))
    if d < 0: b = [-x for x in b]; d = -d
    if d > 0.9995:
        r = [x + (y - x) * t for x, y in zip(a, b)]
    else:
        th = math.acos(d); s = math.sin(th)
        r = [(math.sin((1 - t) * th) * x + math.sin(t * th) * y) / s for x, y in zip(a, b)]
    n = math.sqrt(sum(x * x for x in r)); return tuple(x / n for x in r)


def pose(g, bin_, anim, t):
    st = [{'t': n.get('translation', [0, 0, 0]), 'r': tuple(n.get('rotation', [0, 0, 0, 1]))} for n in g['nodes']]
    if anim:
        an = next(a for a in g['animations'] if a['name'] == anim)
        for ch in an['channels']:
            s = an['samplers'][ch['sampler']]
            ts = [r[0] for r in read_acc(g, bin_, s['input'])]; vs = read_acc(g, bin_, s['output'])
            k = max([i for i, x in enumerate(ts) if x <= t] or [0])
            if k >= len(ts) - 1 or s.get('interpolation') == 'STEP': val = vs[min(k, len(vs) - 1)]
            else:
                u = (t - ts[k]) / (ts[k + 1] - ts[k]); a, b = vs[k], vs[k + 1]
                val = slerp(a, b, u) if ch['target']['path'] == 'rotation' else tuple(x + (y - x) * u for x, y in zip(a, b))
            st[ch['target']['node']]['r' if ch['target']['path'] == 'rotation' else 't'] = val
    return st


def raster(path, anim=None, t=0.0, yaw=24.0, pitch=8.0, view='-z', W=360, H=520):
    """Render one frame; returns (rows of RGB tuples, triangle count)."""
    g, bin_, _ = load(path)
    st = pose(g, bin_, anim, t)
    tris = []  # world-space triangles with colour sampler
    pxs = {}
    for i, im in enumerate(g['images']):
        v = g['bufferViews'][im['bufferView']]; pxs[i] = png_decode(bin_[v['byteOffset']: v['byteOffset'] + v['byteLength']])
    def walk(ni, pq, pt):
        n = g['nodes'][ni]; s = st[ni]
        wq = qmul(pq, s['r']); wt = tuple(a + b for a, b in zip(pt, qrot(pq, s['t'])))
        if 'mesh' in n:
            for p in g['meshes'][n['mesh']]['primitives']:
                P = [tuple(a + b for a, b in zip(wt, qrot(wq, v))) for v in read_acc(g, bin_, p['attributes']['POSITION'])]
                N = [qrot(wq, v) for v in read_acc(g, bin_, p['attributes']['NORMAL'])]
                T = read_acc(g, bin_, p['attributes']['TEXCOORD_0']); idx = [r[0] for r in read_acc(g, bin_, p['indices'])]
                tex = g['materials'][p['material']]['pbrMetallicRoughness']['baseColorTexture']['index']
                f = pxs[g['textures'][tex]['source']]
                for k in range(0, len(idx), 3):
                    a, b, c = idx[k:k + 3]; tris.append(([P[a], P[b], P[c]], N[a], [T[a], T[b], T[c]], f))
        for c in n.get('children', []): walk(c, wq, wt)
    for r in g['scenes'][g['scene']]['nodes']: walk(r, (0, 0, 0, 1), (0, 0, 0))
    # camera: view from -Z (Blockbench front) or +Z; yaw about Y, pitch about X
    sgn = 1 if view == '-z' else -1
    ya, pa = math.radians(yaw) * sgn, math.radians(pitch)
    def cam(v, rot=True):
        x, y, z = v
        if sgn < 0: x, z = -x, -z          # turn model around to look from +Z
        x, z = x * math.cos(ya) + z * math.sin(ya), -x * math.sin(ya) + z * math.cos(ya)
        y, z = y * math.cos(pa) - z * math.sin(pa), y * math.sin(pa) + z * math.cos(pa)
        return (-x, y, z)                  # looking down +Z: screen-right = -X
    allp = [cam(v) for tr in tris for v in tr[0]]
    ymin, ymax = min(p[1] for p in allp), max(p[1] for p in allp); xs = [p[0] for p in allp]
    sc = (H - 30) / (ymax - ymin); cx = (min(xs) + max(xs)) / 2; cy = (ymin + ymax) / 2
    img = [[(24, 22, 28)] * W for _ in range(H)]; zb = [[1e9] * W for _ in range(H)]
    light = (-0.4, 0.7, -0.6); ln = math.sqrt(sum(x * x for x in light)); light = tuple(x / ln for x in light)
    for P, N, T, f in tris:
        Q = [cam(v) for v in P]; nc = cam(N); nl = math.sqrt(sum(x * x for x in nc)) or 1
        sh = 0.45 + 0.55 * max(0.0, sum(a * b for a, b in zip((nc[0] / nl, nc[1] / nl, nc[2] / nl), light)))
        S = [(W / 2 + (q[0] - cx) * sc, H / 2 - (q[1] - cy) * sc, q[2]) for q in Q]
        x0 = max(0, int(min(s[0] for s in S))); x1 = min(W - 1, int(max(s[0] for s in S)) + 1)
        y0 = max(0, int(min(s[1] for s in S))); y1 = min(H - 1, int(max(s[1] for s in S)) + 1)
        (ax, ay, az), (bx, by, bz), (cx2, cy2, cz) = S
        den = (by - cy2) * (ax - cx2) + (cx2 - bx) * (ay - cy2)
        if abs(den) < 1e-9: continue
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                px_, py_ = x + 0.5, y + 0.5
                l1 = ((by - cy2) * (px_ - cx2) + (cx2 - bx) * (py_ - cy2)) / den
                l2 = ((cy2 - ay) * (px_ - cx2) + (ax - cx2) * (py_ - cy2)) / den; l3 = 1 - l1 - l2
                if l1 < -1e-6 or l2 < -1e-6 or l3 < -1e-6: continue
                z = l1 * az + l2 * bz + l3 * cz
                if z < zb[y][x]:
                    zb[y][x] = z
                    u = l1 * T[0][0] + l2 * T[1][0] + l3 * T[2][0]; v = l1 * T[0][1] + l2 * T[1][1] + l3 * T[2][1]
                    img[y][x] = tuple(int(c * sh) for c in f(u, v))
    return img, len(tris)


def write_png(img, out):
    W, H = len(img[0]), len(img)
    raw = b''.join(b'\0' + bytes(c for p in row for c in p) for row in img)
    def ch(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d))
    open(out, 'wb').write(b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 2, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw, 9)) + ch(b'IEND', b''))


def render(path, out, **kw):
    img, n = raster(path, **kw)
    write_png(img, out)
    print('rendered %d tris -> %s' % (n, out))


# dist/preview-glb.png: rest, then the gavel_strike wind-up, mid-swing and impact,
# seen from the side so the swing arc reads.
PREVIEW_FRAMES = [(None, 0.0), ('gavel_strike', 0.0), ('gavel_strike', 0.18), ('gavel_strike', 0.25)]


def preview(path, out, yaw=80.0, pitch=4.0):
    frames = [raster(path, anim=a, t=t, yaw=yaw, pitch=pitch)[0] for a, t in PREVIEW_FRAMES]
    write_png([sum((f[y] for f in frames), []) for y in range(len(frames[0]))], out)
    print('preview %d frames -> %s' % (len(frames), out))


def main(a):
    if a[0] == 'check': sys.exit(check(a[1]))
    if a[0] == 'preview': return preview(a[1], a[2])
    kw = {}; i = 3
    while i < len(a):
        k = a[i].lstrip('-'); kw[{'anim': 'anim', 'time': 't', 'yaw': 'yaw', 'pitch': 'pitch', 'view-from': 'view'}[k]] = a[i + 1]; i += 2
    for k in ('t', 'yaw', 'pitch'):
        if k in kw: kw[k] = float(kw[k])
    render(a[1], a[2], **kw)


if __name__ == '__main__':
    main(sys.argv[1:])
