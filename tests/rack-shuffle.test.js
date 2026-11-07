import test from 'node:test';
import assert from 'node:assert/strict';
import {shuffleAvailableRack} from '../src/rack-shuffle.js';
const rack=Array.from({length:8},(_,i)=>({id:'tile-'+i,value:String(i),points:i}));
test('shuffling is cosmetic, preserves every physical tile and actually changes the visible order',()=>{
 const before=rack.map(t=>t.id);
 const after=shuffleAvailableRack(rack,[],()=>0.9999999);
 assert.notDeepEqual(after.map(t=>t.id),before,'even an identity random sequence must visibly shuffle');
 assert.deepEqual(rack.map(t=>t.id),before,'original rack is unchanged');
 assert.deepEqual(new Set(after),new Set(rack),'no tile is created, lost, or changed');
 assert.equal(after[0],rack[1]);
 assert.equal(after[1],rack[0]);
});
test('tiles already on the board remain anchored in their hidden rack positions',()=>{
 const hidden=['tile-1','tile-4'];
 const after=shuffleAvailableRack(rack,hidden,()=>0);
 assert.equal(after[1],rack[1]);
 assert.equal(after[4],rack[4]);
 assert.deepEqual(after.filter(t=>!hidden.includes(t.id)).map(t=>t.id).sort(),
  rack.filter(t=>!hidden.includes(t.id)).map(t=>t.id).sort());
 assert.notDeepEqual(after.map(t=>t.id),rack.map(t=>t.id));
});
test('a rack with zero or one available tile is left alone',()=>{
 assert.deepEqual(shuffleAvailableRack(rack,rack.map(t=>t.id)),rack);
 assert.deepEqual(shuffleAvailableRack(rack,rack.slice(1).map(t=>t.id)),rack);
 assert.deepEqual(shuffleAvailableRack([]),[]);
});
test('random choice is bounded defensively, and shuffle is deterministic with injected RNG',()=>{
 const a=shuffleAvailableRack(rack,[],()=>-4),b=shuffleAvailableRack(rack,[],()=>-4);
 assert.deepEqual(a,b);
 assert.deepEqual(shuffleAvailableRack(rack,[],()=>Infinity),a);
 assert.throws(()=>shuffleAvailableRack({}),TypeError);
});
