import assert from 'node:assert/strict';
import {chromium} from 'playwright';

// Mission home is the public / index. No modal or redundant second row of
// mode buttons should be required to enter a game.
const ORIGIN='http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const errors=[];
try{
 for(const [width,height] of [[1366,768],[768,1024],[390,844],[320,700]]){
  const page=await browser.newPage({viewport:{width,height}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(ORIGIN+'/',{waitUntil:'networkidle'});
  assert.match(await page.title(),/Choose your mission/);
  assert.equal(await page.locator('.mode-card').count(),4);
  assert.equal(await page.locator('.mode-card[href]').count(),4);
  assert.equal(await page.locator('.alien-lab-card').count(),2,'Alien Lab and Achievement Hangar navigation');
  assert.equal(await page.locator('#modal').count(),0,'home must not be a mode selection modal');
  assert.equal(await page.locator('#board').count(),0,'the home page should not load a game board');
  assert.equal(await page.locator('.mode-card-footer button').count(),0,'no duplicate mode buttons');
  const layout=await page.evaluate(()=>({
   width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
   cards:[...document.querySelectorAll('.mode-card')].map(card=>{
    const r=card.getBoundingClientRect();
    return {width:r.width,height:r.height,tag:card.tagName,href:card.getAttribute('href')};
   })
  }));
  assert.ok(layout.scrollWidth<=width+2,'no horizontal overflow: '+width);
  assert.ok(layout.cards.every(c=>c.tag==='A'&&c.width>=240&&c.height>=120),
    'the full cards must be large accessible links: '+JSON.stringify(layout));
  if(width===1366||width===390)
    await page.screenshot({path:'/tmp/equanova-home-'+width+'.png',fullPage:true});
  await page.close();
 }
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(ORIGIN+'/',{waitUntil:'networkidle'});
 // Selecting the whole card using a keyboard must load the requested game.
 await page.locator('#home-sector').focus();
 await page.keyboard.press('Enter');
 await page.waitForURL(/play\.html\?mode=sector(?:&tiles=natural)?$/);
 await page.locator('.cell').first().waitFor();
 if(await page.locator('#modal[open]').count())
   await page.locator('#modal-actions button').last().click();
 assert.equal(await page.locator('#board .cell').count(),361);
 await page.locator('#mode-btn').click();
 await page.waitForURL(/index\.html$/);
 assert.match(await page.locator('[data-save="sector"]').textContent(),/CONTINUE/);
 await page.locator('#home-rogue').click();
 await page.waitForURL(/play\.html\?mode=rogue(?:&tiles=natural)?$/);
 assert.match(await page.locator('#sector-label').textContent(),/THE DRIFT/);
 if(await page.locator('#modal[open]').count())
   await page.locator('#modal-actions button').last().click();
 await page.locator('#mode-btn').click();
 await page.locator('#home-local').click();
 await page.waitForURL(/play\.html\?mode=local(?:&tiles=natural)?$/);
 assert.match(await page.locator('#modal-title').textContent(),/local match/i);
 assert.equal(await page.locator('#local-player-count').count(),1);
 await page.locator('#modal-actions button').first().click();
 await page.waitForURL(/index\.html$/);
 await page.locator('#home-online').click();
 await page.waitForURL(/online\.html(?:\?tiles=natural)?$/);
 assert.equal(await page.locator('#online-gate').count(),1);
 await page.locator('#online-gate .online-back').click();
 await page.waitForURL(/index\.html$/);
 await page.locator('.alien-lab-card').click();
 await page.waitForURL(/alien-lab\.html$/);
 assert.equal(await page.locator('.exit-link').count(),1);
 await page.locator('.exit-link').click();
 await page.waitForURL(/index\.html$/);
 await page.goto(ORIGIN+'/',{waitUntil:'networkidle'});
 assert.equal(await page.locator('#home-tile-kits .tile-kit-card').count(),4);
 await page.locator('[data-tile-kit="rational"]').click();
 assert.equal(await page.locator('[data-tile-kit="rational"]').getAttribute('aria-pressed'),'true');
 assert.match(await page.locator('#home-sector').getAttribute('href'),/&tiles=rational$/);
 await page.locator('#home-sector').click();
 await page.waitForURL(/play\.html\?mode=sector&tiles=rational$/);
 // An existing Launchpad save requires explicit consent before switching kits.
 if(await page.locator('#modal[open]').count()&&
    /CHANGE PHYSICAL TILE KIT/.test(await page.locator('#modal-eyebrow').textContent()))
   await page.locator('#modal-actions button').last().click();
 assert.equal(await page.locator('#rack .bracket-tile').count(),2);
 assert.equal(await page.locator('#rack-count').textContent(),'11 / 11');
 assert.equal(await page.locator('#board .cell').count(),361);
 assert.deepEqual(errors,[],'all home-page navigation must be free of script errors');
 console.log('Mission home browser passed: four full-card keyboard/click routes, save/resume, Local setup back, online and Alien Lab, 4 viewport widths.');
 await page.close();
}finally{
 await browser.close();
}
