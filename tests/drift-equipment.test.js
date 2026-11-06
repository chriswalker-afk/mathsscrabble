import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBag,makeTile,validateMove,pos,tilePool} from '../src/engine.js';
import {dealPlayableRack,saveRun,loadRun,freshStats,freshProgress} from '../src/solo.js';
import {buildScoringCeremony} from '../src/score-ceremony.js';
import {
 ROGUE_ITEMS,TEMP_ITEMS,MAX_PERMANENT_SLOTS,MAX_TEMPORARY_SLOTS,
 makeRogueState,purchaseUpgrade,purchaseTemporary,shopOffers,shopTemperatures,
 heldConsumables,consumeTemporary,armTemporary,useTileTemporary,
 freeSwapsRemaining,markFreeSwap,turnLimit,rackSlots,rogueRackOptions,
 scoreRogueMove,consumeBoardEcho,earnMoveFlux,validRogueState
} from '../src/rogue.js';

const rng=()=>0.31;
const wealthy=()=>({ ...makeRogueState(),earned:300,flux:300,shopSector:1 });
const equipment=(...upgrades)=>({...makeRogueState(),upgrades,
 earned:upgrades.reduce((sum,id)=>sum+ROGUE_ITEMS.find(i=>i.id===id).cost,0),
 spent:upgrades.reduce((sum,id)=>sum+ROGUE_ITEMS.find(i=>i.id===id).cost,0)});
