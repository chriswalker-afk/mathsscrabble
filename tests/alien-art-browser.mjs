/** Real Chromium SVG raster and seam audit of the original A1 artwork.
 * This tests actual alpha overlap, leg/head proportions, face containment,
 * transparent edges, correct palette application and tiny scoreboard previews.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1366,height:850},deviceScaleFactor:1});
const errors=[];page.on('pageerror',err=>errors.push(err.message));
try{
 await page.goto('http://127.0.0.1:4173/alien-preview.html',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>['ready','error'].includes(
   document.querySelector('#gallery-status')?.dataset.status),null,{timeout:18000});
 assert.equal(await page.locator('#gallery-status').getAttribute('data-status'),
   'ready',await page.locator('#gallery-status').textContent());
 assert.match(await page.locator('#gallery-status').textContent(),/30 ORIGINAL SVG ASSETS/);
 assert.equal(await page.locator('#presets .specimen-card').count(),4);
 assert.equal(await page.locator('.category-section').count(),7);
 assert.equal(await page.locator('.part-card').count(),31,'30 SVG pieces plus no accessory');
 assert.equal(await page.locator('.size-item').count(),4);
 await page.screenshot({path:'/tmp/equanova-alien-gallery.png',fullPage:true});

 const result=await page.evaluate(async()=>{
   const manifest=await (await fetch('./alien-manifest.json')).json();
   const r=await import('./src/alien/renderer.js');
   const m=await import('./src/alien/model.js');
   const categories=Object.entries(manifest.parts);
   const W=320,H=360;
   const mask=new Map(),alphaPixels=new Map();
   const alphaFor=async(collection,id)=>{
     const key=collection+'/'+id;
     if(mask.has(key))return mask.get(key);
     const img=new Image();
     img.src='./assets/aliens/'+collection+'/'+id+'.svg';
     await img.decode();
     const c=document.createElement('canvas');c.width=W;c.height=H;
     const ctx=c.getContext('2d',{willReadFrequently:true});
     ctx.clearRect(0,0,W,H);ctx.drawImage(img,0,0,W,H);
     const data=ctx.getImageData(0,0,W,H).data,values=new Uint8Array(W*H);
     for(let i=0;i<values.length;i++)values[i]=data[i*4+3];
     mask.set(key,values);
     return values;
   };
   const overlap=(a,b,[x1,y1,x2,y2])=>{
     let pixels=0;
     for(let y=y1;y<y2;y++)for(let x=x1;x<x2;x++){
       const i=y*W+x;
       if(a[i]>100&&b[i]>100)pixels++;
     }
     return pixels;
   };
   const within=(detail,base)=>{
     let visible=0,inside=0;
     for(let i=0;i<detail.length;i++)if(detail[i]>100){
       visible++;if(base[i]>100)inside++;
     }
     return inside/Math.max(1,visible);
   };
   let assetCount=0;
   const clip=[];
   for(const [kind,ids] of categories){
     for(const id of ids){
       if(kind==='accessories'&&id==='none')continue;
       const a=await alphaFor(kind,id);
       let count=0,minX=W,minY=H,maxX=0,maxY=0;
       for(let y=0;y<H;y++)for(let x=0;x<W;x++){
         const i=y*W+x;if(a[i]>12){
           count++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);
           minY=Math.min(minY,y);maxY=Math.max(maxY,y);
         }
       }
       if(count<40)throw Error('Blank SVG '+kind+'/'+id);
       clip.push({kind,id,count,minX,maxX,minY,maxY});
       assetCount++;
     }
   }
   const seams={headBody:[],leftArm:[],rightArm:[],bodyLegs:[],
       headEyes:[],headMouth:[],badgeBody:[]};
   for(const head of manifest.parts.heads){
     const h=await alphaFor('heads',head);
     for(const body of manifest.parts.bodies){
       const b=await alphaFor('bodies',body);
       seams.headBody.push({head,body,pixels:overlap(h,b,[128,141,192,184])});
     }
     for(const eyes of manifest.parts.eyes){
       const e=await alphaFor('eyes',eyes);
       seams.headEyes.push({head,eyes,coverage:within(e,h)});
     }
     for(const mouth of manifest.parts.mouths){
       const e=await alphaFor('mouths',mouth);
       seams.headMouth.push({head,mouth,coverage:within(e,h)});
     }
   }
   for(const body of manifest.parts.bodies){
     const b=await alphaFor('bodies',body);
     for(const arms of manifest.parts.arms){
       const a=await alphaFor('arms',arms);
       seams.leftArm.push({body,arms,pixels:overlap(b,a,[103,162,142,244])});
       seams.rightArm.push({body,arms,pixels:overlap(b,a,[178,162,218,244])});
     }
     for(const legs of manifest.parts.legs){
       const a=await alphaFor('legs',legs);
       seams.bodyLegs.push({body,legs,pixels:overlap(b,a,[112,240,208,295])});
     }
     const badge=await alphaFor('accessories','badge');
     seams.badgeBody.push({body,pixels:overlap(b,badge,[171,204,213,247])});
   }
   // Render every head/face pairing and every body/arm/leg pairing through
   // the same compositor that the future editor will use.
   const library=await r.loadAlienLibrary();
   let compositions=0;
   for(const head of manifest.parts.heads){
     for(const eyes of manifest.parts.eyes){
       for(const mouth of manifest.parts.mouths){
         const a={...m.defaultAlien(),head,eyes,mouth};
         const svg=r.renderAlienSVG(a,library,{width:64,height:72});
         if(svg.querySelectorAll('g[data-layer]').length!==7)
           throw Error('Missing SVG layers for '+head+'/'+eyes+'/'+mouth);
         compositions++;
       }
     }
   }
   for(const body of manifest.parts.bodies)
    for(const arms of manifest.parts.arms)
     for(const legs of manifest.parts.legs){
       const a={...m.defaultAlien(),body,arms,legs};
       const svg=r.renderAlienSVG(a,library,{width:48,height:54});
       if(svg.getAttribute('viewBox')!=='0 0 320 360')
        throw Error('Bad artboard');
       compositions++;
     }
   const small=[];
   for(const [id,avatar] of Object.entries(manifest.presets)){
     const root=r.renderAlienSVG(avatar,library,{width:48,height:54});
     const blob=new Blob([new XMLSerializer().serializeToString(root)],{type:'image/svg+xml'});
     const url=URL.createObjectURL(blob);const img=new Image();img.src=url;await img.decode();
     const canvas=document.createElement('canvas');canvas.width=48;canvas.height=54;
     const cx=canvas.getContext('2d',{willReadFrequently:true});
     cx.drawImage(img,0,0,48,54);
     URL.revokeObjectURL(url);
     const rgba=cx.getImageData(0,0,48,54).data;
     let occupied=0,opaque=0;const silhouette=[];
     for(let i=0;i<rgba.length;i+=4){
       if(rgba[i+3]>80){occupied++;silhouette.push((i/4)%48+','+Math.floor(i/4/48));}
       if(rgba[i+3]>240)opaque++;
     }
     small.push({id,occupied,opaque,hash:silhouette.join('|')});
   }
   const recolour=r.renderAlienSVG({
     ...m.defaultAlien(),colours:{skin:'coral',outfit:'aqua',accent:'cosmic-blue'}
   },library);
   const skinNode=recolour.querySelector('[data-layer="head"] [data-color-slot="primary"]');
   const outfitNode=recolour.querySelector('[data-layer="body"] [data-color-slot="primary"]');
   const accentNode=recolour.querySelector('[data-layer="rear-accessory"] [data-stroke-slot="primary"]');
   const chosen={skin:skinNode.getAttribute('fill'),outfit:outfitNode.getAttribute('fill'),
      accent:accentNode.getAttribute('stroke')};
   const exportText=r.serializeAlienSVG(manifest.presets.bloop,library);
   const rejected=[];
   const source=await (await fetch('./assets/aliens/heads/orb.svg')).text();
   for(const altered of [
      source.replace('<g ','<script>alert(1)</script><g '),
      source.replace('<g ','<g onclick="alert(1)" '),
      source.replace('viewBox="0 0 320 360"','viewBox="0 0 123 456"'),
      source.replace('data-part-id="orb"','data-part-id="../secret"'),
      source.replace('<g ','<foreignObject>unsafe</foreignObject><g ')
   ]){
     try{r.validateAlienSvg(altered,'heads','orb',manifest);rejected.push(false);}
     catch{rejected.push(true);}
   }
   return {assetCount,clip,seams,compositions,
      small,chosen,exportText:exportText.slice(0,500),exportLength:exportText.length,
      blocked:rejected};
 });
 assert.equal(result.assetCount,30);
 assert.equal(result.compositions,128);
 for(const item of result.clip){
   assert.ok(item.minX>2&&item.maxX<318&&item.minY>1&&item.maxY<357,
     'SVG canvas clipping '+JSON.stringify(item));
 }
 for(const entry of result.seams.headBody)
   assert.ok(entry.pixels>=120,'Disconnected head/body: '+JSON.stringify(entry));
 for(const entry of result.seams.leftArm)
   assert.ok(entry.pixels>=35,'Disconnected left arm: '+JSON.stringify(entry));
 for(const entry of result.seams.rightArm)
   assert.ok(entry.pixels>=35,'Disconnected right arm: '+JSON.stringify(entry));
 for(const entry of result.seams.bodyLegs)
   assert.ok(entry.pixels>=95,'Disconnected legs: '+JSON.stringify(entry));
 for(const entry of result.seams.headEyes)
   assert.ok(entry.coverage>=0.96,'Eyes escape head: '+JSON.stringify(entry));
 for(const entry of result.seams.headMouth)
   assert.ok(entry.coverage>=0.95,'Mouth escapes head: '+JSON.stringify(entry));
 for(const entry of result.seams.badgeBody)
   assert.ok(entry.pixels>=150,'Badge misplaced on body: '+JSON.stringify(entry));
 assert.equal(new Set(result.small.map(p=>p.hash)).size,4,
  'All four curated aliens need a distinct legible 48px silhouette');
 for(const item of result.small){
   assert.ok(item.occupied>250&&item.opaque>180,
     'Alien should remain visually legible in small scoreboard: '+JSON.stringify(item));
 }
 assert.deepEqual(result.chosen,{skin:'#f49a94',outfit:'#73c9e8',accent:'#7f94df'});
 assert.match(result.exportText,/<svg/);
 assert.ok(result.exportLength>1000);
 assert.ok(result.blocked.every(Boolean),'Injected SVG/URLs/metadata must all be rejected');
 for(const width of [320,390,768,1366]){
   await page.setViewportSize({width,height:850});
   const geometry=await page.evaluate(()=>({
    documentWidth:document.documentElement.scrollWidth,
    viewportWidth:window.innerWidth,
    presetRight:document.querySelector('#presets').getBoundingClientRect().right
   }));
   assert.ok(geometry.documentWidth<=geometry.viewportWidth+2,
      'No horizontal scrolling at '+width+': '+JSON.stringify(geometry));
   assert.ok(geometry.presetRight<=geometry.viewportWidth+2);
   if(width===390)await page.screenshot({path:'/tmp/equanova-alien-mobile.png',fullPage:true});
 }
 assert.deepEqual(errors,[]);
 console.log('Alien art browser passed: '+result.assetCount+' original SVGs, '+result.compositions+
 ' composed 64px examples, all pairwise face/shoulder/neck/hip joins, transparent edges, 48px readability, colour and SVG safety.');
}finally{await browser.close();}
