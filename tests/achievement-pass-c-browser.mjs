/** Pass C browser audit: real UI transitions, with a repeatable shuffled-bag fixture.
 * Never fakes award events. Uses the same physical rack and scoring flow as students.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {installKnownRack} from './opening-fixture.mjs';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1366,height:768}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const base='http://127.0.0.1:4173/';
const cell=(r,c)=>page.locator('.cell[data-index="'+((r+3)*19+c+3)+'"]');
async function put(symbol,r,c){
 if(symbol==='=')await page.locator('#equals-tile').click();
 else await page.locator('#rack .tile').evaluateAll((buttons,value)=>{
  const tile=buttons.find(b=>b.querySelector('span')?.textContent===value);
  if(!tile)throw Error('Fixture tile missing: '+value);
  tile.click();
 },symbol);
 await cell(r,c).click();
}
async function awardState(){
 return page.evaluate(()=>{
  const reg=JSON.parse(localStorage.getItem('equa-nova.pilot-profiles.v1'));
  const award=JSON.parse(localStorage.getItem('equa-nova.achievements.v1'));
  return {names:reg.pilots.map(p=>p.name),owners:Object.fromEntries(
    reg.pilots.map(p=>[p.name,award?.pilots?.[p.id]?.unlocked||[]]))};
 });
}
try{
 await page.goto(base+'achievement-hangar.html',{waitUntil:'networkidle'});
 await page.locator('#pilot-name').fill('Ari');
 await page.locator('#pilot-create button[type=submit]').click();
 assert.equal((await awardState()).names[0],'Ari');
 await page.goto(base+'play.html?mode=sector',{waitUntil:'networkidle'});
 if(await page.locator('#modal[open]').count())
  await page.locator('#modal-actions button').last().click();
 assert.match(await page.locator('#achievement-pilot').textContent(),/ARI/);
 await installKnownRack(page,'sector');
 for(const [s,r,c] of [['8',6,3],['+',6,4],['4',6,5],['=',6,6],['1',6,7],['2',6,8]])
  await put(s,r,c);
 await page.locator('#score-btn').click();
 assert.ok((await awardState()).owners.Ari.includes('S01'),
  'correct equations must unlock immediately after verified transition');
 assert.equal(await page.locator('#ceremony-readout').isVisible(),true);
 assert.equal(await page.locator('#modal .achievement-reveal').count(),0,
  'awards must not interrupt tile-by-tile energy transfer');
 await page.locator('#skip-ceremony').click();
 await page.locator('#modal .achievement-reveal').waitFor();
 assert.match(await page.locator('#modal .achievement-reveal').textContent(),/Ignition/);
 await page.locator('#modal-actions button').last().click();
 await page.goto(base+'achievement-hangar.html',{waitUntil:'networkidle'});
 await page.locator('#pilot-name').fill('Bea');
 await page.locator('#pilot-create button[type=submit]').click();
 await page.goto(base+'play.html?mode=sector',{waitUntil:'networkidle'});
 assert.match(await page.locator('#achievement-pilot').textContent(),/ARI/,
  'existing saved run must not silently transfer to newly active Bea');
 await page.locator('#swap-btn').click();
 await page.locator('#rack .tile').first().click();
 await page.locator('#swap-btn').click();
 const afterSwap=await awardState();
 assert.ok(afterSwap.owners.Ari.includes('S04'),'free exchange credits original run owner');
 assert.ok(!afterSwap.owners.Bea.includes('S04'),'a new active pilot cannot hijack this run');
 await page.goto(base+'play.html?mode=rogue',{waitUntil:'networkidle'});
 if(await page.locator('#modal[open]').count())
  await page.locator('#modal-actions button').last().click();
 assert.match(await page.locator('#achievement-pilot').textContent(),/BEA/);
 await page.locator('#zone-map-btn').click();
 assert.ok((await awardState()).owners.Bea.includes('D01'),'real map visit grants Chart Reader');
 await page.locator('#modal-actions button').last().click();
 await installKnownRack(page,'rogue');
 await page.evaluate(()=>{
   const k='equa-nova.drift.v1',d=JSON.parse(localStorage.getItem(k));
   d.score=39;d.turn=1;d.rogue.flux+=100;d.rogue.earned+=100;
   localStorage.setItem(k,JSON.stringify(d));
 });
 await page.reload({waitUntil:'networkidle'});
 for(const [s,r,c] of [['8',6,3],['+',6,4],['4',6,5],['=',6,6],['1',6,7],['2',6,8]])
  await put(s,r,c);
 await page.locator('#score-btn').click();
 await page.locator('#skip-ceremony').click();
 await page.locator('#modal-actions button').last().click();
 await page.locator('#drift-hub-actions .drift-bay').click();
 assert.ok((await awardState()).owners.Bea.includes('D02'),'entering earned Salvage Bay grants award');
 const system=page.locator('#salvage-grid .salvage-buy:not([disabled])').first();
 assert.ok(await system.count(),'a funded Salvage Bay should offer at least one system');
 await system.click();
 assert.ok((await awardState()).owners.Bea.includes('D03'),'successful system purchase grants First Fitting');
 const gadget=page.locator('#salvage-temporary-grid .salvage-buy:not([disabled])').first();
 assert.ok(await gadget.count(),'a funded Salvage Bay should offer a mission gadget');
 await gadget.click();
 assert.ok((await awardState()).owners.Bea.includes('D04'),'successful gadget purchase grants Pocket Gadget');
 assert.deepEqual(errors,[],'Pass C must not introduce uncaught page errors');
 console.log('Pass C browser passed: deferred score medals, sticky pilot ownership, validated free exchange, Zone Map and genuine Salvage Bay transactions.');
}finally{await browser.close();}
