import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {installKnownRack} from './opening-fixture.mjs';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1366,height:768}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
const cell=(row,col)=>page.locator('.cell[data-index="'+(row*13+col)+'"]');
async function put(symbol,row,col){
 if(symbol==='=')await page.locator('#equals-tile').click();
 else await page.locator('#rack .tile').evaluateAll((buttons,value)=>{
   const target=buttons.find(el=>el.querySelector('span')?.textContent===value);
   if(!target)throw new Error('Missing '+value+' in rack');
   target.click();
 },symbol);
 await cell(row,col).click();
}
async function openingEquation(){
 for(const [symbol,row,col] of [['8',6,3],['+',6,4],['4',6,5],['=',6,6],['1',6,7],['2',6,8]])await put(symbol,row,col);
 assert.equal(await page.locator('#preview-equation').textContent(),'8+4=12');
}
async function resetRun(){
 await page.locator('#new-btn').click();
 await page.locator('#modal-actions button').last().click();
 assert.equal(await page.locator('#turn').textContent(),'1 / 6');
 assert.equal(await page.locator('#score').textContent(),'0');
 await installKnownRack(page,'sector');
}
async function openBagAndValidate(expected){
 const bagCount=Number(await page.locator('#bag-count').textContent());
 assert.equal(bagCount,expected);
 await page.locator('#bag-details-btn').click();
 assert.match(await page.locator('#modal-title').textContent(),/tiles remaining/i);
 assert.equal(await page.locator('.bag-inventory-group').count(),3);
 assert.equal(await page.locator('.bag-inventory-numbers .bag-inventory-tile').count(),10);
 assert.equal(await page.locator('.bag-inventory-operators .bag-inventory-tile').count(),4);
 assert.equal(await page.locator('.bag-inventory-wildcards .bag-inventory-tile').count(),3);
 const result=await page.evaluate(()=>{
   const total=Number(document.querySelector('.bag-overview-total>strong').textContent);
   const groupTotals=[...document.querySelectorAll('.bag-inventory-heading span')]
     .map(el=>Number(el.textContent.split(' ')[0]));
   const physical=[...document.querySelectorAll('.bag-inventory-count')]
     .map(el=>Number(el.textContent.slice(1)));
   return {total,groupTotals,sum:physical.reduce((n,x)=>n+x,0),
     note:document.querySelector('.bag-inventory-note').textContent};
 });
 assert.equal(result.total,expected);
 assert.equal(result.groupTotals.reduce((a,b)=>a+b,0),expected);
 assert.equal(result.sum,expected);
 assert.match(result.note,/order is not shown/i);
 assert.match(result.note,/equals sign is free/i);
 await page.locator('#modal-actions button').first().click();
 assert.equal(await page.locator('#bag-count').textContent(),String(expected));
}
try{
 await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
 await page.locator('.cell').first().waitFor();
 if(await page.locator('#modal[open]').count())await page.locator('#modal-actions button').last().click();
 await installKnownRack(page,'sector');
 const original=await page.evaluate(()=>localStorage.getItem('equa-nova.sector-run.v1'));
 await openBagAndValidate(144);
 const afterInspection=await page.evaluate(()=>localStorage.getItem('equa-nova.sector-run.v1'));
 assert.equal(afterInspection,original,'opening bag scan must not change the saved game');
 await page.locator('#bag-details-btn').click();
 assert.equal(await page.locator('.bag-inventory-numbers .bag-inventory-tile').nth(0).getAttribute('aria-label'),
   '0: 9 remaining');
 assert.equal(await page.locator('.bag-inventory-numbers .bag-inventory-tile').nth(8).getAttribute('aria-label'),
   '8: 6 remaining');
 assert.match(await page.locator('.bag-inventory-wildcards').textContent(),/#/);
 assert.match(await page.locator('.bag-inventory-wildcards').textContent(),/◇/);
 assert.match(await page.locator('.bag-inventory-wildcards').textContent(),/✦/);
 await page.locator('#modal-actions button').first().click();

 // The actual score is committed immediately; a separate visual tally runs
 // in the existing command panel while tiles lift and settle.
 await openingEquation();
 await page.locator('#score-btn').click();
 assert.equal(await page.locator('#ceremony-readout').isVisible(),true);
 assert.equal(await page.locator('#skip-ceremony').isEnabled(),true);
 const saved=JSON.parse(await page.evaluate(()=>localStorage.getItem('equa-nova.sector-run.v1')));
 assert.equal(saved.turn,2,'turn must be committed before presentation');
 assert.ok(saved.score>0);
 assert.equal(saved.board[6*13+3].value,'8');
 assert.equal(await page.locator('#bag-details-btn').isEnabled(),false,'bag scan is deferred while tiles animate');
 await page.waitForFunction(()=>Number(document.querySelector('#score').textContent)>0);
 const partial=Number(await page.locator('#score').textContent());
 assert.ok(partial<saved.score,'the score should be added progressively, not instantly');
 assert.match(await page.locator('#ceremony-tile-count').textContent(),/\d+ \/ 6 TILES/);
 assert.ok(await page.locator('.cell.scoring-lift').count()>=1);
 await page.locator('#skip-ceremony').click();
 await page.locator('#modal[open]').waitFor({timeout:2500});
 assert.equal(await page.locator('#score').textContent(),String(saved.score));
 assert.equal(await page.locator('#ceremony-readout').isVisible(),false);
 assert.equal(await page.locator('#board .score-pip').count(),0);
 assert.match(await page.locator('#modal-title').textContent(),/energy/i);
 await page.locator('#modal-actions button').last().click();
 await openBagAndValidate(139);
 await page.waitForTimeout(1200);
 assert.equal(await page.locator('#modal[open]').count(),0,'a skipped presentation must not reopen a stale dialog');
 assert.equal(await page.locator('#score').textContent(),String(saved.score));

 // Natural animation must reach the same total as the instant skip path.
 await resetRun();
 await openingEquation();
 await page.locator('#score-btn').click();
 await page.locator('#modal[open]').waitFor({timeout:10000});
 assert.equal(await page.locator('#score').textContent(),String(saved.score));
 assert.equal(await page.locator('#ceremony-readout').isVisible(),false);
 assert.equal(await page.locator('.cell.scoring-lift').count(),0);
 await page.locator('#modal-actions button').last().click();

 // Respect the user's system setting: no bouncing or delayed scoring.
 await resetRun();
 await page.emulateMedia({reducedMotion:'reduce'});
 await openingEquation();
 await page.locator('#score-btn').click();
 await page.locator('#modal[open]').waitFor({timeout:1200});
 assert.equal(await page.locator('#ceremony-readout').isVisible(),false);
 assert.equal(await page.locator('#score').textContent(),String(saved.score));
 await page.locator('#modal-actions button').last().click();
 await page.emulateMedia({reducedMotion:'no-preference'});

 // A refresh during the movement restores an already committed game, not a
 // half-awarded energy score or a second animation that might duplicate it.
 await resetRun();
 await openingEquation();
 await page.locator('#score-btn').click();
 await page.reload({waitUntil:'networkidle'});
 assert.equal(await page.locator('#score').textContent(),String(saved.score));
 assert.equal(await page.locator('#turn').textContent(),'2 / 6');
 assert.equal(await page.locator('#modal[open]').count(),0);
 assert.equal(await page.locator('#ceremony-readout').isVisible(),false);

 // The In Bag control remains available on narrow phone layouts.
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.locator('#bag-details-btn').isVisible(),true);
 await openBagAndValidate(139);
 const mobile=await page.evaluate(()=>({
   viewportWidth:innerWidth,scrollWidth:document.documentElement.scrollWidth,
   bagRight:document.querySelector('#bag-details-btn').getBoundingClientRect().right
 }));
 assert.ok(mobile.scrollWidth<=mobile.viewportWidth+3);
 assert.ok(mobile.bagRight<=mobile.viewportWidth);
 assert.deepEqual(errors,[]);
 console.log('Ceremony and inventory browser passed: exact bag counts, sequential score tally, skip, natural finish, reduced motion and reload.');
}finally{
 await browser.close();
}
