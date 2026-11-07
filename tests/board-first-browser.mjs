import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base='http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const errors=[];
const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1});
page.on('pageerror',error=>errors.push(error.message));
async function dismissIntro(){
 if(await page.locator('#modal[open]').count())
  await page.locator('#modal-actions button').last().click();
}
async function dimensions(){
 return page.evaluate(()=>{
  const rect=id=>{const r=document.querySelector(id)?.getBoundingClientRect();return r?
   {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right}:null;};
  return {
   viewport:{width:innerWidth,height:innerHeight},scroll:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight},
   gridColumns:getComputedStyle(document.querySelector('.game-shell')).gridTemplateColumns.split(' ').length,
   overflowing:[...document.querySelectorAll('body *')].map(el=>{
    const r=el.getBoundingClientRect(),c=getComputedStyle(el);
    return {name:el.tagName.toLowerCase()+'#'+el.id+'.'+String(el.className||'').slice(0,60),
      left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width),
      position:c.position,flexDirection:c.flexDirection,overflowX:c.overflowX};
   }).filter(x=>x.width>0&&x.right>innerWidth+4).sort((a,b)=>b.right-a.right).slice(0,13),
   telemetry:rect('.left-panel'),board:rect('#board-frame'),
   preview:rect('#equation-preview'),rack:rect('.rack-section'),score:rect('#score-btn'),
   systems:rect('#ship-systems-drawer'),gadgets:rect('#gadget-drawer'),zone:rect('#drift-zone-map')
  };
 });
}
try{
 await page.goto(base+'play.html?mode=sector',{waitUntil:'networkidle'});
 await page.locator('#board .cell').first().waitFor();
 await dismissIntro();
 assert.equal(await page.locator('.right-panel').count(),0,'old third panel must not exist');
 assert.equal(await page.locator('.left-panel > #equation-preview').count(),1);
 assert.equal(await page.locator('#tile-set-btn').count(),0,'kit changes belong at launch');
 assert.equal(await page.locator('#zone-map-btn').count(),0,'no duplicate zone-map control');
 assert.equal(await page.locator('.board-zoom-toolbar .board-info-popover').count(),1);
 assert.equal(await page.locator('#gadget-drawer').isHidden(),true,'gadgets are Drift-only');
 assert.equal(await page.locator('#board .cell').count(),361);

 for(const size of [{width:1366,height:768,minBoard:485},
                    {width:1280,height:720,minBoard:450},
                    {width:1024,height:768,minBoard:485},
                    {width:768,height:1024,minBoard:620},
                    {width:390,height:844,minBoard:335},
                    {width:320,height:700,minBoard:275}]){
  await page.setViewportSize(size);
  const d=await dimensions();
  console.log('Board-first layout',size,d);
  assert.equal(d.gridColumns,size.width>920?2:1,
   'wide desktops have only two play columns; narrow screens stack');
  assert.ok(d.board.width>=size.minBoard,'board should gain usable width: '+JSON.stringify(d));
  assert.ok(d.board.height>=d.board.width*.88,'keep a nearly-square board: '+JSON.stringify(d));
  assert.ok(d.preview.right<=d.board.x+2||size.width<=920,
   'equation preview should be in telemetry, not beside the rack: '+JSON.stringify(d));
  assert.ok(d.rack.y>=d.board.bottom-2,'rack must ALWAYS sit below the game board: '+JSON.stringify(d));
  assert.ok(d.score.y>=d.rack.y,'score follows the rack below the board');
  assert.ok(d.scroll.width<=size.width+3,'no horizontal scrolling: '+JSON.stringify(d));
  assert.ok(d.board.x>=0&&d.board.right<=size.width+3,'board stays inside viewport');
  if(size.width>=1024) {
   assert.ok(d.score.bottom<=size.height-15,'Score must stay above desktop footer');
   assert.ok(d.scroll.height<=size.height+4,'laptop must not scroll vertically');
   assert.ok(d.telemetry.right<d.board.x,'score rail remains to board left');
  }
  if(size.width===390){
   assert.ok(d.score.bottom<=d.scroll.height+1,'phone Score must remain reachable by vertical scrolling');
   assert.ok(d.preview.y<d.board.y,'phone equation preview precedes board');
  }
  if([1366,1280,768,390].includes(size.width))
   await page.screenshot({path:'/tmp/equanova-board-first-'+size.width+'.png',fullPage:true});
 }
 await page.setViewportSize({width:390,height:844});
 await page.locator('.board-info-popover summary').click();
 assert.equal(await page.locator('.board-info-popover').evaluate(e=>e.open),true);
 assert.equal(await page.locator('.board-info-popover .legend-square').count(),4);
 const pop=await page.locator('.board-info-popover .play-rule-body').boundingBox();
 assert.ok(pop&&pop.x>=0&&pop.x+pop.width<=390+3,'rules popover fits phone width');
 await page.locator('.board-info-popover summary').click();

 await page.setViewportSize({width:1366,height:768});
 await page.goto(base+'play.html?mode=rogue',{waitUntil:'networkidle'});
 await page.locator('#board .cell').first().waitFor();await dismissIntro();
 assert.equal(await page.locator('#drift-loadout').evaluate(e=>Boolean(e.closest('.left-panel'))),true);
 assert.equal(await page.locator('#drift-temporary').evaluate(e=>Boolean(e.closest('.left-panel'))),true);
 assert.equal(await page.locator('#drift-zone-map').evaluate(e=>Boolean(e.closest('.topbar'))),true);
 assert.equal(await page.locator('#drift-zone-map').isVisible(),true);
 assert.equal(await page.locator('#permanent-slots .equipment-slot').count(),4);
 assert.equal(await page.locator('#temporary-slots .equipment-slot').count(),2);
 assert.equal(await page.locator('#ship-systems-drawer').evaluate(e=>e.open),true);
 assert.equal(await page.locator('#gadget-drawer').evaluate(e=>e.open),true);
 assert.equal(await page.locator('#gadget-drawer').isVisible(),true);
 const driftDock=await dimensions();
 assert.ok(driftDock.gadgets.y>=driftDock.systems.bottom-1,'gadgets must be UNDER ship systems');
 assert.ok(driftDock.rack.y>=driftDock.board.bottom-2,'Drift rack under board');
 await page.screenshot({path:'/tmp/equanova-board-first-drift-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.locator('#ship-systems-drawer').evaluate(e=>e.open),false);
 assert.equal(await page.locator('#gadget-drawer').evaluate(e=>e.open),false);
 await page.locator('#ship-systems-drawer summary').click();
 assert.equal(await page.locator('#rogue-summary').isVisible(),true);
 await page.locator('#ship-systems-drawer summary').click();
 await page.locator('#gadget-drawer summary').click();
 assert.equal(await page.locator('#temporary-slots .equipment-slot').count(),2);
 assert.equal(await page.locator('#temporary-slots .equipment-slot').first().isVisible(),true);
 await page.screenshot({path:'/tmp/equanova-board-first-drift-mobile.png',fullPage:true});

 const online=await browser.newPage({viewport:{width:1366,height:768}});
 online.on('pageerror',error=>errors.push(error.message));
 await online.goto(base+'online.html',{waitUntil:'domcontentloaded'});
 assert.equal(await online.locator('.right-panel').count(),0);
 assert.equal(await online.locator('.left-panel > #equation-preview').count(),1);
 assert.equal(await online.locator('#online-callout-stage').count(),1);
 assert.equal(await online.locator('.board-info-popover').count(),1);
 assert.equal(await online.locator('.board-frame').count(),1);
 await online.close();
 assert.deepEqual(errors,[],'no JavaScript errors during mode changes and responsive checks');
 console.log('Board-first acceptance checks passed: rack under board, equation left, gadgets under systems, zone in header, responsive access.');
}finally{await browser.close();}
