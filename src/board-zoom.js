// Keep board navigation independent of the board's overall screen footprint.
import {SIZE,CENTER} from './engine.js';
const DEFAULT_CELL=34,MIN_CELL=19,MAX_CELL=58,STEP=5,GAP=2,PAD=6;
export function initBoardZoom(){
 const view=document.getElementById('board-viewport'),board=document.getElementById('board');
 if(!view||!board)return null;
 let cell=DEFAULT_CELL;
 const output=document.getElementById('board-zoom-level');
 const fitSize=()=>Math.max(MIN_CELL,Math.min(MAX_CELL,
   Math.floor((Math.min(view.clientWidth,view.clientHeight)-PAD-GAP*(SIZE-1))/SIZE)));
 const setCell=(next,{anchorX=view.clientWidth/2,anchorY=view.clientHeight/2}={})=>{
   const size=Math.max(MIN_CELL,Math.min(MAX_CELL,Math.round(next)));
   const ratio=(size+GAP)/(cell+GAP);
   const oldX=view.scrollLeft+anchorX,oldY=view.scrollTop+anchorY;
   cell=size;board.style.setProperty('--board-cell-size',size+'px');
   view.scrollLeft=oldX*ratio-anchorX;view.scrollTop=oldY*ratio-anchorY;
   if(output)output.value=Math.round(100*size/DEFAULT_CELL)+'%';
 };
 const focus=(row=CENTER,col=CENTER)=>{
   const step=cell+GAP;
   view.scrollLeft=Math.max(0,(col+.5)*step-view.clientWidth/2);
   view.scrollTop=Math.max(0,(row+.5)*step-view.clientHeight/2);
 };
 const byId=id=>document.getElementById(id);
 byId('board-zoom-out')?.addEventListener('click',()=>setCell(cell-STEP));
 byId('board-zoom-in')?.addEventListener('click',()=>setCell(cell+STEP));
 byId('board-zoom-fit')?.addEventListener('click',()=>{setCell(fitSize());focus();});
 byId('board-zoom-center')?.addEventListener('click',()=>focus());
 view.addEventListener('wheel',event=>{
   if(!event.ctrlKey&&!event.metaKey)return;
   event.preventDefault();
   const rect=view.getBoundingClientRect();
   setCell(cell+(event.deltaY<0?STEP:-STEP),{
     anchorX:event.clientX-rect.left,anchorY:event.clientY-rect.top});
 },{passive:false});
 setCell(DEFAULT_CELL);focus();
 return {zoomIn:()=>setCell(cell+STEP),zoomOut:()=>setCell(cell-STEP),centre:focus};
}
