import test from 'node:test';
import assert from 'node:assert/strict';
import {SIZE,CENTER,pos,makeTile,makeBag,refill,checkEquation,validateMove,scoreMove,bonusAt,nextTarget} from '../src/engine.js';
const make=arr=>arr.map(makeTile);
const place=(symbols,orientation='h',start=0,row=CENTER)=>{
 const pending={};make(symbols).forEach((tile,k)=>pending[orientation==='h'?pos(row,start+k):pos(start+k,row)]=tile);return pending;
};
test('BIDMAS: multiplication and division before addition and subtraction',()=>{
 for(const expression of [['2','+','3','×','4','=','1','4'],['1','2','÷','3','+','2','=','6'],['8','−','2','×','3','=','2'],['9','÷','3','×','2','=','6']])assert.doesNotThrow(()=>checkEquation(expression));
 assert.throws(()=>checkEquation(['2','+','3','×','4','=','2','0']),/not balanced/i);
});
test('accepts multi-digit numbers and unary negative signs',()=>{
 assert.doesNotThrow(()=>checkEquation(['1','2','−','7','=','5']));
 assert.doesNotThrow(()=>checkEquation(['−','4','+','9','=','5']));
 assert.doesNotThrow(()=>checkEquation(['2','×','(','3','+','4',')','=','1','4']));
});
test('rejects invalid, empty, or dishonest equations',()=>{
 for(const parts of [['2','+','=','2'],['2','=','2','=','2'],['5','÷','0','=','1'],['2','+','2','=','5'],['2','3'],['2','=','']]){
 assert.throws(()=>checkEquation(parts));
 }
});
test('first equation must cross centre',()=>{
 const board=Array(SIZE*SIZE).fill(null);
 assert.throws(()=>validateMove(board,place(['1','=','1'],'h',0,0)),/central/i);
 const pending=place(['8','+','4','=','1','2'],'h',3);
 const move=validateMove(board,pending);assert.equal(move.text,'8+4=12');assert.equal(move.indices.length,6);
});
test('second equation connects to locked tile and does not span unrelated row segments',()=>{
 const board=Array(SIZE*SIZE).fill(null);
 const first=place(['8','+','4','=','1','2'],'h',3);
 Object.entries(first).forEach(([i,t])=>board[i]=t);
 const next=place(['+','3','=','1','1'],'v',CENTER+1,3);
 const move=validateMove(board,next);assert.equal(move.text,'8+3=11');
 // Further board content elsewhere on the same row must not join a separate contiguous equation.
 board[pos(2,10)]=makeTile('9');
 const newMove=validateMove(board,{...next});assert.equal(newMove.text,'8+3=11');
});
test('rejects gaps, diagonal placement, disconnected equations and equals-only turns',()=>{
 const board=Array(SIZE*SIZE).fill(null);
 assert.throws(()=>validateMove(board,place(['='],'h',CENTER,CENTER)));
 const gap={...place(['1','=','1'],'h',CENTER-1)};
 delete gap[pos(CENTER,CENTER)];assert.throws(()=>validateMove(board,gap));
 const diagonal={[pos(5,5)]:makeTile('1'),[pos(6,6)]:makeTile('2')};assert.throws(()=>validateMove(board,diagonal));
 const first=place(['1','=','1'],'h',5);Object.entries(first).forEach(([i,t])=>board[i]=t);
 assert.throws(()=>validateMove(board,place(['2','=','2'],'h',1,1)),/connect/i);
});
test('score calculation respects premium squares, length and full hand',()=>{
 const board=Array(SIZE*SIZE).fill(null);
 const pending=place(['8','+','4','=','1','2'],'h',3);
 const move=validateMove(board,pending);
 const score=scoreMove(board,pending,move);
 assert.equal(score.base,15); // 11 natural tile points + 4 for the Double Tile under 8
 assert.ok(score.bonuses.includes('Double tile'));assert.equal(score.length,3);assert.equal(score.sweep,0);
 assert.equal(score.total,score.base*score.multiplier+3);
 assert.equal(bonusAt(0,0),'3E');
});
test('bag refilling, turn targets and rack clear bookkeeping',()=>{
 const bag=makeBag(()=>0.5);assert.ok(bag.length>100);const draw=refill([],bag);assert.equal(draw.rack.length,7);
 assert.equal(draw.rack.length+draw.bag.length,bag.length);assert.ok(nextTarget(3)>nextTarget(2));
});
