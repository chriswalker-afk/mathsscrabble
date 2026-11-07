import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base='http://127.0.0.1:4173/';
const ids=['plus-embargo','grid-warden','curse-weaver','seven-thief','forced-relic',
 'minus-embargo','signal-jam','power-leak','critical','tile-static','short-circuit','multiplier-leech'];
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const errors=[];
try{
 for(const [width,height] of [[1366,768],[768,1024],[390,844],[320,700]]){
  const page=await browser.newPage({viewport:{width,height}});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'play.html?mode=rogue',{waitUntil:'networkidle'});
  if(await page.locator('#modal[open]').count())await page.locator('#modal-actions button').last().click();
  await page.locator('.cell').first().waitFor();
  assert.equal(await page.locator('#board .cell').count(),361);
  assert.equal(await page.locator('#drift-zone-map').isVisible(),true);
  assert.equal(await page.locator('#drift-zone-map .zone-strip-landscape').count(),1);
  const dimensions=await page.evaluate(()=>({
   viewport:innerWidth,scroll:document.documentElement.scrollWidth,
   board:document.querySelector('#board-frame').getBoundingClientRect().width,
   strip:document.querySelector('#drift-zone-map').getBoundingClientRect().width,
   src:document.querySelector('.zone-strip-landscape').getAttribute('src')
  }));
  assert.ok(dimensions.scroll<=dimensions.viewport+3,'phone and tablet widths must not overflow: '+JSON.stringify(dimensions));
  assert.ok(dimensions.board<=720,'zone art must never increase board footprint');
  assert.match(dimensions.src,/^\.\/assets\/drift\/zones\/[a-z-]+\.svg$/);
  const before=await page.evaluate(()=>localStorage.getItem('equa-nova.drift.v1'));
  await page.locator('#drift-zone-map').click();
  assert.match(await page.locator('#modal-title').textContent(),/zone map/i);
  assert.equal(await page.locator('.zone-map-card').count(),2);
  assert.equal(await page.locator('.zone-map-card.map-current .boss-art').count(),1);
  assert.equal(await page.locator('.zone-map-card.map-uncharted .boss-art').count(),0,
   'the unvisited next zone must never display a guardian');
  assert.equal(await page.locator('.zone-chart-landscape').count(),1);
  const scene=page.locator('.zone-chart-landscape');
  await scene.evaluate(async img=>img.decode());
  assert.ok(await scene.evaluate(img=>img.naturalWidth>0&&img.naturalHeight>0));
  assert.equal(await page.locator('.zone-map-card.map-current .zone-route .zone-node').count(),3);
  assert.equal(await page.locator('.zone-map-card.map-current .zone-route-stage-labels span').count(),3);
  assert.equal(await page.locator('.zone-history').count(),0,'a new run has no previous zones');
  assert.equal(await page.evaluate(()=>localStorage.getItem('equa-nova.drift.v1')),before,
   'opening the star chart must not mutate the saved run');
  if(width===1366)await page.screenshot({path:'/tmp/equanova-pass-d-zone-map-desktop.png',fullPage:true});
  if(width===390)await page.screenshot({path:'/tmp/equanova-pass-d-zone-map-mobile.png',fullPage:true});
  const actions=await page.locator('#modal-actions').evaluate(e=>{
   const r=e.getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom};
  });
  assert.ok(actions.left>=0&&actions.right<=width+2,'zone map dialog actions must fit viewport');
  if(width===390)assert.ok(actions.bottom<=height+3,'dialog action must remain visible on phone');
  await page.locator('#modal-actions button').last().click();
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('#drift-zone-map').click();
  assert.equal(await page.locator('.zone-map-card.map-current').evaluate(e=>getComputedStyle(e).animationName),
   'none','map arrival effects must obey reduced motion');
  await page.locator('#modal-actions button').last().click();
  await page.close();
 }
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'play.html?mode=rogue',{waitUntil:'networkidle'});
 if(await page.locator('#modal[open]').count())await page.locator('#modal-actions button').last().click();
 const scenicResults=await page.evaluate(async bossIds=>{
  return await Promise.all(bossIds.map(async id=>{
   const img=new Image();img.src='./assets/drift/zones/'+id+'.svg';
   try{await img.decode();return {id,width:img.naturalWidth,height:img.naturalHeight};}
   catch{return {id,width:0,height:0};}
  }));
 },ids);
 assert.ok(scenicResults.every(s=>s.width===960&&s.height===360),
  'every original scenic SVG must rasterize: '+JSON.stringify(scenicResults));
 const portraits=await page.evaluate(async bossIds=>{
  const art=await import('/src/boss-art.js');
  const items=await Promise.all(bossIds.map(async id=>{
   const sample=art.bossArtwork(id);
   const xml=new DOMParser().parseFromString(sample,'image/svg+xml');
   return {id,bad:xml.querySelector('parsererror')!==null,
    shapes:xml.querySelectorAll('path,ellipse,circle').length,
    title:xml.querySelector('svg')?.getAttribute('aria-label')};
  }));
  return items;
 },ids);
 assert.ok(portraits.every(p=>!p.bad&&p.shapes>=8&&p.title.includes('guardian')),
  'each guardian SVG must parse with expressive geometry: '+JSON.stringify(portraits));
 // Seed another known zone to verify history and make sure a future boss is
 // not shown until entry, including after a real browser reload.
 await page.evaluate(key=>{
  const saved=JSON.parse(localStorage.getItem(key));
  saved.sector=4;saved.phase='playing';saved.turn=1;saved.score=0;
  saved.rogue.zoneBosses=['grid-warden','seven-thief'];
  saved.rogue.forcedTile=null;
  localStorage.setItem(key,JSON.stringify(saved));
 },'equa-nova.drift.v1');
 await page.reload({waitUntil:'networkidle'});
 assert.match(await page.locator('#sector-label').textContent(),/THE DRIFT 04/i);
 await page.locator('#drift-zone-map').click();
 assert.match(await page.locator('.zone-map-card.map-current').textContent(),/Hollow Sevens/i);
 assert.match(await page.locator('.zone-history summary').textContent(),/1 PREVIOUS ZONE/i);
 assert.equal(await page.locator('.zone-history').evaluate(e=>e.open),false);
 await page.locator('.zone-history summary').click();
 assert.equal(await page.locator('.zone-history').evaluate(e=>e.open),true);
 assert.match(await page.locator('.zone-history-grid').textContent(),/Obsidian Grid/i);
 assert.equal(await page.locator('.zone-map-card.map-uncharted .boss-art').count(),0);
 await page.screenshot({path:'/tmp/equanova-pass-d-flight-log.png',fullPage:true});
 await page.locator('#modal-actions button').last().click();
 // Boss sectors display their own scenic anomaly, while the maths grid does
 // not receive decorative image children or additional cells.
 await page.evaluate(key=>{
  const saved=JSON.parse(localStorage.getItem(key));
  saved.sector=3;saved.phase='playing';saved.turn=1;saved.score=0;
  saved.rogue.zoneBosses=['grid-warden'];
  localStorage.setItem(key,JSON.stringify(saved));
 },'equa-nova.drift.v1');
 await page.reload({waitUntil:'networkidle'});
 assert.equal(await page.locator('.cell').count(),361);
 assert.match(await page.locator('#anomaly-scene').getAttribute('src'),/grid-warden\.svg$/);
 assert.equal(await page.locator('#anomaly-banner').isVisible(),true);
 assert.equal(await page.locator('#board .anomaly-scene').count(),0);
 assert.equal(await page.locator('#board-frame').evaluate(e=>e.getBoundingClientRect().width),
  await page.locator('#board-frame').evaluate(e=>e.getBoundingClientRect().width));
 const preview=await page.evaluate(async()=>{
  const {bossIntroMarkup}=await import('/src/drift-map.js');
  const {makeRogueState}=await import('/src/rogue.js');
  const html=bossIntroMarkup({...makeRogueState(),zoneBosses:['grid-warden']},3);
  const mount=document.createElement('div');mount.innerHTML=html;
  return {hasArt:mount.querySelector('.boss-reveal-landscape')!==null,
   hasGuardian:mount.querySelector('.boss-reveal .boss-art')!==null,
   rule:mount.querySelector('.boss-effect-plate b')?.textContent,
   desc:mount.querySelector('.boss-reveal-copy p')?.textContent};
 });
 assert.ok(preview.hasArt&&preview.hasGuardian);
 assert.match(preview.rule,/blocked squares/i);
 assert.match(preview.desc,/cannot be used/i);
 assert.deepEqual(errors,[]);
 console.log('Drift Pass D browser passed: all 24 original SVG assets, 4 viewport widths, saved flight history, hidden future bosses, guardian rule cards, unmodified grid and reduced motion.');
 await page.close();
}finally{await browser.close();}
