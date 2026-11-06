import { launch, focused, sleep } from './lib.mjs';
const [base, path, n = '40', w = '1280'] = process.argv.slice(2);
const b = await launch(); const p = await b.newPage({ viewport: { width: Number(w), height: 900 } });
await p.goto(base + path, { waitUntil: 'networkidle' }); await sleep(800);
await p.evaluate(() => { document.activeElement?.blur?.(); }); await p.locator('body').focus().catch(() => {});
const seq = [];
for (let i = 0; i < Number(n); i++) { await p.keyboard.press('Tab'); const f = await focused(p); seq.push(f ? `${f.tag}${f.role ? '[' + f.role + ']' : ''}:${f.name.slice(0, 40)}${f.ring ? '' : ' (NO RING)'}` : '(none)'); }
console.log(seq.join('\n'));
await b.close();
