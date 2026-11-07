/** Pass D: each local hot-seat has its own opt-in saved Pilot.
 * This sidecar NEVER changes local match saves, racks, aliases or maths rules.
 * We fail closed (guest) when owners cannot be verified.
 */
import {loadPilots,assignLocalSeats} from './pilots.js';
import {localSeatAchievementEvent} from './events.js';
import {awardForVerifiedEvent} from './engine.js';
import {loadAchievementStore,saveAchievementStore} from './storage.js';
import {localStandings} from '../multiplayer.js';

export const LOCAL_ACHIEVEMENT_OWNER_KEY='equa-nova.achievements.local-owner.v1';
const validScope=/^local-[a-f0-9-]{36}$/;
const exact=(o,keys)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
 Object.keys(o).length===keys.length&&Object.keys(o).every(k=>keys.includes(k));
const guest=()=>({status:'guest',awarded:[]});
function matchIdentity(match){
 if(!match||!Array.isArray(match.players)||match.players.length<2||
    match.players.length>4||typeof match.tileSet!=='string')throw Error('Invalid local match.');
 return {names:match.players.map(p=>p.name),tileSet:match.tileSet};
}
function sameIdentity(a,b){
 return a.tileSet===b.tileSet&&a.names.length===b.names.length&&
 a.names.every((name,i)=>name===b.names[i]);
}
export function createLocalBinding(storage,match,seatIds,uid=()=>crypto.randomUUID()){
 const profiles=loadPilots(storage);
 if(!['empty','restored'].includes(profiles.status))return null;
 const ids=assignLocalSeats(profiles.registry,seatIds);
 const scopeId='local-'+uid();
 if(!validScope.test(scopeId))throw Error('A secure match ID is required.');
 const owner={version:1,scopeId,seatIds:ids,...matchIdentity(match)};
 try{
  storage?.setItem(LOCAL_ACHIEVEMENT_OWNER_KEY,JSON.stringify(owner));
  return owner;
 }catch{return null;}
}
export function loadLocalBinding(storage,match){
 try{
  const raw=storage?.getItem(LOCAL_ACHIEVEMENT_OWNER_KEY);
  if(typeof raw!=='string'||raw.length>1300)return null;
  const record=JSON.parse(raw);
  if(!exact(record,['version','scopeId','seatIds','names','tileSet'])||
     record.version!==1||!validScope.test(record.scopeId)||!Array.isArray(record.seatIds)||
     !Array.isArray(record.names)||!sameIdentity(record,matchIdentity(match)))return null;
  const profiles=loadPilots(storage);
  if(!['empty','restored'].includes(profiles.status))return null;
  const ids=assignLocalSeats(profiles.registry,record.seatIds);
  if(ids.length!==record.names.length)return null;
  return record;
 }catch{return null;}
}
export function awardLocalTransition(storage,match,{seat,type,suffix,data}){
 const binding=loadLocalBinding(storage,match);
 if(!binding||!Number.isInteger(seat)||seat<0||seat>=binding.seatIds.length)return guest();
 if(typeof suffix!=='string'||!/^[a-zA-Z0-9._-]{1,55}$/.test(suffix))
  return {status:'invalid',awarded:[]};
 try{
  const event=localSeatAchievementEvent(binding.seatIds,seat,{
   id:binding.scopeId+':'+seat+'-'+suffix,scopeId:binding.scopeId,type,data
  });
  if(!event)return guest();
  const profiles=loadPilots(storage);
  const achievements=loadAchievementStore(storage,profiles.registry);
  if(!['empty','restored'].includes(achievements.status))return {status:'save-invalid',awarded:[]};
  const result=awardForVerifiedEvent(achievements.store,profiles.registry,event);
  if(result.ignored)return {status:result.ignored,awarded:[]};
  if(!saveAchievementStore(storage,result.store,profiles.registry))
   return {status:'save-unavailable',awarded:[]};
  return {status:'recorded',awarded:result.awarded};
 }catch{return {status:'unverified',awarded:[]};}
}
export function awardLocalStart(storage,match){
 return match.players.map((_,seat)=>awardLocalTransition(storage,match,{
  seat,type:'match-started',suffix:'match-start',data:{
   playerCount:match.players.length,isHost:seat===0
  }
 }));
}
export function awardLocalFinish(storage,match){
 if(match?.phase!=='finished'||!Array.isArray(match.finalScores))return [];
 const standings=localStandings(match);
 const everyoneScored=match.players.every(p=>p.scoredMoves>0);
 return match.players.map((p,seat)=>{
  const entry=standings.find(s=>s.index===seat);
  if(!entry)return {status:'unverified',awarded:[]};
  return awardLocalTransition(storage,match,{
   seat,type:'match-finished',suffix:'match-finished',data:{
    playerCount:match.players.length,scoredMoves:p.scoredMoves,
    winner:entry.winner,everyoneScored,participated:true,isHost:seat===0
   }
  });
 });
}
