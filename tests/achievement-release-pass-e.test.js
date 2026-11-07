import test from 'node:test';
import assert from 'node:assert/strict';
import {ACHIEVEMENTS,ACHIEVEMENTS_BY_MODE,FREE_ALIEN_OPTIONS} from '../src/achievements/catalog.js';
import {emptyPilotRegistry,addPilot} from '../src/achievements/pilots.js';
import {emptyAchievementStore,awardForVerifiedEvent,achievementProgress,
 pilotAchievements,ownsAlienOption} from '../src/achievements/engine.js';

const pilotId='pilot-'+'ae'.repeat(12);
const pilot=addPilot(emptyPilotRegistry(),{id:pilotId,name:'Release Pilot',now:1000});
const scores=(change={})=>({
 points:27,wildcards:0,crossing:0,numberTiles:1,premium:false,
 tileSet:'natural',...change
});
const cleared=(sector,change={})=>({
 sector,equations:2,invalidAttempts:0,installedSystems:0,...change
});
const finished=(change={})=>({
 playerCount:2,scoredMoves:1,winner:true,everyoneScored:true,
 participated:true,isHost:true,...change
});
const modes={sector:'sector-qa',drift:'drift-qa',local:'local-qa',online:'room-abcd23-qa'};
function run(){
 let store=emptyAchievementStore(),nextId=0;
 function send(mode,type,data,scopeId=modes[mode],roomId=scopeId){
  const event={id:'qa-'+mode+'-'+(++nextId).toString(36),
   pilotId,mode,type,scopeId,authority:mode==='online'?'server-confirmed':'local-transition',data};
  if(mode==='online')event.roomId=roomId;
  const r=awardForVerifiedEvent(store,pilot,event);store=r.store;return {event,result:r};
 }
 return {
  send,earned:()=>pilotAchievements(store,pilotId).unlocked,
  progress:(id)=>achievementProgress(store,pilotId,id),
  owns:(kind,id)=>ownsAlienOption(store,pilotId,kind,id),
  store:()=>store
 };
}
test('release invariant: 40 uniquely rewarded permanent achievements across 4 × 10 badges',()=>{
 assert.equal(ACHIEVEMENTS.length,40);
 assert.deepEqual(Object.fromEntries(Object.entries(ACHIEVEMENTS_BY_MODE).map(([k,v])=>[k,v.length])),
  {sector:10,drift:10,local:10,online:10});
 assert.deepEqual(Object.fromEntries(Object.entries(ACHIEVEMENTS_BY_MODE).map(([k,v])=>
  [k,v.map(a=>a.tier).reduce((n,t)=>(n[t]=(n[t]||0)+1,n),{})])),
  {sector:{easy:6,moderate:3,hard:1},drift:{easy:6,moderate:3,hard:1},
   local:{easy:6,moderate:3,hard:1},online:{easy:6,moderate:3,hard:1}});
 assert.equal(new Set(ACHIEVEMENTS.map(a=>a.reward.collection+'/'+a.reward.id)).size,40);
 const game=run();
 for(const [kind,ids] of Object.entries(FREE_ALIEN_OPTIONS))
  for(const id of ids)assert.equal(game.owns(kind,id),true,'existing cosmetic became gated: '+id);
 for(const a of ACHIEVEMENTS)assert.equal(game.owns(a.reward.collection,a.reward.id),false);
});
test('all ten Sector Run badges require verified scored moves and proper in-run sector chains',()=>{
 const g=run();
 const first=g.send('sector','move-scored',scores());
 assert.deepEqual(first.result.awarded.map(a=>a.id),['S01']);
 assert.equal(g.earned().includes('S03'),false);
 assert.equal(g.earned().includes('S05'),false);
 assert.equal(g.earned().includes('S07'),false);
 // Duplicated receipt has no effect.
 const dup=awardForVerifiedEvent(g.store(),pilot,first.event);
 assert.equal(dup.ignored,'replayed-event');
 g.send('sector','move-scored',scores({wildcards:1,crossing:1,numberTiles:3,premium:true}));
 for(const id of ['S01','S03','S05','S06','S07'])assert.ok(g.earned().includes(id),id);
 g.send('sector','free-exchange',{});
 assert.ok(g.earned().includes('S04'));
 g.send('sector','sector-cleared',cleared(1,{equations:3,invalidAttempts:0}));
 assert.ok(g.earned().includes('S02'));
 assert.ok(g.earned().includes('S09'),'3 valid equations and no incorrect attempts');
 g.send('sector','sector-cleared',cleared(2));
 assert.equal(g.earned().includes('S08'),false);
 g.send('sector','sector-cleared',cleared(3));
 assert.ok(g.earned().includes('S08'),'first three sectors in the same scope');
 assert.equal(g.progress('S10').current,3);
 g.send('sector','sector-cleared',cleared(4));
 g.send('sector','sector-cleared',cleared(5));
 assert.ok(g.earned().includes('S10'));
 assert.deepEqual(ACHIEVEMENTS_BY_MODE.sector.map(a=>a.id).filter(id=>!g.earned().includes(id)),[]);
});
test('Precision Pilot cannot be won through dirty or separate sector runs',()=>{
 const g=run();
 for(const n of [1,2,3,4,5])
  g.send('sector','sector-cleared',cleared(n,{invalidAttempts:n===3?1:0}));
 assert.equal(g.earned().includes('S10'),false);
 assert.equal(g.progress('S10').current,4);
 for(const n of [1,2,3,4])
  g.send('sector','sector-cleared',cleared(n),'sector-second');
 assert.equal(g.earned().includes('S10'),false,'two incomplete clean runs do not combine');
});
test('all ten Drift badges require successfully tracked systems, distinct gadgets and boss victories',()=>{
 const g=run();
 g.send('drift','zone-map-opened',{});
 g.send('drift','salvage-entered',{});
 for(let n=1;n<=3;n++)g.send('drift','system-installed',{installedSystems:n});
 g.send('drift','gadget-bought',{gadgetId:'power-surge'});
 g.send('drift','gadget-used',{gadgetId:'power-surge'});
 g.send('drift','gadget-used',{gadgetId:'power-surge'});
 assert.equal(g.earned().includes('D09'),false,'reusing same gadget type cannot earn specialist');
 g.send('drift','gadget-used',{gadgetId:'step-up'});
 g.send('drift','sector-cleared',cleared(1,{installedSystems:3}));
 for(const n of [3,6,9])g.send('drift','guardian-defeated',{sector:n});
 assert.deepEqual(ACHIEVEMENTS_BY_MODE.drift.map(a=>a.id).filter(id=>!g.earned().includes(id)),[]);
 assert.equal(g.progress('D10').current,3);
});
test('all ten Local Multiplayer badges belong to a single pilot and three DISTINCT wins',()=>{
 const g=run();
 g.send('local','match-started',{playerCount:2,isHost:true});
 g.send('local','turn-ready',{});
 g.send('local','move-scored',scores({wildcards:1,crossing:1}));
 g.send('local','free-exchange',{});
 g.send('local','match-finished',finished());
 assert.equal(g.earned().includes('L10'),false);
 assert.equal(g.progress('L10').current,1);
 g.send('local','match-finished',finished(),'local-second');
 g.send('local','match-finished',finished(),'local-third');
 assert.deepEqual(ACHIEVEMENTS_BY_MODE.local.map(a=>a.id).filter(id=>!g.earned().includes(id)),[]);
 assert.equal(g.progress('L10').current,3);
});
test('all ten Online Signal Clash badges require distinct server-confirmed room scopes and two kits',()=>{
 const g=run();
 const first='room-abcd23-qa',second='room-abcd24-qa',third='room-abcd25-qa';
 g.send('online','room-joined',{playerCount:1},first);
 g.send('online','lobby-multi',{playerCount:2},first);
 g.send('online','match-started',{playerCount:2,isHost:true},first);
 g.send('online','move-scored',scores({crossing:1,tileSet:'natural'}),first);
 g.send('online','match-finished',finished(),first);
 assert.equal(g.earned().includes('O08'),false);
 assert.equal(g.earned().includes('O10'),false);
 g.send('online','move-scored',scores({tileSet:'natural'}),second);
 assert.equal(g.earned().includes('O08'),false,'two rooms with the same kit are not enough');
 g.send('online','move-scored',scores({tileSet:'rational'}),third);
 assert.ok(g.earned().includes('O08'));
 g.send('online','match-finished',finished(),second);
 g.send('online','match-finished',finished(),third);
 assert.deepEqual(ACHIEVEMENTS_BY_MODE.online.map(a=>a.id).filter(id=>!g.earned().includes(id)),[]);
 assert.equal(g.progress('O10').current,3);
});
test('earned cosmetic ownership does not leak to a different pilot or guest',()=>{
 const g=run();
 g.send('sector','move-scored',scores({wildcards:1}));
 assert.equal(g.owns('accessories','star-antennae'),true);
 assert.equal(g.owns('eyes','sparkle'),true);
 assert.equal(ownsAlienOption(g.store(),null,'eyes','sparkle'),false);
 assert.equal(ownsAlienOption(g.store(),'pilot-'+'be'.repeat(12),'eyes','sparkle'),false);
 assert.equal(ownsAlienOption(g.store(),null,'eyes','twin'),true);
});
