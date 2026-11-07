/** Pass E release audit: 40 rewards, live unlock ownership, WCAG keyboard paths,
 * widths at 320/390/768/1366 and actual composited cosmetics.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1366,height:850},acceptDownloads:true,reducedMotion:'reduce'});
const page=await context.newPage(),errors=[];
page.on('pageerror',err=>errors.push(err.message));
const BASE='http://127.0.0.1:4173/';
const visible=async()=>page.locator('#alien-app').getAttribute('data-ready');
async function collectAwards(){
 return page.evaluate(()=>{
  const pilots=JSON.parse(localStorage.getItem('equa-nova.pilot-profiles.v1'));
  const earned=JSON.parse(localStorage.getItem('equa-nova.achievements.v1'));
  return {pilot:pilots?.activeId,unlocked:earned?.pilots?.[pilots?.activeId]?.unlocked||[]};
 });
}
async function findPart(field,id){
 const tabs=page.locator('#section-tabs [role=tab]');
 for(let i=0;i<await tabs.count();i++){
  await tabs.nth(i).click();
  const part=page.locator('#editor-options [data-field="'+field+'"][data-option="'+id+'"]');
  if(await part.count())return part;
 }
 throw Error('Unable to find option '+field+'/'+id);
}
async function auditWidth(url,width){
 await page.setViewportSize({width,height:850});
 await page.goto(BASE+url,{waitUntil:'networkidle'});
 if(url.startsWith('alien'))await page.locator('#alien-app[data-ready="true"]').waitFor();
 const measurements=await page.evaluate(()=>({
  viewport:innerWidth,document:document.documentElement.scrollWidth,
  body:document.body.scrollWidth,heading:document.querySelector('h1')?.getBoundingClientRect().right||0
 }));
 assert.ok(measurements.document<=width+4&&measurements.body<=width+4,
  url+' '+width+'px horizontally scrolls: '+JSON.stringify(measurements));
 assert.ok(measurements.heading<=width+4,url+' heading clips at '+width);
 if(url.startsWith('achievement-hangar')){
  const buttons=await page.locator('.hangar-nav a').evaluateAll(nodes=>nodes.map(node=>{
   const r=node.getBoundingClientRect();
   return {name:node.getAttribute('aria-label'),left:r.left,right:r.right,height:r.height};
  }));
  assert.equal(buttons.length,2,'Hangar must have two distinct navigation links');
  assert.ok(buttons.every(b=>b.left>=-1&&b.right<=width+2&&b.height>=44),
   'Hangar navigation targets must fit and be touch friendly: '+JSON.stringify(buttons));
  if(width===390||width===1366)
   await page.screenshot({path:'/tmp/equanova-alien-hangar-nav-'+width+'.png'});
 }
}

try{
 await page.goto(BASE+'achievement-hangar.html',{waitUntil:'networkidle'});
 assert.equal(await page.locator('#award-grid .award-card').count(),10);
 const homeLink=page.locator('.hangar-nav-home');
 const labLink=page.locator('.hangar-nav-lab');
 assert.equal(await homeLink.getAttribute('href'),'./index.html');
 assert.equal(await labLink.getAttribute('href'),'./alien-lab.html');
 assert.match(await homeLink.textContent(),/HOME/);
 assert.match(await homeLink.textContent(),/MISSION CONTROL/);
 const shortcut=page.locator('.skip-link');
 const restingSkip=await shortcut.evaluate(el=>el.getBoundingClientRect().bottom);
 assert.ok(restingSkip<=1,'keyboard skip link must not appear above the Hangar header at rest');
 await shortcut.focus();
 assert.ok(await shortcut.evaluate(el=>el.getBoundingClientRect().bottom>20),
  'skip link must become visible when keyboard-focused');
 await page.keyboard.press('Enter');
 await page.waitForURL(/#hangar$/,{timeout:3000});
 assert.match(page.url(),/#hangar$/,'skip link must jump to achievement content');
 await page.goto(BASE+'achievement-hangar.html',{waitUntil:'networkidle'});
 // Roving keyboard focus is mandatory for accessible role=tablist navigation.
 const sector=page.locator('.mode-tabs [data-mode="sector"]');
 await sector.focus();
 await page.keyboard.press('ArrowRight');
 assert.equal(await page.locator('.mode-tabs [aria-selected="true"]').getAttribute('data-mode'),'drift');
 assert.equal(await page.locator('#award-grid .award-card').count(),10);
 await page.keyboard.press('End');
 assert.equal(await page.locator('.mode-tabs [aria-selected="true"]').getAttribute('data-mode'),'online');
 await page.keyboard.press('Home');
 assert.equal(await page.locator('.mode-tabs [aria-selected="true"]').getAttribute('data-mode'),'sector');
 assert.equal(await page.locator('#award-grid').getAttribute('aria-labelledby'),'hangar-tab-sector');
 // Fixed visual bug: locked reward uses <img>, not inline <svg>.
 const lockedImg=page.locator('#award-grid .award-card.locked .reward-preview img').first();
 const lockedOpacity=await lockedImg.evaluate(el=>Number(getComputedStyle(el).opacity));
 assert.ok(lockedOpacity<=.55,'locked image must actually appear as a subdued silhouette');
 await page.locator('#award-grid .award-card').first().click();
 assert.equal(await page.locator('#award-detail').evaluate(el=>el.open),true);
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('#award-detail').evaluate(el=>el.open),false);
 for(const width of [320,390,768,1366])await auditWidth('achievement-hangar.html',width);
 await page.setViewportSize({width:1366,height:850});
 await page.goto(BASE+'achievement-hangar.html',{waitUntil:'networkidle'});
 for(const mode of ['sector','drift','local','online']){
  await page.locator('.mode-tabs [data-mode="'+mode+'"]').click();
  assert.equal(await page.locator('#award-grid .award-card').count(),mode==='online'?13:10,mode+' badge total');
  const assetCount=await page.locator('#award-grid .reward-preview img').count();
  assert.ok(assetCount>=9,'each mode previews at least nine unique new parts');
  assert.equal(await page.locator('#award-grid .award-card.earned').count(),0);
 }
 await page.locator('#pilot-name').fill('Release Pilot');
 await page.locator('#pilot-create button[type=submit]').click();
 assert.match(await page.locator('#pilot-status').textContent(),/created/i);
 const before=await collectAwards();
 assert.ok(before.pilot&&before.unlocked.length===0);
 // Simulate precisely one VALIDATED Sector Run game event for graphics/UI,
 // not arbitrary localStorage unlock flags.
 const unlocked=await page.evaluate(async()=>{
  const {loadPilots}=await import('./src/achievements/pilots.js');
  const {loadAchievementStore,saveAchievementStore}=await import('./src/achievements/storage.js');
  const {awardForVerifiedEvent}=await import('./src/achievements/engine.js');
  const p=loadPilots(localStorage).registry,s=loadAchievementStore(localStorage,p).store;
  const e={id:'sector-release-qa:s1-t1-score',pilotId:p.activeId,mode:'sector',
   type:'move-scored',scopeId:'sector-release-qa',authority:'local-transition',
   data:{points:27,wildcards:1,crossing:1,numberTiles:3,premium:true,tileSet:'natural'}};
  const r=awardForVerifiedEvent(s,p,e);
  if(!saveAchievementStore(localStorage,r.store,p))throw Error('Cannot persist test award');
  return r.awarded.map(x=>x.id);
 });
 assert.ok(unlocked.includes('S01'));assert.ok(unlocked.includes('S03'));
 await page.reload({waitUntil:'networkidle'});
 await page.locator('.mode-tabs [data-mode="sector"]').click();
 assert.equal(await page.locator('#award-grid .award-card.earned').count(),5);
 await page.locator('[data-filter="earned"]').click();
 assert.equal(await page.locator('#award-grid .award-card').count(),5);
 await page.locator('[data-filter="locked"]').click();
 assert.equal(await page.locator('#award-grid .award-card').count(),5);
 await page.locator('[data-filter="all"]').click();
 const earnedImg=page.locator('#award-grid .award-card.earned .reward-preview img').first();
 assert.equal(await earnedImg.evaluate(el=>Number(getComputedStyle(el).opacity)),1);
 await page.goto(BASE+'alien-lab.html',{waitUntil:'networkidle'});
 assert.equal(await visible(),'true');
 const earnedPart=await findPart('accessory','star-antennae');
 assert.match(await earnedPart.textContent(),/EARNED/);
 await earnedPart.click();
 await page.locator('#alien-save').click();
 let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('equa-nova.alien.v1')));
 assert.equal(saved.accessory,'star-antennae','earned reward can be saved and used');
 const hardPart=await findPart('accessory','solar-halo');
 assert.match(await hardPart.textContent(),/LOCKED/);
 await hardPart.click();
 saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('equa-nova.alien.v1')));
 assert.equal(saved.accessory,'star-antennae','previewing locked parts must not mutate the save');
 // Move to Hangar in the same window, switch to Guest, then return: ownership rechecked.
 await page.goto(BASE+'achievement-hangar.html',{waitUntil:'networkidle'});
 await page.locator('#pilot-select').selectOption('');
 await page.goto(BASE+'alien-lab.html',{waitUntil:'networkidle'});
 await page.locator('#alien-app[data-ready="true"]').waitFor();
 const noLongerOwned=await findPart('accessory','star-antennae');
 assert.match(await noLongerOwned.textContent(),/LOCKED/);
 await page.locator('#alien-save').click();
 assert.match(await page.locator('#alien-status').textContent(),/locked/i);
 saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('equa-nova.alien.v1')));
 assert.equal(saved.accessory,'star-antennae','switching to guest cannot overwrite a reward save');
 for(const width of [320,390,768,1366])await auditWidth('alien-lab.html',width);
 // Always load and render every reward; graphical compositions cover all 40 assets.
 await page.goto(BASE+'alien-lab.html',{waitUntil:'networkidle'});
 const specimens=await page.evaluate(async()=>{
  const {loadAlienLibrary,renderAlienSVG}=await import('./src/alien/renderer.js');
  const {defaultAlien,validateAlienPayload}=await import('./src/alien/model.js');
  const {ACHIEVEMENTS}=await import('./src/achievements/catalog.js');
  const lib=await loadAlienLibrary('./');
  const names={heads:'head',eyes:'eyes',mouths:'mouth',bodies:'body',arms:'arms',legs:'legs',accessories:'accessory'};
  const results=[],gallery=document.createElement('section');
  gallery.id='release-art-gallery';
  gallery.style.cssText='position:absolute;left:0;top:0;background:#071a26;color:#fff;z-index:20000;display:grid;grid-template-columns:repeat(8,124px);gap:8px;padding:14px;';
  for(const [i,a] of ACHIEVEMENTS.filter(a=>a.reward.collection!=='callouts').entries()){
   const avatar=defaultAlien(),kind=a.reward.collection;
   if(kind==='palettes')avatar.colours={...avatar.colours,skin:a.reward.id};
   else avatar[names[kind]]=a.reward.id;
   validateAlienPayload(avatar,lib.manifest);
   const svg=renderAlienSVG(avatar,lib,{width:104,height:117});
   if(!svg.querySelector('[data-layer]'))throw Error('Empty layered avatar '+a.id);
   const figure=document.createElement('figure');
   figure.style.cssText='margin:0;min-height:142px;text-align:center;overflow:hidden';
   const caption=document.createElement('figcaption');caption.textContent=a.id+' '+a.reward.name;
   caption.style.cssText='font:10px system-ui;max-height:26px;overflow:hidden';
   figure.append(svg,caption);gallery.append(figure);
   results.push({id:a.id,part:kind+'/'+a.reward.id,layers:svg.querySelectorAll('[data-layer]').length});
  }
  document.body.append(gallery);
  return results;
 });
 assert.equal(specimens.length,40,'all forty reward combinations render in real Chromium');
 assert.ok(specimens.every(x=>x.layers>=6),'all combinations must retain their core layers');
 await page.locator('#release-art-gallery').screenshot({path:'/tmp/equanova-alien-pass-e-40-rewards.png'});
 assert.deepEqual(errors,[],'no browser JavaScript errors during Pass E');
 console.log('Achievement Pass E: 40 reward SVG combinations, silhouette lock UX, focus/keyboard, profile ownership, save migration, 320/390/768/1366px pages, and screenshot contact sheet passed.');
}finally{
 await browser.close();
}
