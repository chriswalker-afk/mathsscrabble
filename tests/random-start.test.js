import test from 'node:test';
import assert from 'node:assert/strict';
import {makeBag,randomFloat} from '../src/engine.js';
import {dealPlayableRack} from '../src/solo.js';
import {makeLocalMatch} from '../src/multiplayer.js';
import {
 OPENING_HISTORY_KEY,openingPattern,distinctOpening,
 loadOpeningPattern,rememberOpening
} from '../src/random-start.js';

const storage=()=>{const map=new Map();return {
 getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}};
test('a fresh bag is fully shuffled and its finite 151 tiles are conserved',()=>{
 const first=makeBag(()=>0.25),second=makeBag(()=>0.75);
 assert.equal(first.length,151);
 assert.equal(second.length,151);
 assert.notEqual(openingPattern(first),openingPattern(second));
 assert.deepEqual(first.map(x=>x.blank||x.value).sort(),
                  second.map(x=>x.blank||x.value).sort());
 assert.equal(typeof randomFloat(),'number');
 assert.ok(randomFloat()>=0&&randomFloat()<1);
});
test('newly dealt tiles have random rack positions but kept tiles retain order',()=>{
 const bag=makeBag(()=>0.5);
 const first=dealPlayableRack([],bag,{},()=>0);
 const second=dealPlayableRack([],bag,{},()=>0.99999);
 assert.notEqual(openingPattern(first.rack),openingPattern(second.rack));
 assert.deepEqual(first.rack.map(t=>t.id).sort(),second.rack.map(t=>t.id).sort());
 const kept=first.rack.slice(0,3);
 const topUp=dealPlayableRack(kept,first.bag,{},()=>0.99999);
 assert.deepEqual(topUp.rack.slice(0,3),kept);
 assert.equal(topUp.rack.length,7);
});
test('consecutive new games cannot show the same visible opening hand',()=>{
 const seedBag=makeBag(()=>0.5);
 const factory=()=>dealPlayableRack([],seedBag,{},()=>0.5);
 const a=factory();
 const b=distinctOpening(factory,openingPattern(a.rack),x=>x.rack,
   (x,rack)=>({...x,rack}));
 assert.notEqual(openingPattern(a.rack),openingPattern(b.rack));
 assert.equal(a.bag.length+b.rack.length,151);
 assert.deepEqual(a.rack.map(t=>t.id).sort(),b.rack.map(t=>t.id).sort());
});
test('new match can vary rack order without giving any player extra tiles',()=>{
 const factory=()=>makeLocalMatch({names:['Pilot 1','Pilot 2']},()=>0.5);
 const a=factory();
 const b=distinctOpening(factory,openingPattern(a.players[0].rack),
   x=>x.players[0].rack,(x,rack)=>({...x,players:
     x.players.map((p,i)=>i===0?{...p,rack}:p)}));
 assert.notEqual(openingPattern(a.players[0].rack),openingPattern(b.players[0].rack));
 assert.deepEqual(a.players[0].rack.map(t=>t.id).sort(),b.players[0].rack.map(t=>t.id).sort());
 assert.equal(b.bag.length+ b.players.flatMap(p=>p.rack).length,151);
});
test('different game modes remember their own last opening patterns',()=>{
 const s=storage();
 const rack=[{value:'2'},{value:'+'},{value:'5'}];
 assert.equal(loadOpeningPattern(s,'sector'),null);
 assert.equal(rememberOpening(s,'sector',rack),true);
 assert.equal(rememberOpening(s,'rogue',[{value:'8'},{value:'×'}]),true);
 assert.equal(rememberOpening(s,'local',[{value:'0'},{value:'÷'}]),true);
 assert.equal(loadOpeningPattern(s,'sector'),'2|+|5');
 assert.equal(loadOpeningPattern(s,'rogue'),'8|×');
 assert.equal(loadOpeningPattern(s,'local'),'0|÷');
 assert.equal(JSON.parse(s.getItem(OPENING_HISTORY_KEY)).sector,'2|+|5');
});
test('exhausted or disabled browser storage never breaks a new game',()=>{
 const blocked={getItem(){throw Error('disabled');},setItem(){throw Error('blocked')}};
 assert.equal(loadOpeningPattern(blocked,'sector'),null);
 assert.equal(rememberOpening(blocked,'sector',[{value:'5'}]),false);
});
