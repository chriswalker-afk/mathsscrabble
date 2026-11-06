import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBag,makeTile,BLANK_NUMBER,BLANK_OPERATOR,BLANK_ANY} from '../src/engine.js';
import {dealPlayableRack} from '../src/solo.js';
import {summarizeBag} from '../src/bag-inventory.js';

const byKey=(group,key)=>group.tiles.find(tile=>tile.key===key)?.count;
const sum=group=>group.tiles.reduce((a,t)=>a+t.count,0);
test('bag inventory reports exact initial digits, operations and wildcard types',()=>{
 const bag=makeBag(()=>0.5);
 const report=summarizeBag(bag);
 assert.equal(report.total,151);
 assert.deepEqual(report.groups.map(x=>x.total),[80,54,17]);
 const [numbers,operators,wildcards]=report.groups;
 assert.equal(numbers.tiles.length,10);
 assert.equal(operators.tiles.length,4);
 assert.equal(wildcards.tiles.length,3);
 for(const digit of ['0','1','2','3','4'])assert.equal(byKey(numbers,digit),9);
 for(const digit of ['5','6','7','8','9'])assert.equal(byKey(numbers,digit),7);
 assert.deepEqual(operators.tiles.map(t=>[t.symbol,t.count]),[['+',18],['−',14],['×',12],['÷',10]]);
 assert.equal(byKey(wildcards,BLANK_NUMBER),7);
 assert.equal(byKey(wildcards,BLANK_OPERATOR),5);
 assert.equal(byKey(wildcards,BLANK_ANY),5);
 assert.equal(report.groups.reduce((n,g)=>n+sum(g),0),report.total);
});
test('inventory reflects the actual remaining bag and excludes rack tiles',()=>{
 const bag=makeBag(()=>0.5);
 const {rack,bag:remaining}=dealPlayableRack([],bag);
 assert.equal(rack.length,7);
 const report=summarizeBag(remaining);
 assert.equal(report.total,144);
 assert.equal(report.groups.reduce((n,g)=>n+g.total,0),144);
 const removed=(a,b)=>a.groups.flatMap(group=>group.tiles).reduce((sum,tile)=>{
   const after=b.groups.flatMap(g=>g.tiles).find(t=>t.key===tile.key);
   return sum+(tile.count-after.count);
 },0);
 assert.equal(removed(summarizeBag(bag),report),7);
 // The inventory is independent of internal shuffle/draw ordering.
 assert.deepEqual(summarizeBag([...remaining].reverse()),report);
});
test('inventory distinguishes every blank category and shows exhausted types',()=>{
 const bag=[makeTile('1'),makeTile('1'),makeTile('+'),makeTile(BLANK_ANY),makeTile(BLANK_NUMBER)];
 const summary=summarizeBag(bag);
 assert.equal(summary.total,5);
 assert.deepEqual(summary.groups.map(g=>g.total),[2,1,2]);
 assert.equal(byKey(summary.groups[0],'1'),2);
 assert.equal(byKey(summary.groups[1],'−'),0);
 assert.equal(byKey(summary.groups[2],BLANK_ANY),1);
 assert.equal(byKey(summary.groups[2],BLANK_OPERATOR),0);
 assert.ok(summary.groups[2].tiles.every(item=>item.symbol&&item.label));
});
test('inventory rejects unknown and non-bag tile representations',()=>{
 assert.throws(()=>summarizeBag([makeTile('=')]),/Unsupported physical tile/i);
 assert.throws(()=>summarizeBag([{id:'fake',value:'?'}]),/Unsupported physical tile/i);
 assert.throws(()=>summarizeBag(null),/Expected a tile bag/i);
});
