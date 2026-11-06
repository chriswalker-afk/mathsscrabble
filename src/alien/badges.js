/** Browser-only alien avatar painting for every multiplayer surface.
 * Local SVGs are prevalidated by A1's renderer. No remote user art or HTML.
 * If artwork has not loaded, seats display a small stable pilot badge.
 */
import {loadAlienLibrary,renderAlienSVG} from './renderer.js';
import {safePilotAlien,defaultPilotAlien,PILOT_PRESET_NAMES} from './profiles.js';
let library=null,promise=null;
export function loadPilotArtwork(){
 if(!promise){
  promise=loadAlienLibrary('./').then(ready=>{library=ready;return ready;})
   .catch(error=>{console.warn('Pilot art unavailable',error?.message||error);return null;});
 }
 return promise;
}
export function paintPilotAvatar(target,profile,index=0,{size=45,framing='portrait'}={}){
 if(!target)return target;
 const avatar=safePilotAlien(profile,index);
 target.replaceChildren();
 target.classList.add('alien-player-avatar');
 target.setAttribute('aria-hidden','true');
 if(library){
  target.append(renderAlienSVG(avatar,library,{
   width:size,height:size,framing,accessible:false
  }));
 }else{
  const fallback=document.createElement('span');
  fallback.className='alien-avatar-fallback';
  fallback.textContent='✦';
  target.append(fallback);
 }
 return target;
}
export function createPilotAvatar(profile,index=0,{size=45,framing='portrait'}={}){
 const element=document.createElement('span');
 paintPilotAvatar(element,profile,index,{size,framing});
 return element;
}
export {PILOT_PRESET_NAMES,defaultPilotAlien};
