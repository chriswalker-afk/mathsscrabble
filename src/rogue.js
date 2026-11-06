// The Drift: self-contained roguelike economy, anomalies and scoring.
import {bonusAt,coords,isBlank,isDigit,scoreMove,nextTarget,TURNS_PER_SECTOR} from './engine.js';

export const ROGUE_SAVE_KEY='equa-nova.drift.v1';
export const ACTIVE_MODE_KEY='equa-nova.last-mode.v1';
export const ROGUE_ITEMS=Object.freeze([
 {id:'ion-seven',name:'Ionised Sevens',cost:4,kind:'TILE UPGRADE',icon:'7',description:'Every nonblank 7 you place earns +3 tile points, boosted by its square.'},
 {id:'crosslink',name:'Crosslink Circuit',cost:5,kind:'EQUATION UPGRADE',icon:'⊕',description:'Gain +5 energy when an equation reuses a locked tile.'},
 {id:'longwave',name:'Longwave Coil',cost:5,kind:'EQUATION UPGRADE',icon:'⇥',description:'Gain +7 energy for an equation of seven cells or more.'},
 {id:'wild-beacon',name:'Wildcard Beacon',cost:6,kind:'RACK UPGRADE',icon:'✦',description:'Newly completed racks seek at least two wildcards while the bag permits.'},
 {id:'operator-core',name:'Operator Core',cost:5,kind:'TILE UPGRADE',icon:'×',description:'Newly placed, nonblank × and ÷ tiles earn +3 tile points.'},
 {id:'amplifier',name:'Amplifier Array',cost:7,kind:'BOARD UPGRADE',icon:'3T',description:'Every 2T square behaves like a 3T square for your new tiles.'},
 {id:'echo',name:'Echo Generator',cost:6,kind:'EQUATION UPGRADE',icon:'∞',description:'Score +2 for every newly placed physical tile after the fourth.'},
 {id:'operator-reserve',name:'Operator Reserve',cost:5,kind:'RACK UPGRADE',icon:'◇',description:'New racks seek two operator-capable tiles whenever possible.'},
 {id:'flux-recycler',name:'Flux Recycler',cost:7,kind:'ECONOMY UPGRADE',icon:'◈',description:'Receive three extra Flux whenever you stabilise a sector.'},
 {id:'leak-shield',name:'Leak Shield',cost:7,kind:'DEFENCE UPGRADE',icon:'⬡',description:'Neutralise the Power Leak anomaly on its next appearance.'}
]);
export const ROGUE_ITEM_BY_ID=Object.freeze(Object.fromEntries(ROGUE_ITEMS.map(item=>[item.id,item])));
export const PULSE_ITEM=Object.freeze({
 id:'pulse-charge',name:'Pulse Capacitor',cost:3,kind:'SINGLE-USE',icon:'⚡',
 description:'Your next valid equation gains +12 energy. The charge is consumed only after scoring.'
});
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
         minOperators:owns(rogue,'operator-reserve')?2:1};
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
