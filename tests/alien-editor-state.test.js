import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {ALIEN_STORAGE_KEY,defaultAlien,serializeAlien} from '../src/alien/model.js';
import {
 EDITOR_SECTIONS,PART_COLLECTIONS,makeEditHistory,pushEdit,undoEdit,redoEdit,
 updateAlienPart,updateAlienColour,loadSavedAlien,saveAlienToStorage,sectionForField
} from '../src/alien/editor-state.js';

const manifest=JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)),
 '..','alien-manifest.json'),'utf8'));
const start=()=>defaultAlien();
function memoryStore(initial={}){
 const data=new Map(Object.entries(initial));
 return {
  getItem(key){return data.has(key)?data.get(key):null;},
  setItem(key,val){data.set(key,val);},
  dump:()=>Object.fromEntries(data)
 };
}
test('tabs group eyes and mouth, expose 7 sections without adding an eighth submenu',()=>{
 assert.deepEqual(EDITOR_SECTIONS.map(x=>x.id),
  ['head','face','body','arms','legs','accessory','colours']);
 assert.deepEqual(EDITOR_SECTIONS.find(x=>x.id==='face').fields,['eyes','mouth']);
 assert.deepEqual(EDITOR_SECTIONS.find(x=>x.id==='colours').fields,
  ['skin','outfit','accent']);
 assert.equal(sectionForField('mouth'),'face');
 assert.equal(sectionForField('eyes'),'face');
 assert.equal(sectionForField('head'),'head');
 assert.equal(sectionForField('unknown'),null);
 assert.equal(PART_COLLECTIONS.accessory,'accessories');
});
test('part changes preserve all other configuration values and reject unknown options',()=>{
 let a=start();
 a=updateAlienPart(a,manifest,'head','jelly');
 a=updateAlienPart(a,manifest,'eyes','trio');
 a=updateAlienPart(a,manifest,'mouth','zigzag');
 a=updateAlienPart(a,manifest,'accessory','none');
 assert.equal(a.head,'jelly');assert.equal(a.eyes,'trio');
 assert.equal(a.mouth,'zigzag');assert.equal(a.accessory,'none');
 assert.equal(a.body,'bean');assert.deepEqual(a.colours,start().colours);
 assert.equal(start().head,'orb','the original starter must stay immutable');
 for(const [field,id] of [['head','../../../evil'],['eyes','hacked'],
   ['accessory','data:text/html'],['mouth','<script>'],['prototype','smile']])
  assert.throws(()=>updateAlienPart(a,manifest,field,id));
});
test('three independent palettes update correct role without changing any other part',()=>{
 let a=start();
 a=updateAlienColour(a,manifest,'skin','coral');
 a=updateAlienColour(a,manifest,'outfit','aqua');
 a=updateAlienColour(a,manifest,'accent','cosmic-blue');
 assert.deepEqual(a.colours,{skin:'coral',outfit:'aqua',accent:'cosmic-blue'});
 assert.equal(a.head,'orb');assert.equal(a.arms,'mittens');
 for(const [role,id] of [['background','mint'],['skin','#ff00ff'],
   ['accent','../../url'],['outfit','color-mix(red,blue)']])
  assert.throws(()=>updateAlienColour(a,manifest,role,id));
});
test('undo and redo history restore every part, colour and full starter exactly',()=>{
 const first=makeEditHistory(start(),manifest);
 assert.equal(first.past.length,0);
 assert.equal(undoEdit(first),first);
 let a=pushEdit(first,updateAlienPart(start(),manifest,'head','pear'),manifest);
 a=pushEdit(a,updateAlienColour(a.present,manifest,'skin','saffron'),manifest);
 assert.equal(a.past.length,2);
 assert.equal(a.future.length,0);
 const back=undoEdit(a);
 assert.equal(back.present.head,'pear');assert.equal(back.present.colours.skin,'mint');
 assert.equal(back.future.length,1);
 const origin=undoEdit(back);
 assert.deepEqual(origin.present,start());
 assert.deepEqual(redoEdit(redoEdit(origin)).present,a.present);
 // A new edit invalidates redo, but re-selecting an already selected part does not.
 const fresh=pushEdit(back,updateAlienPart(back.present,manifest,'legs','hover'),manifest);
 assert.equal(fresh.future.length,0);
 const same=pushEdit(fresh,fresh.present,manifest);
 assert.equal(same,fresh);
});
test('editing history is bounded to 30 steps to limit browser memory',()=>{
 let history=makeEditHistory(start(),manifest);
 for(let i=0;i<70;i++){
  const palette=Object.keys(manifest.palettes)[i%6];
  history=pushEdit(history,updateAlienColour(history.present,manifest,'skin',palette),manifest);
 }
 assert.equal(history.past.length,30);
 assert.deepEqual(history.future,[]);
 assert.equal(history.present.colours.skin,'aqua');
});
test('saving uses ONLY the namespaced alien key and restores strict allowlisted config',()=>{
 const store=memoryStore({'equa-nova.sector-run.v1':'do-not-touch',
  'equa-nova.local-match.v1':'do-not-touch-either'});
 const original=start();
 assert.deepEqual(loadSavedAlien(store,manifest),{alien:original,status:'empty'});
 const a=updateAlienPart(original,manifest,'head','facet');
 assert.equal(saveAlienToStorage(store,a,manifest),true);
 const stored=store.dump();
 assert.equal(stored['equa-nova.sector-run.v1'],'do-not-touch');
 assert.equal(stored['equa-nova.local-match.v1'],'do-not-touch-either');
 assert.equal(stored[ALIEN_STORAGE_KEY],serializeAlien(a,manifest));
 assert.deepEqual(loadSavedAlien(store,manifest),{alien:a,status:'restored'});
 assert.equal(Object.keys(stored).length,3);
});
test('invalid, malicious, unsupported or blocked saved data fails safely',()=>{
 const tests=[
  'not json','{"__proto__":{"polluted":true}}',
  JSON.stringify({...start(),head:'https://bad.example/picture.svg'}),
  JSON.stringify({...start(),colours:{skin:'mint',outfit:'lavender',accent:'saffron',url:'evil'}}),
  JSON.stringify({...start(),version:700}),
  'x'.repeat(2000)
 ];
 for(const text of tests){
  const value=loadSavedAlien(memoryStore({[ALIEN_STORAGE_KEY]:text}),manifest);
  assert.equal(value.status,'invalid');
  assert.deepEqual(value.alien,start());
 }
 const blocked={
  getItem(){throw Error('private mode');},
  setItem(){throw Error('quota exceeded');}
 };
 assert.equal(loadSavedAlien(blocked,manifest).status,'unavailable');
 assert.equal(saveAlienToStorage(blocked,start(),manifest),false);
 assert.equal(saveAlienToStorage(null,start(),manifest),false);
 assert.deepEqual(loadSavedAlien(null,manifest).alien,start());
});
