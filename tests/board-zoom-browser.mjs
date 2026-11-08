import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
// Include normal maths, two-character signed values and stacked rational tiles.
// CSS overflow:hidden would hide broken glyphs, so inspect text rectangles,
// not merely the width of the outer board-tile element.
const glyphSamples=['8','+','−','×','÷','=','−9','(',')','√','^','!','3/4','12/13'];
const seedGlyphs=page=>page.evaluate(async values=>{
 const {renderTileFace,tileFaceClass}=await import('./src/tile-face.js');
 const cells=[...document.querySelectorAll('#board .cell')];
 values.forEach((value,i)=>{
  const cell=cells[i];cell.classList.add('occupied');
  const glyph=document.createElement('span');
  glyph.className='board-tile'+(tileFaceClass(value)?' '+tileFaceClass(value):'');
  renderTileFace(glyph,value);cell.replaceChildren(glyph);
 });
},glyphSamples);
const glyphGeometry=page=>page.evaluate(count=>{
 const tiles=[...document.querySelectorAll('#board .cell .board-tile')].slice(0,count);
 return tiles.map(tile=>{
  const box=tile.getBoundingClientRect(),cell=tile.parentElement.getBoundingClientRect();
  const textRects=[],walker=document.createTreeWalker(tile,NodeFilter.SHOW_TEXT);
  let node;
  while((node=walker.nextNode())){
   if(!node.textContent.trim())continue;
   const range=document.createRange();range.selectNodeContents(node);
   const rect=range.getBoundingClientRect();
   textRects.push({left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom});
  }
  return {value:tile.textContent,kind:tile.className,cellWidth:cell.width,
   font:parseFloat(getComputedStyle(tile).fontSize),width:box.width,height:box.height,
   overflowing:tile.scrollWidth>tile.clientWidth+1||tile.scrollHeight>tile.clientHeight+1,
   clipped:textRects.some(r=>r.left<box.left-1.25||r.right>box.right+1.25||
      r.top<box.top-1.25||r.bottom>box.bottom+1.25)};
 });
},glyphSamples.length);
const assertGlyphsFit=async(page,label)=>{
 const geom=await glyphGeometry(page);
 assert.equal(geom.length,glyphSamples.length,'sample tile faces were created');
 assert.ok(geom.every(x=>!x.clipped&&!x.overflowing),
  label+' contains clipped symbols: '+JSON.stringify(geom.filter(x=>x.clipped||x.overflowing)));
 const signed=geom.find(x=>x.value==='−9');
 const fraction=geom.find(x=>x.kind.includes('fraction-tile'));
 const regular=geom.find(x=>x.value==='8');
 assert.ok(signed.font<regular.font,'two-character negative tiles must scale down');
 assert.ok(fraction.font<regular.font,'stacked fractions must scale down');
 return geom;
};
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
  await seedGlyphs(page);
  const initialGlyphs=await assertGlyphsFit(page,size.width+'px FIT');
  assert.ok(initialGlyphs.find(x=>x.value==='8').font<initialGlyphs[0].cellWidth,
    'the numeric font must scale with the cell even on very small phones');
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
  const zoomGlyphs=await assertGlyphsFit(page,size.width+'px zoomed');
  assert.ok(zoomGlyphs[0].font>initialGlyphs[0].font+4,
    'zoom must enlarge the mathematical glyph, not only its cell');
  assert.ok(zoomed.cellWidth>original.cellWidth+8,'zoom must enlarge square dimensions');
  assert.equal(zoomed.frameWidth,original.frameWidth,'zoom must not expand the board footprint');
  await page.locator('#board-zoom-fit').click();
  const fitted=await snapshot();
  await assertGlyphsFit(page,size.width+'px FIT reset');
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
    await assertGlyphsFit(page,'1024px resized FIT');
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
 console.log('19x19 zoom browser passed: fitted board, unclipped number/operator/signed/fraction faces, zoom, resize and recenter on phones and desktops.');
}finally{await browser.close();}
