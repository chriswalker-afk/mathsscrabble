import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBag,makeTile,bonusAt,pos,nextTarget,scoreMove,validateMove,BLANK_ANY} from '../src/engine.js';
import {dealPlayableRack,saveRun,loadRun,freshStats,freshProgress,sectorReport,completeProgress} from '../src/solo.js';
import {
 ROGUE_SAVE_KEY,ROGUE_ITEMS,ROGUE_ITEM_BY_ID,makeRogueState,anomalyForSector,
 targetForSector,shopOffers,purchaseUpgrade,PULSE_ITEM,purchasePulse,consumePulse,rogueRackOptions,fluxReward,
 rewardSector,scoreRogueMove,validRogueState
} from '../src/rogue.js';

const storage=()=>{
 const map=new Map();
 return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
};
const makeState=(mode='rogue')=>{
 const original=makeBag(()=>0.25);
 const draw=dealPlayableRack([],original);
 return {board:Array(169).fill(null),pending:{},rack:draw.rack,bag:draw.bag,
   sector:1,turn:1,score:0,phase:'playing',placementOrder:[],
   stats:freshStats(),progress:freshProgress(),
   mode,rogue:mode==='rogue'?makeRogueState():null};
};
function boosted(upgrades=[],extra={}) {
 const state={...makeRogueState(),...extra};
 state.upgrades=upgrades;
 state.spent=upgrades.reduce((sum,id)=>sum+ROGUE_ITEM_BY_ID[id].cost,0);
 state.earned=Math.max(state.earned,state.spent);
 state.flux=state.earned-state.spent;
 return state;
}
function moveAt(values,startCol=3,row=6){
 const board=Array(169).fill(null),pending={};
 values.map(makeTile).forEach((tile,i)=>pending[pos(row,startCol+i)]=tile);
 const move=validateMove(board,pending);
 return {board,pending,move};
}
test('all anomaly bosses are deterministic every third sector',()=>{
 assert.equal(anomalyForSector(1),null);
 assert.equal(anomalyForSector(2),null);
 assert.equal(anomalyForSector(3).id,'power-leak');
 assert.equal(anomalyForSector(6).id,'signal-jam');
 assert.equal(anomalyForSector(9).id,'critical');
 assert.equal(anomalyForSector(12).id,'tile-static');
 assert.equal(anomalyForSector(15).id,'power-leak');
 assert.equal(targetForSector('sector',9),nextTarget(9));
 assert.equal(targetForSector('rogue',9),Math.ceil(nextTarget(9)*1.2));
 assert.equal(targetForSector('rogue',3),nextTarget(3));
});
test('first shop provides different build paths and purchases never duplicate',()=>{
 const initial=makeRogueState(),earned=rewardSector(initial,1,65,4);
 assert.ok(earned.reward>=5);
 assert.equal(earned.rogue.shopSector,1);
 assert.deepEqual(shopOffers(1,earned.rogue).map(x=>x.id),
  ['ion-seven','crosslink','longwave','wild-beacon']);
 const bought=purchaseUpgrade(earned.rogue,'ion-seven',1);
 assert.equal(bought.ok,true);
 assert.equal(bought.rogue.flux,earned.rogue.flux-4);
 assert.deepEqual(bought.rogue.upgrades,['ion-seven']);
 assert.equal(purchaseUpgrade(bought.rogue,'ion-seven',1).ok,false);
 assert.equal(purchaseUpgrade(bought.rogue,'not-real',1).ok,false);
 assert.equal(purchaseUpgrade(bought.rogue,'amplifier',1).ok,false);
 assert.equal(purchaseUpgrade(bought.rogue,'crosslink',2).ok,false);
 assert.equal(validRogueState(bought.rogue,1,'won'),true);
 assert.equal(validRogueState(bought.rogue,2,'playing'),true);
});
test('no double Flux rewards after refreshing a completed sector',()=>{
 const initial=makeRogueState(),first=rewardSector(initial,1,90,2);
 assert.equal(first.rogue.flux,first.reward);
 assert.equal(rewardSector(first.rogue,1,90,2).reward,0);
 assert.deepEqual(rewardSector(first.rogue,1,90,2).rogue,first.rogue);
 const second=rewardSector(first.rogue,2,90,6);
 assert.ok(second.reward>0);
 assert.equal(second.rogue.earned,first.reward+second.reward);
 assert.equal(second.rogue.flux,first.reward+second.reward);
});
test('different passives affect tangible score without changing mathematical truth',()=>{
 const sample=moveAt(['7','+','1','=','8'],4);
 const standard=scoreMove(sample.board,sample.pending,sample.move);
 const plain=scoreRogueMove(sample.board,sample.pending,sample.move,makeRogueState(),1);
 assert.equal(plain.total,standard.total);
 const ion=scoreRogueMove(sample.board,sample.pending,sample.move,boosted(['ion-seven']),1);
 assert.ok(ion.total>=plain.total+3);
 const operator=moveAt(['3','×','2','=','6'],4);
 const vanilla=scoreRogueMove(operator.board,operator.pending,operator.move,makeRogueState(),1);
 const boostedOperator=scoreRogueMove(operator.board,operator.pending,operator.move,boosted(['operator-core']),1);
 assert.ok(boostedOperator.total>=vanilla.total+3);
});
test('wildcards remain zero point even when symbol matches an equipped upgrade',()=>{
 const {board,pending,move}=moveAt(['7','+','1','=','8'],4);
 const index=pos(6,4);
 pending[index]={...makeTile(BLANK_ANY),value:'7',points:0};
 const corrected=validateMove(board,pending);
 const score=scoreRogueMove(board,pending,corrected,boosted(['ion-seven']),1);
 const unboosted=scoreRogueMove(board,pending,corrected,makeRogueState(),1);
 assert.equal(score.total,unboosted.total);
});
test('Amplifier Array upgrades every newly placed 2T into a 3T',()=>{
 const {board,pending,move}=moveAt(['8','+','4','=','1','2'],3);
 assert.equal(bonusAt(6,3),'2T');
 const vanilla=scoreRogueMove(board,pending,move,makeRogueState(),1);
 const boostedScore=scoreRogueMove(board,pending,move,boosted(['amplifier']),1);
 assert.equal(boostedScore.base-vanilla.base,4);
 assert.equal(boostedScore.total-vanilla.total,4*vanilla.multiplier);
});
test('Crosslink and Longwave add energy only in relevant contexts',()=>{
 const first=moveAt(['8','+','4','=','1','2'],3);
 const board=[...first.board];
 for(const [index,tile] of Object.entries(first.pending))board[Number(index)]=tile;
 const pending={};
 for(const [j,value] of ['+','3','=','1','1'].entries())pending[pos(7+j,3)]=makeTile(value);
 const move=validateMove(board,pending);
 const without=scoreRogueMove(board,pending,move,makeRogueState(),1);
 const withCross=scoreRogueMove(board,pending,move,boosted(['crosslink']),1);
 assert.equal(withCross.total-without.total,5);
 assert.equal(scoreRogueMove(first.board,first.pending,first.move,boosted(['crosslink']),1).total,
   scoreRogueMove(first.board,first.pending,first.move,makeRogueState(),1).total);
 const long=moveAt(['1','2','+','3','=','1','5'],3);
 const wave=scoreRogueMove(long.board,long.pending,long.move,boosted(['longwave']),1);
 assert.equal(wave.total-scoreRogueMove(long.board,long.pending,long.move,makeRogueState(),1).total,7);
});
test('Echo Generator counts placed physical tiles above four',()=>{
 const {board,pending,move}=moveAt(['8','+','4','=','1','2'],3);
 const vanilla=scoreRogueMove(board,pending,move,makeRogueState(),1);
 const echo=scoreRogueMove(board,pending,move,boosted(['echo']),1);
 assert.equal(echo.total-vanilla.total,2);
});
test('anomalies change actual scoring; Leak Shield negates only Power Leak',()=>{
 const {board,pending,move}=moveAt(['8','+','4','=','1','2'],3);
 const scoreBase=scoreRogueMove(board,pending,move,makeRogueState(),1);
 const leak=scoreRogueMove(board,pending,move,makeRogueState(),3);
 assert.equal(leak.total,scoreBase.total-Math.floor(scoreBase.total*.15));
 assert.equal(scoreRogueMove(board,pending,move,boosted(['leak-shield']),3).total,scoreBase.total);
 const jam=scoreRogueMove(board,pending,move,makeRogueState(),6);
 assert.ok(jam.total<=scoreBase.total);
 assert.equal(jam.anomaly,'signal-jam');
 const staticScore=scoreRogueMove(board,pending,move,makeRogueState(),12);
 assert.equal(staticScore.anomaly,'tile-static');
});
test('rack passives change draw constraints while retaining all physical IDs',()=>{
 const bag=makeBag(()=>0.5);
 const defaultRack=dealPlayableRack([],bag);
 const equipped=dealPlayableRack([],bag,rogueRackOptions(boosted(['wild-beacon','operator-reserve'])));
 assert.equal(defaultRack.rack.length,8);
 assert.equal(equipped.rack.length,8);
 assert.ok(equipped.rack.filter(t=>t.blank).length>=2,'two flexible tiles');
 assert.ok(equipped.rack.filter(t=>['+','−','×','÷'].includes(t.value)||['blank-any','blank-operator'].includes(t.blank)).length>=2);
 assert.equal(new Set([...equipped.rack,...equipped.bag].map(t=>t.id)).size,151);
});
test('Rogue and classic saves are independent, including shop progress',()=>{
 const store=storage(),classic=makeState('sector'),rogue=makeState();
 assert.equal(saveRun(store,classic),true);
 assert.equal(saveRun(store,rogue),true);
 assert.equal(loadRun(store,'sector').mode,'sector');
 assert.equal(loadRun(store,'rogue').mode,'rogue');
 const award=rewardSector(rogue.rogue,1,41,4);
 rogue.rogue=award.rogue;rogue.phase='won';rogue.score=41;
 const report=sectorReport(1,41,4,rogue.stats,true);
 rogue.progress=completeProgress(rogue.progress,report);
 assert.equal(saveRun(store,rogue),true);
 assert.ok(loadRun(store,'rogue').rogue.flux>0);
 assert.equal(loadRun(store,'sector').phase,'playing');
 const bought=purchaseUpgrade(rogue.rogue,'ion-seven',1);
 assert.ok(bought.ok);rogue.rogue=bought.rogue;
 assert.equal(saveRun(store,rogue),true);
 assert.ok(loadRun(store,'rogue').rogue.upgrades.includes('ion-seven'));
 assert.ok(store.getItem(ROGUE_SAVE_KEY));
});
test('corrupt rogue wallets and upgrades cannot resume',()=>{
 const store=storage(),state=makeState();
 assert.equal(saveRun(store,state),true);
 const good=JSON.parse(store.getItem(ROGUE_SAVE_KEY));
 for(const invalid of [
  {...good,rogue:{...good.rogue,flux:100}},
  {...good,rogue:{...good.rogue,shopSector:1}},
  {...good,rogue:{...good.rogue,upgrades:['fake']}},
  {...good,mode:'sector'},
 ]){
  store.setItem(ROGUE_SAVE_KEY,JSON.stringify(invalid));
  assert.equal(loadRun(store,'rogue'),null);
 }
});

