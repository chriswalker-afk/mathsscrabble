import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base='http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const [width,height] of [[1366,768],[768,1024],[390,844],[320,700]]){
  const page=await browser.newPage({viewport:{width,height}});
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  await page.goto(base,{waitUntil:'networkidle'});
  assert.equal(await page.locator('.entry-logo h1').count(),1);
  assert.equal(await page.locator('.mini-board .mini-cell').count(),49);
  assert.equal(await page.locator('.mini-board .piece').count(),6);
  assert.equal(await page.locator('.choice-card').count(),2);
  const home=await page.evaluate(()=>({
   vw:innerWidth,scroll:document.documentElement.scrollWidth,
   cards:[...document.querySelectorAll('.choice-card')].map(e=>{
    const r=e.getBoundingClientRect();return {w:r.width,h:r.height};
   })
  }));
  assert.ok(home.scroll<=home.vw+3,'landing must not overflow: '+JSON.stringify(home));
  assert.ok(home.cards.every(c=>c.w>=130&&c.h>=85),'both play choices must be visible');
  await page.locator('#home-multi').click();
  await page.waitForURL(/choose\.html\?type=multi$/);
  assert.equal(await page.locator('.mode-option').count(),3);
  assert.equal(await page.locator('.kit-option').count(),4);
  const setup=await page.evaluate(()=>({
   vw:innerWidth,scroll:document.documentElement.scrollWidth,
   kits:[...document.querySelectorAll('.kit-option')].map(e=>e.getBoundingClientRect().width)
  }));
  assert.ok(setup.scroll<=setup.vw+3,'setup must not overflow: '+JSON.stringify(setup));
  assert.ok(setup.kits.every(w=>w>=105),'all kit options must remain readable');
  if(width===1366)await page.screenshot({path:'/tmp/equanova-mission-control-art-desktop.png',fullPage:true});
  if(width===390)await page.screenshot({path:'/tmp/equanova-mission-control-art-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  await page.close();
 }
 const chooser=await browser.newPage({viewport:{width:390,height:844}});
 await chooser.goto(base+'choose.html?type=single',{waitUntil:'networkidle'});
 await chooser.locator('[data-tile-kit="advanced"]').click();
 assert.equal(await chooser.locator('[data-tile-kit="advanced"]').getAttribute('aria-pressed'),'true');
 assert.match(await chooser.locator('#kit-description').textContent(),/Digits 0–9.*no fractions/i);
 await chooser.reload({waitUntil:'networkidle'});
 assert.equal(await chooser.locator('[data-tile-kit="advanced"]').getAttribute('aria-pressed'),'true',
  'chosen kit must persist across visits');
 await chooser.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await chooser.locator('.mode-option').first().evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
 await chooser.goto(base,{waitUntil:'networkidle'});
 assert.equal(await chooser.locator('.entry-logo h1').evaluate(el=>getComputedStyle(el).animationName),'none');
 await chooser.close();
 console.log('Decluttered mission control visual tests passed: animated mini board, two links, progressive kit screen, four viewports and reduced motion.');
}finally{await browser.close();}
