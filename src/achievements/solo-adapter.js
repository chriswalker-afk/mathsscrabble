/** Pass C: device-local binding and verified SOLO gameplay receipts.
 * Never grants credits from a render, button press, animation or page load.
 * The game controller calls emit only after a successful rules transition.
 * The binding is fixed per run, so changing pilots mid-run cannot transfer awards.
 */
import {isBlank,tilePool} from '../engine.js';
import {loadPilots,isPilotId} from './pilots.js';
import {validateAchievementEvent} from './events.js';
import {awardForVerifiedEvent} from './engine.js';
import {loadAchievementStore,saveAchievementStore} from './storage.js';

export const SOLO_OWNER_KEYS=Object.freeze({
 sector:'equa-nova.achievements.sector-owner.v1',
 drift:'equa-nova.achievements.drift-owner.v1'
});
const modes=new Set(['sector','drift']);
const safeId=/^[A-Za-z0-9][A-Za-z0-9:._-]{0,119}$/;
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&
 Object.keys(value).length===keys.length&&Object.keys(value).every(k=>keys.includes(k));
export function soloRunScope(mode,startedAt){
 if(!modes.has(mode)||!Number.isSafeInteger(startedAt)||startedAt<0||startedAt>4102444800000)
  throw Error('Invalid achievement run scope.');
 return mode+'-'+startedAt.toString(36);
}
/** Also called when restoring an older sector save. Invalid records fail closed. */
export function bindSoloRun(storage,{mode,startedAt,fresh=false}){
 const scopeId=soloRunScope(mode,startedAt),key=SOLO_OWNER_KEYS[mode];
 const guest={mode,scopeId,pilotId:null};
 if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')return guest;
 const loaded=loadPilots(storage);
 if(loaded.status==='invalid'||loaded.status==='unavailable')return guest;
 try{
  const raw=storage.getItem(key);
  if(!fresh&&raw!==null){
   if(typeof raw!=='string'||raw.length>256)return guest;
   const saved=JSON.parse(raw);
   if(!exact(saved,['scopeId','pilotId'])||saved.scopeId!==scopeId||
      saved.pilotId!==null&&(!isPilotId(saved.pilotId)||
      !loaded.registry.pilots.some(p=>p.id===saved.pilotId)))return guest;
   return {mode,scopeId,pilotId:saved.pilotId};
  }
  const pilotId=loaded.registry.activeId??null;
  storage.setItem(key,JSON.stringify({scopeId,pilotId}));
  return {mode,scopeId,pilotId};
 }catch{return guest;}
}
export function emitSoloAchievement(storage,run,{type,suffix,data}){
 const none=(reason)=>({status:reason,awarded:[]});
 if(!run||!modes.has(run.mode)||!safeId.test(run.scopeId)||
    !run.pilotId||!isPilotId(run.pilotId))return none('guest');
 if(typeof suffix!=='string'||!safeId.test(suffix))return none('invalid-id');
 try{
  // Do not trust a stale tab after a run reset, a pilot removal, or corrupt storage.
  const raw=storage?.getItem(SOLO_OWNER_KEYS[run.mode]);
  if(typeof raw!=='string'||raw.length>256)return none('owner-unavailable');
  const owner=JSON.parse(raw);
  if(!exact(owner,['scopeId','pilotId'])||
      owner.scopeId!==run.scopeId||owner.pilotId!==run.pilotId)
   return none('owner-changed');
  const {registry,status}=loadPilots(storage);
  if(status!=='restored'||!registry.pilots.some(p=>p.id===run.pilotId))
   return none('pilot-unavailable');
  const loaded=loadAchievementStore(storage,registry);
  if(!['empty','restored'].includes(loaded.status))return none('save-invalid');
  const event=validateAchievementEvent({
   id:run.scopeId+':'+suffix,pilotId:run.pilotId,mode:run.mode,
   scopeId:run.scopeId,type,authority:'local-transition',data
  });
  const award=awardForVerifiedEvent(loaded.store,registry,event);
  if(award.ignored)return none(award.ignored);
  if(!saveAchievementStore(storage,award.store,registry))return none('save-unavailable');
  return {status:'recorded',awarded:award.awarded};
 }catch{return none('unverified');}
}
/** Evidence is collected BEFORE committing an accepted score to the board. */
export function soloScoredEvidence({board,pending,move,points,tileSet}){
 if(!Array.isArray(board)||!pending||!Array.isArray(move?.indices)||
    !points||!Array.isArray(points.tileScores))throw Error('Invalid scored move evidence.');
 const newTiles=Object.values(pending).filter(t=>t&&t.value!=='=');
 return {
  points:points.total,
  wildcards:newTiles.filter(isBlank).length,
  crossing:move.indices.filter(index=>Boolean(board[index])).length,
  numberTiles:newTiles.filter(t=>tilePool(t)==='numbers').length,
  premium:points.tileScores.some(t=>!t.existing&&['2T','3T','2E','3E'].includes(t.premium)),
  tileSet
 };
}
export function soloClearEvidence({sector,stats,installedSystems=0}){
 if(!stats||!Array.isArray(stats.moves))throw Error('Invalid sector report evidence.');
 return {sector,equations:stats.moves.length,invalidAttempts:stats.attempts,installedSystems};
}
