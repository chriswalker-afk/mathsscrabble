import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1366,height:768}});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
const KEY='equa-nova.drift.v1';
try{
 await page.goto('http://127.0.0.1:4173/play.html?mode=rogue',{waitUntil:'networkidle'});
 if(await page.locator('#modal[open]').count())
   await page.locator('#modal-actions button').last().click();
 await page.locator('#board .cell').first().waitFor();
 // Seed a physical 3 in the number-kind half of the rack without changing
 // the 151-tile inventory. All powers are saved using their normal ledger.
 const data=await page.evaluate(key=>{
   const state=JSON.parse(localStorage.getItem(key));
   if(!state)throw Error('Drift save not created');
   let at=state.rack.findIndex(t=>t.value==='3'&&!t.blank);
   if(at<0){
     const from=state.bag.findIndex(t=>t.value==='3'&&!t.blank);
     at=state.rack.findIndex(t=>/^[0-9]$/.test(t.value)&&!t.blank);
     if(from<0||at<0)throw Error('Cannot seed physical 3');
     const tile=state.bag.splice(from,1)[0];
     state.bag.push(state.rack[at]);state.rack[at]=tile;
   }
   state.rogue.tempSlots=['step-up'];state.rogue.tempBought=['step-up'];
   state.rogue.tempUsed=[];state.rogue.earned=3;state.rogue.spent=3;
   state.rogue.flux=0;
   localStorage.setItem(key,JSON.stringify(state));
   return {id:state.rack[at].id,remaining:state.bag.length};
 },KEY);
 await page.reload({waitUntil:'networkidle'});
 assert.equal(await page.locator('#temporary-slots [data-equipment-id="step-up"]').count(),1);
 assert.equal(await page.locator('#temporary-slots .equip-svg').count(),1);
 await page.locator('#temporary-slots [data-equipment-id="step-up"]').click();
 assert.match(await page.locator('#temporary-hint').textContent(),/SELECT A RACK TILE/i);
 await page.locator('#rack .tile').evaluateAll((buttons,id)=>{
   const target=buttons.find(b=>b.dataset.tileId===id);
   if(!target)throw Error('Seeded number not found');
   target.click();
 },data.id);
 const after=JSON.parse(await page.evaluate(key=>localStorage.getItem(key),KEY));
 assert.equal(after.turn,1,'tile tools do not spend a turn');
 assert.equal(after.bag.length,data.remaining,'a physical exchange preserves bag size');
 assert.equal(after.rack.length,8);
 assert.ok(after.rack.some(t=>t.value==='4'&&!t.blank));
 assert.ok(!after.rack.some(t=>t.id===data.id));
 assert.ok(after.bag.some(t=>t.id===data.id));
 assert.equal(new Set([...after.rack,...after.bag].map(t=>t.id)).size,151);
 assert.deepEqual(after.rogue.tempSlots,[]);
 assert.equal(await page.locator('#temporary-slots .equipment-slot:not(.is-empty)').count(),0);
 // Now install one score booster into the vacated slot and arm it by clicking
 // its art. Arming must persist through a reload and cannot spend a turn.
 await page.evaluate(key=>{
   const state=JSON.parse(localStorage.getItem(key));
   state.rogue.tempSlots=['double-score'];
   state.rogue.tempBought.push('double-score');
   state.rogue.spent+=7;state.rogue.earned+=7;
   localStorage.setItem(key,JSON.stringify(state));
 },KEY);
 await page.reload({waitUntil:'networkidle'});
 await page.locator('#temporary-slots [data-equipment-id="double-score"]').click();
 const armed=JSON.parse(await page.evaluate(key=>localStorage.getItem(key),KEY));
 assert.equal(armed.rogue.armed,'double-score');
 assert.equal(armed.turn,1);
 assert.equal(await page.locator('#temporary-slots .is-armed').count(),1);
 await page.reload({waitUntil:'networkidle'});
 assert.equal(await page.locator('#temporary-slots .is-armed').count(),1);
 assert.deepEqual(errors,[]);
 console.log('Drift power-up interaction browser passed: physical 3-to-4 swap, conserved bag, two-slot controls, armed and persisted score booster.');
}finally{await browser.close();}
