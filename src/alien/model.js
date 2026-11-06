/** EQUA//NOVA Alien Lab — pure configuration/validation and composition contract.
 * No browser globals, networking, DOM, storage, or unsafe SVG content.
 * Importable by the online Durable Object when avatars join rooms later.
 */
export const ALIEN_VERSION=1;
export const ALIEN_STORAGE_KEY='equa-nova.alien.v1';
export const ALIEN_COLLECTIONS=Object.freeze(['heads','eyes','mouths','bodies','arms','legs','accessories']);
export const ALIEN_PART_FIELDS=Object.freeze(['head','eyes','mouth','body','arms','legs','accessory']);
export const ALIEN_COLOUR_FIELDS=Object.freeze(['skin','outfit','accent']);
export const ALIEN_DRAW_ORDER=Object.freeze([
 'rear-accessory','legs','arms','body','head','eyes','mouth','front-accessory'
]);
const COLLECT=Object.freeze({
 head:'heads',eyes:'eyes',mouth:'mouths',body:'bodies',
 arms:'arms',legs:'legs',accessory:'accessories'
});
const COLOUR_ROLE=Object.freeze({
 head:'skin',eyes:null,mouth:null,body:'outfit',arms:'skin',legs:'skin',accessory:'accent'
});
const DEFAULT=Object.freeze({
 version:ALIEN_VERSION,head:'orb',eyes:'twin',mouth:'smile',body:'bean',
 arms:'mittens',legs:'stubs',accessory:'antennae',
 colours:Object.freeze({skin:'mint',outfit:'lavender',accent:'saffron'})
});
const ID=/^[a-z][a-z0-9-]{0,31}$/;
const HEX=/^#[0-9a-fA-F]{6}$/;
const KEYS=['version',...ALIEN_PART_FIELDS,'colours'];
const exactKeys=(object,keys)=>
 !!object&&typeof object==='object'&&!Array.isArray(object)&&
 Object.keys(object).length===keys.length&&Object.keys(object).every(k=>keys.includes(k));
const isId=v=>typeof v==='string'&&ID.test(v);
const isNumber=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const isXY=(v,maxX=320,maxY=360)=>Array.isArray(v)&&v.length===2&&
 isNumber(v[0],0,maxX)&&isNumber(v[1],0,maxY);
export function defaultAlien(){return {...DEFAULT,colours:{...DEFAULT.colours}};}
export function isAllowedAlienPart(manifest,field,id){
 const category=COLLECT[field];
 return !!category&&isId(id)&&Array.isArray(manifest?.parts?.[category])&&
   manifest.parts[category].includes(id);
}
export function assertAlienManifest(manifest){
 if(!manifest||manifest.version!==ALIEN_VERSION||
  !exactKeys(manifest.canvas,['width','height','viewBox'])||
  manifest.canvas.width!==320||manifest.canvas.height!==360||
  JSON.stringify(manifest.canvas.viewBox)!=='[0,0,320,360]')
   throw new Error('Alien manifest canvas/version is incompatible.');
 if(!Array.isArray(manifest.drawOrder)||
    JSON.stringify(manifest.drawOrder)!==JSON.stringify(ALIEN_DRAW_ORDER))
   throw new Error('Alien SVG layer order is incompatible.');
 if(!manifest.anchors||manifest.anchors.centerX!==160||
    manifest.anchors.neckY!==154||manifest.anchors.hipY!==260||
    !isXY(manifest.anchors.face?.eyesCenter)||
    !isXY(manifest.anchors.face?.mouthCenter)||
    !isXY(manifest.anchors.shoulders?.left)||
    !isXY(manifest.anchors.shoulders?.right)||
    !isXY(manifest.anchors.accessories?.head)||
    !isXY(manifest.anchors.accessories?.chest)||
    !isXY(manifest.anchors.accessories?.rear))
   throw new Error('Alien alignment anchors are missing or invalid.');
 for(const safe of ['eyesSafe','mouthSafe']){
   const box=manifest.anchors.face[safe];
   if(!Array.isArray(box)||box.length!==4||box.some((v,i)=>!isNumber(v,0,i%2?360:320))||
     box[0]>=box[2]||box[1]>=box[3])throw new Error('Alien face bounds are invalid.');
 }
 if(!manifest.parts||!manifest.accessoryLayers||!manifest.colourRoles||
    !manifest.palettes||!manifest.presets)throw new Error('Alien catalogue is incomplete.');
 const counts={heads:4,eyes:4,mouths:4,bodies:4,arms:4,legs:4,accessories:7};
 for(const [kind,count] of Object.entries(counts)){
   const values=manifest.parts[kind];
   if(!Array.isArray(values)||values.length!==count||new Set(values).size!==count||
      !values.every(isId))throw new Error('Invalid alien '+kind+' catalogue.');
 }
 if(manifest.parts.accessories[0]!=='none')throw new Error('Alien accessory none must be first.');
 if(!exactKeys(manifest.parts,ALIEN_COLLECTIONS)||
    !exactKeys(manifest.accessoryLayers,manifest.parts.accessories))
   throw new Error('Unexpected alien catalogue/layer fields.');
 for(const [id,layer] of Object.entries(manifest.accessoryLayers)){
   if(!['rear','front','none'].includes(layer)||(id==='none')!==(layer==='none'))
    throw new Error('Invalid alien accessory layer.');
 }
 if(!exactKeys(manifest.colourRoles,ALIEN_PART_FIELDS))
   throw new Error('Invalid alien colour role categories.');
 for(const [field,role] of Object.entries(COLOUR_ROLE)){
   if(manifest.colourRoles[field]!==role)throw new Error('Unexpected alien palette role.');
 }
 if(JSON.stringify(manifest.colorTokens)!==
    JSON.stringify(['primary','light','dark','belly','accent','spot','blush']))
   throw new Error('Invalid colour token contract.');
 const colours=Object.entries(manifest.palettes);
 if(colours.length!==6||!colours.every(([id,slots])=>
   isId(id)&&exactKeys(slots,manifest.colorTokens)&&
   manifest.colorTokens.every(key=>typeof slots[key]==='string'&&HEX.test(slots[key]))))
   throw new Error('Invalid alien colour palettes.');
 if(!exactKeys(manifest.presets,['bloop','orbit','niblet','glimmer'])||
    !Object.values(manifest.presets).every(value=>{
     try{return !!validateAlienPayload(value,manifest);}catch{return false;}
    }))
   throw new Error('Invalid alien starter presets.');
 if(manifest.allowAllCombinations!==true)
   throw new Error('Pass A1 requires universally compatible parts.');
 return manifest;
}
/** Tolerant browser input: retain independently valid choices, otherwise reset.
 * Never accepts unknown part IDs, palette strings or extraneous fields.
 */
