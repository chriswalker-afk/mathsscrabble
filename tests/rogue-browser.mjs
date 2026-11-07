import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {installKnownRack} from './opening-fixture.mjs';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1366,height:768}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
const cell=(row,col)=>page.locator('.cell[data-index="'+((row+3)*19+(col+3))+'"]');
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
 await page.goto('http://127.0.0.1:4173/play.html?mode=sector',{waitUntil:'networkidle'});
 await page.locator('.cell').first().waitFor();
 if(await page.locator('#modal[open]').count())await page.locator('#modal-actions button').last().click();
 const classicBefore=await page.evaluate(()=>localStorage.getItem('equa-nova.sector-run.v1'));
 assert.ok(classicBefore,'the original Sector Run must be saved');
 await page.locator('#mode-btn').click();
 await page.waitForURL(/index\.html$/);
 await page.locator('#home-single').click();
 await page.waitForURL(/choose\.html\?type=single$/);
 await page.locator('[data-mode="rogue"]').click();
 await page.locator('#launch-button').click();
 await page.waitForURL(/play\.html\?mode=rogue(?:&tiles=natural)?$/);
 assert.match(await page.locator('#modal-title').textContent(),/clear sectors, upgrade and face bosses/i);
 await page.locator('#modal-actions button').last().click();
 await installKnownRack(page,'rogue');
 assert.match(await page.locator('#sector-label').textContent(),/THE DRIFT 01/i);
 assert.equal(await page.locator('#rogue-summary').isVisible(),true);
 assert.equal(await page.locator('#flux-count').textContent(),'0');
 assert.equal(await page.locator('#anomaly-banner').isVisible(),false);
 const baseBoardWidth=await page.locator('#board-frame').evaluate(el=>el.getBoundingClientRect().width);
 assert.equal(await page.locator('#permanent-slots .equipment-slot').count(),4);
  assert.equal(await page.locator('#rogue-summary').evaluate(x=>Boolean(x.closest('.left-panel'))),true,
    'Ship Systems belong in the slim telemetry rail');
   assert.equal(await page.locator('#drift-temporary').evaluate(x=>Boolean(x.closest('.rack-section'))),true,
    'Mission Gadgets belong beside the rack');
   assert.equal(await page.locator('.right-panel').count(),0,'no permanent command console');
   assert.equal(await page.locator('#drift-loadout').isVisible(),true);
 assert.equal(await page.locator('#temporary-slots .equipment-slot').count(),2);
 const firstDrift=await page.evaluate(()=>localStorage.getItem('equa-nova.drift.v1'));
 assert.ok(firstDrift,'a different key saves the Drift');
 assert.equal(JSON.parse(firstDrift).mode,'rogue');
 assert.equal(await page.evaluate(()=>localStorage.getItem('equa-nova.last-mode.v1')),'rogue');

 // Approach the first-sector target with five turns left, then submit a real
 // BIDMAS equation. The save must resolve the win before the score animation.
 await page.evaluate(raw=>{
   const data=JSON.parse(raw);data.turn=1;data.score=39;
   localStorage.setItem('equa-nova.drift.v1',JSON.stringify(data));
 },firstDrift);
 await page.reload({waitUntil:'networkidle'});
 assert.equal(await page.locator('#turn').textContent(),'1 / 6');
 for(const [symbol,row,col] of [['8',6,3],['+',6,4],['4',6,5],['=',6,6],['1',6,7]])await put(symbol,row,col);
 await page.locator('#rack .wildcard-blank-any').click();
 await cell(6,8).click();
 await page.locator('#wildcard-choices button',{hasText:'2'}).first().click();
 assert.match(await page.locator('#preview-equation').textContent(),/8\+4=12/);
 await page.locator('#score-btn').click();
 await page.reload({waitUntil:'networkidle'});
 assert.match(await page.locator('#drift-hub-title').textContent(),/stabilised/i);
 assert.equal(await page.locator('#drift-hub .drift-map-feature').count(),1,
   'round results must show a map and saved zone boss');
 assert.equal(await page.locator('#drift-hub .drift-summary-energy strong').count(),3,
   'round results must include energy, target and Flux reward');
 const visibleButtons=await page.locator('#drift-hub-actions button').allTextContents();
 const wonSave=await page.evaluate(()=>localStorage.getItem('equa-nova.drift.v1'));
 // Verify that the player may bypass shopping entirely without paying Flux.
 const skipBay=await browser.newPage({viewport:{width:1366,height:768}});
 await skipBay.addInitScript(raw=>{
   localStorage.setItem('equa-nova.drift.v1',raw);
   localStorage.setItem('equa-nova.last-mode.v1','rogue');
 },wonSave);
 await skipBay.goto('http://127.0.0.1:4173/play.html?mode=rogue',{waitUntil:'networkidle'});
 assert.equal(await skipBay.locator('#drift-hub').isVisible(),true);
 await skipBay.locator('#drift-hub-actions .drift-go').click();
 const bypassed=await skipBay.evaluate(()=>JSON.parse(localStorage.getItem('equa-nova.drift.v1')));
 assert.equal(bypassed.sector,2);
 assert.equal(bypassed.rogue.upgrades.length,0);
 assert.equal(bypassed.rogue.flux,Number(JSON.parse(wonSave).rogue.flux));
 await skipBay.close();
 assert.ok(visibleButtons.some(t=>/salvage bay/i.test(t)));
 assert.ok(visibleButtons.some(t=>/continue to sector 02/i.test(t)));
 await page.locator('#drift-hub-actions .drift-bay').click();
 assert.match(await page.locator('#drift-hub-title').textContent(),/salvage bay/i);
 assert.equal(await page.locator('.drift-salvage-hero img').count(),1);
 await page.locator('.drift-salvage-hero img').evaluate(async img=>{
   await img.decode();
 });
 assert.ok(await page.locator('.drift-salvage-hero img').evaluate(img=>img.naturalWidth>0),
   'the illustrated hangar must fully decode as a real SVG asset');
 await page.locator('#drift-hub-actions .drift-back').click();
 assert.match(await page.locator('#drift-hub-title').textContent(),/stabilised/i);
 await page.locator('#drift-hub-actions .drift-bay').click();
 const fluxBefore=Number(await page.locator('#flux-count').textContent());
 assert.ok(fluxBefore>=4,'sector survival should afford at least one upgrade');
 assert.equal(await page.locator('.salvage-card').count(),7);
 const firstStock=JSON.parse(wonSave).rogue.shopStock;
 assert.equal(firstStock.sector,1);
 assert.equal(firstStock.systems.length,4);
 assert.equal(firstStock.gadgets.length,3);
 await page.setViewportSize({width:390,height:844});
 const shopOnPhone=await page.evaluate(()=>{
   const actions=document.querySelector('#drift-hub-actions').getBoundingClientRect();
   const dialog=document.querySelector('#drift-hub').getBoundingClientRect();
   return {actionsBottom:actions.bottom,dialogTop:dialog.top,dialogBottom:dialog.bottom,
     scrollWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,viewportHeight:innerHeight};
 });
 assert.ok(shopOnPhone.actionsBottom<=shopOnPhone.viewportHeight,
   'Salvage Bay navigation must remain visible on phones');
 assert.ok(shopOnPhone.dialogTop>=0&&shopOnPhone.dialogBottom<=shopOnPhone.viewportHeight,
   'shop must fit within the mobile viewport');
 assert.ok(shopOnPhone.scrollWidth<=shopOnPhone.viewportWidth+3,'shop must not overflow horizontally');
 await page.setViewportSize({width:1366,height:768});
 const offered=await page.locator('#salvage-grid [data-item-id]').evaluateAll(cards=>
   cards.map(card=>({id:card.dataset.itemId,name:card.querySelector('strong').textContent,
     cost:Number(card.querySelector('button').textContent.split(' ')[0])})));
 const gadgets=await page.locator('#salvage-temporary-grid [data-item-id]').evaluateAll(cards=>
   cards.map(card=>({id:card.dataset.itemId,cost:Number(card.querySelector('button').textContent.split(' ')[0])})));
 assert.deepEqual(offered.map(item=>item.id),firstStock.systems);
 assert.deepEqual(gadgets.map(item=>item.id),firstStock.gadgets);
 const cheapestSystem=offered.slice().sort((a,b)=>a.cost-b.cost)[0];
 const cheapestGadget=gadgets.slice().sort((a,b)=>a.cost-b.cost)[0];
 assert.ok(fluxBefore>=cheapestSystem.cost+cheapestGadget.cost,
   'sector reward should afford an inexpensive system and gadget');
 await page.locator('#salvage-grid [data-item-id="'+cheapestSystem.id+'"] button').click();
 assert.equal(Number(await page.locator('#flux-count').textContent()),fluxBefore-cheapestSystem.cost);
 const remainingSystems=await page.locator('#salvage-grid [data-item-id]').evaluateAll(cards=>cards.map(card=>card.dataset.itemId));
 assert.deepEqual(remainingSystems,firstStock.systems.filter(id=>id!==cheapestSystem.id),
   'buying one system must not roll a replacement');
 await page.locator('#salvage-temporary-grid [data-item-id="'+cheapestGadget.id+'"] button').click();
 assert.equal(Number(await page.locator('#flux-count').textContent()),
   fluxBefore-cheapestSystem.cost-cheapestGadget.cost);
 assert.match(await page.locator('#upgrade-summary').textContent(),new RegExp(cheapestSystem.name));
 const installed=JSON.parse(await page.evaluate(()=>localStorage.getItem('equa-nova.drift.v1')));
 assert.deepEqual(installed.rogue.upgrades,[cheapestSystem.id]);
 assert.deepEqual(installed.rogue.tempSlots,[cheapestGadget.id]);
 assert.deepEqual(installed.rogue.shopStock,firstStock);
 assert.equal(await page.locator('#permanent-slots .equip-svg').count(),1);
 assert.equal(await page.locator('#temporary-slots .equip-svg').count(),1);
 assert.equal(await page.locator('#board-frame').evaluate(el=>el.getBoundingClientRect().width),baseBoardWidth,
   'equipment must not reduce the board width');
 await page.reload({waitUntil:'networkidle'});
 assert.match(await page.locator('#drift-hub-title').textContent(),/stabilised/i);
 await page.locator('#drift-hub-actions .drift-bay').click();
 assert.match(await page.locator('#drift-hub-title').textContent(),/salvage bay/i);
 assert.equal(await page.locator('#flux-count').textContent(),
   String(fluxBefore-cheapestSystem.cost-cheapestGadget.cost));
 assert.equal(await page.locator('#salvage-grid [data-item-id="'+cheapestSystem.id+'"]').count(),0);
 const restored=JSON.parse(await page.evaluate(()=>localStorage.getItem('equa-nova.drift.v1')));
 assert.deepEqual(restored.rogue.shopStock,firstStock,'reopening preserves stock after both purchases');
 await page.locator('#drift-hub-actions .drift-go').click();
 assert.match(await page.locator('#sector-label').textContent(),/THE DRIFT 02/i);
 assert.match(await page.locator('#upgrade-summary').textContent(),new RegExp(cheapestSystem.name));
 assert.equal(await page.locator('#permanent-count').textContent(),'1 / 4');
 assert.equal(await page.locator('#temporary-count').textContent(),'1 / 2');
 assert.equal(await page.locator('#permanent-slots .equipment-slot:not(.is-empty)').count(),1);
 assert.equal(await page.locator('#temporary-slots .equipment-slot:not(.is-empty)').count(),1);
 assert.ok(await page.locator('#rack .tile').count()===8);
 await page.reload({waitUntil:'networkidle'});
 assert.match(await page.locator('#sector-label').textContent(),/THE DRIFT 02/i);

 // Restore a clean opening board as a third-sector boss and verify that its
 // real anomaly appears without changing the saved equipment.
 await page.evaluate(starter=>{
   const data=JSON.parse(localStorage.getItem('equa-nova.drift.v1'));
   const clean=JSON.parse(starter);
   data.sector=3;data.turn=1;data.score=0;data.phase='playing';
    data.rogue.zoneBosses=['power-leak'];data.rogue.forcedTile=null;
   data.board=clean.board;data.rack=clean.rack;data.bag=clean.bag;
   data.pending={};data.placementOrder=[];data.stats=clean.stats;
   localStorage.setItem('equa-nova.drift.v1',JSON.stringify(data));
 },firstDrift);
 await page.reload({waitUntil:'networkidle'});
 assert.match(await page.locator('#sector-label').textContent(),/THE DRIFT 03/);
 assert.match(await page.locator('#anomaly-name').textContent(),/ENERGY LEECH/);
 assert.equal(await page.locator('#anomaly-banner').isVisible(),true);
 assert.equal(await page.locator('#temporary-slots [data-equipment-id="'+cheapestGadget.id+'"]').count(),1,
   'the purchased gadget remains equipped through the boss encounter');
 // Invalid mathematics must not consume a stored mission gadget.
 for(const [symbol,row,col] of [['8',6,3],['+',6,4],['4',6,5],['=',6,6],['1',6,7]])await put(symbol,row,col);
 await page.locator('#rack .wildcard-blank-any').click();
 await cell(6,8).click();
 await page.locator('#wildcard-choices button',{hasText:'3'}).first().click();
 await page.locator('#score-btn').click();
 assert.match(await page.locator('#log').textContent(),/not balanced/i);
 assert.ok(JSON.parse(await page.evaluate(()=>localStorage.getItem('equa-nova.drift.v1')))
   .rogue.tempSlots.includes(cheapestGadget.id));
 await cell(6,8).click();
 await cell(6,8).click();
 await page.locator('#wildcard-choices button',{hasText:'2'}).first().click();
 await page.locator('#score-btn').click();
 await page.reload({waitUntil:'networkidle'});
 const afterValid=JSON.parse(await page.evaluate(()=>localStorage.getItem('equa-nova.drift.v1')));
 if(cheapestGadget.id==='pulse-charge'){
   assert.equal(afterValid.rogue.pulse,0);
   assert.equal(afterValid.rogue.pulseUsed,1);
 }else{
   assert.ok(afterValid.rogue.tempSlots.includes(cheapestGadget.id),
     'unarmed gadgets must not disappear after a normal scored move');
 }
 assert.match(await page.locator('#sector-label').textContent(),/THE DRIFT 03/);

 // Switching modes must restore the untouched original classroom save.
 await page.locator('#mode-btn').click();
 await page.goto('http://127.0.0.1:4173/play.html?mode=sector',{waitUntil:'networkidle'});
 assert.match(await page.locator('#sector-label').textContent(),/SECTOR 01/);
 assert.equal(await page.locator('#score').textContent(),'0');
 const classicRestored=JSON.parse(await page.evaluate(()=>localStorage.getItem('equa-nova.sector-run.v1')));
 const classicStarted=JSON.parse(classicBefore);
 for(const field of ['sector','turn','score','phase','board','rack','bag','pending','progress']){
   assert.deepEqual(classicRestored[field],classicStarted[field],
     'switching mode must preserve the classic game: '+field);
 }
 await page.reload({waitUntil:'networkidle'});
 assert.match(await page.locator('#sector-label').textContent(),/SECTOR 01/);
 const beforeReturn=JSON.parse(await page.evaluate(()=>localStorage.getItem('equa-nova.drift.v1')));
 assert.equal(beforeReturn.sector,3,'boss sector must still be saved before switching back');
 assert.equal(beforeReturn.rogue.zoneBosses[0],'power-leak');
 await page.locator('#mode-btn').click();
 await page.waitForURL(/index\.html$/);
 await page.goto('http://127.0.0.1:4173/play.html?mode=rogue',{waitUntil:'networkidle'});
 await page.waitForURL(/play\.html\?mode=rogue(?:&tiles=natural)?$/);
 const afterReturn=JSON.parse(await page.evaluate(()=>localStorage.getItem('equa-nova.drift.v1')));
 console.log('Drift restore audit:',{
   before:{sector:beforeReturn.sector,phase:beforeReturn.phase,shopSector:beforeReturn.rogue.shopSector,
     boss:beforeReturn.rogue.zoneBosses[0],score:beforeReturn.score},
   after:{sector:afterReturn.sector,phase:afterReturn.phase,shopSector:afterReturn.rogue.shopSector,
     boss:afterReturn.rogue.zoneBosses[0],score:afterReturn.score},
   label:await page.locator('#sector-label').textContent(),
   saved:await page.locator('#save-status').textContent()
 });
 assert.match(await page.locator('#sector-label').textContent(),/THE DRIFT 03/);
 assert.match(await page.locator('#anomaly-name').textContent(),/ENERGY LEECH/);
 assert.match(await page.locator('#upgrade-summary').textContent(),new RegExp(cheapestSystem.name));

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
 const freeSwapSave=JSON.parse(await page.evaluate(()=>localStorage.getItem('equa-nova.drift.v1')));
 assert.equal(freeSwapSave.turn,6,'the first single-tile swap is free');
 assert.equal(freeSwapSave.freeSwapTurn,6,'the free swap must be saved for this turn');
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
   const buttons=[...document.querySelectorAll('.top-actions button')].filter(button=>button.getClientRects().length>0);
   const score=document.querySelector('#score-btn').getBoundingClientRect();
   return {scrollWidth:document.documentElement.scrollWidth,
      width:innerWidth,scoreBottom:score.bottom,
      topActions:buttons.map(button=>({
         id:button.id,right:button.getBoundingClientRect().right,
         width:button.getBoundingClientRect().width}))};
 });
 assert.ok(mobile.scrollWidth<=mobile.width+3,'Drift header must not cause horizontal scrolling');
 assert.equal(await page.locator('#permanent-slots .equipment-slot').count(),4);
 assert.equal(await page.locator('#temporary-slots .equipment-slot').count(),2);
 assert.equal(await page.locator('#ship-systems-drawer > summary').isVisible(),true);
 assert.equal(await page.locator('#ship-systems-drawer').evaluate(el=>el.open),false,'mobile ship drawer starts collapsed');
 assert.equal(await page.locator('#gadget-drawer').evaluate(el=>el.open),false,'mobile gadget drawer starts collapsed');
 await page.locator('#ship-systems-drawer > summary').click();
 assert.equal(await page.locator('#rogue-summary').isVisible(),true,'systems can be inspected on a phone');
 await page.locator('#ship-systems-drawer > summary').click();
 await page.screenshot({path:'/tmp/equanova-drift-equipment-mobile.png',fullPage:true});
 assert.ok(mobile.topActions.every(x=>x.right<=mobile.width+3&&x.width>=25),'all mode and utility buttons remain accessible');
 assert.ok(mobile.scoreBottom<mobile.width*3,'score is visible without scrolling');

 // A ninth rack tile and seventh turn do not reduce the standard 13x13 board.
 const phoneBoardBefore=await page.locator('#board-frame').evaluate(el=>el.getBoundingClientRect().width);
 await page.evaluate(()=>{
   const key='equa-nova.drift.v1';
   const save=JSON.parse(localStorage.getItem(key));
   const at=save.bag.findIndex(t=>!t.blank&&/^[0-9]$/.test(t.value));
   if(at<0)throw Error('No number tile to extend rack');
   save.rack.push(save.bag.splice(at,1)[0]);
   save.rogue.upgrades=['wide-rack','extra-turn'];
   save.rogue.earned=16;save.rogue.spent=16;save.rogue.flux=0;
   localStorage.setItem(key,JSON.stringify(save));
 });
 await page.reload({waitUntil:'networkidle'});
 assert.equal(await page.locator('#rack .tile').count(),9,'expanded rack needs nine physical tiles');
 assert.equal(await page.locator('#rack-count').textContent(),'9 / 9');
 assert.equal(await page.locator('#turn').textContent(),'1 / 7');
 assert.equal(await page.locator('#board-frame').evaluate(el=>el.getBoundingClientRect().width),
   phoneBoardBefore,'extra rack slot must not shrink the board');
 const widthAfter=await page.evaluate(()=>document.documentElement.scrollWidth);
 assert.ok(widthAfter<=390+3,'expanded rack must fit on a narrow phone');
 await page.screenshot({path:'/tmp/equanova-drift-expanded-rack-phone.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('Drift browser passed: mode selection, shop purchase, double-safe rewards, restore, anomaly, separate saves and permadeath.');
}finally{
 await browser.close();
}
