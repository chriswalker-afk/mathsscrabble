// Local 2–4 player match rules. Pure state transitions shared with future
// server-authoritative room logic. No DOM; the UI controls rack privacy.
import {SIZE,HAND_SIZE,tilePool,POINTS,BLANK_KINDS,isDigit,isOperator,makeBag,validateMove,scoreMove} from './engine.js';
import {dealPlayableRack} from './solo.js';
import {acceptPilotAlien,isValidPilotAlien} from './alien/profiles.js';
import {TILE_SET_BY_ID,normalizeTileSet,hasBracketPair,kitRackSize,kitRackOptions,tileValueAllowed} from './tile-sets.js';

export const LOCAL_SAVE_KEY='equa-nova.local-match.v1';
export const LOCAL_VERSION=1;
export const LOCAL_TIMER_OPTIONS=Object.freeze([0,60,90,120]);
export const LOCAL_MAX_HISTORY=500;
const allowedSymbols=new Set(Object.keys(POINTS));
const validInteger=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const nameClean=name=>String(name??'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,20);
const randomSwap=(bag,rng)=>{for(let i=bag.length-1;i>0;i--){const j=Math.min(i,Math.floor(rng()*(i+1)));[bag[i],bag[j]]=[bag[j],bag[i]];}};
export function makeLocalMatch({names=['Pilot 1','Pilot 2'],avatars=null,turnSeconds=0,tileSet='natural'}={},rng=Math.random){
 if(!Object.hasOwn(TILE_SET_BY_ID,tileSet))throw Error('Choose a supported mathematical tile set.');
 if(!Array.isArray(names)||names.length<2||names.length>4)throw Error('Choose 2–4 players.');
 if(!LOCAL_TIMER_OPTIONS.includes(turnSeconds))throw Error('Choose a supported timer.');
 if(avatars!==null&&(!Array.isArray(avatars)||avatars.length!==names.length))
   throw Error('Provide one valid alien avatar for each pilot.');
 const cleaned=names.map(nameClean);
 if(cleaned.some(name=>!name))throw Error('Every player needs a name.');
 if(new Set(cleaned.map(name=>name.toLowerCase())).size!==cleaned.length)throw Error('Player names must be different.');
 let bag=makeBag(rng,tileSet);
 const players=[];
 for(let i=0;i<cleaned.length;i++){
   const deal=dealPlayableRack([],bag,kitRackOptions(tileSet),rng);
   players.push({id:'p'+(i+1),name:cleaned[i],
     avatar:acceptPilotAlien(avatars?.[i],i),
     rack:deal.rack,score:0,scoredMoves:0});
   bag=deal.bag;
 }
 return {
  version:LOCAL_VERSION,tileSet,board:Array(SIZE*SIZE).fill(null),bag,players,
  current:0,round:1,turnNumber:1,turnSeconds,deadline:0,phase:'handover',
  pending:{},placementOrder:[],freeExchangeUsed:false,consecutiveStalls:0,
  history:[],lastAction:null,finishedReason:null,finalScores:null
 };
}
const currentPlayer=match=>match.players[match.current];
export function isLocalTimerExpired(match,now=Date.now()){
 return match.phase==='playing'&&match.turnSeconds>0&&validInteger(match.deadline,1,4102444800000)&&now>=match.deadline;
}
export function readyLocalTurn(match,now=Date.now()){
 if(match.phase!=='handover')throw Error('No handover is waiting.');
 return {...match,phase:'playing',deadline:match.turnSeconds?now+1000*match.turnSeconds:0};
}
const transition=(match,action)=>{
 const history=[...match.history,action].slice(-LOCAL_MAX_HISTORY);
 if(match.finishedReason){
   const finalScores=localStandings(match);
   return {...match,phase:'finished',deadline:0,pending:{},placementOrder:[],
     history,finalScores};
 }
 const next=(match.current+1)%match.players.length;
 return {...match,phase:'handover',current:next,
   round:match.round+(next===0?1:0),turnNumber:match.turnNumber+1,
   deadline:0,pending:{},placementOrder:[],freeExchangeUsed:false,history};
};
function requirePlaying(match){
 if(match.phase!=='playing')throw Error('The player must be ready before taking a turn.');
}
function checkPendingRack(match,pending){
 const rack=currentPlayer(match).rack;
 const ids=new Set();
 for(const [position,tile] of Object.entries(pending)){
   if(!/^(0|[1-9]\d*)$/.test(position)||Number(position)>=SIZE*SIZE||
      !tile||typeof tile!=='object')throw Error('Invalid tile placement.');
   if(tile.value==='=')continue;
   if(ids.has(tile.id))throw Error('A physical tile cannot be placed twice.');
   ids.add(tile.id);
   const original=rack.find(t=>t.id===tile.id);
   if(!original)throw Error('You cannot play another player’s tile.');
   if(original.blank){
     if(original.blank!==tile.blank||!BLANK_KINDS[original.blank].choices.includes(tile.value)||tile.points!==0)
       throw Error('Choose a valid value for your wildcard.');
   }else if(original.value!==tile.value||original.points!==tile.points||original.pairId!==tile.pairId)
     throw Error('The tile must match the one on your rack.');
 }
}
export function scoreLocalTurn(match,pending=match.pending){
 requirePlaying(match);
 checkPendingRack(match,pending);
 const move=validateMove(match.board,pending);
 const points=scoreMove(match.board,pending,move,{rackSize:kitRackSize(match.tileSet)});
 const before=currentPlayer(match);
 const physical=new Set(Object.values(pending).filter(t=>t.value!=='=').map(t=>t.id));
 const board=[...match.board];
 for(const [index,tile] of Object.entries(pending))board[Number(index)]=tile;
 const remaining=before.rack.filter(tile=>!physical.has(tile.id));
 const deal=dealPlayableRack(remaining,match.bag,kitRackOptions(match.tileSet));
 const updated={...before,rack:deal.rack,score:before.score+points.total,scoredMoves:before.scoredMoves+1};
 const players=match.players.map((player,i)=>i===match.current?updated:player);
 const finishedReason=deal.bag.length===0&&deal.rack.length===0?'rack-cleared':null;
 const next={...match,board,bag:deal.bag,players,finishedReason,consecutiveStalls:0};
 const action={type:'score',player:match.current,turn:match.turnNumber,
   equation:move.text,points:points.total,tiles:physical.size,at:Date.now()};
 return {match:transition(next,action),move,points,action};
}
export function passLocalTurn(match,reason='pass'){
 requirePlaying(match);
 if(Object.keys(match.pending).length)throw Error('Clear your unscored tiles before passing.');
 if(!['pass','timeout'].includes(reason))throw Error('Unknown pass reason.');
 const stalls=match.consecutiveStalls+1;
 const finishedReason=stalls>=2*match.players.length?'stalled':null;
 const action={type:reason,player:match.current,turn:match.turnNumber,points:0,at:Date.now()};
 return transition({...match,finishedReason,consecutiveStalls:stalls},action);
}
export function exchangeLocalTiles(match,selectedIds,rng=Math.random){
 requirePlaying(match);
 if(Object.keys(match.pending).length)throw Error('Clear your unscored tiles before exchanging.');
 if(!Array.isArray(selectedIds)||!selectedIds.length||new Set(selectedIds).size!==selectedIds.length)
   throw Error('Choose one or more rack tiles.');
 const player=currentPlayer(match);
 if(selectedIds.some(id=>!player.rack.some(tile=>tile.id===id)))throw Error('Choose tiles from your own rack.');
 if(selectedIds.length>match.bag.length)throw Error('Not enough tiles remain in the bag.');
 const free=selectedIds.length===1&&!match.freeExchangeUsed;
 for(const pool of ['numbers','operators','brackets']){
   if(selectedIds.filter(id=>tilePool(player.rack.find(t=>t.id===id))===pool).length>
      match.bag.filter(t=>tilePool(t)===pool).length)
     throw Error('Not enough '+pool+' remain in that tile bag.');
 }
 const removed=new Set(selectedIds);
 const exchanged=player.rack.filter(tile=>removed.has(tile.id));
 const bracketTiles=exchanged.filter(t=>tilePool(t)==='brackets');
 if(bracketTiles.length){
   // Both halves are a single linked item and can only leave together.
   // A swap must not strand the player without a replacement bracket pair.
   if(bracketTiles.length!==2||bracketTiles[0].pairId!==bracketTiles[1].pairId||
      !bracketTiles.some(t=>t.value==='(')||!bracketTiles.some(t=>t.value===')'))
     throw Error('Exchange both halves of your bracket pair together.');
   const available=new Map();
   for(const t of match.bag)if(t.pairId){
     const pair=available.get(t.pairId)||new Set();pair.add(t.value);available.set(t.pairId,pair);
   }
   if(![...available.values()].some(faces=>faces.has('(')&&faces.has(')'))
     throw Error('Another complete bracket pair must remain in the bag to exchange yours.');
 }
 // Draw replacements before shuffling exchanged tiles back into the bag.
 const retained=player.rack.filter(tile=>!removed.has(tile.id));
 const draw=dealPlayableRack(retained,match.bag,kitRackOptions(match.tileSet),rng);
 const bag=[...draw.bag,...exchanged];randomSwap(bag,rng);
 const updated={...player,rack:draw.rack};
 const players=match.players.map((p,i)=>i===match.current?updated:p);
 const action={type:free?'free-exchange':'exchange',player:match.current,
   turn:match.turnNumber,points:0,tiles:exchanged.length,at:Date.now()};
 const next={...match,players,bag};
 if(free){
   return {match:{...next,freeExchangeUsed:true,history:[...match.history,action].slice(-LOCAL_MAX_HISTORY)},free:true};
 }
 const stalls=match.consecutiveStalls+1;
 return {match:transition({...next,consecutiveStalls:stalls,
   finishedReason:stalls>=2*players.length?'stalled':null},action),free:false};
}
export function localStandings(match){
 const result=match.players.map((player,index)=>{
   const penalty=player.rack.reduce((sum,tile)=>sum+tile.points,0);
   return {index,name:player.name,gross:player.score,penalty,
     net:player.score-penalty,scoredMoves:player.scoredMoves};
 });
 result.sort((a,b)=>b.net-a.net||b.gross-a.gross||a.index-b.index);
 const top=result[0]?.net;
 return result.map((x,i)=>({...x,rank:1+result.filter(y=>y.net>x.net).length,
   winner:x.net===top}));
}
function validSupply(tile,kit){
 if(!tile||typeof tile!=='object'||typeof tile.id!=='string'||tile.id.length>100)return false;
 if(tile.blank)return !tile.pairId&&Boolean(BLANK_KINDS[tile.blank])&&tile.value===null&&tile.points===0;
 if(!allowedSymbols.has(tile.value)||!tileValueAllowed(kit,tile.value)||
    tile.value==='='||tile.points!==POINTS[tile.value])return false;
 return ['(',')'].includes(tile.value)?
   hasBracketPair(kit)&&typeof tile.pairId==='string'&&/^paren-[0-7]$/.test(tile.pairId):
   tile.pairId===undefined;
}
function validPlayed(tile,kit){
 if(!tile||typeof tile!=='object'||typeof tile.id!=='string'||tile.id.length>100)return false;
 if(tile.blank)return !tile.pairId&&Boolean(BLANK_KINDS[tile.blank])&&tile.points===0&&
   BLANK_KINDS[tile.blank].choices.includes(tile.value);
 if(tile.value==='=')return tile.points===0&&!tile.pairId;
 return validSupply(tile,kit);
}
function validPending(match){
 const entries=Object.entries(match.pending);
 if(entries.length>kitRackSize(match.tileSet)+3)return false;
 if(!entries.every(([k,t])=>/^(0|[1-9]\d*)$/.test(k)&&Number(k)<SIZE*SIZE&&
   match.board[Number(k)]===null&&validPlayed(t,match.tileSet)))return false;
 const used=entries.map(([,tile])=>tile).filter(tile=>tile.value!=='=');
 if(new Set(used.map(tile=>tile.id)).size!==used.length)return false;
 const rack=currentPlayer(match).rack;
 if(!used.every(t=>{
   const r=rack.find(item=>item.id===t.id);
   return r&&(r.blank?(r.blank===t.blank&&BLANK_KINDS[r.blank].choices.includes(t.value)):r.value===t.value&&r.points===t.points&&r.pairId===t.pairId);
 }))return false;
 return Array.isArray(match.placementOrder)&&match.placementOrder.length<=kitRackSize(match.tileSet)+3&&
   match.placementOrder.every(i=>validInteger(i,0,SIZE*SIZE-1)&&Object.hasOwn(match.pending,String(i)))&&
   new Set(match.placementOrder).size===match.placementOrder.length;
}
export function validLocalMatch(match){
 if(!match||typeof match!=='object'||match.version!==LOCAL_VERSION)return false;
 const kit=normalizeTileSet(match.tileSet);
 if(match.tileSet!==undefined&&match.tileSet!==kit)return false;
 if(!Array.isArray(match.board)||match.board.length!==SIZE*SIZE||
    !match.board.every(tile=>tile===null||validPlayed(tile,kit)))return false;
 if(!Array.isArray(match.players)||match.players.length<2||match.players.length>4)return false;
 if(!match.players.every((p,i)=>p&&p.id==='p'+(i+1)&&
    (p.avatar===undefined||isValidPilotAlien(p.avatar))&&
    typeof p.name==='string'&&p.name.length>=1&&p.name.length<=20&&
    validInteger(p.score,0,100000000)&&validInteger(p.scoredMoves,0,1000)&&
    Array.isArray(p.rack)&&p.rack.length<=kitRackSize(kit)&&p.rack.every(tile=>validSupply(tile,kit))))return false;
 if(new Set(match.players.map(p=>p.name.toLowerCase())).size!==match.players.length)return false;
 if(!Array.isArray(match.bag)||match.bag.length>151||!match.bag.every(tile=>validSupply(tile,kit)))return false;
 const allPhysical=[...match.board.filter(t=>t&&t.value!=='='),...match.bag,
   ...match.players.flatMap(p=>p.rack)];
 if(allPhysical.length!==151||new Set(allPhysical.map(t=>t.id)).size!==151)return false;
 // Reject corrupted saves that split a bracket pair across the bag, board,
 // or separate players' private racks.
 const scopes=[match.bag,match.board.filter(t=>t&&t.value!=='='),...match.players.map(p=>p.rack)];
 const pairs=new Map();
 for(const [scope,tiles] of scopes.entries())for(const t of tiles)if(t.pairId){
   const members=pairs.get(t.pairId)||[];members.push({scope,value:t.value});pairs.set(t.pairId,members);
 }
 if(hasBracketPair(kit)){
   if(pairs.size!==8||[...pairs.values()].some(group=>group.length!==2||
       group[0].scope!==group[1].scope||
       !group.some(t=>t.value==='(')||!group.some(t=>t.value===')')))return false;
 }else if(pairs.size)return false;
 if(!validInteger(match.current,0,match.players.length-1)||
    !validInteger(match.round,1,10000)||!validInteger(match.turnNumber,1,100000)||
    !LOCAL_TIMER_OPTIONS.includes(match.turnSeconds)||!validInteger(match.deadline,0,4102444800000)||
    !['handover','playing','finished'].includes(match.phase)||
    typeof match.freeExchangeUsed!=='boolean'||
    !validInteger(match.consecutiveStalls,0,2*match.players.length))return false;
 if(!match.pending||typeof match.pending!=='object'||Array.isArray(match.pending)||!validPending(match))return false;
 if(!Array.isArray(match.history)||match.history.length>LOCAL_MAX_HISTORY||
    !match.history.every(x=>x&&['score','pass','timeout','free-exchange','exchange'].includes(x.type)&&
      validInteger(x.player,0,match.players.length-1)&&validInteger(x.turn,1,100000)&&
      validInteger(x.points,0,1000000)))return false;
 if(match.phase==='finished'){
   if(!['stalled','rack-cleared'].includes(match.finishedReason)||Object.keys(match.pending).length)return false;
   if(!Array.isArray(match.finalScores)||match.finalScores.length!==match.players.length)return false;
   const expected=localStandings(match);
   if(match.finalScores.some((x,i)=>x.index!==expected[i].index||x.net!==expected[i].net||
      x.penalty!==expected[i].penalty||x.gross!==expected[i].gross))return false;
 }else if(match.finishedReason!==null||match.finalScores!==null)return false;
 return true;
}
export function saveLocalMatch(storage,match){
 try{
   if(!validLocalMatch(match))return false;
   storage?.setItem(LOCAL_SAVE_KEY,JSON.stringify(match));
   return Boolean(storage);
 }catch{return false;}
}
export function loadLocalMatch(storage,{privateOnResume=true}={}){
 try{
   const raw=storage?.getItem(LOCAL_SAVE_KEY);
   if(!raw||raw.length>300000)return null;
   const match=JSON.parse(raw);
   if(!validLocalMatch(match))return null;
   // After a reload, rack visibility must require a new handover tap; retain
   // unfinished placements for the SAME player and pause their turn timer.
   return privateOnResume&&match.phase==='playing'?
     {...match,phase:'handover',deadline:0}:match;
 }catch{return null;}
}
