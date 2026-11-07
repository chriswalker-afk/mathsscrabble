/** Separate cosmetic progress persistence and portable backup (Pass A).
 * No changes are made to Sector Run, Drift, multiplayer, or Alien Lab saves.
 * This is an opt-in local-device library, not an online account or proof
 * against editing localStorage/import files.
 */
import {
 ACHIEVEMENTS_STORAGE_KEY,MAX_ACHIEVEMENT_STORAGE_BYTES,
 emptyAchievementStore,validateAchievementStore
} from './engine.js';
import {
 loadPilots,savePilots,validatePilotRegistry,emptyPilotRegistry,
 migrateLegacyAlien,PILOT_PROFILES_KEY
} from './pilots.js';
export const ACHIEVEMENT_BACKUP_VERSION=1;
export const MAX_BACKUP_BYTES=500000;
export function loadAchievementStore(storage,registry=null){
 try{
  if(!storage||typeof storage.getItem!=='function')
   return {store:emptyAchievementStore(),status:'unavailable'};
  const raw=storage.getItem(ACHIEVEMENTS_STORAGE_KEY);
  if(raw===null||raw===undefined)return {store:emptyAchievementStore(),status:'empty'};
  if(typeof raw!=='string'||raw.length>MAX_ACHIEVEMENT_STORAGE_BYTES)
   throw Error('Oversized achievement storage.');
  return {store:validateAchievementStore(JSON.parse(raw),registry),status:'restored'};
 }catch{
  return {store:emptyAchievementStore(),status:'invalid'};
 }
}
export function saveAchievementStore(storage,store,registry=null){
 validateAchievementStore(store,registry);
 try{
  const raw=JSON.stringify(store);
  if(raw.length>MAX_ACHIEVEMENT_STORAGE_BYTES||
    typeof storage?.setItem!=='function')return false;
  storage.setItem(ACHIEVEMENTS_STORAGE_KEY,raw);return true;
 }catch{return false;}
}
/** Performs a SAFE one-way copy of an existing saved alien when setting up
 * the first pilot. The old key is deliberately retained for all existing
 * Alien Lab editor and multiplayer users.
 *
 * Does not overwrite corrupt achievement/pilot records, and does not create
 * automatic guest achievements.
 */
export function initialisePilotAchievements(storage,{pilotId,name='My Pilot',now=Date.now()}={}){
 const pilots=loadPilots(storage);
 if(pilots.status==='invalid'||pilots.status==='unavailable')
  return {registry:pilots.registry,store:emptyAchievementStore(),
    status:pilots.status,migrated:false};
 const achievements=loadAchievementStore(storage,pilots.registry);
 if(achievements.status==='invalid'||achievements.status==='unavailable')
  return {registry:pilots.registry,store:achievements.store,
    status:achievements.status,migrated:false};
 if(pilots.status==='restored')return {registry:pilots.registry,
  store:achievements.store,status:'ready',migrated:false};
 if(!pilotId)return {registry:emptyPilotRegistry(),store:achievements.store,
  status:'empty',migrated:false};
 const migration=migrateLegacyAlien(storage,pilots.registry,{pilotId,name,now});
 if(!migration.migrated)
  return {registry:pilots.registry,store:achievements.store,
    status:'empty',migrated:false,reason:migration.reason};
 const saved=savePilots(storage,migration.registry);
 return {registry:saved?migration.registry:pilots.registry,
  store:achievements.store,status:saved?'ready':'unavailable',
  migrated:saved};
}
export function exportPilotAchievements(registry,store){
 validatePilotRegistry(registry);
 validateAchievementStore(store,registry);
 const contents={
  format:'equa-nova-achievement-backup',version:ACHIEVEMENT_BACKUP_VERSION,
  profiles:registry,achievements:store
 };
 const text=JSON.stringify(contents,null,2);
 if(text.length>MAX_BACKUP_BYTES)throw Error('Achievement backup exceeds the supported size.');
 return text;
}
export function importPilotAchievements(text){
 if(typeof text!=='string'||text.length>MAX_BACKUP_BYTES)throw Error('Invalid backup size.');
 let backup;
 try{backup=JSON.parse(text);}catch{throw Error('Achievement backup is not valid JSON.');}
 if(!backup||typeof backup!=='object'||Array.isArray(backup)||
   Object.keys(backup).length!==4||
   !['format','version','profiles','achievements'].every(k=>Object.hasOwn(backup,k))||
   backup.format!=='equa-nova-achievement-backup'||
   backup.version!==ACHIEVEMENT_BACKUP_VERSION)
  throw Error('Unsupported achievement backup format.');
 const profiles=validatePilotRegistry(backup.profiles);
 const achievements=validateAchievementStore(backup.achievements,profiles);
 return {registry:profiles,store:achievements};
}
/** Explicit REPLACE operation after a future UI confirmation. Never silently
 * import in a page load. Callers should preserve their old backup first.
 */
export function restorePilotAchievements(storage,text){
 const imported=importPilotAchievements(text);
 if(!storage||typeof storage.setItem!=='function')
  return {ok:false,reason:'storage-unavailable'};
 // Write the independent stores, retaining the original Alien Lab key.
 // Save the pre-existing raw values and roll back if a browser quota fails
 // halfway through the two-key import.
 let oldProfiles,oldAchievements;
 try{
  oldProfiles=storage.getItem(PILOT_PROFILES_KEY);
  oldAchievements=storage.getItem(ACHIEVEMENTS_STORAGE_KEY);
  const profilesText=JSON.stringify(imported.registry);
  const achievementsText=JSON.stringify(imported.store);
  if(profilesText.length>24000||achievementsText.length>MAX_ACHIEVEMENT_STORAGE_BYTES)
   throw Error('Backup too large for the local save.');
  storage.setItem(PILOT_PROFILES_KEY,profilesText);
  storage.setItem(ACHIEVEMENTS_STORAGE_KEY,achievementsText);
  return {ok:true,registry:imported.registry,store:imported.store};
 }catch{
  try{
   if(oldProfiles===null)storage.removeItem(PILOT_PROFILES_KEY);
   else if(oldProfiles!==undefined)storage.setItem(PILOT_PROFILES_KEY,oldProfiles);
   if(oldAchievements===null)storage.removeItem(ACHIEVEMENTS_STORAGE_KEY);
   else if(oldAchievements!==undefined)storage.setItem(ACHIEVEMENTS_STORAGE_KEY,oldAchievements);
  }catch{/* Storage can be unavailable, so report the failure. */}
  return {ok:false,reason:'save-failed'};
 }
}