test('single-use capacitor is purchased with Flux and consumed exactly once',()=>{
 const reward=rewardSector(makeRogueState(),1,100,1);
 assert.ok(reward.rogue.flux>=10);
 let after=purchasePulse(reward.rogue,1);
 assert.equal(after.ok,true);
 assert.equal(after.rogue.pulse,1);
 assert.equal(after.rogue.pulseBought,1);
 assert.equal(after.rogue.flux,reward.rogue.flux-PULSE_ITEM.cost);
 assert.equal(validRogueState(after.rogue,1,'won'),true);
 const {board,pending,move}=moveAt(['8','+','4','=','1','2'],3);
 const plain=scoreRogueMove(board,pending,move,reward.rogue,1);
 const charged=scoreRogueMove(board,pending,move,after.rogue,1);
 assert.equal(charged.total-plain.total,12);
 after={...after,rogue:consumePulse(after.rogue)};
 assert.equal(after.rogue.pulse,0);
 assert.equal(after.rogue.pulseUsed,1);
 assert.equal(validRogueState(after.rogue,2,'playing'),true);
 assert.equal(scoreRogueMove(board,pending,move,after.rogue,2).total,
   scoreRogueMove(board,pending,move,reward.rogue,2).total);
 assert.equal(consumePulse(after.rogue),after.rogue,'empty capacitor cannot be used twice');
});
test('a shop may sell several capacitors but the carry limit is three',()=>{
 let rogue=rewardSector(makeRogueState(),1,500,1).rogue;
 for(let i=0;i<3;i++){
   const purchase=purchasePulse(rogue,1);
   assert.equal(purchase.ok,true);
   rogue=purchase.rogue;
 }
 assert.equal(rogue.pulse,3);
 assert.equal(purchasePulse(rogue,1).ok,false);
 assert.equal(validRogueState(rogue,1,'won'),true);
 rogue=consumePulse(rogue);
 assert.equal(rogue.pulse,2);
 assert.equal(purchasePulse(rogue,1).ok,true);
});

