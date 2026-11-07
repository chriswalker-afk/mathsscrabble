import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const size of [{width:1366,height:768},{width:390,height:844},{width:320,height:700}]){
  const page=await browser.newPage({viewport:size});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/play.html?mode=sector',{waitUntil:'networkidle'});
  if(await page.locator('#modal[open]').count())await page.locator('#modal-actions button').last().click();
  assert.equal(await page.locator('#board .cell').count(),361);
  const snapshot=()=>page.evaluate(()=>{
    const v=document.getElementById('board-viewport'),f=document.getElementById('board-frame'),b=document.getElementById('board');
    return {frameWidth:f.getBoundingClientRect().width,viewportWidth:v.clientWidth,
      gridWidth:b.getBoundingClientRect().width,gridHeight:b.getBoundingClientRect().height,
      scrollWidth:v.scrollWidth,clientWidth:v.clientWidth,
      scrollHeight:v.scrollHeight,clientHeight:v.clientHeight,
      scrollLeft:v.scrollLeft,scrollTop:v.scrollTop,
      cellWidth:b.querySelector('.cell').getBoundingClientRect().width,
      font:parseFloat(getComputedStyle(b.querySelector('.bonus-label')).fontSize)};
  });
  const original=await snapshot();
  assert.ok(original.frameWidth<=665,'board viewport must remain compact');
  assert.ok(original.gridWidth>0,'grid exists');
  assert.ok(Math.abs(original.gridWidth-original.clientWidth)<=4,
    'initial grid should fill the viewport width (no unused right gutter): '+JSON.stringify(original));
  assert.ok(Math.abs(original.gridHeight-original.clientHeight)<=4,
    'initial grid should fill the viewport height (no unused bottom gutter): '+JSON.stringify(original));
  assert.equal(await page.locator('#board-zoom-level').textContent(),'100%',
    'full-board scale is 100% when the game starts');
  await page.locator('#board-zoom-in').click();
  await page.locator('#board-zoom-in').click();
  const zoomed=await snapshot();
  assert.ok(zoomed.cellWidth>original.cellWidth+8,'zoom must enlarge square dimensions');
  assert.equal(zoomed.frameWidth,original.frameWidth,'zoom must not expand the board footprint');
  await page.locator('#board-zoom-fit').click();
  const fitted=await snapshot();
  assert.ok(fitted.scrollWidth<=fitted.clientWidth+5,'FIT must reveal all 19 columns');
  assert.ok(fitted.scrollHeight<=fitted.clientHeight+5,'FIT must reveal all 19 rows');
  assert.ok(Math.abs(fitted.gridWidth-fitted.clientWidth)<=4,'FIT fills entire board viewport width');
  assert.ok(Math.abs(fitted.gridHeight-fitted.clientHeight)<=4,'FIT fills entire board viewport height');
  assert.equal(await page.locator('#board-zoom-level').textContent(),'100%');
  await page.locator('#board-zoom-in').click();
  await page.locator('#board-zoom-in').click();
  await page.locator('#board-zoom-in').click();
  await page.locator('#board-zoom-in').click();
  const larger=await snapshot();
  if(larger.scrollWidth>larger.clientWidth+35){
    await page.locator('#board-viewport').evaluate(v=>{v.scrollLeft=v.scrollWidth-v.clientWidth;v.scrollTop=v.scrollHeight-v.clientHeight;});
    const panned=await snapshot();
    assert.ok(panned.scrollLeft>=larger.scrollLeft,'all outer board cells should be reachable by panning');
    await page.locator('#board-zoom-center').click();
    const centered=await snapshot();
    assert.ok(centered.scrollLeft<panned.scrollLeft,'centre command must restore board focus');
  }
  // Switch from a zoomed view to FIT, then resize the available sub-window.
  // The 19x19 board should re-fill the space without pressing FIT a second time.
  await page.locator('#board-zoom-fit').click();
  if(size.width===1366){
    await page.setViewportSize({width:1024,height:720});
    await page.waitForFunction(()=>{
      const v=document.getElementById('board-viewport'),b=document.getElementById('board');
      return Math.abs(v.clientWidth-b.getBoundingClientRect().width)<=4 &&
        Math.abs(v.clientHeight-b.getBoundingClientRect().height)<=4;
    });
    const resized=await snapshot();
    assert.ok(Math.abs(resized.gridWidth-resized.clientWidth)<=4,'responsive FIT preserves horizontal fill');
    assert.ok(Math.abs(resized.gridHeight-resized.clientHeight)<=4,'responsive FIT preserves vertical fill');
    assert.equal(await page.locator('#board-zoom-level').textContent(),'100%');
    await page.setViewportSize(size);
  }
  const visible=await page.evaluate(()=>({
    width:innerWidth,scroll:document.documentElement.scrollWidth,
    overshooting:[...document.querySelectorAll('body *')].map(el=>({el,right:el.getBoundingClientRect().right}))
      .filter(({right})=>right>innerWidth+3).slice(0,7)
      .map(({el,right})=>({element:el.tagName.toLowerCase()+'#'+el.id+'.'+el.className,right:Math.round(right)}))
  }));
  console.log('Zoom layout',size,visible);
  assert.ok(visible.scroll<=visible.width+3,'zoom must not add page-wide scrolling');
  assert.deepEqual(errors,[]);
  await page.close();
 }
 console.log('19x19 zoom browser passed: full board, FIT, zoom controls, panning and recenter across desktop and phone sizes.');
}finally{await browser.close();}
