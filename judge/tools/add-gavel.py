"""Add the gavel prop to GavelExe.bbmodel as a `gavel` bone under `foreR`.

The model's strike animations rotate armR/foreR, so a child of foreR swings
with them. Idempotent: re-running replaces any existing gavel bone. The handle
runs forward (-z, the face direction) through the fist; the mallet head stands
across it at the front end.

    python3 judge/tools/add-gavel.py judge/dist/GavelExe.bbmodel
"""
import hashlib
import json
import sys

# (name, from, to, texture name) — hand is x 11..15, y 19..24, z -4..3
PARTS = [
    ('gavelHandle',  [12.25, 20.75, -12], [13.75, 22.25, 4],  'm_wood'),
    ('gavelPommel',  [12, 20.5, 4],       [14, 22.5, 5],      'm_gold'),
    ('gavelHead',    [11, 16.5, -17],     [15, 26.5, -11],    'm_wood'),
    ('gavelBandTop', [10.75, 24, -17.25], [15.25, 25, -10.75], 'm_gold'),
    ('gavelBandBot', [10.75, 18, -17.25], [15.25, 19, -10.75], 'm_gold'),
    ('gavelFaceTop', [11.5, 26.5, -16.5], [14.5, 27, -11.5],  'm_goldDark'),
    ('gavelFaceBot', [11.5, 16, -16.5],   [14.5, 16.5, -11.5], 'm_goldDark'),
]
PIVOT = [13, 21.5, 0]


def uid(name):
    """Stable UUID-shaped id, so re-runs produce identical files."""
    h = hashlib.sha1(f'GavelExe/{name}'.encode()).hexdigest()
    return f'{h[:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}'


def find(nodes, name, groups):
    for n in nodes:
        if isinstance(n, dict):
            if groups[n['uuid']]['name'] == name:
                return n
            hit = find(n['children'], name, groups)
            if hit:
                return hit
    return None


def main(path):
    raw = open(path, encoding='utf-8').read()
    m = json.loads(raw)
    tex = {t['name']: i for i, t in enumerate(m['textures'])}
    groups = {g['uuid']: g for g in m['groups']}

    # drop a previous gavel bone, if any
    old = {g['uuid'] for g in m['groups'] if g['name'] == 'gavel'}
    if old:
        m['groups'] = [g for g in m['groups'] if g['uuid'] not in old]
        m['elements'] = [e for e in m['elements'] if not e['name'].startswith('gavel')]
        fore = find(m['outliner'], 'foreR', groups)
        fore['children'] = [c for c in fore['children'] if not (isinstance(c, dict) and c['uuid'] in old)]
        groups = {g['uuid']: g for g in m['groups']}

    template = next(e for e in m['elements'] if e['name'] == 'handR')
    template_group = next(g for g in m['groups'] if g['name'] == 'foreR')
    ids = []
    for name, f, t, texname in PARTS:
        e = json.loads(json.dumps(template))
        e.update(name=name, uuid=uid(name), **{'from': f, 'to': t})
        for face in e['faces'].values():
            face['texture'] = tex[texname]
        m['elements'].append(e)
        ids.append(e['uuid'])

    g = json.loads(json.dumps(template_group))
    g.update(name='gavel', uuid=uid('gavel'), origin=PIVOT, rotation=[0, 0, 0], children=[])
    m['groups'].append(g)
    groups[g['uuid']] = g

    fore = find(m['outliner'], 'foreR', groups)
    fore['children'].append({'uuid': g['uuid'], 'isOpen': False, 'children': ids})

    open(path, 'w', encoding='utf-8').write(json.dumps(m, separators=(',', ':'), ensure_ascii=False))
    print(f'gavel bone: {len(ids)} cubes under foreR; model now {len(m["elements"])} cubes, {len(m["groups"])} bones')


if __name__ == '__main__':
    main(sys.argv[1])
