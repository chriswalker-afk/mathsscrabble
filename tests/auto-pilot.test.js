import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureActivePilot,ensureLocalSeatPilots} from '../src/achievements/auto-pilot.js';
import {loadPilots,choosePilot,savePilots} from '../src/achievements/pilots.js';
import {loadAchievementStore} from '../src/achievements/storage.js';
const memory=()=>{
 const map=new Map();
 return {getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};
};
test('first visit creates a saved pilot once, without login or guest opt-in',()=>{
 const storage=memory();
 const first=ensureActivePilot(storage);
 assert.equal(first.status,'ready');assert.match(first.pilotId,/^pilot-[a-f0-9]{24}$/);
 const again=ensureActivePilot(storage);
 assert.equal(again.pilotId,first.pilotId);
 assert.equal(loadPilots(storage).registry.pilots.length,1);
 assert.equal(loadAchievementStore(storage,loadPilots(storage).registry).status,'restored');
});
test('existing named pilots, including an inactive list, are never discarded',()=>{
 const storage=memory(),created=ensureActivePilot(storage,{name:'Ari'});
 const reg=loadPilots(storage).registry;
 savePilots(storage,choosePilot(reg,null));
 assert.equal(ensureActivePilot(storage).pilotId,created.pilotId);
 assert.equal(loadPilots(storage).registry.pilots[0].name,'Ari');
});
test('separate pass-and-play seats automatically receive distinct saved achievements',()=>{
 const storage=memory();ensureActivePilot(storage);
 const names=['Ari','Bea','Cy'],avatars=[null,null,null];
 const first=ensureLocalSeatPilots(storage,names,avatars);
 assert.equal(first.length,3);assert.equal(new Set(first).size,3);assert.ok(first.every(Boolean));
 const again=ensureLocalSeatPilots(storage,names,avatars);
 assert.deepEqual(again,first);
 const reg=loadPilots(storage).registry;
 assert.equal(reg.pilots.length,4);
 assert.deepEqual(names.map(name=>reg.pilots.find(p=>p.name===name)?.id),first);
 const explicit=ensureLocalSeatPilots(storage,['Bea','Ari'],avatars,[first[1],first[0]]);
 assert.deepEqual(explicit,[first[1],first[0]]);
});
test('unavailable or invalid storage never erases an existing achievement save',()=>{
 const unavailable={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
 assert.equal(ensureActivePilot(unavailable).pilotId,null);
 assert.deepEqual(ensureLocalSeatPilots(unavailable,['Ari','Bea'],[null,null]),[null,null]);
 const storage=memory();
 storage.setItem('equa-nova.pilot-profiles.v1','{broken');
 assert.equal(ensureActivePilot(storage).status,'invalid');
 assert.equal(storage.getItem('equa-nova.pilot-profiles.v1'),'{broken');
});
