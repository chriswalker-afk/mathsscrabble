// Solo-sector rules and local save validation. This module has no DOM dependencies.
import {
 SIZE,HAND_SIZE,NUMBER_SLOTS,OPERATOR_SLOTS,tilePool,POINTS,BLANK_KINDS,isBlank,isDigit,isOperator,nextTarget,randomFloat
} from './engine.js';
import {ROGUE_SAVE_KEY,targetForSector,validRogueState,turnLimit,rackSlots} from './rogue.js';

export const SAVE_KEY='equa-nova.sector-run.v1';
export const INTRO_KEY='equa-nova.intro.seen.v1';
export const SAVE_VERSION=1;
export const MAX_SECTORS=99;

const numberCapable=tile=>isDigit(tile.value)||tile.blank==='blank-number'||tile.blank==='blank-any';
const operatorCapable=tile=>isOperator(tile.value)||tile.blank==='blank-operator'||tile.blank==='blank-any';

/** Fill the rack from two independent physical supply pools.
 * Exactly five number-kind and three operator-kind tiles when available.
 * Held tile positions are preserved; fresh draws are shuffled as one group.
 * Original physical IDs are never replaced or duplicated.
 */
export function dealPlayableRack(held,sourceBag,options={},random=randomFloat){
 const bag=[...sourceBag],rack=[...held];
 const minBlanks=options.minBlanks===2?2:1;
 const numberTarget=options.numberSlots===6?6:NUMBER_SLOTS;
 const excluded=new Set(Array.isArray(options.forbiddenValues)?options.forbiddenValues:[]);
 const eligible=tile=>!excluded.has(tile.value);
 for(const [pool,target] of [['numbers',numberTarget],['operators',OPERATOR_SLOTS]]){
   let count=rack.filter(t=>tilePool(t)===pool).length;
   while(count<target){
     let at=rack.filter(isBlank).length<minBlanks?
       bag.findLastIndex(t=>tilePool(t)===pool&&isBlank(t)&&eligible(t)):-1;
     // Prioritise higher-value operators when the Drift Operator Reserve is installed.
     if(at<0&&pool==='operators'&&options.preferAdvancedOperators)
       at=bag.findLastIndex(t=>(t.value==='×'||t.value==='÷')&&eligible(t));
     if(at<0)at=bag.findLastIndex(t=>tilePool(t)===pool&&eligible(t));
     if(at<0)break;
     rack.push(bag.splice(at,1)[0]);count++;
   }
 }
 const drawn=rack.slice(held.length);
 for(let i=drawn.length-1;i>0;i--){
   const j=Math.min(i,Math.floor(random()*(i+1)));
   [drawn[i],drawn[j]]=[drawn[j],drawn[i]];
 }
 return {rack:[...held,...drawn],bag};
}
export const freshStats=()=>({attempts:0,freeExchanges:0,paidExchanges:0,moves:[]});
export const freshProgress=()=>({startedAt:Date.now(),completed:[],runPoints:0});
export function recordMove(stats,move,points,turn,pending){
 const tiles=Object.values(pending).filter(t=>t.value!=='=');
 return {...stats,moves:[...stats.moves,{
   equation:move.text,turn,points:points.total,length:move.indices.length,
   tiles:tiles.length,wildcards:tiles.filter(isBlank).length,
   crossing:points.crossing,bonuses:[...points.bonuses,...(points.upgrades||[])]
 }]};
}
export function sectorReport(sector,score,turn,stats,success,target=nextTarget(sector)){
 const moves=stats.moves;
 const best=moves.length?moves.reduce((a,b)=>a.points>=b.points?a:b):null;
 const longest=moves.length?moves.reduce((a,b)=>a.length>=b.length?a:b):null;
 return {
  sector,score,target,turnsUsed:turn,success,
  earned:Math.max(0,score-target),short:Math.max(0,target-score),
  equations:moves.length,best,longest,
  invalidAttempts:stats.attempts,freeExchanges:stats.freeExchanges,
  paidExchanges:stats.paidExchanges,moves:moves.map(m=>({...m}))
 };
}
export function completeProgress(progress,report){
 if(!report.success||progress.completed.some(x=>x.sector===report.sector))return progress;
 return {
   ...progress,
   completed:[...progress.completed,report],
   runPoints:progress.runPoints+report.score
 };
}
const validInteger=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
function validTile(tile,kind){
 if(!tile||typeof tile!=='object'||Array.isArray(tile))return false;
 if(typeof tile.id!=='string'||tile.id.length<1||tile.id.length>100)return false;
 if(tile.blank){
   const entry=BLANK_KINDS[tile.blank];
   if(!entry||tile.points!==0)return false;
   return kind==='supply'
      ?tile.value===null
      :entry.choices.includes(tile.value);
 }
 if(tile.value==='=')return kind!=='supply'&&tile.points===0;
 return Object.prototype.hasOwnProperty.call(POINTS,tile.value) &&
   tile.value!=='=' && tile.points===POINTS[tile.value];
}
function validReportMove(move){
 return move&&typeof move==='object'&&
   typeof move.equation==='string'&&move.equation.length>0&&move.equation.length<=80&&
   /^[0-9+−×÷=() ]+$/.test(move.equation)&&
   validInteger(move.points,0,500000)&&validInteger(move.turn,1,7)&&
   validInteger(move.length,2,SIZE)&&validInteger(move.tiles,1,HAND_SIZE+1)&&
   validInteger(move.wildcards,0,HAND_SIZE+1)&&validInteger(move.crossing,0,10)&&
   Array.isArray(move.bonuses)&&move.bonuses.length<=35&&
   move.bonuses.every(b=>typeof b==='string'&&b.length<=100);
}
function validStats(stats){
 return stats&&typeof stats==='object'&&
   validInteger(stats.attempts,0,10000)&&
   validInteger(stats.freeExchanges,0,10000)&&
   validInteger(stats.paidExchanges,0,10000)&&
   Array.isArray(stats.moves)&&stats.moves.length<=7&&stats.moves.every(validReportMove);
}
function validReport(report){
 return report&&typeof report==='object'&&
   validInteger(report.sector,1,MAX_SECTORS)&&
   validInteger(report.score,0,10000000)&&
   validInteger(report.target,1,10000000)&&
   validInteger(report.turnsUsed,1,7)&&typeof report.success==='boolean'&&
   validInteger(report.earned,0,10000000)&&validInteger(report.short,0,10000000)&&
   validInteger(report.equations,0,7)&&validInteger(report.invalidAttempts,0,10000)&&
   validInteger(report.freeExchanges,0,10000)&&validInteger(report.paidExchanges,0,10000)&&
   Array.isArray(report.moves)&&report.moves.length<=7&&report.moves.every(validReportMove);
}
function validProgress(progress){
 return progress&&typeof progress==='object'&&
   validInteger(progress.startedAt,0,4102444800000)&&
   validInteger(progress.runPoints,0,100000000)&&
   Array.isArray(progress.completed)&&progress.completed.length<=MAX_SECTORS&&
   progress.completed.every(validReport)&&
   progress.completed.every(x=>x.success)&&
   new Set(progress.completed.map(x=>x.sector)).size===progress.completed.length&&
   progress.completed.reduce((s,r)=>s+r.score,0)===progress.runPoints;
}
function validSnapshot(data){
 if(!data||typeof data!=='object'||data.version!==SAVE_VERSION)return false;
 const mode=data.mode||'sector';
 if(!['sector','rogue'].includes(mode))return false;
 if(mode==='rogue'&&!validRogueState(data.rogue,data.sector,data.phase))return false;
 if(mode==='sector'&&data.rogue!=null)return false;
 const limit=mode==='rogue'?turnLimit(data.rogue):6;
 const maxRack=mode==='rogue'?rackSlots(data.rogue):HAND_SIZE;
 if(!validInteger(data.freeSwapTurn??0,0,limit))return false;
 if(!validInteger(data.savedAt,0,4102444800000)||
    !validInteger(data.sector,1,MAX_SECTORS)||
    !validInteger(data.turn,1,limit)||
    !validInteger(data.score,0,10000000)||
    !['playing','won','lost'].includes(data.phase))return false;
 if(!Array.isArray(data.board)||data.board.length!==SIZE*SIZE||
    !data.board.every(tile=>tile===null||validTile(tile,'placed')))return false;
 if(!Array.isArray(data.rack)||data.rack.length>maxRack||!data.rack.every(t=>validTile(t,'supply')))return false;
 if(!Array.isArray(data.bag)||data.bag.length>151||!data.bag.every(t=>validTile(t,'supply')))return false;
 if(!data.pending||typeof data.pending!=='object'||Array.isArray(data.pending))return false;
 const entries=Object.entries(data.pending);
 if(entries.length>maxRack+3)return false;
 if(!Array.isArray(data.placementOrder)||data.placementOrder.length>maxRack+3)return false;
 if(!entries.every(([i,t])=>/^(0|[1-9]\d*)$/.test(i)&&
      Number(i)<SIZE*SIZE&&data.board[Number(i)]===null&&validTile(t,'placed')))return false;
 if(!data.placementOrder.every(i=>validInteger(i,0,SIZE*SIZE-1)&&
      Object.hasOwn(data.pending,String(i))))return false;
 if(new Set(data.placementOrder).size!==data.placementOrder.length)return false;
 const ids=new Set();
 const physical=[...data.bag,...data.rack,...data.board.filter(Boolean).filter(t=>t.value!=='=')];
 if(physical.length!==151)return false;
 for(const tile of physical){if(ids.has(tile.id))return false;ids.add(tile.id);}
 for(const [index,tile] of entries){
   if(tile.value==='='){if(tile.points!==0) return false;continue;}
   const match=data.rack.find(t=>t.id===tile.id);
   if(!match||match.blank!==tile.blank||
      (match.blank?!BLANK_KINDS[match.blank].choices.includes(tile.value):match.value!==tile.value))return false;
 }
 if(!validStats(data.stats)||!validProgress(data.progress))return false;
 if(data.progress.completed.some(x=>x.sector>data.sector||(x.sector===data.sector&&data.phase!=='won')))return false;
 const target=targetForSector(mode,data.sector,data.rogue);
 if(data.phase==='won'&&data.score<target)return false;
 if(data.phase==='lost'&&(data.score>=target||data.turn!==limit))return false;
 if(data.phase==='playing'&&(data.score>=target||data.turn>limit))return false;
 if(data.phase!=='playing'&&entries.length>0)return false;
 return true;
}
export function snapshotRun(state){
 return {
  version:SAVE_VERSION,savedAt:Date.now(),
  board:state.board,pending:state.pending,rack:state.rack,bag:state.bag,
  sector:state.sector,turn:state.turn,score:state.score,
   freeSwapTurn:state.freeSwapTurn??0,
  phase:state.phase,placementOrder:state.placementOrder,
  stats:state.stats,progress:state.progress,
  mode:state.mode||'sector',rogue:state.mode==='rogue'?state.rogue:null
 };
}
export function saveRun(storage,state){
 try{
   if(!storage)return false;
   const snapshot=snapshotRun(state);
   if(!validSnapshot(snapshot))return false;
   storage.setItem(state.mode==='rogue'?ROGUE_SAVE_KEY:SAVE_KEY,JSON.stringify(snapshot));
   return true;
 }catch{return false;}
}
export function loadRun(storage,mode='sector'){
 try{
   if(!['sector','rogue'].includes(mode))return null;
   const raw=storage?.getItem(mode==='rogue'?ROGUE_SAVE_KEY:SAVE_KEY);
   if(!raw||raw.length>250000)return null;
   const data=JSON.parse(raw);
   return validSnapshot(data)&&(data.mode||'sector')===mode?data:null;
 }catch{return null;}
}
export function clearRun(storage,mode='sector'){
 try{storage?.removeItem(mode==='rogue'?ROGUE_SAVE_KEY:SAVE_KEY);return true;}catch{return false;}
}
