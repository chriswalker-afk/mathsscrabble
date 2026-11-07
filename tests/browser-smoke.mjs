import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {installKnownRack} from './opening-fixture.mjs';

const base='http://127.0.0.1:4173/play.html?mode=sector';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1});
const pageErrors=[];
page.on('pageerror',error=>pageErrors.push(error.message));
const boardIndex=(r,c)=>(r+3)*19+(c+3);
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
  // First-visit guide must be explicit, dismissible and not lose the opening rack.
  assert.equal(await page.locator('#modal[open]').count(),1);
  assert.match(await page.locator('#modal-title').textContent(),/first equation/i);
  assert.match(await page.locator('.training-steps').textContent(),/BIDMAS/i);
  await page.locator('#modal-actions button').last().click();
  await installKnownRack(page,'sector');
  const initialSave=await page.evaluate(()=>localStorage.getItem('equa-nova.sector-run.v1'));
  assert.ok(initialSave?.length>1000,'the initial run should be saved');
  assert.match(await page.locator('#save-status').textContent(),/autosaved/i);
  assert.equal(await page.locator('.cell').count(),361);
  assert.equal(await page.locator('#rack .tile').count(),8);
   assert.equal(await page.locator('#score-btn').evaluate(x=>Boolean(x.closest('.rack-commit-actions'))),true);
   assert.equal(await page.locator('#swap-btn').evaluate(x=>Boolean(x.closest('.rack-commit-actions'))),true);
   assert.equal(await page.locator('#undo-btn').evaluate(x=>Boolean(x.closest('.rack-actions'))),true);
   const initialOrder=await page.locator('#rack .tile').evaluateAll(tiles=>tiles.map(t=>t.dataset.tileId));
   await page.locator('#shuffle-rack-btn').click();
   const shuffledOrder=await page.locator('#rack .tile').evaluateAll(tiles=>tiles.map(t=>t.dataset.tileId));
   assert.notDeepEqual(shuffledOrder,initialOrder,'new shuffle button must actually reorder tiles');
   assert.deepEqual([...shuffledOrder].sort(),[...initialOrder].sort());
  assert.equal(await page.locator('#bag-count').textContent(),String(143));
  assert.equal(await page.locator('#preview-equation').textContent(),'—');
  assert.equal(await page.locator('.arena-topline').count(),0);
  assert.equal(await page.locator('.right-panel').count(),0,'the redundant right console is removed');
   assert.equal(await page.locator('.left-panel > #equation-preview').count(),1,'equation feedback stays at the top of telemetry');
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
  assert.equal(await page.locator('#rack .tile').count(),8);

  // Enter an intentionally incorrect equation; preview must never reveal its truth.
  const placements=[['8',6,3],['+',6,4],['4',6,5],['=',6,6],['1',6,7]];
  for(const [symbol,row,col] of placements)await put(symbol,row,col);
  await selectRackTile('✦');
  await cell(6,8).click();
  await page.locator('#wildcard-choices button', {hasText:'3'}).first().click();
  assert.equal(await page.locator('#preview-equation').textContent(),'8+4=13');
  assert.match(await page.locator('#preview-status').textContent(),/submit to check BIDMAS/i);
  assert.match(await page.locator('#potential-score').textContent(),/^\+\d+$/);
  assert.equal(await page.locator('#rack-count').textContent(),'3 / 8');
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
  assert.equal(await page.locator('#rack .tile').count(),8);
  assert.equal(await page.locator('#rack-count').textContent(),'8 / 8');
  assert.equal(await cell(6,6).getAttribute('data-locked'),'true');

  // Mouse drag a tile from the rack, then relocate it and undo.
  await drag(page.locator('#rack .tile:not(.wildcard)').first(),cell(5,10));
  assert.match(await cell(5,10).getAttribute('class'),/pending/);
  assert.equal(await page.locator('#rack-count').textContent(),'7 / 8');
  // An unfinished placement and all other rack tiles must survive a page refresh.
  const pendingTile=await cell(5,10).locator('.board-tile').textContent();
  await page.reload({waitUntil:'networkidle'});
  assert.equal(await page.locator('#modal[open]').count(),0,'welcome should only appear on first visit');
  assert.equal(await cell(5,10).locator('.board-tile').textContent(),pendingTile);
  assert.equal(await page.locator('#rack-count').textContent(),'7 / 8');
  assert.match(await page.locator('#log').textContent(),/restored/i);
  await drag(cell(5,10),cell(5,11));
  assert.match(await cell(5,11).getAttribute('class'),/pending/);
  assert.doesNotMatch(await cell(5,10).getAttribute('class'),/pending/);
  // Drag a board tile directly back into the rack, preserving the physical tile.
  await drag(cell(5,11),page.locator('#rack .tile').first());
  assert.doesNotMatch(await cell(5,11).getAttribute('class'),/pending/);
  assert.equal(await page.locator('#rack-count').textContent(),'8 / 8');
  const beforeOrder=await page.locator('#rack .tile').evaluateAll(tiles=>tiles.map(t=>t.dataset.tileId));
  await drag(page.locator('#rack .tile').first(),page.locator('#rack .tile').last());
  const afterOrder=await page.locator('#rack .tile').evaluateAll(tiles=>tiles.map(t=>t.dataset.tileId));
  assert.notDeepEqual(beforeOrder,afterOrder,'dragging within the rack should reorder tiles');
  assert.deepEqual([...beforeOrder].sort(),[...afterOrder].sort(),'reordering must preserve all physical tiles');

  // Drag and undo a second tile.
  await drag(page.locator('#rack .tile:not(.wildcard)').first(),cell(5,10));
  assert.match(await cell(5,10).getAttribute('class'),/pending/);
  await page.locator('#undo-last-btn').click();
  assert.equal(await page.locator('#rack-count').textContent(),'8 / 8');

  // Touch-style PointerEvents must also place physical tiles without native DnD.
  const touchResult=await page.evaluate(()=>{
    const src=document.querySelector('#rack .tile:not(.wildcard)');
    const dst=document.querySelector('.cell[data-index="'+((4+3)*19+(10+3))+'"]');
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
  assert.equal(await cell(4,9).locator('.board-tile').textContent(),'+');
  assert.equal(await page.locator('#board .board-tile sup').count(),0,
    'board glyphs should not contain tiny score overlays');
  await drag(cell(4,9),page.locator('#rack .tile').first());
  assert.equal(await page.locator('#rack-count').textContent(),'8 / 8');
  assert.ok(await page.locator('#rack .wildcard-blank-operator').count()>=1);

  // Roving keyboard focus and free equals signs.
  await cell(6,6).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(()=>document.activeElement?.dataset.index),String(boardIndex(6,7)));
  await page.keyboard.press('=');
  await cell(5,9).click();
  assert.match(await cell(5,9).getAttribute('class'),/pending/);
  assert.equal(await page.locator('#rack-count').textContent(),'8 / 8');
  await put('=',5,10);
  await cell(5,9).focus();
  await page.keyboard.press('Backspace');
  assert.doesNotMatch(await cell(5,9).getAttribute('class'),/pending/);
  assert.match(await cell(5,10).getAttribute('class'),/pending/,
    'keyboard Backspace should remove one tile, not perform a second global undo');
  await page.locator('#undo-last-btn').click();

  // The entire board and rack should fit without document vertical scrolling
  // on ordinary school laptops.
  for(const size of [{width:1366,height:768},{width:1024,height:768},{width:1280,height:720}]){
    await page.setViewportSize(size);
    const geometry=await page.evaluate(()=>{
      const board=document.querySelector('.board-frame').getBoundingClientRect();
      const rack=document.querySelector('.rack-row').getBoundingClientRect();
      const font=parseFloat(getComputedStyle(document.querySelector('.board-tile')).fontSize);
      return {boardWidth:board.width,boardFont:font,rackBottom:rack.bottom,scrollHeight:document.documentElement.scrollHeight,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,width:innerWidth};
    });
    console.log('Layout',size,geometry);
    const minimum=size.height>=768?575:520;
    assert.ok(geometry.boardWidth>=minimum,'board must be legible and enlarged on classroom laptops');
    assert.ok(geometry.boardFont>=18,'unzoomed 19×19 tiles must remain recognizable');
    const currentBoardWidth=geometry.boardWidth;
    await page.locator('#board-zoom-in').click();
    await page.locator('#board-zoom-in').click();
    const zoomed=await page.evaluate(()=>({
      font:parseFloat(getComputedStyle(document.querySelector('.board-tile')).fontSize),
      frameWidth:document.querySelector('.board-frame').getBoundingClientRect().width
    }));
    assert.ok(zoomed.font>=24,'zoom controls should enlarge mathematical glyphs on demand');
    assert.equal(zoomed.frameWidth,currentBoardWidth,'zoom must not enlarge the board frame');
    await page.locator('#board-zoom-out').click();
    await page.locator('#board-zoom-out').click();
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
      const preview=document.querySelector('#equation-preview').getBoundingClientRect();
      return {boardWidth:board.width,rackBottom:rack.bottom,scoreButtonBottom:scoreBtn.bottom,scoreLabelTop:scoreLabel.top,previewBottom:preview.bottom,scrollWidth:document.documentElement.scrollWidth,width:innerWidth};
    });
    console.log('Narrow layout',size,geometry);
    assert.ok(geometry.boardWidth>=250,'board should retain readable dimensions');
    assert.ok(geometry.scrollWidth<=geometry.width+3,'no horizontal scrolling');
    if(size.width===390){
      assert.ok(await page.locator('#run-report-header').isVisible(),'compact screens need an accessible run-report button');
      assert.ok(geometry.rackBottom<=size.height,'board and rack should fit above the fold');
      assert.ok(geometry.scoreButtonBottom<=size.height-20,'score command must be visible without scrolling on phones');
      assert.ok(geometry.previewBottom<=size.height-4,'equation preview should fit on one mobile screen');
      assert.ok(geometry.scoreLabelTop>=0&&geometry.scoreLabelTop<size.height,'energy readout must be visible');
    }
    if(size.width===768)assert.ok(geometry.boardWidth>=620,'portrait tablets must give priority to the board');
    await page.screenshot({path:'/tmp/equanova-'+size.width+'x'+size.height+'.png'});
  }
  // New run replaces the current save after confirmation.
  await page.locator('#new-btn').click();
  assert.match(await page.locator('#modal-title').textContent(),/new run/i);
  await page.locator('#modal-actions button').last().click();
  assert.equal(await page.locator('#turn').textContent(),'1 / 6');
  assert.equal(await page.locator('#score').textContent(),'0');
  assert.equal(await page.locator('#run-summary').textContent(),'0 sectors · 0 energy');
  const firstNew=JSON.parse(await page.evaluate(()=>localStorage.getItem('equa-nova.sector-run.v1')));
  await page.locator('#new-btn').click();
  await page.locator('#modal-actions button').last().click();
  const secondNew=JSON.parse(await page.evaluate(()=>localStorage.getItem('equa-nova.sector-run.v1')));
  assert.notEqual(firstNew.rack.map(t=>t.blank||t.value).join('|'),
    secondNew.rack.map(t=>t.blank||t.value).join('|'),
    'consecutive new Solo games must have distinct visible opening racks');
  assert.notEqual(firstNew.bag.map(t=>t.blank||t.value).join('|'),
    secondNew.bag.map(t=>t.blank||t.value).join('|'),
    'each new Solo game must reshuffle its remaining bag draw sequence');


  // Simulate an unfinished final turn at 39/40 energy, then score a genuine
  // tutorial equation. The save must be committed before the 420 ms animation.
  await page.evaluate(raw=>{
    const data=JSON.parse(raw);
    data.turn=6;data.score=39;data.phase='playing';data.stats={
      attempts:0,freeExchanges:0,paidExchanges:0,moves:[]
    };
    localStorage.setItem('equa-nova.sector-run.v1',JSON.stringify(data));
  },initialSave);
  await page.reload({waitUntil:'networkidle'});
  assert.equal(await page.locator('#turn').textContent(),'6 / 6');
  for(const [symbol,row,col] of [['8',6,3],['+',6,4],['4',6,5],['=',6,6],['1',6,7]])await put(symbol,row,col);
  await selectRackTile('✦');
  await cell(6,8).click();
  await page.locator('#wildcard-choices button', {hasText:'2'}).first().click();
  await page.locator('#score-btn').click();
  // Refresh *before* the score animation finishes.
  await page.reload({waitUntil:'networkidle'});
  assert.equal(await page.locator('#turn').textContent(),'6 / 6');
  assert.match(await page.locator('#modal-title').textContent(),/sector 1 complete/i);
  const restoredWinScore=Number(await page.locator('#score').textContent());
  assert.ok(restoredWinScore>=40,'the finishing equation stabilises the sector');
  assert.equal(await page.locator('#run-summary').textContent(),'1 sector · '+restoredWinScore+' energy');
  await page.locator('#modal-actions button').last().click();
  assert.equal(await page.locator('#sector-label').textContent(),'SECTOR 02 · POLARIS');
  assert.equal(await page.locator('#turn').textContent(),'1 / 6');
  assert.ok((await page.locator('#rack .tile.wildcard').count())>=1);
  await page.reload({waitUntil:'networkidle'});
  assert.equal(await page.locator('#sector-label').textContent(),'SECTOR 02 · POLARIS');
  assert.equal(await page.locator('#run-summary').textContent(),'1 sector · '+restoredWinScore+' energy');

  // Report can be reopened without changing the current sector.
  await page.locator('#run-report-header').click();
  assert.match(await page.locator('#modal-title').textContent(),/reactor run/i);
  assert.match(await page.locator('.sector-report').textContent(),/S1/);
  await page.locator('#modal-actions button').last().click();
  await page.setViewportSize({width:1366,height:768});
  await page.locator('#run-report-btn').click();
  assert.match(await page.locator('#modal-title').textContent(),/reactor run/i);
  await page.locator('#modal-actions button').last().click();

  // Damaged browser storage must fall back to a clean new run.
  await page.evaluate(()=>localStorage.setItem('equa-nova.sector-run.v1','{corrupted'));
  await page.reload({waitUntil:'networkidle'});
  assert.equal(await page.locator('#sector-label').textContent(),'SECTOR 01 · ORIGIN');
  assert.equal(await page.locator('#turn').textContent(),'1 / 6');
  assert.equal(await page.locator('#modal[open]').count(),0);

  assert.deepEqual(pageErrors,[]);
  console.log('Browser smoke passed: intro, autosave/resume, scoring atomicity, sector progression, rack interaction, keyboard and responsive layout.');
}finally{
  await browser.close();
}
