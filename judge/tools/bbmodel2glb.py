#!/usr/bin/env python3
"""Offline, deterministic Blockbench .bbmodel -> binary glTF 2.0 (.glb).

    python3 judge/tools/bbmodel2glb.py [in.bbmodel] [out.glb] [--scale S] [--fps N]

Python stdlib only. Same input -> byte-identical output (no timestamps, no
random ids, no dict-order dependence on hashing).

Conventions (read these before trusting the output; see judge/README.md)
------------------------------------------------------------------------
Units     Blockbench pixels * SCALE (default 1/16, what Blockbench's own glTF
          exporter uses: 16 px = 1 m).  The Judge is 63 px = 3.94 m at 1/16;
          pass --scale 0.03125 for a ~2 m person.
Axes      NOT flipped: Y up, Blockbench "north" (front, -Z) stays -Z.  glTF
          convention is +Z front, so a viewer may need a 180 deg turn about Y.
Hierarchy One node per bone (outliner group); translation = bone pivot minus
          parent pivot (all in px, then scaled).  One child node per cube,
          carrying a mesh.  Rigid parenting, no skins/joints: every cube moves
          with exactly one bone, which is all the rig needs.
Rotation  Blockbench euler degrees, applied as Three.js 'ZYX' order, i.e.
          R = Rz * Ry * Rx (X applied first), right-handed, positive angle =
          counter-clockwise looking down the axis toward the origin.  Both group
          rest rotations and cube rotations (about the cube's own `origin`) use
          this.  ASSUMED, to be cross-checked against a Blockbench GUI export.
Anim      Blockbench animation values are ADDITIVE on the bone's rest pose.
          Rotation: node euler = rest + (-ax, -ay, +az) -- Blockbench's animator
          negates X and Y (Bedrock-style) relative to group rotation, so a
          negative animation X pitches the limb forward/up.  Position: offset
          = (-px, +py, +pz) added to the rest pivot offset (no keys in the
          current model, untested).  Scale keys are ignored.  The bake emits
          absolute node rotation/translation.  ALL of this is from memory of
          Blockbench's source and must be cross-checked in the GUI.
Interp    linear -> LINEAR, step -> STEP (only when every key of the channel
          uses it).  catmullrom (the only mode in this model) and mixed
          channels are baked to LINEAR samples at --fps (default 30) plus the
          exact key times, using uniform Catmull-Rom on the euler values with
          end keys duplicated.  glTF CUBICSPLINE is deliberately not used.
UVs       Per-face [u0,v0,u1,v1] / texture uv size, top-left origin (same as
          glTF).  u0,v0 sits at the top-left of the face as seen from outside;
          for up faces "top" is north, for down faces "top" is south.
Textures  Source PNGs are embedded byte-for-byte (bufferView), one material per
          texture, NEAREST sampler (9728) so pixels stay crisp.  No atlas.
"""
import base64, json, math, struct, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
DEF_IN = os.path.join(HERE, '..', 'dist', 'GavelExe.bbmodel')
DEF_OUT = os.path.join(HERE, '..', 'dist', 'GavelExe.glb')

NEAREST, CLAMP = 9728, 33071
ANIM_ROT_SIGN = (-1, -1, 1)   # Blockbench animator: X,Y negated vs group rotation
ANIM_POS_SIGN = (-1, 1, 1)

# face -> corners (TL, TR, BR, BL as seen from outside) as (x, y, z) picks of
# 0 = min, 1 = max;  normal
FACES = {
    'north': ([(1, 1, 0), (0, 1, 0), (0, 0, 0), (1, 0, 0)], (0, 0, -1)),
    'south': ([(0, 1, 1), (1, 1, 1), (1, 0, 1), (0, 0, 1)], (0, 0, 1)),
    'east':  ([(1, 1, 0), (1, 1, 1), (1, 0, 1), (1, 0, 0)], (1, 0, 0)),
    'west':  ([(0, 1, 1), (0, 1, 0), (0, 0, 0), (0, 0, 1)], (-1, 0, 0)),
    'up':    ([(0, 1, 0), (1, 1, 0), (1, 1, 1), (0, 1, 1)], (0, 1, 0)),
    'down':  ([(0, 0, 1), (1, 0, 1), (1, 0, 0), (0, 0, 0)], (0, -1, 0)),
}


