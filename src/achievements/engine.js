/** ACHIEVEMENT HANGAR Pass A: pure award and progress reducer.
 * Only consume events from successful gameplay transitions. This module never
 * writes to storage, changes a match, edits an avatar, or trusts screen taps.
 * Online 'server-confirmed' is an adapter CONTRACT, not a cryptographic seal;
 * verified server receipts and permanent account identity are future work.
 */
import {
 ACHIEVEMENT_VERSION,ACHIEVEMENTS,ACHIEVEMENT_BY_ID,getAchievement,
 isFreeAlienOption,achievementForReward
} from './catalog.js';
import {validateAchievementEvent} from './events.js';
import {isPilotId,validatePilotRegistry,MAX_SAVED_PILOTS} from './pilots.js';
export const ACHIEVEMENTS_STORAGE_KEY='equa-nova.achievements.v1';
export const MAX_EVENT_RECEIPTS=256;
export const MAX_TRACKED_RUNS=8;
export const MAX_ACHIEVEMENT_STORAGE_BYTES=450000;
const scope=/^[A-Za-z0-9][A-Za-z0-9:._-]{0,119}$/;
const validScope=x=>typeof x==='string'&&scope.test(x);
const unique=a=>new Set(a).size===a.length;
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
 Object.keys(v).length===keys.length&&Object.keys(v).every(k=>keys.includes(k));
