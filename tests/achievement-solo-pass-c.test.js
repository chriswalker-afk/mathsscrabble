import test from 'node:test';
import assert from 'node:assert/strict';
import {
 bindSoloRun,soloRunScope,emitSoloAchievement,soloScoredEvidence,
 soloClearEvidence,SOLO_OWNER_KEYS
} from '../src/achievements/solo-adapter.js';
import {
 emptyPilotRegistry,addPilot,choosePilot,savePilots
} from '../src/achievements/pilots.js';
import {
 loadAchievementStore
} from '../src/achievements/storage.js';
import {
 achievementProgress,pilotAchievements
} from '../src/achievements/engine.js';
const A='pilot-'+'a1'.repeat(12),B='pilot-'+'b2'.repeat(12);
const createStorage=()=>{
 const data=new Map();
 return {
  data,getItem:key=>data.has(key)?data.get(key):null,
  setItem:(key,val)=>{data.set(key,String(val));},
  removeItem:key=>data.delete(key)
 };
};
function freshPilotStorage(){
 const storage=createStorage();
 let registry=addPilot(emptyPilotRegistry(),{id:A,name:'Ari',now:10});
 registry=addPilot(registry,{id:B,name:'Bea',now:11});
 assert.equal(savePilots(storage,registry),true);
 return {storage,registry};
}
const MOVE={points:31,wildcards:1,crossing:1,numberTiles:3,premium:true,tileSet:'natural'};
const cleared=(sector,invalidAttempts=0,installedSystems=0)=>({
 sector,equations:3,invalidAttempts,installedSystems
});
function send(storage,owner,type,suffix,data){
 return emitSoloAchievement(storage,owner,{type,suffix,data});
}
test('a solo run is bound to one named pilot through refresh and switching; guests cannot farm it',()=>{
 const {storage,registry}=freshPilotStorage();
 const run=bindSoloRun(storage,{mode:'sector',startedAt:1234567,fresh:true});
 assert.equal(run.pilotId,A);
 const first=send(storage,run,'move-scored','s1-t1-score',MOVE);
 assert.equal(first.status,'recorded');
 assert.ok(first.awarded.some(x=>x.id==='S01'));
 assert.equal(send(storage,run,'move-scored','s1-t1-score',MOVE).status,'replayed-event');
 assert.equal(pilotAchievements(loadAchievementStore(storage,registry).store,A).unlocked.length,
  first.awarded.length);
 assert.equal(savePilots(storage,choosePilot(registry,B)),true);
 assert.equal(bindSoloRun(storage,{mode:'sector',startedAt:1234567}).pilotId,A);
 send(storage,run,'free-exchange','s1-t2-free-1',{});
 assert.equal(achievementProgress(loadAchievementStore(storage,registry).store,A,'S04').unlocked,true);
 assert.equal(pilotAchievements(loadAchievementStore(storage,registry).store,B).unlocked.length,0);
 const newRun=bindSoloRun(storage,{mode:'sector',startedAt:1234568,fresh:true});
 assert.equal(newRun.pilotId,B);
 assert.equal(send(storage,run,'free-exchange','s1-t3-free-2',{}).status,'owner-changed');
 send(storage,newRun,'free-exchange','s1-t1-free-1',{});
 assert.equal(achievementProgress(loadAchievementStore(storage,registry).store,B,'S04').unlocked,true);
 const guest=bindSoloRun(storage,{mode:'sector',startedAt:1234569,fresh:true});
 // The selected pilot is still Bea, so starting a guest run needs a guest selection.
 assert.equal(guest.pilotId,B);
 assert.equal(savePilots(storage,choosePilot(registry,null)),true);
 const anonymous=bindSoloRun(storage,{mode:'sector',startedAt:1234570,fresh:true});
 assert.equal(anonymous.pilotId,null);
 assert.equal(send(storage,anonymous,'free-exchange','free',{}).status,'guest');
 assert.equal(bindSoloRun(storage,{mode:'sector',startedAt:1234570}).pilotId,null);
 assert.equal(soloRunScope('sector',1234567),'sector-'+(1234567).toString(36));
 assert.throws(()=>soloRunScope('local',1234567));
});
test('only 5 clean sector clears within the SAME run can earn Precision Pilot',()=>{
 const {storage,registry}=freshPilotStorage();
 const run=bindSoloRun(storage,{mode:'sector',startedAt:2181,fresh:true});
 for(let n=1;n<=5;n++){
  const result=send(storage,run,'sector-cleared','s'+n+'-cleared',cleared(n,n===4?1:0));
  assert.equal(result.status,'recorded');
 }
 assert.equal(achievementProgress(loadAchievementStore(storage,registry).store,A,'S10').unlocked,false);
 const cleanRun=bindSoloRun(storage,{mode:'sector',startedAt:2182,fresh:true});
 for(let n=1;n<=5;n++)send(storage,cleanRun,'sector-cleared','s'+n+'-cleared',cleared(n));
 assert.equal(achievementProgress(loadAchievementStore(storage,registry).store,A,'S10').unlocked,true);
 assert.equal(achievementProgress(loadAchievementStore(storage,registry).store,A,'S08').unlocked,true);
});
test('all ten Drift achievements unlock from validated distinct action receipts',()=>{
 const {storage,registry}=freshPilotStorage();
 const run=bindSoloRun(storage,{mode:'drift',startedAt:8888,fresh:true});
 send(storage,run,'zone-map-opened','zone-map-first',{});
 send(storage,run,'salvage-entered','salvage-first',{});
 for(let i=1;i<=3;i++)send(storage,run,'system-installed','install-'+i,{installedSystems:i});
 send(storage,run,'gadget-bought','buy-step-up',{gadgetId:'step-up'});
 send(storage,run,'gadget-used','s1-t1-use-step-up',{gadgetId:'step-up'});
 send(storage,run,'gadget-used','s1-t2-use-power-surge',{gadgetId:'power-surge'});
 send(storage,run,'sector-cleared','s1-cleared',cleared(1,0,3));
 for(const sector of [3,6,9])send(storage,run,'guardian-defeated','s'+sector+'-guardian',{sector});
 const state=pilotAchievements(loadAchievementStore(storage,registry).store,A);
 assert.equal(state.unlocked.filter(id=>id.startsWith('D')).length,10);
 assert.equal(state.unlocked.includes('D10'),true);
 assert.equal(state.unlocked.includes('D09'),true);
});
test('scoring evidence counts only newly placed numeric tiles, spent premiums and existing crossings',()=>{
 const board=Array(9).fill(null);board[4]={value:'3',points:1};
 const pending={0:{value:'4',points:1},1:{value:'+',points:1},
  2:{value:'7',points:0,blank:'blank-number'}};
 const details=soloScoredEvidence({board,pending,move:{indices:[0,1,2,4]},
  points:{total:27,tileScores:[{index:0,premium:'2T',existing:false},{index:4,premium:null,existing:true}]},
  tileSet:'natural'});
 assert.deepEqual(details,{points:27,wildcards:1,crossing:1,numberTiles:2,premium:true,tileSet:'natural'});
 const report=soloClearEvidence({sector:2,stats:{attempts:1,moves:[{},{}]},installedSystems:1});
 assert.deepEqual(report,{sector:2,equations:2,invalidAttempts:1,installedSystems:1});
});
test('invalid/corrupt stores fail closed and do not damage game saves',()=>{
 const {storage}=freshPilotStorage(),run=bindSoloRun(storage,{mode:'sector',startedAt:55,fresh:true});
 storage.setItem('equa-nova.sector-run.v1','KEEP GAME ALIVE');
 storage.setItem('equa-nova.achievements.v1','broken JSON');
 const failed=send(storage,run,'free-exchange','free-1',{});
 assert.equal(failed.status,'save-invalid');
 assert.equal(storage.getItem('equa-nova.achievements.v1'),'broken JSON');
 assert.equal(storage.getItem('equa-nova.sector-run.v1'),'KEEP GAME ALIVE');
 storage.setItem(SOLO_OWNER_KEYS.sector,'not JSON');
 assert.equal(send(storage,run,'free-exchange','free-2',{}).status,'unverified');
});
