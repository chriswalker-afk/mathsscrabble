import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';

const ORIGIN='http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1366,height:768},acceptDownloads:true});
const page=await context.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
const waitReady=async p=>{
 await p.waitForFunction(()=>['true','error'].includes(
   document.querySelector('#alien-app')?.dataset.ready),null,{timeout:15000});
 assert.equal(await p.locator('#alien-app').getAttribute('data-ready'),
   'true',await p.locator('#alien-status').textContent());
};
const mainPart=async (p,layer)=>
 p.locator('#alien-art [data-layer="'+layer+'"]').getAttribute('data-part-id');
const choice=(p,field,id)=>
 p.locator('#editor-options .part-choice[data-field="'+field+'"][data-option="'+id+'"]');
const palette=(p,role,id)=>
 p.locator('#editor-options .palette-choice[data-colour-role="'+role+'"][data-palette="'+id+'"]');
const clickTab=(p,section)=>p.locator('#tab-'+section).click();
const readState=async p=>p.evaluate(()=>({
   saved:localStorage.getItem('equa-nova.alien.v1'),
   solo:localStorage.getItem('equa-nova.sector-run.v1'),
   local:localStorage.getItem('equa-nova.local-match.v1'),
   online:localStorage.getItem('equa-nova.online-room.v1')
 }));