def qmul(a, b):
    ax, ay, az, aw = a; bx, by, bz, bw = b
    return (aw*bx + ax*bw + ay*bz - az*by, aw*by - ax*bz + ay*bw + az*bx,
            aw*bz + ax*by - ay*bx + az*bw, aw*bw - ax*bx - ay*by - az*bz)


def euler_zyx(deg):
    """Blockbench/Three 'ZYX' euler (degrees) -> quaternion (x,y,z,w)."""
    h = [math.radians(v) / 2 for v in deg]
    qx = (math.sin(h[0]), 0, 0, math.cos(h[0]))
    qy = (0, math.sin(h[1]), 0, math.cos(h[1]))
    qz = (0, 0, math.sin(h[2]), math.cos(h[2]))
    return qmul(qz, qmul(qy, qx))


def rotate(q, v):
    x, y, z, w = q
    # v' = q v q^-1
    tx = 2 * (y*v[2] - z*v[1]); ty = 2 * (z*v[0] - x*v[2]); tz = 2 * (x*v[1] - y*v[0])
    return (v[0] + w*tx + (y*tz - z*ty), v[1] + w*ty + (z*tx - x*tz), v[2] + w*tz + (x*ty - y*tx))


def num(v):
    return float(v)


def vsub(a, b):
    return [a[i] - b[i] for i in range(3)]


class Buf:
    def __init__(self):
        self.data = bytearray(); self.views = []; self.accessors = []

    def view(self, raw, target=None):
        while len(self.data) % 4:
            self.data.append(0)
        v = {'buffer': 0, 'byteOffset': len(self.data), 'byteLength': len(raw)}
        if target:
            v['target'] = target
        self.data += raw
        self.views.append(v)
        return len(self.views) - 1

    def accessor(self, comp, ctype, fmt, rows, target=None, minmax=False):
        flat = [x for r in rows for x in (r if isinstance(r, (tuple, list)) else (r,))]
        bv = self.view(struct.pack('<%d%s' % (len(flat), fmt), *flat), target)
        a = {'bufferView': bv, 'componentType': comp, 'count': len(rows), 'type': ctype}
        if minmax:
            n = len(rows[0]) if isinstance(rows[0], (tuple, list)) else 1
            cols = list(zip(*rows)) if n > 1 else [rows]
            a['min'] = [min(c) for c in cols]; a['max'] = [max(c) for c in cols]
        self.accessors.append(a)
        return len(self.accessors) - 1


def catmull(p0, p1, p2, p3, t):
    t2, t3 = t*t, t*t*t
    return 0.5 * ((2*p1) + (-p0 + p2)*t + (2*p0 - 5*p1 + 4*p2 - p3)*t2 + (-p0 + 3*p1 - 3*p2 + p3)*t3)


def sample_channel(keys, fps, length):
    """keys: sorted [(time, [x,y,z], interp)] -> (mode, [(time, [x,y,z])])."""
    modes = {k[2] for k in keys}
    if modes == {'linear'}:
        return 'LINEAR', [(k[0], k[1]) for k in keys]
    if modes == {'step'}:
        return 'STEP', [(k[0], k[1]) for k in keys]
    times = {round(k[0], 6) for k in keys}
    end = keys[-1][0]
    n = int(math.floor(end * fps + 1e-9))
    times |= {round(i / fps, 6) for i in range(n + 1)}
    out = []
    for t in sorted(times):
        if t <= keys[0][0]:
            out.append((t, keys[0][1])); continue
        if t >= end:
            out.append((t, keys[-1][1])); continue
        i = max(j for j, k in enumerate(keys) if k[0] <= t + 1e-9)
        if abs(keys[i][0] - t) < 1e-9:
            out.append((t, keys[i][1])); continue
        k0, k1 = keys[i], keys[i + 1]
        u = (t - k0[0]) / (k1[0] - k0[0])
        if k0[2] == 'step':
            val = k0[1]
        elif k1[2] == 'catmullrom' or k0[2] == 'catmullrom':
            pm = keys[max(i - 1, 0)][1]; pp = keys[min(i + 2, len(keys) - 1)][1]
            val = [catmull(pm[c], k0[1][c], k1[1][c], pp[c], u) for c in range(3)]
        else:
            val = [k0[1][c] + (k1[1][c] - k0[1][c]) * u for c in range(3)]
        out.append((t, val))
    return 'LINEAR', out


