import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {ACHIEVEMENTS,FREE_ALIEN_OPTIONS,ACHIEVEMENTS_BY_MODE} from '../src/achievements/catalog.js';
import {assertAlienManifest,validateAlienPayload,defaultAlien,ALIEN_PART_FIELDS} from '../src/alien/model.js';
import {emptyAchievementStore,ownsAlienOption} from '../src/achievements/engine.js';
const root=new URL('../',import.meta.url).pathname;
const manifest=JSON.parse(readFileSync(join(root,'alien-manifest.json'),'utf8'));
const base={heads:4,eyes:4,mouths:4,bodies:4,arms:4,legs:4,accessories:7};
test('all original free choices are still present in original order and all starter aliens validate',()=>{
 assert.equal(assertAlienManifest(manifest),manifest);
 for(const [kind,free] of Object.entries(FREE_ALIEN_OPTIONS)){
  const ids=kind==='palettes'?Object.keys(manifest.palettes):manifest.parts[kind];
  assert.deepEqual(ids.slice(0,free.length),free,'original choices changed: '+kind);
 }
 for(const preset of Object.values(manifest.presets))assert.deepEqual(validateAlienPayload(preset,manifest),preset);
});
test('the 40 rewards have exactly one new manifest-allowlisted asset or palette each',()=>{
 assert.equal(ACHIEVEMENTS.length,40);
 const prizes=new Set();
 for(const a of ACHIEVEMENTS){
  const {collection,id}=a.reward;
  const key=collection+'/'+id;
  assert.ok(!prizes.has(key),'duplicate reward '+key);prizes.add(key);
  if(collection==='palettes')assert.ok(Object.hasOwn(manifest.palettes,id));
  else {
   assert.ok(manifest.parts[collection].includes(id),'missing part '+key);
   const file=join(root,'assets/aliens',collection,id+'.svg');
   assert.ok(existsSync(file),'missing original art '+key);
   const art=readFileSync(file,'utf8');
   assert.match(art,/viewBox="0 0 320 360"/);
   assert.ok(art.includes('data-alien-part="'+collection+'"'));
   assert.ok(art.includes('data-part-id="'+id+'"'));
   assert.ok(art.includes('<title>')&&art.includes('<desc>'));
   assert.ok(!/<script|<foreignObject|<image\b|<use\b|<style\b|url\s*\(|onload|href\s*=/i.test(art),'unsafe asset '+key);
  }
 }
 assert.equal(prizes.size,40);
 for(const [mode,awards] of Object.entries(ACHIEVEMENTS_BY_MODE))assert.equal(awards.length,10,mode);
});
test('new awards are not freely selectable and existing parts remain available to anonymous guests',()=>{
 const blank=emptyAchievementStore();
 for(const [kind,ids] of Object.entries(FREE_ALIEN_OPTIONS))
  for(const id of ids)assert.equal(ownsAlienOption(blank,null,kind,id),true);
 for(const a of ACHIEVEMENTS)assert.equal(ownsAlienOption(blank,null,a.reward.collection,a.reward.id),false);
});
test('every reward can be composed into a safe canonical alien payload',()=>{
 const columns={heads:'head',eyes:'eyes',mouths:'mouth',bodies:'body',arms:'arms',legs:'legs',accessories:'accessory'};
 for(const a of ACHIEVEMENTS){
  const alien=defaultAlien(); const {collection,id}=a.reward;
  if(collection==='palettes')alien.colours.skin=id;
  else alien[columns[collection]]=id;
  assert.deepEqual(validateAlienPayload(alien,manifest),alien);
 }
});
