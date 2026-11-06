import {SIZE,CENTER,HAND_SIZE,TURNS_PER_SECTOR,pos,coords,bonusAt,makeTile,makeBag,refill,validateMove,scoreMove,nextTarget} from './engine.js';
const $=id=>document.getElementById(id);
const state={board:Array(SIZE*SIZE).fill(null),pending:{},rack:[],bag:[],sector:1,score:0,turn:1,selected:null,swapping:false,swapSet:new Set(),ended:false};
const names=['ORIGIN','POLARIS','THE OUTER RING','THE VOID','ION STORM','NEBULA','DARK MATTER','BEYOND'];
const symbols={'+':'+','−':'−','×':'×','÷':'÷'};
function announce(message,isError=false){$('log').textContent=message;$('log').classList.toggle('error',isError);$('footer-text').textContent=message.toUpperCase(); }
function freshSector(sector=1){
  state.board=Array(SIZE*SIZE).fill(null);state.pending={};state.sector=sector;state.turn=1;state.score=0;state.ended=false;state.selected=null;state.swapping=false;state.swapSet.clear();
  state.bag=makeBag();
  if(sector===1){
    const required=['8','+','4','1','2','3','×'];
    state.rack=required.map(v=>{const i=state.bag.findIndex(t=>t.value===v);return state.bag.splice(i,1)[0]||makeTile(v);});
  }else{const draw=refill([],state.bag);state.rack=draw.rack;state.bag=draw.bag;}
  announce(sector===1?'Try 8 + 4 = 12 through the centre. Select tiles by tapping or dragging.':'New sector online. Build an equation through the centre.');render();
}
const valueAt=i=>state.pending[i]||state.board[i];
function selectTile(id){
 if(state.ended||state.swapping)return;
 state.selected=id;$('equals-tile').classList.toggle('selected',id==='equals');renderRack();
}
function placeAt(index){
 if(state.ended||state.swapping)return;
 if(state.pending[index]){const t=state.pending[index];delete state.pending[index];state.selected=t.value==='='?'equals':t.id;render();return;}
 if(state.board[index]){announce('That tile is locked. Use an empty square.');return;}
 if(!state.selected){announce('Select a rack tile or the free equals sign first.');return;}
 const tile=state.selected==='equals'?{id:'equals-'+index,value:'=',points:0}:state.rack.find(t=>t.id===state.selected);
 if(!tile)return;
 state.pending[index]=tile;state.selected=null;render();
}
function pickupPending(index){const tile=state.pending[index];if(!tile)return;delete state.pending[index];state.selected=tile.value==='='?'equals':tile.id;render();}
function boardCell(i){
 const [r,c]=coords(i),tile=valueAt(i),pending=!!state.pending[i],bonus=bonusAt(r,c);
 const node=document.createElement('button');node.type='button';node.className='cell'+(bonus?' bonus-'+bonus.toLowerCase():'')+(tile?' occupied':'')+(pending?' pending':'')+(state.selected&&!tile?' drop-ready':'');
 node.setAttribute('role','gridcell');node.setAttribute('aria-label',`Row ${r+1}, column ${c+1}: ${tile?tile.value:bonus||'empty'}`);
 node.dataset.index=String(i);
 if(tile){
  const inner=document.createElement('span');inner.className='board-tile';inner.textContent=tile.value;
  if(tile.value!=='='){const point=document.createElement('sup');point.textContent=tile.points;inner.append(point);}
  node.append(inner);
 }else if(bonus){const label=document.createElement('span');label.className='bonus-label';label.textContent=bonus==='START'?'✳':bonus;node.append(label);}
 node.addEventListener('click',()=>placeAt(i));
 node.addEventListener('dragover',e=>{if(state.board[i])return;e.preventDefault();node.classList.add('drag-hover');});
 node.addEventListener('dragleave',()=>node.classList.remove('drag-hover'));
 node.addEventListener('drop',e=>{e.preventDefault();node.classList.remove('drag-hover');const id=e.dataTransfer.getData('text/plain');if(!id)return;if(id.startsWith('pending:'))pickupPending(Number(id.slice(8)));else state.selected=id;placeAt(i);});
 if(pending){node.draggable=true;node.addEventListener('dragstart',e=>e.dataTransfer.setData('text/plain','pending:'+i));}
 return node;
}
function renderBoard(){const board=$('board');board.replaceChildren(...Array.from({length:SIZE*SIZE},(_,i)=>boardCell(i)));}
function tileButton(tile,pending=false){
 const button=document.createElement('button');button.type='button';button.className='tile'+(state.selected===tile.id?' selected':'')+(state.swapping&&state.swapSet.has(tile.id)?' marked':'')+(pending?' on-board':'');
 button.draggable=!state.swapping;button.dataset.tileId=tile.id;
 button.setAttribute('aria-label',`Tile ${tile.value}, worth ${tile.points} points`);
 const main=document.createElement('span');main.textContent=tile.value;const points=document.createElement('sub');points.textContent=tile.points;button.append(main,points);
 button.addEventListener('click',()=>{if(state.swapping){state.swapSet.has(tile.id)?state.swapSet.delete(tile.id):state.swapSet.add(tile.id);renderRack();return;}selectTile(tile.id);renderBoard();});
 button.addEventListener('dragstart',e=>{state.selected=tile.id;e.dataTransfer.setData('text/plain',tile.id);});
 return button;
}
function renderRack(){
 const used=new Set(Object.values(state.pending).map(t=>t.id));
 const rack=$('rack');rack.replaceChildren(...state.rack.filter(t=>!used.has(t.id)).map(t=>tileButton(t)));
 $('rack-count').textContent=`${state.rack.length-used.size} / ${HAND_SIZE}`;
 $('equals-tile').classList.toggle('selected',state.selected==='equals');
 $('swap-btn').textContent=state.swapping?`⇄ CONFIRM SWAP (${state.swapSet.size})`:'⇄ SWAP TILES';
 $('score-btn').disabled=state.ended||state.swapping;
 $('undo-btn').textContent=state.swapping?'× CANCEL SWAP':'↶ CLEAR PLACEMENT';
}
function render(){
 renderBoard();renderRack();
 $('score').textContent=state.score;$('target').textContent=nextTarget(state.sector);
 $('turn').textContent=`${Math.min(state.turn,TURNS_PER_SECTOR)} / ${TURNS_PER_SECTOR}`;
 $('sector-label').textContent=`SECTOR ${String(state.sector).padStart(2,'0')} · ${names[state.sector-1]||'DEEP SPACE'}`;
 $('bag-count').textContent=state.bag.length;
 $('remaining-label').textContent=state.score>=nextTarget(state.sector)?'TARGET ACHIEVED':`${nextTarget(state.sector)-state.score} points to stabilise`;
 $('progress').style.width=Math.min(100,state.score/nextTarget(state.sector)*100)+'%';
 $('board-hint').textContent=state.swapping?'SELECT TILES TO EXCHANGE':'DRAG TILES TO FORM AN EQUATION';
}
function showModal(eyebrow,title,body,buttons){
 $('modal-eyebrow').textContent=eyebrow;$('modal-title').textContent=title;$('modal-body').replaceChildren();$('modal-body').innerHTML=body;
 $('modal-actions').replaceChildren(...buttons.map(({text,fn,primary})=>{const b=document.createElement('button');b.type='button';b.className=primary?'primary-command':'secondary-command';b.textContent=text;b.onclick=()=>{$('modal').close();fn?.();};return b;}));
 $('modal').showModal();
}
function turnCompleted(){
 state.pending={};state.selected=null;state.swapping=false;state.swapSet.clear();
 if(state.score>=nextTarget(state.sector)){
  state.ended=true;render();showModal('SECTOR STABILISED',`Sector ${state.sector} complete!`,`<p>You generated <strong>${state.score} energy points</strong> against a target of ${nextTarget(state.sector)}.</p><p>The next reactor will demand more energy.</p>`,[{text:'ENTER NEXT SECTOR →',primary:true,fn:()=>freshSector(state.sector+1)}]);return;
 }
 if(state.turn>=TURNS_PER_SECTOR){
  state.ended=true;render();showModal('REACTOR OFFLINE','Sector failed',`<p>You scored <strong>${state.score}</strong> of the required <strong>${nextTarget(state.sector)}</strong> points.</p><p>Try a new rack, different placements and bonus multipliers.</p>`,[{text:'RETRY SECTOR',primary:true,fn:()=>freshSector(state.sector)},{text:'START OVER',fn:()=>freshSector(1)}]);return;
 }
 state.turn++;render();
}
function score(){
 if(state.ended||state.swapping)return;
 try{
  const move=validateMove(state.board,state.pending),points=scoreMove(state.board,state.pending,move);
  const used=new Set(Object.values(state.pending).filter(t=>t.value!=='=').map(t=>t.id));
  for(const [i,tile] of Object.entries(state.pending))state.board[Number(i)]=tile;
  state.rack=state.rack.filter(t=>!used.has(t.id));
  const draw=refill(state.rack,state.bag);state.rack=draw.rack;state.bag=draw.bag;state.score+=points.total;
  announce(`${move.text} · +${points.total} points! ${points.bonuses.join(', ')}`);
  render();
  showModal('EQUATION VERIFIED',`+${points.total} energy`,`<p class="equation-result">${escapeText(move.text)}</p><div class="score-breakdown"><div><span>Tile points</span><b>${points.base}</b></div><div><span>Equation multiplier</span><b>×${points.multiplier}</b></div><div><span>Equation length bonus</span><b>+${points.length}</b></div><div><span>Full rack bonus</span><b>+${points.sweep}</b></div><div class="total"><span>TOTAL</span><b>${points.total}</b></div></div>`,[{text:'CONTINUE →',primary:true,fn:turnCompleted}]);
 }catch(err){announce(err.message,true);$('board').classList.remove('shake');void $('board').offsetWidth;$('board').classList.add('shake');}
}
const escapeText=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function swap(){
 if(state.ended)return;
 if(!state.swapping){if(Object.keys(state.pending).length){announce('Clear your equation before swapping tiles.',true);return;}if(!state.bag.length){announce('The bag is empty; swapping is unavailable.',true);return;}state.swapping=true;announce('Choose one or more rack tiles, then press Confirm Swap.');renderRack();return;}
 if(!state.swapSet.size){announce('Select at least one tile to exchange.',true);return;}
 if(state.swapSet.size>state.bag.length){announce('Not enough tiles remain in the bag.',true);return;}
 const exchanged=state.rack.filter(t=>state.swapSet.has(t.id));
 state.rack=state.rack.filter(t=>!state.swapSet.has(t.id));
 const draw=refill(state.rack,state.bag);state.rack=draw.rack;state.bag=draw.bag;
 state.bag.push(...exchanged);
 for(let i=state.bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[state.bag[i],state.bag[j]]=[state.bag[j],state.bag[i]];}
 announce(`Exchanged ${exchanged.length} tile(s). Turn spent.`);turnCompleted();
}
function clear(){
 if(state.swapping){state.swapping=false;state.swapSet.clear();announce('Swap cancelled.');}else{state.pending={};state.selected=null;announce('Unscored tiles returned to your rack.');}render();
}
$('score-btn').onclick=score;$('swap-btn').onclick=swap;$('undo-btn').onclick=clear;
$('equals-tile').onclick=()=>{selectTile('equals');renderBoard();};
$('equals-tile').addEventListener('dragstart',e=>{state.selected='equals';e.dataTransfer.setData('text/plain','equals');});
$('new-btn').onclick=()=>showModal('RESTART','Start a new run?', '<p>This will reset your current sector and score.</p>',[{text:'CANCEL'},{text:'NEW RUN',primary:true,fn:()=>freshSector(1)}]);
$('help-btn').onclick=()=>showModal('HOW TO PLAY','Build. Balance. Energise.',`<p>Use your rack to create a mathematically correct equation. BIDMAS applies. Drag tiles to the board, or select a tile and then a square. Choose an unlimited <strong>=</strong> sign from the end of your rack.</p><p>Start through the centre. Later equations must intersect a locked tile. New tiles in a move must form a single continuous horizontal or vertical equation.</p><p>Score tile values and multipliers. Get +3 points for each square beyond five, or +20 for using all seven rack tiles in one turn. Spend a turn to exchange tiles. Reach the target within six turns to progress.</p><p>Click a pending tile to return it to the rack. This initial prototype contains the Origin tile set and solo Sector Run.</p>`,[{text:'LET’S PLAY',primary:true}]);
$('modal-close').onclick=()=>{if($('modal-eyebrow').textContent==='EQUATION VERIFIED'){$('modal-actions').querySelector('button')?.click();}else if(!state.ended){$('modal').close();}};
$('modal').addEventListener('cancel',e=>{if(state.ended||$('modal-eyebrow').textContent==='EQUATION VERIFIED')e.preventDefault();});
freshSector();
