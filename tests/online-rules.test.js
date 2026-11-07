import test from 'node:test';
import assert from 'node:assert/strict';
import {SIZE,pos,makeTile} from '../src/engine.js';
import {
 OnlineError,roomCode,cleanRoomCode,cleanPilotName,makeOnlineLobby,
 joinOnlineLobby,leaveOnlineLobby,startOnlineMatch,takeOnlineAction,
 timeOutOnlineTurn,viewOnlineRoom,roomWakeAt,verifyOnlineRoom
} from '../src/online-rules.js';
const H='a'.repeat(64),A='b'.repeat(64),B='c'.repeat(64),C='d'.repeat(64);
const lobby=(timer=90,maxPlayers=4)=>makeOnlineLobby({
 code:'GHJKLM',hostName:'Ari',hostHash:H,maxPlayers,turnSeconds:timer,now:1000
});
const request=(revision,type,id='request-abcdefgh123456',extra={})=>({
 id,revision,type,...extra
});
const started=({timer=0,n=2,rng=()=>0.37}={})=>{
 let room=lobby(timer,n);
 room=joinOnlineLobby(room,'Bea',A,1100);
 if(n>=3)room=joinOnlineLobby(room,'Cy',B,1150);
 if(n>=4)room=joinOnlineLobby(room,'Dee',C,1200);
 return startOnlineMatch(room,H,request(room.revision,'start'),2000,rng).room;
};
const makeGoodOpening=room=>{
 const bag=[...room.match.bag],rack=[...room.match.players[0].rack],wanted=['8','+','4','1','2'];
 const reserved=new Set();
 for(const symbol of wanted){
   const existing=rack.findIndex((tile,i)=>!reserved.has(i)&&tile.value===symbol&&!tile.blank);
   if(existing>=0){reserved.add(existing);continue;}
   const bagIndex=bag.findIndex(tile=>tile.value===symbol&&!tile.blank);
   assert.ok(bagIndex>=0);
   const physical=bag.splice(bagIndex,1)[0];
   const unused=rack.findIndex((tile,i)=>!reserved.has(i)&&!wanted.includes(tile.value));
   const target=unused>=0?unused:rack.findIndex((tile,i)=>!reserved.has(i));
   assert.ok(target>=0);
   bag.push(rack[target]);rack[target]=physical;reserved.add(target);
 }
 const match={...room.match,bag,players:room.match.players.map((p,i)=>
   i===0?{...p,rack}:p)};
 return {...room,match};
};
const placements=(room,symbols=['8','+','4','=','1','2'])=>{
 const rack=room.match.players[room.match.current].rack;
 return symbols.map((symbol,offset)=>{
   const index=pos(9,6+offset);
   if(symbol==='=')return {index,tileId:'=',value:'='};
   const tile=rack.find(t=>t.value===symbol&&!t.blank);
   assert.ok(tile,'Fixture missing '+symbol);
   return {index,tileId:tile.id,value:symbol};
 });
};
const allPhysical=room=>[
 ...room.match.board.filter(t=>t&&t.value!=='='),
 ...room.match.bag,...room.match.players.flatMap(p=>p.rack)
];
test('server-authoritative overall game clock stops actions and chooses final standings',()=>{
 let room=makeOnlineLobby({code:'GHJKLM',hostName:'Ari',hostHash:H,maxPlayers:2,
  turnSeconds:60,gameSeconds:300,now:1000});
 room=joinOnlineLobby(room,'Bea',A,1100);
 assert.equal(room.gameSeconds,300);
 room=startOnlineMatch(room,H,request(room.revision,'start'),2000).room;
 assert.equal(room.match.gameDeadline,302000);
 assert.equal(roomWakeAt(room),62000,'the earlier turn alarm wakes first');
 let tick=timeOutOnlineTurn(room,62000);
 assert.equal(tick.changed,true);
 room=tick.room;
 assert.equal(room.match.gameDeadline,302000,'turn timeout does not reset game timer');
 assert.equal(room.phase,'playing');
 tick=timeOutOnlineTurn(room,302000);
 assert.equal(tick.changed,true);
 room=tick.room;
 assert.equal(room.phase,'finished');
 assert.equal(room.match.finishedReason,'time-limit');
 assert.equal(room.match.deadline,0);
 assert.equal(room.match.finalScores.length,2);
 assert.equal(roomWakeAt(room),room.expiresAt);
 assert.equal(verifyOnlineRoom(room),true);
 assert.equal(viewOnlineRoom(room,H,302001).match.reason,'time-limit');
 assert.equal(viewOnlineRoom(room,A,302001).gameSeconds,300);
 assert.throws(()=>takeOnlineAction(room,H,request(room.revision,'pass','after-game-clock-123'),302001),/not accepting/i);
 assert.equal(timeOutOnlineTurn(room,302002).changed,false);
});
test('game timer works without a turn timer and rejects unsupported durations',()=>{
 assert.throws(()=>makeOnlineLobby({code:'GHJKLM',hostName:'Ari',hostHash:H,
  gameSeconds:45,now:1000}),/timer/i);
 let room=makeOnlineLobby({code:'GHJKLM',hostName:'Ari',hostHash:H,maxPlayers:2,
  gameSeconds:300,turnSeconds:0,now:1000});
 room=joinOnlineLobby(room,'Bea',A,1100);
 room=startOnlineMatch(room,H,request(room.revision,'start'),2000).room;
 assert.equal(room.match.deadline,0);
 assert.equal(roomWakeAt(room),302000);
 assert.equal(timeOutOnlineTurn(room,301999).changed,false);
 assert.equal(timeOutOnlineTurn(room,302000).room.phase,'finished');
});
test('room codes are six ambiguous-character-free symbols',()=>{
 const code=roomCode(new Uint8Array([0,1,2,3,4,5]));
 assert.equal(code,'ABCDEF');
 assert.equal(cleanRoomCode('ghjklm'),'GHJKLM');
 assert.equal(cleanRoomCode('OO0000'),null);
 assert.equal(cleanRoomCode('ABC'),null);
 assert.throws(()=>roomCode([]),/bytes/i);
 assert.equal(cleanPilotName('  Ari   Algebra '),'Ari Algebra');
 assert.throws(()=>cleanPilotName('<>'),/name/i);
});
test('lobby only admits 2–4 unique pilots and host controls launch',()=>{
 let room=lobby(60,3);
 assert.equal(verifyOnlineRoom(room),true);
 assert.equal(room.phase,'lobby');
 assert.equal(viewOnlineRoom(room,H,1002).you.host,true);
 assert.deepEqual(viewOnlineRoom(room,H,1002).people.map(p=>p.name),['Ari']);
 assert.throws(()=>startOnlineMatch(room,H,request(room.revision,'start'),1200),/two pilots/i);
 room=joinOnlineLobby(room,'Bea',A,1100);
 assert.throws(()=>joinOnlineLobby(room,'ari',B,1200),/already taken/i);
 assert.throws(()=>startOnlineMatch(room,A,request(room.revision,'start'),1200),/host/i);
 room=joinOnlineLobby(room,'Cy',B,1200);
 assert.throws(()=>joinOnlineLobby(room,'Dee',C,1250),/full/i);
 const built=startOnlineMatch(room,H,request(room.revision,'start'),2000);
 assert.equal(built.room.phase,'playing');
 assert.equal(built.room.match.players.length,3);
 assert.equal(built.room.match.deadline,62000);
 assert.equal(built.room.match.current,0);
 assert.equal(verifyOnlineRoom(built.room),true);
 assert.equal(allPhysical(built.room).length,151);
 assert.equal(new Set(allPhysical(built.room).map(t=>t.id)).size,151);
 assert.equal(roomWakeAt(built.room),62000);
});
test('snapshots reveal only own rack, opponent names/counts, aggregate bag inventory',()=>{
 const room=started({n:4});
 for(const hash of [H,A,B,C]){
   const snap=viewOnlineRoom(room,hash,2100);
   assert.equal(snap.match.players.length,4);
   assert.equal(snap.match.rack.length,8);
   assert.equal(snap.match.board.length,SIZE*SIZE);
   assert.equal(snap.match.bagCount,119);
   assert.equal(snap.match.bagInventory.groups.reduce((n,g)=>n+g.total,0),119);
   assert.equal(JSON.stringify(snap).includes('tokenHash'),false);
   assert.equal(JSON.stringify(snap).includes(H),false);
   assert.equal(JSON.stringify(snap).includes(A),false);
   assert.equal(JSON.stringify(snap).includes(B),false);
   assert.equal(JSON.stringify(snap).includes(C),false);
   for(let i=0;i<room.people.length;i++){
     if(i===snap.you.index)continue;
     for(const tile of room.match.players[i].rack){
       assert.equal(snap.match.rack.some(t=>t.id===tile.id),false,
         'opponent tile cannot appear in own rack');
     }
   }
 }
 assert.throws(()=>viewOnlineRoom(room,'f'.repeat(64),2200),/access key/i);
});
test('server validates real BIDMAS, scores exactly once and moves turn',()=>{
 const room=makeGoodOpening(started());
 const before=room.match.players[0].score;
 const data=placements(room);
 const original=JSON.stringify(room);
 const ok=takeOnlineAction(room,H,request(room.revision,'score','score-correct12345',{placements:data}),3000);
 assert.equal(ok.result.type,'scored');
 assert.equal(ok.result.move.text,'8+4=12');
 assert.equal(ok.room.match.players[0].score,before+ok.result.points.total);
 assert.equal(ok.room.match.players[1].score,0);
 assert.equal(ok.room.match.current,1);
 assert.equal(ok.room.match.phase,'playing');
 assert.equal(ok.room.revision,room.revision+1);
 assert.equal(ok.room.match.board[pos(9,9)].value,'=');
 assert.equal(allPhysical(ok.room).length,151);
 assert.equal(JSON.stringify(room),original,'pure move transition must not mutate original');
 const again=takeOnlineAction(ok.room,H,
   request(room.revision,'score','score-correct12345',{placements:data}),3001);
 assert.equal(again.replayed,true);
 assert.equal(again.room.revision,ok.room.revision);
 assert.equal(again.room.match.players[0].score,ok.room.match.players[0].score);
 assert.throws(()=>takeOnlineAction(ok.room,H,
   request(ok.room.revision,'pass','wrong-player1234'),3005),/not your turn/i);
});
test('false equations, forged values, duplicates, wrong owner and stale revisions are rejected without consuming a turn',()=>{
 const room=makeGoodOpening(started());
 const good=placements(room);
 const bad=good.map(x=>({...x}));
 bad[bad.length-1]={...bad.at(-1),value:'3'};
 assert.throws(()=>takeOnlineAction(room,H,
   request(room.revision,'score','score-invalid12345',{placements:bad}),3000),
   /tile value cannot be changed/i);
 // Reuse the same five owned physical tiles in a mathematically false
 // but syntactically valid equation: 8 + 1 = 42.
 const fake=good.map(x=>({...x}));
 fake[2]={index:good[2].index,tileId:good[4].tileId,value:'1'};
 fake[4]={index:good[4].index,tileId:good[2].tileId,value:'4'};
 assert.throws(()=>takeOnlineAction(room,H,
   request(room.revision,'score','score-notbalanced12',{placements:fake}),3000),
   /not balanced|calculation|equation/i);
 const duplicated=good.map(x=>({...x}));
 duplicated[2].tileId=duplicated[0].tileId;
 duplicated[2].value='8';
 assert.throws(()=>takeOnlineAction(room,H,
   request(room.revision,'score','score-duplicate123',{placements:duplicated}),3000),
   /only once/i);
 const opponent=room.match.players[1].rack[0];
 const stolen=good.map(x=>({...x}));
 stolen[0]={...stolen[0],tileId:opponent.id,value:opponent.value};
 assert.throws(()=>takeOnlineAction(room,H,
   request(room.revision,'score','score-stolen12345',{placements:stolen}),3000),
   /outside your own rack/i);
 assert.throws(()=>takeOnlineAction(room,H,
   request(room.revision-1,'pass','stale-action12345'),3000),/updated/i);
 assert.equal(room.match.players[0].score,0);
 assert.equal(room.match.current,0);
});
test('one free single-tile exchange does not advance a turn, but repeating does',()=>{
 let room=started();
 const rack=room.match.players[0].rack;
 const bag=[...room.match.bag],converted=[];
 for(const tile of rack){
   if(/^[0-9]$/.test(tile.value)){converted.push(tile);continue;}
   const found=bag.findIndex(t=>/^[0-9]$/.test(t.value));
   assert.ok(found>=0);const physical=bag.splice(found,1)[0];
   converted.push(physical);bag.push(tile);
 }
 room={...room,match:{...room.match,bag,
   players:room.match.players.map((p,i)=>i===0?{...p,rack:converted}:p)}};
 const first=takeOnlineAction(room,H,request(room.revision,'exchange','exchange-free-123',{ids:[converted[0].id]}),3000);
 assert.equal(first.result.type,'free-exchange');
 assert.equal(first.room.match.current,0);
 assert.equal(first.room.match.freeExchangeUsed,true);
 assert.equal(allPhysical(first.room).length,151);
 const second=takeOnlineAction(first.room,H,
   request(first.room.revision,'exchange','exchange-paid-123',{ids:[first.room.match.players[0].rack[0].id]}),3200);
 assert.equal(second.result.type,'exchange');
 assert.equal(second.room.match.current,1);
 assert.equal(allPhysical(second.room).length,151);
});
test('online server rejects a two-tile exchange as a free action, charging the turn',()=>{
 const room=started();
 const ids=room.match.players[0].rack.slice(0,2).map(t=>t.id);
 const changed=takeOnlineAction(room,H,request(room.revision,'exchange','two-tiles-paid-123',{ids}),3000);
 assert.equal(changed.result.type,'exchange');
 assert.equal(changed.room.match.current,1);
 assert.equal(changed.room.match.turnNumber,2);
 assert.equal(allPhysical(changed.room).length,151);
});
test('authoritative alarm deadlines pass turns and eventually finish the match',()=>{
 let room=started({timer:60});
 assert.equal(room.match.deadline,62000);
 assert.equal(timeOutOnlineTurn(room,61999).changed,false);
 assert.throws(()=>takeOnlineAction(room,H,request(room.revision,'pass','too-late-123456'),62000),/expired/i);
 for(let i=0;i<4;i++){
   const now=62000+i*60000;
   const tick=timeOutOnlineTurn(room,now);
   assert.equal(tick.changed,true);
   room=tick.room;
 }
 assert.equal(room.phase,'finished');
 assert.equal(room.match.phase,'finished');
 assert.equal(room.match.finishedReason,'stalled');
 assert.equal(room.match.history.length,4);
 assert.ok(room.match.history.every(m=>m.type==='timeout'));
 assert.equal(room.match.finalScores.length,2);
 assert.ok(room.match.finalScores.every(s=>s.net===s.gross-s.penalty));
 assert.equal(roomWakeAt(room),room.expiresAt);
});
test('rooms expire, can be left in lobby and reject unknown keys',()=>{
 let room=lobby();
 assert.throws(()=>joinOnlineLobby(room,'late',A,room.expiresAt),/expired/i);
 room=joinOnlineLobby(room,'Bea',A,1100);
 assert.throws(()=>leaveOnlineLobby(room,B,request(room.revision,'leave'),1200),/access key/i);
 const changed=leaveOnlineLobby(room,A,request(room.revision,'leave','leave-bea-123456'),1200);
 assert.equal(changed.room.people.length,1);
 assert.equal(changed.room.people[0].name,'Ari');
 assert.equal(changed.room.revision,room.revision+1);
 const same=leaveOnlineLobby(changed.room,A,
   request(room.revision,'leave','leave-bea-123456'),1200);
 assert.equal(same.replayed,true);
 assert.throws(()=>startOnlineMatch(changed.room,H,
   request(changed.room.revision,'start','start-too-soon12'),1400),/two pilots/i);
});
test('names, player counts, timers, secrets and request ids are validated',()=>{
 assert.throws(()=>makeOnlineLobby({code:'ABCDEF',hostName:'A',hostHash:'not-a-hash'}),/credential/i);
 assert.throws(()=>makeOnlineLobby({code:'ABCDEF',hostName:'A',hostHash:H,maxPlayers:5}),/2–4/i);
 assert.throws(()=>makeOnlineLobby({code:'ABCDEF',hostName:'A',hostHash:H,turnSeconds:30}),/timer/i);
 assert.throws(()=>makeOnlineLobby({code:'000000',hostName:'A',hostHash:H}),/code/i);
 const room=started();
 assert.throws(()=>takeOnlineAction(room,H,{type:'pass',revision:room.revision,id:'x'},3000),
   /identifier/i);
 assert.throws(()=>takeOnlineAction(room,H,request(room.revision,'dance','dance-abcdefgh12'),3000),
   /unknown turn action/i);
 assert.throws(()=>viewOnlineRoom(room,'untrusted',3000),/credential/i);
});
