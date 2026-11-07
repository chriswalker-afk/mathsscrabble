import test from 'node:test';
import assert from 'node:assert/strict';
import {
 makeOnlineLobby,joinOnlineLobby,startOnlineMatch,sendOnlineCallout,
 takeOnlineAction,viewOnlineRoom,verifyOnlineRoom,OnlineError
} from '../src/online-rules.js';
import {CALLOUTS,CALLOUT_BY_ID,CALLOUT_DISPLAY_MS,visibleCallouts,isCalloutUnlocked} from '../src/online-callouts.js';
import {emptyAchievementStore,awardForVerifiedEvent,pilotAchievements,achievementProgress} from '../src/achievements/engine.js';
import {emptyPilotRegistry,addPilot} from '../src/achievements/pilots.js';

const HASHES=['a','b','c','d'].map(letter=>letter.repeat(64));
const names=['Ari','Bea','Cy','Dee'];
let sequence=0;
const request=(room,type,other={})=>({
 id:'alien-radio-'+(++sequence).toString(36).padStart(12,'0'),
 revision:room.revision,type,...other
});
function start(players=2){
 let room=makeOnlineLobby({
  code:'GHJKLM',hostName:names[0],hostHash:HASHES[0],
  maxPlayers:players,turnSeconds:0,now:1000
 });
 for(let i=1;i<players;i++)room=joinOnlineLobby(room,names[i],HASHES[i],1100+i);
 return startOnlineMatch(room,HASHES[0],request(room,'start'),2000,()=>.37).room;
}

test('radio catalogue is fixed, safe, non-verbal and linked only to cosmetic rewards',()=>{
 assert.equal(CALLOUTS.length,11);
 assert.equal(new Set(CALLOUTS.map(x=>x.id)).size,11);
 assert.equal(CALLOUTS.filter(x=>!x.unlock).length,8);
 assert.deepEqual(CALLOUTS.filter(x=>x.unlock).map(x=>x.unlock),['O11','O12','O13']);
 for(const item of CALLOUTS){
  assert.equal(CALLOUT_BY_ID[item.id],item);
  assert.equal(isCalloutUnlocked(item.id),!item.unlock);
  assert.ok(item.glyph.length>=1&&item.glyph.length<=6);
 }
 assert.equal(isCalloutUnlocked('squid',['O11']),true);
 assert.equal(isCalloutUnlocked('jelly',['O11']),false);
 assert.equal(isCalloutUnlocked('<script>',['O11','O12','O13']),false);
});

test('radio bubbles expire at five seconds, even with staggered messages',()=>{
 assert.equal(CALLOUT_DISPLAY_MS,5000);
 const sentAt=1800000000000;
 const first={id:'one',by:0,calloutId:'zib',at:sentAt};
 const second={id:'two',by:1,calloutId:'planet',at:sentAt+1000};
 const invalid={id:'invalid',by:1,calloutId:'unknown',at:sentAt+2000};
 assert.deepEqual(visibleCallouts([first,invalid],sentAt),[first]);
 assert.deepEqual(visibleCallouts([first,second],sentAt),[first,second],
  'small future-time tolerance handles client clocks slightly behind the server');
 assert.deepEqual(visibleCallouts([first,second,invalid],sentAt+4999),[first,second]);
 assert.deepEqual(visibleCallouts([first,second,invalid],sentAt+5000),[second]);
 assert.deepEqual(visibleCallouts([first,second],sentAt+5999),[second]);
 assert.deepEqual(visibleCallouts([first,second],sentAt+6000),[]);
 assert.deepEqual(visibleCallouts([first],sentAt+14000),[],'old callouts never reappear after refresh');
 assert.deepEqual(visibleCallouts(null,sentAt),[]);
});

