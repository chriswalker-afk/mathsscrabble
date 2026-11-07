import test from 'node:test';
import assert from 'node:assert/strict';
import {reactorDisplayPhase} from '../src/reactor-presentation.js';

test('reactor states accurately describe placement geometry without claiming an equation is mathematically valid',()=>{
 const state=(preview={},more={})=>reactorDisplayPhase({preview,phase:'playing',...more});
 assert.deepEqual(state({status:'empty',ready:false}),{key:'idle',label:'SELECT TILES'});
 assert.deepEqual(state({status:'building',ready:false}),{key:'building',label:'BUILDING EQUATION'});
 for(const status of ['gap','alignment','centre','connect','locked']){
  assert.deepEqual(state({status,ready:false}),{key:'warning',label:'ADJUST PLACEMENT'});
 }
 assert.deepEqual(state({status:'ready',ready:true}),{key:'ready',label:'READY TO CHECK'});
 assert.equal(state({status:'ready',ready:true},{swapping:true}).key,'exchange');
 assert.equal(state({status:'ready',ready:true},{ceremony:true}).key,'transfer');
 assert.equal(state({status:'ready',ready:true},{phase:'won'}).key,'stable');
 assert.equal(state({status:'ready',ready:true},{phase:'lost'}).key,'offline');
 assert.notEqual(state({status:'ready',ready:true}).label,'VALID EQUATION',
  'mathematical correctness must only be decided by the validator on submission');
});
test('state precedence prevents a finished run from falsely showing the rack as ready',()=>{
 assert.equal(reactorDisplayPhase({phase:'lost',preview:{ready:true},swapping:false}).label,'REACTOR STANDBY');
 assert.equal(reactorDisplayPhase({phase:'won',preview:{ready:false},swapping:true}).key,'stable');
 assert.equal(reactorDisplayPhase({phase:'won',preview:{ready:false},ceremony:true}).key,'transfer');
});