export function normaliseAlien(value,manifest){
 const result=defaultAlien();
 if(!value||typeof value!=='object'||Array.isArray(value)||
    value.version!==ALIEN_VERSION)return result;
 for(const field of ALIEN_PART_FIELDS){
   if(isAllowedAlienPart(manifest,field,value[field]))result[field]=value[field];
 }
 const colours=value.colours&&typeof value.colours==='object'&&!Array.isArray(value.colours)
  ?value.colours:{};
 for(const field of ALIEN_COLOUR_FIELDS){
   if(isId(colours[field])&&Object.hasOwn(manifest.palettes,colours[field]))
    result.colours[field]=colours[field];
 }
 return result;
}
/** Strict server-side allowlist: malformed/noncanonical records are rejected,
 * not repaired silently. Never trust raw SVG, arbitrary CSS or image URLs.
 */
export function validateAlienPayload(value,manifest){
 if(!exactKeys(value,KEYS)||value.version!==ALIEN_VERSION||
    !exactKeys(value.colours,ALIEN_COLOUR_FIELDS))throw new Error('Malformed alien configuration.');
 for(const field of ALIEN_PART_FIELDS){
   if(!isAllowedAlienPart(manifest,field,value[field]))
    throw new Error('Unknown alien '+field+' part.');
 }
 for(const field of ALIEN_COLOUR_FIELDS){
   if(!isId(value.colours[field])||!Object.hasOwn(manifest.palettes,value.colours[field]))
    throw new Error('Unknown alien '+field+' palette.');
 }
 return normaliseAlien(value,manifest);
}
export function serializeAlien(value,manifest){
 return JSON.stringify(validateAlienPayload(value,manifest));
}
export function parseStoredAlien(text,manifest){
 if(typeof text!=='string'||text.length>1024)return defaultAlien();
 try{return normaliseAlien(JSON.parse(text),manifest);}catch{return defaultAlien();}
}
const pick=(list,rng)=>{
 const n=Number(rng()),safe=Number.isFinite(n)?Math.max(0,Math.min(0.999999999999,n)):0;
 return list[Math.floor(safe*list.length)];
};
export function randomAlien(manifest,previous=null,rng=Math.random){
 const alien=defaultAlien();
 for(const field of ALIEN_PART_FIELDS)alien[field]=pick(manifest.parts[COLLECT[field]],rng);
 for(const field of ALIEN_COLOUR_FIELDS)alien.colours[field]=pick(Object.keys(manifest.palettes),rng);
 if(previous&&serializeAlien(normaliseAlien(previous,manifest),manifest)===
    serializeAlien(alien,manifest)){
   const choices=manifest.parts.heads;
   alien.head=choices[(choices.indexOf(alien.head)+1)%choices.length];
 }
 return alien;
}
export function presetAlien(manifest,id){
 if(!isId(id)||!Object.hasOwn(manifest.presets,id))throw new Error('Unknown alien preset.');
 return validateAlienPayload(manifest.presets[id],manifest);
}
export function alienAssetPath(collection,id,manifest){
 if(!ALIEN_COLLECTIONS.includes(collection)||collection==='accessories'&&id==='none'||
    !isId(id)||!manifest.parts[collection].includes(id))
  throw new Error('Unknown alien SVG asset.');
 return 'assets/aliens/'+collection+'/'+id+'.svg';
}
export function alienLayers(value,manifest){
 const alien=validateAlienPayload(value,manifest);
 const accessory=alien.accessory;
 const placement=manifest.accessoryLayers[accessory];
 const layers=[];
 if(placement==='rear')layers.push({layer:'rear-accessory',collection:'accessories',
   id:accessory,colourRole:COLOUR_ROLE.accessory});
 for(const field of ['legs','arms','body','head','eyes','mouth']){
   layers.push({layer:field,collection:COLLECT[field],id:alien[field],
     colourRole:COLOUR_ROLE[field]});
 }
 if(placement==='front')layers.push({layer:'front-accessory',collection:'accessories',
   id:accessory,colourRole:COLOUR_ROLE.accessory});
 return layers.map(layer=>({
  ...layer,paletteId:layer.colourRole?alien.colours[layer.colourRole]:null,
  path:alienAssetPath(layer.collection,layer.id,manifest)
 }));
}
export function alienDescription(value,manifest){
 const a=validateAlienPayload(value,manifest);
 const name=s=>s.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
 return name(a.head)+'-headed alien with '+name(a.eyes).toLowerCase()+
  ' eyes, '+name(a.mouth).toLowerCase()+' mouth, '+name(a.body).toLowerCase()+
  ' body and '+name(a.legs).toLowerCase()+' movement';
}
