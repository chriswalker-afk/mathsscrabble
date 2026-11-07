import test from 'node:test';
import assert from 'node:assert/strict';
import manifest from '../alien-manifest.json' with {type:'json'};
import {
 ACHIEVEMENTS,ACHIEVEMENTS_BY_MODE,FREE_ALIEN_OPTIONS,FREE_ALIEN_PRESETS,
 isFreeAlienOption,achievementForReward,assertAchievementCatalog
} from '../src/achievements/catalog.js';
import {
 PILOT_PROFILES_KEY,emptyPilotRegistry,isPilotId,createPilotId,addPilot,
 choosePilot,setPilotAvatar,assignLocalSeats,pilotForLocalSeat,
 migrateLegacyAlien,loadPilots,savePilots,validatePilotRegistry
} from '../src/achievements/pilots.js';
import {
 ACHIEVEMENTS_STORAGE_KEY,emptyAchievementStore,validateAchievementStore,
 awardForVerifiedEvent,ownsAlienOption
} from '../src/achievements/engine.js';
import {
 initialisePilotAchievements,loadAchievementStore,saveAchievementStore,
 exportPilotAchievements,importPilotAchievements,restorePilotAchievements
} from '../src/achievements/storage.js';
import {defaultAlien,ALIEN_STORAGE_KEY} from '../src/alien/model.js';
const P1='pilot-'+'11'.repeat(12),P2='pilot-'+'22'.repeat(12);
const storage=()=>{
 const items=new Map();
 return {items,
  getItem(key){return items.has(key)?items.get(key):null;},
  setItem(key,value){items.set(key,String(value));},
  removeItem(key){items.delete(key);}
 };
};
test('registry preserves EVERY current base-free alien choice, every palette and four presets',()=>{
 assert.equal(assertAchievementCatalog(),true);
 assert.equal(ACHIEVEMENTS.length,40);
 for(const [collection,ids] of Object.entries(manifest.parts)){
  assert.deepEqual(FREE_ALIEN_OPTIONS[collection],ids);
  for(const id of ids)assert.equal(isFreeAlienOption(collection,id),true);
 }
 assert.deepEqual(FREE_ALIEN_OPTIONS.palettes,Object.keys(manifest.palettes));
 assert.deepEqual(FREE_ALIEN_PRESETS,Object.keys(manifest.presets));
 assert.equal(ownsAlienOption(emptyAchievementStore(),null,'heads','orb'),true);
 assert.equal(ownsAlienOption(emptyAchievementStore(),null,'accessories','none'),true);
 assert.equal(ownsAlienOption(emptyAchievementStore(),null,'palettes','cosmic-blue'),true);
 assert.equal(ownsAlienOption(emptyAchievementStore(),null,'heads','guardian-mask'),false);
 for(const part of ACHIEVEMENTS){
  assert.equal(isFreeAlienOption(part.reward.collection,part.reward.id),false);
  assert.equal(achievementForReward(part.reward.collection,part.reward.id)?.id,part.id);
  assert.ok(!manifest.parts[part.reward.collection]?.includes(part.reward.id),
   'Pass A must NOT introduce missing SVGs into the strict production manifest');
 }
});
test('each of the four game modes has exactly 6 easy, 3 moderate and 1 hard rewards',()=>{
 for(const [mode,awards] of Object.entries(ACHIEVEMENTS_BY_MODE)){
  assert.equal(awards.length,10,mode);
  assert.deepEqual(awards.map(a=>a.tier).reduce((out,key)=>
   ({...out,[key]:(out[key]||0)+1}),{}),{easy:6,moderate:3,hard:1});
  assert.equal(new Set(awards.map(a=>a.rule.event)).size>=3,true);
 }
 assert.equal(new Set(ACHIEVEMENTS.map(x=>x.reward.collection+'/'+x.reward.id)).size,40);
});
test('saved local pilot IDs are opaque, unique and persist independent of Alien Lab',()=>{
 assert.equal(createPilotId(Uint8Array.from({length:12},(_,i)=>i)),
  'pilot-000102030405060708090a0b');
 assert.equal(isPilotId(P1),true);
 assert.throws(()=>createPilotId([1,2,3]));
 assert.throws(()=>addPilot(emptyPilotRegistry(),{id:'some-name',name:'Hi'}));
 let p=addPilot(emptyPilotRegistry(),{id:P1,name:'  Ari  ',now:100});
 assert.equal(p.activeId,P1);
 p=addPilot(p,{id:P2,name:'Bea',now:101});
 assert.deepEqual(p.pilots.map(x=>x.name),['Ari','Bea']);
 assert.throws(()=>addPilot(p,{id:P2,name:'Another'}),/unique/i);
 assert.throws(()=>addPilot(p,{id:'pilot-'+'33'.repeat(12),name:'ari'}),/different pilot name/i);
 assert.throws(()=>addPilot(p,{id:'pilot-'+'33'.repeat(12),name:'<script>alert(1)</script>'}),/1–20|1-20/);
 const s=storage();
 assert.equal(savePilots(s,p),true);
 assert.equal(loadPilots(s).status,'restored');
 assert.deepEqual(loadPilots(s).registry,p);
 assert.equal(choosePilot(p,P2).activeId,P2);
 assert.equal(choosePilot(p,null).activeId,null);
 assert.throws(()=>choosePilot(p,'pilot-'+'44'.repeat(12)));
 assert.deepEqual(assignLocalSeats(p,[P1,null,P2]),[P1,null,P2]);
 assert.equal(pilotForLocalSeat([P1,null,P2],1),null);
 assert.equal(pilotForLocalSeat([P1,null,P2],2),P2);
 assert.throws(()=>assignLocalSeats(p,[P1,P1]),/two seats/i);
 assert.throws(()=>assignLocalSeats(p,[P1,'pilot-'+'44'.repeat(12)]));
 assert.throws(()=>assignLocalSeats(p,[P1]),/2–4|2-4/);
 assert.throws(()=>validatePilotRegistry({...p,activeId:'pilot-'+'44'.repeat(12)}));
 assert.throws(()=>validatePilotRegistry({...p,pilots:[...p.pilots,{...p.pilots[1],id:P1}]}));
});
test('legacy Alien Lab save is COPIED into first pilot without rewriting that save',()=>{
 const s=storage(),alien=defaultAlien();
 s.setItem(ALIEN_STORAGE_KEY,JSON.stringify(alien));
 const untouched=s.getItem(ALIEN_STORAGE_KEY);
 const migration=migrateLegacyAlien(s,emptyPilotRegistry(),{pilotId:P1,name:'Ari',now:100});
 assert.equal(migration.migrated,true);
 assert.deepEqual(migration.registry.pilots[0].avatar,alien);
 assert.equal(s.getItem(ALIEN_STORAGE_KEY),untouched);
 assert.equal(migrateLegacyAlien(s,migration.registry,{pilotId:P2}).migrated,false);
 const boot=initialisePilotAchievements(s,{pilotId:P1,name:'Ari',now:100});
 assert.equal(boot.status,'ready');
 assert.equal(boot.migrated,true);
 assert.equal(loadPilots(s).registry.pilots[0].id,P1);
 assert.equal(s.getItem(ALIEN_STORAGE_KEY),untouched);
 assert.equal(initialisePilotAchievements(s,{pilotId:P2}).migrated,false);
 const edited=setPilotAvatar(migration.registry,P1,alien);
 assert.deepEqual(edited.pilots[0].avatar,alien);
 const broken=storage();
 broken.setItem(ALIEN_STORAGE_KEY,'{"version":1,"head":"unknown"}');
 assert.equal(migrateLegacyAlien(broken,emptyPilotRegistry(),{pilotId:P1}).reason,'invalid-legacy-alien');
 assert.equal(broken.getItem(ALIEN_STORAGE_KEY),'{"version":1,"head":"unknown"}');
});
test('separate achievement storage and portable backup preserve original game and avatar saves',()=>{
 const s=storage();
 const pilots=addPilot(emptyPilotRegistry(),{id:P1,name:'Ari',now:10});
 const progress=emptyAchievementStore();
 s.setItem('equa-nova.sector-run.v1','sector-save-untouched');
 s.setItem('equa-nova.drift.v1','drift-save-untouched');
 s.setItem('equa-nova.alien.v1','alien-save-untouched');
 assert.equal(savePilots(s,pilots),true);
 assert.equal(saveAchievementStore(s,progress,pilots),true);
 assert.equal(loadAchievementStore(s,pilots).status,'restored');
 assert.deepEqual(loadAchievementStore(s,pilots).store,progress);
 const backup=exportPilotAchievements(pilots,progress);
 const imported=importPilotAchievements(backup);
 assert.deepEqual(imported.registry,pilots);
 assert.deepEqual(imported.store,progress);
 const other=storage();
 const restored=restorePilotAchievements(other,backup);
 assert.equal(restored.ok,true);
 assert.deepEqual(loadPilots(other).registry,pilots);
 assert.deepEqual(loadAchievementStore(other,pilots).store,progress);
 for(const [key,value] of [['equa-nova.sector-run.v1','sector-save-untouched'],
  ['equa-nova.drift.v1','drift-save-untouched'],
  ['equa-nova.alien.v1','alien-save-untouched']])assert.equal(s.getItem(key),value);
 assert.equal(s.items.has(PILOT_PROFILES_KEY),true);
 assert.equal(s.items.has(ACHIEVEMENTS_STORAGE_KEY),true);
 assert.throws(()=>importPilotAchievements(JSON.stringify({...JSON.parse(backup),version:999})));
 assert.throws(()=>importPilotAchievements(JSON.stringify({...JSON.parse(backup),
  achievements:{version:1,pilots:{[P1]:{...emptyAchievementStore().pilots,unlocked:['not-real']}}}})));
});
test('corrupt saves are rejected; no arbitrary reward, profile, SVG or script can be imported',()=>{
 const s=storage();
 s.setItem(PILOT_PROFILES_KEY,'malformed');
 assert.equal(loadPilots(s).status,'invalid');
 s.setItem(ACHIEVEMENTS_STORAGE_KEY,'malformed');
 assert.equal(loadAchievementStore(s).status,'invalid');
 const p=addPilot(emptyPilotRegistry(),{id:P1,name:'Ari',now:10});
 const record=emptyAchievementStore();
 record.pilots[P1]={
  unlocked:['fake-reward'],seen:[],sectorRuns:[],driftRuns:[],
  localWins:[],onlineWins:[],onlineKits:[]};
 assert.throws(()=>validateAchievementStore(record,p),/Unknown|duplicated/i);
 assert.throws(()=>exportPilotAchievements(p,record));
 assert.throws(()=>importPilotAchievements('{"format":"other"}'));
 assert.throws(()=>validatePilotRegistry({...p,pilots:[{...p.pilots[0],
  avatar:{...defaultAlien(),head:'<script>'}}]}));
});
test('unavailable local storage does not cause forgotten avatars or fake success',()=>{
 const s={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
 assert.equal(loadAchievementStore(s).status,'invalid');
 assert.equal(saveAchievementStore(s,emptyAchievementStore()),false);
 assert.equal(savePilots(s,emptyPilotRegistry()),false);
 assert.equal(initialisePilotAchievements(s,{pilotId:P1}).status,'invalid');
});
