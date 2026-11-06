import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const ORIGIN='http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const errors=[];
async function ready(p,selector){
 await p.locator(selector).waitFor({timeout:15000});
}
try{
 for(const [width,height] of [[320,700],[390,844],[768,1024],[1366,768]]){
   const page=await browser.newPage({viewport:{width,height}});
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(ORIGIN+'/online.html',{waitUntil:'networkidle'});
   await ready(page,'#online-alien-presets [data-preset="glimmer"]');
   assert.equal(await page.locator('#online-alien-presets button').count(),4);
   await page.locator('#online-alien-presets [data-preset="glimmer"]').click();
   assert.equal(await page.locator('#online-alien-presets [data-preset="glimmer"]').getAttribute('aria-pressed'),'true');
   await page.locator('#online-own-alien svg').waitFor({timeout:16000});
   assert.equal(await page.locator('#online-own-alien [data-layer="head"]').getAttribute('data-part-id'),'jelly');
   await page.locator('#online-alien-random').click();
   assert.equal(await page.locator('#online-alien-presets [data-preset="glimmer"]').getAttribute('aria-pressed'),'false');
   const geometry=await page.evaluate(()=>({
     width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,
     gate:document.querySelector('.online-gate-card').getBoundingClientRect().toJSON(),
     picker:document.querySelector('.online-pilot-picker').getBoundingClientRect().toJSON(),
     firstCard:document.querySelector('#online-alien-presets button').getBoundingClientRect().toJSON(),
     editorLink:document.querySelector('.online-pilot-picker .alien-editor-link').getBoundingClientRect().toJSON()
   }));
   assert.ok(geometry.documentWidth<=width+2,'no horizontal overflow '+JSON.stringify(geometry));
   assert.ok(geometry.picker.right<=width+2&&geometry.gate.right<=width+2,
     'pilot picker must fit device '+JSON.stringify(geometry));
   assert.ok(geometry.firstCard.width>=75&&geometry.firstCard.height>=40,
     'alien choices need touch-friendly tap areas '+JSON.stringify(geometry));
   assert.ok(geometry.editorLink.width>=110,'editor link must remain readable');
   if(width===390)await page.screenshot({path:'/tmp/equanova-alien-b-online-mobile.png',fullPage:true});
   await page.close();
 }
 const local=await browser.newPage({viewport:{width:390,height:844}});
 local.on('pageerror',e=>errors.push(e.message));
 await local.goto(ORIGIN+'/index.html',{waitUntil:'networkidle'});
 await local.locator('.cell').first().waitFor();
 if(await local.locator('#modal[open]').count())await local.locator('#modal-actions button').last().click();
 await local.locator('#mode-btn').click();
 await local.locator('#modal-actions button').nth(2).click();
 await local.locator('#local-alien-0').selectOption('orbit');
 await local.locator('#local-alien-1').selectOption('niblet');
 assert.equal(await local.locator('.local-pilot-setup:visible').count(),2);
 assert.equal(await local.locator('.alien-setup-choice .alien-player-avatar').count(),4);
 await local.locator('#local-setup-names .alien-editor-link').waitFor();
 const localMetrics=await local.evaluate(()=>({
   width:innerWidth,scroll:document.documentElement.scrollWidth,
   modal:document.querySelector('#modal').getBoundingClientRect().toJSON(),
   options:[...document.querySelectorAll('.alien-setup-choice')].map(e=>e.getBoundingClientRect().toJSON()),
   action:document.querySelector('#modal-actions button:last-child').getBoundingClientRect().toJSON()
 }));
 assert.ok(localMetrics.scroll<=localMetrics.width+2,
   'local character setup must not cause horizontal document overflow');
 assert.ok(localMetrics.modal.right<=localMetrics.width+2);
 await local.screenshot({path:'/tmp/equanova-alien-b-local-setup-mobile.png',fullPage:true});
 await local.close();
 assert.deepEqual(errors,[]);
 console.log('Alien multiplayer mobile browser passed: 320/390/768/1366 entry screens, real SVG pilot picker, visible link, local per-seat setups.');
}finally{await browser.close();}
