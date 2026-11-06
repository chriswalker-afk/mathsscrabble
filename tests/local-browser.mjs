import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1366,height:768}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
const cell=(r,c)=>page.locator('.cell[data-index="'+(13*r+c)+'"]');
const getMatch=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('equa-nova.local-match.v1')));
async function place(symbol,r,c){
 if(symbol==='=')await page.locator('#equals-tile').click();
 else await page.locator('#rack .tile').evaluateAll((buttons,value)=>{
   const target=buttons.find(el=>el.querySelector('span')?.textContent===value);
   if(!target)throw Error('Missing physical tile '+value);
   target.click();
 },symbol);
 await cell(r,c).click();
}
async function installKnownLocalRack(){
 await page.evaluate(()=>{
   const key='equa-nova.local-match.v1';
   const match=JSON.parse(localStorage.getItem(key));
   const supply=[...match.players[0].rack,...match.bag];
   const wanted=['8','+','4','1','2'];
   const prepared=[];
   for(const type of wanted){
     const at=supply.findIndex(t=>!t.blank&&t.value===type);
     if(at<0)throw Error('Fixture missing '+type);
     prepared.push(supply.splice(at,1)[0]);
   }
   for(const pool of ['numbers','operators','operators']){
     const at=supply.findIndex(t=>pool==='operators'
       ?t.blank==='blank-operator'||['+','−','×','÷'].includes(t.value)
       :t.blank!=='blank-operator'&&!['+','−','×','÷'].includes(t.value));
     if(at<0)throw Error('Fixture missing '+pool+' supply');
     prepared.push(supply.splice(at,1)[0]);
   }
   match.players[0].rack=prepared;match.bag=supply;
   localStorage.setItem(key,JSON.stringify(match));
 });
 await page.reload({waitUntil:'networkidle'});
}
async function handover(expected){
 assert.equal(await page.locator('#local-privacy').isVisible(),true);
 assert.match(await page.locator('#local-handover-title').textContent(),new RegExp(expected,'i'));
 assert.equal(await page.locator('#app').getAttribute('inert'),'');
 assert.equal(await page.locator('#rack .tile').count(),0,'no hand should be visible between turns');
 assert.equal(await page.locator('#local-ready-btn').isVisible(),true);
}
async function ready(expected,visibleTiles=8){
 await handover(expected);
 await page.locator('#local-ready-btn').click();
 assert.equal(await page.locator('#local-privacy').isVisible(),false);
 assert.equal(await page.locator('#app').getAttribute('inert'),null);
 assert.equal(await page.locator('#rack .tile').count(),visibleTiles);
}
try{
 await page.goto('http://127.0.0.1:4173/play.html?mode=sector',{waitUntil:'networkidle'});
 await page.locator('.cell').first().waitFor();
 if(await page.locator('#modal[open]').count())await page.locator('#modal-actions button').last().click();
 const solo=JSON.parse(await page.evaluate(()=>localStorage.getItem('equa-nova.sector-run.v1')));
 assert.ok(solo);
 await page.locator('#mode-btn').click();
 await page.locator('#home-local').click();
 assert.match(await page.locator('#modal-title').textContent(),/local match/i);
 await page.locator('#local-player-count').selectOption('3');
 assert.equal(await page.locator('#local-setup-names input:visible').count(),3);
 assert.equal(await page.locator('.local-pilot-setup:visible').count(),3);
 await page.locator('#local-alien-0').selectOption('glimmer');
 await page.locator('#local-alien-1').selectOption('orbit');
 await page.locator('#local-alien-2').selectOption('niblet');
 const names=['Ari','Bea','Cy'];
 for(const [i,name] of names.entries())await page.locator('#local-setup-names input').nth(i).fill(name);
 await page.locator('#local-turn-seconds').selectOption('60');
 await page.locator('#modal-actions button').last().click();
 await handover('Ari');
 let initial=await getMatch();
 assert.equal(initial.players.length,3);
 assert.equal(initial.bag.length,127);
 assert.equal(initial.phase,'handover');
 assert.equal(initial.turnSeconds,60);
 assert.deepEqual(initial.players.map(p=>p.avatar.head),['jelly','facet','pear']);
 await page.locator('#local-handover-avatar svg').waitFor({timeout:16000});
 assert.equal(await page.locator('#local-handover-avatar [data-layer="head"]').getAttribute('data-part-id'),'jelly');
 const firstPattern=initial.players[0].rack.map(t=>t.blank||t.value).join('|');
 const firstBagOrder=initial.bag.map(t=>t.blank||t.value).join('|');
 assert.equal(initial.players.every(p=>p.rack.length===8),true);
 await installKnownLocalRack();
 await ready('Ari');
 assert.match(await page.locator('#local-time-remaining').textContent(),/^\d\d:\d\d$/);
 assert.equal(await page.locator('#bag-count').textContent(),'127');
 await page.locator('#bag-details-btn').click();
 assert.equal(await page.locator('.bag-overview-total>strong').textContent(),'127');
 await page.locator('#modal-actions button').last().click();
 for(const [s,r,c] of [['8',6,3],['+',6,4],['4',6,5],['=',6,6],['1',6,7],['2',6,8]])
   await place(s,r,c);
 assert.equal(await page.locator('#preview-equation').textContent(),'8+4=12');
 await page.locator('#score-btn').click();
 assert.equal(await page.locator('#ceremony-readout').isVisible(),true);
 const scored=await getMatch();
 assert.equal(scored.phase,'handover');
 assert.equal(scored.current,1);
 assert.ok(scored.players[0].score>0);
 assert.equal(scored.players[1].score,0);
 assert.equal(scored.board[13*6+6].value,'=');
 assert.equal(scored.consecutiveStalls,0);
 assert.equal(scored.bag.length,122);
 await page.locator('#skip-ceremony').click();
 assert.match(await page.locator('#modal-title').textContent(),/energy/i);
 await page.locator('#modal-actions button').last().click();
 await handover('Bea');
 assert.equal(await page.locator('#local-panel .local-score-row').count(),3);
 await page.locator('#local-panel .local-score-row .alien-player-avatar svg').first().waitFor({state:'attached',timeout:12000});
 assert.equal(await page.locator('#local-panel .local-score-row .alien-player-avatar svg').count(),3);
 assert.equal(await page.locator('#local-panel .local-scores').isVisible(),false,
   'handover must conceal the previous turn scoreboard and rack');

 // After one scored turn, six passes in a three-player game must end the match.
 for(let i=0;i<6;i++){
   const name=names[(i+1)%3];
   await ready(name);
   assert.equal(await page.locator('#turn').textContent(),String(i+2));
   if(i===2){
     // Pending board placements and the private rack survive a refresh, but
     // the rack is hidden again until that same player explicitly presses Ready.
     await page.locator('#rack .tile:not(.wildcard)').first().click();
     await cell(5,10).click();
     assert.equal(await cell(5,10).getAttribute('data-locked'),'false');
     assert.match(await cell(5,10).getAttribute('class'),/pending/);
     await page.reload({waitUntil:'networkidle'});
     await ready(name,7); // one of eight physical tiles is still on the pending board
     assert.match(await cell(5,10).getAttribute('class'),/pending/);
     await page.locator('#undo-btn').click();
     assert.doesNotMatch(await cell(5,10).getAttribute('class'),/pending/);
   }
   await page.locator('#local-pass-btn').click();
   if(i<5)await handover(names[(i+2)%3]);
 }
 const final=await getMatch();
 assert.equal(final.phase,'finished');
 assert.equal(final.finishedReason,'stalled');
 assert.equal(final.history.filter(h=>h.type==='pass').length,6);
 assert.equal(final.finalScores.length,3);
 assert.equal(final.finalScores[0].gross,scored.players[0].score);
 assert.equal(final.finalScores[0].net,final.finalScores[0].gross-final.finalScores[0].penalty);
 assert.equal(await page.locator('#modal-eyebrow').textContent(),'MATCH COMPLETE');
 assert.equal(await page.locator('.local-result-row').count(),3);
 assert.equal(await page.locator('.local-result-row .alien-player-avatar svg').count(),3);
 assert.deepEqual(final.players.map(p=>p.avatar.head),['jelly','facet','pear']);
 assert.match(await page.locator('#modal-body').textContent(),/rack tile values are deducted/i);
 await page.reload({waitUntil:'networkidle'});
 assert.equal(await page.locator('#modal-eyebrow').textContent(),'MATCH COMPLETE');

 // A new match starts with a fresh shuffled bag and opening rack, preserving
 // previous non-multiplayer saves. The same set of player names is retained.
 await page.locator('#modal-actions button').last().click();
 assert.match(await page.locator('#modal-title').textContent(),/set up a local match/i);
 await page.locator('#modal-actions button').last().click();
 await handover('Ari');
 const second=await getMatch();
 assert.equal(second.bag.length,127);
 assert.deepEqual(second.players.map(p=>p.avatar.head),['jelly','facet','pear']);
 assert.notEqual(second.players[0].rack.map(t=>t.blank||t.value).join('|'),firstPattern,
   'the next game should not repeat the previous visible first rack');
 assert.notEqual(second.bag.map(t=>t.blank||t.value).join('|'),firstBagOrder,
   'a new game must have a different shuffled draw sequence');
 const unchangedSolo=JSON.parse(await page.evaluate(()=>localStorage.getItem('equa-nova.sector-run.v1')));
 assert.deepEqual(unchangedSolo.board,solo.board);
 assert.deepEqual(unchangedSolo.rack,solo.rack);

 // When the device is handed over, the hidden rack is not keyboard accessible
 // and players may switch to a previously saved single-player mode.
 await page.locator('#local-switch-btn').click();
 await page.locator('#home-sector').click();
 assert.match(await page.locator('#sector-label').textContent(),/SECTOR 01/);
 assert.equal(await page.locator('#local-privacy').isVisible(),false);
 await page.locator('#mode-btn').click();
 await page.locator('#home-local').click();
 await handover('Ari');

 // Check that the local game panel still fits without horizontal overflow.
 await page.setViewportSize({width:390,height:844});
 await ready('Ari');
 const mobile=await page.evaluate(()=>({
   width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
   bagRight:document.querySelector('#bag-details-btn').getBoundingClientRect().right,
   scoreBottom:document.querySelector('#score-btn').getBoundingClientRect().bottom,
   rackBottom:document.querySelector('.rack-row').getBoundingClientRect().bottom
 }));
 console.log('Local phone geometry',mobile);
 assert.ok(mobile.scrollWidth<=mobile.width+3,'multiplayer should not scroll horizontally');
 assert.equal(await page.locator('#bag-details-btn').isVisible(),true,'In Bag must stay accessible on phones');
 assert.ok(mobile.bagRight<=mobile.width);
 assert.ok(mobile.scoreBottom<=844-10,'primary multiplayer controls must fit a phone screen');
 assert.ok(mobile.rackBottom<mobile.scoreBottom);
 assert.deepEqual(errors,[]);
 console.log('Local multiplayer browser passed: 3 players, private racks, shared equation, score ceremony, passes, match end, reload, random starts and mobile.');
}finally{
 await browser.close();
}
