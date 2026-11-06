import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBag,makeTile,BLANK_ANY,BLANK_OPERATOR,isBlank,isDigit,isOperator,pos,nextTarget} from '../src/engine.js';
import {
 SAVE_KEY,SAVE_VERSION,dealPlayableRack,freshStats,freshProgress,
 recordMove,sectorReport,completeProgress,snapshotRun,saveRun,loadRun,clearRun
} from '../src/solo.js';

const storage=()=>{
 const map=new Map();
 return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
};
const makeState=()=>{
 const original=makeBag(()=>0.5);
 const deal=dealPlayableRack([],original);
 return {
  board:Array(169).fill(null),rack:deal.rack,bag:deal.bag,pending:{},
  sector:1,turn:1,score:0,phase:'playing',placementOrder:[],
  stats:freshStats(),progress:freshProgress()
 };
};
function randomFromSeed(seed){
 let n=seed>>>0;
 return ()=>{n=(1664525*n+1013904223)>>>0;return n/4294967296;};
}
test('balanced eight-tile draws always preserve bag and physical tile IDs',()=>{
 for(let seed=1;seed<=350;seed++){
   const full=makeBag(randomFromSeed(seed));
   const dealt=dealPlayableRack([],full);
   const all=[...dealt.rack,...dealt.bag];
   assert.equal(dealt.rack.length,8);
   assert.equal(all.length,full.length);
   assert.equal(new Set(all.map(t=>t.id)).size,full.length);
   assert.ok(dealt.rack.filter(t=>isDigit(t.value)||t.blank==='blank-number'||t.blank==='blank-any').length>=4,'number-capable rack');
   assert.ok(dealt.rack.some(t=>isOperator(t.value)||t.blank==='blank-operator'||t.blank==='blank-any'),'operator-capable rack');
   assert.ok(dealt.rack.some(isBlank),'at least one flexible choice');
 }
});
test('balanced refill retains every tile that was not played',()=>{
 const full=makeBag(randomFromSeed(23));
 const first=dealPlayableRack([],full);
 const held=first.rack.slice(0,3);
 const result=dealPlayableRack(held,first.bag);
 assert.equal(result.rack.length,8);
 assert.deepEqual(result.rack.slice(0,3),held);
 assert.equal(new Set([...result.rack,...result.bag].map(x=>x.id)).size, result.rack.length+result.bag.length);
});
test('when supply runs low, drawing never fabricates tiles',()=>{
 const held=[makeTile('9'),makeTile('8')];
 const bag=[makeTile('+')];
 assert.equal(dealPlayableRack(held,bag).rack.length,3);
 assert.equal(dealPlayableRack(held,[]).rack.length,2);
});
test('reports summarise best move and progress without double counting',()=>{
 const stats=freshStats();
 const move={text:'8+4=12',indices:[1,2,3,4,5,6]};
 const points={total:28,crossing:0,bonuses:['Double tile']};
 const pending={1:makeTile('8'),2:makeTile('+')};
 const updated=recordMove(stats,move,points,1,pending);
 assert.equal(stats.moves.length,0);
 assert.equal(updated.moves[0].equation,'8+4=12');
 assert.equal(updated.moves[0].points,28);
 const another=recordMove(updated,{text:'8+3=11',indices:[1,2,3,4,5,6]}, {...points,total:35,crossing:5},2,pending);
 const result=sectorReport(1,63,2,another,true);
 assert.equal(result.best.equation,'8+3=11');
 assert.equal(result.equations,2);
 assert.equal(result.earned,23);
 const progress=freshProgress();
 const progressed=completeProgress(progress,result);
 assert.equal(progress.runPoints,0);
 assert.equal(progressed.runPoints,63);
 assert.equal(completeProgress(progressed,result).runPoints,63);
});
test('roundtrip save preserves pending tiles and programmed wildcards',()=>{
 const state=makeState(),store=storage();
 const wild=state.rack.find(isBlank);
 assert.ok(wild);
 const selected=(wild.blank==='blank-operator')?'+':'4';
 state.pending[pos(6,6)]={...wild,value:selected,points:0};
 state.placementOrder=[pos(6,6)];
 assert.equal(saveRun(store,state),true);
 const loaded=loadRun(store);
 assert.ok(loaded);
 assert.equal(loaded.version,SAVE_VERSION);
 assert.equal(loaded.pending[pos(6,6)].value,selected);
 assert.equal(loaded.rack.length,8);
 assert.equal(loaded.bag.length,143);
 assert.equal(loaded.progress.runPoints,0);
});
test('saved victory includes current sector in cumulative progress',()=>{
 const state=makeState(),store=storage();
 state.score=nextTarget(1)+3;
 state.phase='won';
 state.stats.moves=[{equation:'3+2=5',turn:1,points:state.score,length:5,tiles:4,wildcards:0,crossing:0,bonuses:[]}];
 const result=sectorReport(1,state.score,1,state.stats,true);
 state.progress=completeProgress(state.progress,result);
 assert.equal(saveRun(store,state),true);
 assert.equal(loadRun(store).phase,'won');
 assert.equal(loadRun(store).progress.completed[0].sector,1);
 state.sector=2;state.score=0;state.phase='playing';state.stats=freshStats();
 assert.equal(saveRun(store,state),true);
 assert.equal(loadRun(store).progress.runPoints,nextTarget(1)+3);
});
test('a terminal failed sector can be resumed for retry',()=>{
 const state=makeState(),store=storage();
 state.phase='lost';state.turn=6;state.score=5;
 assert.equal(saveRun(store,state),true);
 assert.equal(loadRun(store).phase,'lost');
});
test('invalid/corrupt saves fail closed without crashing or persisting duplicates',()=>{
 const state=makeState(),store=storage();
 assert.equal(saveRun(store,state),true);
 const good=snapshotRun(state);
 for(const mutated of [
  {...good,version:999},{...good,board:[]},
  {...good,bag:[...good.bag,good.rack[0]]},
  {...good,phase:'won',score:0},
  {...good,phase:'lost',turn:2},
  {...good,progress:{...good.progress,runPoints:10}},
  {...good,board:[...good.board.slice(0,12),{...good.rack[0],value:'<script>'},...good.board.slice(13)]}
 ]){
   store.setItem(SAVE_KEY,JSON.stringify(mutated));
   assert.equal(loadRun(store),null);
 }
 store.setItem(SAVE_KEY,'not-json');
 assert.equal(loadRun(store),null);
 store.setItem(SAVE_KEY,'x'.repeat(260000));
 assert.equal(loadRun(store),null);
 assert.equal(clearRun(store),true);
 assert.equal(loadRun(store),null);
});
test('unavailable private storage never prevents play',()=>{
 const bad={getItem(){throw Error('disabled');},setItem(){throw Error('quota');},removeItem(){throw Error('no');}};
 const state=makeState();
 assert.equal(saveRun(bad,state),false);
 assert.equal(loadRun(bad),null);
 assert.equal(clearRun(bad),false);
 assert.equal(saveRun(null,state),false);
});
