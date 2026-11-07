import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const URL='http://127.0.0.1:4173/play.html?mode=sector&tiles=';
const KEY='equa-nova.sector-run.v1';
const errors=[],kitNames=['natural','integer','rational','advanced'];
const open=async(kit,width=390,height=844)=>{
 const page=await browser.newPage({viewport:{width,height}});
 page.on('pageerror',err=>errors.push(kit+': '+err.message));
 await page.goto(URL+kit,{waitUntil:'networkidle'});
 if(await page.locator('#modal[open]').count())
   await page.locator('#modal-actions button').last().click();
 await page.locator('#board .cell').first().waitFor();
 return page;
};
const get=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
try{
 let standardWidth=0;
 for(const kit of kitNames){
  const page=await open(kit);
  const saved=await get(page);
  assert.equal(saved.tileSet,kit);
  assert.equal(saved.bag.length+saved.rack.length,151);
  assert.equal(new Set([...saved.bag,...saved.rack].map(t=>t.id)).size,151);
  assert.equal(await page.locator('#board .cell').count(),361);
  const pairExpected=['rational','advanced'].includes(kit);
  if(kit==='rational')assert.ok([...saved.bag,...saved.rack].every(t=>!(t.value?.startsWith('−')&&t.value?.includes('/'))),'Nebula supplies positive fractions only');
  if(kit==='advanced')assert.ok([...saved.bag,...saved.rack].every(t=>!t.value?.includes('/')&&!/^−[0-9]/.test(t.value||'')),'Quantum uses only non-negative digit tiles');
  assert.equal(saved.rack.length,pairExpected?11:8);
  assert.equal(await page.locator('#rack-count').textContent(),(pairExpected?'11 / 11':'8 / 8'));
  assert.equal(await page.locator('#rack .bracket-tile').count(),pairExpected?2:0);
  const width=await page.locator('#board-frame').evaluate(el=>el.getBoundingClientRect().width);
  if(standardWidth)assert.equal(width,standardWidth,'Kit must not shrink original board');
  else standardWidth=width;
  assert.ok((await page.evaluate(()=>document.documentElement.scrollWidth))<=392,
    kit+' must not horizontally overflow phone');
  await page.locator('#bag-details-btn').click();
  const bag=await page.locator('#bag-inventory-groups').textContent();
  if(pairExpected){
   if(kit==='rational')assert.match(bag,/RATIONAL NUMBER TILES/);
   else {assert.match(bag,/NUMBER TILES · 0–9/);assert.doesNotMatch(bag,/RATIONAL NUMBER TILES/);}
   assert.match(bag,/MATCHED BRACKET PAIRS/);
  }
  if(kit==='advanced')assert.match(bag,/ADVANCED OPERATION TILES/);
  if(kit==='integer')assert.match(bag,/NEGATIVE INTEGER TILES/);
  await page.locator('#modal-actions button').last().click();
  if(pairExpected){
   // Nebula guarantees fractions, but Quantum deliberately contains none.
   const fractions=(await get(page)).rack.filter(t=>t.value?.includes('/')).length;
   assert.ok(kit==='rational'?fractions>=2:fractions===0);
   await page.reload({waitUntil:'networkidle'});
   assert.equal(await page.locator('#rack .bracket-tile').count(),2);
   if(kit==='rational'){
    assert.ok(await page.locator('#rack .fraction-tile .frac-numerator').count()>=1);
    assert.ok(await page.locator('#rack .fraction-tile .frac-denominator').count()>=1);
   }else assert.equal(await page.locator('#rack .fraction-tile').count(),0);
   assert.equal((await get(page)).rack.length+(await get(page)).bag.length,151);
  }
  if(kit==='advanced')await page.screenshot({path:'/tmp/equanova-quantum-kit-phone.png',fullPage:true});
  await page.close();
 }
 // A kit change is a deliberate new-run action with an explicit warning.
 const page=await open('natural',1366,768);
 const width=await page.locator('#board-frame').evaluate(el=>el.getBoundingClientRect().width);
 assert.equal(await page.locator('#tile-set-btn').count(),0,'mathematical kit is selected at launch');
 await page.goto(URL+'rational',{waitUntil:'networkidle'});
 assert.match(await page.locator('#modal-body').textContent(),/starts a fresh/i);
 await page.locator('#modal-actions button').last().click();
 assert.equal((await get(page)).tileSet,'rational');
 assert.equal(await page.locator('#rack .bracket-tile').count(),2);
 assert.equal(await page.locator('#board-frame').evaluate(el=>el.getBoundingClientRect().width),width);
 await page.screenshot({path:'/tmp/equanova-rational-kit-desktop.png',fullPage:true});
 await page.close();
 assert.deepEqual(errors,[]);
 console.log('Maths kit browser passed: four inventories, phone geometry, fractions and linked rack brackets, bag scan and explicit new-run switch.');
}finally{await browser.close();}