try{
 await page.goto(ORIGIN+'/alien-lab.html',{waitUntil:'networkidle'});
 await waitReady(page);
 assert.equal(await page.locator('#section-tabs [role="tab"]').count(),7);
 assert.equal(await page.locator('#starter-options .preset-button').count(),4);
 assert.equal(await page.locator('#editor-options .part-choice').count(),4);
 assert.equal(await mainPart(page,'head'),'orb');
 assert.equal(await mainPart(page,'body'),'bean');
 assert.equal(await mainPart(page,'legs'),'stubs');
 assert.equal(await page.locator('#tiny-avatar svg').count(),1);
 assert.equal(await page.locator('#lobby-avatar svg').count(),1);
 assert.equal(await page.locator('#mobile-alien svg').count(),1);
 assert.match(await page.locator('#save-state').textContent(),/NOT SAVED/i);
 assert.equal((await readState(page)).saved,null);
 assert.equal(await page.locator('#alien-undo').isEnabled(),false);
 assert.equal(await page.locator('#alien-export').isEnabled(),true);
 await page.screenshot({path:'/tmp/equanova-alien-editor-desktop.png',fullPage:true});

 // A head part change must be visible immediately, reversible and focus-safe.
 await choice(page,'head','pear').click();
 assert.equal(await mainPart(page,'head'),'pear');
 assert.equal(await choice(page,'head','pear').getAttribute('aria-pressed'),'true');
 assert.match(await page.locator('#save-state').textContent(),/NOT SAVED/i);
 assert.equal(await page.locator('#alien-undo').isEnabled(),true);
 await page.locator('#alien-undo').click();
 assert.equal(await mainPart(page,'head'),'orb');
 await page.locator('#alien-redo').click();
 assert.equal(await mainPart(page,'head'),'pear');

 // Face is intentionally a single section with separate eyes and mouth rows.
 await clickTab(page,'face');
 assert.equal(await page.locator('#editor-options .option-group').count(),2);
 assert.equal(await page.locator('#editor-options .part-choice').count(),8);
 await choice(page,'eyes','cyclops').click();
 await choice(page,'mouth','zigzag').click();
 assert.equal(await mainPart(page,'eyes'),'cyclops');
 assert.equal(await mainPart(page,'mouth'),'zigzag');
 assert.equal(await choice(page,'mouth','zigzag').getAttribute('aria-pressed'),'true');

 // Check tabs with keyboard arrows/Home/End, including roving tab focus.
 await page.locator('#tab-face').focus();
 await page.keyboard.press('ArrowRight');
 assert.equal(await page.locator('#tab-body').getAttribute('aria-selected'),'true');
 assert.equal(await page.evaluate(()=>document.activeElement.id),'tab-body');
 await page.keyboard.press('End');
 assert.equal(await page.locator('#tab-colours').getAttribute('aria-selected'),'true');
 await page.keyboard.press('Home');
 assert.equal(await page.locator('#tab-head').getAttribute('aria-selected'),'true');

 // Three independent allowlisted colour roles are reflected by the SVG.
 await clickTab(page,'colours');
 assert.equal(await page.locator('#editor-options .palette-choice').count(),18);
 await palette(page,'skin','coral').click();
 await palette(page,'outfit','aqua').click();
 await palette(page,'accent','cosmic-blue').click();
 const colours=await page.evaluate(()=>({
   skin:document.querySelector('#alien-art [data-layer="head"] [data-color-slot="primary"]').getAttribute('fill'),
   outfit:document.querySelector('#alien-art [data-layer="body"] [data-color-slot="primary"]').getAttribute('fill'),
   accent:document.querySelector('#alien-art [data-layer="rear-accessory"] [data-stroke-slot="primary"]').getAttribute('stroke')
 }));
 assert.deepEqual(colours,{skin:'#f49a94',outfit:'#73c9e8',accent:'#869ee7'});
 assert.equal(await palette(page,'skin','coral').getAttribute('aria-pressed'),'true');

 // Presets and randomisation are original, genuinely different compositions.
 await page.locator('#starter-options [data-preset="glimmer"]').click();
 assert.equal(await mainPart(page,'head'),'jelly');
 assert.equal(await mainPart(page,'eyes'),'cyclops');
 assert.equal(await mainPart(page,'legs'),'tentacles');
 assert.equal(await page.locator('#starter-options [data-preset="glimmer"]').getAttribute('aria-pressed'),'true');
 const beforeRandom=await page.locator('#alien-art svg').evaluate(svg=>svg.outerHTML);
 await page.locator('#alien-random').click();
 const afterRandom=await page.locator('#alien-art svg').evaluate(svg=>svg.outerHTML);
 assert.notEqual(beforeRandom,afterRandom);
 await page.locator('#alien-undo').click();
 assert.equal(await mainPart(page,'head'),'jelly');
 await page.locator('#alien-redo').click();
 const afterRedo=await page.locator('#alien-art svg').evaluate(svg=>svg.outerHTML);
 assert.equal(afterRandom.replace(/class="[^"]*"/g,''),
   afterRedo.replace(/class="[^"]*"/g,''),'Redo must restore the same full alien');
 await page.locator('#alien-reset').click();
 assert.equal(await mainPart(page,'head'),'orb');
 assert.equal(await mainPart(page,'body'),'bean');

 // Save is deliberate, restores on reload, and never mutates existing games.
 await page.evaluate(()=>{
   localStorage.setItem('equa-nova.sector-run.v1','solo-game-must-stay');
   localStorage.setItem('equa-nova.local-match.v1','local-game-must-stay');
   localStorage.setItem('equa-nova.online-room.v1','online-seat-must-stay');
 });
 await clickTab(page,'head');
 await choice(page,'head','facet').click();
 await page.locator('#alien-save').click();
 assert.match(await page.locator('#save-state').textContent(),/SAVED TO THIS DEVICE/i);
 const first=await readState(page);
 const saved=JSON.parse(first.saved);
 assert.equal(saved.head,'facet');
 assert.equal(saved.version,1);
 assert.equal(Object.keys(saved).length,9,'avatar save must include only approved attributes');
 assert.equal(first.solo,'solo-game-must-stay');
 assert.equal(first.local,'local-game-must-stay');
 assert.equal(first.online,'online-seat-must-stay');
 await choice(page,'head','pear').click();
 assert.match(await page.locator('#save-state').textContent(),/UNSAVED CHANGES/i);
 assert.equal((await readState(page)).saved,first.saved,'unsaved changes cannot overwrite saved avatar');
 await page.locator('#alien-load').click();
 assert.equal(await mainPart(page,'head'),'facet');
 assert.match(await page.locator('#save-state').textContent(),/SAVED TO THIS DEVICE/i);
 await page.reload({waitUntil:'networkidle'});
 await waitReady(page);
 assert.equal(await mainPart(page,'head'),'facet');
 assert.match(await page.locator('#alien-status').textContent(),/Welcome back/i);
 assert.equal((await readState(page)).saved,first.saved);

 // Export a transparent standalone SVG containing no remote dependencies.
 const [download]=await Promise.all([
   page.waitForEvent('download'),
   page.locator('#alien-export').click()
 ]);
 assert.equal(download.suggestedFilename(),'equa-nova-my-alien.svg');
 const exported=readFileSync(await download.path(),'utf8');
 assert.match(exported,/viewBox="0 0 320 360"/);
 assert.match(exported,/data-layer="head"/);
 assert.match(exported,/data-part-id="facet"/);
 assert.match(exported,/<svg/);
 assert.ok(!/<image|<script|href=|url\s*\(/i.test(exported));
 assert.equal((await readState(page)).saved,first.saved);

 // Reduced motion preference stops decorative idle and bounce animation.
 await page.emulateMedia({reducedMotion:'reduce'});
 await choice(page,'head','pear').click();
 const motion=await page.locator('#alien-art svg').evaluate(svg=>
   getComputedStyle(svg).animationName);
 assert.equal(motion,'none');
 await page.emulateMedia({reducedMotion:'no-preference'});

 // Corrupted storage must fail back to the safe starter and remain editable.
 await page.evaluate(()=>localStorage.setItem('equa-nova.alien.v1','{broken'));
 await page.reload({waitUntil:'networkidle'});await waitReady(page);
 assert.equal(await mainPart(page,'head'),'orb');
 assert.match(await page.locator('#alien-status').textContent(),/invalid old save was ignored/i);
 assert.equal(await page.locator('#alien-load').isEnabled(),false);

 // Responsive: desktop is a true side-by-side single-screen workspace,
 // mobile stacks without any horizontal overflow and retains a mini preview.
 for(const [width,height] of [[1366,768],[768,1024],[390,844],[320,700]]){
   await page.setViewportSize({width,height});
   await page.waitForTimeout(80);
   const boxes=await page.evaluate(()=>({
     width:innerWidth,scroll:document.documentElement.scrollWidth,
     preview:document.querySelector('.specimen-panel').getBoundingClientRect().toJSON(),
     workshop:document.querySelector('.workshop-panel').getBoundingClientRect().toJSON(),
     lastButton:document.querySelector('#alien-export').getBoundingClientRect().toJSON(),
     miniDisplay:getComputedStyle(document.querySelector('#mobile-live')).display,
     overflowElements:[...document.querySelectorAll('body *')].map(e=>({
       tag:e.tagName,id:e.id,cls:typeof e.className==='string'?e.className.slice(0,45):'',
       right:Math.round(e.getBoundingClientRect().right)
     })).filter(e=>e.right>innerWidth+3).slice(0,12)
   }));
   assert.ok(boxes.scroll<=boxes.width+2,'horizontal overflow '+JSON.stringify(boxes));
   assert.ok(boxes.workshop.right<=boxes.width+2,'editor exceeds viewport '+width);
   assert.ok(boxes.preview.right<=boxes.width+2,'alien exceeds viewport '+width);
   if(width>=768){
     assert.ok(boxes.workshop.left>boxes.preview.left+100,'desktop editor should be alongside preview');
     assert.ok(boxes.lastButton.bottom<=height+4,'desktop save controls must fit on screen');
   }else{
     assert.ok(boxes.workshop.top>=boxes.preview.top+100,'phone editor should stack below preview');
     assert.notEqual(boxes.miniDisplay,'none','keep live mini preview visible on phones');
     const body=await page.locator('#workshop-heading').isVisible();
     assert.equal(body,true);
     if(width===390)await page.screenshot({path:'/tmp/equanova-alien-editor-mobile.png',fullPage:true});
   }
 }

 // The maker is discoverable from the game without taking board space.
 const launchContext=await browser.newContext({viewport:{width:1366,height:768}});
 const gamePage=await launchContext.newPage();
 await gamePage.goto(ORIGIN+'/index.html',{waitUntil:'networkidle'});
 await gamePage.locator('.cell').first().waitFor();
 if(await gamePage.locator('#modal[open]').count())
   await gamePage.locator('#modal-actions button').last().click();
 await gamePage.locator('#mode-btn').click();
 assert.equal(await gamePage.locator('.alien-lab-modal-link').count(),1);
 await gamePage.locator('.alien-lab-modal-link').click();
 await gamePage.waitForURL(/alien-lab\.html$/);
 await waitReady(gamePage);
 await launchContext.close();

 // Graceful storage-blocked fallback in a fresh, separate private context.
 const blocked=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 await blocked.addInitScript(()=>{
   Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new Error('Storage blocked');}});
 });
 const second=await blocked.newPage();
 const blockedErrors=[];
 second.on('pageerror',e=>blockedErrors.push(e.message));
 await second.goto(ORIGIN+'/alien-lab.html',{waitUntil:'networkidle'});
 await waitReady(second);
 assert.match(await second.locator('#alien-status').textContent(),/storage is unavailable/i);
 await second.locator('#alien-save').click();
 assert.match(await second.locator('#alien-status').textContent(),/Unable to save/i);
 assert.equal(await second.locator('#alien-export').isEnabled(),true);
 assert.deepEqual(blockedErrors,[]);
 await blocked.close();
 assert.deepEqual(errors,[]);
 console.log('Alien Lab A2 browser passed: all part tabs, live preview, colour roles, presets, random, undo/redo, save/reload, SVG export, keyboard, reduced motion, invalid storage, phone layouts and game-save isolation.');
}finally{
 await context.close();await browser.close();
}
