import {ensureActivePilot} from './achievements/auto-pilot.js';
const status=document.getElementById('home-save-status');
let saved={pilotId:null};
try{saved=ensureActivePilot(window.localStorage);}catch{/* Storage may be blocked. */}
if(status)status.textContent=saved.pilotId?
 '✦ Achievements save automatically for your pilot on this device.':
 '⚠ Local achievement saving unavailable. Check browser storage settings.';
const board=document.getElementById('mini-board');
const tiles=new Map([[10,'8'],[17,'+'],[24,'4'],[31,'='],[38,'1'],[45,'2']]);
for(let i=0;i<49;i++){
 const node=document.createElement('span');
 node.className='mini-cell'+(i===24?' star':'')+([8,16,32,40].includes(i)?' energy':'');
 if(tiles.has(i)){
  node.classList.add('piece');node.textContent=tiles.get(i);
  node.style.animationDelay=String(0.1+Array.from(tiles.keys()).indexOf(i)*.17)+'s';
 }
 board.append(node);
}
