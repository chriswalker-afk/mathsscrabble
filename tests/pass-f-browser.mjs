import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const ORIGIN='http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const errors=[];
try{
 for(const [width,height] of [[1366,768],[768,1024],[390,844],[320,700]]){
  const page=await browser.newPage({viewport:{width,height}});
  page.on('pageerror',e=>errors.push('Sector '+width+': '+e.message));
  await page.goto(ORIGIN+'/play.html?mode=sector',{waitUntil:'networkidle'});
  if(await page.locator('#modal[open]').count())
   await page.locator('#modal-actions button').last().click();
  await page.locator('#board .cell').first().waitFor();
  assert.equal(await page.locator('#board .cell').count(),361);
  assert.equal(await page.locator('#log').isVisible(),true,'play action log must stay visible at '+width);
  assert.match(await page.locator('#save-status').getAttribute('aria-label'),/saved on this device|could not save/i);
  const view=await page.evaluate(()=>{
    const log=document.querySelector('#log'),frame=document.querySelector('#board-frame');
    const rect=log.getBoundingClientRect();
    return {viewport:innerWidth,scroll:document.documentElement.scrollWidth,
     frame:frame.getBoundingClientRect().width,logWidth:rect.width,
     logHeight:rect.height,logDisplay:getComputedStyle(log).display,
     saveDisplay:getComputedStyle(document.querySelector('#save-status')).display,
     topbarScroll:document.querySelector('.topbar').scrollWidth,
     topbarClient:document.querySelector('.topbar').clientWidth};
  });
  assert.ok(view.scroll<=width+3,'full page cannot overflow horizontally at '+width+': '+JSON.stringify(view));
  assert.ok(view.topbarScroll<=view.topbarClient+3,'header must fit at '+width+': '+JSON.stringify(view));
  assert.ok(view.logWidth>120&&view.logHeight>=20);
  assert.ok(view.frame<=720,'status UI may not increase physical board width');
  if(width<=730)assert.notEqual(view.saveDisplay,'none','save icon must be visible on phones');
  // An invalid equation should produce a readable explanation and clear
  // visual state without an alert floating over the mathematical tiles.
  await page.locator('#rack .tile:not(.wildcard)').first().click();
  await page.locator('#board .cell').nth(180).click();
  await page.locator('#score-btn').click();
  assert.equal(await page.locator('#log').getAttribute('data-tone'),'error');
  assert.equal(await page.locator('#log').getAttribute('role'),'status');
  assert.ok((await page.locator('#log').textContent()).length>8);
  assert.equal(await page.locator('#log').evaluate(e=>getComputedStyle(e,'::before').content.includes('CHECK YOUR MOVE')),true);
  const r=await page.locator('#log').evaluate(el=>{
   const box=el.getBoundingClientRect();return {top:box.top,left:box.left,right:box.right,height:box.height,scrollHeight:el.scrollHeight};
  });
  assert.ok(r.left>=-2&&r.right<=width+2,'error panel must fit '+width);
  if(width===390)await page.screenshot({path:'/tmp/equanova-pass-f-sector-phone.png',fullPage:true});
  if(width===1366)await page.screenshot({path:'/tmp/equanova-pass-f-sector-desktop.png',fullPage:true});
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('#log').evaluate(e=>getComputedStyle(e).animationName),'none');
  await page.close();
 }

 // Local multiplayer previously concealed the action log on phones. Real
 // setup/turn flow should now expose the log while keeping the private rack
 // hidden behind the handover until Ready.
 {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.on('pageerror',e=>errors.push('Local: '+e.message));
  await page.goto(ORIGIN+'/index.html',{waitUntil:'networkidle'});
  await page.locator('#home-local').click();
  await page.waitForURL(/play\.html\?mode=local/);
  await page.locator('#modal-title').waitFor();
  assert.match(await page.locator('#modal-title').textContent(),/local match/i);
  await page.locator('#local-setup-names input').nth(0).fill('Ari');
  await page.locator('#local-setup-names input').nth(1).fill('Bea');
  await page.locator('#modal-actions button').last().click();
  assert.equal(await page.locator('#local-privacy').isVisible(),true);
  await page.locator('#local-ready-btn').click();
  assert.equal(await page.locator('#app').getAttribute('data-mode'),'local');
  assert.equal(await page.locator('#log').isVisible(),true,'local status must not be hidden on phones');
  const status=await page.locator('#log').evaluate(e=>({width:e.getBoundingClientRect().width,
   display:getComputedStyle(e).display,role:e.getAttribute('role')}));
  assert.ok(status.width>180&&status.display!=='none'&&status.role==='status');
  assert.ok(await page.locator('#local-scores .local-score-row').count()>=2);
  await page.screenshot({path:'/tmp/equanova-pass-f-local-phone.png',fullPage:true});
  await page.close();
 }

 // Connection states need to be understandable on narrow displays, even
 // before a room is joined. Only hide the initial gate for geometry checks:
 // online room creation/scoring/reconnect are in online-browser.mjs.
 for(const [width,height] of [[390,844],[320,700]]){
  const page=await browser.newPage({viewport:{width,height}});
  page.on('pageerror',e=>errors.push('Online '+width+': '+e.message));
  await page.goto(ORIGIN+'/online.html',{waitUntil:'domcontentloaded'});
  await page.locator('#online-gate').evaluate(e=>e.hidden=true);
  await page.locator('#online-log').waitFor({state:'visible'});
  const view=await page.evaluate(async()=>{
    const {paintFeedback}=await import('/src/mission-feedback.js');
    paintFeedback(document.getElementById('online-log'),
     'Signal interrupted. Check your connection and the board before retrying.',
     'warning');
    const log=document.getElementById('online-log');
    const badge=document.getElementById('online-connection');
    const box=log.getBoundingClientRect();
    return {viewport:innerWidth,scroll:document.documentElement.scrollWidth,
     text:log.textContent,tone:log.dataset.tone,
     logDisplay:getComputedStyle(log).display,
     logWidth:box.width,logLeft:box.left,logRight:box.right,
     badgeDisplay:getComputedStyle(badge).display,
     badgeFont:getComputedStyle(badge).fontSize,
     headerScroll:document.querySelector('.topbar').scrollWidth,
     headerClient:document.querySelector('.topbar').clientWidth,
     buttonHeight:document.getElementById('online-score').getBoundingClientRect().height};
  });
  assert.equal(view.tone,'warning');
  assert.match(view.text,/Signal interrupted/);
  assert.notEqual(view.logDisplay,'none','online status hidden at '+width);
  assert.ok(view.logWidth>180&&view.logLeft>=-2&&view.logRight<=width+2);
  assert.ok(view.scroll<=width+3,'online document overflow at '+width+': '+JSON.stringify(view));
  assert.ok(view.headerScroll<=view.headerClient+3,'online header overflow at '+width+': '+JSON.stringify(view));
  assert.ok(view.buttonHeight>=40,'important game commands must be tappable');
  assert.notEqual(view.badgeDisplay,'none');
  assert.notEqual(view.badgeFont,'0px','offline/reconnect state must be written out, not dot-only');
  if(width===390)await page.screenshot({path:'/tmp/equanova-pass-f-online-phone.png',fullPage:true});
  await page.close();
 }
 assert.deepEqual(errors,[]);
 console.log('Pass F UI checks passed: sector validation feedback, four viewport widths, compact autosave, local phone messages, online reconnect visibility, usable commands and reduced motion.');
}finally{await browser.close();}
