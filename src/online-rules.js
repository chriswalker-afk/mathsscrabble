// Authoritative online game rules. Shared BIDMAS and finite-tile logic with
// local play; the Worker never trusts a client-supplied score or tile value.
import {SIZE,POINTS,BLANK_KINDS,makeTile,randomFloat} from './engine.js';
import {summarizeBag} from './bag-inventory.js';
import {acceptPilotAlien,isValidPilotAlien,safePilotAlien} from './alien/profiles.js';
import {makeLocalMatch,readyLocalTurn,scoreLocalTurn,passLocalTurn,
  exchangeLocalTiles,localStandings,isLocalTimerExpired} from './multiplayer.js';

export const ONLINE_VERSION=1;
export const CODE_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH=6;
export const ROOM_TIMERS=Object.freeze([0,60,90,120]);
export const ROOM_MAX_ACTIONS=80;
export const LOBBY_LIFETIME=6*60*60*1000;
export const GAME_LIFETIME=24*60*60*1000;
export const FINISHED_LIFETIME=6*60*60*1000;
export const MAX_ROOM_HISTORY=12;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const number=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const last=(array,n)=>array.slice(Math.max(0,array.length-n));
export class OnlineError extends Error {
 constructor(message,status=400){super(message);this.name='OnlineError';this.status=status;}
}
export function roomCode(randomBytes) {
 if(!randomBytes||randomBytes.length<ROOM_CODE_LENGTH)throw new OnlineError('Random bytes required');
 return Array.from(randomBytes).slice(0,ROOM_CODE_LENGTH).map(n=>CODE_ALPHABET[n%CODE_ALPHABET.length]).join('');
}
export function cleanRoomCode(code){
 return typeof code==='string'&&new RegExp('^['+CODE_ALPHABET+']{6}$').test(code.toUpperCase())
  ?code.toUpperCase():null;
}
export function cleanPilotName(name){
 if(typeof name!=='string')throw new OnlineError('Please enter a pilot name.');
 const clean=name.replace(/[\u0000-\u001f\u007f<>]/g,'').replace(/\s+/g,' ').trim();
 if(clean.length<1||clean.length>20)throw new OnlineError('Use a name of 1–20 characters.');
 return clean;
}
function cleanPilotAvatar(value,index=0){
 try{return acceptPilotAlien(value,index);}
 catch{throw new OnlineError('Choose a valid Alien Lab pilot. Only approved parts and colours are allowed.',400);}
}
function requireHash(hash){
 if(typeof hash!=='string'||!/^[a-f0-9]{64}$/.test(hash))throw new OnlineError('Invalid player credential.',401);
}
function requireRoom(room,now){
 if(!room||room.version!==ONLINE_VERSION)throw new OnlineError('This room does not exist.',404);
 if(room.expiresAt<=now)throw new OnlineError('This room has expired.',410);
}
function identity(room,hash){
 requireHash(hash);
 const i=room.people.findIndex(p=>p.tokenHash===hash);
 if(i<0)throw new OnlineError('Your access key does not belong to this room.',401);
 return i;
}
function shortReceipt(room,index,reqId){
 return room.receipts.find(p=>p.who===index&&p.id===reqId);
}
function validateMutation(room,index,request){
 if(!request||typeof request!=='object'||Array.isArray(request))
  throw new OnlineError('Invalid request.');
 if(typeof request.id!=='string'||!/^[a-zA-Z0-9-]{12,80}$/.test(request.id))
  throw new OnlineError('Invalid action identifier.');
 const replay=shortReceipt(room,index,request.id);
 if(replay)return replay;
 if(!number(request.revision,1,1000000)||request.revision!==room.revision)
  throw new OnlineError('Room updated since your last view. Refresh and try again.',409);
 return null;
}
function addReceipt(room,index,request,result){
 return {...room,receipts:last([...room.receipts,{who:index,id:request.id,result}],ROOM_MAX_ACTIONS)};
}
export function makeOnlineLobby({code,hostName,hostHash,hostAvatar=null,maxPlayers=4,turnSeconds=90,now=Date.now()}){
 const cleanCode=cleanRoomCode(code),name=cleanPilotName(hostName);
 requireHash(hostHash);
 if(!cleanCode)throw new OnlineError('Invalid room code.');
 if(!number(maxPlayers,2,4)||!ROOM_TIMERS.includes(turnSeconds))
  throw new OnlineError('Choose 2–4 players and a supported turn timer.');
 return {
  version:ONLINE_VERSION,code:cleanCode,revision:1,phase:'lobby',
  maxPlayers,turnSeconds,createdAt:now,updatedAt:now,
  expiresAt:now+LOBBY_LIFETIME,
  people:[{id:'p1',name,tokenHash:hostHash,avatar:cleanPilotAvatar(hostAvatar,0)}],
  match:null,receipts:[]
 };
}
export function joinOnlineLobby(room,displayName,tokenHash,now=Date.now(),avatar=null){
 requireRoom(room,now);requireHash(tokenHash);
 if(room.phase!=='lobby')throw new OnlineError('This match has already started.',409);
 if(room.people.length>=room.maxPlayers)throw new OnlineError('This room is full.',409);
 const name=cleanPilotName(displayName);
 if(room.people.some(p=>p.name.toLowerCase()===name.toLowerCase()))
  throw new OnlineError('That pilot name is already taken.',409);
 const people=[...room.people,{id:'p'+(room.people.length+1),name,tokenHash,
   avatar:cleanPilotAvatar(avatar,room.people.length)}];
 return {...room,people,revision:room.revision+1,updatedAt:now,expiresAt:now+LOBBY_LIFETIME};
}
export function leaveOnlineLobby(room,hash,request,now=Date.now()){
 requireRoom(room,now);requireHash(hash);
 // An acknowledged departure remains idempotent even after its player seat
 // is removed; only the same private credential may replay that response.
 const completed=room.receipts.find(r=>r.id===request?.id&&r.departedHash===hash);
 if(completed)return {room,replayed:true,result:completed.result};
 const index=identity(room,hash),replay=validateMutation(room,index,request);
 if(replay)return {room,replayed:true,result:replay.result};
 if(room.phase!=='lobby')throw new OnlineError('Players cannot leave a match in progress. Reconnect or wait for a turn.',409);
 const people=room.people.filter((_,i)=>i!==index).map((p,i)=>({...p,id:'p'+(i+1)}));
 // A room with no pilots is closed so its join code cannot be reused.
 const result={type:'left'};
 const updated=addReceipt({...room,people,revision:room.revision+1,updatedAt:now,
   phase:people.length?'lobby':'closed',expiresAt:people.length?now+LOBBY_LIFETIME:now+60_000},index,request,result);
 updated.receipts[updated.receipts.length-1].departedHash=hash;
 return {room:updated,result};
}
/** Only the authenticated room seat can change its public avatar in the
 * waiting lobby. Validated, revision-checked and idempotent. No midgame edits.
 */
