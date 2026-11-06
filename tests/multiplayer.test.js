import test from 'node:test';
import assert from 'node:assert/strict';
import {SIZE,CENTER,pos,makeTile,tilePool} from '../src/engine.js';
import {LOCAL_SAVE_KEY,makeLocalMatch,readyLocalTurn,scoreLocalTurn,
 passLocalTurn,exchangeLocalTiles,localStandings,saveLocalMatch,loadLocalMatch,
 validLocalMatch,isLocalTimerExpired} from '../src/multiplayer.js';

const rng=()=>0.37;
const store=()=>{
 const map=new Map();return {getItem:k=>map.get(k)??null,
 setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
};
function opening(match){
 // Swap physical tiles with the bag rather than duplicating any tile.
 const wanted=['8','+','4','1','2'];
 const rack=[...match.players[0].rack],bag=[...match.bag];
 const reserved=new Set();
 for(const value of wanted){
   const exists=rack.findIndex((tile,i)=>!reserved.has(i)&&tile.value===value&&!tile.blank);
   if(exists>=0){reserved.add(exists);continue;}
   const fromBag=bag.findIndex(tile=>tile.value===value&&!tile.blank);
   assert.ok(fromBag>=0,'bag contains '+value);
   const replacement=bag.splice(fromBag,1)[0];
   const swap=rack.findIndex((tile,i)=>!reserved.has(i)&&!wanted.includes(tile.value));
   const swapIndex=swap>=0?swap:rack.findIndex((_,i)=>!reserved.has(i));
   assert.ok(swapIndex>=0,'unreserved rack slot available');
   bag.push(rack[swapIndex]);rack[swapIndex]=replacement;
   reserved.add(swapIndex);
 }
 const players=match.players.map((p,i)=>i===0?{...p,rack}:p);
 const pending={};
 for(const [i,symbol] of ['8','+','4','=','1','2'].entries()){
   pending[pos(CENTER,6+i)]=symbol==='='?makeTile('='):
     rack.find(t=>t.value===symbol&&!t.blank);
 }
 const next={...match,bag,players,pending,placementOrder:Object.keys(pending).map(Number)};
 assert.equal(validLocalMatch(next),true);
 return next;
}
test('2–4 player set-up uses a single finite bag and independent private racks',()=>{
 for(let n=2;n<=4;n++){
   const match=makeLocalMatch({names:Array.from({length:n},(_,i)=>'Pilot '+(i+1))},rng);
   assert.equal(match.players.length,n);
   assert.equal(match.phase,'handover');
   assert.equal(match.bag.length,151-8*n);
   assert.ok(match.players.every(p=>p.rack.length===8));
   assert.ok(match.players.every(p=>p.rack.filter(t=>tilePool(t)==='numbers').length===5));
   assert.ok(match.players.every(p=>p.rack.filter(t=>tilePool(t)==='operators').length===3));
   assert.equal(validLocalMatch(match),true);
   assert.equal(new Set([...match.bag,...match.players.flatMap(p=>p.rack)].map(t=>t.id)).size,151);
 }
 assert.throws(()=>makeLocalMatch({names:['Only one']}),/2–4/);
 assert.throws(()=>makeLocalMatch({names:['A','A']}),/different/);
 assert.throws(()=>makeLocalMatch({names:['A','B'],turnSeconds:30}),/timer/);
});
test('a correct shared-board equation scores only the active player and hands over',()=>{
 let match=opening(makeLocalMatch({},rng));
 match=readyLocalTurn(match,1000);
 const {match:scored,move,points}=scoreLocalTurn(match);
 assert.equal(move.text,'8+4=12');
 assert.ok(points.total>0);
 assert.equal(scored.players[0].score,points.total);
 assert.equal(scored.players[1].score,0);
 assert.equal(scored.phase,'handover');
 assert.equal(scored.current,1);
 assert.equal(scored.turnNumber,2);
 assert.equal(scored.round,1);
 assert.equal(scored.board[pos(9,9)].value,'=');
 assert.equal(scored.history[0].type,'score');
 assert.equal(scored.players[0].rack.length,8);
 assert.equal(validLocalMatch(scored),true);
 match=readyLocalTurn(scored);
 assert.throws(()=>scoreLocalTurn(match,{[pos(10,3)]:scored.players[0].rack[0]}),/another player/i);
});
test('scoring rejects a tile copied from an opponent’s rack',()=>{
 let match=readyLocalTurn(makeLocalMatch({},rng));
 const t=match.players[1].rack[0];
 assert.throws(()=>scoreLocalTurn(match,{[pos(9,9)]:t}),/another player/i);
});
test('pass sequence goes around and ends after two full non-scoring rotations',()=>{
 let match=makeLocalMatch({names:['A','B','C']},rng);
 for(let i=0;i<6;i++){
   match=readyLocalTurn(match,1000);
   match=passLocalTurn(match);
   if(i<5)assert.equal(match.phase,'handover');
 }
 assert.equal(match.phase,'finished');
 assert.equal(match.finishedReason,'stalled');
 assert.equal(match.current,2);
 assert.equal(match.history.length,6);
 assert.equal(match.round,2);
 assert.equal(match.finalScores.length,3);
 assert.equal(validLocalMatch(match),true);
 assert.throws(()=>readyLocalTurn(match),/handover/i);
});
test('optional turn timer starts on Ready, not during the rack privacy screen',()=>{
 const match=makeLocalMatch({names:['A','B'],turnSeconds:60},rng);
 assert.equal(match.deadline,0);
 const ready=readyLocalTurn(match,1000);
 assert.equal(ready.deadline,61000);
 assert.equal(isLocalTimerExpired(ready,60999),false);
 assert.equal(isLocalTimerExpired(ready,61000),true);
 const passed=passLocalTurn(ready,'timeout');
 assert.equal(passed.phase,'handover');
 assert.equal(passed.deadline,0);
 assert.equal(passed.history[0].type,'timeout');
});
test('one tile is free each turn; a repeat or multi-tile swap costs a turn',()=>{
 let match=makeLocalMatch({names:['A','B']},rng);

 assert.equal(validLocalMatch(match),true);
 match=readyLocalTurn(match);
 const before=match.players[0].rack.map(t=>t.id);
 const first=exchangeLocalTiles(match,[before[0]],rng);
 assert.equal(first.free,true);
 assert.equal(first.match.current,0);
 assert.equal(first.match.freeExchangeUsed,true);
 assert.equal(first.match.bag.length,match.bag.length);
 assert.equal(validLocalMatch(first.match),true);
 const second=exchangeLocalTiles(first.match,[first.match.players[0].rack[0].id],rng);
 assert.equal(second.free,false);
 assert.equal(second.match.current,1);
 assert.equal(second.match.turnNumber,2);
 assert.equal(validLocalMatch(second.match),true);
});
test('exchanging two physical tiles first is paid and immediately advances the turn',()=>{
 const match=readyLocalTurn(makeLocalMatch({names:['A','B']},rng));
 const ids=match.players[0].rack.slice(0,2).map(t=>t.id);
 const result=exchangeLocalTiles(match,ids,rng);
 assert.equal(result.free,false,'two or more exchanged tiles can never be free');
 assert.equal(result.match.current,1);
 assert.equal(result.match.turnNumber,2);
 assert.equal(result.match.history.at(-1).tiles,2);
 assert.equal(result.match.history.at(-1).type,'exchange');
 assert.equal(validLocalMatch(result.match),true);
});
test('a free single-tile swap preserves its supply pool and cannot repeat',()=>{
 let match=readyLocalTurn(makeLocalMatch({names:['A','B']},rng));
 const original=match.players[0].rack.find(t=>tilePool(t)==='operators');
 const result=exchangeLocalTiles(match,[original.id],rng);
 assert.equal(result.free,true);
 assert.equal(result.match.turnNumber,1);
 assert.equal(result.match.freeExchangeUsed,true);
 assert.equal(result.match.players[0].rack.filter(t=>tilePool(t)==='numbers').length,5);
 assert.equal(result.match.players[0].rack.filter(t=>tilePool(t)==='operators').length,3);
 assert.equal(validLocalMatch(result.match),true);
 const second=exchangeLocalTiles(result.match,[result.match.players[0].rack[0].id],rng);
 assert.equal(second.free,false);
 assert.equal(second.match.turnNumber,2);
 assert.equal(second.match.freeExchangeUsed,false);
 assert.equal(validLocalMatch(second.match),true);
 const next=readyLocalTurn(second.match);
 const other=next.players[1].rack.find(t=>tilePool(t)==='numbers');
 assert.equal(exchangeLocalTiles(next,[other.id],rng).free,true);
});
test('finished standings deduct each leftover tile value and allow tied winners',()=>{
 let match=makeLocalMatch({names:['A','B']},rng);
 match.players[0].score=24;
 match.players[1].score=21;
 const scores=localStandings(match);
 for(const row of scores){
   const p=match.players[row.index];
   assert.equal(row.penalty,p.rack.reduce((total,t)=>total+t.points,0));
   assert.equal(row.net,p.score-row.penalty);
 }
 const sameNet=match.players[0].score-match.players[0].rack.reduce((n,t)=>n+t.points,0);
 match.players[1].score=sameNet+match.players[1].rack.reduce((n,t)=>n+t.points,0);
 const tied=localStandings(match);
 assert.ok(tied.every(row=>row.winner&&row.rank===1));
});
test('local saves restore hidden handover after reloading mid-turn without losing pending tiles',()=>{
 const storage=store();let match=opening(makeLocalMatch({names:['A','B']},rng));
 match=readyLocalTurn(match,1000);
 assert.equal(saveLocalMatch(storage,match),true);
 const restored=loadLocalMatch(storage);
 assert.equal(restored.phase,'handover');
 assert.equal(restored.current,0);
 assert.equal(restored.deadline,0);
 assert.equal(Object.keys(restored.pending).length,6);
 assert.deepEqual(restored.players.map(x=>x.rack.map(t=>t.id)),
   match.players.map(x=>x.rack.map(t=>t.id)));
 assert.equal(readyLocalTurn(restored).phase,'playing');
});
test('corrupt and cross-mode state cannot be loaded as a local match',()=>{
 const storage=store();const match=makeLocalMatch({},rng);
 assert.equal(saveLocalMatch(storage,match),true);
 const raw=JSON.parse(storage.getItem(LOCAL_SAVE_KEY));
 for(const changed of [
  {...raw,version:999},
  {...raw,players:[...raw.players,{...raw.players[0]}]},
  {...raw,bag:[...raw.bag,raw.players[0].rack[0]]},
  {...raw,current:99},
  {...raw,phase:'finished',finishedReason:'stalled'},
  {...raw,pending:{[pos(9,9)]:{...raw.players[1].rack[0]}}}
 ]){
   storage.setItem(LOCAL_SAVE_KEY,JSON.stringify(changed));
   assert.equal(loadLocalMatch(storage),null);
 }
 storage.setItem(LOCAL_SAVE_KEY,'{damaged');
 assert.equal(loadLocalMatch(storage),null);
});
