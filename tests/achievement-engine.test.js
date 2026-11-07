import test from 'node:test';
import assert from 'node:assert/strict';
import {
 ACHIEVEMENTS,ACHIEVEMENTS_BY_MODE,achievementForReward
} from '../src/achievements/catalog.js';
import {
 emptyPilotRegistry,addPilot,assignLocalSeats
} from '../src/achievements/pilots.js';
import {
 validateAchievementEvent,localSeatAchievementEvent
} from '../src/achievements/events.js';
import {
 emptyAchievementStore,awardForVerifiedEvent,achievementProgress,
 pilotAchievements,ownsAlienOption,earnedRewards,validateAchievementStore,
 MAX_EVENT_RECEIPTS
} from '../src/achievements/engine.js';
import {
 exportPilotAchievements,importPilotAchievements
} from '../src/achievements/storage.js';
const P1='pilot-'+'33'.repeat(12),P2='pilot-'+'44'.repeat(12),P3='pilot-'+'55'.repeat(12);
const registry=addPilot(addPilot(emptyPilotRegistry(),{id:P1,name:'Ari',now:1}),
 {id:P2,name:'Bea',now:2});
const SCORE={points:32,wildcards:1,crossing:1,numberTiles:3,premium:true,tileSet:'natural'};
const REPORT=(sector,invalidAttempts=0,installedSystems=0)=>({
 sector,equations:3,invalidAttempts,installedSystems
});
const FINISH=(patch={})=>({
 playerCount:2,scoredMoves:2,winner:true,everyoneScored:true,
 participated:true,isHost:true,...patch
});
let seq=0;
function make(mode,type,scopeId,data,extra={}){
 return {
  id:'verified-'+(++seq),pilotId:P1,mode,type,scopeId,
  ...(mode==='online'?{roomId:extra.roomId??'room-one'}:{}),
  authority:mode==='online'?'server-confirmed':'local-transition',
  data
 };
}
function send(ref,mode,type,scopeId,data,extra={}){
 const result=awardForVerifiedEvent(ref.store,registry,make(mode,type,scopeId,data,extra));
 ref.store=result.store;ref.awarded.push(...result.awarded.map(a=>a.id));
 return result;
}
test('all 43 achievements are reachable via verified game and radio evidence',()=>{
 const ref={store:emptyAchievementStore(),awarded:[]};
 // Sector Run: a connected premium move with a wildcard, a free exchange,
 // and five clean, continuously labelled sector reports from one run.
 send(ref,'sector','move-scored','sector:first',SCORE);
 send(ref,'sector','free-exchange','sector:first',{});
 for(let sector=1;sector<=5;sector++)
  send(ref,'sector','sector-cleared','sector:first',REPORT(sector));
 assert.equal(ref.awarded.filter(id=>id.startsWith('S')).length,10);
 // Drift: first sightseeing, three installations, two different gadgets,
 // a cleared sector with systems fitted and three guardian victories.
 send(ref,'drift','zone-map-opened','drift:one',{});
 send(ref,'drift','salvage-entered','drift:one',{});
 for(let count=1;count<=3;count++)
  send(ref,'drift','system-installed','drift:one',{installedSystems:count});
 send(ref,'drift','gadget-bought','drift:one',{gadgetId:'field-pulse'});
 send(ref,'drift','gadget-used','drift:one',{gadgetId:'field-pulse'});
 send(ref,'drift','gadget-used','drift:one',{gadgetId:'shift-coil'});
 send(ref,'drift','sector-cleared','drift:one',REPORT(1,0,3));
 for(const sector of [3,6,9])
  send(ref,'drift','guardian-defeated','drift:one',{sector});
 assert.equal(ref.awarded.filter(id=>id.startsWith('D')).length,10);
 // Local matches attributed only to Ari's saved seat, never the guest or Bea.
 send(ref,'local','match-started','local:one',{playerCount:2,isHost:false});
 send(ref,'local','turn-ready','local:one',{});
 send(ref,'local','move-scored','local:one',SCORE);
 send(ref,'local','free-exchange','local:one',{});
 for(const match of ['local:one','local:two','local:three'])
  send(ref,'local','match-finished',match,FINISH());
 assert.equal(ref.awarded.filter(id=>id.startsWith('L')).length,10);
 // Online results always come tagged as a server-confirmed observation.
 send(ref,'online','room-joined','online:one',{playerCount:1},{roomId:'room-one'});
 send(ref,'online','lobby-multi','online:one',{playerCount:2},{roomId:'room-one'});
 send(ref,'online','match-started','online:one',{playerCount:2,isHost:true},{roomId:'room-one'});
 send(ref,'online','move-scored','online:one',SCORE,{roomId:'room-one'});
 send(ref,'online','match-finished','online:one',FINISH(),{roomId:'room-one'});
 send(ref,'online','move-scored','online:two',
  {...SCORE,tileSet:'rational'},{roomId:'room-two'});
 for(const [scopeId,roomId] of [['online:two','room-two'],['online:three','room-three']])
  send(ref,'online','match-finished',scopeId,FINISH(),{roomId});
 send(ref,'online','callout-sent','online:one',{sentCount:1},{roomId:'room-one'});
 send(ref,'online','callout-sent','online:one',{sentCount:3},{roomId:'room-one'});
 send(ref,'online','callout-sent','online:one',{sentCount:8},{roomId:'room-one'});
 assert.equal(ref.awarded.filter(id=>id.startsWith('O')).length,13);
 assert.equal(new Set(ref.awarded).size,43);
 assert.deepEqual([...ref.awarded].sort(),ACHIEVEMENTS.map(x=>x.id).sort());
 assert.equal(pilotAchievements(ref.store,P1).unlocked.length,43);
 assert.equal(pilotAchievements(ref.store,P2).unlocked.length,0);
 assert.equal(earnedRewards(ref.store,P1).length,43);
 assert.equal(ownsAlienOption(ref.store,P1,'heads','nebula-crown'),true);
 assert.equal(ownsAlienOption(ref.store,P2,'heads','nebula-crown'),false);
 assert.equal(ownsAlienOption(ref.store,P2,'heads','orb'),true,'free base parts remain free');
 assert.equal(validateAchievementStore(ref.store,registry),ref.store);
 const imported=importPilotAchievements(exportPilotAchievements(registry,ref.store));
 assert.deepEqual(imported.store,ref.store,'unlocks survive a portable backup');
 for(const item of ACHIEVEMENTS)assert.equal(achievementProgress(ref.store,P1,item.id)?.unlocked,true);
});
test('hard sector achievements require five clean sector reports IN THE SAME RUN',()=>{
 const ref={store:emptyAchievementStore(),awarded:[]};
 for(let sector=1;sector<=4;sector++)
  send(ref,'sector','sector-cleared','run:A',REPORT(sector));
 assert.equal(achievementProgress(ref.store,P1,'S10').current,4);
 send(ref,'sector','sector-cleared','run:B',REPORT(5));
 assert.equal(achievementProgress(ref.store,P1,'S10').unlocked,false);
 send(ref,'sector','sector-cleared','run:A',REPORT(5,1));
 assert.equal(achievementProgress(ref.store,P1,'S10').unlocked,false);
 assert.equal(achievementProgress(ref.store,P1,'S10').current,4);
 send(ref,'sector','sector-cleared','run:A',REPORT(5,0));
 assert.equal(achievementProgress(ref.store,P1,'S10').unlocked,false,
  'a sector cannot be retroactively made clean by replaying it with a new event ID');
 assert.equal(achievementProgress(ref.store,P1,'S08').unlocked,true);
 for(let sector=1;sector<=5;sector++)send(ref,'sector','sector-cleared','run:C',REPORT(sector));
 assert.equal(achievementProgress(ref.store,P1,'S10').unlocked,true);
});
test('Drift multi-guardian and gadget awards are scoped to ONE continuous run',()=>{
 const ref={store:emptyAchievementStore(),awarded:[]};
 send(ref,'drift','guardian-defeated','drift:A',{sector:3});
 send(ref,'drift','guardian-defeated','drift:B',{sector:3});
 send(ref,'drift','guardian-defeated','drift:A',{sector:3});
 assert.equal(achievementProgress(ref.store,P1,'D10').current,1);
 send(ref,'drift','guardian-defeated','drift:A',{sector:6});
 assert.equal(achievementProgress(ref.store,P1,'D10').current,2);
 send(ref,'drift','guardian-defeated','drift:A',{sector:9});
 assert.equal(achievementProgress(ref.store,P1,'D10').unlocked,true);
 send(ref,'drift','gadget-used','drift:A',{gadgetId:'shift-coil'});
 send(ref,'drift','gadget-used','drift:A',{gadgetId:'shift-coil'});
 send(ref,'drift','gadget-used','drift:B',{gadgetId:'field-pulse'});
 assert.equal(achievementProgress(ref.store,P1,'D09').unlocked,false);
 send(ref,'drift','gadget-used','drift:A',{gadgetId:'field-pulse'});
 assert.equal(achievementProgress(ref.store,P1,'D09').unlocked,true);
});
test('three wins are DISTINCT completed matches; kits require different rooms and different types',()=>{
 const ref={store:emptyAchievementStore(),awarded:[]};
 for(let x=0;x<5;x++)send(ref,'local','match-finished','local:one',FINISH());
 assert.equal(achievementProgress(ref.store,P1,'L10').current,1);
 send(ref,'local','match-finished','local:two',FINISH());
 send(ref,'local','match-finished','local:three',FINISH());
 assert.equal(achievementProgress(ref.store,P1,'L10').unlocked,true);
 // A same-room duplicate (including a new event ID) cannot qualify O08.
 send(ref,'online','move-scored','online:one',SCORE,{roomId:'room-a'});
 send(ref,'online','move-scored','online:other', {...SCORE,tileSet:'rational'},{roomId:'room-a'});
 assert.equal(achievementProgress(ref.store,P1,'O08').unlocked,false);
 send(ref,'online','move-scored','online:two',SCORE,{roomId:'room-b'});
 assert.equal(achievementProgress(ref.store,P1,'O08').unlocked,false);
 send(ref,'online','move-scored','online:three',
  {...SCORE,tileSet:'rational'},{roomId:'room-c'});
 assert.equal(achievementProgress(ref.store,P1,'O08').unlocked,true);
 for(let i=0;i<5;i++)send(ref,'online','match-finished','online:one',FINISH(),{roomId:'room-a'});
 assert.equal(achievementProgress(ref.store,P1,'O10').current,1);
 send(ref,'online','match-finished','online:two',FINISH(),{roomId:'room-b'});
 send(ref,'online','match-finished','online:three',FINISH(),{roomId:'room-c'});
 assert.equal(achievementProgress(ref.store,P1,'O10').unlocked,true);
});
test('repeated event IDs, results reload and end screens never double-award',()=>{
 const first=make('sector','move-scored','run:one',SCORE);
 const one=awardForVerifiedEvent(emptyAchievementStore(),registry,first);
 assert.equal(one.awarded.length,5);
 const replay=awardForVerifiedEvent(one.store,registry,first);
 assert.equal(replay.ignored,'replayed-event');
 assert.deepEqual(replay.store,one.store);
 assert.deepEqual(replay.awarded,[]);
 const second=awardForVerifiedEvent(one.store,registry,
  {...first,id:'same-action-rendered-again'});
 assert.equal(second.awarded.length,0,'another ID for the same earned milestones cannot award again');
 // Crediting cannot occur for a missing profile ID, even if it is well formed.
 assert.throws(()=>awardForVerifiedEvent(one.store,registry,{...first,
  pilotId:P3,id:'stranger-event'}),/unregistered or guest/i);
 assert.equal(pilotAchievements(one.store,P2).unlocked.length,0);
});
test('untrusted / malformed events are rejected rather than minting rewards',()=>{
 const base=make('online','move-scored','online:first',SCORE,{roomId:'room-z'});
 assert.equal(validateAchievementEvent(base),base);
 const variants=[
  {...base,authority:'local-transition'},
  {...base,pilotId:null},
  {...base,mode:'other'},
  {...base,type:'free-exchange'},
  {...base,data:{...SCORE,points:-99}},
  {...base,data:{...SCORE,tileSet:'shadowkit'}},
  {...base,data:{...SCORE,points:10,evil:true}},
  {...base,id:'<script>alert(1)</script>'},
  {...base,roomId:'javascript:alert(1)'},
  {...base,data:{...SCORE,premium:'true'}},
  {...base,data:{...SCORE,wildcards:'1'}}
 ];
 for(const variant of variants){
  assert.throws(()=>validateAchievementEvent(variant),'Expected rejection of '+JSON.stringify(variant));
  assert.throws(()=>awardForVerifiedEvent(emptyAchievementStore(),registry,variant));
 }
 const local=make('local','move-scored','match:one',SCORE);
 assert.throws(()=>validateAchievementEvent({...local,authority:'server-confirmed'}));
 assert.throws(()=>validateAchievementEvent({...local,data:{...SCORE,numberTiles:1000}}));
 assert.throws(()=>validateAchievementEvent({...local,type:'guardian-defeated',data:{sector:3}}));
 assert.throws(()=>validateAchievementEvent(make('drift','guardian-defeated','run:one',{sector:4})));
});
test('guest and saved seats are separately attributed, and cannot impersonate one another',()=>{
 const owners=assignLocalSeats(registry,[P1,null,P2]);
 assert.equal(localSeatAchievementEvent(owners,1,{id:'guest-move',scopeId:'local:one',
  type:'move-scored',data:SCORE}),null);
 const fromA=localSeatAchievementEvent(owners,0,{
  id:'seat-a-move',scopeId:'local:one',type:'move-scored',data:SCORE
 });
 const fromB=localSeatAchievementEvent(owners,2,{
  id:'seat-b-move',scopeId:'local:one',type:'move-scored',
  data:{...SCORE,wildcards:0,crossing:0,numberTiles:1,premium:false}
 });
 assert.equal(fromA.pilotId,P1);
 assert.equal(fromB.pilotId,P2);
 const a=awardForVerifiedEvent(emptyAchievementStore(),registry,fromA);
 const b=awardForVerifiedEvent(a.store,registry,fromB);
 assert.equal(pilotAchievements(b.store,P1).unlocked.includes('L05'),true);
 assert.equal(pilotAchievements(b.store,P2).unlocked.includes('L05'),false);
 assert.equal(pilotAchievements(b.store,P2).unlocked.includes('L03'),true);
});
test('event receipts and recent run traces are strictly capped',()=>{
 const ref={store:emptyAchievementStore(),awarded:[]};
 for(let i=0;i<310;i++){
  send(ref,'sector','free-exchange','run:'+i,{});
 }
 assert.equal(pilotAchievements(ref.store,P1).seen.length,MAX_EVENT_RECEIPTS);
 for(let i=0;i<20;i++){
  send(ref,'sector','sector-cleared','run:'+i,REPORT(1));
 }
 assert.equal(pilotAchievements(ref.store,P1).sectorRuns.length,8);
 assert.equal(achievementProgress(ref.store,P1,'missing'),null);
 assert.deepEqual(ACHIEVEMENTS_BY_MODE.online.map(x=>x.id),[
  'O01','O02','O03','O04','O05','O06','O07','O08','O09','O10','O11','O12','O13']);
});
