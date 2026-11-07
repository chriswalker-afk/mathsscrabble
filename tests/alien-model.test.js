import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
 ALIEN_VERSION,ALIEN_STORAGE_KEY,ALIEN_COLLECTIONS,ALIEN_PART_FIELDS,
 ALIEN_COLOUR_FIELDS,ALIEN_DRAW_ORDER,assertAlienManifest,defaultAlien,
 normaliseAlien,validateAlienPayload,serializeAlien,parseStoredAlien,
 randomAlien,presetAlien,alienLayers,alienAssetPath,alienDescription
} from '../src/alien/model.js';

const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(readFileSync(join(ROOT,'alien-manifest.json'),'utf8'));
const M=()=>structuredClone(manifest);
const pathOf=(kind,id)=>join(ROOT,'assets','aliens',kind,id+'.svg');

test('the A1 manifest locks a transparent 320×360 artboard, all anchors and seven part categories',()=>{
 assert.equal(assertAlienManifest(manifest),manifest);
 assert.deepEqual(manifest.canvas.viewBox,[0,0,320,360]);
 assert.equal(manifest.anchors.centerX,160);
 assert.equal(manifest.anchors.neckY,154);
 assert.equal(manifest.anchors.hipY,260);
 assert.deepEqual(manifest.anchors.shoulders.left,[113,190]);
 assert.deepEqual(manifest.anchors.shoulders.right,[207,190]);
 assert.equal(ALIEN_VERSION,1);
 assert.equal(ALIEN_STORAGE_KEY,'equa-nova.alien.v1');
 assert.equal(ALIEN_COLLECTIONS.length,7);
 assert.equal(ALIEN_PART_FIELDS.length,7);
 assert.deepEqual(ALIEN_COLOUR_FIELDS,['skin','outfit','accent']);
 assert.deepEqual(manifest.drawOrder,ALIEN_DRAW_ORDER);
 assert.deepEqual(Object.fromEntries(Object.entries(manifest.parts).map(([key,ids])=>[key,ids.length])),
  {heads:11,eyes:8,mouths:7,bodies:9,arms:8,legs:8,accessories:16});
 assert.equal(Object.keys(manifest.palettes).length,10);
 assert.equal(manifest.allowAllCombinations,true);
});
test('thirty authored vector pieces exist, share exact registered anchors and contain only allowed local artwork',()=>{
 let count=0;
 for(const [kind,ids] of Object.entries(manifest.parts)){
  for(const id of ids){
   if(kind==='accessories'&&id==='none')continue;
   const file=pathOf(kind,id),source=readFileSync(file,'utf8');
   assert.ok(statSync(file).size<20000,'asset size limit '+file);
   assert.match(source,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
   assert.match(source,/viewBox="0 0 320 360"/);
   assert.match(source,/width="320" height="360"/);
   assert.ok(source.includes('data-alien-part="'+kind+'"'));
   assert.ok(source.includes('data-part-id="'+id+'"'));
   assert.ok(source.includes('data-anchor-x="160"'));
   assert.ok(source.includes('data-anchor-neck-y="154"'));
   assert.ok(source.includes('data-anchor-hip-y="260"'));
   assert.ok(source.includes('<title>')&&source.includes('<desc>'));
   assert.ok(source.includes('<g ')&&source.includes('</g>'));
   assert.ok(!/<script|<foreignObject|<image\b|<use\b|<style\b|<iframe|url\s*\(|onload\s*=|onclick\s*=|xlink:href|href\s*=/i.test(source),
    'unsafe SVG construct in '+file);
   for(const [,token] of source.matchAll(/data-(?:color|stroke)-slot="([^"]+)"/g))
    assert.ok(manifest.colorTokens.includes(token),'unknown slot '+token+' in '+file);
   for(const [,code] of source.matchAll(/(?:fill|stroke)="(#[0-9a-fA-F]+)"/g))
    assert.ok(/^#[a-f0-9]{6}$/i.test(code),'invalid hex in '+file);
   assert.ok(source.includes('</svg>'));
   count++;
  }
 }
 assert.equal(count,66);
});
test('exact and safe versioned serialization round-trips four curated pilots',()=>{
 const names=Object.keys(manifest.presets);
 assert.deepEqual(names,['bloop','orbit','niblet','glimmer']);
 for(const id of names){
  const pilot=presetAlien(manifest,id);
  assert.deepEqual(pilot,manifest.presets[id]);
  assert.deepEqual(JSON.parse(serializeAlien(pilot,manifest)),pilot);
  assert.deepEqual(parseStoredAlien(serializeAlien(pilot,manifest),manifest),pilot);
  assert.match(alienDescription(pilot,manifest),/alien with/i);
  assert.ok(serializeAlien(pilot,manifest).length<400);
 }
 assert.throws(()=>presetAlien(manifest,'../../unsafe'));
});
test('malformed client data is rejected by strict server validator and repaired by the browser normaliser',()=>{
 const original=defaultAlien();
 assert.equal(original.version,1);
 assert.equal(original.head,'orb');
 assert.equal(original.accessory,'antennae');
 assert.deepEqual(original.colours,{skin:'mint',outfit:'lavender',accent:'saffron'});
 assert.deepEqual(validateAlienPayload(original,manifest),original);
 const malicious=[
  {...original,head:'../evil'}, {...original,head:'<img src=x>'},
  {...original,eyes:'dragon'}, {...original,colours:{...original.colours,skin:'url(x)'}},
  {...original,accessory:'remote.svg'}, {...original,version:2},
  {...original,svg:'<script>evil</script>'},
  {...original,colours:{...original.colours,html:'hi'}},null,[],{}
 ];
 for(const input of malicious)
  assert.throws(()=>validateAlienPayload(input,manifest));
 const fixed=normaliseAlien({...original,head:'../../unknown',mouth:'zigzag',
  colours:{skin:'glow(r)',outfit:'aqua',accent:'coral'},junk:true},manifest);
 assert.equal(fixed.head,'orb');
 assert.equal(fixed.mouth,'zigzag');
 assert.deepEqual(fixed.colours,{skin:'mint',outfit:'aqua',accent:'coral'});
 for(const saved of [null,undefined,'', '{unclosed','{}','x'.repeat(1025),
   JSON.stringify({...original,version:55})])
  assert.deepEqual(parseStoredAlien(saved,manifest),original);
});
test('randomiser uses only allowed parts and six palettes and changes identical samples',()=>{
 const a=randomAlien(manifest,null,()=>0);
 const b=randomAlien(manifest,a,()=>0);
 assert.deepEqual(validateAlienPayload(a,manifest),a);
 assert.notDeepEqual(a,b);
 assert.notEqual(a.head,b.head);
 const final=randomAlien(manifest,a,()=>1);
 assert.equal(final.head,manifest.parts.heads.at(-1));
 assert.equal(final.eyes,manifest.parts.eyes.at(-1));
 assert.equal(final.colours.skin,Object.keys(manifest.palettes).at(-1));
 assert.ok(manifest.parts.accessories.includes(final.accessory));
});
test('composition layers have canonical ordering, original paths and palette roles',()=>{
 const noAcc={...defaultAlien(),accessory:'none'};
 const plain=alienLayers(noAcc,manifest);
 assert.deepEqual(plain.map(x=>x.layer),['legs','arms','body','head','eyes','mouth']);
 assert.deepEqual(plain.map(x=>x.colourRole),['skin','skin','outfit','skin',null,null]);
 const rear=alienLayers({...noAcc,accessory:'jetpack'},manifest);
 assert.equal(rear[0].layer,'rear-accessory');
 assert.equal(rear[0].path,'assets/aliens/accessories/jetpack.svg');
 const front=alienLayers({...noAcc,accessory:'badge'},manifest);
 assert.equal(front.at(-1).layer,'front-accessory');
 assert.equal(front.at(-1).paletteId,'saffron');
 assert.equal(front.length,7);
 assert.equal(alienAssetPath('heads','orb',manifest),'assets/aliens/heads/orb.svg');
 for(const [kind,id] of [['heads','../cat'],['accessories','none'],['eyes','evil.svg'],['false','hello']])
  assert.throws(()=>alienAssetPath(kind,id,manifest));
});
test('all 28,672 base compositions produce only allowlisted assets in the correct layer order',()=>{
 const [hs,es,ms,bs,as,ls,acs]=[
  manifest.parts.heads.slice(0,4),manifest.parts.eyes.slice(0,4),manifest.parts.mouths.slice(0,4),
  manifest.parts.bodies.slice(0,4),manifest.parts.arms.slice(0,4),manifest.parts.legs.slice(0,4),
  manifest.parts.accessories.slice(0,7)
 ];
 let total=0;
 const a=defaultAlien();
 for(const head of hs)for(const eyes of es)for(const mouth of ms)
 for(const body of bs)for(const arms of as)for(const legs of ls)
 for(const accessory of acs){
  Object.assign(a,{head,eyes,mouth,body,arms,legs,accessory});
  const layers=alienLayers(a,manifest);
  assert.equal(layers.length,accessory==='none'?6:7);
  assert.deepEqual(layers.filter(x=>x.layer==='eyes'||x.layer==='mouth').map(x=>x.paletteId),
   [null,null]);
  assert.ok(layers.every(layer=>layer.path==='assets/aliens/'+layer.collection+'/'+layer.id+'.svg'));
  total++;
 }
 assert.equal(total,28672);
});
test('all 216 independent skin × outfit × accessory palette combinations are valid',()=>{
 const a=defaultAlien(),palettes=Object.keys(manifest.palettes);
 let count=0;
 for(const skin of palettes)for(const outfit of palettes)for(const accent of palettes){
  a.colours={skin,outfit,accent};
  assert.deepEqual(validateAlienPayload(a,manifest),a);
  count++;
 }
 assert.equal(count,1000);
});
test('manifest validation fails closed on broken anchors, colours, categories and unsafe preset values',()=>{
 const mutate=(fn)=>{const m=M();fn(m);assert.throws(()=>assertAlienManifest(m));};
 mutate(m=>{m.canvas.viewBox=[0,0,100,360]});
 mutate(m=>{m.anchors.neckY=100});
 mutate(m=>{m.anchors.face.eyesSafe=[300,300,200,200]});
 mutate(m=>{m.parts.heads.push('../danger')});
 mutate(m=>{m.parts.legs[1]=m.parts.legs[0]});
 mutate(m=>{m.palettes.mint.primary='url(https://evil.invalid)'});
 mutate(m=>{m.palettes.coral.newToken='red'});
 mutate(m=>{m.accessoryLayers.helmet='hacked'});
 mutate(m=>{m.colourRoles.head='unsafe'});
 mutate(m=>{m.presets.bloop.head='remote.svg'});
 mutate(m=>{m.allowAllCombinations=false});
});

test('A3 fixed portrait and part crops never allow arbitrary viewBoxes or remote URLs',async()=>{
 const {ALIEN_FRAMINGS,framingForPart}=await import('../src/alien/renderer.js');
 assert.equal(ALIEN_FRAMINGS.full,'0 0 320 360');
 assert.equal(ALIEN_FRAMINGS.portrait,'52 3 216 216');
 assert.equal(ALIEN_FRAMINGS.bust,'38 10 244 265');
 assert.equal(framingForPart('eyes','cyclops'),'face');
 assert.equal(framingForPart('mouth','smile'),'face');
 assert.equal(framingForPart('head','facet'),'head');
 assert.equal(framingForPart('arms','claws'),'arms');
 assert.equal(framingForPart('legs','hover'),'legs');
 assert.equal(framingForPart('accessory','badge'),'badge');
 assert.equal(framingForPart('accessory','companion'),'companion');
 assert.equal(framingForPart('accessory','helmet'),'head');
 assert.equal(framingForPart('accessory','none'),'full');
 assert.equal(framingForPart('body','puff'),'torso');
 for(const frame of Object.values(ALIEN_FRAMINGS)){
  const tokens=frame.split(' ').map(Number);
  assert.equal(tokens.length,4);
  assert.ok(tokens[0]>=0&&tokens[1]>=0&&tokens[2]>0&&tokens[3]>0);
  assert.ok(tokens[0]+tokens[2]<=320&&tokens[1]+tokens[3]<=360);
 }
});
