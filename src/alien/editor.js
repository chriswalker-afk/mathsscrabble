/* Alien Lab A2 — browser-only, local first creature creator.
 * The alien shape renderer is deterministic, the data model is allowlisted.
 * No account, remote API, avatar upload or existing match data is modified.
 */
import {loadAlienLibrary,renderAlienSVG,serializeAlienSVG,framingForPart} from './renderer.js';
import {FREE_ALIEN_OPTIONS,achievementForReward,isFreeAlienOption} from '../achievements/catalog.js';
import {ownsAlienOption} from '../achievements/engine.js';
import {loadPilots} from '../achievements/pilots.js';
import {loadAchievementStore} from '../achievements/storage.js';
import {
 ALIEN_COLOUR_FIELDS,ALIEN_PART_FIELDS,defaultAlien,randomAlien,presetAlien,
 serializeAlien,alienDescription
} from './model.js';
import {
 EDITOR_SECTIONS,PART_COLLECTIONS,makeEditHistory,pushEdit,undoEdit,redoEdit,
 updateAlienPart,updateAlienColour,loadSavedAlien,saveAlienToStorage
} from './editor-state.js';

const $=id=>document.getElementById(id);
const humanize=value=>value.replace(/-/g,' ').replace(/\b[a-z]/g,c=>c.toUpperCase());
const descriptions={
 head:'Choose your alien’s head',face:'Mix the eyes and mouth',
 body:'Give your alien a cosy middle',arms:'A little wave goes a long way',
 legs:'Walking, floating or wobbling',accessory:'One special touch',
 colours:'Three independent colour layers'
};
const roleLabels={skin:'SKIN · HEAD, ARMS & LEGS',
 outfit:'OUTFIT · BODY',
 accent:'ACCENTS · ACCESSORIES'};
