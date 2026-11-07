/** Pass D browser consumer: only authenticated HTTPS room responses are accepted
 * by the UI caller. Server evidence is produced from validated Worker actions.
 * This is a device-local cosmetic library, not identity or cryptographic proof.
 */
import {loadPilots} from './pilots.js';
import {loadAchievementStore,saveAchievementStore} from './storage.js';
import {awardForVerifiedEvent} from './engine.js';
import {validateAchievementEvent} from './events.js';

export const ONLINE_ACHIEVEMENT_OWNER_KEY='equa-nova.achievements.online-owner.v1';
const roomFormat=/^room-[a-z0-9]{6}-[a-z0-9]+$/;
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&
 Object.keys(o).length===keys.length&&Object.keys(o).every(k=>keys.includes(k));
function validView(view){
 return view&&roomFormat.test(view.roomId)&&typeof view.code==='string'&&
  /^p[1-4]$/.test(view.you?.id)&&Number.isInteger(view.you.index)&&
  view.you.index+1===Number(view.you.id.slice(1))&&
  Array.isArray(view.achievementReceipts)&&view.achievementReceipts.length<=48;
}
export function bindOnlineRoom(storage,view){
 if(!validView(view))return null;
 const profiles=loadPilots(storage);
 if(!['empty','restored'].includes(profiles.status))return null;
 const owner={version:1,roomId:view.roomId,seatId:view.you.id,
  pilotId:profiles.registry.activeId??null};
 try{
  storage?.setItem(ONLINE_ACHIEVEMENT_OWNER_KEY,JSON.stringify(owner));
  return owner;
 }catch{return null;}
}
export function loadOnlineBinding(storage,view){
 if(!validView(view))return null;
 try{
  const raw=storage?.getItem(ONLINE_ACHIEVEMENT_OWNER_KEY);
  if(typeof raw!=='string'||raw.length>200)return null;
  const v=JSON.parse(raw);
  if(!exact(v,['version','roomId','seatId','pilotId'])||v.version!==1||
     v.roomId!==view.roomId||v.seatId!==view.you.id)return null;
  const profile=loadPilots(storage);
  if(!['empty','restored'].includes(profile.status)||
     v.pilotId!==null&&!profile.registry.pilots.some(p=>p.id===v.pilotId))return null;
  return v;
 }catch{return null;}
}
export function ingestOnlineEvidence(storage,view){
 const owner=loadOnlineBinding(storage,view);
 if(!owner?.pilotId)return {status:'guest',awarded:[]};
 try{
  const profiles=loadPilots(storage);
  const achievements=loadAchievementStore(storage,profiles.registry);
  if(!['empty','restored'].includes(achievements.status))
   return {status:'save-invalid',awarded:[]};
  let store=achievements.store,changed=false;
  const awarded=[];
  for(const entry of view.achievementReceipts){
   // A room view contains only its authenticated seat. Reject even structurally
   // valid but misattributed or cross-room records before calling the reducer.
   if(!entry||entry.roomId!==owner.roomId||entry.scopeId!==owner.roomId||
      typeof entry.id!=='string'||!entry.id.startsWith(
       'online-'+owner.roomId+'-'+view.you.index+'-'))return {status:'unverified',awarded:[]};
   const event=validateAchievementEvent({...entry,pilotId:owner.pilotId});
   const next=awardForVerifiedEvent(store,profiles.registry,event);
   if(next.ignored==='replayed-event')continue;
   if(next.ignored)return {status:next.ignored,awarded:[]};
   store=next.store;changed=true;awarded.push(...next.awarded);
  }
  if(changed&&!saveAchievementStore(storage,store,profiles.registry))
   return {status:'save-unavailable',awarded:[]};
  return {status:'recorded',awarded};
 }catch{return {status:'unverified',awarded:[]};}
}
