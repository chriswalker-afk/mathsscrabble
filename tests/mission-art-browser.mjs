import assert from 'node:assert/strict';
import {chromium} from 'playwright';

// Each piece of Pass B art is an original, local SVG. These checks prevent
// decorative assets from hiding the navigation or widening narrow screens.
const base='http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const artPaths=['bridge','sector','drift','local','online','kit-launchpad','kit-orbit',
   'kit-nebula','kit-quantum','alien-lab'];
 for(const [width,height] of [[1366,768],[768,1024],[390,844],[320,700]]){
   const page=await browser.newPage({viewport:{width,height}});
   const errors=[];page.on('pageerror',err=>errors.push(err.message));
   await page.goto(base,{waitUntil:'networkidle'});
   assert.equal(await page.locator('.mode-card').count(),4);
   assert.equal(await page.locator('[data-tile-kit]').count(),4);
   assert.equal(await page.locator('img[src*="/assets/mission-control/"]').count(),10,
     'home should use ten original illustrated assets (hero, 4 modes, 4 kits, lab)');
   const assets=await page.locator('img[src*="/assets/mission-control/"]').evaluateAll(imgs=>
     imgs.map(img=>img.getAttribute('src').split('/').at(-1).replace('.svg','')));
   assert.deepEqual(assets.slice().sort(),artPaths.slice().sort());
   const layout=await page.evaluate(()=>{
     const extent=node=>{const r=node.getBoundingClientRect();
       return {x:r.x,y:r.y,right:r.right,width:r.width,height:r.height};};
     return {viewport:innerWidth,scroll:document.documentElement.scrollWidth,
       hero:extent(document.querySelector('.home-intro')),
       firstMode:extent(document.querySelector('.mode-card')),
       kit:extent(document.querySelector('.tile-kit-picker')),
       cards:[...document.querySelectorAll('.mode-card')].map(extent),
       tiles:[...document.querySelectorAll('.tile-kit-card')].map(extent)};
   });
   assert.ok(layout.scroll<=layout.viewport+3,
     'illustrations and mathematical kit samples must not overflow at '+width+': '+JSON.stringify(layout));
   assert.ok(layout.firstMode.y<layout.kit.y,'illustrated modes should precede the kit catalogue');
   assert.ok(layout.cards.every(card=>card.width>=240&&card.height>=165),
     'game choices must be substantial, entirely clickable cards');
   assert.ok(layout.tiles.every(tile=>tile.width>=110&&tile.height>=175),
     'all four kit selectors must remain individually readable');
   for(const card of await page.locator('.mode-card').all()){
     const el=await card.evaluate(e=>({tag:e.tagName,art:e.querySelector('img.mode-card-art')!==null,
       status:e.querySelector('[data-save]')!==null,href:e.getAttribute('href')}));
     assert.equal(el.tag,'A');assert.ok(el.art&&el.status&&el.href);
   }
   // This is important on the 320px view: no example equation should run out
   // of its own selector or require horizontal scrolling to read.
   const samples=await page.locator('.tile-kit-card').evaluateAll(cards=>cards.map(card=>{
     const sample=card.querySelector('.tile-kit-sample'),a=sample.getBoundingClientRect(),
       b=card.getBoundingClientRect();return {sampleRight:a.right,cardRight:b.right};
   }));
   assert.ok(samples.every(s=>s.sampleRight<=s.cardRight+1),
     'each equation example must remain inside its kit card at '+width+': '+JSON.stringify(samples));
   if(width===1366){
     for(const art of await page.locator('img[src*="/assets/mission-control/"]').all()){
       await art.scrollIntoViewIfNeeded();
       await art.evaluate(async img=>{await img.decode();});
       assert.ok(await art.evaluate(img=>img.naturalWidth>0&&img.naturalHeight>0),
         'SVG illustration must load and decode: '+await art.getAttribute('src'));
       assert.equal(await art.getAttribute('alt'),'','decorative art must not duplicate button labels');
     }
     await page.screenshot({path:'/tmp/equanova-mission-control-art-desktop.png',fullPage:true});
   }
   if(width===390)await page.screenshot({path:'/tmp/equanova-mission-control-art-mobile.png',fullPage:true});
   assert.deepEqual(errors,[]);
   await page.close();
 }
 const chooser=await browser.newPage({viewport:{width:390,height:844}});
 await chooser.goto(base,{waitUntil:'networkidle'});
 await chooser.locator('[data-tile-kit="advanced"]').click();
 assert.equal(await chooser.locator('[data-tile-kit="advanced"]').getAttribute('aria-pressed'),'true');
 assert.equal(await chooser.locator('#home-hero-active-kit').textContent(),'QUANTUM');
 assert.match(await chooser.locator('#home-rogue').getAttribute('href'),/&tiles=advanced$/);
 assert.match(await chooser.locator('#home-online').getAttribute('href'),/\?tiles=advanced$/);
 assert.equal(await chooser.locator('.tile-kit-card.is-selected').count(),1);
 assert.equal(await chooser.locator('[data-tile-kit="advanced"] .kit-equation-tile').count(),7);
 assert.deepEqual(await chooser.locator('[data-tile-kit="rational"] .kit-equation-tile').allTextContents(),
   ['½','+','½','=','1']);
 await chooser.reload({waitUntil:'networkidle'});
 assert.equal(await chooser.locator('[data-tile-kit="advanced"]').getAttribute('aria-pressed'),'true',
   'the chosen kit should survive returning to Mission Control');
 await chooser.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await chooser.locator('#home-rogue').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
 assert.equal(await chooser.locator('#home-rogue .mode-card-art').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
 await chooser.close();
 console.log('Illustrated Mission Control Pass B browser checks passed: 10 original SVGs, four responsive widths, kit samples and persistence, reduced motion, and navigable full cards.');
}finally{await browser.close();}
