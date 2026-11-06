import {loadAlienLibrary,renderAlienSVG} from './renderer.js';
import {defaultAlien,presetAlien,ALIEN_PART_FIELDS} from './model.js';
const $=id=>document.getElementById(id);
const title=s=>s.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
function card(avatar,library,{name,label,size=178,kind='preview'}={}){
 const wrapper=document.createElement('article');
 wrapper.className=kind==='preset'?'specimen-card':'part-card';
 const canvas=document.createElement('div');
 canvas.className='alien-stage';
 canvas.append(renderAlienSVG(avatar,library,{width:size,height:size*360/320}));
 const labelNode=document.createElement('span');
 labelNode.className='alien-name';
 labelNode.textContent=name;
 const sub=document.createElement('span');
 sub.className='alien-detail';
 sub.textContent=label;
 wrapper.append(canvas,labelNode,sub);
 return wrapper;
}
async function start(){
 const library=await loadAlienLibrary('./'); // relative to gallery document, including GitHub Pages subpaths
 const {manifest}=library;
 $('hero-alien').append(renderAlienSVG(presetAlien(manifest,'bloop'),library,
  {width:290,height:326}));
 for(const [id,preset] of Object.entries(manifest.presets)){
   $('presets').append(card(preset,library,{
     name:title(id),label:title(preset.head)+' · '+title(preset.body)+' · '+title(preset.legs),
     size:188,kind:'preset'
   }));
 }
 for(const n of [48,64,96,240]){
   const cell=document.createElement('div');cell.className='size-item';
   const frame=document.createElement('div');frame.className='size-frame';
   frame.append(renderAlienSVG(manifest.presets.bloop,library,{width:n,height:n*360/320}));
   const label=document.createElement('strong');label.textContent=n+'px';
   const note=document.createElement('span');
   note.textContent=n===48?'Scoreboard':n===64?'Turn marker':n===96?'Lobby':'Full preview';
   cell.append(frame,label,note);$('small-preview').append(cell);
 }
 for(const field of ALIEN_PART_FIELDS){
   const collection=field==='head'?'heads':field==='mouth'?'mouths':
      field==='body'?'bodies':field==='accessory'?'accessories':field;
   const heading=document.createElement('div');heading.className='parts-heading';
   const h=document.createElement('h3');h.textContent=title(field);
   const small=document.createElement('span');
   small.textContent=manifest.parts[collection].length+' parts';
   heading.append(h,small);
   const grid=document.createElement('div');grid.className='part-grid';
   for(const id of manifest.parts[collection]){
     const avatar={...defaultAlien(),[field]:id};
     grid.append(card(avatar,library,{name:title(id),label:field,size:136}));
   }
   const section=document.createElement('section');
   section.className='category-section';
   section.dataset.category=field;
   section.append(heading,grid);
   $('part-galleries').append(section);
 }
 $('gallery-status').textContent='LIBRARY VERIFIED · '+library.parts.size+' ORIGINAL SVG ASSETS · '+Object.keys(manifest.presets).length+' PILOTS';
 $('gallery-status').dataset.status='ready';
}
start().catch(err=>{
 $('gallery-status').textContent='Unable to display alien artwork: '+err.message;
 $('gallery-status').dataset.status='error';
});
