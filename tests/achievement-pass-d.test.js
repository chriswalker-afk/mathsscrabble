import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyPilotRegistry,addPilot,choosePilot,savePilots} from '../src/achievements/pilots.js';
import {loadAchievementStore} from '../src/achievements/storage.js';
import {pilotAchievements,achievementProgress} from '../src/achievements/engine.js';
import {makeLocalMatch,localStandings} from '../src/multiplayer.js';
import {createLocalBinding,loadLocalBinding,awardLocalStart,awardLocalTransition,
 awardLocalFinish} from '../src/achievements/local-adapter.js';
import {bindOnlineRoom,loadOnlineBinding,ingestOnlineEvidence} from '../src/achievements/online-adapter.js';
import {makeOnlineLobby,joinOnlineLobby,startOnlineMatch,viewOnlineRoom,
 takeOnlineAction} from '../src/online-rules.js';
import {onlineRoomScope,registerOnlineFinish,registerOnlineScored} from '../src/achievements/online-milestones.js';

const A='pilot-'+'aa'.repeat(12),B='pilot-'+'bb'.repeat(12);
const H='a'.repeat(64),J='b'.repeat(64);
const uuids=[
 '12345678-1234-4123-8123-123456789abc','abcdef12-abcd-4abc-8abc-abcdefabcdef',
 '11111111-2222-4333-8444-555555555555','44444444-5555-4666-8777-888888888888'
];
const store=()=>{
 const items=new Map();
 return {items,getItem:k=>items.get(k)??null,setItem:(k,v)=>items.set(k,String(v)),
  removeItem:k=>items.delete(k)};
};
function profiles(){
 const storage=store();
 let registry=addPilot(emptyPilotRegistry(),{id:A,name:'Ari',now:1000});
 registry=addPilot(registry,{id:B,name:'Bea',now:1001});
 assert.equal(savePilots(storage,registry),true);
 return {storage,registry};
}
function unlocks(storage,registry,id){
 return pilotAchievements(loadAchievementStore(storage,registry).store,id).unlocked;
}
const scored={points:31,wildcards:1,crossing:1,numberTiles:3,premium:true,tileSet:'natural'};
function finishedLocal(match){
 const players=match.players.map((p,i)=>({...p,scoredMoves:1,score:i===0?200:10}));
 const next={...match,players,phase:'finished',finishedReason:'stalled',pending:{},placementOrder:[]};
 return {...next,finalScores:localStandings(next)};
}
const local=()=>makeLocalMatch({names:['Ari','Bea'],turnSeconds:0},()=>.37);
test('two local seats own separate awards, guest seats earn nothing, duplicate seats are rejected',()=>{
 const {storage,registry}=profiles(),match=local();
 const binding=createLocalBinding(storage,match,[A,B],()=>uuids[0]);
 assert.equal(loadLocalBinding(storage,match).scopeId,binding.scopeId);
 const started=awardLocalStart(storage,match);
 assert.equal(started.length,2);
 assert.ok(started[0].awarded.some(a=>a.id==='L01'));
 assert.ok(started[1].awarded.some(a=>a.id==='L01'));
 const ready=awardLocalTransition(storage,match,{seat:0,type:'turn-ready',suffix:'t1-ready',data:{}});
 assert.ok(ready.awarded.some(a=>a.id==='L02'));
 assert.equal(awardLocalTransition(storage,match,{seat:0,type:'turn-ready',suffix:'t1-ready',data:{}}).status,'replayed-event');
 awardLocalTransition(storage,match,{seat:1,type:'move-scored',suffix:'t2-score',data:scored});
 assert.ok(unlocks(storage,registry,B).includes('L03'));
 assert.ok(unlocks(storage,registry,B).includes('L04'));
 assert.ok(unlocks(storage,registry,B).includes('L05'));
 assert.ok(!unlocks(storage,registry,A).includes('L03'));
 awardLocalTransition(storage,match,{seat:0,type:'free-exchange',suffix:'t1-free',data:{}});
 assert.ok(unlocks(storage,registry,A).includes('L06'));
 assert.ok(!unlocks(storage,registry,B).includes('L06'));
 assert.throws(()=>createLocalBinding(storage,match,[A,A],()=>uuids[1]),/two seats/);
 const guest=createLocalBinding(storage,match,[A,null],()=>uuids[1]);
 assert.equal(guest.seatIds[1],null);
 const none=awardLocalTransition(storage,match,{seat:1,type:'free-exchange',suffix:'t3-free',data:{}});
 assert.equal(none.status,'guest');
});
test('local finished achievements use the actual seat score and distinct match scopes',()=>{
 const {storage,registry}=profiles(),match=finishedLocal(local());
 for(const [i,uuid] of uuids.slice(0,3).entries()){
  createLocalBinding(storage,match,[A,B],()=>uuid);
  const medals=awardLocalFinish(storage,match);
  assert.ok(medals[0].awarded.some(a=>a.id==='L08')||i>0);
  assert.ok(unlocks(storage,registry,A).includes('L07'),'participants who scored earn Full Circle');
  assert.ok(unlocks(storage,registry,B).includes('L09'),'every scored participant earns Everyone Shines');
  assert.ok(!unlocks(storage,registry,B).includes('L08'),'Bea lost these matches');
 }
 assert.ok(unlocks(storage,registry,A).includes('L10'),'three distinct winning local matches');
 assert.ok(!unlocks(storage,registry,B).includes('L10'));
});
test('local owner sidecar stays separate from the match save and fails closed on missing/corrupt pilot',()=>{
 const {storage,registry}=profiles(),match=local();
 createLocalBinding(storage,match,[A,B],()=>uuids[0]);
 storage.setItem('equa-nova.local-match.v1','SAVED_MATCH');
 const stale={...match,players:match.players.map((p,i)=>i===0?{...p,name:'Other'}:p)};
 assert.equal(loadLocalBinding(storage,stale),null);
 assert.equal(awardLocalTransition(storage,stale,{seat:0,type:'turn-ready',suffix:'t1-ready',data:{}}).status,'guest');
 storage.setItem('equa-nova.achievements.local-owner.v1','not json');
 assert.equal(loadLocalBinding(storage,match),null);
 assert.equal(storage.getItem('equa-nova.local-match.v1'),'SAVED_MATCH');
});
function room(code='GHJKLM',kit='natural',now=1000){
 let r=makeOnlineLobby({code,hostName:'Ari',hostHash:H,now,turnSeconds:0,tileSet:kit});
 r=joinOnlineLobby(r,'Bea',J,now+1);
 return r;
}
test('server-derived room milestones show ONLY the authenticated seat and no credentials',()=>{
 let r=room();
 const host=viewOnlineRoom(r,H,1002),beau=viewOnlineRoom(r,J,1002);
 assert.equal(host.achievementReceipts.filter(e=>e.type==='room-joined').length,1);
 assert.equal(beau.achievementReceipts.filter(e=>e.type==='room-joined').length,1);
 assert.ok(host.achievementReceipts.some(e=>e.type==='lobby-multi'));
 assert.ok(beau.achievementReceipts.some(e=>e.type==='lobby-multi'));
 assert.ok(host.achievementReceipts.every(e=>e.id.includes('-0-')));
 assert.ok(beau.achievementReceipts.every(e=>e.id.includes('-1-')));
 assert.equal(JSON.stringify(host).includes('tokenHash'),false);
 assert.equal(host.roomId,onlineRoomScope(r));
 assert.ok(!host.achievementReceipts.some(e=>e.type==='move-scored'));
 const before=host.achievementReceipts.length;
 assert.throws(()=>takeOnlineAction(r,H,{id:'fake',revision:r.revision,type:'score',placements:[]},1002));
 assert.equal(viewOnlineRoom(r,H,1002).achievementReceipts.length,before);
 r=startOnlineMatch(r,H,{id:'start-first-12345',revision:r.revision},2000).room;
 assert.ok(viewOnlineRoom(r,H,2001).achievementReceipts.some(e=>e.type==='match-started'));
 assert.ok(viewOnlineRoom(r,J,2001).achievementReceipts.some(e=>e.type==='match-started'));
});
test('only server-generated online evidence is credited, with unique rooms and no pilot transfer',()=>{
 const {storage,registry}=profiles();
 let r=room(),v=viewOnlineRoom(r,H,1002);
 assert.equal(ingestOnlineEvidence(storage,v).status,'guest');
 const owner=bindOnlineRoom(storage,v);
 assert.equal(owner.pilotId,A);
 const initial=ingestOnlineEvidence(storage,v);
 assert.ok(initial.awarded.some(a=>a.id==='O01'));
 assert.ok(initial.awarded.some(a=>a.id==='O02'));
 assert.equal(ingestOnlineEvidence(storage,v).awarded.length,0);
 assert.equal(savePilots(storage,choosePilot(registry,B)),true);
 assert.equal(loadOnlineBinding(storage,v).pilotId,A,'changing Hangar pilot cannot hijack this room');
 const one=registerOnlineScored(r,0,{
  board:Array(361).fill(null),pending:{0:{value:'8',points:1},1:{value:'4',points:1}},
  move:{indices:[0,1]},points:{total:15,tileScores:[{index:0,existing:false,premium:'2T'}]}
 });
 v=viewOnlineRoom(one,H,1002);
 assert.ok(ingestOnlineEvidence(storage,v).awarded.some(a=>a.id==='O04'));
 assert.ok(!unlocks(storage,registry,B).includes('O04'));
 const wrong={...v,achievementReceipts:[{...v.achievementReceipts[0],roomId:'room-fake00-x'}]};
 assert.equal(ingestOnlineEvidence(storage,wrong).status,'unverified');
 assert.equal(loadOnlineBinding(storage,{...v,roomId:'room-fake00-x'}),null);
 const two=room('JKLMNP','integer',2000);
 const second=viewOnlineRoom(two,H,2002);
 bindOnlineRoom(storage,second);
 assert.equal(loadOnlineBinding(storage,second).pilotId,B);
 assert.equal(ingestOnlineEvidence(storage,second).status,'recorded');
 assert.ok(!unlocks(storage,registry,B).includes('O04'));
 assert.equal(ingestOnlineEvidence(storage,v).status,'guest','old room cannot award to the new owner');
});
test('server finished evidence is scoped to a completed room and validates host/winners',()=>{
 let r=room();
 const match={...makeLocalMatch({names:['Ari','Bea']},()=>.31),phase:'finished'};
 const finalPlayers=match.players.map((p,i)=>({...p,scoredMoves:1,score:i===0?100:10}));
 const complete={...match,players:finalPlayers,phase:'finished',finishedReason:'stalled'};
 complete.finalScores=localStandings(complete);
 r=registerOnlineFinish({...r,phase:'finished',match:complete});
 const a=viewOnlineRoom(r,H,1002).achievementReceipts.filter(e=>e.type==='match-finished');
 const b=viewOnlineRoom(r,J,1002).achievementReceipts.filter(e=>e.type==='match-finished');
 assert.equal(a.length,1);assert.equal(b.length,1);
 assert.equal(a[0].data.isHost,true);assert.equal(a[0].data.winner,true);
 assert.equal(b[0].data.isHost,false);assert.equal(b[0].data.winner,false);
 assert.equal(a[0].data.participated,true);
 assert.equal(registerOnlineFinish(r).achievementMilestones.length,r.achievementMilestones.length);
});

