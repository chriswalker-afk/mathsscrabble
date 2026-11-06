// The Drift: self-contained roguelike economy, anomalies and scoring.
import {bonusAt,coords,isBlank,isDigit,scoreMove,nextTarget,TURNS_PER_SECTOR,randomFloat} from './engine.js';

export const ROGUE_SAVE_KEY='equa-nova.drift.v1';
export const ACTIVE_MODE_KEY='equa-nova.last-mode.v1';
export const MAX_PERMANENT_SLOTS=4;
export const MAX_TEMPORARY_SLOTS=2;
// Distinct shop disciplines: a tile-type boost is not a board-space upgrade,
// nor is an improvement to equation length. Art IDs map to inline SVG badges.
export const ROGUE_ITEMS=Object.freeze([
 {id:'ion-seven',name:'Ionised Sevens',cost:4,kind:'TILE TYPE',icon:'7',description:'New physical 7 tiles gain +3 base points, boosted by their tile squares.'},
 {id:'crosslink',name:'Crosslink Circuit',cost:5,kind:'CONNECTION',icon:'⊕',description:'+5 energy when your equation crosses a locked tile.'},
 {id:'longwave',name:'Longwave Coil',cost:5,kind:'LENGTH BONUS',icon:'⇥',description:'+7 energy for equations spanning at least seven squares.'},
 {id:'wild-beacon',name:'Wildcard Beacon',cost:6,kind:'RACK',icon:'✦',description:'Fresh draws favour two wildcards whenever the supply allows.'},
 {id:'operator-core',name:'Operator Core',cost:5,kind:'TILE TYPE',icon:'×',description:'New physical × and ÷ tiles gain +3 base points, boosted by their squares.'},
 {id:'amplifier',name:'Amplifier Array',cost:7,kind:'BOARD SPACE',icon:'3T',description:'2T squares become 3T for new physical tiles.'},
 {id:'echo',name:'Echo Generator',cost:6,kind:'LENGTH BONUS',icon:'∞',description:'+2 energy per new physical tile after your fourth each equation.'},
 {id:'operator-reserve',name:'Operator Reserve',cost:5,kind:'RACK',icon:'◇',description:'New operator draws favour × and ÷ when the operator supply allows.'},
 {id:'flux-recycler',name:'Flux Recycler',cost:7,kind:'ECONOMY',icon:'◈',description:'+3 Flux each time you stabilise a sector.'},
 {id:'leak-shield',name:'Leak Shield',cost:7,kind:'DEFENCE',icon:'⬡',description:'Cancel Power Leak’s 15% energy penalty whenever it appears.'},
 {id:'odd-charge',name:'Oddity Coil',cost:5,kind:'TILE TYPE',icon:'135',description:'New physical odd digits (1, 3, 5, 7, 9) gain +2 base points.'},
 {id:'bonus-echo',name:'Second Spark',cost:7,kind:'BOARD SPACE',icon:'2×',description:'A premium square can activate once more when its locked tile is crossed.'},
 {id:'length-matrix',name:'Stretch Matrix',cost:6,kind:'LENGTH BONUS',icon:'⇢',description:'+2 more energy per equation square after the fifth.'},
 {id:'precision-pay',name:'Precision Dividend',cost:5,kind:'ECONOMY',icon:'◎',description:'Earn +2 Flux every time you score with no wildcards in your new tiles.'},
 {id:'premium-dividend',name:'Premium Prospect',cost:6,kind:'ECONOMY',icon:'✷',description:'Earn +1 Flux per newly activated premium square in each scored move.'},
 {id:'extra-swap',name:'Exchange License',cost:6,kind:'TACTICS',icon:'⇄',description:'Get a second separate free single-tile swap every turn.'},
 {id:'wide-rack',name:'Rack Extension',cost:8,kind:'RACK',icon:'+1',description:'Add one extra number slot: carry six numbers and three operators (nine total).'},
 {id:'extra-turn',name:'Time Dilator',cost:8,kind:'TACTICS',icon:'+1',description:'Play a seventh turn in every Drift sector.'},
 {id:'starter-spark',name:'Core Igniter',cost:5,kind:'BOARD SPACE',icon:'✳',description:'+6 energy for a scored opening equation through the centre.'}
]);
export const ROGUE_ITEM_BY_ID=Object.freeze(Object.fromEntries(ROGUE_ITEMS.map(item=>[item.id,item])));
export const TEMP_ITEMS=Object.freeze([
 {id:'pulse-charge',name:'Pulse Capacitor',cost:3,kind:'SCORE BOOST',icon:'⚡',description:'Arm for +12 flat energy on your next valid equation.',action:'score'},
 {id:'double-score',name:'Double Reactor',cost:7,kind:'SCORE BOOST',icon:'×2',description:'Arm to double the total energy of your next valid equation.',action:'score'},
 {id:'power-surge',name:'Power Surge',cost:5,kind:'SCORE BOOST',icon:'+50%',description:'Arm to add 50% more energy to your next valid equation.',action:'score'},
 {id:'step-up',name:'Step Up',cost:3,kind:'TILE SWAP',icon:'↑1',description:'Choose a number tile; swap it for one numbered 1 higher from the bag.',action:'tile'},
 {id:'step-down',name:'Step Down',cost:3,kind:'TILE SWAP',icon:'↓1',description:'Choose a number tile; swap it for one numbered 1 lower from the bag.',action:'tile'},
 {id:'operator-shift',name:'Operator Shift',cost:3,kind:'TILE SWAP',icon:'⇆',description:'Choose a physical operator; exchange + for × or − for ÷ (and reverse) if available.',action:'tile'},
 {id:'wildcard-hunt',name:'Wildcard Hunt',cost:5,kind:'TILE SWAP',icon:'◇',description:'Choose a rack tile; swap it for a wildcard from its own bag.',action:'tile'},
 {id:'recycle-tile',name:'Recycle Tile',cost:2,kind:'TILE SWAP',icon:'↻',description:'Choose one tile; replace it with a different tile from the same bag.',action:'tile'}
]);
export const TEMP_ITEM_BY_ID=Object.freeze(Object.fromEntries(TEMP_ITEMS.map(item=>[item.id,item])));
export const PULSE_ITEM=TEMP_ITEMS[0];
export const owns=(rogue,id)=>Boolean(rogue?.upgrades?.includes(id));
export function turnLimit(rogue){return 6+Number(owns(rogue,'extra-turn'));}
export function rackSlots(rogue){return 8+Number(owns(rogue,'wide-rack'));}
export function shopTemperatures(sector){
 const rotations=TEMP_ITEMS.filter(item=>item.id!=='pulse-charge');
 const start=(sector-1)*2%rotations.length;
 return [PULSE_ITEM,rotations[start],rotations[(start+1)%rotations.length]];
}
// A pre-upgrade save may only contain the old Pulse counter. Its charges
// remain usable, but new purchases obey the two-slot maximum.
export function heldConsumables(rogue){
 // A legacy/manual state can still carry Pulse charges without an item array.
 const slots=rogue?.tempSlots;
 return Array.isArray(slots)&&(slots.length||!rogue.pulse)?[...slots]:
   Array.from({length:rogue?.pulse||0},()=>PULSE_ITEM.id);
}
export function armedConsumable(rogue){
 const held=heldConsumables(rogue);
 return held.includes(rogue?.armed||'')?rogue.armed:
   (held.includes(PULSE_ITEM.id)?PULSE_ITEM.id:null);
}
export function freeSwapsRemaining(rogue,turn,legacyTurn=0){
 const cap=1+Number(owns(rogue,'extra-swap'));
 const used=rogue?.swapTurn===turn?rogue.swapsUsed||0:
   (legacyTurn===turn?1:0);
 return Math.max(0,cap-used);
}
export function markFreeSwap(rogue,turn,legacyTurn=0){
 const used=rogue?.swapTurn===turn?rogue.swapsUsed||0:Number(legacyTurn===turn);
 return {...rogue,swapTurn:turn,swapsUsed:used+1};
}
export const ROGUE_ANOMALIES=Object.freeze([
 {id:'power-leak',name:'POWER LEAK',icon:'⚠',description:'An unstable reactor drains 15% of each equation’s energy unless shielded.',short:'−15% energy on every move'},
 {id:'signal-jam',name:'SIGNAL JAM',icon:'⌁',description:'Double-equation (2E) squares lose their multiplier this sector.',short:'2E multipliers disabled'},
 {id:'critical',name:'CRITICAL REACTOR',icon:'!',description:'The sector needs 20% more energy to stabilise.',short:'+20% energy target'},
 {id:'tile-static',name:'TILE STATIC',icon:'∿',description:'Triple-tile (3T) squares only count double this sector.',short:'3T squares act as 2T'}
]);
export function anomalyForSector(sector){
 if(!Number.isInteger(sector)||sector<1||sector%3!==0)return null;
 return ROGUE_ANOMALIES[(sector/3-1)%ROGUE_ANOMALIES.length];
}
export function targetForSector(mode,sector){
 const base=nextTarget(sector);
 return mode==='rogue'&&anomalyForSector(sector)?.id==='critical'?
   Math.ceil(base*1.2):base;
}
export function makeRogueState(){
 return {flux:0,earned:0,spent:0,upgrades:[],shopSector:0,lastReward:0,
   pulse:0,pulseBought:0,pulseUsed:0,tempSlots:[],tempBought:[],tempUsed:[],
   armed:null,swapTurn:0,swapsUsed:0,echoed:[]};
}
export function shopOffers(sector,rogue){
 const unowned=ROGUE_ITEMS.filter(item=>!owns(rogue,item.id));
 if(!unowned.length)return [];
 // Four curated offers; the four-slot build limit makes stock choices matter.
 if(sector===1)return unowned.slice(0,4);
 // Early waves deliberately expose distinct build archetypes, not just the
 // next four entries in a long catalog. Players can see economy, board, time,
 // rack and free-swap decisions before their four slots are all occupied.
 const featured={
   2:['extra-swap','flux-recycler','amplifier','odd-charge'],
   3:['bonus-echo','wide-rack','extra-turn','length-matrix'],
   4:['precision-pay','premium-dividend','operator-core','starter-spark']
 };
 const start=((sector-1)*3)%ROGUE_ITEMS.length;
 const rotated=[...ROGUE_ITEMS.slice(start),...ROGUE_ITEMS.slice(0,start)];
 const candidates=[...(featured[sector]||[]).map(id=>ROGUE_ITEM_BY_ID[id]),...rotated];
 return [...new Map(candidates.map(item=>[item.id,item])).values()]
   .filter(item=>!owns(rogue,item.id)).slice(0,4);
}
export function purchaseUpgrade(rogue,id,sector){
 const item=ROGUE_ITEM_BY_ID[id];
 if(!item)return {ok:false,reason:'Unknown shop upgrade.',rogue};
 if(!Number.isInteger(sector)||sector<1||rogue.shopSector!==sector)
   return {ok:false,reason:'Upgrades can only be purchased in the current Salvage Bay.',rogue};
 if(owns(rogue,id))return {ok:false,reason:'You already own that upgrade.',rogue};
 if(rogue.upgrades.length>=MAX_PERMANENT_SLOTS)
   return {ok:false,reason:'All four permanent equipment slots are occupied.',rogue};
 if(!shopOffers(sector,rogue).some(offer=>offer.id===id))
   return {ok:false,reason:'That upgrade is not offered in this sector.',rogue};
 if(rogue.flux<item.cost)return {ok:false,reason:'Not enough Flux for this upgrade.',rogue};
 return {ok:true,reason:'Installed '+item.name,rogue:{
   ...rogue,flux:rogue.flux-item.cost,spent:rogue.spent+item.cost,
   upgrades:[...rogue.upgrades,id]
 }};
}
export function purchaseTemporary(rogue,id,sector){
 const item=TEMP_ITEM_BY_ID[id];
 if(!item)return {ok:false,reason:'Unknown temporary equipment.',rogue};
 if(!Number.isInteger(sector)||sector<1||rogue.shopSector!==sector)
   return {ok:false,reason:'The Salvage Bay is not open.',rogue};
 if(!shopTemperatures(sector).some(offer=>offer.id===id))
   return {ok:false,reason:'This consumable is not offered this sector.',rogue};
 if(heldConsumables(rogue).length>=MAX_TEMPORARY_SLOTS)
   return {ok:false,reason:'Both temporary equipment slots are full.',rogue};
 if(rogue.flux<item.cost)return {ok:false,reason:'Not enough Flux for '+item.name+'.',rogue};
 return {ok:true,reason:'Stored '+item.name,rogue:{
   ...rogue,flux:rogue.flux-item.cost,spent:rogue.spent+item.cost,
   tempSlots:[...heldConsumables(rogue),id],
   ...(id===PULSE_ITEM.id?{pulse:rogue.pulse+1,pulseBought:rogue.pulseBought+1}:
     {tempBought:[...(rogue.tempBought||[]),id]})
 }};
}
export function purchasePulse(rogue,sector){return purchaseTemporary(rogue,PULSE_ITEM.id,sector);}
export function armTemporary(rogue,id){
 const item=TEMP_ITEM_BY_ID[id];
 if(!item||item.action!=='score'||!heldConsumables(rogue).includes(id))
   return {ok:false,reason:'Choose a stored score booster.',rogue};
 return {ok:true,reason:'Armed '+item.name,rogue:{...rogue,armed:id}};
}
export function consumeTemporary(rogue,id){
 if(!heldConsumables(rogue).includes(id))return rogue;
 const slots=heldConsumables(rogue),at=slots.indexOf(id);slots.splice(at,1);
 return {...rogue,tempSlots:slots,armed:rogue.armed===id?null:rogue.armed,
   ...(id===PULSE_ITEM.id?{pulse:rogue.pulse-1,pulseUsed:rogue.pulseUsed+1}:
     {tempUsed:[...(rogue.tempUsed||[]),id]})};
}
export function consumePulse(rogue){return consumeTemporary(rogue,PULSE_ITEM.id);}
export function rogueRackOptions(rogue){
 return {minBlanks:owns(rogue,'wild-beacon')?2:1,
         preferAdvancedOperators:owns(rogue,'operator-reserve'),
         numberSlots:owns(rogue,'wide-rack')?6:5};
}
export function consumeBoardEcho(rogue,used=[]){
 if(!used.length)return rogue;
 return {...rogue,echoed:[...new Set([...(rogue.echoed||[]),...used])]};
}
export function earnMoveFlux(rogue,pending){
 const newlyPlaced=Object.entries(pending).filter(([,tile])=>tile.value!=='=');
 let earned=0;
 if(owns(rogue,'precision-pay')&&newlyPlaced.length&&newlyPlaced.every(([,tile])=>!tile.blank))earned+=2;
 if(owns(rogue,'premium-dividend')){
   for(const [index] of newlyPlaced){
     const [row,col]=coords(Number(index));
     if(['2T','3T','2E','3E'].includes(bonusAt(row,col)))earned++;
   }
 }
 if(!earned)return {rogue,amount:0};
 return {rogue:{...rogue,flux:rogue.flux+earned,earned:rogue.earned+earned},amount:earned};
}
export function useTileTemporary(rogue,rack,bag,id,tileId,random=randomFloat){
 const item=TEMP_ITEM_BY_ID[id];
 if(item?.action!=='tile'||!heldConsumables(rogue).includes(id))
   return {ok:false,reason:'That tile tool is unavailable.',rogue,rack,bag};
 const tile=rack.find(t=>t.id===tileId);
 if(!tile)return {ok:false,reason:'Choose a tile from your rack.',rogue,rack,bag};
 const samePool=t=>((t.blank==='blank-operator'||['+','−','×','÷'].includes(t.value))?
   'operators':'numbers')===((tile.blank==='blank-operator'||['+','−','×','÷'].includes(tile.value))?
   'operators':'numbers');
 const plainDigit=/^[0-9]$/.test(tile.value)&&!tile.blank;
 let match=()=>false;
 if(id==='step-up'||id==='step-down'){
   if(!plainDigit)return {ok:false,reason:'Choose a physical number tile.',rogue,rack,bag};
   const next=Number(tile.value)+(id==='step-up'?1:-1);
   if(next<0||next>9)return {ok:false,reason:'The number must stay between 0 and 9.',rogue,rack,bag};
   match=t=>!t.blank&&t.value===String(next);
 }else if(id==='operator-shift'){
   const map={'+':'×','×':'+','−':'÷','÷':'−'};
   if(tile.blank||!map[tile.value])
     return {ok:false,reason:'Choose a physical +, −, × or ÷ tile.',rogue,rack,bag};
   match=t=>!t.blank&&t.value===map[tile.value];
 }else if(id==='wildcard-hunt'){
   match=t=>Boolean(t.blank)&&samePool(t);
 }else if(id==='recycle-tile'){
   match=t=>samePool(t)&&(t.value!==tile.value||t.blank!==tile.blank);
 }
 const at=bag.findIndex(match);
 if(at<0)return {ok:false,reason:'No suitable replacement remains in that bag.',rogue,rack,bag};
 const newBag=[...bag],replacement=newBag.splice(at,1)[0];
 const newRack=rack.map(t=>t.id===tileId?replacement:t);
 newBag.push(tile);
 for(let i=newBag.length-1;i>0;i--){
   const j=Math.min(i,Math.floor(random()*(i+1)));
   [newBag[i],newBag[j]]=[newBag[j],newBag[i]];
 }
 return {ok:true,reason:item.name+': '+(tile.value||tile.blank)+' → '+(replacement.value||replacement.blank),
   rogue:consumeTemporary(rogue,id),rack:newRack,bag:newBag};
}
export function fluxReward(score,turn,rogue){
 const base=4+Math.floor(score/30)+Math.max(0,TURNS_PER_SECTOR-turn);
 return base+(owns(rogue,'flux-recycler')?3:0);
}
export function rewardSector(rogue,sector,score,turn){
 if(rogue.shopSector>=sector)return {rogue,reward:0};
 const amount=fluxReward(score,turn,rogue);
 return {reward:amount,rogue:{
   ...rogue,flux:rogue.flux+amount,earned:rogue.earned+amount,
   lastReward:amount,shopSector:sector
 }};
}
export function scoreRogueMove(board,pending,move,rogue,sector){
 const base=scoreMove(board,pending,move);
 let adjustedBase=base.base,multiplier=base.multiplier,additional=0,boost=0;
 const tileScores=base.tileScores.map(tile=>({...tile}));
 const effects=[],echoedIndices=[];
 const anomaly=anomalyForSector(sector);
 const isJam=anomaly?.id==='signal-jam',isStatic=anomaly?.id==='tile-static';
 for(const index of move.indices){
   const tile=pending[index]||board[index];
   if(!tile||tile.value==='=')continue;
   const [r,c]=coords(index),bonus=bonusAt(r,c),newTile=Boolean(pending[index]);
   if(!newTile){
     // Second Spark reactivates a covered premium space once (not repeatedly).
     if(owns(rogue,'bonus-echo')&&['2T','3T','2E','3E'].includes(bonus)&&
        !(rogue.echoed||[]).includes(index)){
       echoedIndices.push(index);
       if(bonus==='2T'||bonus==='3T'){
         const factor=bonus==='2T'&&owns(rogue,'amplifier')?3:bonus==='3T'&&!isStatic?3:2;
         const extra=(factor-1)*tile.points;
         adjustedBase+=extra;
         const item=tileScores.find(x=>x.index===index);item.points+=extra;
       }else if(!(isJam&&bonus==='2E')){
         multiplier*=bonus==='2E'?2:3;
       }
       effects.push('Second Spark reused a premium square');
     }
     continue;
   }
   const originalFactor=bonus==='2T'?2:bonus==='3T'?3:1;
   const newFactor=bonus==='2T'&&owns(rogue,'amplifier')?3:
     bonus==='3T'&&isStatic?2:originalFactor;
   const tileAward=tileScores.find(entry=>entry.index===index);
   const squareDelta=(newFactor-originalFactor)*tile.points;
   adjustedBase+=squareDelta;tileAward.points+=squareDelta;
   if(newFactor!==originalFactor)
     effects.push(newFactor>originalFactor?'Amplified tile square':'Static reduced triple tile');
   if(!tile.blank){
     const odd=/^[13579]$/.test(tile.value);
     const extra=(tile.value==='7'&&owns(rogue,'ion-seven')?3:0)+
       (['×','÷'].includes(tile.value)&&owns(rogue,'operator-core')?3:0)+
       (odd&&owns(rogue,'odd-charge')?2:0);
     const powered=extra*newFactor;
     adjustedBase+=powered;tileAward.points+=powered;boost+=powered;
   }
 }
 if(isJam){
   const disabled=move.indices.filter(i=>{
     if(!pending[i]||pending[i].value==='=')return false;
     const [r,c]=coords(i);return bonusAt(r,c)==='2E';
   }).length;
   multiplier/=2**disabled;
   if(disabled)effects.push('Signal Jam suppressed '+disabled+' double-equation square(s)');
 }
 if(owns(rogue,'crosslink')&&base.crossing){
   additional+=5;effects.push('Crosslink +5');
 }
 if(owns(rogue,'longwave')&&move.indices.length>=7){
   additional+=7;effects.push('Longwave +7');
 }
 const placed=Object.values(pending).filter(t=>t.value!=='=').length;
 if(owns(rogue,'echo')&&placed>4){
   const amount=(placed-4)*2;additional+=amount;effects.push('Echo +'+amount);
 }
 if(owns(rogue,'length-matrix')&&move.indices.length>5){
   const amount=(move.indices.length-5)*2;
   additional+=amount;effects.push('Stretch Matrix +'+amount);
 }
 if(owns(rogue,'starter-spark')&&board.every(t=>!t)){
   additional+=6;effects.push('Core Igniter +6');
 }
 if(boost)effects.push('Powered tiles +'+boost);
 const tempApplied=armedConsumable(rogue);
 if(tempApplied==='pulse-charge'){
   additional+=12;effects.push('Pulse Capacitor +12 (single-use)');
 }
 const sweep=placed===rackSlots(rogue)?20:0;
 let prePenalty=adjustedBase*multiplier+base.length+sweep+
   base.equation+base.crossing+additional;
 let anomalyPenalty=0;
 if(anomaly?.id==='power-leak'&&!owns(rogue,'leak-shield')){
   anomalyPenalty=Math.floor(prePenalty*.15);
   effects.push('Power Leak −'+anomalyPenalty);
 }else if(anomaly?.id==='power-leak'){
   effects.push('Leak Shield protected your energy');
 }
 const originalTotal=Math.max(0,prePenalty-anomalyPenalty);
 let total=originalTotal;
 if(tempApplied==='double-score'){
   total*=2;effects.push('Double Reactor ×2 (single-use)');
 }else if(tempApplied==='power-surge'){
   total+=Math.floor(total*.5);effects.push('Power Surge +50% (single-use)');
 }
 return {...base,base:adjustedBase,tileScores,multiplier,sweep,extra:additional,
   temporaryBoost:total-originalTotal,
   anomalyPenalty,anomaly:anomaly?.id||null,
   upgrades:effects,total,echoedIndices,
   tempApplied:TEMP_ITEM_BY_ID[tempApplied]?.action==='score'?tempApplied:null};
}
export function validRogueState(rogue,sector,phase){
 const integer=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
 if(!rogue||typeof rogue!=='object'||Array.isArray(rogue))return false;
 if(!integer(rogue.flux,0,100000000)||!integer(rogue.earned,0,100000000)||
    !integer(rogue.spent,0,100000000)||rogue.flux!==rogue.earned-rogue.spent)return false;
 if(!integer(rogue.shopSector,0,99)||rogue.shopSector>sector||!integer(rogue.lastReward,0,10000))return false;
 // Old saves can still carry up to three capacitors; no new shop purchases
 // may ever exceed two temporary slots.
 if(!integer(rogue.pulse,0,3)||!integer(rogue.pulseBought,0,10000)||
    !integer(rogue.pulseUsed,0,10000)||rogue.pulse!==rogue.pulseBought-rogue.pulseUsed)return false;
 if(!Array.isArray(rogue.upgrades)||rogue.upgrades.length>ROGUE_ITEMS.length ||
    new Set(rogue.upgrades).size!==rogue.upgrades.length||
    !rogue.upgrades.every(id=>Boolean(ROGUE_ITEM_BY_ID[id])))return false;
 const bought=rogue.tempBought||[],used=rogue.tempUsed||[];
 if(!Array.isArray(bought)||!Array.isArray(used)||bought.length>10000||used.length>10000||
    ![...bought,...used].every(id=>id!=='pulse-charge'&&Boolean(TEMP_ITEM_BY_ID[id])))return false;
 const available=new Map();
 for(const id of bought)available.set(id,(available.get(id)||0)+1);
 for(const id of used)available.set(id,(available.get(id)||0)-1);
 if([...available.values()].some(n=>n<0))return false;
 const expected=[...Array.from({length:rogue.pulse},()=>PULSE_ITEM.id)];
 for(const [id,count] of available)for(let i=0;i<count;i++)expected.push(id);
 if(rogue.tempSlots!==undefined){
   if(!Array.isArray(rogue.tempSlots)||rogue.tempSlots.length>MAX_TEMPORARY_SLOTS||
      !rogue.tempSlots.every(id=>Boolean(TEMP_ITEM_BY_ID[id])))return false;
   const tally=list=>Object.entries(list.reduce((m,id)=>(m[id]=(m[id]||0)+1,m),{}))
     .sort((a,b)=>a[0].localeCompare(b[0]));
   if(JSON.stringify(tally(rogue.tempSlots))!==JSON.stringify(tally(expected)))return false;
 }else if(bought.length||used.length)return false;
 if(rogue.armed!=null&&(!expected.includes(rogue.armed)||
    TEMP_ITEM_BY_ID[rogue.armed]?.action!=='score'))return false;
 if(!integer(rogue.swapTurn??0,0,7)||!integer(rogue.swapsUsed??0,0,2))return false;
 const echoed=rogue.echoed||[];
 if(!Array.isArray(echoed)||echoed.length>169||
    new Set(echoed).size!==echoed.length||!echoed.every(x=>integer(x,0,168)))return false;
 if(rogue.spent!==rogue.upgrades.reduce((sum,id)=>sum+ROGUE_ITEM_BY_ID[id].cost,0)+
    rogue.pulseBought*PULSE_ITEM.cost+bought.reduce((sum,id)=>sum+TEMP_ITEM_BY_ID[id].cost,0))return false;
 if(phase==='won'&&rogue.shopSector!==sector)return false;
 if(phase==='playing'&&rogue.shopSector>=sector)return false;
 return true;
}
