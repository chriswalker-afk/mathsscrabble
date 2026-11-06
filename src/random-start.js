// Consecutive new games must not accidentally repeat their visible opening
// rack. The full bag and rack are still genuinely shuffled each time; this
// helper only rerolls a very rare identical opening, then uses a safe fallback.
export const OPENING_HISTORY_KEY='equa-nova.openings.v1';
export function openingPattern(rack){
 if(!Array.isArray(rack))throw Error('Expected an opening rack.');
 return rack.map(tile=>tile.blank||tile.value).join('|');
}
export function distinctOpening(factory,previousPattern,getRack,replaceRack){
 let game=factory();
 if(!previousPattern)return game;
 for(let attempt=0;attempt<12;attempt++){
   if(openingPattern(getRack(game))!==previousPattern)return game;
   game=factory();
 }
 // Even with an intentionally nonrandom RNG injected for testing, the visible
 // starting layout must differ. Swapping distinct rack tile types preserves the
 // finite bag, hand quality, tile ownership and mathematical values.
 if(openingPattern(getRack(game))===previousPattern){
   const rack=[...getRack(game)];
   const index=rack.findIndex(tile=>(tile.blank||tile.value)!==(rack[0].blank||rack[0].value));
   if(index>0){
     [rack[0],rack[index]]=[rack[index],rack[0]];
     game=replaceRack(game,rack);
   }
 }
 return game;
}
export function loadOpeningPattern(storage,mode){
 try{
   const record=JSON.parse(storage?.getItem(OPENING_HISTORY_KEY)||'{}');
   return typeof record?.[mode]==='string'?record[mode]:null;
 }catch{return null;}
}
export function rememberOpening(storage,mode,rack){
 try{
   const existing=JSON.parse(storage?.getItem(OPENING_HISTORY_KEY)||'{}');
   const previous=existing&&typeof existing==='object'&&!Array.isArray(existing)?existing:{};
   storage?.setItem(OPENING_HISTORY_KEY,JSON.stringify({
     ...previous,[mode]:openingPattern(rack)
   }));
   return Boolean(storage);
 }catch{return false;}
}
