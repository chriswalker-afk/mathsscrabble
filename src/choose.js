import {TILE_SETS,TILE_SET_BY_ID,TILE_SET_STORAGE_KEY,normalizeTileSet} from './tile-sets.js';
import {PILOT_PRESET_NAMES,defaultPilotAlien} from './alien/profiles.js';
import {paintPilotAvatar,loadPilotArtwork} from './alien/badges.js';
import {ensureActivePilot} from './achievements/auto-pilot.js';
import {loadPilots} from './achievements/pilots.js';
export const LAUNCH_KEY='equa-nova.pending-launch.v1';
const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const storage=(()=>{try{return localStorage;}catch{return null;}})();
const saved=ensureActivePilot(storage);
const current=loadPilots(storage).registry.pilots.find(p=>p.id===saved.pilotId);
const modeLists={
 single:[{id:'sector',title:'SECTOR RUN',subtitle:'Quick match',description:'Reach an energy target in six turns.',symbol:'⚡'},
         {id:'rogue',title:'THE DRIFT',subtitle:'Campaign',description:'Collect upgrades and survive boss sectors.',symbol:'✦'}],
 multi:[{id:'local',title:'PASS AND PLAY',description:'Share one device; keep your rack hidden.',symbol:'⟐'},
        {id:'host',title:'HOST A ROOM',description:'Create a room for players on other devices.',symbol:'⌁'},
        {id:'join',title:'JOIN A ROOM',description:'Enter your friend’s six-character code.',symbol:'✧'}]
};
const state={
 type:params.get('type')==='multi'?'multi':'single',
 mode:params.get('type')==='multi'?'local':'sector',
 kit:normalizeTileSet(storage?.getItem(TILE_SET_STORAGE_KEY)),
 count:2,turn:0,
 names:[current?.name||'Pilot 1','Pilot 2','Pilot 3','Pilot 4'],
 avatars:['bloop','orbit','niblet','glimmer']
};
const element=(tag,cls,text)=>{
 const node=document.createElement(tag);
 if(cls)node.className=cls;
 if(text!==undefined)node.textContent=text;
 return node;
};
function renderModes(){
 const parent=$('mode-options');parent.replaceChildren();
 const modes=modeLists[state.type];parent.dataset.count=String(modes.length);
 for(const item of modes){
  const node=element('button','mode-option');node.type='button';
  node.dataset.mode=item.id;node.setAttribute('aria-pressed',String(state.mode===item.id));
  node.append(element('span','option-symbol',item.symbol),
   element('strong',null,item.title),
   element('small',null,(item.subtitle?item.subtitle+' · ':'')+item.description));
  node.addEventListener('click',()=>{state.mode=item.id;render();});
  parent.append(node);
 }
}
function renderKits(){
 const box=$('kit-options');box.replaceChildren();
 for(const kit of TILE_SETS){
  const node=element('button','kit-option');node.type='button';
  node.dataset.tileKit=kit.id;
  node.setAttribute('aria-pressed',String(kit.id===state.kit));
  node.append(element('strong',null,kit.tier+' · '+kit.short.toUpperCase()),
   element('span','kit-example',kit.sample),element('small',null,kit.title));
  node.addEventListener('click',()=>{
   state.kit=kit.id;
   try{storage?.setItem(TILE_SET_STORAGE_KEY,kit.id);}catch{}
   renderKits();describeKit();
  });
  box.append(node);
 }
 describeKit();
}
function describeKit(){
 $('kit-description').textContent=TILE_SET_BY_ID[state.kit].desc+
  (state.mode==='host'?' Everyone in your room uses the same tile set.':'');
}
function renderPilotRows(){
 const rows=$('pilot-rows');rows.replaceChildren();
 const size=state.mode==='local'?state.count:1;
 for(let i=0;i<size;i++){
  const row=element('div','pilot-row');row.dataset.seat=String(i);
  row.append(element('strong','seat-num',state.mode==='local'?'PILOT '+(i+1):'YOUR PILOT'));
  const nameLabel=element('label',null,'DISPLAY NAME');
  const name=element('input','pilot-name');name.type='text';name.maxLength=20;
  name.required=true;name.autocomplete=i===0?'nickname':'off';
  name.value=state.names[i];name.addEventListener('input',()=>state.names[i]=name.value);
  nameLabel.append(name);
  const avatarLabel=element('label',null,'ALIEN AVATAR');
  const alienSelect=element('select','pilot-avatar');
  for(const [index,value] of PILOT_PRESET_NAMES.entries()){
   const option=document.createElement('option');option.value=value;
   option.textContent=value.charAt(0).toUpperCase()+value.slice(1);
   alienSelect.append(option);
  }
  alienSelect.value=state.avatars[i];
  const preview=element('span','pilot-preview');
  const paint=()=>{
   paintPilotAvatar(preview,defaultPilotAlien(PILOT_PRESET_NAMES.indexOf(state.avatars[i])),i,{size:40,framing:'portrait'});
  };
  alienSelect.addEventListener('change',()=>{state.avatars[i]=alienSelect.value;paint();});
  avatarLabel.append(alienSelect,preview);
  row.append(nameLabel,avatarLabel);rows.append(row);
  void loadPilotArtwork().then(paint);
 }
}
function render(){
 document.querySelectorAll('#setup-tabs [data-type]').forEach(button=>
  button.setAttribute('aria-pressed',String(button.dataset.type===state.type)));
 $('setup-title').textContent=state.type==='single'?'Choose your solo mission':'Choose your multiplayer match';
 $('setup-intro').textContent=state.type==='single'?
  'Pick a mode and tile set, then start playing.':'Choose where you’ll play, then set up your match.';
 $('setup-eyebrow').textContent=state.type==='single'?'SINGLE PLAYER':'MULTIPLAYER';
 renderModes();
 const join=state.mode==='join',single=state.type==='single',local=state.mode==='local',host=state.mode==='host';
 $('kit-section').hidden=join;
 $('details-section').hidden=single;
 $('count-field').hidden=join;
 $('turn-field').hidden=join;
 $('game-field').hidden=join;
 $('room-code-field').hidden=!join;
 $('setup-count').value=String(state.count);
 $('setup-turn').value=String(state.turn);
 $('pilot-settings').hidden=single;
 $('match-note').textContent=local?'Pass the device between players. Each player gets a private rack and saved achievements.':
  host?'Share the room code with your friends. Everyone chooses their own alien when joining.':
  'Ask the host for their room code. The host chooses the number of players, tile set and timer.';
 $('launch-button').textContent=single?'START '+(state.mode==='sector'?'SECTOR RUN':'THE DRIFT')+' ↗':
  local?'START PASS AND PLAY ↗':host?'CREATE ROOM ↗':'JOIN ROOM ↗';
 renderKits();
 if(!single)renderPilotRows();
}
for(const button of document.querySelectorAll('[data-type]'))
 button.addEventListener('click',()=>{
  state.type=button.dataset.type;
  state.mode=state.type==='single'?'sector':'local';
  history.replaceState(null,'','?type='+state.type);
  render();
 });
