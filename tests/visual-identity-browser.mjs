import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const origin='http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const paths=['index.html','play.html?mode=sector','online.html','alien-lab.html',
   'alien-preview.html','visual-direction.html'];
 for(const path of paths){
   const page=await browser.newPage({viewport:{width:390,height:844}});
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto(origin+'/'+path,{waitUntil:'domcontentloaded'});
   assert.equal(await page.locator('link[href="./src/design-system.css"]').count(),1,
     path+' must share the central visual tokens');
   const theme=await page.evaluate(()=>{
     const cs=getComputedStyle(document.documentElement);
     return {teal:cs.getPropertyValue('--nova-teal').trim(),
       gold:cs.getPropertyValue('--nova-gold').trim(),
       border:cs.getPropertyValue('--nova-line').trim(),
       viewport:innerWidth,scroll:document.documentElement.scrollWidth};
   });
   assert.equal(theme.teal,'#8fe8d1');
   assert.equal(theme.gold,'#f4d49b');
   assert.equal(theme.border,'#608a93');
   if(path==='visual-direction.html'){
     assert.equal(await page.locator('.reference-swatch').count(),7);
     assert.equal(await page.locator('.reference-component-grid .reference-sample').count(),3);
     await page.locator('.reference-scenes img').evaluate(img=>img.decode());
     assert.ok(await page.locator('.reference-scenes img').evaluate(img=>img.naturalWidth>0),
       'original scene studies must load and decode');
     assert.ok(theme.scroll<=theme.viewport+3,'field guide should fit a mobile viewport');
     await page.getByRole('link',{name:/Return to Mission Control/i}).last().focus();
     const focus=await page.getByRole('link',{name:/Return to Mission Control/i}).last()
       .evaluate(el=>getComputedStyle(el).outlineStyle);
     assert.equal(focus,'solid','visible keyboard focus');
     await page.emulateMedia({reducedMotion:'reduce'});
     assert.equal(await page.locator('.nova-signal').evaluate(el=>getComputedStyle(el).animationName),
       'none','decorative signals must honour reduced-motion');
   }
   assert.deepEqual(errors,[],path+' should not raise client-side script errors');
   await page.close();
 }
 // The reference artwork must not introduce a wider document at the minimum
 // supported phone width.
 const small=await browser.newPage({viewport:{width:320,height:700}});
 await small.goto(origin+'/visual-direction.html',{waitUntil:'domcontentloaded'});
 const geometry=await small.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(geometry.scroll<=geometry.width+3);
 await small.close();
 console.log('Visual identity Pass A browser checks passed on six pages, including SVG, tokens, keyboard focus and reduced motion.');
}finally{await browser.close();}
