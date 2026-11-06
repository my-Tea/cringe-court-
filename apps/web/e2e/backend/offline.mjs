// Failure UX: the court server goes away mid-session, a fresh page opens while
// it is down, the player explicitly picks the local demo, then switches back
// once a (fresh, memory-store) server is up again.
import { clickText, hasText, sleep, waitText } from './lib.mjs';

export async function playServerDown(browser, base, shots, server) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  ctx.setDefaultTimeout(60000);
  const p = await ctx.newPage();
  shots.watch(p, 'P');
  await p.goto(base + '/grand-jury/docket', { waitUntil: 'load' });
  await waitText(p, 'Shared court · live', 30000);
  await shots.shot(p, 'live', { fullPage: false });

  shots.step('stop the court server');
  await server.stop();
  await waitText(p, 'Lost the court server', 40000);
  await shots.shot(p, 'connection-lost-banner', { fullPage: false });
  await clickText(p, 'Faucet', 'button');
  await sleep(1500);
  await shots.shot(p, 'action-while-down', { fullPage: false });

  shots.step('a fresh page while the server is down');
  const q = await ctx.newPage();
  shots.watch(q, 'Q');
  await q.goto(base + '/versus/new', { waitUntil: 'load' });
  await waitText(q, 'The court server is not answering', 30000);
  await shots.shot(q, 'unreachable-gate', { fullPage: false });
  const silent = await hasText(q, 'Settle it in court');
  if (silent) throw new Error('The app fell back to the local demo silently');
  await clickText(q, 'Play the local demo instead', 'button');
  await waitText(q, 'Local demo');
  await waitText(q, 'Case title');
  await shots.shot(q, 'local-demo-chosen', { fullPage: false });

  shots.step('server back (fresh store): switch to the shared court again');
  await server.start();
  await clickText(q, 'Use the shared court', 'button');
  await waitText(q, 'Shared court', 30000);
  await sleep(1500);
  await shots.shot(q, 'back-on-shared-court', { fullPage: false });
  const fresh = await hasText(q, 'Fresh seat on the court server');
  await waitText(p, 'Shared court · live', 60000).catch(() => {});
  await shots.shot(p, 'first-tab-reconnected', { fullPage: false });
  return { freshSessionNotice: fresh, reconnected: await hasText(p, 'Shared court · live') };
}