const int=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const knownId=id=>typeof id==='string'&&Object.hasOwn(ACHIEVEMENT_BY_ID,id);
const max=(array,fn)=>Math.max(0,...array.map(fn));
const has=(record,sector)=>record?.cleared.some(x=>x.sector===sector)??false;
const clean=(record,sector)=>record?.cleared.some(x=>x.sector===sector&&x.clean)??false;
const recentAdd=(array,value,cap)=>array.includes(value)?array:[...array.slice(1-cap),value];
export function emptyPilotAchievementState(){
 return {unlocked:[],seen:[],sectorRuns:[],driftRuns:[],
  localWins:[],onlineWins:[],onlineKits:[]};
}
export function emptyAchievementStore(){
 return {version:ACHIEVEMENT_VERSION,pilots:{}};
}
function validatePilotAchievementState(v){
 const fields=['unlocked','seen','sectorRuns','driftRuns','localWins','onlineWins','onlineKits'];
 if(!exact(v,fields)||fields.some(k=>!Array.isArray(v[k])))throw Error('Malformed pilot achievements.');
 if(v.unlocked.length>ACHIEVEMENTS.length||!unique(v.unlocked)||!v.unlocked.every(knownId))
  throw Error('Unknown or duplicated unlock ID.');
 if(v.seen.length>MAX_EVENT_RECEIPTS||!unique(v.seen)||!v.seen.every(validScope))
  throw Error('Invalid event receipts.');
 if(v.sectorRuns.length>MAX_TRACKED_RUNS||!unique(v.sectorRuns.map(x=>x.scopeId))||
   !v.sectorRuns.every(x=>exact(x,['scopeId','cleared'])&&validScope(x.scopeId)&&
     Array.isArray(x.cleared)&&x.cleared.length<=5&&
     unique(x.cleared.map(y=>y.sector))&&
     x.cleared.every(y=>exact(y,['sector','clean'])&&int(y.sector,1,5)&&typeof y.clean==='boolean')))
  throw Error('Invalid recorded sector history.');
 if(v.driftRuns.length>MAX_TRACKED_RUNS||!unique(v.driftRuns.map(x=>x.scopeId))||
   !v.driftRuns.every(x=>exact(x,['scopeId','systems','gadgets','guardians'])&&
     validScope(x.scopeId)&&int(x.systems,0,4)&&
     Array.isArray(x.gadgets)&&x.gadgets.length<=2&&unique(x.gadgets)&&
     x.gadgets.every(y=>typeof y==='string'&&/^[a-z][a-z0-9-]{0,31}$/.test(y))&&
     Array.isArray(x.guardians)&&x.guardians.length<=3&&unique(x.guardians)&&
     x.guardians.every(y=>int(y,3,99)&&y%3===0)))
  throw Error('Invalid recorded Drift run history.');
 for(const k of ['localWins','onlineWins']){
  if(v[k].length>3||!unique(v[k])||!v[k].every(validScope))
   throw Error('Invalid match-win receipts.');
 }
 if(v.onlineKits.length>8||!unique(v.onlineKits.map(x=>x.roomId))||
   !v.onlineKits.every(x=>exact(x,['roomId','kit'])&&validScope(x.roomId)&&
    ['natural','integer','rational','advanced'].includes(x.kit)))
  throw Error('Invalid online kit progress.');
 return v;
}
export function validateAchievementStore(store,registry=null){
 if(!exact(store,['version','pilots'])||store.version!==ACHIEVEMENT_VERSION||
   store.pilots===null||typeof store.pilots!=='object'||Array.isArray(store.pilots)||
   Object.keys(store.pilots).length>MAX_SAVED_PILOTS)throw Error('Invalid achievement save.');
 const knownPilots=registry===null?null:
   new Set(validatePilotRegistry(registry).pilots.map(p=>p.id));
 for(const [id,data] of Object.entries(store.pilots)){
  if(!isPilotId(id)||(knownPilots&&!knownPilots.has(id)))throw Error('Unknown pilot in achievement save.');
  validatePilotAchievementState(data);
 }
 return store;
}
export function pilotAchievements(store,pilotId){
 validateAchievementStore(store);
 if(!isPilotId(pilotId))return emptyPilotAchievementState();
 return Object.hasOwn(store.pilots,pilotId)?store.pilots[pilotId]:emptyPilotAchievementState();
}
function changeRun(runs,scopeId,maker,update){
 const old=runs.find(x=>x.scopeId===scopeId);
 const record=update(old??maker(scopeId));
 return [...runs.filter(x=>x.scopeId!==scopeId),record].slice(-MAX_TRACKED_RUNS);
}
function track(record,event){
 const {mode,type,scopeId,data:d}=event;
 if(mode==='sector'&&type==='sector-cleared'&&d.sector<=5){
  record.sectorRuns=changeRun(record.sectorRuns,scopeId,
   id=>({scopeId:id,cleared:[]}),run=>({
    ...run,
    cleared:run.cleared.some(x=>x.sector===d.sector)?run.cleared:
      [...run.cleared,{sector:d.sector,clean:d.invalidAttempts===0}]
  }));
 }
 if(mode==='drift'&&['system-installed','gadget-used','guardian-defeated'].includes(type)){
  record.driftRuns=changeRun(record.driftRuns,scopeId,
   id=>({scopeId:id,systems:0,gadgets:[],guardians:[]}),run=>{
    if(type==='system-installed')return {...run,systems:Math.max(run.systems,d.installedSystems)};
    if(type==='gadget-used')return {...run,gadgets:recentAdd(run.gadgets,d.gadgetId,2)};
    return {...run,guardians:recentAdd(run.guardians,d.sector,3)};
   });
 }
 if(mode==='local'&&type==='match-finished'&&d.winner&&d.participated)
  record.localWins=recentAdd(record.localWins,scopeId,3);
 if(mode==='online'&&type==='match-finished'&&d.winner&&d.participated)
  record.onlineWins=recentAdd(record.onlineWins,scopeId,3);
 if(mode==='online'&&type==='move-scored'&&!record.onlineKits.some(x=>x.roomId===event.roomId))
  record.onlineKits=[...record.onlineKits.slice(-7),{roomId:event.roomId,kit:d.tileSet}];
}
const sectorRun=(state,event)=>state.sectorRuns.find(x=>x.scopeId===event.scopeId);
const driftRun=(state,event)=>state.driftRuns.find(x=>x.scopeId===event.scopeId);
function isEarnedByEvent(a,event,state){
 if(a.mode!==event.mode||a.rule.event!==event.type)return false;
 const d=event.data;
 switch(a.id){
  case 'S03':case 'L05':return d.wildcards>=1;
  case 'S05':case 'L04':case 'O05':return d.crossing>=1;
  case 'S06':return d.numberTiles>=3;
  case 'S07':return d.premium===true;
  case 'S08':return [1,2,3].every(n=>has(sectorRun(state,event),n));
  case 'S09':return d.equations>=3&&d.invalidAttempts===0;
  case 'S10':return [1,2,3,4,5].every(n=>clean(sectorRun(state,event),n));
  case 'D06':return d.installedSystems>=1;
  case 'D08':return driftRun(state,event)?.systems>=3;
  case 'D09':return driftRun(state,event)?.gadgets.length>=2;
  case 'D10':return driftRun(state,event)?.guardians.length>=3;
  case 'L07':case 'O06':return d.participated&&d.scoredMoves>=1;
  case 'L08':case 'O09':return d.participated&&d.winner;
  case 'L09':return d.participated&&d.everyoneScored;
  case 'L10':return state.localWins.length>=3;
  case 'O02':return d.playerCount>=2;
  case 'O07':return d.participated&&d.isHost&&d.playerCount>=2;
  case 'O08':return state.onlineKits.some(x=>state.onlineKits.some(y=>
    x.roomId!==y.roomId&&x.kit!==y.kit));
  case 'O10':return state.onlineWins.length>=3;
  default:return true; // Only the catalog's matching, verified event can award.
 }
}
export function awardForVerifiedEvent(store,registry,event){
 validateAchievementStore(store,registry);
 validateAchievementEvent(event);
 const pilotId=event.pilotId;
 if(!registry.pilots.some(p=>p.id===pilotId))
  throw Error('An unregistered or guest pilot cannot earn achievements.');
 const old=pilotAchievements(store,pilotId);
 if(old.seen.includes(event.id))return {store,awarded:[],ignored:'replayed-event'};
 const updated={...old,unlocked:[...old.unlocked],
  seen:recentAdd(old.seen,event.id,MAX_EVENT_RECEIPTS),
  sectorRuns:[...old.sectorRuns],driftRuns:[...old.driftRuns],
  localWins:[...old.localWins],onlineWins:[...old.onlineWins],onlineKits:[...old.onlineKits]};
 track(updated,event);
 const awarded=[];
 for(const a of ACHIEVEMENTS){
  if(!updated.unlocked.includes(a.id)&&isEarnedByEvent(a,event,updated)){
   updated.unlocked.push(a.id);awarded.push(a);
  }
 }
 const next={version:ACHIEVEMENT_VERSION,pilots:{...store.pilots,[pilotId]:updated}};
 validateAchievementStore(next,registry);
 return {store:next,awarded,ignored:null};
}
export function achievementProgress(store,pilotId,id){
 const a=getAchievement(id);
 if(!a)return null;
 const p=pilotAchievements(store,pilotId);
 const achieved=p.unlocked.includes(id),target=a.rule.target;
 let count=achieved?target:0;
 if(!achieved){
  switch(id){
   case 'S08':count=max(p.sectorRuns,x=>x.cleared.filter(y=>y.sector<=3).length);break;
   case 'S10':count=max(p.sectorRuns,x=>x.cleared.filter(y=>y.clean).length);break;
   case 'D08':count=max(p.driftRuns,x=>x.systems);break;
   case 'D09':count=max(p.driftRuns,x=>x.gadgets.length);break;
   case 'D10':count=max(p.driftRuns,x=>x.guardians.length);break;
   case 'L10':count=p.localWins.length;break;
   case 'O08':count=new Set(p.onlineKits.map(x=>x.kit)).size;break;
   case 'O10':count=p.onlineWins.length;break;
  }
 }
 return {id,mode:a.mode,tier:a.tier,unlocked:achieved,current:Math.min(count,target),
  target,reward:a.reward};
}
/** Free choices do not depend on achievements or profile activation.
 * New earned assets are only SELECTABLE after Pass B adds them to the
 * strict avatar manifest, so this entitlement alone is not an SVG allowlist.
 */
export function ownsAlienOption(store,pilotId,collection,id){
 if(isFreeAlienOption(collection,id))return true;
 const achievement=achievementForReward(collection,id);
 return achievement!==null&&pilotAchievements(store,pilotId).unlocked.includes(achievement.id);
}
export function earnedRewards(store,pilotId){
 const progress=pilotAchievements(store,pilotId);
 return progress.unlocked.map(id=>getAchievement(id)).filter(Boolean).map(a=>a.reward);
}
