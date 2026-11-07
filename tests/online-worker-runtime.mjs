import assert from 'node:assert/strict';
import {defaultPilotAlien} from '../src/alien/profiles.js';

const BASE='http://127.0.0.1:8787';
const opts={cache:'no-store'};
async function api(path,{method='GET',token,body}={}){
 const headers={'Accept':'application/json','Origin':'http://127.0.0.1:4173'};
 if(body!==undefined)headers['Content-Type']='application/json';
 if(token)headers.Authorization='Bearer '+token;
 const response=await fetch(BASE+path,{...opts,method,headers,
   ...(body!==undefined?{body:JSON.stringify(body)}:{})});
 let data;
 try{data=await response.json();}catch(e){
  throw Error('Non-JSON response '+response.status+' from '+path);
 }
 return {status:response.status,...data};
}
const mutation=(room,type,extra={})=>({
 id:crypto.randomUUID(),revision:room.revision,type,...extra
});
function assertPrivate(state,ownIndex){
 const match=state.room.match;
 assert.equal(match.rack.length,8);
 assert.equal(state.room.you.index,ownIndex);
 assert.ok(match.players.every(p=>p.rack===undefined));
 assert.equal(match.board.length,361);
 assert.ok(Array.isArray(match.bagInventory.groups));
 assert.equal(JSON.stringify(state.room).includes('tokenHash'),false);
 return match;
}
const health=await api('/api/health');
assert.equal(health.status,200);
assert.equal(health.ok,true);
const host=await api('/api/rooms',{method:'POST',
  body:{name:'Ari',maxPlayers:2,turnSeconds:0,avatar:defaultPilotAlien(3)}});
