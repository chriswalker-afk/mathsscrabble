import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TILE_SETS,kitRackSize,kitNumberSlots} from '../src/tile-sets.js';
import {ROGUE_ITEM_BY_ID} from '../src/rogue.js';

const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const files=Object.fromEntries([
 'index.html','play.html','online.html','alien-lab.html','achievement-hangar.html',
 'src/app.js','src/online-ui.js','src/alien/editor.js','src/rogue.js','src/drift-map.js'
].map(p=>[p,read(p)]));
const between=(s,start,end)=>{
 const a=s.indexOf(start),b=s.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'missing instruction surface '+start);
 return s.slice(a,b);
};
const textOnly=value=>value.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const words=value=>textOnly(value).split(/\s+/).filter(Boolean).length;
test('Launch copy has no obsolete build labels or misleading rack/sector claims',()=>{
 const all=Object.values(files).join('\n');
 assert.doesNotMatch(all,/ALPHA LAB|BACK TO MISSIONS|original 5 number \/ 3 operator balance|nine total|Sector three is the randomly selected zone boss/i);
 assert.match(files['index.html'],/before playing to earn and keep 40 cosmetic rewards/);
 assert.match(files['achievement-hangar.html'],/Guests can play but cannot earn permanent rewards/);
 assert.match(files['src/app.js'],/every third sector has a random boss/i);
 assert.match(files['src/drift-map.js'],/Your installed Ship Systems/);
 assert.doesNotMatch(ROGUE_ITEM_BY_ID['wide-rack'].description,/nine total|six numbers and three/i);
 assert.match(ROGUE_ITEM_BY_ID['wide-rack'].description,/one number slot/);
});
test('Four kits are described using the actual base rack geometry',()=>{
 assert.deepEqual(TILE_SETS.map(k=>[k.id,kitNumberSlots(k.id),kitRackSize(k.id)]),
  [['natural',5,8],['integer',5,8],['rational',6,11],['advanced',6,11]]);
 const copy=files['src/app.js'];
 assert.match(copy,/Starting racks[^<]+5 numbers \+ 3 operators/);
 assert.match(copy,/6 numbers \+ 3 operators \+ a matched \( \) pair/);
 for(const id of ['natural','integer','rational','advanced'])
  assert.ok(TILE_SETS.some(k=>k.id===id&&k.desc.length>25));
 assert.match(files['src/online-ui.js'],/Brackets must|Place or exchange both \( and \)/);
});
test('Mode manuals are action-first, brief and cover the required mechanics',()=>{
 const app=files['src/app.js'];
 const manuals=[
  {part:between(app,'function showTraining(firstVisit=false){',"$('help-btn').onclick="),steps:3,required:[/centre/,/Score Equation/,/Blank tiles/,/locked tile/,/BIDMAS/]},
  {part:between(app,'function showLocalHelp(){','function showDriftIntro'),steps:3,required:[/Ready/,/rack private/,/centre/,/net score/i,/unused tile points/i,/timeout/]},
  {part:between(app,'function showDriftIntro(firstVisit=false){','function restoreMode'),steps:3,required:[/centre/,/Flux/,/Salvage Bay/,/four Ship Systems/,/two one-use Mission Gadgets/,/Every third sector/,/temporary rule/]}
 ];
 for(const {part,steps,required} of manuals){
  const paragraphs=[...part.matchAll(/<div class="training-step">[\s\S]*?<p>([\s\S]*?)<\/p>/g)].map(m=>m[1]);
  assert.equal(paragraphs.length,steps,'manual must have three steps');
  assert.ok(paragraphs.every(p=>words(p)<=44),'manual should contain at most 44 words per step: '+paragraphs.map(words));
  for(const re of required)assert.match(part,re);
 }
 const online=between(files['src/online-ui.js'],"$('online-help').onclick=", 'async function copyInvite()');
 const rows=online.split('\n').filter(s=>s.trim().startsWith("['"));
 assert.equal(rows.length,4,'online rules should be four short steps');
 for(const row of rows)assert.ok(words(row)<=45,'online rule is too long: '+row);
 for(const re of [/centre/,/BIDMAS/,/Score/,/rack/,/two rounds/,/Brackets/])
  assert.match(online,re);
});
test('New users receive the correct next action, not two competing start buttons',()=>{
 const intro=between(files['src/app.js'],'function showTraining(firstVisit=false){',"$('help-btn').onclick=");
 assert.doesNotMatch(intro,/SKIP GUIDE/);
 assert.match(intro,/START MISSION/);
 const drift=between(files['src/app.js'],'function showDriftIntro(firstVisit=false){','function restoreMode');
 assert.match(drift,/firstVisit\?'BEGIN THE DRIFT →':'BACK TO GAME'/);
 const online=files['online.html'];
 assert.match(online,/id="online-gate-help"/);
 assert.match(files['src/online-ui.js'],/BACK TO LOBBY/);
 assert.match(files['src/online-ui.js'],/BACK TO SETUP/);
 assert.match(files['src/app.js'],/select a pilot in the Hangar before starting a new run/i);
});
test('No page repeats a superfluous long intro or falsely promises synced pilot data',()=>{
 const home=files['index.html'],hangar=files['achievement-hangar.html'];
 const intro=(home.match(/<p class="home-description">([^<]*)<\/p>/)||[])[1];
 const tileIntro=(home.match(/<p class="tile-kit-intro">([^<]*)<\/p>/)||[])[1];
 assert.ok(intro&&words(intro)<=22);
 assert.ok(tileIntro&&words(tileIntro)<=21);
 assert.doesNotMatch(home,/home-missions-sub/);
 assert.match(home,/Saved games keep their original kit/);
 assert.doesNotMatch(hangar,/synced between devices|online accounts included/i);
 assert.match(hangar,/Achievements save on this device/);
 assert.match(files['alien-lab.html'],/save your alien for matches/i);
 assert.match(files['src/alien/editor.js'],/Changes are not saved yet/);
});
