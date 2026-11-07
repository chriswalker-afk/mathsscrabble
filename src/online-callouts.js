/** Small, fixed, non-verbal transmissions. No user-typed messages enter the room. */
export const CALLOUTS=Object.freeze([
 {id:'zib',glyph:'⟡⋔⟡',label:'Zib zorb'},
 {id:'planet',glyph:'🪐',label:'Wobbly planet'},
 {id:'saucer',glyph:'🛸',label:'Tiny flying saucer'},
 {id:'bubbles',glyph:'🫧',label:'Bubble cloud'},
 {id:'glorp',glyph:'⌁⟐⌁',label:'Glorp glorp'},
 {id:'octopus',glyph:'🐙',label:'Space octopus'},
 {id:'stars',glyph:'✨',label:'Stardust'},
 {id:'bleep',glyph:'⋆⟁⋆',label:'Bleep bloop'},
 {id:'squid',glyph:'🦑',label:'Galactic squid',unlock:'O11'},
 {id:'jelly',glyph:'🪼',label:'Floating jelly',unlock:'O12'},
 {id:'rainbow',glyph:'🌈',label:'Cosmic rainbow',unlock:'O13'}
].map(x=>Object.freeze(x)));
export const CALLOUT_BY_ID=Object.freeze(Object.fromEntries(CALLOUTS.map(x=>[x.id,x])));
export const FREE_CALLOUTS=Object.freeze(CALLOUTS.filter(x=>!x.unlock));
export const BONUS_CALLOUTS=Object.freeze(CALLOUTS.filter(x=>x.unlock));
// Alien Radio speech is ephemeral: five seconds from the room server's timestamp.
export const CALLOUT_DISPLAY_MS=5000;
// Allow small clock differences between the room server and a pilot's device.
export function visibleCallouts(callouts,now=Date.now()){
 if(!Array.isArray(callouts))return [];
 return callouts.filter(x=>x&&Number.isFinite(x.at)&&
  now-x.at>=-1500&&now-x.at<CALLOUT_DISPLAY_MS&&
  Object.hasOwn(CALLOUT_BY_ID,x.calloutId));
}
export function isCalloutUnlocked(id,unlocked=[]){
 const item=CALLOUT_BY_ID[id];
 return Boolean(item&&(!item.unlock||(Array.isArray(unlocked)&&unlocked.includes(item.unlock))));
}
