// Cloudflare Worker + one SQLite-backed hibernating Durable Object per room.
// Browser clients never send authoritative scores or see opponents' racks.
import {DurableObject} from 'cloudflare:workers';
import {migrateOnlineRoom} from '../src/board-migration.js';
import {roomCode,cleanRoomCode,OnlineError,makeOnlineLobby,joinOnlineLobby,
  leaveOnlineLobby,startOnlineMatch,takeOnlineAction,timeOutOnlineTurn,
  viewOnlineRoom,roomWakeAt,updateOnlinePilot} from '../src/online-rules.js';

// Set this list to the actual GitHub Pages/custom website origins. Requests
// from unknown browser origins are refused; room tokens stay in HTTP headers.
const TRUSTED_ORIGINS=new Set([
 'https://chriswalker-afk.github.io',
 'https://mathsscrabble.mrwalkermaths.com',
 'https://scrabble.mrwalkermaths.com',
 'http://localhost:4173','http://127.0.0.1:4173',
 'http://localhost:8787','http://127.0.0.1:8787'
]);
const responseHeaders=(origin)=>({
 'Cache-Control':'no-store, max-age=0',
 'X-Content-Type-Options':'nosniff',
 'Vary':'Origin',
 ...(origin?{
   'Access-Control-Allow-Origin':origin,
   'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
   'Access-Control-Allow-Headers':'Authorization, Content-Type',
   'Access-Control-Max-Age':'600'
 }:{})
});
const json=(obj,status=200,origin=null)=>Response.json(obj,{
 status,headers:responseHeaders(origin)
});
const isAllowedOrigin=(request)=>{
 const origin=request.headers.get('Origin');
 if(!origin)return true;
 return origin===new URL(request.url).origin||TRUSTED_ORIGINS.has(origin);
};
function token(){
 const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);
 return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}
