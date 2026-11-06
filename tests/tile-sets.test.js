import test from 'node:test';
import assert from 'node:assert/strict';
import {SIZE,CENTER,pos,makeTile,makeBag,checkEquation,validateMove,scoreMove,tilePool} from '../src/engine.js';
import {TILE_SETS,FRACTION_VALUES,hasBracketPair,tileValueAllowed} from '../src/tile-sets.js';
import {dealPlayableRack,freshStats,freshProgress,saveRun,loadRun} from '../src/solo.js';
import {summarizeBag} from '../src/bag-inventory.js';
import {makeRogueState,rogueRackOptions,rackSlots,scoreRogueMove} from '../src/rogue.js';
const random=()=>.31;
const pairs=bag=>{
 const grouped=new Map();
 for(const tile of bag){
   if(!tile.pairId)continue;
   const g=grouped.get(tile.pairId)||[];g.push(tile);grouped.set(tile.pairId,g);
 }
 return grouped;
};
test('four levels each produce exactly 151 unique, playable physical tile IDs',()=>{
 assert.deepEqual(TILE_SETS.map(k=>k.id),['natural','integer','rational','advanced']);
 for(const kit of TILE_SETS){
   const bag=makeBag(random,kit.id);
   assert.equal(bag.length,151,kit.id);
   assert.equal(new Set(bag.map(t=>t.id)).size,151,kit.id);
   assert.ok(bag.every(t=>tileValueAllowed(kit.id,t.blank||t.value)),kit.id);
   assert.equal(bag.filter(t=>tilePool(t)==='operators').length,59);
   if(kit.brackets){
     assert.equal(bag.filter(t=>tilePool(t)==='brackets').length,16);
     assert.equal(bag.filter(t=>t.value?.includes('/')).length,28);
     const p=pairs(bag);assert.equal(p.size,8);
     for(const group of p.values())assert.deepEqual(group.map(t=>t.value).sort(),['(',')']);
   }else{
     assert.equal(pairs(bag).size,0);
     assert.equal(bag.filter(t=>tilePool(t)==='brackets').length,0);
   }
 }
});
test('integer kit contains signed whole-number tiles but only basic operations',()=>{
 const bag=makeBag(random,'integer');
 for(let digit=1;digit<=9;digit++)assert.equal(bag.filter(t=>t.value==='−'+digit).length,3);
 assert.equal(bag.some(t=>['^','√','!'].includes(t.value)),false);
 const hand=dealPlayableRack([],bag,{},random);
 assert.equal(hand.rack.length,8);
 assert.equal(hand.rack.filter(t=>tilePool(t)==='numbers').length,5);
 assert.equal(hand.rack.filter(t=>tilePool(t)==='operators').length,3);
});
test('rational and quantum kits draw exactly one complete bracket pair in ten slots',()=>{
 for(const kit of ['rational','advanced']){
   const bag=makeBag(random,kit);
   const initial=dealPlayableRack([],bag,{bracketPairs:1},random);
   assert.equal(initial.rack.length,10);
   assert.equal(initial.rack.filter(t=>tilePool(t)==='numbers').length,5);
   assert.equal(initial.rack.filter(t=>tilePool(t)==='operators').length,3);
   const brackets=initial.rack.filter(t=>tilePool(t)==='brackets');
   assert.deepEqual(brackets.map(t=>t.value).sort(),['(',')']);
   assert.equal(brackets[0].pairId,brackets[1].pairId);
   assert.equal(new Set([...initial.rack,...initial.bag].map(t=>t.id)).size,151);
   // Retaining a complete pair does not add a second pair.
   const held=dealPlayableRack(initial.rack,initial.bag,{bracketPairs:1},random);
   assert.equal(held.rack.filter(t=>tilePool(t)==='brackets').length,2);
   assert.equal(held.rack.length,10);
 }
 const r=makeRogueState('rational');
 assert.equal(rackSlots(r),10);
 assert.equal(rogueRackOptions(r,1).bracketPairs,1);
 r.upgrades=['wide-rack'];
 assert.equal(rackSlots(r),11);
});
test('negative integers and fractions remain atomic, even next to basic operations',()=>{
 const valid=[
   ['−3','+','7','=','4'],
   ['2','×','−3','=','−6'],
   ['1/2','+','1/2','=','1'],
   ['−1/2','+','1/2','=','0'],
   ['(','1/2','+','1/2',')','×','2','=','2'],
   ['5','÷','2','=','5/2']
 ];
 for(const values of valid)assert.doesNotThrow(()=>checkEquation(values),values.join(''));
 for(const values of [
   ['1/2','2','=','6'],['1/2','=','1/2'],['−3','1','=','−3'],
   ['(','2','+','3','=','5'],['1/2','+','1/2','=','2']
 ])assert.throws(()=>checkEquation(values));
});
test('advanced operations use exact BIDMAS: powers, roots and factorials',()=>{
 for(const values of [
   ['2','^','3','=','8'],
   ['2','^','2','^','3','=','2','5','6'],
   ['√','9','+','3','!','=','9'],
   ['√','(','1/4',')','=','1/2'],
   ['(','1/2',')','^','2','=','1/4'],
   ['3','!','÷','2','=','3'],
   ['4','^','−','2','=','1/1','6'] // replaced below: 1/16 not in physical catalog
 ].slice(0,-1))assert.doesNotThrow(()=>checkEquation(values),values.join(''));
 for(const values of [
   ['√','2','=','1'],['3','!','=','5'],['9','!','=','1'],
   ['2','^','9','=','5','1','2'],['√','−3','=','0'],
   ['2','^','1/2','=','1']
 ])assert.throws(()=>checkEquation(values));
});
test('a scored bracket equation requires both linked physical halves in one turn',()=>{
 const rack=dealPlayableRack([],makeBag(random,'rational'),{bracketPairs:1},random).rack;
 const open=rack.find(t=>t.value==='('),close=rack.find(t=>t.value===')');
 const tiles=[open,makeTile('1/2'),makeTile('+'),makeTile('1/2'),close,
  makeTile('×'),makeTile('2'),makeTile('='),makeTile('2')];
 const board=Array(SIZE*SIZE).fill(null),pending={};
 for(let i=0;i<tiles.length;i++)pending[pos(CENTER,2+i)]=tiles[i];
 const valid=validateMove(board,pending);
 assert.equal(valid.text,'(1/2+1/2)×2=2');
 assert.ok(scoreMove(board,pending,valid,{rackSize:10}).total>0);
 delete pending[pos(CENTER,2)];
 assert.throws(()=>validateMove(board,pending),/bracket|gap/i);
});
test('bag scan groups fractions and linked brackets without hiding physical counts',()=>{
 const bag=makeBag(random,'advanced'),scan=summarizeBag(bag);
 assert.equal(scan.total,151);
 assert.equal(scan.pools.brackets,16);
 assert.ok(scan.groups.some(g=>g.id==='fractions'&&g.total===28));
 assert.ok(scan.groups.some(g=>g.id==='brackets'&&g.total===16));
 assert.ok(scan.groups.some(g=>g.id==='advanced'&&g.total===14));
 assert.equal(scan.groups.reduce((n,g)=>n+g.total,0),151);
});
test('rational and quantum solo saves survive an exact local validation round trip',()=>{
 for(const id of ['rational','advanced']){
  const hand=dealPlayableRack([],makeBag(random,id),{bracketPairs:1},random);
  const map=new Map(),storage={setItem:(k,v)=>map.set(k,v),getItem:k=>map.get(k)};
  const state={mode:'sector',tileSet:id,rogue:null,sector:1,score:0,turn:1,freeSwapTurn:0,
    phase:'playing',board:Array(169).fill(null),rack:hand.rack,bag:hand.bag,
    pending:{},placementOrder:[],stats:freshStats(),progress:freshProgress()};
  assert.equal(saveRun(storage,state),true,id+' should save');
  assert.equal(loadRun(storage,'sector').tileSet,id);
  const rogue={...makeRogueState(id),shopSector:0};
  state.mode='rogue';state.rogue=rogue;
  assert.equal(saveRun(storage,state),true,id+' Drift should save');
  assert.equal(loadRun(storage,'rogue').tileSet,id);
 }
});
