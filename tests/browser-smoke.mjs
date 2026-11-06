import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base='http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1});
const pageErrors=[];
page.on('pageerror',error=>pageErrors.push(error.message));
const boardIndex=(r,c)=>r*13+c;
const cell=(r,c)=>page.locator('.cell[data-index="'+boardIndex(r,c)+'"]');
async function selectRackTile(value){
  await page.locator('#rack .tile').evaluateAll((buttons,symbol)=>{
    const button=buttons.find(el=>el.querySelector('span')?.textContent===symbol);
    if(!button)throw new Error('Missing rack tile: '+symbol);
    button.click();
  },value);
}
async function put(value,r,c){
  if(value==='=')await page.locator('#equals-tile').click();
  else await selectRackTile(value);
  await cell(r,c).click();
}
async function drag(source,dest){
  const a=await source.boundingBox(),b=await dest.boundingBox();
  assert.ok(a&&b,'drag source and destination should be visible');
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);
  await page.mouse.down();
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:12});
  await page.mouse.up();
}
try{
  await page.goto(base,{waitUntil:'networkidle'});
  await page.locator('.cell').first().waitFor();
  assert.equal(await page.locator('.cell').count(),169);
  assert.equal(await page.locator('#rack .tile').count(),7);
  assert.equal(await page.locator('#bag-count').textContent(),String(144));
  assert.equal(await page.locator('#preview-equation').textContent(),'—');
  assert.equal(await page.locator('.arena-topline').count(),0);
  assert.equal(await page.locator('.right-panel #equation-preview').count(),1);
  assert.equal(await page.locator('#rack .wildcard').count(),2);

  // 1=1 is mathematically true but is not a calculation and must be rejected.
  await put('1',6,5);
  await put('=',6,6);
  await selectRackTile('✦');
  await cell(6,7).click();
  await page.locator('#wildcard-choices button', {hasText:'1'}).first().click();
  await page.locator('#score-btn').click();
  assert.match(await page.locator('#log').textContent(),/calculation/i);
  await page.locator('#undo-btn').click();
  assert.equal(await page.locator('#rack .tile').count(),7);

  // Enter an intentionally incorrect equation; preview must never reveal its truth.
  const placements=[['8',6,3],['+',6,4],['4',6,5],['=',6,6],['1',6,7]];
  for(const [symbol,row,col] of placements)await put(symbol,row,col);
  await selectRackTile('✦');
  await cell(6,8).click();
  await page.locator('#wildcard-choices button', {hasText:'3'}).first().click();
  assert.equal(await page.locator('#preview-equation').textContent(),'8+4=13');
  assert.match(await page.locator('#preview-status').textContent(),/submit to check BIDMAS/i);
  assert.match(await page.locator('#potential-score').textContent(),/^\+\d+$/);
  assert.equal(await page.locator('#rack-count').textContent(),'2 / 7');
  await page.locator('#score-btn').click();
  assert.match(await page.locator('#log').textContent(),/not balanced/i);
  assert.equal(await page.locator('#modal').getAttribute('open'),null);

  // Correct the last digit; score the complete equation.
  await cell(6,8).click();
  await put('2',6,8);
  assert.equal(await page.locator('#preview-equation').textContent(),'8+4=12');
  await page.locator('#score-btn').click();
  await page.locator('#modal[open]').waitFor({timeout:5000});
  assert.match(await page.locator('#modal-title').textContent(),/energy/i);
  assert.match(await page.locator('.equation-result').textContent(),/8\+4=12/);
  await page.locator('#modal-actions button').first().click();
  assert.equal(await page.locator('#turn').textContent(),'2 / 6');
  assert.equal(await page.locator('#rack .tile').count(),7);
  assert.equal(await page.locator('#rack-count').textContent(),'7 / 7');
  assert.equal(await cell(6,6).getAttribute('data-locked'),'true');

  // Mouse drag a tile from the rack, then relocate it and undo.
  await drag(page.locator('#rack .tile:not(.wildcard)').first(),cell(5,10));
  assert.match(await cell(5,10).getAttribute('class'),/pending/);
  assert.equal(await page.locator('#rack-count').textContent(),'6 / 7');
  await drag(cell(5,10),cell(5,11));
  assert.match(await cell(5,11).getAttribute('class'),/pending/);
  assert.doesNotMatch(await cell(5,10).getAttribute('class'),/pending/);
  // Drag a board tile directly back into the rack, preserving the physical tile.
  await drag(cell(5,11),page.locator('#rack .tile').first());
  assert.doesNotMatch(await cell(5,11).getAttribute('class'),/pending/);
  assert.equal(await page.locator('#rack-count').textContent(),'7 / 7');
  const beforeOrder=await page.locator('#rack .tile').evaluateAll(tiles=>tiles.map(t=>t.dataset.tileId));
  await drag(page.locator('#rack .tile').first(),page.locator('#rack .tile').last());
  const afterOrder=await page.locator('#rack .tile').evaluateAll(tiles=>tiles.map(t=>t.dataset.tileId));
  assert.notDeepEqual(beforeOrder,afterOrder,'dragging within the rack should reorder tiles');
  assert.deepEqual([...beforeOrder].sort(),[...afterOrder].sort(),'reordering must preserve all physical tiles');

  // Drag and undo a second tile.
  await drag(page.locator('#rack .tile:not(.wildcard)').first(),cell(5,10));
  assert.match(await cell(5,10).getAttribute('class'),/pending/);
  await page.locator('#undo-last-btn').click();
  assert.equal(await page.locator('#rack-count').textContent(),'7 / 7');

  // Touch-style PointerEvents must also place physical tiles without native DnD.
  const touchResult=await page.evaluate(()=>{
    const src=document.querySelector('#rack .tile:not(.wildcard)');
    const dst=document.querySelector('.cell[data-index="'+(4*13+10)+'"]');
    const a=src.getBoundingClientRect(),b=dst.getBoundingClientRect();
    const p=(x,y)=>({bubbles:true,cancelable:true,pointerId:92,pointerType:'touch',isPrimary:true,button:0,clientX:x,clientY:y});
    src.dispatchEvent(new PointerEvent('pointerdown',p(a.x+a.width/2,a.y+a.height/2)));
    window.dispatchEvent(new PointerEvent('pointermove',p(b.x+b.width/2,b.y+b.height/2)));
    window.dispatchEvent(new PointerEvent('pointerup',p(b.x+b.width/2,b.y+b.height/2)));
    return dst.dataset.index;
  });
  assert.equal(touchResult,String(boardIndex(4,10)));
  assert.match(await cell(4,10).getAttribute('class'),/pending/);
  await page.locator('#undo-last-btn').click();

  // A blank operator can be programmed and returned to the rack.
  await selectRackTile('◇');
  await cell(4,9).click();
  await page.locator('#wildcard-choices button', {hasText:'+'}).first().click();
  assert.equal(await cell(4,9).locator('.board-tile').textContent(),'+0');
  await drag(cell(4,9),page.locator('#rack .tile').first());
  assert.equal(await page.locator('#rack-count').textContent(),'7 / 7');
  assert.ok(await page.locator('#rack .wildcard-blank-operator').count()>=1);

  // Roving keyboard focus and free equals signs.
  await cell(6,6).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(()=>document.activeElement?.dataset.index),String(boardIndex(6,7)));
  await page.keyboard.press('=');
  await cell(5,9).click();
  assert.match(await cell(5,9).getAttribute('class'),/pending/);
  assert.equal(await page.locator('#rack-count').textContent(),'7 / 7');
  await page.locator('#undo-last-btn').click();

  // The entire board and rack should fit without document vertical scrolling
  // on ordinary school laptops.
  for(const size of [{width:1366,height:768},{width:1024,height:768},{width:1280,height:720}]){
    await page.setViewportSize(size);
    const geometry=await page.evaluate(()=>{
      const board=document.querySelector('.board-frame').getBoundingClientRect();
      const rack=document.querySelector('.rack-row').getBoundingClientRect();
      return {boardWidth:board.width,rackBottom:rack.bottom,scrollHeight:document.documentElement.scrollHeight,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,width:innerWidth};
    });
    console.log('Layout',size,geometry);
    assert.ok(geometry.boardWidth>=(size.height>=768?490:455),'board should gain substantial space after moving the preview');
    assert.ok(geometry.rackBottom<=geometry.height-20,'rack must remain on screen');
    assert.ok(geometry.scrollHeight<=geometry.height+3,'desktop should not need vertical scrolling');
    assert.ok(geometry.scrollWidth<=geometry.width+3,'desktop should not need horizontal scrolling');
    await page.screenshot({path:'/tmp/equanova-'+size.width+'x'+size.height+'.png'});
  }
  for(const size of [{width:390,height:844},{width:768,height:1024}]){
    await page.setViewportSize(size);
    const geometry=await page.evaluate(()=>{
      const board=document.querySelector('.board-frame').getBoundingClientRect();
      const rack=document.querySelector('.rack-row').getBoundingClientRect();
      const scoreBtn=document.querySelector('#score-btn').getBoundingClientRect();
      const scoreLabel=document.querySelector('#score').getBoundingClientRect();
      return {boardWidth:board.width,rackBottom:rack.bottom,scoreButtonBottom:scoreBtn.bottom,scoreLabelTop:scoreLabel.top,scrollWidth:document.documentElement.scrollWidth,width:innerWidth};
    });
    console.log('Narrow layout',size,geometry);
    assert.ok(geometry.boardWidth>=250,'board should retain readable dimensions');
    assert.ok(geometry.scrollWidth<=geometry.width+3,'no horizontal scrolling');
    if(size.width===390){
      assert.ok(geometry.rackBottom<=size.height,'board and rack should fit above the fold');
      assert.ok(geometry.scoreButtonBottom<=size.height-20,'score command must be visible without scrolling on phones');
      assert.ok(geometry.scoreLabelTop>=0&&geometry.scoreLabelTop<size.height,'energy readout must be visible');
    }
    if(size.width===768)assert.ok(geometry.boardWidth>=430,'portrait tablets need a broader board');
    await page.screenshot({path:'/tmp/equanova-'+size.width+'x'+size.height+'.png'});
  }
  assert.deepEqual(pageErrors,[]);
  console.log('Browser smoke passed: calculation rule, configurable blanks, scoring, board/rack drags, reordering, keyboard and enlarged-board layout.');
}finally{
  await browser.close();
}
