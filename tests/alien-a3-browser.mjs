/** Pass A3 visual review: readability, front-layer occlusion, palettes,
 * category journey, avatar crops, mobile controls and human review contact sheets.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const url='http://127.0.0.1:4173/alien-lab.html';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1366,height:768}});
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(url,{waitUntil:'networkidle'});
 await page.locator('#alien-app[data-ready="true"]').waitFor({timeout:15000});
 const viewboxes=await page.evaluate(()=>({
  large:document.querySelector('#alien-art svg')?.getAttribute('viewBox'),
  icon:document.querySelector('#tiny-avatar svg')?.getAttribute('viewBox'),
  lobby:document.querySelector('#lobby-avatar svg')?.getAttribute('viewBox'),
  mobile:document.querySelector('#mobile-alien svg')?.getAttribute('viewBox'),
  firstChoice:document.querySelector('.part-choice svg')?.getAttribute('viewBox')
 }));
 assert.deepEqual(viewboxes,{
  large:'0 0 320 360',icon:'52 3 216 216',lobby:'38 10 244 265',
  mobile:'52 3 216 216',firstChoice:'48 0 224 220'
 });
 assert.match(await page.locator('#alien-personality').textContent(),/GENTLE STARGAZER/);
 assert.equal(await page.locator('#alien-prev-section').isDisabled(),true);
 assert.match(await page.locator('#alien-journey-label').textContent(),/HEADS.*1 OF 7/);
 await page.locator('#alien-next-section').click();
 assert.equal(await page.locator('#tab-face').getAttribute('aria-selected'),'true');
 assert.equal(await page.locator('#editor-options .part-choice').count(),8);
 assert.equal(await page.locator('#editor-options .part-choice svg').first().getAttribute('viewBox'),
  '90 57 140 116');
 assert.equal(await page.locator('#alien-prev-section').isEnabled(),true);
 await page.locator('#alien-next-section').click();
 assert.equal(await page.locator('#tab-body').getAttribute('aria-selected'),'true');
 assert.equal(await page.locator('.part-choice svg').first().getAttribute('viewBox'),
   '63 130 194 176');
 await page.locator('#tab-arms').click();
 assert.equal(await page.locator('.part-choice svg').first().getAttribute('viewBox'),
   '23 112 274 174');
 await page.locator('#tab-legs').click();
 assert.equal(await page.locator('.part-choice svg').first().getAttribute('viewBox'),
   '27 218 266 128');
 await page.locator('#tab-accessory').click();
 assert.equal(await page.locator('.part-choice[data-option="companion"] svg').getAttribute('viewBox'),
   '137 54 175 158');
 assert.equal(await page.locator('.part-choice[data-option="badge"] svg').getAttribute('viewBox'),
   '85 179 153 118');
 await page.locator('#tab-colours').click();
 assert.match(await page.locator('#alien-next-section').textContent(),/GO TO SAVE/);
 assert.equal(await page.locator('#alien-next-section').isEnabled(),true);
 assert.equal(await page.evaluate(()=>localStorage.getItem('equa-nova.alien.v1')),null);
 await page.locator('#alien-next-section').click();
 assert.equal(await page.evaluate(()=>document.activeElement.id),'alien-save');
 assert.equal(await page.evaluate(()=>localStorage.getItem('equa-nova.alien.v1')),null,
  'Guided navigation must not silently overwrite an unsaved alien.');
 const blink=await page.locator('#alien-art [data-layer="eyes"]').evaluate(el=>
   getComputedStyle(el).animationName);
 assert.equal(blink,'alien-blink');
 await page.emulateMedia({reducedMotion:'reduce'});
 const noBlink=await page.locator('#alien-art [data-layer="eyes"]').evaluate(el=>
   getComputedStyle(el).animationName);
 assert.equal(noBlink,'none');
 await page.emulateMedia({reducedMotion:'no-preference'});

 const geometry=[];
 for(const [width,height] of [[1366,768],[1280,720],[1024,768],[768,1024],[390,844],[320,700]]){
  await page.setViewportSize({width,height});
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.waitForTimeout(100);
  const size=await page.evaluate(()=>({
   width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,
   pageHeight:document.documentElement.scrollHeight,
   preview:document.querySelector('.specimen-panel').getBoundingClientRect().toJSON(),
   workshop:document.querySelector('.workshop-panel').getBoundingClientRect().toJSON(),
   save:document.querySelector('#alien-save').getBoundingClientRect().toJSON(),
   journey:document.querySelector('.category-journey').getBoundingClientRect().toJSON(),
   nav:document.querySelector('#alien-next-section').getBoundingClientRect().toJSON(),
   tab:document.querySelector('#tab-colours').getBoundingClientRect().toJSON(),
   long:[...document.querySelectorAll('body *')].map(e=>({
     tag:e.tagName,id:e.id,cls:typeof e.className==='string'?e.className.slice(0,35):'',
     right:Math.round(e.getBoundingClientRect().right)
   })).filter(e=>e.right>innerWidth+3).slice(0,8)
  }));
  geometry.push({width,screen:size.scroll,workshopBottom:Math.round(size.workshop.bottom)});
  assert.ok(size.scroll<=width+2,'horizontal scrolling '+JSON.stringify(size));
  assert.ok(size.preview.right<=width+2&&size.workshop.right<=width+2,
   'panels must fit '+JSON.stringify(size));
  assert.ok(size.nav.width>=60&&size.nav.height>=30,'tiny next action '+JSON.stringify(size));
  if(width>=768){
   assert.ok(size.pageHeight<=height+6,
    'desktop creator must fit in one viewport: '+JSON.stringify(size));
   assert.ok(size.workshop.bottom<=height+5,
    'desktop workshop should not need a page scroll: '+JSON.stringify(size));
   assert.ok(size.save.bottom<=height+5,
    'save command must fit on desktop: '+JSON.stringify(size));
  }else{
   assert.ok(size.workshop.top>=size.preview.bottom-2,
    'mobile must stack rather than overlap: '+JSON.stringify(size));
  }
  if(width===390){
    await page.locator('#tab-head').click();
    await page.screenshot({path:'/tmp/equanova-alien-a3-mobile.png',fullPage:true});
  }
  if(width===1366){
    await page.locator('#tab-head').click();
    await page.screenshot({path:'/tmp/equanova-alien-a3-desktop.png',fullPage:true});
  }
 }
 await page.setViewportSize({width:1440,height:850});

 // A3: inspect the actual 48px portraits. Every eye and mouth choice must
 // produce a visually distinguishable raster, not merely a different ID.
 const metrics=await page.evaluate(async()=>{
  const {loadAlienLibrary,renderAlienSVG,framingForPart,ALIEN_FRAMINGS,serializeAlienSVG}=
   await import('./src/alien/renderer.js');
  const {defaultAlien,validateAlienPayload,presetAlien}=await import('./src/alien/model.js');
  const library=await loadAlienLibrary('./');
  const {manifest}=library;
  const ink='#26344e';
  function luminance(hex){
   const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255)
     .map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
   return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
  }
  function contrast(a,b){
   const v=[luminance(a),luminance(b)].sort((x,y)=>y-x);
   return (v[0]+.05)/(v[1]+.05);
  }
  const contrasts=Object.entries(manifest.palettes).map(([id,p])=>({
    id,primary:contrast(p.primary,ink),dark:contrast(p.dark,ink)
  }));
  const output={contrast:contrasts,distinctEye:[],distinctMouth:[],
    accessoryClobber:[],portraitPixels:[],framing:{...ALIEN_FRAMINGS},
    exportVersion:null};
  const canvas=document.createElement('canvas');
  canvas.width=48;canvas.height=48;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const sprite=async (alien,size=48,framing='portrait')=>{
    const svg=renderAlienSVG(alien,library,{width:size,height:size,framing,accessible:false});
    const blob=new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'});
    const objectUrl=URL.createObjectURL(blob);
    const img=new Image();img.src=objectUrl;
    try{await img.decode();}
    finally{URL.revokeObjectURL(objectUrl);}
    const surface=document.createElement('canvas');
    surface.width=size;surface.height=size;
    const context=surface.getContext('2d',{willReadFrequently:true});
    context.drawImage(img,0,0,size,size);
    return context.getImageData(0,0,size,size).data;
  };
  const compare=(a,b,[x1,y1,x2,y2],width=48)=>{
    let difference=0;
    for(let y=y1;y<y2;y++)for(let x=x1;x<x2;x++){
     const i=(y*width+x)*4;
     if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+
        Math.abs(a[i+2]-b[i+2])+Math.abs(a[i+3]-b[i+3])>50)
       difference++;
    }
    return difference;
  };
  const def=defaultAlien();
  for(const head of manifest.parts.heads){
    const eyes={};
    for(const eye of manifest.parts.eyes){
      eyes[eye]=await sprite({...def,head,eyes:eye});
    }
    const eyeNames=Object.keys(eyes);
    for(let i=0;i<eyeNames.length;i++)for(let j=i+1;j<eyeNames.length;j++){
     output.distinctEye.push({head,a:eyeNames[i],b:eyeNames[j],
       count:compare(eyes[eyeNames[i]],eyes[eyeNames[j]],[11,12,37,29])});
    }
    const mouths={};
    for(const mouth of manifest.parts.mouths){
      mouths[mouth]=await sprite({...def,head,mouth});
    }
    const mouthNames=Object.keys(mouths);
    for(let i=0;i<mouthNames.length;i++)for(let j=i+1;j<mouthNames.length;j++){
     output.distinctMouth.push({head,a:mouthNames[i],b:mouthNames[j],
       count:compare(mouths[mouthNames[i]],mouths[mouthNames[j]],[14,27,34,37])});
    }
    for(const accessory of ['helmet','badge','companion']){
     const unchanged=await sprite({...def,head,accessory:'none'},128,'full');
     const withExtra=await sprite({...def,head,accessory},128,'full');
     // Full 320x360 -> 128x128 squares (letterbox vertically), so
     // central eyes and mouth (y 72–155) project to approx x44–85/y27–56.
     // Helmet collar is BELOW the mouth and must not count as face occlusion.
     const occluded=compare(unchanged,withExtra,[44,27,85,56],128);
     output.accessoryClobber.push({head,accessory,occluded});
    }
  }
  for(const name of Object.keys(manifest.presets)){
    const img=await sprite(presetAlien(manifest,name));
    let opaque=0,uniqueColours=new Set();
    for(let i=0;i<img.length;i+=4){
     if(img[i+3]>180){
      opaque++;
      if((i/4)%3===0)uniqueColours.add([img[i],img[i+1],img[i+2]].join(','));
     }
    }
    output.portraitPixels.push({name,opaque,colours:uniqueColours.size});
  }
  output.exportVersion=renderAlienSVG(def,library).getAttribute('viewBox');
  // All thumbs must select a meaningful closeup; none and full-body are the
  // only intentionally uncropped options.
  output.parts=Object.entries(manifest.parts).flatMap(([collection,ids])=>
    ids.map(id=>({collection,id,focus:framingForPart(
      ({heads:'head',mouths:'mouth',bodies:'body',accessories:'accessory'})[collection]||collection,id)})));
  // Human-review contact sheets: the same assembled SVG renderer, no mock art.
  const gallery=document.createElement('div');
  gallery.id='a3-proof';
  gallery.style.cssText='position:relative;padding:18px;max-width:1400px;background:#112b3b;color:#e8f5ed;font:12px system-ui';
  document.body.append(gallery);
  const sheets=[];
  const startSheet=(id,title,columns=8)=>{
    const section=document.createElement('section');
    section.dataset.sheet=id;
    section.style.cssText='padding:14px;border:1px solid #5e8c86;margin:0 0 18px;background:#173d4c';
    const heading=document.createElement('h2');heading.textContent=title;
    heading.style.cssText='font:700 22px system-ui;color:#fbe2b3;margin:0 0 14px';
    const grid=document.createElement('div');grid.style.cssText=
      'display:grid;grid-template-columns:repeat('+columns+',1fr);gap:9px';
    section.append(heading,grid);gallery.append(section);
    sheets.push(id);
    return grid;
  };
  const addCard=(grid,alien,label,frame='full',size=105)=>{
    validateAlienPayload(alien,manifest);
    const item=document.createElement('article');item.style.cssText=
      'min-width:0;background:linear-gradient(#345e6d,#214252);border:1px solid #668d8a;border-radius:9px;padding:5px;display:flex;flex-direction:column;align-items:center;gap:5px';
    const art=document.createElement('div');art.style.cssText=
      'height:'+Math.max(60,size+10)+'px;display:grid;place-items:center;overflow:hidden';
    art.append(renderAlienSVG(alien,library,{width:size,height:size,framing:frame,accessible:false}));
    const caption=document.createElement('span');caption.textContent=label;
    caption.style.cssText='text-align:center;font:700 10px system-ui;color:#f4ead8;overflow-wrap:anywhere';
    item.append(art,caption);grid.append(item);
  };
  {
    const grid=startSheet('expressions','64 head / eye / mouth expressions — 48px portrait proof');
    for(const head of manifest.parts.heads)
      for(const eyes of manifest.parts.eyes)
       for(const mouth of manifest.parts.mouths)
        addCard(grid,{...def,head,eyes,mouth},
          head+' · '+eyes+' / '+mouth,'portrait',64);
  }
  {
    const grid=startSheet('anatomy','64 combinations — body, arms and movement');
    for(const body of manifest.parts.bodies)
      for(const arms of manifest.parts.arms)
       for(const legs of manifest.parts.legs)
        addCard(grid,{...def,body,arms,legs},
          body+' · '+arms+' / '+legs,'full',110);
  }
  {
    const grid=startSheet('accessories','42 accessory and accent pairings',7);
    for(const id of manifest.parts.accessories){
      for(const palette of Object.keys(manifest.palettes)){
       addCard(grid,{...def,accessory:id,colours:{...def.colours,accent:palette}},
         id+' · '+palette,framingForPart('accessory',id),106);
      }
    }
  }
  {
    const grid=startSheet('colourways','24 skin × head colourways',6);
    for(const skin of Object.keys(manifest.palettes)){
      for(const head of manifest.parts.heads)
       addCard(grid,{...def,head,colours:{...def.colours,skin}},skin+' · '+head,'bust',115);
    }
  }
  {
    const grid=startSheet('scoreboard','In-game portraits at 48px and lobby busts at 72px',4);
    for(const id of Object.keys(manifest.presets)){
      const avatar=presetAlien(manifest,id);
      addCard(grid,avatar,id+' / 48px','portrait',48);
      addCard(grid,avatar,id+' / 72px','bust',72);
    }
  }
  output.sheets=sheets;
  return output;
 });
 for(const palette of metrics.contrast){
   assert.ok(palette.primary>=4.5,
     'Main pastel against navy ink should meet 4.5:1 '+JSON.stringify(palette));
   assert.ok(palette.dark>=3,
     'Dark details should preserve at least 3:1 nontext contrast '+JSON.stringify(palette));
 }
 for(const row of metrics.distinctEye){
   assert.ok(row.count>=8,
    'At 48px these eye sets look too similar '+JSON.stringify(row));
 }
 for(const row of metrics.distinctMouth){
   assert.ok(row.count>=3,
    'At 48px these mouths look too similar '+JSON.stringify(row));
 }
 for(const row of metrics.accessoryClobber){
   assert.ok(row.occluded<=2,
    'Front accessory must not cover the facial expression '+JSON.stringify(row));
 }
 assert.equal(metrics.exportVersion,'0 0 320 360',
   'The full transparent SVG export must remain unaffected by portrait cropping.');
 for(const item of metrics.portraitPixels){
  assert.ok(item.opaque>=350&&item.colours>=8,
   'Small pilot portrait should remain detailed and nonblank '+JSON.stringify(item));
 }
 assert.equal(metrics.parts.length,67);
 assert.equal(metrics.sheets.length,5);
 for(const section of metrics.sheets){
   await page.locator('#a3-proof [data-sheet="'+section+'"]').screenshot({
     path:'/tmp/equanova-alien-a3-'+section+'.png',animations:'disabled'
   });
 }
 assert.deepEqual(errors,[]);
 console.log('Alien A3 review passed: guided categories, 48px portrait clarity, 6 accessible palettes, expression distinctions, 12 face/overlay pairs, 5 visual contact sheets and 6 responsive viewports.');
}finally{
 await context.close();await browser.close();
}
