/** Alien Lab A2: pure editing, navigation and safe persistence helpers.
 * The browser controller is separate so the same model can be unit-tested.
 */
import {
 ALIEN_STORAGE_KEY,ALIEN_COLOUR_FIELDS,ALIEN_PART_FIELDS,
 defaultAlien,normaliseAlien,serializeAlien,validateAlienPayload,
 isAllowedAlienPart
} from './model.js';

export const EDITOR_SECTIONS=Object.freeze([
 Object.freeze({id:'head',label:'HEADS',fields:['head'],hint:''}),
 Object.freeze({id:'face',label:'FACE',fields:['eyes','mouth'],hint:'Eyes and mouth are selected separately.'}),
 Object.freeze({id:'body',label:'BODIES',fields:['body'],hint:''}),
 Object.freeze({id:'arms',label:'ARMS',fields:['arms'],hint:''}),
 Object.freeze({id:'legs',label:'MOVEMENT',fields:['legs'],hint:''}),
 Object.freeze({id:'accessory',label:'EXTRAS',fields:['accessory'],hint:'Accessories are optional.'}),
 Object.freeze({id:'colours',label:'COLOURS',fields:['skin','outfit','accent'],hint:'Skin, outfit and accents can have different colours.'})
]);
export const PART_COLLECTIONS=Object.freeze({
 head:'heads',eyes:'eyes',mouth:'mouths',body:'bodies',
 arms:'arms',legs:'legs',accessory:'accessories'
});

export function updateAlienPart(alien,manifest,field,id){
 if(!ALIEN_PART_FIELDS.includes(field)||!isAllowedAlienPart(manifest,field,id))
  throw new Error('That alien part is not in the approved library.');
 return validateAlienPayload({...normaliseAlien(alien,manifest),[field]:id},manifest);
}
export function updateAlienColour(alien,manifest,role,palette){
 if(!ALIEN_COLOUR_FIELDS.includes(role)||
   typeof palette!=='string'||!Object.hasOwn(manifest.palettes,palette))
   throw new Error('That alien palette is not in the approved library.');
 const current=normaliseAlien(alien,manifest);
 return validateAlienPayload({...current,colours:{...current.colours,[role]:palette}},manifest);
}
export function makeEditHistory(alien,manifest){
 return {past:[],present:validateAlienPayload(alien,manifest),future:[]};
}
export function pushEdit(history,alien,manifest){
 const next=validateAlienPayload(alien,manifest);
 if(serializeAlien(next,manifest)===serializeAlien(history.present,manifest))return history;
 return {past:[...history.past.slice(-29),history.present],
   present:next,future:[]};
}
export function undoEdit(history){
 if(!history.past.length)return history;
 return {past:history.past.slice(0,-1),present:history.past.at(-1),
   future:[history.present,...history.future]};
}
export function redoEdit(history){
 if(!history.future.length)return history;
 return {past:[...history.past,history.present],present:history.future[0],
   future:history.future.slice(1)};
}
export function loadSavedAlien(storage,manifest){
 if(!storage||typeof storage.getItem!=='function')
  return {alien:defaultAlien(),status:'unavailable'};
 let raw;
 try{raw=storage?.getItem(ALIEN_STORAGE_KEY);}
 catch{return {alien:defaultAlien(),status:'unavailable'};}
 if(raw===null||raw===undefined)return {alien:defaultAlien(),status:'empty'};
 if(typeof raw!=='string'||raw.length>1024)return {alien:defaultAlien(),status:'invalid'};
 try{
  const json=JSON.parse(raw);
  const alien=validateAlienPayload(json,manifest);
  return {alien,status:'restored'};
 }catch{
  return {alien:defaultAlien(),status:'invalid'};
 }
}
export function saveAlienToStorage(storage,alien,manifest){
 const serialized=serializeAlien(alien,manifest);
 try{
  if(!storage||typeof storage.setItem!=='function')return false;
  storage.setItem(ALIEN_STORAGE_KEY,serialized);
  return true;
 }catch{return false;}
}
export function sectionForField(field){
 return EDITOR_SECTIONS.find(section=>section.fields.includes(field))?.id??null;
}
