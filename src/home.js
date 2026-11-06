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
