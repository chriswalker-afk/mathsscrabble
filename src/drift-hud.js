import {ROGUE_ITEM_BY_ID,TEMP_ITEM_BY_ID,MAX_PERMANENT_SLOTS,MAX_TEMPORARY_SLOTS,
 heldConsumables,armedConsumable} from './rogue.js';
import {equipmentArt} from './equipment-art.js';

function slot(item,{temporary=false,armed=false,target=false,onClick}={}){
 const node=document.createElement('button');node.type='button';node.className='equipment-slot';
 node.dataset.equipmentId=item.id;node.dataset.kind=item.kind;
 node.classList.toggle('is-armed',temporary&&armed);
 node.classList.toggle('is-target',temporary&&target);
 node.setAttribute('aria-pressed',String(temporary&&(armed||target)));
 node.setAttribute('aria-label',(temporary?'Mission Gadget: ':'Installed Ship System: ')+
   item.name+'. '+item.description+(temporary&&armed?' Armed for next scored equation.':
   temporary&&target?' Select a rack tile to apply it.':''));
 node.title=item.name+' · '+item.kind+'\n'+item.description;
 const icon=document.createElement('span');icon.className='equip-artwork';icon.innerHTML=equipmentArt(item.id);
 const name=document.createElement('span');name.className='equip-name';name.textContent=item.name;
 node.append(icon,name);
 if(temporary&&(armed||target)){
   const status=document.createElement('span');status.className='equip-state';
   status.textContent=armed?'ARMED':'CHOOSE TILE';status.setAttribute('aria-hidden','true');
   node.append(status);
 }
 node.onclick=onClick;return node;
}
function emptySlot(kind,index){
 const node=document.createElement('button');node.type='button';node.disabled=true;
 node.className='equipment-slot is-empty';
 node.setAttribute('aria-label','Empty '+kind+' equipment slot '+(index+1));
 const icon=document.createElement('span');icon.className='equipment-slot-glyph';icon.textContent='＋';
 const name=document.createElement('span');name.className='equip-name';name.textContent='EMPTY SLOT';
 node.append(icon,name);return node;
}
export function renderDriftHud(rogue,itemTarget,onTemp,onInfo){
 const $=id=>document.getElementById(id);
 $('drift-temporary').hidden=!rogue;
 if(!rogue)return;
 const permanent=rogue.upgrades.map(id=>ROGUE_ITEM_BY_ID[id]).filter(Boolean);
 $('permanent-count').textContent=permanent.length+' / '+MAX_PERMANENT_SLOTS;
 $('permanent-slots').replaceChildren(...Array.from({length:MAX_PERMANENT_SLOTS},(_,i)=>
   permanent[i]?slot(permanent[i],{onClick:()=>onInfo(permanent[i])}):emptySlot('permanent',i)));
 const temporary=heldConsumables(rogue),armed=armedConsumable(rogue);
 $('temporary-count').textContent=temporary.length+' / '+MAX_TEMPORARY_SLOTS;
 $('temporary-slots').replaceChildren(...Array.from({length:MAX_TEMPORARY_SLOTS},(_,i)=>{
   const item=TEMP_ITEM_BY_ID[temporary[i]];
   return item?slot(item,{temporary:true,armed:armed===item.id&&item.action==='score',
     target:itemTarget===item.id,onClick:()=>onTemp(item.id)}):emptySlot('temporary',i);
 }));
 $('temporary-hint').textContent=itemTarget?
   'SELECT A RACK TILE for '+TEMP_ITEM_BY_ID[itemTarget].name+'. Tap again to cancel.':
   temporary.length?'Tap a Mission Gadget to arm it, or select a rack tile.':
   'Buy up to two Mission Gadgets in the Salvage Bay.';
}
