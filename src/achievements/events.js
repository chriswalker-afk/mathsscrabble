/** Pass A contract for verified gameplay observations.
 * Callers MUST construct these only AFTER successful engine transitions.
 * No events are emitted by clicking an animation or displaying results.
 * For online mode the future adapter must use server-authoritative results;
 * the 'server-confirmed' tag is a data contract, not cryptographic proof.
 */
import {ACHIEVEMENT_MODES} from './catalog.js';
import {isPilotId} from './pilots.js';
import {TILE_SET_BY_ID} from '../tile-sets.js';

export const MODE_EVENTS=Object.freeze({
 sector:Object.freeze(['move-scored','sector-cleared','free-exchange']),
 drift:Object.freeze(['zone-map-opened','salvage-entered','system-installed',
   'gadget-bought','gadget-used','sector-cleared','guardian-defeated']),
 local:Object.freeze(['match-started','turn-ready','move-scored','free-exchange','match-finished']),
 online:Object.freeze(['room-joined','lobby-multi','match-started',
   'move-scored','match-finished'])
});
const id=/^[A-Za-z0-9][A-Za-z0-9:._-]{0,119}$/;
const safeId=value=>typeof value==='string'&&id.test(value);
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const exact=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&
 Object.keys(value).length===keys.length&&Object.keys(value).every(k=>keys.includes(k));
const validKit=id=>typeof id==='string'&&Object.hasOwn(TILE_SET_BY_ID,id);
const validGadget=id=>typeof id==='string'&&/^[a-z][a-z0-9-]{0,31}$/.test(id);
const bool=v=>typeof v==='boolean';
const dataSchema=Object.freeze({
 'move-scored':Object.freeze(['points','wildcards','crossing','numberTiles','premium','tileSet']),
 'sector-cleared':Object.freeze(['sector','equations','invalidAttempts','installedSystems']),
 'free-exchange':Object.freeze([]),
 'zone-map-opened':Object.freeze([]),
 'salvage-entered':Object.freeze([]),
 'system-installed':Object.freeze(['installedSystems']),
 'gadget-bought':Object.freeze(['gadgetId']),
 'gadget-used':Object.freeze(['gadgetId']),
 'guardian-defeated':Object.freeze(['sector']),
 'match-started':Object.freeze(['playerCount','isHost']),
 'turn-ready':Object.freeze([]),
 'match-finished':Object.freeze(['playerCount','scoredMoves','winner','everyoneScored','participated','isHost']),
 'room-joined':Object.freeze(['playerCount']),
 'lobby-multi':Object.freeze(['playerCount'])
});
export function validateAchievementEvent(event){
 if(!event||typeof event!=='object'||Array.isArray(event)||
    !ACHIEVEMENT_MODES.includes(event.mode)||
    !exact(event,event.mode==='online'
      ?['id','pilotId','mode','type','scopeId','roomId','authority','data']
      :['id','pilotId','mode','type','scopeId','authority','data'])||
    !safeId(event.id)||!safeId(event.scopeId)||
    !isPilotId(event.pilotId)||!MODE_EVENTS[event.mode].includes(event.type)||
    event.authority!==(event.mode==='online'?'server-confirmed':'local-transition')||
    event.mode==='online'&&!safeId(event.roomId)||
    !exact(event.data,dataSchema[event.type]))
  throw Error('Unverified or malformed achievement event.');
 const d=event.data;
 let good=false;
 switch(event.type){
  case 'move-scored':
   good=integer(d.points,1,1000000)&&integer(d.wildcards,0,20)&&
    integer(d.crossing,0,30)&&integer(d.numberTiles,0,30)&&
    bool(d.premium)&&validKit(d.tileSet);
   break;
  case 'sector-cleared':
   good=integer(d.sector,1,99)&&integer(d.equations,1,20)&&
    integer(d.invalidAttempts,0,10000)&&integer(d.installedSystems,0,4)&&
    (event.mode==='drift'||d.installedSystems===0);
   break;
  case 'system-installed':good=integer(d.installedSystems,1,4);break;
  case 'gadget-bought':
  case 'gadget-used':good=validGadget(d.gadgetId);break;
  case 'guardian-defeated':good=integer(d.sector,3,99)&&d.sector%3===0;break;
  case 'match-started':good=integer(d.playerCount,2,4)&&bool(d.isHost);break;
  case 'match-finished':
   good=integer(d.playerCount,2,4)&&integer(d.scoredMoves,0,1000)&&
    bool(d.winner)&&bool(d.everyoneScored)&&bool(d.participated)&&bool(d.isHost);
   break;
  case 'room-joined':
  case 'lobby-multi':good=integer(d.playerCount,1,4);break;
  case 'free-exchange':
  case 'zone-map-opened':
  case 'salvage-entered':
  case 'turn-ready':good=true;break;
 }
 if(!good)throw Error('Achievement evidence does not match a verified game result.');
 return event;
}
/** Adapter helper: resolves a single registered seat owner to an event.
 * Guests are never silently credited to the active pilot.
 */
export function localSeatAchievementEvent(seatOwners,seat,{id,scopeId,type,data}){
 if(!Array.isArray(seatOwners)||!Number.isInteger(seat)||
   seat<0||seat>=seatOwners.length)throw Error('Unknown local match seat.');
 const pilotId=seatOwners[seat];
 if(pilotId===null)return null;
 return validateAchievementEvent({
  id,pilotId,mode:'local',type,scopeId,authority:'local-transition',data
 });
}