def convert(bb, scale=1/16, fps=30):
    groups = {g['uuid']: g for g in bb['groups']}
    elements = {e['uuid']: e for e in bb['elements']}
    res = bb.get('resolution', {'width': 16, 'height': 16})
    buf = Buf()
    nodes, meshes, materials, textures, images, samplers = [], [], [], [], [], [{
        'magFilter': NEAREST, 'minFilter': NEAREST, 'wrapS': CLAMP, 'wrapT': CLAMP}]
    tex_uv = []
    for i, t in enumerate(bb['textures']):
        raw = base64.b64decode(t['source'].split(',', 1)[1])
        images.append({'bufferView': buf.view(raw), 'mimeType': 'image/png', 'name': t['name']})
        textures.append({'sampler': 0, 'source': i, 'name': t['name']})
        materials.append({'name': t['name'], 'pbrMetallicRoughness': {
            'baseColorTexture': {'index': i}, 'metallicFactor': 0.0, 'roughnessFactor': 1.0}})
        tex_uv.append((t.get('uv_width') or res['width'], t.get('uv_height') or res['height']))

    bone_node = {}
    bone_info = {}  # name -> (origin, rest_euler, node index)

    def cube_mesh(e):
        o = e['origin']; f, to = e['from'], e['to']
        inf = e.get('inflate', 0) or 0
        lo = [f[i] - inf for i in range(3)]; hi = [to[i] + inf for i in range(3)]
        rot = euler_zyx(e.get('rotation') or [0, 0, 0])
        by_mat = {}
        for fname, (corners, nrm) in FACES.items():
            face = e['faces'].get(fname)
            if not face or face.get('texture') is None:
                continue
            m = face['texture']
            u0, v0, u1, v1 = face['uv']
            uw, uh = tex_uv[m]
            uvs = [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
            fr = face.get('rotation') or 0
            if fr:
                k = (fr // 90) % 4
                uvs = uvs[-k:] + uvs[:-k] if k else uvs
            pos = []
            for c in corners:
                p = [(hi if c[a] else lo)[a] - o[a] for a in range(3)]
                pos.append(tuple(x * scale for x in rotate(rot, p)))
            n = rotate(rot, nrm)
            g = by_mat.setdefault(m, {'P': [], 'N': [], 'T': [], 'I': []})
            b = len(g['P'])
            g['P'] += pos; g['N'] += [n] * 4
            g['T'] += [(u / uw, v / uh) for u, v in uvs]
            g['I'] += [b, b + 3, b + 2, b, b + 2, b + 1]
        prims = []
        for m in sorted(by_mat):
            g = by_mat[m]
            idx = g['I']
            ic = (5123, 'H') if len(g['P']) < 65536 else (5125, 'I')
            prims.append({'attributes': {
                'POSITION': buf.accessor(5126, 'VEC3', 'f', g['P'], 34962, True),
                'NORMAL': buf.accessor(5126, 'VEC3', 'f', g['N'], 34962),
                'TEXCOORD_0': buf.accessor(5126, 'VEC2', 'f', g['T'], 34962)},
                'indices': buf.accessor(ic[0], 'SCALAR', ic[1], idx, 34963),
                'material': m, 'mode': 4})
        meshes.append({'name': e['name'], 'primitives': prims})
        return len(meshes) - 1

    def add_group(item, parent_origin):
        g = groups[item['uuid']]
        idx = len(nodes)
        nodes.append(None)
        o = g['origin']; rest = g.get('rotation') or [0, 0, 0]
        node = {'name': g['name'],
                'translation': [(o[i] - parent_origin[i]) * scale for i in range(3)]}
        q = euler_zyx(rest)
        if any(rest):
            node['rotation'] = list(q)
        kids = []
        for c in item['children']:
            if isinstance(c, str):
                e = elements[c]
                ci = len(nodes)
                eo = e['origin']
                cn = {'name': e['name'], 'mesh': cube_mesh(e),
                      'translation': [(eo[i] - o[i]) * scale for i in range(3)]}
                nodes.append(cn); kids.append(ci)
            else:
                kids.append(add_group(c, o))
        if kids:
            node['children'] = kids
        nodes[idx] = node
        bone_info[g['name']] = (o, rest, idx, parent_origin)
        return idx

    roots = [add_group(it, [0, 0, 0]) for it in bb['outliner'] if not isinstance(it, str)]
    stray = [elements[u] for u in bb['outliner'] if isinstance(u, str)]
    for e in stray:
        ci = len(nodes)
        nodes.append({'name': e['name'], 'mesh': cube_mesh(e),
                      'translation': [x * scale for x in e['origin']]})
        roots.append(ci)

    animations = []
    for a in bb['animations']:
        samplers_a, channels = [], []
        for au in a['animators']:
            an = a['animators'][au]
            name = an['name']
            if name not in bone_info or not an.get('keyframes'):
                continue
            o, rest, ni, po = bone_info[name]
            for ch in ('rotation', 'position'):
                ks = sorted((k for k in an['keyframes'] if k['channel'] == ch), key=lambda k: k['time'])
                if not ks:
                    continue
                keys = [(num(k['time']), [num(k['data_points'][0][c]) for c in 'xyz'],
                         k.get('interpolation', 'linear')) for k in ks]
                mode, pts = sample_channel(keys, fps, a['length'])
                t_acc = buf.accessor(5126, 'SCALAR', 'f', [p[0] for p in pts], None, True)
                if ch == 'rotation':
                    qs, prev = [], None
                    for _, e in pts:
                        q = euler_zyx([rest[c] + ANIM_ROT_SIGN[c] * e[c] for c in range(3)])
                        if prev and sum(q[i]*prev[i] for i in range(4)) < 0:
                            q = tuple(-x for x in q)
                        qs.append(q); prev = q
                    v_acc = buf.accessor(5126, 'VEC4', 'f', qs)
                    path = 'rotation'
                else:
                    base = [(o[i] - po[i]) for i in range(3)]
                    v_acc = buf.accessor(5126, 'VEC3', 'f',
                                         [tuple((base[c] + ANIM_POS_SIGN[c] * e[c]) * scale for c in range(3)) for _, e in pts])
                    path = 'translation'
                samplers_a.append({'input': t_acc, 'output': v_acc, 'interpolation': mode})
                channels.append({'sampler': len(samplers_a) - 1,
                                 'target': {'node': ni, 'path': path}})
        animations.append({'name': a['name'], 'samplers': samplers_a, 'channels': channels})

    gltf = {
        'asset': {'version': '2.0', 'generator': 'cringe-court judge/tools/bbmodel2glb.py'},
        'scene': 0, 'scenes': [{'name': bb.get('name', 'model'), 'nodes': roots}],
        'nodes': nodes, 'meshes': meshes, 'materials': materials,
        'textures': textures, 'images': images, 'samplers': samplers,
        'accessors': buf.accessors, 'bufferViews': buf.views,
        'buffers': [{'byteLength': 0}], 'animations': animations,
    }
    binb = bytes(buf.data) + b'\0' * (-len(buf.data) % 4)
    gltf['buffers'][0]['byteLength'] = len(binb)
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    total = 12 + 8 + len(js) + 8 + len(binb)
    return (struct.pack('<4sII', b'glTF', 2, total) + struct.pack('<I4s', len(js), b'JSON') + js
            + struct.pack('<I4s', len(binb), b'BIN\0') + binb)


def main(argv):
    scale, fps, pos = 1/16, 30, []
    it = iter(argv)
    for a in it:
        if a == '--scale': scale = float(next(it))
        elif a == '--fps': fps = int(next(it))
        else: pos.append(a)
    src = pos[0] if pos else DEF_IN
    dst = pos[1] if len(pos) > 1 else DEF_OUT
    with open(src) as f:
        bb = json.load(f)
    glb = convert(bb, scale, fps)
    with open(dst, 'wb') as f:
        f.write(glb)
    print('%s -> %s (%d bytes, %d cubes, %d animations, scale %g)' % (
        src, dst, len(glb), len(bb['elements']), len(bb['animations']), scale))


if __name__ == '__main__':
    main(sys.argv[1:])
