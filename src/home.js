import {TILE_SETS,TILE_SET_BY_ID,TILE_SET_STORAGE_KEY,normalizeTileSet} from './tile-sets.js';
const kitFromStore=()=>{
 try{return normalizeTileSet(localStorage.getItem(TILE_SET_STORAGE_KEY));}
 catch{return 'natural';}
};
let selectedKit=kitFromStore();
function applyKit(id){
 selectedKit=normalizeTileSet(id);
 try{localStorage.setItem(TILE_SET_STORAGE_KEY,selectedKit);}catch{/* ephemeral choice */}
 document.querySelectorAll('[data-tile-kit]').forEach(node=>{
   const active=node.dataset.tileKit===selectedKit;
   node.classList.toggle('is-selected',active);
   node.setAttribute('aria-pressed',String(active));
 });
 const online=document.getElementById('home-online');
  if(online)online.href='./online.html?tiles='+selectedKit;
  const kit=TILE_SET_BY_ID[selectedKit];
 document.getElementById('tile-kit-active').textContent=kit.short.toUpperCase()+' ACTIVE';
 for(const mode of ['sector','rogue','local']){
   const card=document.getElementById('home-'+mode);
   if(card)card.href='./play.html?mode='+mode+'&tiles='+selectedKit;
 }
}
for(const node of document.querySelectorAll('[data-tile-kit]'))
 node.addEventListener('click',()=>applyKit(node.dataset.tileKit));
applyKit(selectedKit);

// The home screen is deliberately static and free of Worker requests.
// It only reads the existing local save keys to label the navigation cards.
const SAVES={
 sector:'equa-nova.sector-run.v1',
 rogue:'equa-nova.drift.v1',
 local:'equa-nova.local-match.v1',
 online:'equa-nova.online-room.v1'
};
const labels={
 sector:'START MISSION',
 rogue:'BEGIN THE DRIFT',
 local:'SET UP A MATCH',
 online:'CREATE OR JOIN'
};
function readSave(key){
 try{
  const value=window.localStorage.getItem(key);
  if(!value)return null;
  const parsed=JSON.parse(value);
  return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:null;
 }catch{return null;}
}
const stateElements=document.querySelectorAll('[data-save]');
for(const node of stateElements){
 const mode=node.dataset.save;
 const value=readSave(SAVES[mode]);
 let description=labels[mode];
 if(value){
  if((mode==='sector'||mode==='rogue')&&Number.isInteger(value.sector)&&value.sector>=1){
   description=value.phase==='playing'?'CONTINUE · SECTOR '+String(value.sector).padStart(2,'0'):'REVIEW · SECTOR '+String(value.sector).padStart(2,'0');
  }else if(mode==='local'&&Array.isArray(value.players)&&value.players.length>=2){
   description=value.phase==='finished'?'VIEW FINAL SCORES':'RESUME LOCAL MATCH';
  }else if(mode==='online'&&/^[A-Z2-9]{6}$/.test(value.code||'')&&typeof value.token==='string'){
   description='RECONNECT TO ROOM';
  }
 }
 node.textContent=description;
}
