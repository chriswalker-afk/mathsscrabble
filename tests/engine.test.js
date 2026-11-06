import test from 'node:test';
import assert from 'node:assert/strict';
import {SIZE,CENTER,pos,makeTile,makeBag,refill,checkEquation,validateMove,inspectPlacement,scoreMove,bonusAt,nextTarget,BLANK_NUMBER,BLANK_OPERATOR,BLANK_ANY,isBlank,resolveBlank,freeExchangeReason,reorderRack} from '../src/engine.js';
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
 assert.equal(score.equation,5);assert.equal(score.crossing,0);
 assert.equal(score.total,score.base*score.multiplier+3+5);
 assert.equal(bonusAt(0,0),'3E');
});
test('bag refilling, turn targets and rack clear bookkeeping',()=>{
 const bag=makeBag(()=>0.5);assert.ok(bag.length>100);const draw=refill([],bag);assert.equal(draw.rack.length,8);
 assert.equal(draw.rack.length+draw.bag.length,bag.length);assert.ok(nextTarget(3)>nextTarget(2));
});

test('placement inspection guides students without answering the arithmetic',()=>{
 const board=Array(SIZE*SIZE).fill(null);
 const empty=inspectPlacement(board,{});
 assert.equal(empty.status,'empty');
 const pending=place(['8','+','4','=','1','2'],'h',3);
 const ready=inspectPlacement(board,pending);
 assert.equal(ready.status,'ready');
 assert.equal(ready.ready,true);
 assert.equal(ready.text,'8+4=12');
 assert.equal(ready.indices.length,6);
 const incorrect=place(['8','+','4','=','1','3'],'h',3);
 assert.equal(inspectPlacement(board,incorrect).ready,true);
 assert.throws(()=>validateMove(board,incorrect),/not balanced/i);
 const noEquals=place(['8','+','4'],'h',4);
 assert.equal(inspectPlacement(board,noEquals).status,'building');
 const gap={...pending};delete gap[pos(CENTER,5)];
 assert.equal(inspectPlacement(board,gap).status,'gap');
 const offCentre=place(['1','=','1'],'h',0,0);
 assert.equal(inspectPlacement(board,offCentre).status,'centre');
});
test('preview follows existing tiles when an equation is connected',()=>{
 const board=Array(SIZE*SIZE).fill(null);
 const first=place(['8','+','4','=','1','2'],'h',3);
 Object.entries(first).forEach(([i,t])=>board[i]=t);
 const second=place(['+','3','=','1','1'],'v',CENTER+1,3);
 const preview=inspectPlacement(board,second);
 assert.equal(preview.text,'8+3=11');
 assert.equal(preview.ready,true);
 assert.deepEqual(preview.indices,validateMove(board,second).indices);
});

test('simple identities are disallowed; meaningful equations still work',()=>{
 for(const symbols of [['3','=','3'],['1','2','=','1','2'],['0','=','0'],['0','=','−','0']])
   assert.throws(()=>checkEquation(symbols),/calculation/i);
 assert.equal(checkEquation(['3','+','2','=','5']).text,'3+2=5');
 assert.equal(checkEquation(['1','2','=','3','×','4']).text,'12=3×4');
 assert.equal(checkEquation(['8','−','3','=','5']).text,'8−3=5');
});
test('the bag includes all three zero-point blanks in fair quantities',()=>{
 const bag=makeBag(()=>0.25);
 assert.equal(bag.length,151);
 for(const [kind,count] of [[BLANK_NUMBER,7],[BLANK_OPERATOR,5],[BLANK_ANY,5]]){
  const tiles=bag.filter(t=>t.blank===kind);
  assert.equal(tiles.length,count);
  assert.ok(tiles.every(t=>t.points===0&&t.value===null&&isBlank(t)));
 }
});
test('blank number, operator and any accept only their allowed symbols',()=>{
 const number=makeTile(BLANK_NUMBER),operation=makeTile(BLANK_OPERATOR),any=makeTile(BLANK_ANY);
 assert.equal(resolveBlank(number,'8').value,'8');
 assert.equal(resolveBlank(operation,'÷').value,'÷');
 assert.equal(resolveBlank(any,'9').value,'9');
 assert.equal(resolveBlank(any,'+').value,'+');
 assert.throws(()=>resolveBlank(number,'+'),/cannot be assigned/i);
 assert.throws(()=>resolveBlank(operation,'3'),/cannot be assigned/i);
 assert.equal(resolveBlank(number,'6').points,0);
 const pending=place(['2','+','4','=','6'],'h',4);
 const index=pos(CENTER,6);
 pending[index]=resolveBlank(number,'4');
 const board=Array(SIZE*SIZE).fill(null);
 const move=validateMove(board,pending);
 assert.equal(move.text,'2+4=6');
 assert.equal(scoreMove(board,pending,move).base,7); // 2 + operator 2 + blank 0 + digit 6 worth 3
});
test('any non-empty rack is eligible for a once-per-turn free single-tile swap',()=>{
 for(const values of [['1','2','4'],['+','−','×'],['1','+'],['1',BLANK_ANY]])
   assert.equal(freeExchangeReason(make(values)),'one tile each turn');
 assert.equal(freeExchangeReason([]),null);
});
test('the board has full reflection and rotation symmetry for every premium',()=>{
 for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
   const value=bonusAt(r,c);
   for(const [y,x] of [[SIZE-1-r,c],[r,SIZE-1-c],[c,r],[SIZE-1-r,SIZE-1-c],
     [SIZE-1-c,SIZE-1-r],[c,SIZE-1-r],[SIZE-1-c,r]])
      assert.equal(bonusAt(y,x),value,'symmetry mismatch '+r+','+c+' -> '+y+','+x);
 }
});
test('drag reorder moves tiles among visible rack slots and back from board',()=>{
 const rack=make(['1','2','3','4','5']);
 const order=tiles=>tiles.map(t=>t.value).join('');
 assert.equal(order(reorderRack(rack,rack[1].id,3)), '13245');
 assert.equal(order(reorderRack(rack,rack[2].id,0)), '31245');
 // The source tile is unscored on the board and hidden while determining a rack slot.
 assert.equal(order(reorderRack(rack,rack[3].id,1,[rack[3].id])), '14235');
 assert.equal(new Set(reorderRack(rack,rack[3].id,1,[rack[3].id]).map(t=>t.id)).size,5);
});
