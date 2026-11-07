/**
 * Cosmetic rack shuffle. Never draws, exchanges, or changes a tile's identity.
 * Tiles currently placed on the board stay in their rack-order slots so that
 * clearing a draft restores them without accidentally spending a turn.
 */
export function shuffleAvailableRack(rack,hiddenIds=[],rng=Math.random){
 if(!Array.isArray(rack))throw new TypeError('A rack must be an array.');
 const hidden=new Set(hiddenIds);
 const positions=[];
 for(let i=0;i<rack.length;i++)if(!hidden.has(rack[i].id))positions.push(i);
 const result=[...rack];
 if(positions.length<2)return result;
 const tiles=positions.map(i=>rack[i]);
 for(let i=tiles.length-1;i>0;i--){
  const random=rng();
  const fraction=Number.isFinite(random)?Math.min(Math.max(random,0),1-Number.EPSILON):0;
  const j=Math.floor(fraction*(i+1));
  [tiles[i],tiles[j]]=[tiles[j],tiles[i]];
 }
 // A click should always visibly rearrange two or more available tiles.
 if(tiles.every((tile,i)=>tile===rack[positions[i]]))
  [tiles[0],tiles[1]]=[tiles[1],tiles[0]];
 positions.forEach((index,i)=>{result[index]=tiles[i];});
 return result;
}
