import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {makeOnlineLobby,joinOnlineLobby,startOnlineMatch,viewOnlineRoom,OnlineError} from '../src/online-rules.js';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const errors=[];
const origin='http://127.0.0.1:4173';
const rand=()=>.37;
const hostHash='a'.repeat(64),guestHash='b'.repeat(64);
const headers={
 'Access-Control-Allow-Origin':origin,
 'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
 'Access-Control-Allow-Headers':'Authorization, Content-Type',
 'Cache-Control':'no-store'
};
const local=await browser.newPage({viewport:{width:390,height:844}});
local.on('pageerror',error=>errors.push('Local: '+error.message));
try{
 await local.goto(origin+'/play.html?mode=local&tiles=rational',{waitUntil:'networkidle'});
 await local.locator('#local-tile-set').waitFor();
 assert.equal(await local.locator('#local-tile-set').inputValue(),'rational');
 await local.locator('#modal-actions button').last().click();
 assert.equal(await local.locator('#local-privacy').isVisible(),true);
 await local.locator('#local-ready-btn').click();
 assert.equal(await local.locator('#rack .tile').count(),11);
 assert.equal(await local.locator('#rack-count').textContent(),'11 / 11');
 assert.equal(await local.locator('#rack .bracket-tile').count(),2);
 assert.ok(await local.locator('#rack .fraction-tile .frac-numerator').count()>=2);
 const first=await local.evaluate(()=>JSON.parse(localStorage.getItem('equa-nova.local-match.v1')));
 assert.equal(first.tileSet,'rational');
 assert.equal(first.bag.length,129);
 assert.ok([...first.bag,...first.players.flatMap(p=>p.rack)].every(t=>
   !(t.value?.startsWith('−')&&t.value?.includes('/'))));
 await local.locator('#swap-btn').click();
 await local.locator('#rack .bracket-tile').first().click();
 assert.equal(await local.locator('#rack .bracket-tile.marked').count(),2);
 await local.locator('#swap-btn').click();
 const changed=await local.evaluate(()=>JSON.parse(localStorage.getItem('equa-nova.local-match.v1')));
 assert.equal(changed.current,1);
 assert.equal(changed.phase,'handover');
 assert.equal(new Set([...changed.bag,...changed.players.flatMap(p=>p.rack)].map(t=>t.id)).size,151);
 assert.equal(await local.locator('#rack .tile').count(),0,'hot-seat handover must hide all tiles');
 await local.locator('#local-switch-btn').click();
 await local.locator('#home-multi').click();
 await local.waitForURL(/choose\.html\?type=multi$/);
 await local.locator('[data-tile-kit="advanced"]').click();
 await local.locator('#setup-game').selectOption('300');
 await local.locator('#launch-button').click();
 await local.waitForURL(/play\.html\?mode=local&tiles=advanced&setup=ready$/);
 assert.equal(await local.locator('#local-privacy').isVisible(),true);
 assert.equal(await local.locator('#local-game-remaining').textContent(),'5 min game');
 await local.locator('#local-ready-btn').click();
 assert.equal(await local.locator('#rack .tile').count(),11);
 assert.ok(await local.locator('#rack .advanced-tile').count()>=1);
 assert.equal(await local.locator('#rack .bracket-tile').count(),2);
 const mobile=await local.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
   board:document.querySelector('#board-frame').getBoundingClientRect().width,
   scoreBottom:document.querySelector('#score-btn').getBoundingClientRect().bottom}));
 assert.ok(mobile.scrollWidth<=mobile.width+3,'11 tiles cannot cause horizontal phone overflow');
 assert.ok(mobile.board>=330,'the shared board must remain wide on phones');
 assert.ok(mobile.scoreBottom<=854,'the score command should remain near the phone viewport');

 const backend={room:null,auth:new Map()};
 async function api(route){
   const req=route.request(),url=new URL(req.url()),method=req.method();
   if(method==='OPTIONS')return route.fulfill({status:204,headers});
   let body={};try{body=req.postDataJSON()||{};}catch{}
   const parts=url.pathname.split('/').filter(Boolean);
   const bearer=(req.headers().authorization||'').replace(/^Bearer /,'');
   const hash=backend.auth.get(bearer);
   let result,status=200;
   try{
     if(parts.length===2&&method==='POST'){
       backend.room=makeOnlineLobby({code:'GHJKLM',hostName:body.name,hostHash,
         hostAvatar:body.avatar,maxPlayers:body.maxPlayers,turnSeconds:body.turnSeconds,
         tileSet:body.tileSet,now:Date.now()});
       backend.auth.set('A'.repeat(43),hostHash);
       result={room:viewOnlineRoom(backend.room,hostHash),token:'A'.repeat(43)};
       status=201;
     }else if(parts.length===4&&parts[2]==='GHJKLM'){
       const now=Date.now(),action=parts[3];
       if(action==='join'){
         backend.room=joinOnlineLobby(backend.room,body.name,guestHash,now,body.avatar);
         backend.auth.set('B'.repeat(43),guestHash);
         result={room:viewOnlineRoom(backend.room,guestHash),token:'B'.repeat(43)};
         status=201;
       }else if(action==='state'){
         result={room:viewOnlineRoom(backend.room,hash,now)};
       }else if(action==='start'){
         const next=startOnlineMatch(backend.room,hash,body,now,rand);
         backend.room=next.room;
         result={room:viewOnlineRoom(backend.room,hash),event:next.result};
       }else throw new OnlineError('Unknown operation',404);
     }else throw new OnlineError('Unknown API route',404);
   }catch(err){status=err.status||500;result={error:err.message};}
   await route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(result)});
 }
 const hostCtx=await browser.newContext({viewport:{width:1366,height:768}});
 const guestCtx=await browser.newContext({viewport:{width:1366,height:768}});
 for(const ctx of [hostCtx,guestCtx])
   await ctx.route('http://127.0.0.1:8787/api/**',api);
 const host=await hostCtx.newPage(),guest=await guestCtx.newPage();
 for(const page of [host,guest])page.on('pageerror',error=>errors.push('Online: '+error.message));
 try{
   await host.goto(origin+'/online.html?tiles=advanced',{waitUntil:'domcontentloaded'});
   assert.equal(await host.locator('#online-tile-kit').inputValue(),'advanced');
   await host.locator('#online-host-name').fill('Ari');
   await host.locator('#online-player-limit').selectOption('2');
   await host.locator('#online-create-button').click();
   await host.locator('#lobby-code').getByText('GHJKLM').waitFor();
   assert.match(await host.locator('#online-lobby-kit').textContent(),/QUANTUM/);
   assert.equal(backend.room.tileSet,'advanced');
   await guest.goto(origin+'/online.html#GHJKLM',{waitUntil:'domcontentloaded'});
   await guest.locator('#online-join-name').fill('Bea');
   await guest.locator('#online-join-button').click();
   await guest.locator('#lobby-code').getByText('GHJKLM').waitFor();
   assert.match(await guest.locator('#online-lobby-kit').textContent(),/QUANTUM/);
   await host.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
   await host.locator('#online-lobby-players .online-lobby-player').nth(1).waitFor();
   await host.locator('#online-start-match').click();
   await host.locator('#online-gate').waitFor({state:'hidden'});
   assert.equal(await host.locator('#rack .tile').count(),11);
   assert.equal(await host.locator('#online-rack-count').textContent(),'11 / 11');
   assert.equal(await host.locator('#rack .bracket-tile').count(),2);
   assert.ok(await host.locator('#rack .fraction-tile .frac-denominator').count()>=2);
   assert.ok(await host.locator('#rack .advanced-tile').count()>=1);
   await guest.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
   await guest.locator('#online-gate').waitFor({state:'hidden'});
   assert.equal(await guest.locator('#rack .tile').count(),11);
   assert.match(await guest.locator('#online-active-kit').textContent(),/QUANTUM/);
   const guestIds=await guest.locator('#rack .tile').evaluateAll(nodes=>nodes.map(n=>n.dataset.tileId));
   const hostIds=await host.locator('#rack .tile').evaluateAll(nodes=>nodes.map(n=>n.dataset.tileId));
   assert.ok(hostIds.every(id=>!guestIds.includes(id)),'players may not receive each other’s physical rack tiles');
   assert.equal(backend.room.match.bag.length,129);
   await host.setViewportSize({width:390,height:844});
   const screen=await host.evaluate(()=>({
     width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
     board:document.querySelector('#board-frame').getBoundingClientRect().width,
     scoreBottom:document.querySelector('#online-score').getBoundingClientRect().bottom
   }));
   assert.ok(screen.scrollWidth<=screen.width+3,'online 11-tile rack must not overflow a phone');
   assert.ok(screen.board>=330);
   assert.ok(screen.scoreBottom<=854);
 }finally{
   await hostCtx.close();await guestCtx.close();
 }
 assert.deepEqual(errors,[]);
 console.log('Multiplayer kits browser passed: local positive fractions, 11-piece brackets and swaps, new-match confirmation, online host/guest Quantum, private hands and phone layouts.');
}finally{
 await local.close();await browser.close();
}