assert.equal(host.status,201,JSON.stringify(host));
assert.match(host.token,/^[A-Za-z0-9_-]{43}$/);
const code=host.room.code;
assert.match(code,/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
assert.equal(host.room.phase,'lobby');
assert.equal(host.room.people.length,1);
assert.equal(host.room.achievementReceipts.filter(x=>x.type==='room-joined').length,1);
assert.ok(host.room.achievementReceipts.every(x=>x.id.includes('-0-')));
assert.ok(!JSON.stringify(host.room).includes(host.token));
const joined=await api('/api/rooms/'+code+'/join',{method:'POST',body:{name:'Bea',avatar:defaultPilotAlien(1)}});
assert.equal(joined.status,201,JSON.stringify(joined));
assert.notEqual(joined.token,host.token);
assert.equal(joined.room.people.length,2);
assert.ok(joined.room.achievementReceipts.some(x=>x.type==='room-joined'));
assert.ok(joined.room.achievementReceipts.some(x=>x.type==='lobby-multi'));
assert.ok(joined.room.achievementReceipts.every(x=>x.id.includes('-1-')));
assert.deepEqual(joined.room.people.map(p=>p.avatar),
 [defaultPilotAlien(3),defaultPilotAlien(1)]);
const invalidProfile=await api('/api/rooms/'+code+'/profile',{
 method:'POST',token:joined.token,
 body:mutation(joined.room,'profile',{avatar:{...defaultPilotAlien(1),svg:'<script>'}})
});
assert.equal(invalidProfile.status,400,JSON.stringify(invalidProfile));
const updated=await api('/api/rooms/'+code+'/profile',{
 method:'POST',token:joined.token,
 body:mutation(joined.room,'profile',{avatar:defaultPilotAlien(2)})
});
assert.equal(updated.status,200,JSON.stringify(updated));
assert.deepEqual(updated.room.you.avatar,defaultPilotAlien(2));
assert.deepEqual(updated.room.people[0].avatar,defaultPilotAlien(3));
const base='/api/rooms/'+code;
const unknown=await api(base+'/state',{token:'X'.repeat(43)});
assert.equal(unknown.status,401,JSON.stringify(unknown));
const guestCannotStart=await api(base+'/start',{method:'POST',token:joined.token,
  body:mutation(updated.room,'start')});
assert.equal(guestCannotStart.status,403,JSON.stringify(guestCannotStart));
const started=await api(base+'/start',{method:'POST',token:host.token,
  body:mutation(updated.room,'start')});
assert.equal(started.status,200,JSON.stringify(started));
assert.equal(started.room.phase,'playing');
assert.ok(started.room.achievementReceipts.some(x=>x.type==='match-started'));
assert.ok(started.room.achievementReceipts.some(x=>x.type==='lobby-multi'));
assert.ok(started.room.achievementReceipts.every(x=>x.id.includes('-0-')));
assert.deepEqual(started.room.match.players.map(p=>p.avatar),
 [defaultPilotAlien(3),defaultPilotAlien(2)]);
const forbiddenMidgame=await api(base+'/profile',{
 method:'POST',token:joined.token,
 body:mutation(started.room,'profile',{avatar:defaultPilotAlien(1)})
});
assert.equal(forbiddenMidgame.status,409,JSON.stringify(forbiddenMidgame));
const hostMatch=assertPrivate(started,0);
const guestState=await api(base+'/state',{token:joined.token});
assert.equal(guestState.status,200,JSON.stringify(guestState));
const guestMatch=assertPrivate(guestState,1);
for(const tile of hostMatch.rack)
 assert.ok(!guestMatch.rack.some(x=>x.id===tile.id),'private rack duplication');
assert.equal(hostMatch.bagCount,135);
assert.equal(hostMatch.players.length,2);
const premature=await api(base+'/action',{method:'POST',token:joined.token,
  body:mutation(guestState.room,'pass')});
assert.equal(premature.status,403,JSON.stringify(premature));
const forged=await api(base+'/action',{method:'POST',token:host.token,
  body:mutation(started.room,'score',{placements:[
   {index:81,tileId:'tile-forged',value:'8'},
   {index:82,tileId:'=',value:'='},
   {index:83,tileId:'tile-forged2',value:'8'}
  ]})});
assert.equal(forged.status,403,JSON.stringify(forged));
const afterReject=await api(base+'/state',{token:host.token});
assert.ok(!afterReject.room.achievementReceipts.some(x=>x.type==='move-scored'),
 'server rejected score cannot create achievement evidence');
const stale=await api(base+'/action',{method:'POST',token:host.token,
  body:{id:crypto.randomUUID(),revision:1,type:'pass'}});
assert.equal(stale.status,409,JSON.stringify(stale));
const passId=crypto.randomUUID();
const first=await api(base+'/action',{method:'POST',token:host.token,
  body:{id:passId,revision:started.room.revision,type:'pass'}});
assert.equal(first.status,200,JSON.stringify(first));
assert.equal(first.room.match.current,1);
assert.equal(first.room.revision,started.room.revision+1);
const replay=await api(base+'/action',{method:'POST',token:host.token,
  body:{id:passId,revision:started.room.revision,type:'pass'}});
assert.equal(replay.status,200,JSON.stringify(replay));
assert.equal(replay.room.revision,first.room.revision);
assert.equal(replay.room.match.current,1);
const second=await api(base+'/action',{method:'POST',token:joined.token,
  body:mutation(first.room,'pass')});
assert.equal(second.status,200,JSON.stringify(second));
assert.equal(second.room.match.current,0);
const third=await api(base+'/action',{method:'POST',token:host.token,
  body:mutation(second.room,'pass')});
assert.equal(third.status,200,JSON.stringify(third));
const fourth=await api(base+'/action',{method:'POST',token:joined.token,
  body:mutation(third.room,'pass')});
assert.equal(fourth.status,200,JSON.stringify(fourth));
assert.equal(fourth.room.phase,'finished');
assert.equal(fourth.room.achievementReceipts.filter(x=>x.type==='match-finished').length,1);
assert.ok(fourth.room.achievementReceipts.every(x=>x.id.includes('-1-')));
assert.equal(fourth.room.match.standings.length,2);
assert.ok(fourth.room.match.standings.every(x=>x.net===x.gross-x.penalty));
const restored=await api(base+'/state',{token:host.token});
assert.equal(restored.status,200,JSON.stringify(restored));
assert.equal(restored.room.phase,'finished');
assert.equal(restored.room.achievementReceipts.filter(x=>x.type==='match-finished').length,1);
assert.ok(restored.room.achievementReceipts.every(x=>x.id.includes('-0-')));
assert.deepEqual(restored.room.match.standings,fourth.room.match.standings);
console.log('Cloudflare runtime passed: real SQLite Durable Object, host/guest authentication, private hands, turn authority, idempotency, replay, final standings.');
