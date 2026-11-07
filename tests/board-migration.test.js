import test from 'node:test';
import assert from 'node:assert/strict';
import {SIZE,CENTER,pos,makeTile} from '../src/engine.js';
import {LEGACY_BOARD_SIZE,migrateBoardState,migrateOnlineRoom} from '../src/board-migration.js';
import {LOCAL_SAVE_KEY,makeLocalMatch,validLocalMatch,loadLocalMatch} from '../src/multiplayer.js';

test('original 13×13 squares, reactor centre and pending placement migrate to 19×19 without loss',()=>{
 const old=Array(LEGACY_BOARD_SIZE**2).fill(null);
 const corner=makeTile('7'),reactor=makeTile('='),edge=makeTile('8'),pendingTile=makeTile('2');
 old[0]=corner;old[6*13+6]=reactor;old[12*13+12]=edge;
 const source={board:old,pending:{[6*13+4]:pendingTile},placementOrder:[6*13+4],score:42,turn:3};
 const migrated=migrateBoardState(source);
 assert.equal(migrated.board.length,SIZE**2);
 assert.equal(migrated.board[pos(3,3)],corner);
 assert.equal(migrated.board[pos(CENTER,CENTER)],reactor);
 assert.equal(migrated.board[pos(15,15)],edge);
 assert.equal(migrated.pending[pos(CENTER,CENTER-2)],pendingTile);
 assert.deepEqual(migrated.placementOrder,[pos(CENTER,CENTER-2)]);
 assert.equal(migrated.score,42);assert.equal(migrated.turn,3);
 assert.equal(migrated.board.filter(Boolean).length,3);
 assert.equal(migrated.board.filter(t=>t===null).length,SIZE**2-3);
 assert.equal(migrateBoardState(migrated),migrated,'migration is idempotent');
});
test('13×13 local saves restore intact player racks, kit and scores after migration',()=>{
 const current=makeLocalMatch({names:['Ari','Bea'],tileSet:'rational'},()=>.37);
 const saved={...current,board:Array(169).fill(null)};
 const map=new Map([[LOCAL_SAVE_KEY,JSON.stringify(saved)]]);
 const storage={getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value)};
 assert.equal(validLocalMatch(saved),false,'old dimensions are rejected until migrated');
 const loaded=loadLocalMatch(storage,{privateOnResume:false});
 assert.ok(loaded,'legacy local match should still restore');
 assert.ok(validLocalMatch(loaded));
 assert.equal(loaded.board.length,361);
 assert.equal(loaded.tileSet,'rational');
 assert.deepEqual(loaded.players.map(p=>p.rack.map(t=>t.id)),
   current.players.map(p=>p.rack.map(t=>t.id)));
 assert.equal(loaded.bag.length,current.bag.length);
 assert.equal(loaded.current,current.current);
});
test('online 13×13 rooms migrate without modifying private player identities',()=>{
 const match=makeLocalMatch({names:['Ari','Bea'],tileSet:'advanced'},()=>.37);
 const original={phase:'playing',revision:12,match:{...match,board:Array(169).fill(null)}};
 const converted=migrateOnlineRoom(original);
 assert.notEqual(converted,original);
 assert.equal(converted.revision,12);
 assert.equal(converted.match.board.length,361);
 assert.deepEqual(converted.match.players,original.match.players);
 assert.equal(migrateOnlineRoom(converted),converted);
 assert.equal(migrateOnlineRoom({phase:'lobby',match:null}).match,null);
});
