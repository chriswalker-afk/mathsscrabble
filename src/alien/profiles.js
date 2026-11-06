/** Shared Alien Lab pilot profiles, safe in Node, Cloudflare Workers and browsers.
 * Profiles contain ONLY fixed allowlisted part IDs and palette identifiers.
 * A missing profile is a legacy user and receives a stable preset by seat.
 * Any PRESENT invalid profile is rejected, never silently accepted by server.
 */
import manifest from '../../alien-manifest.json' with {type:'json'};
import {
 assertAlienManifest,validateAlienPayload,presetAlien,normaliseAlien,
 parseStoredAlien,ALIEN_STORAGE_KEY,randomAlien
} from './model.js';

export const PILOT_MANIFEST=assertAlienManifest(manifest);
export const PILOT_PRESET_NAMES=Object.freeze(['bloop','orbit','niblet','glimmer']);
export const PILOT_PROFILE_MAX_BYTES=1024;

export function defaultPilotAlien(index=0){
 const slot=Number.isInteger(index)&&index>=0?index%PILOT_PRESET_NAMES.length:0;
 return presetAlien(PILOT_MANIFEST,PILOT_PRESET_NAMES[slot]);
}
export function validatePilotAlien(value){
 // Strict, purely data-driven. No unknown keys, arbitrary SVG or colours.
 return validateAlienPayload(value,PILOT_MANIFEST);
}
export function acceptPilotAlien(value,index=0){
 // Compatibility: old saved matches and older clients omit the avatar.
 if(value===null||value===undefined)return defaultPilotAlien(index);
 if(typeof value!=='object'||Array.isArray(value)||
    JSON.stringify(value).length>PILOT_PROFILE_MAX_BYTES)
   throw new Error('Invalid alien pilot profile.');
 return validatePilotAlien(value);
}
export function safePilotAlien(value,index=0){
 try{return acceptPilotAlien(value,index);}
 catch{return defaultPilotAlien(index);}
}
export function isValidPilotAlien(value){
 try{return Boolean(validatePilotAlien(value));}
 catch{return false;}
}
export function alienFromStorage(storage,index=0){
 try{
  const raw=storage?.getItem(ALIEN_STORAGE_KEY);
  if(!raw)return defaultPilotAlien(index);
  // Corrupted or malicious saves never leak to multiplayer profiles.
  const parsed=JSON.parse(raw);
  return validatePilotAlien(parsed);
 }catch{return defaultPilotAlien(index);}
}
export function getSavedPilotAlien(storage){
 try{
  const raw=storage?.getItem(ALIEN_STORAGE_KEY);
  if(!raw||raw.length>PILOT_PROFILE_MAX_BYTES)return null;
  return validatePilotAlien(JSON.parse(raw));
 }catch{return null;}
}
export function nextRandomPilotAlien(previous,rng=Math.random){
 return randomAlien(PILOT_MANIFEST,safePilotAlien(previous),rng);
}
export function pilotProfileEqual(a,b){
 try{return JSON.stringify(validatePilotAlien(a))===JSON.stringify(validatePilotAlien(b));}
 catch{return false;}
}
