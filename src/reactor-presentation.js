// Read-only reactor instrumentation. No score, turn, rack, or saved-game mutations.
const WARNINGS=new Set(['alignment','gap','centre','connect','locked']);
export function reactorDisplayPhase({preview,phase,swapping=false,ceremony=false}){
 if(ceremony)return {key:'transfer',label:'TRANSFERRING ENERGY'};
 if(phase==='won')return {key:'stable',label:'SECTOR STABILISED'};
 if(phase==='lost')return {key:'offline',label:'REACTOR STANDBY'};
 if(swapping)return {key:'exchange',label:'EXCHANGING TILES'};
 if(preview?.ready)return {key:'ready',label:'READY TO CHECK'};
 if(WARNINGS.has(preview?.status))return {key:'warning',label:'ADJUST PLACEMENT'};
 if(preview?.status==='building')return {key:'building',label:'BUILDING EQUATION'};
 return {key:'idle',label:'SELECT TILES'};
}
export function paintReactorIndicators({preview,phase,swapping,ceremony,mode,score,target}){
 const root=document.getElementById('app');
 const label=document.getElementById('reactor-phase-label');
 const gauge=document.getElementById('energy-progress');
 const display=reactorDisplayPhase({preview,phase,swapping,ceremony});
 if(root)root.dataset.reactorPhase=display.key;
 if(label)label.textContent=display.label;
 if(gauge&&mode!=='local'&&Number.isFinite(target)&&target>0){
   gauge.title=String(score)+' of '+String(target)+' sector energy';
 }
 if(!ceremony)paintReactorTransfer(0,1);
 return display;
}
export function paintReactorTransfer(awarded,total){
 const bar=document.getElementById('reactor-transfer-fill');
 if(!bar)return;
 const ratio=Number.isFinite(awarded)&&Number.isFinite(total)&&total>0?
   Math.max(0,Math.min(1,awarded/total)):0;
 bar.style.width=Math.round(ratio*100)+'%';
}
