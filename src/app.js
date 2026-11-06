import {SIZE,CENTER,HAND_SIZE,TURNS_PER_SECTOR,pos,coords,bonusAt,makeTile,makeBag,refill,validateMove,inspectPlacement,scoreMove,nextTarget} from './engine.js';
import {enableTileDrag,wasDragClick} from './pointer-drag.js';
const $=id=>document.getElementById(id);
const state={
 board:Array(SIZE*SIZE).fill(null),pending:{},rack:[],bag:[],sector:1,score:0,turn:1,
 selected:null,swapping:false,swapSet:new Set(),ended:false,busy:false,
 focusedIndex:pos(CENTER,CENTER),placementOrder:[],recentlyPlaced:null,
 lockedFlash:new Set(),preview:null,modalEpoch:0
};
const names=['ORIGIN','POLARIS','THE OUTER RING','THE VOID','ION STORM','NEBULA','DARK MATTER','BEYOND'];
function announce(message,isError=false){
 $('log').textContent=message;
 $('log').classList.toggle('error',isError);
 $('footer-text').textContent=message.toUpperCase();
}
function freshSector(sector=1){
  state.modalEpoch++;
  state.board=Array(SIZE*SIZE).fill(null);state.pending={};state.sector=sector;
  state.turn=1;state.score=0;state.ended=false;state.busy=false;
  state.selected=null;state.swapping=false;state.swapSet.clear();
  state.placementOrder=[];state.lockedFlash.clear();state.recentlyPlaced=null;
  state.focusedIndex=pos(CENTER,CENTER);
  state.bag=makeBag();
  if(sector===1){
    const required=['8','+','4','1','2','3','×'];
    state.rack=required.map(v=>{
      const i=state.bag.findIndex(t=>t.value===v);
      return i>=0?state.bag.splice(i,1)[0]:makeTile(v);
    });
  }else{
    const draw=refill([],state.bag);state.rack=draw.rack;state.bag=draw.bag;
  }
  announce(sector===1?'Try 8 + 4 = 12 through the centre. Select tiles by tapping or dragging.':'New sector online. Build an equation through the centre.');
  $('board-frame').classList.remove('reactor-scored');
  render();
}
const valueAt=i=>state.pending[i]||state.board[i];
function selectTile(id){
 if(state.ended||state.swapping||state.busy)return;
 state.selected=state.selected===id?null:id;
 renderRack();
 renderBoard();
}
function placePayload(payload,index){
 if(state.ended||state.swapping||state.busy||!Number.isInteger(index)||index<0||index>=SIZE*SIZE)return;
 if(state.board[index]){announce('This tile is locked. Choose an empty square.',true);return;}
 if(payload.kind==='pending'){
   const from=payload.index;
   const moving=state.pending[from];
   if(!moving||from===index)return;
   const displaced=state.pending[index];
   delete state.pending[from];state.pending[index]=moving;
   if(displaced)state.pending[from]=displaced;
   state.placementOrder=state.placementOrder.filter(i=>i!==from&&i!==index);
   if(displaced)state.placementOrder.push(from);
   state.placementOrder.push(index);
 }else{
   let tile;
   if(payload.kind==='equals'){
     tile={id:'equals-'+index,value:'=',points:0};
   }else if(payload.kind==='rack'){
     tile=state.rack.find(t=>t.id===payload.id);
     if(!tile||Object.values(state.pending).some(t=>t.id===tile.id))return;
   }else{return;}
   state.pending[index]=tile;
   state.placementOrder=state.placementOrder.filter(i=>i!==index);
   state.placementOrder.push(index);
 }
 state.recentlyPlaced=index;state.selected=null;
 render();
}
function placeAt(index){
 if(state.ended||state.swapping||state.busy)return;
 if(state.board[index]){announce('That tile is locked. Use an empty square.',true);return;}
 if(state.selected){
   placePayload(state.selected==='equals'?{kind:'equals'}:{kind:'rack',id:state.selected},index);
   return;
 }
 if(state.pending[index]){
   const tile=state.pending[index];
   delete state.pending[index];
   state.placementOrder=state.placementOrder.filter(i=>i!==index);
   state.recentlyPlaced=null;
   state.selected=tile.value==='='?'equals':tile.id;
   render();
   return;
 }
 announce('Choose a rack tile or the unlimited equals tile first.');
}
function undoLast(){
 if(state.ended||state.busy)return;
 if(state.swapping){state.swapping=false;state.swapSet.clear();announce('Exchange cancelled.');render();return;}
 while(state.placementOrder.length){
   const index=state.placementOrder.pop();
   if(state.pending[index]){
     delete state.pending[index];state.selected=null;state.recentlyPlaced=null;
     announce('Last tile returned to the rack.');render();return;
   }
 }
 announce('There is no unscored tile to undo.');
}
function focusCell(currentIndex,key){
 const [r,c]=coords(currentIndex);
 let next=currentIndex;
 if(key==='ArrowRight')next=pos(r,Math.min(SIZE-1,c+1));
 if(key==='ArrowLeft')next=pos(r,Math.max(0,c-1));
 if(key==='ArrowDown')next=pos(Math.min(SIZE-1,r+1),c);
 if(key==='ArrowUp')next=pos(Math.max(0,r-1),c);
 state.focusedIndex=next;
 const target=$('board').querySelector('[data-index="'+next+'"]');
 if(target){
   const previous=$('board').querySelector('[tabindex="0"]');
   if(previous)previous.tabIndex=-1;
   target.tabIndex=0;target.focus({preventScroll:true});
 }
}
function boardCell(i){
 const [r,c]=coords(i),tile=valueAt(i),pending=!!state.pending[i],bonus=bonusAt(r,c),locked=!!state.board[i];
 const inPath=state.preview?.indices?.includes(i);
 const node=document.createElement('button');
 node.type='button';
 node.className='cell'+(bonus?' bonus-'+bonus.toLowerCase():'')+
   (tile?' occupied':'')+(pending?' pending':'')+
   (state.selected&&!locked?' drop-ready':'')+
   (inPath?' path-cell':'')+
   (inPath&&!tile?' path-gap':'')+
   (i===state.recentlyPlaced?' tile-landing':'')+
   (state.lockedFlash.has(i)?' locked-flash':'');
 node.setAttribute('role','gridcell');
 node.setAttribute('aria-label',`Row ${r+1}, column ${c+1}: ${tile?tile.value:bonus||'empty'}${pending?', unscored':''}`);
 node.dataset.index=String(i);
 node.dataset.locked=String(locked);
 node.tabIndex=state.focusedIndex===i?0:-1;
 if(tile){
   const inner=document.createElement('span');inner.className='board-tile';
   inner.textContent=tile.value;
   if(tile.value!=='='){
     const point=document.createElement('sup');point.textContent=tile.points;inner.append(point);
   }
   node.append(inner);
 }else if(bonus){
   const label=document.createElement('span');label.className='bonus-label';
   label.textContent=bonus==='START'?'✳':bonus;node.append(label);
 }
 node.addEventListener('click',event=>{if(!wasDragClick(event))placeAt(i);});
 node.addEventListener('keydown',event=>{
   if(['ArrowRight','ArrowLeft','ArrowDown','ArrowUp'].includes(event.key)){
     event.preventDefault();focusCell(i,event.key);
   }else if((event.key==='Delete'||event.key==='Backspace')&&state.pending[i]){
     event.preventDefault();delete state.pending[i];state.placementOrder=state.placementOrder.filter(k=>k!==i);render();
   }
 });
 if(pending&&!state.busy)enableTileDrag(node,{kind:'pending',index:i},placePayload);
 return node;
}
function renderBoard(){
 const board=$('board');
 const hadFocus=board.contains(document.activeElement);
 board.replaceChildren(...Array.from({length:SIZE*SIZE},(_,i)=>boardCell(i)));
 if(hadFocus)board.querySelector('[data-index="'+state.focusedIndex+'"]')?.focus({preventScroll:true});
}
function tileButton(tile){
 const button=document.createElement('button');
 button.type='button';
 button.className='tile'+(state.selected===tile.id?' selected':'')+
   (state.swapping&&state.swapSet.has(tile.id)?' marked':'');
 button.dataset.tileId=tile.id;
 button.setAttribute('aria-label',`Tile ${tile.value}, worth ${tile.points} points`);
 button.setAttribute('aria-pressed',String(state.selected===tile.id||state.swapSet.has(tile.id)));
 const main=document.createElement('span');main.textContent=tile.value;
 const points=document.createElement('sub');points.textContent=tile.points;
 button.append(main,points);
 button.addEventListener('click',event=>{
   if(wasDragClick(event))return;
   if(state.swapping){
     state.swapSet.has(tile.id)?state.swapSet.delete(tile.id):state.swapSet.add(tile.id);
     renderRack();return;
   }
   selectTile(tile.id);
 });
 if(!state.swapping&&!state.busy)enableTileDrag(button,{kind:'rack',id:tile.id},placePayload);
 return button;
}
function renderRack(){
 const used=new Set(Object.values(state.pending).filter(t=>t.value!=='=').map(t=>t.id));
 const available=state.rack.filter(t=>!used.has(t.id));
 $('rack').replaceChildren(...available.map(tileButton));
 $('rack-count').textContent=`${available.length} / ${HAND_SIZE}`;
 $('equals-tile').classList.toggle('selected',state.selected==='equals');
 $('equals-tile').setAttribute('aria-pressed',String(state.selected==='equals'));
 $('equals-tile').disabled=state.ended||state.swapping||state.busy;
 $('swap-btn').textContent=state.swapping?`⇄ CONFIRM SWAP (${state.swapSet.size})`:'⇄ SWAP TILES';
 $('score-btn').disabled=state.ended||state.swapping||state.busy||!Object.keys(state.pending).length;
 $('undo-btn').textContent=state.swapping?'× CANCEL SWAP':'↶ CLEAR PLACEMENT';
 $('undo-last-btn').disabled=state.ended||state.busy||!state.placementOrder.length;
 $('new-btn').disabled=state.busy;
}
function renderPreview(){
 const preview=state.preview;
 const box=$('equation-preview');
 box.dataset.state=state.swapping?'swap':preview.status;
 $('preview-equation').textContent=state.swapping?'TILE EXCHANGE':preview.text||'—';
 $('preview-status').textContent=state.swapping?
   'Choose the rack tiles to replace. This will use one turn.':preview.feedback;
 const points=(!state.swapping&&preview.ready)?scoreMove(state.board,state.pending,preview):null;
 $('potential-score').textContent=points?'+'+points.total:'—';
 $('potential-score').setAttribute('aria-label',points?
   `Potential score ${points.total} if the equation is mathematically correct`:
   'No potential score yet');
}
function render(){
 state.preview=inspectPlacement(state.board,state.pending);
 renderBoard();renderRack();renderPreview();
 $('score').textContent=state.score;$('target').textContent=nextTarget(state.sector);
 $('turn').textContent=`${Math.min(state.turn,TURNS_PER_SECTOR)} / ${TURNS_PER_SECTOR}`;
 $('sector-label').textContent=`SECTOR ${String(state.sector).padStart(2,'0')} · ${names[state.sector-1]||'DEEP SPACE'}`;
 $('bag-count').textContent=state.bag.length;
 $('remaining-label').textContent=state.score>=nextTarget(state.sector)?
   'TARGET ACHIEVED':`${nextTarget(state.sector)-state.score} points to stabilise`;
 $('progress').style.width=Math.min(100,state.score/nextTarget(state.sector)*100)+'%';
 $('board-hint').textContent=state.swapping?'SELECT TILES TO EXCHANGE':
   state.selected?'CHOOSE A LANDING SQUARE':'DRAG OR SELECT YOUR TILES';
}
function showModal(eyebrow,title,body,buttons){
 $('modal-eyebrow').textContent=eyebrow;$('modal-title').textContent=title;$('modal-body').replaceChildren();$('modal-body').innerHTML=body;
 $('modal-actions').replaceChildren(...buttons.map(({text,fn,primary})=>{const b=document.createElement('button');b.type='button';b.className=primary?'primary-command':'secondary-command';b.textContent=text;b.onclick=()=>{$('modal').close();fn?.();};return b;}));
 $('modal').showModal();
}
function turnCompleted(){
 state.pending={};state.selected=null;state.swapping=false;state.swapSet.clear();
 state.placementOrder=[];state.recentlyPlaced=null;state.busy=false;
 if(state.score>=nextTarget(state.sector)){
  state.ended=true;render();
  showModal('SECTOR STABILISED',`Sector ${state.sector} complete!`,
    `<p>You generated <strong>${state.score} energy points</strong> against a target of ${nextTarget(state.sector)}.</p><p>The next reactor will demand more energy.</p>`,
    [{text:'ENTER NEXT SECTOR →',primary:true,fn:()=>freshSector(state.sector+1)}]);
  return;
 }
 if(state.turn>=TURNS_PER_SECTOR){
  state.ended=true;render();
  showModal('REACTOR OFFLINE','Sector failed',
    `<p>You scored <strong>${state.score}</strong> of the required <strong>${nextTarget(state.sector)}</strong> points.</p><p>Try a new rack, different placements and bonus multipliers.</p>`,
    [{text:'RETRY SECTOR',primary:true,fn:()=>freshSector(state.sector)},
     {text:'START OVER',fn:()=>freshSector(1)}]);
  return;
 }
 state.turn++;render();
}
function showEnergyBurst(points){
 const burst=$('energy-burst');
 burst.textContent='+'+points+' ENERGY';
 burst.classList.remove('burst-active');
 $('board-frame').classList.remove('reactor-scored');
 void burst.offsetWidth;
 burst.classList.add('burst-active');
 $('board-frame').classList.add('reactor-scored');
}
function score(){
 if(state.ended||state.swapping||state.busy)return;
 try{
  const move=validateMove(state.board,state.pending);
  const points=scoreMove(state.board,state.pending,move);
  const changed=Object.keys(state.pending).map(Number);
  const used=new Set(Object.values(state.pending).filter(t=>t.value!=='=').map(t=>t.id));
  for(const [i,tile] of Object.entries(state.pending))state.board[Number(i)]=tile;
  state.rack=state.rack.filter(t=>!used.has(t.id));
  const draw=refill(state.rack,state.bag);state.rack=draw.rack;state.bag=draw.bag;
  state.score+=points.total;
  state.busy=true;
  state.pending={};state.placementOrder=[];state.selected=null;state.recentlyPlaced=null;
  state.lockedFlash=new Set(changed);
  announce(`${move.text} · +${points.total} points! ${points.bonuses.join(', ')}`);
  render();showEnergyBurst(points.total);
  const epoch=++state.modalEpoch;
  window.setTimeout(()=>{
    if(epoch!==state.modalEpoch)return;
    state.busy=false;state.lockedFlash.clear();
    render();
    showModal('EQUATION VERIFIED',`+${points.total} energy`,
      `<p class="equation-result">${escapeText(move.text)}</p><div class="score-breakdown"><div><span>Tile points</span><b>${points.base}</b></div><div><span>Equation multiplier</span><b>×${points.multiplier}</b></div><div><span>Equation length bonus</span><b>+${points.length}</b></div><div><span>Full rack bonus</span><b>+${points.sweep}</b></div><div class="total"><span>TOTAL</span><b>${points.total}</b></div></div>`,
      [{text:'CONTINUE →',primary:true,fn:turnCompleted}]);
  },420);
 }catch(err){
   announce(err.message,true);
   $('board').classList.remove('shake');void $('board').offsetWidth;
   $('board').classList.add('shake');
 }
}
const escapeText=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function swap(){
 if(state.ended||state.busy)return;
 if(!state.swapping){
   if(Object.keys(state.pending).length){
     announce('Clear your equation before swapping tiles.',true);return;
   }
   if(!state.bag.length){announce('The bag is empty; swapping is unavailable.',true);return;}
   state.swapping=true;state.selected=null;
   announce('Choose one or more rack tiles, then press Confirm Swap.');render();return;
 }
 if(!state.swapSet.size){announce('Select at least one tile to exchange.',true);return;}
 if(state.swapSet.size>state.bag.length){announce('Not enough tiles remain in the bag.',true);return;}
 const exchanged=state.rack.filter(t=>state.swapSet.has(t.id));
 state.rack=state.rack.filter(t=>!state.swapSet.has(t.id));
 const draw=refill(state.rack,state.bag);state.rack=draw.rack;state.bag=draw.bag;
 state.bag.push(...exchanged);
 for(let i=state.bag.length-1;i>0;i--){
   const j=Math.floor(Math.random()*(i+1));
   [state.bag[i],state.bag[j]]=[state.bag[j],state.bag[i]];
 }
 announce(`Exchanged ${exchanged.length} tile(s). Turn spent.`);turnCompleted();
}
function clear(){
 if(state.ended||state.busy)return;
 if(state.swapping){
   state.swapping=false;state.swapSet.clear();announce('Tile exchange cancelled.');
 }else{
   state.pending={};state.selected=null;state.placementOrder=[];state.recentlyPlaced=null;
   announce('Unscored tiles returned to the rack.');
 }
 render();
}
$('score-btn').onclick=score;
$('swap-btn').onclick=swap;
$('undo-btn').onclick=clear;
$('undo-last-btn').onclick=undoLast;
$('equals-tile').onclick=event=>{
 if(wasDragClick(event))return;
 selectTile('equals');
};
enableTileDrag($('equals-tile'),{kind:'equals'},placePayload);
$('new-btn').onclick=()=>{
 if(state.busy)return;
 showModal('RESTART','Start a new run?',
   '<p>This will reset your current sector and score.</p>',
   [{text:'CANCEL'},{text:'NEW RUN',primary:true,fn:()=>freshSector(1)}]);
};
$('help-btn').onclick=()=>showModal('HOW TO PLAY','Build. Balance. Energise.',
 `<p>Create a complete horizontal or vertical equation, using <strong>BIDMAS</strong> to check the arithmetic. Drag tiles by mouse, touch or pen, or tap a tile then its square. The <strong>=</strong> tile beside your rack is unlimited and free.</p>
 <p>Your first equation must cross the centre. Later equations must reuse a locked tile. Each move must make one continuous equation.</p>
 <p>Double and triple squares multiply tile or equation points. You earn 3 extra points per square beyond five, plus 20 for placing all seven physical rack tiles. Exchanging tiles uses a turn. Reach the energy target in six turns to advance.</p>
 <p>Move an unscored tile by dragging it. Tap it to pick it up, or use the <strong>Undo Tile</strong> control. Keyboard: <strong>1–7</strong> selects a rack tile, <strong>=</strong> selects the free equals sign, arrow keys navigate the board and Backspace undoes the last placed tile.</p>
 <p>The equation preview shows potential points but does not check whether your mathematics is correct until you submit.</p>`,
 [{text:'LET’S PLAY',primary:true}]);
document.addEventListener('keydown',event=>{
 if($('modal').open||event.altKey||event.metaKey||event.ctrlKey||state.ended||state.busy)return;
 if(event.key==='Backspace'&&!event.target.matches('input,textarea')){
   event.preventDefault();undoLast();return;
 }
 if(event.key==='Escape'&&state.selected){
   state.selected=null;render();return;
 }
 if(state.swapping)return;
 if(event.key==='='){
   event.preventDefault();selectTile('equals');return;
 }
 if(/^[1-7]$/.test(event.key)){
   const used=new Set(Object.values(state.pending).filter(t=>t.value!=='=').map(t=>t.id));
   const available=state.rack.filter(t=>!used.has(t.id));
   const tile=available[Number(event.key)-1];
   if(tile){event.preventDefault();selectTile(tile.id);}
 }
});
$('modal-close').onclick=()=>{if($('modal-eyebrow').textContent==='EQUATION VERIFIED'){$('modal-actions').querySelector('button')?.click();}else if(!state.ended){$('modal').close();}};
$('modal').addEventListener('cancel',e=>{if(state.ended||$('modal-eyebrow').textContent==='EQUATION VERIFIED')e.preventDefault();});
freshSector();
