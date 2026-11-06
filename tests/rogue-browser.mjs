import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1366,height:768}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
const cell=(row,col)=>page.locator('.cell[data-index="'+(row*13+col)+'"]');
async function put(symbol,row,col){
 if(symbol==='='){await page.locator('#equals-tile').click();}
 else {
   await page.locator('#rack .tile').evaluateAll((buttons,value)=>{
     const target=buttons.find(el=>el.querySelector('span')?.textContent===value);
     if(!target)throw new Error('Missing tile '+value);
     target.click();
   },symbol);
 }
 await cell(row,col).click();
}
try{
 await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
 await page.locator('.cell').first().waitFor();
 if(await page.locator('#modal[open]').count())await page.locator('#modal-actions button').last().click();
 const classicBefore=await page.evaluate(()=>localStorage.getItem('equa-nova.sector-run.v1'));
 assert.ok(classicBefore,'the original Sector Run must be saved');
 await page.locator('#mode-btn').click();
 assert.match(await page.locator('#modal-title').textContent(),/reactor mission/i);
 assert.match(await page.locator('.mode-choice-grid').textContent(),/THE DRIFT/i);
 await page.locator('#modal-actions button').last().click();
 assert.match(await page.locator('#modal-title').textContent(),/evolving reactor run/i);
 await page.locator('#modal-actions button').last().click();
 assert.match(await page.locator('#sector-label').textContent(),/THE DRIFT 01/i);
 assert.equal(await page.locator('#rogue-summary').isVisible(),true);
 assert.equal(await page.locator('#flux-count').textContent(),'0');
 assert.equal(await page.locator('#anomaly-banner').isVisible(),false);
 const firstDrift=await page.evaluate(()=>localStorage.getItem('equa-nova.drift.v1'));
 assert.ok(firstDrift,'a different key saves the Drift');
 assert.equal(JSON.parse(firstDrift).mode,'rogue');
 assert.equal(await page.evaluate(()=>localStorage.getItem('equa-nova.last-mode.v1')),'rogue');

 // Approach the first-sector target with one turn left, then submit a real
 // BIDMAS equation. The save must resolve the win before the score animation.
 await page.evaluate(raw=>{
   const data=JSON.parse(raw);data.turn=6;data.score=39;
   localStorage.setItem('equa-nova.drift.v1',JSON.stringify(data));
 },firstDrift);
 await page.reload({waitUntil:'networkidle'});
 assert.equal(await page.locator('#turn').textContent(),'6 / 6');
 for(const [symbol,row,col] of [['8',6,3],['+',6,4],['4',6,5],['=',6,6],['1',6,7]])await put(symbol,row,col);
 await page.locator('#rack .wildcard-blank-any').click();
 await cell(6,8).click();
 await page.locator('#wildcard-choices button',{hasText:'2'}).first().click();
 assert.match(await page.locator('#preview-equation').textContent(),/8\+4=12/);
 await page.locator('#score-btn').click();
 await page.reload({waitUntil:'networkidle'});
 assert.match(await page.locator('#modal-title').textContent(),/upgrade before sector 2/i);
 assert.match(await page.locator('#modal-eyebrow').textContent(),/salvage bay/i);
 const fluxBefore=Number(await page.locator('#flux-count').textContent());
 assert.ok(fluxBefore>=4,'sector survival should afford at least one upgrade');
 assert.equal(await page.locator('.salvage-card').count(),4);
 const firstUpgrade=await page.locator('.salvage-card').first().locator('strong').textContent();
 assert.equal(firstUpgrade,'Ionised Sevens');
 await page.locator('.salvage-card').first().locator('button').click();
 assert.equal(Number(await page.locator('#flux-count').textContent()),fluxBefore-4);
 assert.match(await page.locator('#upgrade-summary').textContent(),/Ionised Sevens/);
 const installed=JSON.parse(await page.evaluate(()=>localStorage.getItem('equa-nova.drift.v1')));
 assert.deepEqual(installed.rogue.upgrades,['ion-seven']);
 await page.reload({waitUntil:'networkidle'});
 assert.match(await page.locator('#modal-eyebrow').textContent(),/salvage bay/i);
 assert.equal(await page.locator('#flux-count').textContent(),String(fluxBefore-4));
 assert.equal(await page.locator('.salvage-card').filter({hasText:'Ionised Sevens'}).count(),0);
 await page.locator('#modal-actions button').last().click();
 assert.match(await page.locator('#sector-label').textContent(),/THE DRIFT 02/i);
 assert.match(await page.locator('#upgrade-summary').textContent(),/Ionised Sevens/);
 assert.ok(await page.locator('#rack .tile').count()===7);
 await page.reload({waitUntil:'networkidle'});
 assert.match(await page.locator('#sector-label').textContent(),/THE DRIFT 02/i);

 // Restore a clean opening board as a third-sector boss and verify that its
 // real anomaly appears without changing the saved equipment.
 await page.evaluate(starter=>{
   const data=JSON.parse(localStorage.getItem('equa-nova.drift.v1'));
   const clean=JSON.parse(starter);
   data.sector=3;data.turn=1;data.score=0;data.phase='playing';
   data.board=clean.board;data.rack=clean.rack;data.bag=clean.bag;
   data.pending={};data.placementOrder=[];data.stats=clean.stats;
   localStorage.setItem('equa-nova.drift.v1',JSON.stringify(data));
 },firstDrift);
 await page.reload({waitUntil:'networkidle'});
 assert.match(await page.locator('#sector-label').textContent(),/THE DRIFT 03/);
 assert.match(await page.locator('#anomaly-name').textContent(),/POWER LEAK/);
 assert.equal(await page.locator('#anomaly-banner').isVisible(),true);

 // Switching modes must restore the untouched original classroom save.
 await page.locator('#mode-btn').click();
 await page.locator('#modal-actions button').first().click();
 assert.match(await page.locator('#sector-label').textContent(),/SECTOR 01/);
 assert.equal(await page.locator('#score').textContent(),'0');
 assert.equal(await page.evaluate(()=>localStorage.getItem('equa-nova.sector-run.v1'))===classicBefore,true);
 await page.reload({waitUntil:'networkidle'});
 assert.match(await page.locator('#sector-label').textContent(),/SECTOR 01/);
 await page.locator('#mode-btn').click();
 await page.locator('#modal-actions button').last().click();
 assert.match(await page.locator('#anomaly-name').textContent(),/POWER LEAK/);
 assert.match(await page.locator('#upgrade-summary').textContent(),/Ionised Sevens/);

 // No retry with preserved upgrades: failing the last turn offers a new run.
 await page.evaluate(()=>{
   const state=JSON.parse(localStorage.getItem('equa-nova.drift.v1'));
   state.turn=6;state.score=0;
   localStorage.setItem('equa-nova.drift.v1',JSON.stringify(state));
 });
 await page.reload({waitUntil:'networkidle'});
 await page.locator('#swap-btn').click();
 await page.locator('#rack .tile').first().click();
 await page.locator('#swap-btn').click();
 assert.match(await page.locator('#modal-eyebrow').textContent(),/drift signal lost/i);
 const deathOptions=await page.locator('#modal-actions button').allTextContents();
 assert.ok(deathOptions.some(x=>/new drift/i.test(x)));
 assert.ok(!deathOptions.some(x=>/retry sector/i.test(x)),'permadeath prevents retrying the failed sector');
 await page.reload({waitUntil:'networkidle'});
 assert.match(await page.locator('#modal-eyebrow').textContent(),/drift signal lost/i);
 await page.locator('#modal-actions button').last().click();
 assert.match(await page.locator('#sector-label').textContent(),/THE DRIFT 01/);
 assert.equal(await page.locator('#flux-count').textContent(),'0');
 assert.match(await page.locator('#upgrade-summary').textContent(),/No upgrades/);

 // Header and game controls should remain fully visible on a phone.
 await page.setViewportSize({width:390,height:844});
 const mobile=await page.evaluate(()=>{
   const buttons=[...document.querySelectorAll('.top-actions button')];
   const score=document.querySelector('#score-btn').getBoundingClientRect();
   return {scrollWidth:document.documentElement.scrollWidth,
      width:innerWidth,scoreBottom:score.bottom,
      topActions:buttons.map(button=>({
         id:button.id,right:button.getBoundingClientRect().right,
         width:button.getBoundingClientRect().width}))};
 });
 assert.ok(mobile.scrollWidth<=mobile.width+3,'Drift header must not cause horizontal scrolling');
 assert.ok(mobile.topActions.every(x=>x.right<=mobile.width+3&&x.width>=25),'all mode and utility buttons remain accessible');
 assert.ok(mobile.scoreBottom<mobile.width*3,'score is visible without scrolling');
 assert.deepEqual(errors,[]);
 console.log('Drift browser passed: mode selection, shop purchase, double-safe rewards, restore, anomaly, separate saves and permadeath.');
}finally{
 await browser.close();
}