const roleHelp={
 skin:'Head, arm and leg colours always match.',
 outfit:'Only the torso and clothing change.',
 accent:'Accessories change colour independently.'
};
const state={
 library:null,history:null,activeSection:'head',saved:null,storageState:'empty',
 lastNotice:'',noticeError:false,
 ready:false
};
const maybeStorage=()=>{
 try{return localStorage;}catch{return null;}
};
function notify(text,error=false){
 state.lastNotice=text;
 state.noticeError=error;
 const element=$('alien-status');
 element.textContent=text;
 element.classList.toggle('is-error',error);
}
const current=()=>state.history?.present;
function refreshEntitlements(){
 const pilots=loadPilots(maybeStorage());
 const awards=loadAchievementStore(maybeStorage(),pilots.registry);
 state.entitlements={pilots:pilots.registry,awards:awards.store};
}
function owns(collection,id){
 const e=state.entitlements;
 return !e||ownsAlienOption(e.awards,e.pilots.activeId,collection,id);
}
function labelReward(collection,id){
 const a=achievementForReward(collection,id);
 return a?`${a.title} · ${a.mode.toUpperCase()} · ${a.description}`:'Free for all pilots';
}
const configJSON=alien=>serializeAlien(alien,state.library.manifest);
const isDirty=()=>state.saved!==null&&configJSON(current())!==state.saved;
const isFresh=()=>state.saved===null;
function cryptoRandom(){
 if(globalThis.crypto?.getRandomValues){
   const bits=new Uint32Array(1);crypto.getRandomValues(bits);
   return bits[0]/4294967296;
 }
 return Math.random();
}
function makeButton({className,text,ariaLabel,pressed=false}={}){
 const button=document.createElement('button');
 button.type='button';button.className=className;
 if(text)button.textContent=text;
 if(ariaLabel)button.setAttribute('aria-label',ariaLabel);
 button.setAttribute('aria-pressed',String(pressed));
 return button;
}
function appendSVG(target,alien,{width=105,height=119,framing='full'}={}){
 const svg=renderAlienSVG(alien,state.library,{
   width,height,framing,accessible:false
 });
 target.append(svg);
 return svg;
}
const personalityFor=alien=>({
 orb:'GENTLE STARGAZER',
 pear:'CURIOUS COSMIC SPROUT',
 jelly:'SQUISHY LITTLE EXPLORER',
 facet:'BRAVE STAR PILOT'
})[alien.head]??'COSMIC EXPLORER';
/* decorated name below */
const personalityLabelFor=alien=>personalityFor(alien)+(alien.accessory==='companion'?' + ORBIT BUDDY':alien.legs==='hover'?' · FLOATING FREE':'');
function renderPresets(){
 const grid=$('starter-options');
 const fragment=document.createDocumentFragment();
 for(const [id,alien] of Object.entries(state.library.manifest.presets)){
   const chosen=configJSON(current())===configJSON(alien);
   const button=makeButton({
     className:'preset-button',ariaLabel:'Choose '+humanize(id)+' starter alien',pressed:chosen
   });
   button.dataset.preset=id;
   appendSVG(button,alien,{width:47,height:53,framing:'bust'});
   const caption=document.createElement('span');caption.textContent=humanize(id);
   button.append(caption);
   button.addEventListener('click',()=>usePreset(id));
   fragment.append(button);
 }
 grid.replaceChildren(fragment);
}
function renderPreview(animate=false){
 const alien=current();
 const art=$('alien-art');art.replaceChildren();
 const svg=renderAlienSVG(alien,state.library,{width:270,height:304});
 svg.classList.add(animate?'pop':'idle');
 if(animate)svg.addEventListener('animationend',()=>{
   svg.classList.remove('pop');svg.classList.add('idle');
 },{once:true});
 art.append(svg);
 art.setAttribute('aria-label','Full size preview: '+alienDescription(alien,state.library.manifest));
 $('alien-personality').textContent=personalityLabelFor(alien);
 $('tiny-avatar').replaceChildren(renderAlienSVG(alien,state.library,{
   width:48,height:48,accessible:false,framing:'portrait'
 }));
 $('lobby-avatar').replaceChildren(renderAlienSVG(alien,state.library,{
   width:72,height:72,accessible:false,framing:'bust'
 }));
 $('mobile-alien').replaceChildren(renderAlienSVG(alien,state.library,{
   width:60,height:60,accessible:false,framing:'portrait'
 }));
 renderPresets();
}
function sectionIndex(id){
 return EDITOR_SECTIONS.findIndex(section=>section.id===id);
}
function renderJourney(){
 const index=sectionIndex(state.activeSection);
 const total=EDITOR_SECTIONS.length;
 const previous=$('alien-prev-section'),next=$('alien-next-section');
 previous.disabled=index===0;
 next.disabled=false;
 const last=index===total-1;
 next.textContent=last?'GO TO SAVE →':'NEXT: '+EDITOR_SECTIONS[index+1].label+' →';
 next.setAttribute('aria-label',last?'Go to Save My Alien':
   'Next alien category: '+EDITOR_SECTIONS[index+1].label);
 $('alien-journey-label').textContent=
   EDITOR_SECTIONS[index].label+' · '+(index+1)+' OF '+total;
 const dots=document.createDocumentFragment();
 for(let i=0;i<total;i++){
   const dot=document.createElement('span');
   dot.className='journey-dot'+(i<=index?' done':'')+(i===index?' current':'');
   dots.append(dot);
 }
 $('alien-journey-dots').replaceChildren(dots);
}
function moveCategory(direction){
 const index=sectionIndex(state.activeSection);
 const next=index+direction;
 if(next<0||next>=EDITOR_SECTIONS.length){
   if(direction>0&&next===EDITOR_SECTIONS.length){
     const button=$('alien-save');
     button.scrollIntoView({block:'nearest',behavior:'auto'});
     button.focus({preventScroll:true});
     notify('Your alien is ready! Choose Save My Alien to keep this design.');
   }
   return;
 }
 switchSection(EDITOR_SECTIONS[next].id,true);
}