export function updateOnlinePilot(room,hash,request,now=Date.now()){
 requireRoom(room,now);
 const index=identity(room,hash),replay=validateMutation(room,index,request);
 if(replay)return {room,replayed:true,result:replay.result};
 if(room.phase!=='lobby')throw new OnlineError('Alien designs are locked after the match starts.',409);
 if(request.avatar===undefined||request.avatar===null)
  throw new OnlineError('An alien design is required.');
 const avatar=cleanPilotAvatar(request.avatar,index);
 const people=room.people.map((p,i)=>i===index?{...p,avatar}:p);
 const result={type:'avatar-updated',by:index};
 return {room:addReceipt({...room,people,revision:room.revision+1,
   updatedAt:now,expiresAt:now+LOBBY_LIFETIME},index,request,result),result};
}
export function startOnlineMatch(room,hash,request,now=Date.now(),rng=randomFloat){
 requireRoom(room,now);
 const index=identity(room,hash),replay=validateMutation(room,index,request);
 if(replay)return {room,replayed:true,result:replay.result};
 if(index!==0)throw new OnlineError('Only the room host can start the match.',403);
 if(room.phase!=='lobby')throw new OnlineError('The match has already started.',409);
 if(room.people.length<2)throw new OnlineError('At least two pilots must join before starting.');
 let match=makeLocalMatch({names:room.people.map(p=>p.name),
   avatars:room.people.map((p,i)=>safePilotAlien(p.avatar,i)),
   turnSeconds:room.turnSeconds},rng);
 match=readyLocalTurn(match,now);
 const result={type:'started'};
 const updated=addReceipt({...room,phase:'playing',match,revision:room.revision+1,
   updatedAt:now,expiresAt:now+GAME_LIFETIME},index,request,result);
 return {room:updated,result};
}
function receivedPlacement(match,placements){
 if(!Array.isArray(placements)||placements.length<3||placements.length>12)
  throw new OnlineError('Place one complete equation using your own tiles.');
 const pending={},ids=new Set(),rack=match.players[match.current].rack;
 for(const raw of placements){
   if(!raw||!number(raw.index,0,SIZE*SIZE-1)||own(pending,raw.index)||
      match.board[raw.index]!==null)throw new OnlineError('Invalid or occupied board square.');
   if(raw.tileId==='='){
     pending[raw.index]=makeTile('=');
     continue;
   }
   if(typeof raw.tileId!=='string'||ids.has(raw.tileId))throw new OnlineError('A tile can be placed only once.');
   const fromRack=rack.find(t=>t.id===raw.tileId);
   if(!fromRack)throw new OnlineError('You cannot use a tile outside your own rack.',403);
   ids.add(raw.tileId);
   if(fromRack.blank){
     const choices=BLANK_KINDS[fromRack.blank]?.choices;
     if(typeof raw.value!=='string'||!choices?.includes(raw.value))
      throw new OnlineError('Select an allowed wildcard value.');
     pending[raw.index]={...fromRack,value:raw.value,points:0};
   }else{
     if(raw.value!==fromRack.value)
      throw new OnlineError('The tile value cannot be changed.');
     pending[raw.index]=fromRack;
   }
 }
 return pending;
}
export function takeOnlineAction(room,hash,request,now=Date.now(),rng=randomFloat){
 requireRoom(room,now);
 const index=identity(room,hash),replay=validateMutation(room,index,request);
 if(replay)return {room,replayed:true,result:replay.result};
 if(room.phase!=='playing'||room.match?.phase!=='playing')throw new OnlineError('The match is not accepting turns.',409);
 if(index!==room.match.current)throw new OnlineError('It is not your turn.',403);
 if(room.turnSeconds&&isLocalTimerExpired(room.match,now))
  throw new OnlineError('Your timer has expired; refresh the room.',409);
 let match, result;
 if(request.type==='score'){
   const pending=receivedPlacement(room.match,request.placements);
   try{
     const done=scoreLocalTurn({...room.match,pending,placementOrder:Object.keys(pending).map(Number)});
     match=done.match;
     result={type:'scored',points:done.points,move:{
       text:done.move.text,indices:done.move.indices},by:index};
   }catch(err){
     // Mathematical failures are retryable and never consume the turn.
     throw new OnlineError(err.message||'That equation is not valid.');
   }
 }else if(request.type==='pass'){
   match=passLocalTurn(room.match);
   result={type:'passed',by:index};
 }else if(request.type==='exchange'){
   if(!Array.isArray(request.ids)||request.ids.length<1||request.ids.length>8||
     request.ids.some(id=>typeof id!=='string'))
     throw new OnlineError('Choose up to eight tiles in your rack to exchange.');
   try{
     const changed=exchangeLocalTiles(room.match,request.ids,rng);
     match=changed.match;result={type:changed.free?'free-exchange':'exchange',by:index};
   }catch(err){throw new OnlineError(err.message||'Unable to exchange those tiles.');}
 }else throw new OnlineError('Unknown turn action.');
 if(match.phase==='handover')match=readyLocalTurn(match,now);
 const phase=match.phase==='finished'?'finished':'playing';
 const updated=addReceipt({...room,match,phase,revision:room.revision+1,
   updatedAt:now,expiresAt:now+(phase==='finished'?FINISHED_LIFETIME:GAME_LIFETIME)},
   index,request,result);
 return {room:updated,result};
}
export function timeOutOnlineTurn(room,now=Date.now()){
 if(!room||room.phase!=='playing'||!room.match||
    !isLocalTimerExpired(room.match,now))return {room,changed:false};
 // Server clock, never browser timers, is the source of authority.
 let match=passLocalTurn(room.match,'timeout');
 if(match.phase==='handover')match=readyLocalTurn(match,now);
 const phase=match.phase==='finished'?'finished':'playing';
 return {room:{...room,match,phase,revision:room.revision+1,
   updatedAt:now,expiresAt:now+(phase==='finished'?FINISHED_LIFETIME:GAME_LIFETIME)},changed:true};
}
export function viewOnlineRoom(room,hash,now=Date.now()){
 requireRoom(room,now);
 const index=identity(room,hash);
 const match=room.match;
 const player=room.people[index];
 const base={
  code:room.code,revision:room.revision,phase:room.phase,
  maxPlayers:room.maxPlayers,turnSeconds:room.turnSeconds,
  people:room.people.map((p,i)=>({index:i,id:p.id,name:p.name,host:i===0,
     avatar:safePilotAlien(p.avatar,i)})),
  you:{index,id:player.id,name:player.name,host:index===0,
     avatar:safePilotAlien(player.avatar,index)},
  expiresAt:room.expiresAt
 };
 if(!match)return {...base,match:null};
 const players=match.players.map((p,i)=>({
   index:i,name:p.name,avatar:safePilotAlien(room.people[i]?.avatar,i),
    score:p.score,rackCount:p.rack.length,scoredMoves:p.scoredMoves
 }));
 return {...base,match:{
   board:match.board,players,current:match.current,turn:match.turnNumber,
   round:match.round,bagCount:match.bag.length,
   bagInventory:summarizeBag(match.bag),
   rack:match.players[index].rack, // NEVER include the other players' tiles.
   freeExchangeUsed:index===match.current&&match.freeExchangeUsed,
   deadline:match.deadline,
   lastMoves:last(match.history,MAX_ROOM_HISTORY).map(m=>({
     type:m.type,player:m.player,turn:m.turn,points:m.points||0,
     ...(m.equation?{equation:m.equation}:{})
   })),
   ...(match.phase==='finished'?{standings:match.finalScores||localStandings(match),
      reason:match.finishedReason}: {})
 }};
}
export function roomWakeAt(room){
 if(!room)return null;
 const deadline=room.phase==='playing'&&room.match?.deadline>0?
   room.match.deadline:Infinity;
 return Math.min(room.expiresAt,deadline);
}
export function verifyOnlineRoom(room){
 if(!room||room.version!==ONLINE_VERSION||!cleanRoomCode(room.code)||
    !number(room.revision,1,1000000)||!['lobby','playing','finished','closed'].includes(room.phase)||
    !number(room.maxPlayers,2,4)||!ROOM_TIMERS.includes(room.turnSeconds)||
    !Array.isArray(room.people)||room.people.length>room.maxPlayers||
    !room.people.every((p,i)=>p.id==='p'+(i+1)&&
      typeof p.name==='string'&&p.name.length>=1&&p.name.length<=20&&
      (p.avatar===undefined||isValidPilotAlien(p.avatar))&&
      /^[a-f0-9]{64}$/.test(p.tokenHash))||
    new Set(room.people.map(p=>p.name.toLowerCase())).size!==room.people.length||
    !number(room.createdAt,1,4102444800000)||!number(room.expiresAt,1,4102444800000))return false;
 if(room.phase==='lobby'&&room.match!==null)return false;
 if(['playing','finished'].includes(room.phase)&&
   (!room.match||room.match.players.length!==room.people.length||
     room.match.players.some((p,i)=>p.name!==room.people[i].name)))return false;
 if(!Array.isArray(room.receipts)||room.receipts.length>ROOM_MAX_ACTIONS)return false;
 return true;
}
