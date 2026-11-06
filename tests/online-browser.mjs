import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {makeOnlineLobby,joinOnlineLobby,startOnlineMatch,takeOnlineAction,
  timeOutOnlineTurn,viewOnlineRoom,leaveOnlineLobby,updateOnlinePilot,OnlineError} from '../src/online-rules.js';
import {defaultPilotAlien} from '../src/alien/profiles.js';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const hostContext=await browser.newContext({viewport:{width:1366,height:768}});
const guestContext=await browser.newContext({viewport:{width:1366,height:768}});
const host=await hostContext.newPage(),guest=await guestContext.newPage();
const errors=[];
for(const page of [host,guest])page.on('pageerror',err=>errors.push(err.message));
const backend={room:null,auth:new Map(),created:0,joined:0,actions:0};
const headers={
 'Access-Control-Allow-Origin':'http://127.0.0.1:4173',
 'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
 'Access-Control-Allow-Headers':'Authorization, Content-Type',
 'Cache-Control':'no-store'
};
function makeGoodRack(room){
 const rack=[...room.match.players[0].rack],bag=[...room.match.bag],
  wanted=['8','+','4','1','2'],reserved=new Set();
 for(const value of wanted){
   const available=rack.findIndex((tile,i)=>!reserved.has(i)&&tile.value===value&&!tile.blank);
   if(available>=0){reserved.add(available);continue;}
   const from=bag.findIndex(tile=>tile.value===value&&!tile.blank);
   assert.ok(from>=0);
   const chosen=bag.splice(from,1)[0];
   const slot=rack.findIndex((tile,i)=>!reserved.has(i)&&!wanted.includes(tile.value));
   const replace=slot>=0?slot:rack.findIndex((tile,i)=>!reserved.has(i));
   assert.ok(replace>=0);
   bag.push(rack[replace]);rack[replace]=chosen;reserved.add(replace);
 }
 return {...room,match:{...room.match,bag,players:room.match.players.map((p,i)=>
   i===0?{...p,rack}:p)}};
}
async function routeApi(route){
 const req=route.request(),url=new URL(req.url()),method=req.method();
 if(method==='OPTIONS'){
   return route.fulfill({status:204,headers});
 }
 const parts=url.pathname.split('/').filter(Boolean);
 let body={};try{body=req.postDataJSON()||{};}catch{}
 const bearer=(req.headers().authorization||'').replace(/^Bearer /,'');
 const hash=backend.auth.get(bearer);
 let result={},status=200;
 try{
   if(parts.length===2&&method==='POST'){
     backend.created++;
     backend.room=makeOnlineLobby({code:'GHJKLM',hostName:body.name,
       hostHash:'a'.repeat(64),hostAvatar:body.avatar,maxPlayers:body.maxPlayers,
       turnSeconds:body.turnSeconds,now:Date.now()});
     const token='A'.repeat(43);backend.auth.set(token,'a'.repeat(64));
     result={room:viewOnlineRoom(backend.room,'a'.repeat(64)),token};
     status=201;
   }else if(parts.length===4){
     if(parts[2]!=='GHJKLM')throw new OnlineError('Unknown room.',404);
     const op=parts[3];
     const clock=Date.now();
     const t=timeOutOnlineTurn(backend.room,clock);
     if(t.changed)backend.room=t.room;
     if(op==='join'){
       backend.joined++;
       backend.room=joinOnlineLobby(backend.room,body.name,'b'.repeat(64),clock,body.avatar);
       const token='B'.repeat(43);backend.auth.set(token,'b'.repeat(64));
       result={room:viewOnlineRoom(backend.room,'b'.repeat(64)),token};
       status=201;
     }else if(op==='state'){
       result={room:viewOnlineRoom(backend.room,hash,clock)};
     }else if(op==='profile'){
       const next=updateOnlinePilot(backend.room,hash,body,clock);
       backend.room=next.room;
       result={room:viewOnlineRoom(backend.room,hash),event:next.result};
     }else if(op==='start'){
       const next=startOnlineMatch(backend.room,hash,body,clock,()=>0.37);
       backend.room=makeGoodRack(next.room);
       result={room:viewOnlineRoom(backend.room,hash),event:next.result};
     }else if(op==='action'){
       const next=takeOnlineAction(backend.room,hash,body,clock,()=>0.37);
       backend.actions++;backend.room=next.room;
       result={room:viewOnlineRoom(backend.room,hash),event:next.result};
     }else if(op==='leave'){
       const next=leaveOnlineLobby(backend.room,hash,body,clock);
       backend.room=next.room;result={left:true,revision:backend.room.revision};
     }else throw new OnlineError('Not found.',404);
   }else throw new OnlineError('Not found.',404);
 }catch(err){
   status=err.status||500;result={error:err.message||'Unavailable'};
 }
 await route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(result)});
}
for(const context of [hostContext,guestContext])
 await context.route('http://127.0.0.1:8787/api/**',routeApi);

