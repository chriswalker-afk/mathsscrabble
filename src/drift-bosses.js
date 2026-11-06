// Standalone, seeded-by-run Drift zone and boss rules.
// Nothing here contacts a server or changes normal Solo / multiplayer rules.
import {pos} from './engine.js';

export const ZONE_LENGTH=3;
export const BOSS_POOL=Object.freeze([
 {id:'plus-embargo',name:'THE ADDITION EATER',zone:'The Silent Sum Nebula',subtitle:'The hunger between symbols',icon:'⊕',kind:'seal',
  short:'+ tiles sealed from the operator bag this sector',description:'All physical addition tiles are sealed out of your draws for this boss sector. Existing + tiles may still be used; wildcard operators remain flexible.',sealed:'+'},
 {id:'grid-warden',name:'THE GRID WARDEN',zone:'The Obsidian Grid',subtitle:'No path through the iron gates',icon:'⬡',kind:'blocked',
  short:'Eight blocked squares cannot hold tiles',description:'Eight glowing obstruction squares cannot be used for any new tile or equals sign. Find routes around the blockade.'},
 {id:'curse-weaver',name:'THE CURSE WEAVER',zone:'The Crimson Fracture',subtitle:'Every shortcut has a price',icon:'✳',kind:'hazard',
  short:'Rift squares drain 6 energy per new tile',description:'Red rift squares deduct 6 energy for every newly placed physical tile there, after the usual equation bonuses. Scores never go below zero.'},
 {id:'seven-thief',name:'THE SEVEN THIEF',zone:'The Hollow Sevens',subtitle:'A number stripped of power',icon:'7',kind:'drain',
  short:'New 7 tiles score zero points',description:'New physical 7 tiles contribute zero tile points, including tile-type upgrades, even on premium squares. They can still make a correct equation.',drained:'7'},
 {id:'forced-relic',name:'THE RELIC COLLECTOR',zone:'The Relic Vault',subtitle:'A chosen tile must be paid',icon:'✦',kind:'forced',
  short:'The marked rack tile must feature in your next equation',description:'A randomly chosen physical digit is marked in your rack. Your first successfully scored equation must include it. It cannot be swapped or transformed until used.'},
 {id:'minus-embargo',name:'THE SUBTRACTION SPECTRE',zone:'The Vanishing Difference',subtitle:'The missing sign',icon:'−',kind:'seal',
  short:'− tiles sealed from the operator bag this sector',description:'Physical subtraction tiles cannot be drawn this boss sector. Existing − tiles and wildcard choices remain usable.',sealed:'−'},
 {id:'signal-jam',name:'THE SIGNAL PHANTOM',zone:'The Static Expanse',subtitle:'The quiet after the spark',icon:'⌁',kind:'signal',
  short:'2E equation multipliers disabled',description:'All double-equation (2E) squares are jammed during the boss encounter.'},
 {id:'power-leak',name:'THE ENERGY LEECH',zone:'The Draining Deep',subtitle:'The reactor bleeds',icon:'◌',kind:'leak',
  short:'Lose 15% of energy on every score',description:'Every valid equation loses 15% of its energy. An equipped Leak Shield still protects you.'},
 {id:'critical',name:'THE OVERLOADED CORE',zone:'The Overload Belt',subtitle:'More energy. Less mercy.',icon:'!',kind:'target',
  short:'Energy target increased by 20%',description:'The boss must be overcome with 20% more sector energy than usual.'},
 {id:'tile-static',name:'THE CRYSTAL STORM',zone:'The Broken Constellation',subtitle:'Triple sparks turn to double',icon:'✧',kind:'static',
  short:'3T squares score as 2T',description:'Triple-tile spaces only double a newly placed physical tile instead of tripling it.'},
 {id:'short-circuit',name:'THE CIRCUIT SERPENT',zone:'The Narrow Signal',subtitle:'Long lines are severed',icon:'≋',kind:'length',
  short:'Equations can span at most eight squares',description:'No equation may span more than eight consecutive board squares. Short, precise moves are essential.'},
 {id:'multiplier-leech',name:'THE SPARK DEVOURER',zone:'The Dimming Array',subtitle:'Your doubles fall silent',icon:'×',kind:'weak-tiles',
  short:'2T squares grant no tile multiplier',description:'Double-tile squares provide only the base tile value during this encounter, even with Amplifier Array.'}
]);
export const BOSS_BY_ID=Object.freeze(Object.fromEntries(BOSS_POOL.map(b=>[b.id,b])));
const LEGACY_BOSSES=['power-leak','signal-jam','critical','tile-static'];
export const zoneNumber=sector=>Math.max(1,Math.ceil(sector/ZONE_LENGTH));
export const sectorInZone=sector=>((sector-1)%ZONE_LENGTH)+1;
export const isBossSector=sector=>Number.isInteger(sector)&&sector>0&&sector%ZONE_LENGTH===0;
const legacyBoss=(z)=>BOSS_BY_ID[LEGACY_BOSSES[(z-1)%LEGACY_BOSSES.length]];
export function zoneBoss(rogue,sector){
 const zone=zoneNumber(sector);
 const id=rogue?.zoneBosses?.[zone-1];
 return BOSS_BY_ID[id]||legacyBoss(zone);
}
export function bossForSector(rogue,sector){return isBossSector(sector)?zoneBoss(rogue,sector):null;}
export function zoneInfo(rogue,sector){
 const number=zoneNumber(sector),boss=zoneBoss(rogue,sector);
 return {number,name:boss.zone,boss,stage:sectorInZone(sector),
  start:(number-1)*ZONE_LENGTH+1,end:number*ZONE_LENGTH};
}
// Bosses are selected when each new zone starts and stored in the run save.
// No immediate repeat and no deterministic same-boss start across new games.
export function ensureZoneBoss(rogue,sector,random=Math.random){
 const zone=zoneNumber(sector);
 const list=Array.isArray(rogue.zoneBosses)?[...rogue.zoneBosses]:[];
 // Migration for previous runs: retain the known, originally fixed bosses
 // in zones that were already defeated before the feature was installed.
 const completed=Math.min(zone,Math.floor((rogue.shopSector||0)/ZONE_LENGTH));
 while(list.length<completed)list.push(legacyBoss(list.length+1).id);
 while(list.length<zone){
  const previous=list.at(-1);
  const choices=BOSS_POOL.filter(b=>b.id!==previous);
  const selected=choices[Math.max(0,Math.min(choices.length-1,Math.floor(random()*choices.length)))];
  list.push(selected.id);
 }
 return {...rogue,zoneBosses:list};
}
// Symmetric boss hazards keep the centre and a practical opening route free.
const BLOCKS=[
 [[3,3],[3,9],[9,3],[9,9],[2,6],[10,6],[6,2],[6,10]],
 [[2,2],[2,10],[10,2],[10,10],[4,5],[4,7],[8,5],[8,7]],
 [[3,4],[3,8],[9,4],[9,8],[5,2],[5,10],[7,2],[7,10]]
];
const RIFTS=[
 [[6,3],[6,9],[3,6],[9,6],[4,4],[4,8],[8,4],[8,8]],
 [[6,4],[6,8],[4,6],[8,6],[3,3],[3,9],[9,3],[9,9]],
 [[6,2],[6,10],[2,6],[10,6],[5,5],[5,7],[7,5],[7,7]]
];
export function bossField(rogue,sector){
 const boss=bossForSector(rogue,sector);
 const layout=(zoneNumber(sector)-1)%BLOCKS.length;
 return {boss,blocked:new Set(boss?.kind==='blocked'?BLOCKS[layout].map(([r,c])=>pos(r,c)):[]),
  rifts:new Set(boss?.kind==='hazard'?RIFTS[layout].map(([r,c])=>pos(r,c)):[])};
}
export function blockedAt(rogue,sector,index){return bossField(rogue,sector).blocked.has(index);}
export function restrictedDraws(rogue,sector){
 const boss=bossForSector(rogue,sector);
 return boss?.kind==='seal'?[boss.sealed]:[];
}
export function selectForcedTile(rogue,sector,rack,random=Math.random){
 if(bossForSector(rogue,sector)?.kind!=='forced')return {...rogue,forcedTile:null};
 const digits=rack.filter(t=>!t.blank&&/^[0-9]$/.test(t.value));
 if(!digits.length)return {...rogue,forcedTile:null};
 const index=Math.max(0,Math.min(digits.length-1,Math.floor(random()*digits.length)));
 return {...rogue,forcedTile:digits[index].id};
}
export function validateBossMove(board,pending,move,rogue,sector){
 const boss=bossForSector(rogue,sector);
 if(!boss)return;
 const field=bossField(rogue,sector);
 if(Object.keys(pending).some(index=>field.blocked.has(Number(index))))
  throw Error('This square is blocked by '+boss.name+'. Place your tile elsewhere.');
 if(boss.kind==='length'&&move.indices.length>8)
  throw Error('The Circuit Serpent allows equations of at most eight squares.');
 if(boss.kind==='forced'&&rogue.forcedTile &&
    !Object.values(pending).some(t=>t.id===rogue.forcedTile))
  throw Error('The Relic Collector demands the glowing rack tile in your next equation.');
}
export function resolveBossScore(rogue,sector,pending){
 if(bossForSector(rogue,sector)?.kind==='forced'&&rogue.forcedTile&&
    Object.values(pending).some(t=>t.id===rogue.forcedTile))
  return {...rogue,forcedTile:null};
 return rogue;
}
