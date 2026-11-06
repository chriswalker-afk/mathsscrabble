import {SIZE,CENTER,HAND_SIZE,TURNS_PER_SECTOR,pos,coords,bonusAt,makeTile,makeBag,refill,validateMove,inspectPlacement,scoreMove,nextTarget,BLANK_NUMBER,BLANK_OPERATOR,BLANK_ANY,BLANK_KINDS,isBlank,freeExchangeReason,reorderRack,isOperator,isDigit,resolveBlank} from './engine.js';
import {enableTileDrag,wasDragClick} from './pointer-drag.js';
import {SAVE_KEY,INTRO_KEY,dealPlayableRack,freshStats,freshProgress,recordMove,sectorReport,completeProgress,saveRun,loadRun} from './solo.js';
const $=id=>document.getElementById(id);
const state={
 board:Array(SIZE*SIZE).fill(null),pending:{},rack:[],bag:[],sector:1,score:0,turn:1,
 selected:null,swapping:false,swapSet:new Set(),ended:false,busy:false,
 focusedIndex:pos(CENTER,CENTER),placementOrder:[],recentlyPlaced:null,
 lockedFlash:new Set(),preview:null,modalEpoch:0,phase:'playing',
 stats:freshStats(),progress:freshProgress(),saveAvailable:false
};
const storage=(()=>{try{return window.localStorage;}catch{return null;}})();
function persistRun(){
  state.saveAvailable=saveRun(storage,state);
  $('save-status').textContent=state.saveAvailable?'✓ AUTOSAVED':'LOCAL SAVE OFF';
  $('save-status').classList.toggle('unavailable',!state.saveAvailable);
  $('save-status').title=state.saveAvailable?
    'Your current run, rack and unscored tiles are saved on this device.':
    'Your browser could not save this run. Keep this tab open to avoid losing progress.';
}
const names=['ORIGIN','POLARIS','THE OUTER RING','THE VOID','ION STORM','NEBULA','DARK MATTER','BEYOND'];
function announce(message,isError=false){
 $('log').textContent=message;
 $('log').classList.toggle('error',isError);
 $('footer-text').textContent=message.toUpperCase();
 if(isError){
   $('equation-preview').dataset.state='error';
   $('preview-status').textContent=message;
 }
}
function freshSector(sector=1,{newRun=false}={}){
 state.modalEpoch++;
 if(newRun||sector===1||!state.progress)state.progress=freshProgress();
 state.stats=freshStats();state.phase='playing';
 state.board=Array(SIZE*SIZE).fill(null);state.pending={};state.sector=sector;
 state.turn=1;state.score=0;state.ended=false;state.busy=false;
 state.selected=null;state.swapping=false;state.swapSet.clear();
 state.placementOrder=[];state.lockedFlash.clear();state.recentlyPlaced=null;
 state.focusedIndex=pos(CENTER,CENTER);
 state.bag=makeBag();
 if(sector===1){
   const required=['8','+','4','1','2',BLANK_OPERATOR,BLANK_ANY];
   state.rack=required.map(v=>{
     const i=state.bag.findIndex(t=>(t.blank||t.value)===v);
     return i>=0?state.bag.splice(i,1)[0]:makeTile(v);
   });
 }else{
   const deal=dealPlayableRack([],state.bag);
   state.rack=deal.rack;state.bag=deal.bag;
 }
 announce(sector===1?
   'First mission: try 8 + 4 = 12 through the centre. BIDMAS checks your calculation when you submit.':
   'New sector online. Use the centre to begin and aim for the new energy target.');
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
function availableRack(){
 const used=new Set(Object.values(state.pending).filter(tile=>tile.value!=='=').map(tile=>tile.id));
 return state.rack.filter(tile=>!used.has(tile.id));
}
function chooseBlank(tile,index){
 const config=BLANK_KINDS[tile.blank];
 if(!config)return;
 state.selected=null;renderRack();renderBoard();
 showModal('PROGRAM WILDCARD',config.label==='ANY TILE'?'Choose any value':'Choose a '+config.label.toLowerCase(),
   '<p>Pick the number or operation for this blank. It will score <strong>0 tile points</strong>, but it can still activate a premium square.</p><p>The choice stays fixed when you score the equation.</p><div id="wildcard-choices" class="wildcard-choices" role="group" aria-label="Choose a blank tile value"></div>',
   [{text:'CANCEL'}]);
 const chooser=$('wildcard-choices');
 for(const value of config.choices){
   const button=document.createElement('button');
   button.type='button';button.className='wild-choice';button.textContent=value;
   button.setAttribute('aria-label','Use '+value+' for blank');
   button.onclick=()=>{
     $('modal').close();
     commitPending(resolveBlank(tile,value),index);
   };
   chooser.append(button);
 }
 chooser.querySelector('button')?.focus();
}
function commitPending(tile,index){
 if(state.ended||state.swapping||state.busy||state.board[index])return;
 // Replacing a pending tile returns the displaced physical tile to the rack.
 state.pending[index]=tile;
 state.placementOrder=state.placementOrder.filter(i=>i!==index);
 state.placementOrder.push(index);
 state.recentlyPlaced=index;state.selected=null;render();
}
function placePayload(payload,index){
 if(state.ended||state.swapping||state.busy||!Number.isInteger(index)||index<0||index>=SIZE*SIZE)return;
 if(state.board[index]){announce('This tile is locked. Choose an empty square.',true);return;}
 if(payload.kind==='pending'){
   const from=payload.index,moving=state.pending[from];
   if(!moving||from===index)return;
   const displaced=state.pending[index];
   delete state.pending[from];state.pending[index]=moving;
   if(displaced)state.pending[from]=displaced;
   state.placementOrder=state.placementOrder.filter(i=>i!==from&&i!==index);
   if(displaced)state.placementOrder.push(from);
   state.placementOrder.push(index);
   state.recentlyPlaced=index;state.selected=null;render();return;
 }
 if(payload.kind==='equals'){
   commitPending({id:'equals-'+index,value:'=',points:0},index);return;
 }
 if(payload.kind!=='rack')return;
 const tile=state.rack.find(t=>t.id===payload.id);
 if(!tile||Object.values(state.pending).some(t=>t.id===tile.id))return;
 if(isBlank(tile)){chooseBlank(tile,index);return;}
 commitPending(tile,index);
}
function onTileDrop(payload,target){
 if(state.ended||state.swapping||state.busy)return;
 if(target.kind==='board'){placePayload(payload,target.index);return;}
 if(target.kind!=='rack')return;
 if(payload.kind==='rack'){
   const hidden=Object.values(state.pending).filter(tile=>tile.value!=='=').map(tile=>tile.id);
   state.rack=reorderRack(state.rack,payload.id,target.index,hidden);
   state.selected=null;state.recentlyPlaced=null;
   announce('Rack tiles rearranged. No turn used.');render();return;
 }
 if(payload.kind==='pending'){
   const tile=state.pending[payload.index];
   if(!tile)return;
   delete state.pending[payload.index];
   state.placementOrder=state.placementOrder.filter(i=>i!==payload.index);
   if(tile.value!=='='){
     const hidden=[tile.id,...Object.values(state.pending).filter(t=>t.value!=='=').map(t=>t.id)];
     state.rack=reorderRack(state.rack,tile.id,target.index,hidden);
   }
   state.selected=null;state.recentlyPlaced=null;
   announce(tile.value==='='?'Free equals sign returned.':'Tile returned to your rack. No turn used.');
   render();
 }
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
 node.setAttribute('aria-label',`Row ${r+1}, column ${c+1}: ${tile?tile.value:bonus||'empty'}${tile&&tile.value!=='='?', '+tile.points+' tile points':''}${pending?', unscored':''}`);
 node.dataset.index=String(i);
 node.dataset.locked=String(locked);
 node.tabIndex=state.focusedIndex===i?0:-1;
 if(tile){
   const inner=document.createElement('span');
   inner.className='board-tile'+(isBlank(tile)?' placed-wildcard':'');
   inner.textContent=tile.value;
   // Keep board symbols completely unobstructed. Point values remain visible
   // on the rack, in the equation breakdown, and in this accessible tooltip.
   if(tile.value!=='=')node.title=`${tile.value} · ${tile.points} tile points`;
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
     event.preventDefault();event.stopPropagation();delete state.pending[i];state.placementOrder=state.placementOrder.filter(k=>k!==i);render();
   }
 });
 if(pending&&!state.busy)enableTileDrag(node,{kind:'pending',index:i},onTileDrop);
 return node;
}
function renderBoard(){
 const board=$('board');
 const hadFocus=board.contains(document.activeElement);
 board.replaceChildren(...Array.from({length:SIZE*SIZE},(_,i)=>boardCell(i)));
 if(hadFocus)board.querySelector('[data-index="'+state.focusedIndex+'"]')?.focus({preventScroll:true});
}
function tileButton(tile, rackIndex){
 const button=document.createElement('button');
 button.type='button';
 button.className='tile'+(state.selected===tile.id?' selected':'')+
   (state.swapping&&state.swapSet.has(tile.id)?' marked':'')+
   (isBlank(tile)?' wildcard wildcard-'+tile.blank:'');
 button.dataset.tileId=tile.id;
 button.dataset.rackIndex=String(rackIndex);
 button.setAttribute('aria-label',isBlank(tile)?
   `Blank ${BLANK_KINDS[tile.blank].label.toLowerCase()}: choose a value when placing, zero tile points`:
   `Tile ${tile.value}, worth ${tile.points} points`);
 button.setAttribute('aria-pressed',String(state.selected===tile.id||state.swapSet.has(tile.id)));
 const main=document.createElement('span');main.textContent=isBlank(tile)?BLANK_KINDS[tile.blank].symbol:tile.value;
 const points=document.createElement('sub');
 points.textContent=isBlank(tile)?({[BLANK_NUMBER]:'N',[BLANK_OPERATOR]:'OP',[BLANK_ANY]:'ALL'})[tile.blank]:tile.points;
 button.append(main,points);
 button.addEventListener('click',event=>{
   if(wasDragClick(event))return;
   if(state.swapping){
     state.swapSet.has(tile.id)?state.swapSet.delete(tile.id):state.swapSet.add(tile.id);
     renderRack();return;
   }
   selectTile(tile.id);
 });
 if(!state.swapping&&!state.busy)enableTileDrag(button,{kind:'rack',id:tile.id},onTileDrop);
 button.addEventListener('keydown',event=>{
   if(!event.altKey||!['ArrowLeft','ArrowRight'].includes(event.key)||state.swapping||state.busy)return;
   event.preventDefault();
   const direction=event.key==='ArrowRight'?1:-1;
   const hidden=Object.values(state.pending).filter(t=>t.value!=='=').map(t=>t.id);
   state.rack=reorderRack(state.rack,tile.id,rackIndex+direction+(direction>0?1:0),hidden);
   renderRack();persistRun();
   const next=$('rack').querySelector('[data-tile-id="'+tile.id+'"]');
   next?.focus({preventScroll:true});
 });
 return button;
}
function renderRack(){
 const used=new Set(Object.values(state.pending).filter(t=>t.value!=='=').map(t=>t.id));
 const available=state.rack.filter(t=>!used.has(t.id));
 $('rack').replaceChildren(...available.map((tile,i)=>tileButton(tile,i)));
 $('rack-count').textContent=`${available.length} / ${HAND_SIZE}`;
 $('equals-tile').classList.toggle('selected',state.selected==='equals');
 $('equals-tile').setAttribute('aria-pressed',String(state.selected==='equals'));
 $('equals-tile').disabled=state.ended||state.swapping||state.busy;
 const eligible=freeExchangeReason(state.rack);
 $('swap-btn').textContent=state.swapping?
   `⇄ CONFIRM ${eligible?'FREE ':''}SWAP (${state.swapSet.size})`:
   eligible?'⇄ FREE TILE SWAP':'⇄ SWAP TILES';
 $('swap-btn').classList.toggle('free-exchange',Boolean(eligible));
 $('swap-btn').disabled=state.ended||state.busy||state.bag.length===0;
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
 const freeReason=freeExchangeReason(state.rack);
 $('preview-status').textContent=state.swapping?
   (freeReason?`Choose tiles to replace — ${freeReason}-only rack, no turn used.`:
     'Choose tiles to replace — this uses a turn.'):
   freeReason&&!Object.keys(state.pending).length?
     `Only ${freeReason} in your rack. Free exchange available.`:preview.feedback;
 const points=(!state.swapping&&preview.ready)?scoreMove(state.board,state.pending,preview):null;
 $('potential-score').textContent=points?'+'+points.total:'—';
 $('potential-score').setAttribute('aria-label',points?
   `Potential score ${points.total} if the equation is mathematically correct`:
   'No potential score yet');
}
function render(){
 state.preview=inspectPlacement(state.board,state.pending);
 renderBoard();renderRack();renderPreview();
 const target=nextTarget(state.sector),remaining=Math.max(0,target-state.score);
 const turnsAvailable=state.phase==='playing'?
   Math.max(1,TURNS_PER_SECTOR-state.turn+1):0;
 $('score').textContent=state.score;$('target').textContent=target;
 $('turn').textContent=`${Math.min(state.turn,TURNS_PER_SECTOR)} / ${TURNS_PER_SECTOR}`;
 $('sector-label').textContent=`SECTOR ${String(state.sector).padStart(2,'0')} · ${names[state.sector-1]||'DEEP SPACE'}`;
 $('bag-count').textContent=state.bag.length;
 $('remaining-label').textContent=state.phase==='won'?'TARGET ACHIEVED':
   state.phase==='lost'?(`${remaining} energy short · try again`):
   `${remaining} to go · about ${Math.ceil(remaining/turnsAvailable)} per remaining turn`;
 $('progress').style.width=Math.min(100,state.score/target*100)+'%';
 $('progress').setAttribute('aria-label',`${state.score} of ${target} energy collected`);
 $('run-summary').textContent=`${state.progress.completed.length} sector${state.progress.completed.length===1?'':'s'} · ${state.progress.runPoints} energy`;
 const history=$('history-mini');
 history.replaceChildren();
 if(state.stats.moves.length){
   const heading=document.createElement('div');heading.className='history-heading';heading.textContent='SCORED EQUATIONS';
   history.append(heading);
   for(const move of state.stats.moves.slice(-3).reverse()){
     const row=document.createElement('div');row.className='history-row';
     const equation=document.createElement('span');equation.textContent=move.equation;
     const points=document.createElement('strong');points.textContent='+'+move.points;
     row.append(equation,points);history.append(row);
   }
 }
 const coach=$('coach-hint');
 const placed=Object.keys(state.pending).length;
 if(state.phase==='won')coach.textContent='Reactor stabilised. Open the sector report to advance.';
 else if(state.phase==='lost')coach.textContent='Review your moves and retry this sector.';
 else if(state.swapping)coach.textContent=freeExchangeReason(state.rack)?
   'All numbers or all operations? You can exchange tiles without spending a turn.':
   'Select your exchange tiles. This will use one turn.';
 else if(state.board.every(t=>!t)&&!placed)coach.textContent=
   state.sector===1?'TRAINING · Try 8 + 4 = 12 through the glowing centre.':'START · Your first equation must cross the centre.';
 else if(placed&&state.preview.ready)coach.textContent=
   'CHECK · A complete equation is in place. Submit it when you trust your BIDMAS calculation.';
 else if(placed)coach.textContent='BUILD · Arrange one unbroken equation, then add your free equals sign.';
 else coach.textContent='EXPAND · Connect a fresh equation to any locked tile. Reused tiles score again.';
 if(!state.busy)persistRun();
}
function showModal(eyebrow,title,body,buttons){
 $('modal-eyebrow').textContent=eyebrow;$('modal-title').textContent=title;$('modal-body').replaceChildren();$('modal-body').innerHTML=body;
 $('modal-actions').replaceChildren(...buttons.map(({text,fn,primary})=>{const b=document.createElement('button');b.type='button';b.className=primary?'primary-command':'secondary-command';b.textContent=text;b.onclick=()=>{$('modal').close();fn?.();};return b;}));
 $('modal').showModal();
}
function completeTurn(){
 state.pending={};state.selected=null;state.swapping=false;state.swapSet.clear();
 state.placementOrder=[];state.recentlyPlaced=null;
 if(state.score>=nextTarget(state.sector)){
   state.phase='won';state.ended=true;
   state.progress=completeProgress(state.progress,
     sectorReport(state.sector,state.score,state.turn,state.stats,true));
 }else if(state.turn>=TURNS_PER_SECTOR){
   state.phase='lost';state.ended=true;
 }else{
   state.phase='playing';state.ended=false;state.turn++;
 }
 // This must happen synchronously before any animation or modal: refreshing
 // immediately after a scoring action must never replay or lose the turn.
 persistRun();
}
function reportRows(moves){
 if(!moves.length)return '<p>No equations scored yet. Start with one accurate calculation, then build outward from it.</p>';
 return '<div class="report-moves">'+moves.map(m=>
   `<div class="report-move"><span class="report-turn">T${m.turn}</span><strong>${escapeText(m.equation)}</strong><span>+${m.points}</span></div>`
 ).join('')+'</div>';
}
function showSectorOutcome(){
 const won=state.phase==='won';
 const report=sectorReport(state.sector,state.score,state.turn,state.stats,won);
 const best=report.best?`${escapeText(report.best.equation)} (+${report.best.points})`:'No scored equations';
 const message=won?
   'Target reached. Your run continues into a fresh sector.':
   report.equations?
     'You can retry this sector with a new rack. Look for connections and premium squares.':
     'Try a short, correct equation first. A balanced rack provides digits, an operation and a wildcard.';
 const body=`<div class="sector-report">
 <div class="report-energy"><div><span>ENERGY COLLECTED</span><strong>${report.score}</strong></div>
 <div><span>SECTOR TARGET</span><strong>${report.target}</strong></div></div>
 <div class="report-meter"><div style="width:${Math.min(100,Math.round(100*report.score/report.target))}%"></div></div>
 <div class="report-facts"><div><span>Equations</span><strong>${report.equations}</strong></div>
 <div><span>Turns used</span><strong>${report.turnsUsed}/6</strong></div>
 <div><span>Best move</span><strong>${report.best?report.best.points:0} pts</strong></div>
 <div><span>Free exchanges</span><strong>${report.freeExchanges}</strong></div></div>
 <p class="report-best">Best calculation: ${best}</p>
 ${reportRows(report.moves)}
 <p class="report-note">${message}</p></div>`;
 if(won){
   showModal('SECTOR STABILISED',`Sector ${state.sector} complete!`,body,[
    {text:'VIEW RUN',fn:showRunReport},
    {text:'NEXT SECTOR →',primary:true,fn:()=>freshSector(state.sector+1)}
   ]);
 }else{
   showModal('REACTOR OFFLINE',`Sector ${state.sector} report`,body,[
    {text:'NEW RUN',fn:()=>freshSector(1,{newRun:true})},
    {text:'RETRY SECTOR',primary:true,fn:()=>freshSector(state.sector)}
   ]);
 }
}
function showRunReport(){
 const progress=state.progress;
 const rows=progress.completed.slice(-10).map(item=>
   `<div class="report-move"><span class="report-turn">S${item.sector}</span><strong>${item.score} / ${item.target} energy</strong><span>${item.turnsUsed} turns</span></div>`
 ).join('');
 const body=`<div class="sector-report"><div class="report-energy"><div><span>SECTORS CLEARED</span><strong>${progress.completed.length}</strong></div>
 <div><span>RUN ENERGY</span><strong>${progress.runPoints}</strong></div></div>
 <p class="report-note">Current sector ${state.sector}: ${state.score} / ${nextTarget(state.sector)} energy. Progress saves automatically on this device.</p>
 <div class="report-moves">${rows||'<p>No sectors cleared yet. Start by reaching your first target.</p>'}</div></div>`;
 const buttons=state.phase==='won'?
   [{text:'BACK TO SECTOR REPORT',fn:showSectorOutcome},
    {text:'NEXT SECTOR →',primary:true,fn:()=>freshSector(state.sector+1)}]:
   state.phase==='lost'?
     [{text:'BACK TO REPORT',fn:showSectorOutcome},
      {text:'RETRY SECTOR',primary:true,fn:()=>freshSector(state.sector)}]:
     [{text:'BACK TO GAME',primary:true}];
 showModal('CAPTAIN’S LOG','Your reactor run',body,buttons);
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
   state.stats=recordMove(state.stats,move,points,state.turn,state.pending);
   for(const [i,tile] of Object.entries(state.pending))state.board[Number(i)]=tile;
   state.rack=state.rack.filter(t=>!used.has(t.id));
   const draw=dealPlayableRack(state.rack,state.bag);
   state.rack=draw.rack;state.bag=draw.bag;
   state.score+=points.total;
   state.busy=true;
   state.lockedFlash=new Set(changed);
   const epoch=++state.modalEpoch;
   completeTurn();
   announce(`${move.text} · +${points.total} points! ${points.bonuses.join(', ')}`);
   render();showEnergyBurst(points.total);
   window.setTimeout(()=>{
     if(epoch!==state.modalEpoch)return;
     state.busy=false;state.lockedFlash.clear();render();
     showModal('EQUATION VERIFIED',`+${points.total} energy`,
       `<p class="equation-result">${escapeText(move.text)}</p>
       <div class="score-breakdown">
       <div><span>Tile points</span><b>${points.base}</b></div>
       <div><span>Equation multiplier</span><b>×${points.multiplier}</b></div>
       <div><span>Equation length</span><b>+${points.length}</b></div>
       <div><span>Completed calculation</span><b>+${points.equation}</b></div>
       <div><span>Connected to board</span><b>+${points.crossing}</b></div>
       <div><span>Full rack bonus</span><b>+${points.sweep}</b></div>
       <div class="total"><span>TOTAL</span><b>${points.total}</b></div></div>`,
       [{text:state.phase==='playing'?'CONTINUE →':'VIEW SECTOR REPORT →',primary:true,fn:()=>{
         if(state.phase!=='playing')showSectorOutcome();
       }}]);
   },420);
 }catch(err){
   state.stats.attempts++;
   persistRun();
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
   announce(freeExchangeReason(state.rack)?
     'Free exchange: choose tiles to replace, then confirm. No turn used.':
     'Choose one or more rack tiles, then confirm. This uses a turn.');render();return;
 }
 if(!state.swapSet.size){announce('Select at least one tile to exchange.',true);return;}
 if(state.swapSet.size>state.bag.length){announce('Not enough tiles remain in the bag.',true);return;}
 const free=Boolean(freeExchangeReason(state.rack));
 const exchanged=state.rack.filter(t=>state.swapSet.has(t.id));
 state.rack=state.rack.filter(t=>!state.swapSet.has(t.id));
 const draw=dealPlayableRack(state.rack,state.bag);state.rack=draw.rack;state.bag=draw.bag;
 state.bag.push(...exchanged);
 for(let i=state.bag.length-1;i>0;i--){
   const j=Math.floor(Math.random()*(i+1));
   [state.bag[i],state.bag[j]]=[state.bag[j],state.bag[i]];
 }
 if(free){
   state.stats.freeExchanges++;
   state.swapping=false;state.swapSet.clear();state.selected=null;
   announce(`Exchanged ${exchanged.length} tile(s) for free. Your turn is unchanged.`);
   render();
 }else{
   state.stats.paidExchanges++;
   completeTurn();
   announce(`Exchanged ${exchanged.length} tile(s). Turn spent.`);
   render();
   if(state.phase!=='playing')showSectorOutcome();
 }
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
enableTileDrag($('equals-tile'),{kind:'equals'},onTileDrop);
$('new-btn').onclick=()=>{
 if(state.busy)return;
 showModal('RESTART','Start a new run?',
   '<p>A new run replaces your current local save, including your sector and accumulated run points. Your completed sector history will be lost.</p>',
   [{text:'CANCEL'},{text:'NEW RUN',primary:true,fn:()=>freshSector(1,{newRun:true})}]);
};
$('run-report-btn').onclick=()=>{if(!state.busy)showRunReport();};
function rememberIntro(){
 try{storage?.setItem(INTRO_KEY,'seen');}catch{/* private or blocked storage */}
}
function showTraining(firstVisit=false){
 const message=`<div class="training-steps">
  <div class="training-step"><span>01</span><div><strong>Build one real calculation</strong>
    <p>Try <em>8 + 4 = 12</em> through the centre. Use <strong>BIDMAS</strong>: brackets, indices, division/multiplication, then addition/subtraction. An identity like 3 = 3 does not score.</p></div></div>
  <div class="training-step"><span>02</span><div><strong>Drag, arrange and program</strong>
    <p>Drag tiles from the rack to the board or tap to place. The = sign is free. Blank tiles <b>#</b>, <b>◇</b> and <b>✦</b> let you choose a number, operation or either. Drag misplaced tiles back to the rack.</p></div></div>
  <div class="training-step"><span>03</span><div><strong>Score and connect</strong>
    <p>Click <strong>Score Equation</strong> to check it. Premium squares, longer equations and crossing existing tiles add energy. Reach the target within six turns. You can exchange an all-number or all-operation rack for free.</p></div></div>
 </div>
 <p class="training-footnote">Your run is automatically saved on this device. Arrow keys navigate the grid; number keys 1–7 select rack tiles, = selects equals and Backspace undoes a tile.</p>`;
 showModal(firstVisit?'WELCOME TO THE REACTOR':'FLIGHT MANUAL',
   firstVisit?'Ready to build your first equation?':'How to play EQUA//NOVA',
   message,firstVisit?
    [{text:'SKIP GUIDE',fn:rememberIntro},
     {text:'START MISSION →',primary:true,fn:rememberIntro}]:
    [{text:'BACK TO GAME',primary:true}]);
}
$('help-btn').onclick=()=>showTraining();
function startSolo(){
 const previous=loadRun(storage);
 if(previous){
   Object.assign(state,previous);
   state.ended=state.phase!=='playing';state.busy=false;
   state.swapping=false;state.swapSet.clear();state.selected=null;
   state.recentlyPlaced=null;state.lockedFlash.clear();
   state.focusedIndex=pos(CENTER,CENTER);
   announce('Saved run restored. Your board, rack, and unfinished placements are ready.');
   render();
   if(state.ended)showSectorOutcome();
 }else{
   freshSector(1,{newRun:true});
   let seen=false;
   try{seen=storage?.getItem(INTRO_KEY)==='seen';}catch{/* no storage */}
   if(!seen)showTraining(true);
 }
}
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
$('modal-close').onclick=()=>{
 if($('modal-eyebrow').textContent==='EQUATION VERIFIED'){
   $('modal-actions').querySelector('button')?.click();
 }else if($('modal-eyebrow').textContent==='WELCOME TO THE REACTOR'){
   rememberIntro();$('modal').close();
 }else if(!state.ended){
   $('modal').close();
 }
};
$('modal').addEventListener('cancel',e=>{if(state.ended||$('modal-eyebrow').textContent==='EQUATION VERIFIED')e.preventDefault();});
startSolo();
