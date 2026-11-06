import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterAll, describe, expect, it } from 'vitest';
import { DEMO_CASE_FILES } from '@cringe-court/modes-grand-jury';
import { routes } from '@/app/router';
import { MotionProvider, ToastProvider, TooltipProvider } from '@/ds';
import { I18nProvider } from './I18nProvider';
import { setActiveLocale } from './runtime';

/**
 * Renders real routes in the en-XA pseudo-locale. Every catalog message comes
 * out wrapped in ⟦…⟧ and accented, so any plain English left on screen is copy
 * that bypassed the catalog. Only content that is data (case text from the
 * domain packages and the demo seeds) may remain, and it is listed per route.
 */
afterAll(() => setActiveLocale('en'));

/** Text a person can perceive: drop aria-hidden subtrees and labelled images (their label comes from the catalog). */
function perceivableText(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[aria-hidden="true"], svg[role="img"], script, style').forEach((n) => n.remove());
  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) parts.push(n.textContent ?? '');
  return parts.join(' ');
}

/** Every string in the seeded demo docket: case content, not UI copy. */
const DEMO_TEXT = new Set<string>();
const collect = (v: unknown): void => {
  if (typeof v === 'string') v.split(/[^A-Za-z']+/).forEach((w) => w.length > 2 && DEMO_TEXT.add(w.toLowerCase()));
  else if (Array.isArray(v)) v.forEach(collect);
  else if (v && typeof v === 'object') Object.values(v).forEach(collect);
};
collect(DEMO_CASE_FILES);

function leftoverEnglish(root: HTMLElement): string[] {
  let text = perceivableText(root);
  // Strip pseudo messages innermost-first (params can hold other messages).
  for (let prev = ''; prev !== text;) {
    prev = text;
    text = text.replace(/⟦[^⟦⟧]*⟧/g, ' ');
  }
  return [...new Set(text.match(/[A-Za-z][A-Za-z']{2,}(?:\s+[A-Za-z][A-Za-z']+)*/g) ?? [])];
}

async function renderPseudo(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <I18nProvider locale="en-XA">
      <MotionProvider>
        <TooltipProvider>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </TooltipProvider>
      </MotionProvider>
    </I18nProvider>,
  );
  await waitFor(() => expect(screen.getByRole('main')).toBeInTheDocument(), { timeout: 15000 });
  await waitFor(() => expect(screen.queryAllByRole('heading', { level: 1 }).length).toBeGreaterThan(0), { timeout: 15000 });
  return document.body;
}

/** Words that are data, brand or proper names rather than UI copy. */
const DATA: Record<string, RegExp[]> = {};
const ROUTES = [
  '/',
  '/court',
  '/how-to-play',
  '/leaderboard',
  '/settings',
  '/solo',
  '/versus',
  '/grand-jury',
  '/solo/file',
  '/solo/docket',
  '/versus/new',
  '/versus/join',
  '/versus/cases',
  '/grand-jury/docket',
  '/grand-jury/duty',
  '/grand-jury/pricing',
  '/no-such-page',
];

describe('pseudo-locale (en-XA)', () => {
  it.each(ROUTES)('%s shows no copy outside the catalog', async (path) => {
    const body = await renderPseudo(path);
    const allowed = DATA[path] ?? [];
    const left = leftoverEnglish(body)
      .filter((w) => !/^[0-9a-fx]+$/i.test(w)) // hashes and invite codes
      .filter((w) => !allowed.some((re) => re.test(w)))
      // Case content from the demo docket is data, not copy.
      .filter((w) => !w.split(/[^A-Za-z']+/).every((part) => part.length < 3 || DEMO_TEXT.has(part.toLowerCase())));
    if (process.env.PSEUDO_DUMP) console.log(`@@ ${path} ${JSON.stringify(left)}`);
    expect(left).toEqual([]);
  });
});
