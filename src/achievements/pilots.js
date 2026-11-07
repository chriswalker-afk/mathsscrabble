/** Local pilot identity for earnable cosmetics (Pass A).
 * IDs are device-local labels, NOT accounts, passwords, or authentication.
 * Local hot-seat matches must explicitly bind each seat to its own saved
 * pilot ID; guests receive no permanent credits.
 * The existing Alien Lab key and game saves are never modified.
 */
import {validatePilotAlien} from '../alien/profiles.js';
import {ALIEN_STORAGE_KEY} from '../alien/model.js';
export const PILOT_PROFILES_KEY='equa-nova.pilot-profiles.v1';
export const PILOT_PROFILES_VERSION=1;
export const MAX_SAVED_PILOTS=12;
export const MAX_PILOT_STORAGE_BYTES=24000;
const ID=/^pilot-[a-f0-9]{24}$/;
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
 Object.keys(v).length===keys.length&&Object.keys(v).every(k=>keys.includes(k));
const validTime=n=>Number.isSafeInteger(n)&&n>=0&&n<=4102444800000;
export const isPilotId=id=>typeof id==='string'&&ID.test(id);
export function cleanPilotLabel(name){
 if(typeof name!=='string')throw Error('Enter a pilot name.');
 const value=name.replace(/[\u0000-\u001f\u007f<>]/g,'').replace(/\s+/g,' ').trim();
 if(value.length<1||value.length>20)throw Error('Pilot names must have 1–20 characters.');
 return value;
}
export function createPilotId(randomBytes){
 if(!randomBytes||randomBytes.length!==12||
   !Array.from(randomBytes).every(x=>Number.isInteger(x)&&x>=0&&x<=255))
  throw Error('Create pilot IDs from twelve secure random bytes.');
 return 'pilot-'+Array.from(randomBytes,x=>x.toString(16).padStart(2,'0')).join('');
}
export function securePilotId(){
 if(typeof crypto==='undefined'||typeof crypto.getRandomValues!=='function')
  throw Error('Secure random IDs are unavailable on this device.');
 return createPilotId(crypto.getRandomValues(new Uint8Array(12)));
}
export function emptyPilotRegistry(){return {version:PILOT_PROFILES_VERSION,activeId:null,pilots:[]};}
export function validatePilotRegistry(value){
 if(!exact(value,['version','activeId','pilots'])||
   value.version!==PILOT_PROFILES_VERSION||!Array.isArray(value.pilots)||
   value.pilots.length>MAX_SAVED_PILOTS)throw Error('Invalid pilot registry.');
 const ids=new Set(),names=new Set();
 for(const pilot of value.pilots){
  if(!exact(pilot,['id','name','avatar','createdAt'])||
    !isPilotId(pilot.id)||!validTime(pilot.createdAt)||
    pilot.name!==cleanPilotLabel(pilot.name))throw Error('Invalid pilot profile.');
  if(ids.has(pilot.id)||names.has(pilot.name.toLocaleLowerCase('en')))
   throw Error('Duplicate pilot identity.');
  ids.add(pilot.id);names.add(pilot.name.toLocaleLowerCase('en'));
  if(pilot.avatar!==null)validatePilotAlien(pilot.avatar);
 }
 if(value.activeId!==null&&(!isPilotId(value.activeId)||!ids.has(value.activeId)))
  throw Error('The selected pilot does not exist.');
 return value;
}
export function addPilot(registry,{id,name,avatar=null,now=Date.now()}){
 validatePilotRegistry(registry);
 if(registry.pilots.length>=MAX_SAVED_PILOTS)throw Error('The pilot roster is full.');
 if(!isPilotId(id)||registry.pilots.some(p=>p.id===id))throw Error('Create a unique pilot ID.');
 const label=cleanPilotLabel(name);
 if(registry.pilots.some(p=>p.name.toLocaleLowerCase('en')===label.toLocaleLowerCase('en')))
  throw Error('Choose a different pilot name.');
 if(!validTime(now))throw Error('Invalid pilot creation time.');
 const profile={id,name:label,avatar:avatar===null?null:validatePilotAlien(avatar),createdAt:now};
 return validatePilotRegistry({...registry,activeId:registry.activeId??id,pilots:[...registry.pilots,profile]});
}
export function choosePilot(registry,id){
 validatePilotRegistry(registry);
 if(id!==null&&!registry.pilots.some(p=>p.id===id))throw Error('Unknown saved pilot.');
 return {...registry,activeId:id};
}
export function setPilotAvatar(registry,id,avatar){
 validatePilotRegistry(registry);
 if(!registry.pilots.some(p=>p.id===id))throw Error('Unknown saved pilot.');
 const valid=validatePilotAlien(avatar);
 return validatePilotRegistry({...registry,pilots:registry.pilots.map(p=>
   p.id===id?{...p,avatar:valid}:p)});
}
export function assignLocalSeats(registry,seatIds){
 validatePilotRegistry(registry);
 if(!Array.isArray(seatIds)||seatIds.length<2||seatIds.length>4)
  throw Error('A local match needs 2–4 seats.');
 const assigned=new Set();
 return seatIds.map((id,i)=>{
  if(id===null)return null; // A guest can always play but earns no cosmetics.
  if(!isPilotId(id)||!registry.pilots.some(p=>p.id===id))
   throw Error('Unknown pilot in seat '+(i+1)+'.');
  if(assigned.has(id))throw Error('One saved pilot cannot control two seats.');
  assigned.add(id);return id;
 });
}
export function pilotForLocalSeat(seatIds,seatIndex){
 if(!Array.isArray(seatIds)||!Number.isInteger(seatIndex)||
   seatIndex<0||seatIndex>=seatIds.length)return null;
 return isPilotId(seatIds[seatIndex])?seatIds[seatIndex]:null;
}
export function migrateLegacyAlien(storage,registry,{pilotId,name='My Pilot',now=Date.now()}){
 validatePilotRegistry(registry);
 if(registry.pilots.length)return {registry,migrated:false,reason:'already-initialised'};
 let raw;
 try{raw=storage?.getItem(ALIEN_STORAGE_KEY);}catch{
  return {registry,migrated:false,reason:'storage-unavailable'};
 }
 if(!raw)return {registry,migrated:false,reason:'no-legacy-alien'};
 try{
  if(typeof raw!=='string'||raw.length>1024)throw Error('Oversized legacy alien.');
  const avatar=validatePilotAlien(JSON.parse(raw));
  return {registry:addPilot(registry,{id:pilotId,name,avatar,now}),migrated:true,reason:'legacy-alien-copied'};
 }catch{return {registry,migrated:false,reason:'invalid-legacy-alien'};}
}
export function loadPilots(storage){
 try{
  if(!storage||typeof storage.getItem!=='function')
   return {registry:emptyPilotRegistry(),status:'unavailable'};
  const raw=storage.getItem(PILOT_PROFILES_KEY);
  if(raw===null||raw===undefined)return {registry:emptyPilotRegistry(),status:'empty'};
  if(typeof raw!=='string'||raw.length>MAX_PILOT_STORAGE_BYTES)
   throw Error('Invalid profile storage.');
  return {registry:validatePilotRegistry(JSON.parse(raw)),status:'restored'};
 }catch{return {registry:emptyPilotRegistry(),status:'invalid'};}
}
export function savePilots(storage,registry){
 validatePilotRegistry(registry);
 try{
  const text=JSON.stringify(registry);
  if(text.length>MAX_PILOT_STORAGE_BYTES||typeof storage?.setItem!=='function')return false;
  storage.setItem(PILOT_PROFILES_KEY,text);return true;
 }catch{return false;}
}
