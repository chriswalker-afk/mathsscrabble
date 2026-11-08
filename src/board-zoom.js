// Keep board navigation independent of the board's overall screen footprint.
// By default, the entire 19 x 19 grid fills its square viewport. Zooming is
// intentional and may then overflow the viewport for independent panning.
import {SIZE,CENTER} from './engine.js';
const DEFAULT_CELL=34,MIN_CELL=12,MAX_CELL=128,STEP=5,GAP=2,PAD=6,FIT_CLEARANCE=2;

// Text must shrink alongside the physical grid cell. CSS calc() multiplication
// is not consistently supported by mobile Safari, and a 10px font floor can
// clip signed numbers or stacked fractions inside a fitted 12-17px cell.
// Store already-calculated px lengths instead of asking CSS to multiply lengths.
export function boardGlyphSizes(cell){
 const px=ratio=>(Math.round(cell*ratio*100)/100)+'px';
 return {
  '--board-glyph-size':px(.70),
  '--board-signed-size':px(.46),
  '--board-fraction-size':px(.43),
  '--board-bonus-size':px(.46),
  '--board-start-size':px(.62),
  '--board-frac-rule-size':px(.08),
  '--board-frac-gap-size':px(.02)
 };
}

export function fittedCellSize(width,height){
 const side=Math.min(width,height);
 if(side<=0)return DEFAULT_CELL; // Hidden/awaiting layout: retry on resize.
 const available=(side-PAD-GAP*(SIZE-1)-FIT_CLEARANCE)/SIZE;
 // Round DOWN to a CSS subpixel so all 19 cells and their gaps fit, without
 // the scrollbars which would otherwise leave an unwanted bottom/right gutter.
 return Math.max(MIN_CELL,Math.min(MAX_CELL,Math.floor(available*64)/64));
}

export function initBoardZoom(){
 const view=document.getElementById('board-viewport'),board=document.getElementById('board');
 if(!view||!board)return null;
 let cell=DEFAULT_CELL,autoFit=true;
 const output=document.getElementById('board-zoom-level');
 const fitSize=()=>fittedCellSize(view.clientWidth,view.clientHeight);
 const setCell=(next,{anchorX=view.clientWidth/2,anchorY=view.clientHeight/2}={})=>{
   const size=Math.max(MIN_CELL,Math.min(MAX_CELL,Math.round(next*64)/64));
   const ratio=(size+GAP)/(cell+GAP);
   const oldX=view.scrollLeft+anchorX,oldY=view.scrollTop+anchorY;
   cell=size;board.style.setProperty('--board-cell-size',size+'px');
   for(const [name,value] of Object.entries(boardGlyphSizes(size)))
    board.style.setProperty(name,value);
   view.scrollLeft=oldX*ratio-anchorX;view.scrollTop=oldY*ratio-anchorY;
   // 100% means the complete board fits, rather than a fixed 34px tile.
   if(output)output.value=Math.round(100*cell/fitSize())+'%';
 };
 const focus=(row=CENTER,col=CENTER)=>{
   const step=cell+GAP;
   view.scrollLeft=Math.max(0,(col+.5)*step-view.clientWidth/2);
   view.scrollTop=Math.max(0,(row+.5)*step-view.clientHeight/2);
 };
 const fit=()=>{
   // Do not overwrite a valid scale if the board is temporarily hidden.
   if(!view.clientWidth||!view.clientHeight)return;
   setCell(fitSize());focus();
 };
 const zoom=change=>{
   setCell(cell+change);
   // Returning to exactly the fitted size restores responsive auto-fit.
   autoFit=Math.abs(cell-fitSize())<1/64;
   if(autoFit)focus();
 };
 const byId=id=>document.getElementById(id);
 byId('board-zoom-out')?.addEventListener('click',()=>zoom(-STEP));
 byId('board-zoom-in')?.addEventListener('click',()=>zoom(STEP));
 byId('board-zoom-fit')?.addEventListener('click',()=>{autoFit=true;fit();});
 byId('board-zoom-center')?.addEventListener('click',()=>focus());
 view.addEventListener('wheel',event=>{
   if(!event.ctrlKey&&!event.metaKey)return;
   event.preventDefault();
   const rect=view.getBoundingClientRect();
   autoFit=false;
   setCell(cell+(event.deltaY<0?STEP:-STEP),{
     anchorX:event.clientX-rect.left,anchorY:event.clientY-rect.top});
 },{passive:false});
 // Respond to actual viewport size, including orientation changes, split
 // windows and responsive panel rearrangements. Once someone zooms manually,
 // preserve their chosen close-up until they press FIT.
 const observer=new ResizeObserver(()=>{if(autoFit)fit();});
 observer.observe(view);
 fit();
 return {zoomIn:()=>zoom(STEP),zoomOut:()=>zoom(-STEP),centre:focus,fit:()=>{
   autoFit=true;fit();
 }};
}
