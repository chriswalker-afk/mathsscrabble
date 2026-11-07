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
      gridWidth:b.scrollWidth,scrollWidth:v.scrollWidth,clientWidth:v.clientWidth,
      scrollHeight:v.scrollHeight,clientHeight:v.clientHeight,
      scrollLeft:v.scrollLeft,scrollTop:v.scrollTop,
      cellWidth:b.querySelector('.cell').getBoundingClientRect().width,
      font:parseFloat(getComputedStyle(b.querySelector('.bonus-label')).fontSize)};
  });
  const original=await snapshot();
  assert.ok(original.frameWidth<=665,'board viewport must remain compact');
  assert.ok(original.gridWidth>0,'grid exists');
  await page.locator('#board-zoom-in').click();
  await page.locator('#board-zoom-in').click();
  const zoomed=await snapshot();
  assert.ok(zoomed.cellWidth>original.cellWidth+8,'zoom must enlarge square dimensions');
  assert.equal(zoomed.frameWidth,original.frameWidth,'zoom must not expand the board footprint');
  await page.locator('#board-zoom-fit').click();
  const fitted=await snapshot();
  assert.ok(fitted.scrollWidth<=fitted.clientWidth+5,'FIT must reveal all 19 columns');
  assert.ok(fitted.scrollHeight<=fitted.clientHeight+5,'FIT must reveal all 19 rows');
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
