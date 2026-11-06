// Sanity-checks dist/models/CringeCourt_Props.bbmodel against out/props/manifest.json
// and props.mjs. Exits non-zero on the first failed check.
//   node validate-bbmodel.mjs [model.bbmodel] [reference.bbmodel]
// With a reference file (e.g. the pre-regeneration model) it also checks that the
// key structure of root/element/group/texture objects is identical.
import fs from 'node:fs';
import { PNG } from 'pngjs';
import { PROPS, PROP_NAMES } from './props.mjs';

const file = process.argv[2] || './dist/models/CringeCourt_Props.bbmodel';
const ref = process.argv[3];
const m = JSON.parse(fs.readFileSync(file, 'utf8'));
const manifest = JSON.parse(fs.readFileSync('./out/props/manifest.json', 'utf8'));
let fail = 0;
const ok = (c, msg) => { if (!c) { fail++; console.error('FAIL', msg); } };

ok(m.meta.format_version === '5.0' && m.meta.model_format === 'free', 'meta version/format');
ok(m.groups.length === manifest.length && m.groups.length === PROP_NAMES.length, `group count ${m.groups.length} vs manifest ${manifest.length}`);
ok(m.elements.length === manifest.reduce((s, e) => s + e.boxes, 0), 'element count equals manifest box total');
ok(new Set([...m.elements, ...m.groups, ...m.textures].map((x) => x.uuid)).size === m.elements.length + m.groups.length + m.textures.length, 'uuids unique');

const byUuid = new Map(m.elements.map((e) => [e.uuid, e]));
const texNames = m.textures.map((t) => t.name);
m.textures.forEach((t, i) => {
  ok(t.id === String(i), `texture ${t.name} id`);
  const png = PNG.sync.read(Buffer.from(t.source.split(',')[1], 'base64'));
  ok(png.width === 16 && png.height === 16, `texture ${t.name} is 16x16`);
});
m.outliner.forEach((o, gi) => {
  const g = m.groups[gi], name = g.name, man = manifest.find((e) => e.name === name);
  ok(o.uuid === g.uuid, `outliner/group uuid ${name}`);
  ok(man && o.children.length === man.boxes, `${name}: ${o.children.length} elements vs manifest ${man?.boxes}`);
  o.children.forEach((u, i) => {
    const e = byUuid.get(u), p = PROPS[name].parts[i];
    ok(e && e.name.startsWith(`${name}__`), `${name}[${i}] element exists`);
    if (!e) return;
    ok(JSON.stringify(e.from) === JSON.stringify(p.f) && JSON.stringify(e.to) === JSON.stringify(p.t), `${name}[${i}] geometry`);
    for (const f of Object.values(e.faces)) ok(texNames[f.texture] === `p_${p.m.slice(1).toUpperCase()}`, `${name}[${i}] texture/colour`);
    ok(e.color >= 0 && e.color <= 9, `${name}[${i}] colour index`);
  });
});

if (ref) {
  const r = JSON.parse(fs.readFileSync(ref, 'utf8'));
  const keys = (o) => Object.keys(o).join();
  ok(keys(r) === keys(m), 'root keys');
  ok(JSON.stringify({ ...r.meta }) === JSON.stringify(m.meta), 'meta');
  ok(keys(r.elements[0]) === keys(m.elements[0]) && keys(r.elements[0].faces.north) === keys(m.elements[0].faces.north), 'element keys');
  ok(keys(r.groups[0]) === keys(m.groups[0]), 'group keys');
  ok(keys(r.textures[0]) === keys(m.textures[0]), 'texture keys');
  ok(keys(r.outliner[0]) === keys(m.outliner[0]), 'outliner keys');
}
console.log(fail ? `${fail} check(s) failed` : `bbmodel OK: ${m.groups.length} groups, ${m.elements.length} elements, ${m.textures.length} textures`);
process.exit(fail ? 1 : 0);