test('authenticated pilots may transmit while waiting, once per room turn each, without playing',()=>{
 let room=start();
 const initial=room.revision,match=room.match;
 const first=request(room,'callout',{calloutId:'zib'});
 const sent=sendOnlineCallout(room,HASHES[1],first,3000);
 room=sent.room;
 assert.equal(sent.result.type,'callout');
 assert.equal(room.revision,initial+1);
 assert.equal(room.match,match,'cosmetic radio does not alter match / authoritative turn');
 assert.equal(room.match.turnNumber,1);
 assert.equal(room.match.current,0);
 assert.equal(room.match.players[0].score,0);
 const host=viewOnlineRoom(room,HASHES[0],3001);
 const guest=viewOnlineRoom(room,HASHES[1],3001);
 assert.equal(host.match.sentCalloutThisTurn,false);
 assert.equal(guest.match.sentCalloutThisTurn,true);
 assert.equal(host.match.callouts.at(-1).by,1);
 assert.equal(host.match.callouts.at(-1).calloutId,'zib');
 assert.equal(JSON.stringify(host).includes(HASHES[1]),false,'never expose opponent token hash');
 for(const tile of room.match.players[1].rack)
  assert.ok(!host.match.rack.some(t=>t.id===tile.id),'opponent rack remains private');
 assert.equal(verifyOnlineRoom(room),true);
 assert.throws(()=>sendOnlineCallout(room,HASHES[1],request(room,'callout',{calloutId:'stars'}),3002),
  err=>err instanceof OnlineError&&err.status===429,'second transmission in same turn is rate limited');
 assert.throws(()=>sendOnlineCallout(room,HASHES[1],request(room,'callout',{calloutId:'custom'}),3002),
  /listed alien transmission/);
 assert.throws(()=>sendOnlineCallout(room,HASHES[1],request(room,'callout',{calloutId:'<img src=x onerror=alert(1)>'}),3002),
  /listed alien transmission/);
 assert.throws(()=>sendOnlineCallout(room,'f'.repeat(64),request(room,'callout',{calloutId:'stars'}),3002),
  /access key/i);
 const replay=sendOnlineCallout(room,HASHES[1],first,3003);
 assert.equal(replay.replayed,true);
 assert.equal(replay.room.revision,room.revision);
 const other=sendOnlineCallout(room,HASHES[0],request(room,'callout',{calloutId:'planet'}),3003);
 room=other.room;
 assert.equal(room.callouts.length,2,'different pilots may each broadcast once');
 assert.equal(room.match.turnNumber,1);
});

test('callout-only changes never invalidate a current math turn; real turn changes do',()=>{
 let room=start();
 const oldRevision=room.revision;
 const transmit=sendOnlineCallout(room,HASHES[1],request(room,'callout',{calloutId:'octopus'}),3000);
 room=transmit.room;
 const first=takeOnlineAction(room,HASHES[0],{
  id:'test-pass-after-radio',revision:oldRevision,type:'pass'
 },3001);
 room=first.room;
 assert.equal(first.result.type,'passed');
 assert.equal(room.match.current,1);
 assert.equal(room.gameplayRevision,room.revision);
 assert.throws(()=>takeOnlineAction(room,HASHES[1],{
  id:'stale-after-real-turn',revision:oldRevision,type:'pass'
 },3002),/updated/i);
 const second=sendOnlineCallout(room,HASHES[1],request(room,'callout',{calloutId:'stars'}),3003);
 assert.equal(second.room.match.turnNumber,2);
 assert.equal(second.room.calloutStats[1].sent,2);
});

test('server counts distinct turns toward 1, 3 and 8 cosmetic-only achievement thresholds',()=>{
 let room=start(4);
 const before=room.achievementMilestones.length;
 for(let i=1;i<=8;i++){
  const transmit=sendOnlineCallout(room,HASHES[1],request(room,'callout',{calloutId:i%2?'glorp':'bubbles'}),3000+i*20);
  room=transmit.room;
  assert.equal(room.calloutStats[1].sent,i);
  assert.equal(room.match.turnNumber,i);
  const receipts=viewOnlineRoom(room,HASHES[1],3000+i*20).achievementReceipts.filter(e=>e.type==='callout-sent');
  assert.equal(receipts.length,i>=8?3:i>=3?2:1);
  assert.ok(receipts.every(x=>x.authority==='server-confirmed'));
  assert.equal(viewOnlineRoom(room,HASHES[2],3000+i*20).achievementReceipts.some(x=>x.type==='callout-sent'),false);
  if(i<8){
   const active=room.match.current;
   room=takeOnlineAction(room,HASHES[active],request(room,'pass'),3000+i*20+1).room;
   assert.equal(room.phase,'playing');
  }
 }
 assert.equal(room.calloutStats[1].sent,8);
 assert.equal(room.achievementMilestones.length,before+3);
 const events=viewOnlineRoom(room,HASHES[1],4000).achievementReceipts.filter(x=>x.type==='callout-sent');
 assert.deepEqual(events.map(x=>x.data.sentCount),[1,3,8]);
 assert.equal(verifyOnlineRoom(room),true);
 const id='pilot-'+'33'.repeat(12);
 const pilots=addPilot(emptyPilotRegistry(),{id,name:'Bea',now:1000});
 let store=emptyAchievementStore();
 for(const [i,e] of events.entries()){
  const awarded=awardForVerifiedEvent(store,pilots,{...e,pilotId:id});
  store=awarded.store;
  assert.equal(awarded.awarded.length,1);
  assert.equal(awarded.awarded[0].id,['O11','O12','O13'][i]);
 }
 assert.deepEqual(pilotAchievements(store,id).unlocked,['O11','O12','O13']);
 assert.equal(achievementProgress(store,id,'O13').current,8);
 const replay=awardForVerifiedEvent(store,pilots,{...events[0],pilotId:id});
 assert.equal(replay.ignored,'replayed-event');
});
