// The Drift: self-contained roguelike economy, anomalies and scoring.
import {bonusAt,coords,isBlank,isDigit,scoreMove,nextTarget,TURNS_PER_SECTOR} from './engine.js';

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
 return rogue?.tempSlots?[...rogue.tempSlots]:
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
 return {flux:0,earned:0,spent:0,upgrades:[],shopSector:0,lastReward:0,pulse:0,pulseBought:0,pulseUsed:0};
}
const owns=(rogue,id)=>Boolean(rogue?.upgrades?.includes(id));
export function shopOffers(sector,rogue){
 const unowned=ROGUE_ITEMS.filter(item=>!owns(rogue,item.id));
 if(!unowned.length)return [];
 // Four choices, rotating with the sector, while purchased upgrades disappear.
 // Fresh runs always offer four complementary directions for a first build.
 if(sector===1)return unowned.slice(0,4);
 const start=((sector-1)*3)%ROGUE_ITEMS.length;
 const ordered=[...ROGUE_ITEMS.slice(start),...ROGUE_ITEMS.slice(0,start)];
 return ordered.filter(item=>!owns(rogue,item.id)).slice(0,4);
}
export function purchaseUpgrade(rogue,id,sector){
 const item=ROGUE_ITEM_BY_ID[id];
 if(!item)return {ok:false,reason:'Unknown shop upgrade.',rogue};
 if(!Number.isInteger(sector)||sector<1||rogue.shopSector!==sector)
   return {ok:false,reason:'Upgrades can only be purchased in the current Salvage Bay.',rogue};
 if(owns(rogue,id))return {ok:false,reason:'You already own that upgrade.',rogue};
 if(!shopOffers(sector,rogue).some(offer=>offer.id===id))
   return {ok:false,reason:'That upgrade is not offered in this sector.',rogue};
 if(rogue.flux<item.cost)return {ok:false,reason:'Not enough Flux for this upgrade.',rogue};
 return {ok:true,reason:'Purchased '+item.name,rogue:{
   ...rogue,flux:rogue.flux-item.cost,spent:rogue.spent+item.cost,
   upgrades:[...rogue.upgrades,id]
 }};
}
export function purchasePulse(rogue,sector){
 if(rogue.shopSector!==sector)return {ok:false,reason:'The Salvage Bay is not open.',rogue};
 if(rogue.pulse>=3)return {ok:false,reason:'You can carry at most three Pulse Capacitors.',rogue};
 if(rogue.flux<PULSE_ITEM.cost)return {ok:false,reason:'Not enough Flux for a Pulse Capacitor.',rogue};
 return {ok:true,reason:'Pulse Capacitor charged',rogue:{
   ...rogue,flux:rogue.flux-PULSE_ITEM.cost,
   spent:rogue.spent+PULSE_ITEM.cost,pulse:rogue.pulse+1,pulseBought:rogue.pulseBought+1
 }};
}
export function consumePulse(rogue){
 return rogue.pulse>0?{...rogue,pulse:rogue.pulse-1,pulseUsed:rogue.pulseUsed+1}:rogue;
}
export function rogueRackOptions(rogue){
 return {minBlanks:owns(rogue,'wild-beacon')?2:1,
         preferAdvancedOperators:owns(rogue,'operator-reserve')};
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
 let adjustedBase=base.base, multiplier=base.multiplier;
 const tileScores=base.tileScores.map(tile=>({...tile}));
 let additional=0,boost=0;
 const effects=[];
 const anomaly=anomalyForSector(sector);
 const isJam=anomaly?.id==='signal-jam';
 const isStatic=anomaly?.id==='tile-static';
 for(const index of move.indices){
   const tile=pending[index];if(!tile||tile.value==='=')continue;
   const [r,c]=coords(index),bonus=bonusAt(r,c);
   const originalFactor=bonus==='2T'?2:bonus==='3T'?3:1;
   const newFactor=bonus==='2T'&&owns(rogue,'amplifier')?3:
     bonus==='3T'&&isStatic?2:originalFactor;
   const tileAward=tileScores.find(entry=>entry.index===index);
   const squareDelta=(newFactor-originalFactor)*tile.points;
   adjustedBase+=squareDelta;tileAward.points+=squareDelta;
   if(newFactor!==originalFactor){
     effects.push(newFactor>originalFactor?'Amplified tile square':'Static reduced triple tile');
   }
   if(!tile.blank){
     const extra=(tile.value==='7'&&owns(rogue,'ion-seven')?3:0)+
       (['×','÷'].includes(tile.value)&&owns(rogue,'operator-core')?3:0);
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
 if(boost)effects.push('Powered tiles +'+boost);
 if(rogue.pulse>0){additional+=12;effects.push('Pulse Capacitor +12 (single-use)');}
 let prePenalty=adjustedBase*multiplier+base.length+base.sweep+base.equation+base.crossing+additional;
 let anomalyPenalty=0;
 if(anomaly?.id==='power-leak'&&!owns(rogue,'leak-shield')){
   anomalyPenalty=Math.floor(prePenalty*.15);
   effects.push('Power Leak −'+anomalyPenalty);
 }else if(anomaly?.id==='power-leak'){
   effects.push('Leak Shield protected your energy');
 }
 return {...base,base:adjustedBase,tileScores,multiplier,extra:additional,
   anomalyPenalty,anomaly:anomaly?.id||null,
   upgrades:effects,total:Math.max(0,prePenalty-anomalyPenalty)};
}
export function validRogueState(rogue,sector,phase){
 const integer=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
 if(!rogue||typeof rogue!=='object'||Array.isArray(rogue))return false;
 if(!integer(rogue.flux,0,100000000)||!integer(rogue.earned,0,100000000)||
    !integer(rogue.spent,0,100000000)||rogue.flux!==rogue.earned-rogue.spent)return false;
 if(!integer(rogue.shopSector,0,99)||rogue.shopSector>sector||!integer(rogue.lastReward,0,10000))return false;
 if(!integer(rogue.pulse,0,3)||!integer(rogue.pulseBought,0,10000)||!integer(rogue.pulseUsed,0,10000)||rogue.pulse!==rogue.pulseBought-rogue.pulseUsed)return false;
 if(!Array.isArray(rogue.upgrades)||rogue.upgrades.length>ROGUE_ITEMS.length ||
    new Set(rogue.upgrades).size!==rogue.upgrades.length||
    !rogue.upgrades.every(id=>Boolean(ROGUE_ITEM_BY_ID[id])))return false;
 if(rogue.spent!==rogue.upgrades.reduce((sum,id)=>sum+ROGUE_ITEM_BY_ID[id].cost,0)+rogue.pulseBought*PULSE_ITEM.cost)return false;
 if(phase==='won'&&rogue.shopSector!==sector)return false;
 if(phase==='playing'&&rogue.shopSector>=sector)return false;
 return true;
}
