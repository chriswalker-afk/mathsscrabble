import test from 'node:test';
import assert from 'node:assert/strict';
import {SIZE,CENTER,makeTile,BLANK_ANY,pos,validateMove,scoreMove,bonusAt} from '../src/engine.js';
import {makeRogueState,scoreRogueMove,anomalyForSector} from '../src/rogue.js';
import {buildScoringCeremony,ceremonyDurationMs} from '../src/score-ceremony.js';

const makeEquation=(values,row=CENTER,col=CENTER-3)=>{
 const board=Array(SIZE*SIZE).fill(null),pending={};
 values.forEach((value,i)=>pending[pos(row,col+i)]=makeTile(value));
 return {board,pending,move:validateMove(board,pending)};
};
const total=stages=>stages.reduce((n,stage)=>n+stage.amount,0);
test('each equation cell receives its exact score before equation bonuses',()=>{
 const {board,pending,move}=makeEquation(['8','+','4','=','1','2']);
 const points=scoreMove(board,pending,move);
 const stages=buildScoringCeremony(points);
 const tiles=stages.filter(x=>x.kind==='tile');
 assert.equal(tiles.length,6);
 assert.deepEqual(tiles.map(x=>x.value),['8','+','4','=','1','2']);
 assert.equal(tiles[0].amount,8,'8 on 2T earns 8');
 assert.equal(tiles[3].amount,0,'the unlimited equals sign scores zero');
 assert.equal(tiles.reduce((n,t)=>n+t.amount,0),points.base*points.multiplier);
 assert.equal(total(stages),points.total);
 assert.deepEqual(stages.filter(x=>x.kind==='bonus').map(x=>x.id),['equation','length']);
 assert.ok(stages.every(x=>Number.isSafeInteger(x.amount)));
});
test('an equation multiplier is applied exactly once to every tile',()=>{
 const board=Array(SIZE*SIZE).fill(null);
 // A connected perpendicular equation reuses an existing tile.
 const start=makeEquation(['8','+','4','=','1','2']);
 for(const [i,tile] of Object.entries(start.pending))board[Number(i)]=tile;
 const down={};for(const [offset,value] of ['+','3','=','1','1'].entries()){
   down[pos(10+offset,6)]=makeTile(value);
 }
 const connected=validateMove(board,down);
 const points=scoreMove(board,down,connected);
 const stages=buildScoringCeremony(points);
 assert.equal(total(stages),points.total);
 assert.ok(stages.find(x=>x.kind==='tile'&&x.existing),'locked shared tile must have a stage');
 assert.ok(stages.find(x=>x.kind==='bonus'&&x.id==='crossing'));
});
test('a real 2E square doubles each tile contribution once, including a locked crossing tile',()=>{
 const first=makeEquation(['8','+','4','=','1','2']);
 const board=Array(SIZE*SIZE).fill(null);
 for(const [index,tile] of Object.entries(first.pending))board[Number(index)]=tile;
 // The newly placed multiplication symbol occupies (9,3), a 2E square.
 // 8+0×1=8 is valid BIDMAS, connects to the locked 8 and fits through row 12.
 const pending={};
 for(const [offset,value] of ['+','0','×','1','=','8'].entries())
   pending[pos(10+offset,6)]=makeTile(value);
 const move=validateMove(board,pending);
 const points=scoreMove(board,pending,move);
 assert.equal(points.multiplier,2);
 const stages=buildScoringCeremony(points);
 const reused=stages.find(stage=>stage.index===pos(9,6));
 assert.equal(reused.existing,true);
 assert.equal(reused.amount,board[pos(9,6)].points*2);
 const operator=stages.find(stage=>stage.index===pos(12,6));
 assert.equal(operator.value,'×');
 assert.equal(operator.premium,'2E');
 assert.equal(operator.amount,pending[pos(12,6)].points*2);
 assert.equal(total(stages),points.total);
});
test('programmed zero-point wildcards and a reused tile stay in the ceremony',()=>{
 const {board,pending,move}=makeEquation(['8','+','4','=','1','2']);
 pending[pos(9,8)]={...makeTile(BLANK_ANY),value:'4',points:0};
 const revised=validateMove(board,pending);
 const result=buildScoringCeremony(scoreMove(board,pending,revised));
 const wildcard=result.find(stage=>stage.kind==='tile'&&stage.index===pos(9,8));
 assert.equal(wildcard.amount,0);
 assert.match(wildcard.label,/WILDCARD/);
 assert.equal(total(result),scoreMove(board,pending,revised).total);
});
test('Drift equipment and anomaly stages always sum to the authoritative score',()=>{
 const {board,pending,move}=makeEquation(['8','+','4','=','1','2']);
 const upgrades=['ion-seven','operator-core','amplifier','crosslink','longwave','echo','leak-shield'];
 for(const sector of [1,3,6,9,12,15]){
   for(const equipped of [[],upgrades,['amplifier','echo'],['operator-core']]){
     const rogue={...makeRogueState(),upgrades:equipped,pulse:1};
     const pts=scoreRogueMove(board,pending,move,rogue,sector);
     const stages=buildScoringCeremony(pts);
     assert.equal(total(stages),pts.total,'sector '+sector+' equipment '+equipped.join(','));
     assert.equal(stages.filter(x=>x.kind==='tile').length,move.indices.length);
     assert.equal(stages.find(x=>x.kind==='bonus'&&x.id==='upgrade')?.amount,pts.extra);
     assert.equal(stages.find(x=>x.kind==='penalty')?.amount??0,pts.anomalyPenalty?-pts.anomalyPenalty:0);
   }
 }
});
test('amplifier and other tile upgrades allocate energy to the correct tile stage',()=>{
 const {board,pending,move}=makeEquation(['8','+','4','=','1','2']);
 assert.equal(bonusAt(9,6),'2T');
 const plain=scoreRogueMove(board,pending,move,makeRogueState(),1);
 const amped=scoreRogueMove(board,pending,move,{...makeRogueState(),upgrades:['amplifier']},1);
 const index=pos(9,6);
 const a=buildScoringCeremony(plain).find(x=>x.index===index);
 const b=buildScoringCeremony(amped).find(x=>x.index===index);
 assert.equal(b.amount-a.amount,4);
 assert.equal(total(buildScoringCeremony(amped)),amped.total);
});
test('Power Leak appears as a deduction after tiles and bonus stages',()=>{
 const {board,pending,move}=makeEquation(['8','+','4','=','1','2']);
 assert.equal(anomalyForSector(3).id,'power-leak');
 const pts=scoreRogueMove(board,pending,move,makeRogueState(),3);
 const stages=buildScoringCeremony(pts);
 const final=stages.at(-1);
 assert.equal(final.kind,'penalty');
 assert.equal(final.amount,-pts.anomalyPenalty);
 assert.equal(total(stages),pts.total);
});
test('score plan fails closed if any stage or declared total is inconsistent',()=>{
 const pts=scoreMove(...Object.values(makeEquation(['8','+','4','=','1','2'])));
 assert.throws(()=>buildScoringCeremony({...pts,total:pts.total+1}),/exactly match/i);
 assert.throws(()=>buildScoringCeremony({...pts,tileScores:[]}),/exactly match/i);
 assert.throws(()=>buildScoringCeremony({...pts,multiplier:0}),/integer-valued/i);
});
test('tile choreography speeds up gently for longer expressions',()=>{
 assert.ok(ceremonyDurationMs(5)>ceremonyDurationMs(8));
 assert.ok(ceremonyDurationMs(8)>ceremonyDurationMs(11));
 assert.ok(ceremonyDurationMs(11)>=200);
});