$('setup-count').addEventListener('change',()=>{state.count=Number($('setup-count').value);renderPilotRows();});
$('setup-turn').addEventListener('change',()=>{state.turn=Number($('setup-turn').value);});
$('setup-error').hidden=true;
if(!saved.pilotId)$('save-message').textContent='Local achievement storage is unavailable; matches can still be played.';
$('launch-form').addEventListener('submit',event=>{
 event.preventDefault();$('setup-error').hidden=true;
 const fail=message=>{const error=$('setup-error');error.textContent=message;error.hidden=false;error.focus();};
 try{
  const tileSet=state.kit;
  if(state.type==='single'){
   location.assign('./play.html?mode='+state.mode+'&tiles='+tileSet);
   return;
  }
  const count=state.mode==='local'?state.count:1;
  const names=state.names.slice(0,count).map(s=>s.trim());
  if(names.some(n=>!n||n.length>20))return fail('Each pilot needs a name of 1–20 characters.');
  if(new Set(names.map(s=>s.toLowerCase())).size!==names.length)return fail('Use a different name for each pilot.');
  const code=$('setup-code').value.trim().toUpperCase();
  if(state.mode==='join'&&!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(code))
   return fail('Enter the six characters in the room code.');
  const launch={version:1,mode:state.mode,tileSet,turnSeconds:state.turn,maxPlayers:state.count,
   names,avatars:state.avatars.slice(0,count).map(id=>defaultPilotAlien(PILOT_PRESET_NAMES.indexOf(id))),
   ...(state.mode==='join'?{code}:{})};
  sessionStorage.setItem(LAUNCH_KEY,JSON.stringify(launch));
  location.assign(state.mode==='local'?'./play.html?mode=local&tiles='+tileSet+'&setup=ready':
   './online.html?setup='+state.mode+(state.mode==='host'?'&tiles='+tileSet:''));
 }catch(err){fail(err?.message||'Your browser could not prepare the game.');}
});
render();
