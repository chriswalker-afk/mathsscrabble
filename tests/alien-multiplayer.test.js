import test from 'node:test';
import assert from 'node:assert/strict';
import {
 PILOT_MANIFEST,PILOT_PRESET_NAMES,defaultPilotAlien,validatePilotAlien,
 acceptPilotAlien,safePilotAlien,isValidPilotAlien,alienFromStorage,
 getSavedPilotAlien,nextRandomPilotAlien,pilotProfileEqual
} from '../src/alien/profiles.js';
import {makeLocalMatch,validLocalMatch,saveLocalMatch,loadLocalMatch,
 readyLocalTurn,passLocalTurn} from '../src/multiplayer.js';
import {makeOnlineLobby,joinOnlineLobby,startOnlineMatch,viewOnlineRoom,
 updateOnlinePilot,takeOnlineAction,verifyOnlineRoom} from '../src/online-rules.js';
import {ALIEN_STORAGE_KEY} from '../src/alien/model.js';

const H='a'.repeat(64),A='b'.repeat(64),B='c'.repeat(64);
const rng=()=>.35;
function request(revision,type,extra={}){
 return {id:'alien-profile-123456'+String(revision)+type,revision,type,...extra};
}
function store(){
 const map=new Map();
 return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
}
test('shared manifest yields four stable, visually distinct, strict player profiles',()=>{
 assert.equal(PILOT_PRESET_NAMES.length,4);
 assert.equal(PILOT_MANIFEST.canvas.width,320);
 const list=PILOT_PRESET_NAMES.map((_,i)=>defaultPilotAlien(i));
 assert.equal(new Set(list.map(a=>JSON.stringify(a))).size,4);
 assert.deepEqual(defaultPilotAlien(4),list[0]);
 for(const alien of list){
   assert.deepEqual(validatePilotAlien(alien),alien);
   assert.equal(isValidPilotAlien(alien),true);
   assert.ok(JSON.stringify(alien).length<400);
 }
 for(const dirty of [
  '<script>',{...list[0],svg:'<script>alert(1)</script>'},
  {...list[0],head:'https://evil.example/avatar.svg'},
  {...list[0],colours:{skin:'red',outfit:'mint',accent:'coral'}},
  {...list[0],colours:{...list[0].colours,extra:'injected'}},
  {...list[0],version:99},
  {version:1},Array(2048).fill('x')
 ]){
   assert.throws(()=>acceptPilotAlien(dirty,0));
   assert.equal(isValidPilotAlien(dirty),false);
   assert.deepEqual(safePilotAlien(dirty,0),list[0]);
 }
 assert.deepEqual(acceptPilotAlien(undefined,2),list[2],
  'legacy clients get a predictable alien by seat');
 assert.equal(pilotProfileEqual(list[0],{...list[0]}),true);
 assert.equal(pilotProfileEqual(list[0],list[1]),false);
 assert.notDeepEqual(nextRandomPilotAlien(list[0],()=>0),list[0]);
});
test('saved Alien Lab design is reused without sharing the game or authentication state',()=>{
 const storage=store();const custom={
  ...defaultPilotAlien(0),head:'facet',eyes:'visor',
  colours:{skin:'coral',outfit:'aqua',accent:'lavender'}
 };
 storage.setItem(ALIEN_STORAGE_KEY,JSON.stringify(custom));
 storage.setItem('equa-nova.online-room.v1','top-secret-code');
 storage.setItem('equa-nova.local-match.v1','local-match-data');
 assert.deepEqual(getSavedPilotAlien(storage),custom);
 assert.deepEqual(alienFromStorage(storage,0),custom);
 assert.equal(storage.getItem('equa-nova.online-room.v1'),'top-secret-code');
 assert.equal(storage.getItem('equa-nova.local-match.v1'),'local-match-data');
 storage.setItem(ALIEN_STORAGE_KEY,'{"version":1,"head":"<script>"}');
 assert.equal(getSavedPilotAlien(storage),null);
 assert.deepEqual(alienFromStorage(storage,1),defaultPilotAlien(1));
 assert.equal(getSavedPilotAlien({getItem(){throw Error('private mode')}}),null);
});
test('local match accepts unique aliens per seat, preserves them across turns/reloads and refuses tampered local saves',()=>{
 const avatars=[defaultPilotAlien(3),defaultPilotAlien(0),defaultPilotAlien(2)];
 const match=makeLocalMatch({names:['Ari','Bea','Cy'],avatars},rng);
 assert.deepEqual(match.players.map(p=>p.avatar),avatars);
 assert.equal(validLocalMatch(match),true);
 const playing=readyLocalTurn(match,1000);
 const passed=passLocalTurn(playing);
 assert.deepEqual(passed.players.map(p=>p.avatar),avatars);
 const storage=store();
 assert.equal(saveLocalMatch(storage,passed),true);
 const loaded=loadLocalMatch(storage,{privateOnResume:false});
 assert.deepEqual(loaded.players.map(p=>p.avatar),avatars);
 const tampered=structuredClone(loaded);
 tampered.players[1].avatar={...avatars[1],head:'<img src=evil>'};
 storage.setItem('equa-nova.local-match.v1',JSON.stringify(tampered));
 assert.equal(loadLocalMatch(storage),null);
 // Legacy saved local matches without avatars remain playable and gain
 // a safe default display profile when the UI renders them.
 const legacy=structuredClone(loaded);
 legacy.players.forEach(p=>delete p.avatar);
 assert.equal(validLocalMatch(legacy),true);
 assert.equal(saveLocalMatch(storage,legacy),true);
 assert.equal(loadLocalMatch(storage).phase,'handover');
 assert.deepEqual(legacy.players.map((p,i)=>safePilotAlien(p.avatar,i)),
  [defaultPilotAlien(0),defaultPilotAlien(1),defaultPilotAlien(2)]);
 assert.throws(()=>makeLocalMatch({names:['A','B'],avatars:[avatars[0]]},rng),/avatar|alien/i);
 assert.throws(()=>makeLocalMatch({names:['A','B'],avatars:[avatars[0],{bad:true}]},rng));
});
test('online room create/join exposes only safe cosmetics and private player racks',()=>{
 const host=defaultPilotAlien(3),guest=defaultPilotAlien(1);
 let room=makeOnlineLobby({code:'GHJKLM',hostName:'Ari',hostHash:H,hostAvatar:host,
  maxPlayers:2,turnSeconds:0,now:1000});
 room=joinOnlineLobby(room,'Bea',A,1100,guest);
 assert.equal(verifyOnlineRoom(room),true);
 const hostView=viewOnlineRoom(room,H,1500),guestView=viewOnlineRoom(room,A,1500);
 assert.deepEqual(hostView.you.avatar,host);
 assert.deepEqual(guestView.you.avatar,guest);
 assert.deepEqual(hostView.people.map(p=>p.avatar),[host,guest]);
 assert.deepEqual(guestView.people.map(p=>p.avatar),[host,guest]);
 for(const v of [hostView,guestView]){
   assert.equal(JSON.stringify(v).includes('tokenHash'),false);
   assert.equal(JSON.stringify(v).includes(H),false);
   assert.equal(JSON.stringify(v).includes(A),false);
   assert.equal(JSON.stringify(v).includes('<svg'),false);
 }
 const started=startOnlineMatch(room,H,request(room.revision,'start'),2000,rng).room;
 for(const [hash,index] of [[H,0],[A,1]]){
   const snapshot=viewOnlineRoom(started,hash,2500);
   assert.deepEqual(snapshot.match.players.map(p=>p.avatar),[host,guest]);
   assert.deepEqual(snapshot.match.rack,started.match.players[index].rack);
   assert.equal(snapshot.match.players.some(p=>p.rack),false);
   assert.equal(snapshot.match.players.every(p=>p.rackCount===7),true);
 }
 assert.equal(verifyOnlineRoom(started),true);
});
test('online lobby owner can change their own avatar; changes survive reconnect and lock on start',()=>{
 const host=defaultPilotAlien(0),guest=defaultPilotAlien(1),newGuest=defaultPilotAlien(2);
 let room=makeOnlineLobby({code:'GHJKLM',hostName:'Ari',hostHash:H,hostAvatar:host,
  maxPlayers:2,turnSeconds:0,now:1000});
 room=joinOnlineLobby(room,'Bea',A,1100,guest);
 const revision=room.revision;
 const update=request(revision,'profile',{avatar:newGuest,target:0});
 const changed=updateOnlinePilot(room,A,update,1200);
 assert.equal(changed.room.revision,revision+1);
 assert.deepEqual(changed.room.people[0].avatar,host,'guest cannot change host seat');
 assert.deepEqual(changed.room.people[1].avatar,newGuest);
 assert.deepEqual(viewOnlineRoom(changed.room,A,1400).you.avatar,newGuest,
  'reconnecting guest retains validated alien');
 assert.deepEqual(viewOnlineRoom(changed.room,H,1400).people[1].avatar,newGuest);
 const replay=updateOnlinePilot(changed.room,A,update,1401);
 assert.equal(replay.replayed,true);
 assert.equal(replay.room.revision,changed.room.revision);
 assert.throws(()=>updateOnlinePilot(changed.room,H,
  request(revision,'profile',{avatar:host}),1402),/updated/i);
 assert.throws(()=>updateOnlinePilot(changed.room,A,
  request(changed.room.revision,'profile',{avatar:{...newGuest,svg:'<script>'}}),1402),
  /valid alien/i);
 assert.equal(verifyOnlineRoom(changed.room),true);
 const started=startOnlineMatch(changed.room,H,request(changed.room.revision,'start'),1500,rng).room;
 assert.deepEqual(started.match.players[1].avatar,newGuest);
 assert.throws(()=>updateOnlinePilot(started,A,
  request(started.revision,'profile',{avatar:defaultPilotAlien(3)}),1600),
  /locked/i);
 const afterPass=takeOnlineAction(started,H,request(started.revision,'pass'),1700,rng).room;
 assert.deepEqual(afterPass.match.players[1].avatar,newGuest);
});
test('server rejects malformed avatar submissions before they enter persistent rooms',()=>{
 const host=defaultPilotAlien(0);
 const invalid=[
  {...host,head:'../other-file'},'not-an-object',
  {...host,colours:{...host.colours,skin:'url(javascript:bad)'}},
  {...host,head:'orb',unsafe:'<img>'}
 ];
 for(const avatar of invalid){
   try{
     makeOnlineLobby({code:'GHJKLM',hostName:'A',hostHash:H,hostAvatar:avatar,now:1000});
     assert.fail('invalid host profile accepted');
   }catch(err){
     assert.equal(err.status,400);
   }
 }
 let room=makeOnlineLobby({code:'GHJKLM',hostName:'Ari',hostHash:H,now:1000});
 for(const avatar of invalid){
   assert.throws(()=>joinOnlineLobby(room,'Bea',A,1100,avatar),
      err=>err.status===400);
 }
 // Previous clients that omitted their profile still receive a stable preset.
 room=joinOnlineLobby(room,'Bea',A,1100);
 assert.deepEqual(room.people[1].avatar,defaultPilotAlien(1));
});