const cell=(page,r,c)=>page.locator('.cell[data-index="'+(13*r+c)+'"]');
async function place(page,symbol,r,c){
 if(symbol==='=')await page.locator('#equals-tile').click();
 else await page.locator('#rack .tile').evaluateAll((buttons,value)=>{
   const b=buttons.find(el=>el.querySelector('span')?.textContent===value);
   if(!b)throw Error('Missing local player tile '+value);
   b.click();
 },symbol);
 await cell(page,r,c).click();
}
const active=page=>page.locator('#online-score').isEnabled();

try{
 await host.goto('http://127.0.0.1:4173/online.html',{waitUntil:'domcontentloaded'});
 assert.equal(await host.locator('#online-gate').isVisible(),true);
 assert.equal(await host.locator('#online-alien-presets button').count(),4);
 await host.locator('#online-alien-presets [data-preset="glimmer"]').click();
 assert.equal(await host.locator('#online-alien-presets [data-preset="glimmer"]').getAttribute('aria-pressed'),'true');
 await host.locator('#online-host-name').fill('Ari');
 await host.locator('#online-player-limit').selectOption('2');
 await host.locator('#online-timer-settings').selectOption('90');
 await host.locator('#online-create-button').click();
 await host.locator('#lobby-code').getByText('GHJKLM').waitFor({timeout:5000}).catch(async()=>{
   await host.locator('#lobby-code').waitFor();
 });
 assert.equal(await host.locator('#lobby-code').textContent(),'GHJKLM');
 assert.equal(await host.locator('#online-lobby').isVisible(),true);
 assert.equal(await host.locator('#online-lobby-players .online-lobby-player').count(),1);
 assert.equal(await host.locator('#online-start-match').isEnabled(),false);
 assert.equal(backend.created,1);
 assert.deepEqual(backend.room.people[0].avatar,defaultPilotAlien(3));
 const hostKey=await host.evaluate(()=>JSON.parse(localStorage.getItem('equa-nova.online-room.v1')));
 assert.equal(hostKey.code,'GHJKLM');assert.equal(hostKey.token,'A'.repeat(43));
 assert.ok(!host.url().includes(hostKey.token),'room access secret must not be in the invitation URL');

 await guest.goto('http://127.0.0.1:4173/online.html#GHJKLM',{waitUntil:'domcontentloaded'});
 assert.equal(await guest.locator('#online-join-code').inputValue(),'GHJKLM');
 await guest.locator('#online-alien-presets [data-preset="orbit"]').click();
 await guest.locator('#online-join-name').fill('Bea');
 await guest.locator('#online-join-button').click();
 await guest.locator('#lobby-code').waitFor();
 assert.equal(await guest.locator('#lobby-code').textContent(),'GHJKLM');
 assert.equal(backend.joined,1);
 assert.deepEqual(backend.room.people[1].avatar,defaultPilotAlien(1));
 // Guest may replace their own public alien before start, without touching
 // the host's identity, timer or private rack.
 await guest.locator('#online-alien-presets [data-preset="niblet"]').click();
 await guest.locator('#online-alien-note').getByText(/visible to the other pilots/i).waitFor({timeout:5000});
 assert.deepEqual(backend.room.people[1].avatar,defaultPilotAlien(2));
 assert.deepEqual(backend.room.people[0].avatar,defaultPilotAlien(3));
 assert.equal(backend.room.phase,'lobby');
 const guestKey=await guest.evaluate(()=>JSON.parse(localStorage.getItem('equa-nova.online-room.v1')));
 assert.equal(guestKey.token,'B'.repeat(43));
 assert.notEqual(guestKey.token,hostKey.token);
 // The rooms use revision-only WebSocket messages. When the test has no
 // WebSocket server, the browser fallback poll synchronises the second player.
 await host.waitForTimeout(7600);
 assert.equal(await host.locator('#online-lobby-players .online-lobby-player').count(),2);
 await host.locator('#online-lobby-players .alien-player-avatar svg').first().waitFor({timeout:12000});
 assert.equal(await host.locator('#online-lobby-players .alien-player-avatar svg').count(),2);
 assert.equal(await host.locator('#online-lobby-players .online-lobby-player').nth(1)
   .locator('[data-layer="head"]').getAttribute('data-part-id'),'pear');
 assert.equal(await host.locator('#online-start-match').isEnabled(),true);
 await host.locator('#online-start-match').click();
 await host.locator('#online-gate').waitFor({state:'hidden'});
 assert.equal(backend.room.phase,'playing');
 assert.deepEqual(backend.room.match.players.map(p=>p.avatar),
  [defaultPilotAlien(3),defaultPilotAlien(2)]);
 assert.equal(await host.locator('#online-scores .alien-player-avatar svg').count(),2);
 assert.equal(await host.locator('#rack .tile').count(),8);
 assert.equal(await host.locator('#online-bag-count').textContent(),'135');
 assert.equal(await active(host),false,'cannot score until an equation is placed');
 assert.equal(backend.room.match.board.length,169);

 await guest.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 await guest.locator('#online-gate').waitFor({state:'hidden'});
 assert.equal(await guest.locator('#rack .tile').count(),8);
 assert.notDeepEqual(
   await host.locator('#rack .tile').evaluateAll(nodes=>nodes.map(n=>n.dataset.tileId).sort()),
   await guest.locator('#rack .tile').evaluateAll(nodes=>nodes.map(n=>n.dataset.tileId).sort()),
   'each authenticated player has a different hand');
 assert.equal(await guest.locator('#online-score').isEnabled(),false,'guest cannot score on host turn');

 // A syntactically complete, incorrect statement is rejected by the backend.
 for(const [s,r,c] of [['8',6,3],['+',6,4],['1',6,5],['=',6,6],['4',6,7],['2',6,8]])
   await place(host,s,r,c);
 assert.equal(await host.locator('#online-expression').textContent(),'8+1=42');
 await host.locator('#online-score').click();
 await host.waitForTimeout(500);
 assert.match(await host.locator('#online-log').textContent(),/not balanced/i);
 assert.equal(backend.room.match.current,0);
 assert.equal(backend.room.match.players[0].score,0);
 // Edit the unsent tiles locally without consuming points or a turn.
 await host.locator('#online-clear').click();
 for(const [s,r,c] of [['8',6,3],['+',6,4],['4',6,5],['=',6,6],['1',6,7],['2',6,8]])
   await place(host,s,r,c);
 assert.equal(await host.locator('#online-expression').textContent(),'8+4=12');
 await host.locator('#online-score').click();
 await host.locator('#ceremony-readout').waitFor({state:'visible',timeout:2500});
 assert.equal(backend.room.match.current,1);
 assert.ok(backend.room.match.players[0].score>0);
 await host.locator('#skip-ceremony').click();
 assert.match(await host.locator('#online-dialog-title').textContent(),/points/i);
 await host.locator('#online-dialog-actions button').first().click();
 assert.equal(await active(host),false,'host cannot score twice in a row');

 // Reconnection restores only the host's own private rack and the shared board.
 await host.reload({waitUntil:'domcontentloaded'});
 await host.locator('#online-gate').waitFor({state:'hidden'});
 assert.equal(await host.locator('#rack .tile').count(),8);
 assert.equal(await cell(host,6,6).getAttribute('data-locked'),'true');
 assert.equal(backend.room.match.players[1].score,0);
 const hostPrivateIds=backend.room.match.players[0].rack.map(t=>t.id);
 const guestPrivateIds=backend.room.match.players[1].rack.map(t=>t.id);
 const hostDisplayed=await host.locator('#rack .tile').evaluateAll(nodes=>nodes.map(n=>n.dataset.tileId));
 assert.ok(hostDisplayed.every(id=>hostPrivateIds.includes(id)));
 assert.ok(hostDisplayed.every(id=>!guestPrivateIds.includes(id)),
   'host must not receive any opponent rack tiles');

 await guest.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 assert.equal(await guest.locator('#online-pass').isEnabled(),true);
 await guest.locator('#online-pass').click();
 assert.equal(backend.room.match.current,0);
 await host.waitForTimeout(7600);
 assert.equal(await host.locator('#online-pass').isEnabled(),true);
 await host.locator('#online-pass').click();
 await guest.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
 await guest.locator('#online-pass').click();
 await host.waitForTimeout(7600);
 await host.locator('#online-pass').click();
 assert.equal(backend.room.phase,'finished');
 assert.equal(backend.room.match.finalScores.length,2);
 assert.equal(backend.room.match.finalScores[0].net,
   backend.room.match.finalScores[0].gross-backend.room.match.finalScores[0].penalty);
 await host.locator('#online-dialog-title').getByText(/final standings/i).waitFor({timeout:4000}).catch(()=>{});
 assert.equal(await host.locator('.online-result').count(),2);
 assert.equal(await host.locator('.online-result .alien-player-avatar svg').count(),2);
 assert.equal(await host.locator('.online-result').first().locator('[data-layer="head"]').count(),1);
 await host.locator('#online-dialog-close').click();
 await host.setViewportSize({width:390,height:844});
 const mobile=await host.evaluate(()=>({
   width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
   boardWidth:document.querySelector('#board-frame').getBoundingClientRect().width,
   bagRight:document.querySelector('#online-bag').getBoundingClientRect().right,
   scoreBottom:document.querySelector('#online-score').getBoundingClientRect().bottom
 }));
 assert.ok(mobile.scrollWidth<=mobile.width+3,'online mode must not overflow on mobile');
 assert.ok(mobile.boardWidth>=335);
 assert.ok(mobile.bagRight<=mobile.width+3);
 assert.ok(mobile.scoreBottom<=844,'primary buttons must be visible above phone fold');
 assert.deepEqual(errors,[]);
 console.log('Online two-device browser passed: create, join, host start, private racks, server rejection, BIDMAS scoring, reconnect, timers, game over, mobile.');
}finally{
 await hostContext.close();await guestContext.close();await browser.close();
}
