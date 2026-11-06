import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/etc/profiles/per-user/juswasif/bin/google-chrome',
  headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox','--disable-dev-shm-usage'],
});
const page = await browser.newPage();
await page.setViewport({width:1100,height:760});
await page.goto('http://localhost:5173/town?debug', {waitUntil:'networkidle2', timeout:60000});
await new Promise(r=>setTimeout(r,3000));
console.log(JSON.stringify(await page.evaluate(()=>{
  const t = window.__town;
  const r = t.renderer;
  return {
    // The world group in the scene vs what stats thinks
    sceneWorldChildren: r.scene.children.find(o=>o.name?.startsWith('iso:'))?.children?.length,
    stats: r.stats,
    drawCallsGetter: r.drawCalls,
    // Is this the same renderer the component holds? check private via any cast
    rendererKeys: Object.getOwnPropertyNames(Object.getPrototypeOf(r)),
  };
}), null, 1));
await browser.close();
