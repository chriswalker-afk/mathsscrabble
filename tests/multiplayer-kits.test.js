import test from 'node:test';
import assert from 'node:assert/strict';
import {SIZE,CENTER,pos,makeTile,tilePool} from '../src/engine.js';
import {TILE_SETS,kitRackSize,kitNumberSlots,hasBracketPair} from '../src/tile-sets.js';
import {makeLocalMatch,readyLocalTurn,scoreLocalTurn,exchangeLocalTiles,
  validLocalMatch,saveLocalMatch,loadLocalMatch} from '../src/multiplayer.js';
import {makeOnlineLobby,joinOnlineLobby,startOnlineMatch,takeOnlineAction,
  viewOnlineRoom,verifyOnlineRoom} from '../src/online-rules.js';

const rng=()=>.37;
const hashA='a'.repeat(64),hashB='b'.repeat(64);
const allPhysical=m=>[...m.bag,...m.players.flatMap(p=>p.rack),...m.board.filter(t=>t&&t.value!=='=')];
function prepared(match,wanted){
  const rack=[...match.players[0].rack],bag=[...match.bag],reserved=new Set();
  for(const value of wanted){
    let slot=rack.findIndex((tile,i)=>!reserved.has(i)&&tile.value===value&&!tile.blank);
    if(slot<0){
      slot=rack.findIndex((tile,i)=>!reserved.has(i)&&!tile.pairId&&tilePool(tile)===tilePool({value}));
      const from=bag.findIndex(tile=>tile.value===value&&!tile.blank);
      assert.ok(slot>=0&&from>=0,'Missing '+value+' in compatible physical supply');
      [rack[slot],bag[from]]=[bag[from],rack[slot]];
    }
    reserved.add(slot);
  }
  return {...match,bag,players:match.players.map((p,i)=>i===0?{...p,rack}:p)};
}
function placements(match,values,startColumn=3){
  const pending={},used=new Set(),rack=match.players[0].rack;
  for(const [i,value] of values.entries()){
    const tile=value==='='?makeTile('='):
      rack.find(t=>t.value===value&&!used.has(t.id));
    assert.ok(tile,'Could not place '+value);
    if(value!=='=')used.add(tile.id);
    pending[pos(CENTER,startColumn+i)]=tile;
  }
  return pending;
}
test('2–4 pilots use exactly the selected physical kit with a finite shared supply',()=>{
  for(const kit of TILE_SETS)for(const count of [2,3,4]){
    const names=Array.from({length:count},(_,i)=>'Pilot '+(i+1));
    const match=makeLocalMatch({names,tileSet:kit.id},rng);
    assert.equal(match.tileSet,kit.id);
    assert.equal(match.board.length,SIZE*SIZE);
    assert.equal(match.bag.length,151-count*kitRackSize(kit.id));
    assert.equal(allPhysical(match).length,151);
    assert.equal(new Set(allPhysical(match).map(t=>t.id)).size,151);
    for(const player of match.players){
      assert.equal(player.rack.length,kitRackSize(kit.id));
      assert.equal(player.rack.filter(t=>tilePool(t)==='numbers').length,kitNumberSlots(kit.id));
      assert.equal(player.rack.filter(t=>tilePool(t)==='operators').length,3);
      const brackets=player.rack.filter(t=>tilePool(t)==='brackets');
      assert.equal(brackets.length,hasBracketPair(kit.id)?2:0);
      if(brackets.length){
        assert.equal(brackets[0].pairId,brackets[1].pairId);
        assert.deepEqual(brackets.map(t=>t.value).sort(),['(',')']);
      }
    }
    if(kit.id==='rational')assert.ok(allPhysical(match).every(t=>
      !(t.value?.includes('/')&&t.value.startsWith('−'))),'Nebula must have no negative fraction tiles');
    assert.ok(validLocalMatch(match),kit.id+' should validate with '+count+' pilots');
    const map=new Map(),storage={setItem:(k,v)=>map.set(k,v),getItem:k=>map.get(k)};
    assert.equal(saveLocalMatch(storage,match),true);
    assert.equal(loadLocalMatch(storage,{privateOnResume:false}).tileSet,kit.id);
  }
  assert.throws(()=>makeLocalMatch({tileSet:'unknown'}),/supported/i);
});
test('a real Nebula equation scores with both physical brackets and a six-number rack',()=>{
  let match=readyLocalTurn(makeLocalMatch({tileSet:'rational'},rng),1000);
  const values=['(','1/2','+','1/2',')','×','2','=','2'];
  match=prepared(match,['1/2','1/2','+','×','2','2']);
  assert.ok(validLocalMatch(match));
  const pending=placements(match,values,2);
  const broken={...pending};delete broken[pos(CENTER,6)];
  assert.throws(()=>scoreLocalTurn(match,broken),/bracket|gap/i);
  const before=match.players[0].score;
  const scored=scoreLocalTurn(match,pending);
  assert.equal(scored.move.text,'(1/2+1/2)×2=2');
  assert.ok(scored.points.total>0);
  assert.equal(scored.match.players[0].score,before+scored.points.total);
  assert.ok(validLocalMatch(scored.match));
  assert.equal(allPhysical(scored.match).length,151);
});
test('linked bracket halves cannot be swapped individually, but an intact pair can be replaced',()=>{
  const match=readyLocalTurn(makeLocalMatch({tileSet:'advanced'},rng),1000);
  const pair=match.players[0].rack.filter(t=>t.pairId),ids=pair.map(t=>t.id);
  assert.equal(pair.length,2);
  assert.throws(()=>exchangeLocalTiles(match,[ids[0]],rng),/both halves/i);
  assert.equal(match.freeExchangeUsed,false,'invalid pair selection should not consume the free exchange');
  const exchanged=exchangeLocalTiles(match,ids,rng);
  assert.equal(exchanged.free,false,'a two-piece bracket pair uses the turn');
  const replacement=exchanged.match.players[0].rack.filter(t=>t.pairId);
  assert.equal(replacement.length,2);
  assert.equal(replacement[0].pairId,replacement[1].pairId);
  assert.notEqual(replacement[0].pairId,pair[0].pairId);
  assert.ok(validLocalMatch(exchanged.match));
  assert.equal(new Set(allPhysical(exchanged.match).map(t=>t.id)).size,151);
});
test('online host kit is authoritative, immutable after creation, and hidden hands remain private',()=>{
  assert.throws(()=>makeOnlineLobby({code:'ABCDEF',hostName:'Host',hostHash:hashA,tileSet:'bogus',now:1000}),/supported/i);
  for(const kit of TILE_SETS){
    let lobby=makeOnlineLobby({code:'ABCDEF',hostName:'Host',hostHash:hashA,
      tileSet:kit.id,turnSeconds:90,now:1000});
    lobby=joinOnlineLobby(lobby,'Guest',hashB,1100);
    assert.equal(viewOnlineRoom(lobby,hashB,1200).tileSet,kit.id);
    const started=startOnlineMatch(lobby,hashA,
      {id:'start-online-kit-1234',revision:lobby.revision},1300,rng).room;
    assert.equal(started.tileSet,kit.id);
    assert.equal(started.match.tileSet,kit.id);
    assert.ok(verifyOnlineRoom(started));
    const host=viewOnlineRoom(started,hashA,1350),guest=viewOnlineRoom(started,hashB,1350);
    assert.equal(host.match.rack.length,kitRackSize(kit.id));
    assert.equal(guest.match.rack.length,kitRackSize(kit.id));
    assert.ok(host.match.players.every(p=>p.rack===undefined));
    assert.ok(guest.match.players.every(p=>p.rack===undefined));
    assert.ok(host.match.rack.every(t=>!guest.match.rack.some(g=>g.id===t.id)));
    assert.equal(host.match.bagCount,151-2*kitRackSize(kit.id));
    // Even a user with their own rack ID cannot change its mathematical face.
    const tile=started.match.players[0].rack.find(t=>!t.blank);
    assert.ok(tile);
    assert.throws(()=>takeOnlineAction(started,hashA,
      {id:'spoof-maths-tile-1234',revision:started.revision,type:'score',
       placements:[{index:pos(6,5),tileId:tile.id,value:'999'},
                   {index:pos(6,6),tileId:'=',value:'='},
                   {index:pos(6,7),tileId:tile.id,value:tile.value}]},1400,rng),
      /cannot be changed|only once/i);
    assert.equal(started.match.players[0].score,0);
    assert.equal(started.revision,lobby.revision+1);
  }
});
test('Cloudflare rules accept exact positive rational mathematics and score the correct seat',()=>{
  let room=makeOnlineLobby({code:'ABCDEF',hostName:'Ari',hostHash:hashA,tileSet:'rational',now:1000});
  room=joinOnlineLobby(room,'Bea',hashB,1100);
  room=startOnlineMatch(room,hashA,{id:'start-rational-12345',revision:room.revision},1200,rng).room;
  room={...room,match:prepared(room.match,['1/2','+','1/2','1'])};
  assert.ok(validLocalMatch(room.match));
  const pending=placements(room.match,['1/2','+','1/2','=','1'],4);
  const packet=Object.entries(pending).map(([index,t])=>({
    index:Number(index),tileId:t.value==='='?'=':t.id,value:t.value
  }));
  const result=takeOnlineAction(room,hashA,{
    id:'score-rational-12345',revision:room.revision,type:'score',placements:packet
  },1400,rng);
  assert.equal(result.result.type,'scored');
  assert.ok(result.result.points.total>0);
  assert.equal(result.room.match.current,1);
  assert.equal(result.room.match.players[1].score,0);
  assert.equal(result.room.match.players[0].score,result.result.points.total);
  assert.ok(validLocalMatch(result.room.match));
  assert.equal(viewOnlineRoom(result.room,hashB,1500).match.rack.length,11);
});