function firstMove(){
 const board=Array(169).fill(null),pending={};
 for(const [i,value] of ['8','+','4','=','1','2'].entries())pending[pos(6,3+i)]=makeTile(value);
 return {board,pending,move:validateMove(board,pending)};
}
test('the shop defines independent board-space, tile-type and length disciplines',()=>{
 assert.ok(ROGUE_ITEMS.length>=18);
 assert.ok(TEMP_ITEMS.length>=7);
 assert.equal(new Set([...ROGUE_ITEMS,...TEMP_ITEMS].map(i=>i.id)).size,
   ROGUE_ITEMS.length+TEMP_ITEMS.length);
 for(const category of ['BOARD SPACE','TILE TYPE','LENGTH BONUS','ECONOMY','RACK','TACTICS'])
   assert.ok(ROGUE_ITEMS.some(i=>i.kind===category),'missing '+category);
 assert.ok(TEMP_ITEMS.some(i=>i.action==='score'));
 assert.ok(TEMP_ITEMS.some(i=>i.action==='tile'));
 assert.equal(MAX_PERMANENT_SLOTS,4);assert.equal(MAX_TEMPORARY_SLOTS,2);
});
test('four permanent modules fit; a fifth purchase is denied with no Flux deducted',()=>{
 let rogue=wealthy();
 for(let i=0;i<4;i++){
   const offer=shopOffers(1,rogue)[0];
   const result=purchaseUpgrade(rogue,offer.id,1);
   assert.equal(result.ok,true);
   rogue=result.rogue;
 }
 const cash=rogue.flux,choices=shopOffers(1,rogue);
 assert.equal(rogue.upgrades.length,4);
 assert.equal(purchaseUpgrade(rogue,choices[0].id,1).ok,false);
 assert.equal(rogue.flux,cash);
 assert.equal(validRogueState(rogue,1,'won'),true);
});
test('two consumables can be stored, armed, used and replaced; inventory is conserved',()=>{
 let rogue=wealthy();
 for(let i=0;i<2;i++)rogue=purchaseTemporary(rogue,'pulse-charge',1).rogue;
 assert.equal(heldConsumables(rogue).length,2);
 assert.equal(purchaseTemporary(rogue,'pulse-charge',1).ok,false);
 assert.equal(armTemporary(rogue,'pulse-charge').ok,true);
 rogue=consumeTemporary(rogue,'pulse-charge');
 assert.equal(heldConsumables(rogue).length,1);
 assert.equal(purchaseTemporary(rogue,'pulse-charge',1).ok,true);
 assert.equal(validRogueState(rogue,1,'won'),true);
});
test('the second free swap is a separate single-tile action, never a two-tile swap',()=>{
 let r=equipment('extra-swap');
 assert.equal(freeSwapsRemaining(r,2,0),2);
 r=markFreeSwap(r,2);
 assert.equal(freeSwapsRemaining(r,2,2),1);
 r=markFreeSwap(r,2,2);
 assert.equal(freeSwapsRemaining(r,2,2),0);
 assert.equal(freeSwapsRemaining(r,3,2),2);
 assert.equal(freeSwapsRemaining(makeRogueState(),1,0),1);
});
test('wide rack draws 6 number-kind + 3 operator-kind tiles from finite supply',()=>{
 const bag=makeBag(rng),r=equipment('wide-rack'),draw=dealPlayableRack([],bag,rogueRackOptions(r),rng);
 assert.equal(rackSlots(r),9);
 assert.equal(draw.rack.length,9);
 assert.equal(draw.rack.filter(t=>tilePool(t)==='numbers').length,6);
 assert.equal(draw.rack.filter(t=>tilePool(t)==='operators').length,3);
 assert.equal(draw.bag.length,142);
 assert.equal(new Set([...draw.rack,...draw.bag].map(t=>t.id)).size,151);
 assert.equal(turnLimit(equipment('extra-turn')),7);
});
test('Step Up swaps a physical 3 to an available 4 and never fabricates a tile',()=>{
 const full=makeBag(rng),deal=dealPlayableRack([],full,{},rng);
 const rack=[...deal.rack],bag=[...deal.bag];
 const source=bag.findIndex(t=>t.value==='3'&&!t.blank);
 const previous=rack.findIndex(t=>tilePool(t)==='numbers');
 assert.ok(source>=0&&previous>=0);
 const three=bag.splice(source,1)[0];bag.push(rack[previous]);rack[previous]=three;
 const beforeBag=bag.filter(t=>t.value==='4'&&!t.blank).length;
 assert.ok(beforeBag>0);
 const rogue={...makeRogueState(),tempSlots:['step-up'],tempBought:['step-up'],
   spent:3,earned:3};
 const changed=useTileTemporary(rogue,rack,bag,'step-up',three.id,rng);
 assert.equal(changed.ok,true);
 assert.equal(changed.rack.find(t=>t.id===three.id),undefined);
 assert.equal(changed.rack[previous].value,'4');
 assert.equal(changed.bag.filter(t=>t.value==='4'&&!t.blank).length,beforeBag-1);
 assert.equal(changed.bag.filter(t=>t.id===three.id).length,1);
 assert.equal(changed.rack.length+changed.bag.length,151);
 assert.equal(new Set([...changed.rack,...changed.bag].map(t=>t.id)).size,151);
 assert.equal(heldConsumables(changed.rogue).length,0);
});
test('an impossible digit power is not consumed or charged as a turn',()=>{
 const rogue={...makeRogueState(),tempSlots:['step-up'],tempBought:['step-up'],
   spent:3,earned:3};
 const tile=makeTile('9'),bag=[makeTile('4')];
 const result=useTileTemporary(rogue,[tile],bag,'step-up',tile.id,rng);
 assert.equal(result.ok,false);
 assert.equal(result.rogue,rogue);
});
test('Double Reactor multiplies the verified score and keeps ceremony totals exact',()=>{
 const {board,pending,move}=firstMove(),plain=scoreRogueMove(board,pending,move,makeRogueState(),1);
 const rogue={...makeRogueState(),tempSlots:['double-score'],tempBought:['double-score'],
   spent:7,earned:7,armed:'double-score'};
 const powered=scoreRogueMove(board,pending,move,rogue,1);
 assert.equal(powered.total,plain.total*2);
 assert.equal(powered.tempApplied,'double-score');
 assert.equal(buildScoringCeremony(powered).reduce((n,x)=>n+x.amount,0),powered.total);
 assert.equal(consumeTemporary(rogue,powered.tempApplied).tempSlots.length,0);
});
test('Second Spark reuses a premium square only once across subsequent equations',()=>{
 const first=firstMove(),board=[...first.board];
 for(const [i,t] of Object.entries(first.pending))board[Number(i)]=t;
 const pending={};
 for(const [j,value] of ['+','3','=','1','1'].entries())pending[pos(7+j,3)]=makeTile(value);
 const move=validateMove(board,pending);
 const plain=scoreRogueMove(board,pending,move,makeRogueState(),2);
 const rogue=equipment('bonus-echo');
 const once=scoreRogueMove(board,pending,move,rogue,2);
 assert.ok(once.total>plain.total);
 assert.ok(once.echoedIndices.includes(pos(6,3)));
 const spent=consumeBoardEcho(rogue,once.echoedIndices);
 const twice=scoreRogueMove(board,pending,move,spent,2);
 assert.equal(twice.total,plain.total);
});
test('economy upgrades earn immediate Flux on scored moves, not invalid attempts',()=>{
 const {pending}=firstMove(),rogue=equipment('precision-pay','premium-dividend');
 const earned=earnMoveFlux(rogue,pending);
 assert.ok(earned.amount>=3);
 assert.equal(earned.rogue.flux,rogue.flux+earned.amount);
 assert.equal(earned.rogue.earned,rogue.earned+earned.amount);
 assert.equal(validRogueState(earned.rogue,1,'playing'),true);
});