async function tokenHash(value){
 if(typeof value!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(value))
  throw new OnlineError('A valid private player key is required.',401);
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
async function readBody(request){
 if(Number(request.headers.get('Content-Length')||0)>8192)
  throw new OnlineError('Request is too large.',413);
 const raw=await request.text();
 if(raw.length>8192)throw new OnlineError('Request is too large.',413);
 try{
   const value=JSON.parse(raw);
   if(!value||typeof value!=='object'||Array.isArray(value))
     throw new Error('non-object');
   return value;
 }catch{throw new OnlineError('Send a valid JSON object.');}
}
const bearer=async request=>{
 const match=/^Bearer ([A-Za-z0-9_-]{43})$/.exec(request.headers.get('Authorization')||'');
 if(!match)throw new OnlineError('Rejoin or restore your private access key.',401);
 return tokenHash(match[1]);
};
const allowMethods={
 join:'POST',start:'POST',action:'POST',leave:'POST',profile:'POST',state:'GET',ws:'GET'
};
async function handleApi(request,ctx){
 const url=new URL(request.url);
 const parts=url.pathname.split('/').filter(Boolean);
 const origin=request.headers.get('Origin');
 if(url.pathname==='/api/health'&&request.method==='GET')
   return json({ok:true,service:'EQUA//NOVA Rooms',protocol:1},200,origin);
 if(url.pathname==='/api/rooms'&&request.method==='POST'){
   const body=await readBody(request);
   const playerToken=token(),hash=await tokenHash(playerToken);
   for(let attempt=0;attempt<12;attempt++){
     const seed=new Uint8Array(6);crypto.getRandomValues(seed);
     const code=roomCode(seed);
     const stub=ctx.exports.GameRoom.getByName(code);
     const created=await roomRpc(stub,'create',{
       code,hostName:body.name,hostHash:hash,hostAvatar:body.avatar,
       maxPlayers:body.maxPlayers,turnSeconds:body.turnSeconds,tileSet:body.tileSet??'natural'
     });
     if(created.collision)continue;
     return json({room:created.state,token:playerToken},201,origin);
   }
   throw new OnlineError('Unable to reserve a unique room code. Try again.',503);
 }
 if(parts.length!==4||parts[0]!=='api'||parts[1]!=='rooms')
   throw new OnlineError('Unknown endpoint.',404);
 const code=cleanRoomCode(parts[2]),endpoint=parts[3];
 if(!code||!Object.hasOwn(allowMethods,endpoint))
   throw new OnlineError('Unknown room or operation.',404);
 if(request.method!==allowMethods[endpoint])
   throw new OnlineError('Unsupported method.',405);
 const stub=ctx.exports.GameRoom.getByName(code);
 if(endpoint==='ws'){
   if((request.headers.get('Upgrade')||'').toLowerCase()!=='websocket')
     throw new OnlineError('WebSocket upgrade required.',426);
   // These sockets carry ONLY public revision notifications, never racks,
   // scores to award, credentials, or player-specific information.
   return stub.fetch(request);
 }
 if(endpoint==='join'){
   const body=await readBody(request);
   const playerToken=token(),hash=await tokenHash(playerToken);
   const joined=await roomRpc(stub,'join',body.name,hash,body.avatar);
   return json({room:joined,token:playerToken},201,origin);
 }
 const hash=await bearer(request);
 if(endpoint==='state')return json({room:await roomRpc(stub,'view',hash)},200,origin);
 const action=await readBody(request);
 if(endpoint==='start')return json(await roomRpc(stub,'start',hash,action),200,origin);
 if(endpoint==='profile')return json(await roomRpc(stub,'profile',hash,action),200,origin);
 if(endpoint==='action')return json(await roomRpc(stub,'act',hash,action),200,origin);
 if(endpoint==='leave')return json(await roomRpc(stub,'leave',hash,action),200,origin);
 throw new OnlineError('Unknown operation.',404);
}
// Durable Object RPC error classes do not preserve their prototype across
// isolates. Return explicit status codes so user mistakes stay 400/401/403/409
// rather than accidentally surfacing as an opaque 503.
async function roomRpc(stub,method,...args){
 const envelope=await stub[method](...args);
 if(!envelope?.ok)throw new OnlineError(
   envelope?.error||'Room temporarily unavailable.',
   Number.isInteger(envelope?.status)?envelope.status:503);
 return envelope.data;
}
export default {
 async fetch(request,env,ctx){
   const origin=request.headers.get('Origin');
   if(!isAllowedOrigin(request))
     return json({error:'This website is not permitted to use this room service.'},403);
   if(request.method==='OPTIONS')
     return new Response(null,{status:204,headers:responseHeaders(origin)});
   try{
     return await handleApi(request,ctx);
   }catch(error){
     if(error instanceof OnlineError)return json({error:error.message},error.status,origin);
     console.error('Room API failure',error?.name||'UnknownError');
     return json({error:'The room service is temporarily unavailable.'},503,origin);
   }
 }
};

export class GameRoom extends DurableObject {
 async guarded(fn){
   try{return {ok:true,data:await fn()};}
   catch(err){
     if(err instanceof OnlineError)return {ok:false,status:err.status,error:err.message};
     console.error('Durable room operation failed',err?.name||'UnknownError');
     return {ok:false,status:503,error:'The room service is temporarily unavailable.'};
   }
 }
 async load(){
   const stored=await this.ctx.storage.get('room');
   const room=migrateOnlineRoom(stored);
   if(room!==stored)await this.ctx.storage.put('room',room);
   if(room&&room.expiresAt<=Date.now()){
     await this.ctx.storage.delete('room');
     await this.ctx.storage.deleteAlarm();
     this.broadcast({type:'expired'});
     for(const socket of this.ctx.getWebSockets()){
       try{socket.close(1000,'Room expired');}catch{}
     }
     return null;
   }
   return room||null;
 }
 async store(room){
   await this.ctx.storage.put('room',room);
   const alarm=roomWakeAt(room);
   if(alarm)await this.ctx.storage.setAlarm(Math.max(Date.now()+10,alarm));
   this.broadcast({type:'revision',revision:room.revision});
 }
 broadcast(message){
   const text=JSON.stringify(message);
   for(const ws of this.ctx.getWebSockets()){
     if(ws.readyState===WebSocket.OPEN)try{ws.send(text);}catch{}
   }
 }
 async readAndTick(){
   const room=await this.load();
   if(!room)return null;
   const tick=timeOutOnlineTurn(room);
   if(tick.changed)await this.store(tick.room);
   return tick.room;
 }
 async create(params){
   return this.guarded(async()=>{
     const existing=await this.load();
     if(existing)return {collision:true};
     const room=makeOnlineLobby(params);
     await this.store(room);
     return {collision:false,state:viewOnlineRoom(room,params.hostHash)};
   });
 }
 async join(name,hash,avatar){
   return this.guarded(async()=>{
     const room=await this.readAndTick();
     const updated=joinOnlineLobby(room,name,hash,Date.now(),avatar);
     await this.store(updated);
     return viewOnlineRoom(updated,hash);
   });
 }
 async view(hash){
   return this.guarded(async()=>{
     const room=await this.readAndTick();
     return viewOnlineRoom(room,hash);
   });
 }
 async start(hash,request){
   return this.guarded(async()=>{
     const room=await this.readAndTick();
     const next=startOnlineMatch(room,hash,request);
     if(!next.replayed)await this.store(next.room);
     return {room:viewOnlineRoom(next.room,hash),event:next.result};
   });
 }
 async profile(hash,request){
   return this.guarded(async()=>{
     const room=await this.readAndTick();
     const next=updateOnlinePilot(room,hash,request);
     if(!next.replayed)await this.store(next.room);
     return {room:viewOnlineRoom(next.room,hash),event:next.result};
   });
 }
 async act(hash,request){
   return this.guarded(async()=>{
     const room=await this.readAndTick();
     const next=takeOnlineAction(room,hash,request);
     if(!next.replayed)await this.store(next.room);
     return {room:viewOnlineRoom(next.room,hash),event:next.result};
   });
 }
 async leave(hash,request){
   return this.guarded(async()=>{
     const room=await this.readAndTick();
     const next=leaveOnlineLobby(room,hash,request);
     if(!next.replayed)await this.store(next.room);
     return {left:true,revision:next.room.revision};
   });
 }
 async alarm(){
   const room=await this.load();
   if(!room)return;
   const tick=timeOutOnlineTurn(room);
   if(tick.changed){await this.store(tick.room);return;}
   const alarm=roomWakeAt(room);
   if(alarm)await this.ctx.storage.setAlarm(Math.max(Date.now()+10,alarm));
 }
 async fetch(request){
   if((request.headers.get('Upgrade')||'').toLowerCase()!=='websocket')
     return new Response('WebSocket required',{status:426});
   const room=await this.readAndTick();
   if(!room)return new Response('Room unavailable',{status:404});
   const [client,server]=Object.values(new WebSocketPair());
   this.ctx.acceptWebSocket(server);
   server.serializeAttachment({joinedAt:Date.now()});
   server.send(JSON.stringify({type:'revision',revision:room.revision}));
   return new Response(null,{status:101,webSocket:client});
 }
 async webSocketMessage(socket,message){
   if(typeof message!=='string'||message.length>64)return;
   if(message==='ping')socket.send(JSON.stringify({type:'pong'}));
 }
 async webSocketClose(socket,code,reason,clean){
   // The 2026 runtime auto-replies to close. This is safe when needed and
   // does not discard a player's seat or private access key.
   try{socket.close(code,reason||'Disconnected');}catch{}
 }
 async webSocketError(socket,error){
   try{socket.close(1011,'Connection error');}catch{}
 }
}