function renderTabs(){
 const fragment=document.createDocumentFragment();
 EDITOR_SECTIONS.forEach((section,i)=>{
   const chosen=section.id===state.activeSection;
   const button=document.createElement('button');
   button.type='button';button.className='section-tab';
   button.id='tab-'+section.id;button.setAttribute('role','tab');
   button.setAttribute('aria-selected',String(chosen));
   button.setAttribute('aria-controls','editor-options');
   button.tabIndex=chosen?0:-1;
   button.dataset.section=section.id;
   const small=document.createElement('span');small.textContent=String(i+1).padStart(2,'0');
   const label=document.createElement('strong');label.textContent=section.label;
   button.append(small,label);
   button.addEventListener('click',()=>switchSection(section.id));
   button.addEventListener('keydown',event=>{
     const arrow=event.key;
     let nextIndex;
     if(arrow==='ArrowRight')nextIndex=(i+1)%EDITOR_SECTIONS.length;
     else if(arrow==='ArrowLeft')nextIndex=(i+EDITOR_SECTIONS.length-1)%EDITOR_SECTIONS.length;
     else if(arrow==='Home')nextIndex=0;
     else if(arrow==='End')nextIndex=EDITOR_SECTIONS.length-1;
     else return;
     event.preventDefault();
     switchSection(EDITOR_SECTIONS[nextIndex].id,true);
   });
   fragment.append(button);
 });
 $('section-tabs').replaceChildren(fragment);
}
function switchSection(id,focusTab=false){
 if(!EDITOR_SECTIONS.some(section=>section.id===id))return;
 state.activeSection=id;
 renderTabs();
 const section=EDITOR_SECTIONS[sectionIndex(id)];
 $('current-section-number').textContent=String(sectionIndex(id)+1).padStart(2,'0')+
   ' / '+String(EDITOR_SECTIONS.length).padStart(2,'0');
 $('design-completeness').textContent=String(sectionIndex(id)+1)+' / '+EDITOR_SECTIONS.length;
 $('current-section-title').textContent=descriptions[id];
 $('current-section-hint').textContent=section.hint;
 $('editor-options').setAttribute('aria-labelledby','tab-'+id);
 renderJourney();
 $('editor-options').scrollTop=0;
 renderOptions();
 const tab=$('tab-'+id);
 tab.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'});
 if(focusTab)tab.focus({preventScroll:true});
}
function addPartGroup(parent,field){
 const group=document.createElement('section');group.className='option-group';
 group.dataset.field=field;
 const head=document.createElement('div');head.className='option-group-header';
 const label=document.createElement('h4');
 label.textContent=field==='eyes'?'EYES':field==='mouth'?'MOUTH':'CHOOSE '+humanize(field).toUpperCase();
 const caption=document.createElement('span');
 const available=state.library.manifest.parts[PART_COLLECTIONS[field]];
 caption.textContent=available.filter(id=>owns(PART_COLLECTIONS[field],id)).length+' AVAILABLE · '+available.length+' TOTAL';
 head.append(label,caption);
 const grid=document.createElement('div');grid.className='part-choices';
 for(const id of available){
   const selected=current()[field]===id;
   const entitled=owns(PART_COLLECTIONS[field],id);
   const button=makeButton({
     className:'part-choice'+(entitled?'':' is-locked'),
     ariaLabel:(entitled?'Choose ':'Preview locked ')+humanize(id)+' '+(field==='accessory'?'accessory':field),
     pressed:selected
   });
   button.dataset.field=field;button.dataset.option=id;
   const scene=document.createElement('div');scene.className='option-visual';
   const candidate=updateAlienPart(current(),state.library.manifest,field,id);
   appendSVG(scene,candidate,{
     width:105,height:119,
     framing:framingForPart(field,id)
   });
   const name=document.createElement('span');name.className='option-name';name.textContent=humanize(id);
   const tag=document.createElement('small');tag.className='reward-tag';
   tag.textContent=isFreeAlienOption(PART_COLLECTIONS[field],id)?'FREE':entitled?'EARNED':'LOCKED';
   button.append(scene,name,tag);
   if(!entitled){const hint=document.createElement('span');hint.className='reward-hint';hint.textContent=labelReward(PART_COLLECTIONS[field],id);button.append(hint);}
   button.addEventListener('click',()=>entitled?selectPart(field,id):previewLocked(field,id));
   grid.append(button);
 }
 group.append(head,grid);parent.append(group);
}
function addPaletteGroup(parent,role){
 const group=document.createElement('section');group.className='palette-group';
 group.dataset.paletteRole=role;
 const head=document.createElement('div');head.className='option-group-header';
 const label=document.createElement('h4');label.textContent=roleLabels[role];
 const count=document.createElement('span');count.textContent=Object.keys(state.library.manifest.palettes).filter(id=>owns('palettes',id)).length+' AVAILABLE';
 head.append(label,count);
 const grid=document.createElement('div');grid.className='palette-choices';
 for(const [id,palette] of Object.entries(state.library.manifest.palettes)){
   const chosen=current().colours[role]===id;
   const entitled=owns('palettes',id);
   const button=makeButton({
     className:'palette-choice'+(entitled?'':' is-locked'),
     ariaLabel:(entitled?'Apply ':'Preview locked ')+humanize(id)+' to '+role,
     pressed:chosen
   });
   button.dataset.colourRole=role;button.dataset.palette=id;
   const dot=document.createElement('span');dot.className='palette-dot';
   dot.style.background='linear-gradient(135deg,'+palette.light+' 0%,'+
     palette.primary+' 55%,'+palette.dark+' 100%)';
   const name=document.createElement('span');
   name.className='palette-name';name.textContent=humanize(id);
   const tag=document.createElement('small');tag.className='reward-tag';
   tag.textContent=isFreeAlienOption('palettes',id)?'FREE':entitled?'EARNED':'LOCKED';
   button.append(dot,name,tag);
   if(!entitled){const hint=document.createElement('span');hint.className='reward-hint';hint.textContent=labelReward('palettes',id);button.append(hint);}
   button.addEventListener('click',()=>entitled?selectColour(role,id):previewLockedColour(role,id));
   grid.append(button);
 }
 const description=document.createElement('p');description.className='palette-explanation';
 description.textContent=roleHelp[role];
 group.append(head,grid,description);parent.append(group);
}
function renderOptions(focusSelector=null,resetScroll=false){
 const section=EDITOR_SECTIONS[sectionIndex(state.activeSection)];
 const container=$('editor-options');
 const previousY=container.scrollTop;
 const fragment=document.createDocumentFragment();
 for(const field of section.fields){
   if(ALIEN_COLOUR_FIELDS.includes(field))addPaletteGroup(fragment,field);
   else if(ALIEN_PART_FIELDS.includes(field))addPartGroup(fragment,field);
 }
 container.replaceChildren(fragment);
 container.scrollTop=resetScroll?0:previousY;
 if(focusSelector){
   // Keep keyboard and click focus after rebuilding the cards.
   container.querySelector(focusSelector)?.focus({preventScroll:true});
 }
}
function updateSaveUI(){
 if(!state.ready)return;
 const saved=!isFresh()&&!isDirty();
 const label=$('save-state');
 label.classList.toggle('is-saved',saved);
 label.classList.toggle('is-dirty',isDirty());
 label.textContent=isFresh()?'NOT SAVED YET':saved?'✓ SAVED TO THIS DEVICE':'● UNSAVED CHANGES';
 $('save-description').textContent=isFresh()?
   'Save this alien in your browser, or export it as a transparent SVG.':
   saved?'This design is safely stored here. Changes are never saved until you choose.':
     'Your last saved alien is still there. Save again to keep these changes.';
 $('alien-load').disabled=isFresh();
 $('alien-undo').disabled=!state.history.past.length;
 $('alien-redo').disabled=!state.history.future.length;
}
function renderChange(next,{focusSelector=null,message='',animate=true}={}){
 const previous=state.history;
 state.history=pushEdit(previous,next,state.library.manifest);
 if(state.history===previous)return;
 renderPreview(animate);
 renderOptions(focusSelector);
 updateSaveUI();
 if(message)notify(message);
}
function previewLocked(field,id){
 const preview=updateAlienPart(current(),state.library.manifest,field,id);
 const art=$('alien-art');art.replaceChildren(renderAlienSVG(preview,state.library,{width:270,height:304}));
 notify('Preview only: '+labelReward(PART_COLLECTIONS[field],id)+' — earn it to save this part.');
}
function previewLockedColour(role,id){
 const preview=updateAlienColour(current(),state.library.manifest,role,id);
 $('alien-art').replaceChildren(renderAlienSVG(preview,state.library,{width:270,height:304}));
 notify('Preview only: '+labelReward('palettes',id)+' — earn it to save this colour.');
}
function selectPart(field,id){
 refreshEntitlements();
 if(!owns(PART_COLLECTIONS[field],id)){previewLocked(field,id);return;}
 const next=updateAlienPart(current(),state.library.manifest,field,id);
 const selector='[data-field="'+field+'"][data-option="'+id+'"]';
 renderChange(next,{focusSelector:selector,
   message:humanize(id)+' selected. Your alien is looking good!'});
}
function selectColour(role,palette){
 refreshEntitlements();
 if(!owns('palettes',palette)){previewLockedColour(role,palette);return;}
 const next=updateAlienColour(current(),state.library.manifest,role,palette);
 renderChange(next,{focusSelector:
   '[data-colour-role="'+role+'"][data-palette="'+palette+'"]',
   message:humanize(palette)+' '+role+' applied.'});
}
function usePreset(id){
 const alien=presetAlien(state.library.manifest,id);
 renderChange(alien,{
   message:humanize(id)+' has arrived! You can now customise every part.'
 });
}
function randomise(){
 refreshEntitlements();
 const manifest=state.library.manifest;
 const allowed={...manifest,parts:Object.fromEntries(Object.entries(manifest.parts).map(([kind,ids])=>[kind,ids.filter(id=>owns(kind,id))])),palettes:Object.fromEntries(Object.entries(manifest.palettes).filter(([id])=>owns('palettes',id)))};
 const next=randomAlien(allowed,current(),cryptoRandom);
 renderChange(next,{message:'A new little alien has arrived from deep space!'});
}
function reset(){
 renderChange(defaultAlien(),{message:'Back to the classic starting alien. Undo is available.'});
}
function performUndo(){
 if(!state.history.past.length)return;
 state.history=undoEdit(state.history);
 renderPreview(true);renderOptions();updateSaveUI();
 notify('Undid that change.');
}
function performRedo(){
 if(!state.history.future.length)return;
 state.history=redoEdit(state.history);
 renderPreview(true);renderOptions();updateSaveUI();
 notify('Redid that change.');
}
function save(){
 refreshEntitlements();
 for(const [field,collection] of Object.entries(PART_COLLECTIONS))if(!owns(collection,current()[field])){notify('Locked parts cannot be saved. Choose an earned or free part.',true);return;}
 for(const id of Object.values(current().colours))if(!owns('palettes',id)){notify('Locked colours cannot be saved.',true);return;}
 const successful=saveAlienToStorage(maybeStorage(),current(),state.library.manifest);
 if(!successful){notify('Unable to save on this device. You can still export an SVG file.',true);return;}
 state.saved=configJSON(current());
 updateSaveUI();notify('Saved! Your alien will still be here when you return.');
}
function loadSaved(){
 const loaded=loadSavedAlien(maybeStorage(),state.library.manifest);
 if(loaded.status!=='restored'){
   notify(loaded.status==='unavailable'?'Browser storage is unavailable. Export the SVG instead.':
     'No valid saved alien was found on this device.',true);
   return;
 }
 state.saved=configJSON(loaded.alien);
 state.history=pushEdit(state.history,loaded.alien,state.library.manifest);
 renderPreview(true);renderOptions();updateSaveUI();
 notify('Your saved alien is back!');
}
function exportSvg(){
 try{
   const text=serializeAlienSVG(current(),state.library);
   const url=URL.createObjectURL(new Blob([text],{type:'image/svg+xml;charset=utf-8'}));
   const a=document.createElement('a');a.href=url;a.download='equa-nova-my-alien.svg';
   document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),2000);
   notify('Transparent SVG exported. You can use this alien as your pilot image.');
 }catch(err){
   notify('Unable to export this alien: '+err.message,true);
 }
}
function refreshOwnedOptions(){
 if(!state.ready||!state.library)return;
 refreshEntitlements();
 renderOptions();
 updateSaveUI();
}
function bindButtons(){
 // Hangar may change pilot ownership while the editor stays open.
 window.addEventListener('pageshow',refreshOwnedOptions);
 window.addEventListener('focus',refreshOwnedOptions);
 document.addEventListener('visibilitychange',()=>{
  if(!document.hidden)refreshOwnedOptions();
 });
 window.addEventListener('storage',event=>{
  if(event.storageArea===maybeStorage())refreshOwnedOptions();
 });
 $('alien-prev-section').onclick=()=>moveCategory(-1);
 $('alien-next-section').onclick=()=>moveCategory(1);
 $('alien-undo').onclick=performUndo;
 $('alien-redo').onclick=performRedo;
 $('alien-reset').onclick=reset;
 $('alien-random').onclick=randomise;
 $('alien-load').onclick=loadSaved;
 $('alien-save').onclick=save;
 $('alien-export').onclick=exportSvg;
 document.addEventListener('keydown',event=>{
   if(!(event.ctrlKey||event.metaKey)||event.altKey||event.key.toLowerCase()!=='z')return;
   const target=event.target;
   if(target instanceof HTMLInputElement||target instanceof HTMLTextAreaElement||
     target?.isContentEditable||!state.ready)return;
   event.preventDefault();
   if(event.shiftKey)performRedo();
   else performUndo();
 });
}
function enableButtons(){
 state.ready=true;
 for(const id of ['alien-reset','alien-random','alien-save','alien-export'])$(id).disabled=false;
}
function startStatusMessage(loaded){
 if(loaded.status==='restored')return 'Welcome back! Your saved alien is ready to edit.';
 if(loaded.status==='invalid')return 'An invalid old save was ignored; a safe starter alien is ready.';
 if(loaded.status==='unavailable')return 'Browser storage is unavailable. You can still design and export your alien.';
 return 'Welcome to Alien Lab! Pick a part or choose a crew member to begin.';
}
async function boot(){
 try{
   state.library=await loadAlienLibrary('./');
   refreshEntitlements();
   const loaded=loadSavedAlien(maybeStorage(),state.library.manifest);
   state.storageState=loaded.status;
   state.history=makeEditHistory(loaded.alien,state.library.manifest);
   state.saved=loaded.status==='restored'?configJSON(loaded.alien):null;
   bindButtons();enableButtons();renderTabs();
   switchSection('head');
   renderPreview(false);
   updateSaveUI();
   notify(startStatusMessage(loaded),loaded.status==='invalid'||loaded.status==='unavailable');
   $('alien-app').dataset.ready='true';
 }catch(err){
   const container=$('editor-options');
   container.replaceChildren();
   const explanation=document.createElement('p');explanation.textContent=
     'The alien parts could not be loaded: '+err.message;
   const retry=document.createElement('button');retry.type='button';
   retry.className='action-button gold';retry.textContent='RETRY LOADING';
   retry.onclick=()=>location.reload();
   container.append(explanation,retry);
   notify('The creature laboratory could not start. Try reloading.',true);
   $('alien-app').dataset.ready='error';
 }
}
void boot();