test('Kit Hopper and Galactic Champion require different authenticated rooms and completed results',()=>{
 const {storage,registry}=profiles();
 const rooms=[
  {code:'GHJKLM',kit:'natural',now:1000},
  {code:'JKLMNP',kit:'rational',now:2000},
  {code:'QRSTUV',kit:'natural',now:3000}
 ];
 for(const {code,kit,now} of rooms){
  let r=room(code,kit,now);
  r=startOnlineMatch(r,H,{id:'start-room-12345',revision:r.revision},now+2,()=>.37).room;
  r=registerOnlineScored(r,0,{
   board:r.match.board,pending:{0:{value:'8',points:2},1:{value:'4',points:1}},
   move:{indices:[0,1]},points:{total:20,tileScores:[{index:0,existing:false,premium:null}]}
  });
  const players=r.match.players.map((p,i)=>({...p,scoredMoves:i===0?1:0,score:i===0?200:0}));
  const finished={...r.match,players,phase:'finished',finishedReason:'stalled'};
  finished.finalScores=localStandings(finished);
  r=registerOnlineFinish({...r,phase:'finished',match:finished});
  const view=viewOnlineRoom(r,H,now+3);
  bindOnlineRoom(storage,view);
  assert.equal(ingestOnlineEvidence(storage,view).status,'recorded');
  assert.equal(ingestOnlineEvidence(storage,view).awarded.length,0,'reconnect is idempotent');
 }
 const earned=unlocks(storage,registry,A);
 assert.ok(earned.includes('O08'),'two different mathematical kits in separate rooms');
 assert.ok(earned.includes('O10'),'three unique completed winning rooms');
 assert.equal(achievementProgress(loadAchievementStore(storage,registry).store,A,'O10').current,3);
 assert.equal(unlocks(storage,registry,B).length,0);
});
