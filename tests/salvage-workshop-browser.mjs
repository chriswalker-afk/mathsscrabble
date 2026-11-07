import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {installKnownRack} from './opening-fixture.mjs';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const errors=[];
const page=await browser.newPage({viewport:{width:1366,height:768}});
page.on('pageerror',e=>errors.push(e.message));
const get=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('equa-nova.drift.v1')));
const cell=(r,c)=>page.locator('.cell[data-index="'+((r+3)*19+(c+3))+'"]');
async function put(symbol,r,c){
 if(symbol==='=')await page.locator('#equals-tile').click();
 else await page.locator('#rack .tile').evaluateAll((buttons,value)=>{
  const target=buttons.find(el=>el.querySelector('span')?.textContent===value);
  if(!target)throw Error('Missing tile '+value);
  target.click();
 },symbol);
 await cell(r,c).click();
}
try{
 await page.goto('http://127.0.0.1:4173/play.html?mode=rogue',{waitUntil:'networkidle'});
 if(await page.locator('#modal[open]').count())await page.locator('#modal-actions button').last().click();
 await installKnownRack(page,'rogue');
 const initial=await get();
 assert.equal(initial.rogue.upgrades.length,0);
 await page.evaluate(()=>{
  const save=JSON.parse(localStorage.getItem('equa-nova.drift.v1'));
  save.turn=1;save.score=39;
  localStorage.setItem('equa-nova.drift.v1',JSON.stringify(save));
 });
 await page.reload({waitUntil:'networkidle'});
 for(const [s,r,c] of [['8',6,3],['+',6,4],['4',6,5],['=',6,6],['1',6,7]])await put(s,r,c);
 await page.locator('#rack .wildcard-blank-any').click();
 await cell(6,8).click();
 await page.locator('#wildcard-choices button',{hasText:'2'}).first().click();
 await page.locator('#score-btn').click();
 await page.reload({waitUntil:'networkidle'});
 assert.equal(await page.locator('#drift-hub').isVisible(),true);
 await page.locator('#drift-hub-actions .drift-bay').click();
 assert.equal(await page.locator('#drift-hub').getAttribute('data-view'),'salvage');
 assert.equal(await page.locator('#drift-hub .salvage-card').count(),7);
 assert.equal(await page.locator('#drift-hub .salvage-card .workshop-device').count(),7);
 assert.equal(await page.locator('#bay-equipped-systems .workshop-slot').count(),4);
 assert.equal(await page.locator('#bay-equipped-gadgets .workshop-slot').count(),2);
 assert.equal(await page.locator('#drift-salvage-hero').count(),0,'no duplicate hero container id');
 assert.equal(await page.locator('.drift-salvage-hero img').count(),1,
  'the repaired hangar must keep its original single background image');
 await page.locator('.drift-salvage-hero img').evaluate(img=>img.decode());
 assert.ok(await page.locator('.drift-salvage-hero img').evaluate(img=>img.naturalWidth>0));
 const crew=await page.evaluate(async()=>{
  const image=new Image();image.src='./assets/salvage-workshop-crew.svg';
  await image.decode();return {width:image.naturalWidth,height:image.naturalHeight};
 });
 assert.deepEqual(crew,{width:1200,height:470});
 assert.match(await page.locator('.drift-salvage-hero').evaluate(el=>getComputedStyle(el,'::before').backgroundImage),
  /salvage-workshop-crew\.svg/);
 const original=await get();
 const firstStock=original.rogue.shopStock;
 const stocked=await page.locator('.salvage-card .workshop-device').evaluateAll(nodes=>nodes.map(node=>({
  svg:node.outerHTML,shapes:node.querySelectorAll('path,ellipse,circle,rect').length,
  valid:node instanceof SVGElement,
  bbox:node.getBoundingClientRect().width
 })));
 assert.ok(stocked.every(s=>s.valid&&s.bbox>45&&s.shapes>=10),
  'each hardware object should be a substantial readable svg');
 for(const [width,height] of [[1366,768],[768,1024],[390,844],[320,700]]){
  await page.setViewportSize({width,height});
  const info=await page.evaluate(()=>{
   const root=document.querySelector('#drift-hub').getBoundingClientRect();
   const buttons=document.querySelector('#drift-hub-actions').getBoundingClientRect();
   const body=document.querySelector('#drift-hub-body');
   const hero=document.querySelector('.drift-salvage-hero').getBoundingClientRect();
   return {viewport:innerWidth,scroll:document.documentElement.scrollWidth,
    hubLeft:root.left,hubRight:root.right,hubBottom:root.bottom,
    footerBottom:buttons.bottom,heroWidth:hero.width,
    bodyClient:body.clientWidth,bodyScroll:body.scrollWidth};
  });
  assert.ok(info.hubLeft>=-2&&info.hubRight<=width+2,'dialog must fit '+width+': '+JSON.stringify(info));
  assert.ok(info.footerBottom<=height+3,'launch actions must fit '+width);
  assert.ok(info.scroll<=width+3,'no document overflow at '+width);
  assert.ok(info.bodyScroll<=info.bodyClient+3,'no gallery horizontal overflow at '+width);
  assert.equal(await page.locator('#salvage-grid .salvage-card').count(),4);
  assert.equal(await page.locator('#salvage-temporary-grid .salvage-card').count(),3);
  assert.equal(await page.locator('#bay-equipped-systems .workshop-slot').count(),4);
  assert.equal(await page.locator('#bay-equipped-gadgets .workshop-slot').count(),2);
  if(width===1366)await page.screenshot({path:'/tmp/equanova-pass-e-salvage-desktop.png',fullPage:true});
  if(width===390)await page.screenshot({path:'/tmp/equanova-pass-e-salvage-phone.png',fullPage:true});
 }
 await page.setViewportSize({width:1366,height:768});
 const choices=await page.locator('#salvage-grid .salvage-card').evaluateAll(cards=>
  cards.map(card=>({id:card.dataset.itemId,cost:Number(card.querySelector('button.salvage-buy').textContent.split(' ')[0])})));
 const gadgetChoices=await page.locator('#salvage-temporary-grid .salvage-card').evaluateAll(cards=>
  cards.map(card=>({id:card.dataset.itemId,cost:Number(card.querySelector('button.salvage-buy').textContent.split(' ')[0])})));
 const system=choices.slice().sort((a,b)=>a.cost-b.cost)[0];
 const gadget=gadgetChoices.slice().sort((a,b)=>a.cost-b.cost)[0];
 const flux=original.rogue.flux;
 assert.ok(flux>=system.cost+gadget.cost);
 assert.equal(await page.locator('#bay-flux').textContent(),String(flux));
 await page.locator('#salvage-grid [data-item-id="'+system.id+'"] .salvage-buy').click();
 assert.equal(await page.locator('#drift-hub').getAttribute('data-view'),'salvage');
 assert.equal(await page.locator('#bay-flux').textContent(),String(flux-system.cost));
 assert.equal(await page.locator('#bay-system-count').textContent(),'1 / 4');
 assert.equal(await page.locator('#bay-equipped-systems [data-item-id="'+system.id+'"]').count(),1);
 assert.equal(await page.locator('#salvage-grid [data-item-id="'+system.id+'"]').count(),0);
 assert.equal(await page.locator('#salvage-grid .salvage-card').count(),3);
 assert.match(await page.locator('#salvage-feedback').textContent(),/installed|fitted|purchase/i);
 const afterSystem=await get();
 assert.deepEqual(afterSystem.rogue.shopStock,firstStock,'a purchase must never reroll the displayed inventory');
 assert.equal(afterSystem.rogue.flux,flux-system.cost);
 await page.locator('#bay-equipped-systems [data-item-id="'+system.id+'"]').click();
 assert.match(await page.locator('#salvage-feedback').textContent(),/Installed system/i);
 await page.locator('#salvage-temporary-grid [data-item-id="'+gadget.id+'"] .salvage-buy').click();
 assert.equal(await page.locator('#bay-gadget-count').textContent(),'1 / 2');
 assert.equal(await page.locator('#bay-equipped-gadgets [data-item-id="'+gadget.id+'"]').count(),1);
 assert.equal(await page.locator('#salvage-temporary-grid .salvage-card').count(),3,
  'a one-use item remains available while a bay is free');
 assert.equal(await page.locator('#bay-flux').textContent(),String(flux-system.cost-gadget.cost));
 const afterGadget=await get();
 assert.deepEqual(afterGadget.rogue.shopStock,firstStock,'gadget purchases cannot reroll stock');
 assert.equal(afterGadget.rogue.spent,afterSystem.rogue.spent+gadget.cost);
 assert.equal(await page.locator('#flux-count').textContent(),String(afterGadget.rogue.flux));
 await page.locator('#drift-hub-actions .drift-back').click();
 assert.equal(await page.locator('#drift-hub').getAttribute('data-view'),'results');
 await page.locator('#drift-hub-actions .drift-bay').click();
 assert.equal(await page.locator('#bay-flux').textContent(),String(afterGadget.rogue.flux));
 assert.equal(await page.locator('#bay-equipped-systems [data-item-id="'+system.id+'"]').count(),1);
 assert.equal(await page.locator('#bay-equipped-gadgets [data-item-id="'+gadget.id+'"]').count(),1);
 assert.deepEqual((await get()).rogue.shopStock,firstStock);
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.locator('#bay-equipped-gadgets .workshop-slot').first().evaluate(node=>
  getComputedStyle(node).animationName),'none','purchased machinery must honour reduced motion');
 await page.screenshot({path:'/tmp/equanova-pass-e-installed-equipment.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('Salvage Pass E passed: illustrated workshop, all shop devices, 4 viewports, persistent random stock, live purchases, loadout, accurate Flux, keyboard status and reduced motion.');
}finally{await browser.close();}
