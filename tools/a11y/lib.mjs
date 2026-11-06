// Shared harness: Chrome via playwright-core, axe injection, keyboard-only helpers.
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
// axe-core comes from the repo (vitest-axe depends on it); Chrome path is overridable.
export const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const CHROME = process.env.CHROME ?? '/usr/bin/google-chrome';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function launch() {
  return chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
}
export function watch(page, errors, tag = '') {
  page.on('pageerror', (e) => errors.push(`${tag}pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${tag}console: ${m.text()}`));
}
export async function axe(page) {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async () => {
     
    const r = await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'], resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 6).map((n) => ({ target: n.target.join(' '), summary: (n.failureSummary || '').split('\n').slice(0, 3).join(' ') })), count: v.nodes.length }));
  });
}
/** Describes document.activeElement: role-ish tag, accessible-ish name, visible focus indicator. */
export async function focused(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const r = el.getBoundingClientRect();
    const labelled = el.getAttribute('aria-labelledby');
    const name = (el.getAttribute('aria-label') || (labelled && labelled.split(' ').map((id) => document.getElementById(id)?.textContent ?? '').join(' ')) || (el.labels && el.labels[0]?.textContent) || el.textContent || el.getAttribute('title') || el.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim();
    const visible = (st) => (st.outlineStyle !== 'none' && parseFloat(st.outlineWidth) > 0) || (st.boxShadow !== 'none' && !/^(rgba\(0, 0, 0, 0\)[^,]*,?\s*)+$/.test(st.boxShadow));
    let ring = false;
    for (let n = el, i = 0; n && i < 4 && !ring; n = n.parentElement, i++) ring = visible(getComputedStyle(n)) || visible(getComputedStyle(n, '::after')) || visible(getComputedStyle(n, '::before'));
    return { tag: el.tagName.toLowerCase(), type: el.getAttribute('type'), role: el.getAttribute('role'), name: name.slice(0, 80), ring, shadow: false, w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y), inView: r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth };
  });
}
/** Tab (never click) until the focused control's name matches, then activate it from the keyboard. */
export async function kb(page, match, { key = 'auto', max = 160, shift = false } = {}) {
  const re = match instanceof RegExp ? match : new RegExp(match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const seen = [];
  for (let i = 0; i < max; i++) {
    const f = await focused(page);
    if (f) seen.push(`${f.tag}${f.type ? ':' + f.type : ''}:${f.name.slice(0, 30)}`);
    if (f && re.test(f.name)) {
      if (key === 'none') return f;
      const k = key !== 'auto' ? key : f.tag === 'input' && (f.type === 'checkbox' || f.type === 'radio') ? 'Space' : 'Enter';
      await page.keyboard.press(k);
      await sleep(400);
      return f;
    }
    // Radios in a group: arrows move between options, Tab skips the group.
    if (f && f.tag === 'input' && f.type === 'radio') {
      const opts = await page.evaluate(() => { const el = document.activeElement; return [...document.querySelectorAll(`input[type=radio][name="${el.name}"]`)].map((r) => (r.labels?.[0]?.textContent || r.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim()); });
      const idx = opts.findIndex((o) => re.test(o));
      if (idx >= 0) {
        const cur = opts.findIndex((o) => o === f.name);
        const steps = (idx - cur + opts.length) % opts.length;
        for (let s = 0; s < steps; s++) await page.keyboard.press('ArrowDown');
        await sleep(300);
        return focused(page);
      }
    }
    await page.keyboard.press(shift ? 'Shift+Tab' : 'Tab');
  }
  throw new Error(`keyboard could not reach "${match}"; saw: ${[...new Set(seen)].join(' | ')}`);
}
/** Focus a text field by Tab and type into it. */
export async function kbType(page, match, value) {
  await kb(page, match, { key: 'none' });
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(value);
}
export async function waitText(page, text, ms = 25000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate((t) => document.body.innerText.toLowerCase().includes(t.toLowerCase()), text)) return;
    await sleep(250);
  }
  throw new Error(`timed out waiting for "${text}"`);
}
export async function overflow(page) {
  return page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth <= w + 1) return null;
    const wide = [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.right > w + 1 && r.width > 0 && getComputedStyle(e).position !== 'fixed'; }).slice(0, 8).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} right=${Math.round(e.getBoundingClientRect().right)}`);
    return { scrollWidth: document.documentElement.scrollWidth, width: w, wide };
  });
}
/** Waits for a control to exist (never clicks it). */
export async function waitControl(page, re, ms = 40000) {
  await page.getByRole('button', { name: re }).or(page.getByRole('link', { name: re })).first().waitFor({ timeout: ms });
}