test('Wildcard Beacon plus Operator Reserve works across 250 shuffled bags',()=>{
 const equipment=boosted(['wild-beacon','operator-reserve']);
 let seed=7;
 for(let iteration=0;iteration<250;iteration++){
   seed=(1664525*seed+1013904223)>>>0;
   let state=seed;
   const rng=()=>{state=(1664525*state+1013904223)>>>0;return state/4294967296;};
   const all=makeBag(rng);
   const deal=dealPlayableRack([],all,rogueRackOptions(equipment));
   assert.equal(deal.rack.length,8);
   const blanks=deal.rack.filter(t=>Boolean(t.blank)).length;
   const operators=deal.rack.filter(t=>['+','−','×','÷'].includes(t.value)||['blank-operator','blank-any'].includes(t.blank)).length;
   const numbers=deal.rack.filter(t=>/^[0-9]$/.test(t.value)||['blank-number','blank-any'].includes(t.blank)).length;
   assert.ok(blanks>=2,'need at least two flexible tiles, iteration '+iteration);
   assert.ok(operators>=2,'need at least two operator-capable tiles, iteration '+iteration);
   assert.ok(numbers>=4,'need at least four number-capable tiles, iteration '+iteration);
   assert.equal(deal.rack.length+deal.bag.length,151);
 }
});
