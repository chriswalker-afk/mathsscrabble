/** Automatic local achievement identities. No login or network calls.
 * Never overwrite corrupt saves or silently discard existing pilot progress.
 */
import {loadPilots,savePilots,addPilot,choosePilot,securePilotId,cleanPilotLabel,MAX_SAVED_PILOTS} from './pilots.js';
import {loadAchievementStore,saveAchievementStore} from './storage.js';

export function ensureActivePilot(storage,{name='Nova Pilot'}={}){
 const loaded=loadPilots(storage);
 if(!['empty','restored'].includes(loaded.status))return {pilotId:null,status:loaded.status};
 let registry=loaded.registry;
 const achievements=loadAchievementStore(storage,registry);
 if(!['empty','restored'].includes(achievements.status))
  return {pilotId:null,status:achievements.status};
 if(!registry.activeId){
  if(registry.pilots.length)registry=choosePilot(registry,registry.pilots[0].id);
  else {
   try{registry=addPilot(registry,{id:securePilotId(),name});}
   catch{return {pilotId:null,status:'unavailable'};}
  }
  if(!savePilots(storage,registry))return {pilotId:null,status:'unavailable'};
 }
 if(achievements.status==='empty')saveAchievementStore(storage,achievements.store,registry);
 return {pilotId:registry.activeId,status:'ready',registry};
}
/** Match each unique local seat name to a distinct saved pilot by default.
 * Previously selected explicit owners take priority. Storage failures do not
 * interrupt the match, but affected seats do not claim saved achievements.
 */
export function ensureLocalSeatPilots(storage,names,avatars,explicit=[]){
 const loaded=loadPilots(storage);
 if(!['empty','restored'].includes(loaded.status))return names.map(()=>null);
 let registry=loaded.registry;
 const assignments=[],taken=new Set();
 for(let i=0;i<names.length;i++){
  const chosen=explicit[i];
  let saved=registry.pilots.find(p=>p.id===chosen&&!taken.has(p.id));
  if(!saved){
   const label=cleanPilotLabel(names[i]);
   saved=registry.pilots.find(p=>p.name.toLowerCase()===label.toLowerCase()&&!taken.has(p.id));
   if(!saved&&registry.pilots.length<MAX_SAVED_PILOTS){
    try{
     registry=addPilot(registry,{id:securePilotId(),name:label,avatar:avatars?.[i]??null});
     saved=registry.pilots.at(-1);
    }catch{/* Preserve the match even when the roster is full. */}
   }
  }
  assignments.push(saved?.id??null);
  if(saved)taken.add(saved.id);
 }
 if(!savePilots(storage,registry))return names.map(()=>null);
 return assignments;
}
