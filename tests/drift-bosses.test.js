import test from 'node:test';
import assert from 'node:assert/strict';
import {SIZE,CENTER,makeBag,makeTile,pos,validateMove} from '../src/engine.js';
import {makeRogueState,scoreRogueMove,anomalyForSector,targetForSector,rogueRackOptions} from '../src/rogue.js';
import {dealPlayableRack} from '../src/solo.js';
import {buildScoringCeremony} from '../src/score-ceremony.js';
import {
 BOSS_POOL,BOSS_BY_ID,zoneNumber,sectorInZone,isBossSector,zoneInfo,
 ensureZoneBoss,zoneBoss,bossForSector,bossField,restrictedDraws,
 selectForcedTile,validateBossMove,resolveBossScore
} from '../src/drift-bosses.js';
const withBoss=(id)=>({...makeRogueState(),zoneBosses:[id]});
const equation=(values=['8','+','4','=','1','2'],row=CENTER,col=CENTER-3)=>{
 const board=Array(SIZE*SIZE).fill(null),pending={};
 values.forEach((v,i)=>pending[pos(row,col+i)]=makeTile(v));
 return {board,pending,move:validateMove(board,pending)};
};
test('zone map divides every 3-sector chapter and reserves the third for a boss',()=>{
 assert.ok(BOSS_POOL.length>=10);
 assert.equal(new Set(BOSS_POOL.map(b=>b.id)).size,BOSS_POOL.length);
 for(let sector=1;sector<=99;sector++){
  assert.equal(zoneNumber(sector),Math.ceil(sector/3));
  assert.equal(sectorInZone(sector),(sector-1)%3+1);
  assert.equal(isBossSector(sector),sector%3===0);
  const info=zoneInfo(withBoss('grid-warden'),sector);
  assert.equal(info.end-info.start,2);
  if(sector%3===0)assert.ok(bossForSector(withBoss('grid-warden'),sector));
  else assert.equal(bossForSector(withBoss('grid-warden'),sector),null);
 }
});
test('boss is randomly assigned at zone entry, saved and cannot reroll on reload',()=>{
 let r=ensureZoneBoss(makeRogueState(),1,()=>0);
 assert.equal(r.zoneBosses.length,1);
 const first=r.zoneBosses[0];
 r=ensureZoneBoss(r,3,()=>.95);
 assert.equal(r.zoneBosses[0],first,'same-zone visits must not reroll');
 r=ensureZoneBoss(r,4,()=>0);
 assert.equal(r.zoneBosses.length,2);
 assert.notEqual(r.zoneBosses[0],r.zoneBosses[1],'consecutive zones cannot repeat');
 assert.ok(BOSS_BY_ID[r.zoneBosses[1]]);
 assert.equal(zoneBoss(r,4).zone,BOSS_BY_ID[r.zoneBosses[1]].zone);
 assert.equal(ensureZoneBoss(r,4,()=>.999).zoneBosses[1],r.zoneBosses[1]);
});
test('previous runs preserve the fixed boss in completed legacy zones',()=>{
 let r={...makeRogueState(),shopSector:3};delete r.zoneBosses;
 r=ensureZoneBoss(r,4,()=>0);
 assert.equal(r.zoneBosses[0],'power-leak');
 assert.notEqual(r.zoneBosses[1],r.zoneBosses[0]);
 assert.equal(anomalyForSector(3,makeRogueState()).id,'power-leak');
});
test('each boss has original zone name, unique effect and reversible final-sector rule',()=>{
 for(const boss of BOSS_POOL){
  assert.ok(boss.zone&&boss.description&&boss.name&&boss.short);
  const rogue=withBoss(boss.id);
  assert.equal(bossForSector(rogue,1),null);
  assert.equal(bossForSector(rogue,2),null);
  assert.equal(bossForSector(rogue,3).id,boss.id);
  assert.equal(bossForSector(rogue,4),null);
  assert.equal(anomalyForSector(3,rogue).id,boss.id);
 }
});
test('addition and subtraction embargoes remove only the sealed operator from eligible draws',()=>{
 for(const [bossId,symbol] of [['plus-embargo','+'],['minus-embargo','−']]){
  const rogue=withBoss(bossId);
  assert.deepEqual(restrictedDraws(rogue,2),[]);
  assert.deepEqual(restrictedDraws(rogue,3),[symbol]);
  const bag=makeBag(()=>0.123);
  const deal=dealPlayableRack([],bag,rogueRackOptions(rogue,3),()=>.5);
  assert.equal(deal.rack.some(t=>t.value===symbol),false);
  assert.ok(deal.bag.some(t=>t.value===symbol),'sealed tiles stay in the finite physical inventory');
  assert.equal(deal.rack.length,8);
  assert.equal(new Set([...deal.rack,...deal.bag].map(t=>t.id)).size,151);
  const normal=dealPlayableRack([],makeBag(()=>0.123),rogueRackOptions(rogue,2),()=>.5);
  assert.equal(normal.rack.length,8);
 }
});
test('grid warden has a consistent, accessible, center-safe blockade',()=>{
 const rogue=withBoss('grid-warden'),field=bossField(rogue,3);
 assert.equal(field.blocked.size,8);
 assert.equal(field.blocked.has(pos(9,9)),false);
 assert.equal(bossField(rogue,2).blocked.size,0);
 const {board,pending,move}=equation();
 assert.doesNotThrow(()=>validateBossMove(board,pending,move,rogue,3));
 pending[[...field.blocked][0]]=makeTile('3');
 assert.throws(()=>validateBossMove(board,pending,move,rogue,3),/blocked/i);
});
test('rift squares drain energy exactly once per newly placed physical tile',()=>{
 const {board,pending,move}=equation();
 const plain=scoreRogueMove(board,pending,move,withBoss('grid-warden'),3);
 const rogue=withBoss('curse-weaver');
 assert.ok(bossField(rogue,3).rifts.has(pos(9,6)));
 const cursed=scoreRogueMove(board,pending,move,rogue,3);
 assert.equal(cursed.total,plain.total-6);
 assert.equal(cursed.anomalyPenalty,6);
 assert.equal(buildScoringCeremony(cursed).reduce((s,x)=>s+x.amount,0),cursed.total);
});
test('the Seven Thief removes upgraded seven-tile points but never the mathematical value',()=>{
 const {board,pending,move}=equation(['7','+','3','=','1','0']);
 const normal=scoreRogueMove(board,pending,move,withBoss('grid-warden'),3);
 const rogue=withBoss('seven-thief');
 rogue.upgrades=['ion-seven'];
 const cursed=scoreRogueMove(board,pending,move,rogue,3);
 const tile=cursed.tileScores.find(t=>t.value==='7');
 assert.equal(tile.points,0);
 assert.ok(cursed.total<normal.total);
 assert.equal(buildScoringCeremony(cursed).reduce((s,x)=>s+x.amount,0),cursed.total);
});
test('relic collector requires one highlighted tile until it is scored, not on every turn',()=>{
 const {board,pending,move}=equation();
 let rogue=selectForcedTile(withBoss('forced-relic'),3,Object.values(pending).filter(t=>t.value!=='='),()=>0);
 assert.ok(rogue.forcedTile);
 const demanded=rogue.forcedTile;
 assert.doesNotThrow(()=>validateBossMove(board,pending,move,rogue,3));
 const without=Object.fromEntries(Object.entries(pending).filter(([,tile])=>tile.id!==demanded));
 assert.throws(()=>validateBossMove(board,without,move,rogue,3),/demands/i);
 rogue=resolveBossScore(rogue,3,pending);
 assert.equal(rogue.forcedTile,null);
 assert.doesNotThrow(()=>validateBossMove(board,without,move,rogue,3));
});
test('Circuit Serpent rejects equations longer than eight spaces',()=>{
 const {board,pending,move}=equation(['1','2','+','3','+','4','=','1','9'],CENTER,CENTER-4);
 assert.equal(move.indices.length,9);
 assert.throws(()=>validateBossMove(board,pending,move,withBoss('short-circuit'),3),/eight squares/i);
 assert.doesNotThrow(()=>validateBossMove(board,pending,move,withBoss('short-circuit'),2));
});
test('critical reactor affects target only for its one boss sector',()=>{
 const rogue=withBoss('critical');
 assert.ok(targetForSector('rogue',3,rogue)>targetForSector('sector',3));
 assert.equal(targetForSector('rogue',2,rogue),targetForSector('sector',2));
 assert.equal(targetForSector('rogue',4,rogue),targetForSector('sector',4));
});
test('boss-dependent score mutations do not leak into ordinary sectors',()=>{
 const {board,pending,move}=equation();
 for(const boss of BOSS_POOL){
  const r=withBoss(boss.id);
  const regular=scoreRogueMove(board,pending,move,r,2);
  const baseline=scoreRogueMove(board,pending,move,makeRogueState(),2);
  assert.equal(regular.total,baseline.total,boss.id+' must be temporary');
 }
});
