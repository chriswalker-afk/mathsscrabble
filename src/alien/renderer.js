/** Alien Lab — secure, deterministic 320×360 SVG compositor for A1 art.
 * Pure selection/validation is in model.js, reusable in Workers; this file
 * uses DOM APIs and belongs only to the browser renderer.
 */
import {
 assertAlienManifest,alienLayers,alienDescription,ALIEN_COLLECTIONS
} from './model.js';

const SVG_NS='http://www.w3.org/2000/svg';
const SAFE_TAGS=new Set(['svg','title','desc','g','path','ellipse','circle','rect','line','polygon','polyline']);
const SAFE_ATTRS=new Set([
 'xmlns','width','height','viewbox','fill','stroke','stroke-width',
 'stroke-linecap','stroke-linejoin','stroke-miterlimit','d','cx','cy','r',
 'rx','ry','x','y','x1','y1','x2','y2','points','transform','opacity',
 'role','aria-label'
]);
const illegalText=/url\s*\(|javascript:|data:|<\s*(?:script|image|foreignObject|use|style|filter|mask)\b|<!doctype|<!entity|on[a-z]+\s*=/i;
const safeAssetName=(v)=>typeof v==='string'&&/^[a-z][a-z0-9-]{0,31}$/.test(v);

/** Tight artwork framing for small player icons and category thumbnails.
 * These crops never alter the stored alien, source SVGs or full export.
 * Portrait excludes the deliberately peripheral moonlet when necessary,
 * keeping facial features large enough to read in a 48px scoreboard icon.
 */
export const ALIEN_FRAMINGS=Object.freeze({
 full:'0 0 320 360',
 portrait:'52 3 216 216',
 bust:'38 10 244 265',
 head:'48 0 224 220',
 face:'90 57 140 116',
 torso:'63 130 194 176',
 arms:'23 112 274 174',
 legs:'27 218 266 128',
 badge:'85 179 153 118',
 companion:'137 54 175 158'
});
export function framingForPart(field,id=''){
 if(field==='head')return 'head';
 if(field==='eyes'||field==='mouth')return 'face';
 if(field==='body')return 'torso';
 if(field==='arms')return 'arms';
 if(field==='legs')return 'legs';
 if(field==='accessory'){
   if(id==='badge')return 'badge';
   if(id==='companion')return 'companion';
   if(id==='jetpack')return 'arms';
   if(['antennae','horns','helmet'].includes(id))return 'head';
 }
 return 'full';
}

export function validateAlienSvg(source,collection,id,manifest){
 if(!ALIEN_COLLECTIONS.includes(collection)||!manifest.parts[collection]?.includes(id)||
    collection==='accessories'&&id==='none')
  throw new Error('Alien SVG part is not on the approved manifest.');
 if(typeof source!=='string'||source.length>20000||illegalText.test(source))
  throw new Error('Unsafe or oversized alien SVG: '+collection+'/'+id);
 const root=new DOMParser().parseFromString(source,'image/svg+xml').documentElement;
 if(root.localName!=='svg'||root.namespaceURI!==SVG_NS||
    root.getAttribute('viewBox')!=='0 0 320 360'||
    root.getAttribute('width')!=='320'||root.getAttribute('height')!=='360'||
    root.getAttribute('data-alien-part')!==collection||
    root.getAttribute('data-part-id')!==id||
    root.getAttribute('data-art-version')!=='1'||
    root.getAttribute('data-anchor-x')!=='160'||
    root.getAttribute('data-anchor-neck-y')!=='154'||
    root.getAttribute('data-anchor-hip-y')!=='260')
  throw new Error('Incompatible alien SVG layer: '+collection+'/'+id);
 const elements=[root,...root.querySelectorAll('*')];
 if(elements.length>140)throw new Error('Oversized alien SVG structure.');
 let shapes=0;
 for(const el of elements){
  if(el.namespaceURI!==SVG_NS||!SAFE_TAGS.has(el.localName))
   throw new Error('Unexpected SVG element in '+collection+'/'+id);
  if(['path','circle','ellipse','rect','line','polyline','polygon'].includes(el.localName))
   shapes++;
  for(const attr of el.attributes){
   const key=attr.name.toLowerCase();
   if(!SAFE_ATTRS.has(key)&&!key.startsWith('data-')||
      /^(?:on|href|xlink:|style)/i.test(key)||
      attr.value.length>5000||illegalText.test(attr.value))
    throw new Error('Unsafe SVG attribute '+key+' in '+collection+'/'+id);
   if((key==='data-color-slot'||key==='data-stroke-slot')&&
     !manifest.colorTokens.includes(attr.value))
    throw new Error('Invalid SVG palette token '+attr.value);
   if(key==='data-layer'||key==='data-color-role'){
    if(!safeAssetName(attr.value))throw new Error('Unexpected SVG metadata.');
   }
  }
 }
 if(shapes<2)throw new Error('Alien SVG has too little artwork: '+collection+'/'+id);
 return root;
}
export async function loadAlienLibrary(base='./',fetcher=fetch){
 const baseUrl=new URL(base,location.href);
 if(baseUrl.origin!==location.origin)throw new Error('Alien assets must be local.');
 const manifestResponse=await fetcher(new URL('alien-manifest.json',baseUrl),{cache:'no-store'});
 if(!manifestResponse.ok)throw new Error('Cannot load Alien Lab manifest.');
 const manifest=assertAlienManifest(await manifestResponse.json());
 const parts=new Map();
 const tasks=[];
 for(const [collection,ids] of Object.entries(manifest.parts)){
  for(const id of ids){
   if(collection==='accessories'&&id==='none')continue;
   tasks.push((async()=>{
    const path='assets/aliens/'+collection+'/'+id+'.svg';
    const response=await fetcher(new URL(path,baseUrl),{cache:'force-cache'});
    if(!response.ok)throw new Error('Missing alien artwork: '+path);
    const svg=validateAlienSvg(await response.text(),collection,id,manifest);
    parts.set(collection+'/'+id,svg);
   })());
  }
 }
 await Promise.all(tasks);
 return {manifest,parts};
}
/** Returns a complete, self-contained transparent SVG and never parses user HTML. */
export function renderAlienSVG(alien,library,{width=320,height=360,accessible=true,framing='full'}={}){
 const {manifest,parts}=library;
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<16||height<16||
   width>1024||height>1024)throw new Error('Unsupported alien render size.');
 if(!Object.hasOwn(ALIEN_FRAMINGS,framing))
   throw new Error('Unsupported alien framing.');
 const svg=document.createElementNS(SVG_NS,'svg');
 svg.setAttribute('xmlns',SVG_NS);
 svg.setAttribute('viewBox',ALIEN_FRAMINGS[framing]);
 svg.setAttribute('width',String(Math.round(width)));
 svg.setAttribute('height',String(Math.round(height)));
 if(accessible){
  svg.setAttribute('role','img');
  const title=document.createElementNS(SVG_NS,'title');
  title.textContent=alienDescription(alien,manifest);
  svg.append(title);
 }else svg.setAttribute('aria-hidden','true');
 for(const layer of alienLayers(alien,manifest)){
  const original=parts.get(layer.collection+'/'+layer.id);
  if(!original)throw new Error('Missing alien asset '+layer.path);
  const group=document.createElementNS(SVG_NS,'g');
  group.setAttribute('data-layer',layer.layer);
  group.setAttribute('data-part-id',layer.id);
  for(const child of original.children){
   if(child.localName==='g')group.append(document.importNode(child,true));
  }
  if(layer.paletteId){
   const swatch=manifest.palettes[layer.paletteId];
   group.querySelectorAll('[data-color-slot]').forEach(el=>{
    const slot=el.getAttribute('data-color-slot');
    if(Object.hasOwn(swatch,slot))el.setAttribute('fill',swatch[slot]);
   });
   group.querySelectorAll('[data-stroke-slot]').forEach(el=>{
    const slot=el.getAttribute('data-stroke-slot');
    if(Object.hasOwn(swatch,slot))el.setAttribute('stroke',swatch[slot]);
   });
  }
  svg.append(group);
 }
 return svg;
}
export function serializeAlienSVG(alien,library){
 const svg=renderAlienSVG(alien,library);
 return new XMLSerializer().serializeToString(svg);
}
