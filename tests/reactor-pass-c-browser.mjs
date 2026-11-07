import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {installKnownRack} from './opening-fixture.mjs';
const base='http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const errors=[];
async function put(page,symbol,row,col){
 if(symbol==='=')await page.locator('#equals-tile').click();
 else await page.locator('#rack .tile').evaluateAll((buttons,value)=>{
   const target=buttons.find(el=>el.querySelector('span')?.textContent===value);
   if(!target)throw new Error('Missing '+value+' in rack');target.click();
 },symbol);
 await page.locator('.cell[data-index="'+((row+3)*19+(col+3))+'"]').click();
}
try{
 for(const [width,height] of [[1366,768],[768,1024],[390,844],[320,700]]){
  const page=await browser.newPage({viewport:{width,height}});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'play.html?mode=sector',{waitUntil:'networkidle'});
  if(await page.locator('#modal[open]').count())await page.locator('#modal-actions button').last().click();
  assert.equal(await page.locator('.cell').count(),361);
  assert.equal(await page.locator('#reactor-phase-label').textContent(),'SELECT TILES');
  assert.equal(await page.locator('#app').getAttribute('data-reactor-phase'),'idle');
  assert.equal(await page.locator('#energy-progress').getAttribute('role'),'progressbar');
  assert.equal(await page.locator('#energy-progress').getAttribute('aria-valuenow'),'0');
  assert.equal(await page.locator('#energy-progress').getAttribute('aria-valuemax'),
    await page.locator('#target').textContent());
  assert.equal(await page.locator('#board-frame #energy-burst').count(),0,
    'score banner must not cover the mathematical grid');
  assert.equal(await page.locator('.reactor-console-readout #energy-burst').count(),1);
  const geometry=await page.evaluate(()=>({
    frame:document.querySelector('#board-frame').getBoundingClientRect().width,
    console:document.querySelector('.reactor-console-head').getBoundingClientRect().width,
    viewport:innerWidth,scroll:document.documentElement.scrollWidth,
    zoomVisible:[...document.querySelectorAll('.board-zoom-toolbar button')]
       .every(button=>{const rect=button.getBoundingClientRect();return rect.right<=innerWidth+2&&rect.left>=-2}),
    statusVisible:(()=>{const r=document.querySelector('#reactor-phase-label').getBoundingClientRect();return r.width>25&&r.right<=innerWidth})()
  }));
  assert.ok(geometry.frame<=720,'Pass C must respect the existing 720px tablet frame cap');
  assert.ok(geometry.console<=665,'console must fit same compact playing region');
  assert.ok(geometry.scroll<=geometry.viewport+3,'no page overflow at '+width+': '+JSON.stringify(geometry));
  assert.ok(geometry.zoomVisible,'all zoom controls remain reachable at '+width);
  assert.ok(geometry.statusVisible,'the reactor phase remains visible at '+width);
  await page.locator('#board-zoom-in').click();
  await page.locator('#board-zoom-fit').click();
  assert.equal(await page.locator('.cell').count(),361);
  await page.close();
 }
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'play.html?mode=sector',{waitUntil:'networkidle'});
 if(await page.locator('#modal[open]').count())await page.locator('#modal-actions button').last().click();
 await installKnownRack(page,'sector');
 await page.locator('#pilot-portrait svg').first().waitFor({timeout:12000});
 assert.match(await page.locator('#pilot-name').textContent(),/YOUR ALIEN/);
 await page.locator('.pilot-reactor-core').evaluate(img=>img.decode());
 assert.ok(await page.locator('.pilot-reactor-core').evaluate(img=>img.naturalWidth>0));
 const initialWidth=await page.locator('#board-frame').evaluate(el=>el.getBoundingClientRect().width);
 for(const [value,row,col] of [['8',6,3],['+',6,4],['4',6,5],['=',6,6],['1',6,7],['2',6,8]])await put(page,value,row,col);
 assert.equal(await page.locator('#app').getAttribute('data-reactor-phase'),'ready');
 assert.equal(await page.locator('#reactor-phase-label').textContent(),'READY TO CHECK');
 assert.equal(await page.locator('#board-frame').evaluate(el=>el.getBoundingClientRect().width),initialWidth);
 assert.equal(await page.locator('#preview-equation').textContent(),'8+4=12');
 await page.locator('#score-btn').click();
 assert.equal(await page.locator('#app').getAttribute('data-reactor-phase'),'transfer');
 assert.equal(await page.locator('#reactor-phase-label').textContent(),'TRANSFERRING ENERGY');
 assert.equal(await page.locator('#ceremony-readout').isVisible(),true);
 await page.waitForFunction(()=>parseFloat(document.querySelector('#reactor-transfer-fill').style.width)>0,
   {timeout:4000});
 const stored=JSON.parse(await page.evaluate(()=>localStorage.getItem('equa-nova.sector-run.v1')));
 assert.ok(stored.score>0);
 await page.locator('#skip-ceremony').click();
 await page.locator('#modal[open]').waitFor();
 assert.equal(await page.locator('#ceremony-readout').isVisible(),false);
 assert.equal(await page.locator('#energy-progress').getAttribute('aria-valuenow'),
   String(Math.min(stored.score,Number(await page.locator('#target').textContent()))));
 assert.equal(await page.locator('#score').textContent(),String(stored.score));
 assert.equal(await page.locator('#reactor-transfer-fill').getAttribute('style'),'width: 0%;',
  'transfer decoration must reset on completion');
 assert.equal(await page.locator('#board-frame #energy-burst').count(),0);
 await page.locator('#modal-actions button').last().click();
 await page.screenshot({path:'/tmp/equanova-reactor-pass-c-desktop.png',fullPage:true});
 await page.close();
 const drift=await browser.newPage({viewport:{width:390,height:844}});
 drift.on('pageerror',error=>errors.push(error.message));
 await drift.goto(base+'play.html?mode=rogue',{waitUntil:'networkidle'});
 if(await drift.locator('#modal[open]').count())await drift.locator('#modal-actions button').last().click();
 await drift.evaluate(()=>{
   const key='equa-nova.drift.v1',saved=JSON.parse(localStorage.getItem(key));
   saved.rogue.upgrades=['ion-seven'];saved.rogue.tempSlots=['double-score'];
   saved.rogue.tempBought=['double-score'];saved.rogue.earned=11;saved.rogue.spent=11;
   saved.rogue.flux=0;localStorage.setItem(key,JSON.stringify(saved));
 });
 await drift.reload({waitUntil:'networkidle'});
 assert.equal(await drift.locator('#permanent-slots [data-equipment-id="ion-seven"]').count(),1);
 assert.equal(await drift.locator('#temporary-slots [data-equipment-id="double-score"]').count(),1);
 assert.equal(await drift.locator('#permanent-slots .equip-svg').count(),1);
 assert.match(await drift.locator('#upgrade-summary').textContent(),/Ionised Sevens/i);
 await drift.locator('#temporary-slots [data-equipment-id="double-score"]').click();
 assert.equal(await drift.locator('#temporary-slots .equip-state').textContent(),'ARMED');
 assert.equal(await drift.locator('#temporary-slots [data-equipment-id="double-score"]').getAttribute('aria-pressed'),'true');
 const mobile=await drift.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,
   frame:document.getElementById('board-frame').getBoundingClientRect().width}));
 assert.ok(mobile.scroll<=mobile.width+3,'gadget hardware must not widen mobile layout');
 assert.ok(mobile.frame<=665);
 await drift.screenshot({path:'/tmp/equanova-reactor-pass-c-drift-mobile.png',fullPage:true});
 await drift.close();
 assert.deepEqual(errors,[]);
 console.log('Reactor Pass C browser passed: four widths, zoom, pilot artwork, scoring progression, accessible energy, gadget status and unobstructed tiles.');
}finally{await browser.close();}
