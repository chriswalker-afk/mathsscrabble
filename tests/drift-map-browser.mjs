import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1366,height:768}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const url='http://127.0.0.1:4173/play.html?mode=rogue';
const key='equa-nova.drift.v1';
const get=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
const set=async fn=>{
 await page.evaluate(({key,code})=>{
   const state=JSON.parse(localStorage.getItem(key));
   const patch=(new Function('save',code))(state);
   if(patch)Object.assign(state,patch);
   localStorage.setItem(key,JSON.stringify(state));
 },{key,code:fn});
 await page.reload({waitUntil:'networkidle'});
};
try{
 await page.goto(url,{waitUntil:'networkidle'});
 if(await page.locator('#modal[open]').count())await page.locator('#modal-actions button').last().click();
 await page.locator('#board .cell').first().waitFor();
 const first=await get();
 assert.equal(first.rogue.zoneBosses.length,1);
 assert.match(await page.locator('#sector-label').textContent(),/THE DRIFT 01.*ZONE 1/i);
 assert.equal(await page.locator('#drift-zone-map').isVisible(),true);
 assert.equal(await page.locator('#drift-zone-map .zone-node').count(),3);
 const boardWidth=await page.locator('#board-frame').evaluate(el=>el.getBoundingClientRect().width);
 await page.locator('#drift-zone-map').click();
 assert.match(await page.locator('#modal-title').textContent(),/zone map/i);
 assert.ok(await page.locator('.zone-map-card').count()>=2);
 assert.ok(await page.locator('.zone-map-card.map-current .boss-art').count()===1);
 await page.screenshot({path:'/tmp/equanova-drift-zone-map-desktop.png',fullPage:true});
 await page.locator('#modal-actions button').last().click();
 await page.reload({waitUntil:'networkidle'});
 assert.deepEqual((await get()).rogue.zoneBosses,first.rogue.zoneBosses,'saved boss cannot reroll after refresh');

 // The Warden's eight impassable squares must reject an actual attempted
 // physical placement, including dragged tiles and the unlimited equals sign.
 await set("save=>{save.sector=3;save.turn=1;save.rogue.zoneBosses=['grid-warden'];save.rogue.forcedTile=null;save.phase='playing';}");
 assert.equal(await page.locator('.cell.boss-blocked').count(),8);
 assert.equal(await page.locator('#board-frame').evaluate(el=>el.getBoundingClientRect().width),boardWidth);
 await page.locator('#equals-tile').click();
 await page.locator('.cell.boss-blocked').first().click();
 assert.match(await page.locator('#log').textContent(),/blocked/i);
 assert.equal(await page.locator('.cell.pending').count(),0);
 await page.locator('#zone-map-btn').click();
 assert.match(await page.locator('.zone-map-card.map-current').textContent(),/GRID WARDEN/i);
 await page.screenshot({path:'/tmp/equanova-drift-grid-warden.png',fullPage:true});
 await page.locator('#modal-actions button').last().click();

 await set("save=>{save.rogue.zoneBosses=['curse-weaver'];}");
 assert.equal(await page.locator('.cell.boss-rift').count(),8);
 assert.equal(await page.locator('.cell.boss-blocked').count(),0);
 await page.screenshot({path:'/tmp/equanova-drift-curse-weaver.png',fullPage:true});

 await set("save=>{save.rogue.zoneBosses=['forced-relic'];save.rogue.forcedTile=save.rack[0].id;}");
 assert.equal(await page.locator('#rack .boss-required').count(),1);
 await page.locator('#swap-btn').click();
 await page.locator('#rack .boss-required').click();
 await page.locator('#swap-btn').click();
 assert.match(await page.locator('#log').textContent(),/boss demands/i);
 assert.equal((await get()).turn,1);
 await page.locator('#undo-btn').click();

 await set("save=>{save.rogue.zoneBosses=['plus-embargo'];save.rogue.forcedTile=null;}");
 await page.locator('#bag-details-btn').click();
 assert.match(await page.locator('#modal-body').textContent(),/BOSS EMBARGO/i);
 assert.match(await page.locator('#modal-body').textContent(),/sealed from draws/i);
 await page.locator('#modal-actions button').last().click();

 await page.setViewportSize({width:390,height:844});
 await page.reload({waitUntil:'networkidle'});
 assert.equal(await page.locator('#drift-zone-map').isVisible(),true);
 assert.equal(await page.locator('#drift-zone-map .zone-node').count(),3);
 assert.equal(await page.locator('#board .cell').count(),169);
 assert.ok((await page.evaluate(()=>document.documentElement.scrollWidth))<=392,
    'zone strip and boss controls must not horizontally overflow a phone');
 await page.locator('#drift-zone-map').click();
 const layout=await page.evaluate(()=>{
   const d=document.querySelector('#modal').getBoundingClientRect();
   const actions=document.querySelector('#modal-actions').getBoundingClientRect();
   return {top:d.top,bottom:d.bottom,actionsBottom:actions.bottom,viewport:innerHeight};
 });
 assert.ok(layout.top>=0&&layout.bottom<=layout.viewport+2);
 assert.ok(layout.actionsBottom<=layout.viewport+2);
 await page.screenshot({path:'/tmp/equanova-drift-zone-map-phone.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('Drift zone browser passed: saved map, guardian artwork, impassable squares, rifts, forced rack tile, sealed bag and phone fit.');
}finally{await browser.close();}
