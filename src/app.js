import {SIZE,CENTER,HAND_SIZE,TURNS_PER_SECTOR,pos,coords,bonusAt,makeTile,makeBag,refill,validateMove,inspectPlacement,scoreMove,nextTarget,BLANK_NUMBER,BLANK_OPERATOR,BLANK_ANY,BLANK_KINDS,isBlank,freeExchangeReason,reorderRack,isOperator,isDigit,resolveBlank} from './engine.js';
import {enableTileDrag,wasDragClick} from './pointer-drag.js';
import {SAVE_KEY,INTRO_KEY,dealPlayableRack,freshStats,freshProgress,recordMove,sectorReport,completeProgress,saveRun,loadRun} from './solo.js';
import {ACTIVE_MODE_KEY,ROGUE_ITEM_BY_ID,ROGUE_ITEMS,makeRogueState,anomalyForSector,targetForSector,shopOffers,purchaseUpgrade,PULSE_ITEM,purchasePulse,consumePulse,rogueRackOptions,rewardSector,scoreRogueMove} from './rogue.js';
import {buildScoringCeremony,ceremonyDurationMs} from './score-ceremony.js';
import {summarizeBag} from './bag-inventory.js';
import {LOCAL_SAVE_KEY,LOCAL_TIMER_OPTIONS,makeLocalMatch,readyLocalTurn,scoreLocalTurn,
 passLocalTurn,exchangeLocalTiles,localStandings,saveLocalMatch,loadLocalMatch,isLocalTimerExpired} from './multiplayer.js';
const $=id=>document.getElementById(id);
const state={
 board:Array(SIZE*SIZE).fill(null),pending:{},rack:[],bag:[],sector:1,score:0,turn:1,
 selected:null,swapping:false,swapSet:new Set(),ended:false,busy:false,
 focusedIndex:pos(CENTER,CENTER),placementOrder:[],recentlyPlaced:null,
 lockedFlash:new Set(),preview:null,modalEpoch:0,phase:'playing',
 stats:freshStats(),progress:freshProgress(),saveAvailable:false,mode:'sector',rogue:null,ceremony:null,
 localMatch:null,localScoringPlayer:null,localDeferPrivacy:false
};
const storage=(()=>{try{return window.localStorage;}catch{return null;}})();
function persistRun(){
  if(state.mode==='local'&&state.localMatch){
    if(state.localMatch.phase==='playing'){
      const players=state.localMatch.players.map((p,i)=>i===state.localMatch.current?
        {...p,rack:state.rack}:p);
      state.localMatch={...state.localMatch,board:state.board,bag:state.bag,
        pending:state.pending,placementOrder:state.placementOrder,players};
    }
    state.saveAvailable=saveLocalMatch(storage,state.localMatch);
  }else if(state.mode==='local'){
    state.saveAvailable=false;
  }else{
    state.saveAvailable=saveRun(storage,state);
  }
  if(state.saveAvailable){try{storage?.setItem(ACTIVE_MODE_KEY,state.mode);}catch{/* storage unavailable */}}
  $('save-status').textContent=state.saveAvailable?'✓ AUTOSAVED':'LOCAL SAVE OFF';
  $('save-status').classList.toggle('unavailable',!state.saveAvailable);
  $('save-status').title=state.saveAvailable?
    'Your current run, rack and unscored tiles are saved on this device.':
    'Your browser could not save this run. Keep this tab open to avoid losing progress.';
}
const names=['ORIGIN','POLARIS','THE OUTER RING','THE VOID','ION STORM','NEBULA','DARK MATTER','BEYOND'];
const isDrift=()=>state.mode==='rogue';
const isLocal=()=>state.mode==='local';
const currentTarget=()=>targetForSector(state.mode,state.sector);
const currentRackOptions=()=>isDrift()?rogueRackOptions(state.rogue):undefined;
const isChargedTile=tile=>isDrift()&&tile&&!tile.blank&&
 ((tile.value==='7'&&state.rogue.upgrades.includes('ion-seven'))||
 (['×','÷'].includes(tile.value)&&state.rogue.upgrades.includes('operator-core')));
const calculateMove=move=>isDrift()?
  scoreRogueMove(state.board,state.pending,move,state.rogue,state.sector):
  scoreMove(state.board,state.pending,move);
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
 if(isDrift()&&(newRun||sector===1||!state.rogue))state.rogue=makeRogueState();
 if(!isDrift())state.rogue=null;
 state.stats=freshStats();state.phase='playing';state.ceremony=null;
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
   const deal=dealPlayableRack([],state.bag,currentRackOptions());
   state.rack=deal.rack;state.bag=deal.bag;
 }
 const anomaly=isDrift()?anomalyForSector(sector):null;
 announce(sector===1?
   (isDrift()?'THE DRIFT begins. Build equations to earn energy, then buy upgrades with Flux.':
     'First mission: try 8 + 4 = 12 through the centre. BIDMAS checks your calculation when you submit.'):
   anomaly?
     `Sector anomaly: ${anomaly.name}. ${anomaly.short}. Build carefully.`:
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
 const [r,c]=coords(i),tile=valueAt(i),pending=!!state.pending[i],locked=!!state.board[i];
 const rawBonus=bonusAt(r,c),anomaly=isDrift()?anomalyForSector(state.sector):null;
 const bonus=isDrift()&&rawBonus==='2T'&&state.rogue.upgrades.includes('amplifier')?'3T':
   isDrift()&&rawBonus==='2E'&&anomaly?.id==='signal-jam'?'JAM':
   isDrift()&&rawBonus==='3T'&&anomaly?.id==='tile-static'?'2T':rawBonus;
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
   inner.className='board-tile'+(isBlank(tile)?' placed-wildcard':'')+
     (pending&&isChargedTile(tile)?' charged-tile':'');
   inner.textContent=tile.value;
   // Keep board symbols completely unobstructed. Point values remain visible
   // on the rack, in the equation breakdown, and in this accessible tooltip.
   if(tile.value!=='=')node.title=`${tile.value} · ${tile.points} tile points${pending&&isChargedTile(tile)?' (+3 upgrade boost)':''}`;
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
 button.className='tile'+(isChargedTile(tile)?' charged-rack-tile':'')+
   (state.selected===tile.id?' selected':'')+
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
 const eligible=freeExchangeReason(state.rack)&&
   !(isLocal()&&state.localMatch?.freeExchangeUsed);
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
 const freeReason=freeExchangeReason(state.rack)&&
   !(isLocal()&&state.localMatch?.freeExchangeUsed);
 $('preview-status').textContent=state.swapping?
   (freeReason?`Choose tiles to replace — ${freeReason}-only rack, no turn used.`:
     'Choose tiles to replace — this uses a turn.'):
   freeReason&&!Object.keys(state.pending).length?
     `Only ${freeReason} in your rack. Free exchange available.`:preview.feedback;
 const points=(!state.swapping&&preview.ready)?calculateMove(preview):null;
 $('potential-score').textContent=points?'+'+points.total:'—';
 $('potential-score').setAttribute('aria-label',points?
   `Potential score ${points.total} if the equation is mathematically correct`:
   'No potential score yet');
}
function formatLocalClock(deadline){
 const seconds=Math.max(0,Math.ceil((deadline-Date.now())/1000));
 return String(Math.floor(seconds/60)).padStart(2,'0')+':'+
   String(seconds%60).padStart(2,'0');
}
function showLocalHandover(){
 if(!isLocal()||!state.localMatch)return;
 const match=state.localMatch;
 const hidden=match.phase==='handover'&&!state.localDeferPrivacy;
 $('local-privacy').hidden=!hidden;
 $('app').dataset.private=String(hidden);
 if(!hidden)return;
 const player=match.players[match.current];
 $('local-handover-title').textContent=player.name+' · YOUR TURN';
 $('local-handover-description').textContent=
   'Pass the device to '+player.name+' first. Tap Ready to reveal this player’s private rack.';
 const last=match.history.at(-1);
 $('local-handover-context').textContent=last?
   (last.type==='score'?
     'Previous move: '+match.players[last.player].name+' scored +'+last.points:
     'Previous move: '+(last.type==='timeout'?'time expired':last.type.replaceAll('-',' ')))+
   ' · Turn '+match.turnNumber:
   'Turn '+match.turnNumber+' · Shared board, private racks';
 $('local-ready-btn').focus({preventScroll:true});
}
function renderLocalStatus(){
 const match=state.localMatch;
 if(!match)return;
 $('app').dataset.mode='local';
 $('app').dataset.anomaly='none';
 $('local-panel').hidden=false;
 $('local-pass-btn').hidden=false;
 $('rogue-summary').hidden=true;
 $('anomaly-banner').hidden=true;
 $('mode-btn').textContent='◈ LOCAL';
 $('footer-mode').textContent='⟡ EQUA//NOVA // LOCAL MULTIPLAYER';
 $('sector-label').textContent=match.phase==='finished'?'LOCAL MATCH · FINAL SCORES':
   state.ceremony&&state.localScoringPlayer!==null?
     'LOCAL MATCH · SCORING':
     'LOCAL MATCH · '+match.players[match.current].name.toUpperCase();
 $('target').textContent='—';
 $('turn').textContent=String(match.turnNumber);
 $('bag-count').textContent=match.bag.length;
 $('bag-details-btn').disabled=state.busy||match.phase!=='playing';
 $('bag-details-btn').setAttribute('aria-label','View '+match.bag.length+' remaining tiles in the shared bag');
 $('score-btn').disabled=state.busy||match.phase!=='playing'||state.swapping||!Object.keys(state.pending).length;
 $('local-pass-btn').disabled=state.busy||match.phase!=='playing';
 $('local-pass-btn').textContent=match.turnSeconds?'↪ PASS / END TURN':'↪ PASS TURN';
 $('new-btn').disabled=false;
 const time=$('local-time-remaining');
 if(match.phase==='playing'&&match.turnSeconds){
   time.textContent=formatLocalClock(match.deadline);
   time.classList.toggle('local-time-urgent',match.deadline-Date.now()<15000);
 }else{
   time.textContent=match.turnSeconds?match.turnSeconds+'s timer':'NO TIMER';
   time.classList.remove('local-time-urgent');
 }
 const scoringIndex=state.ceremony&&state.localScoringPlayer!==null?
   state.localScoringPlayer:match.current;
 const displayScores=match.players.map((p,i)=>i===scoringIndex&&state.ceremony?
   state.ceremony.startScore+state.ceremony.awarded:p.score);
 const leading=Math.max(...displayScores);
 $('local-scores').replaceChildren(...match.players.map((player,index)=>{
   const row=document.createElement('div');
   row.dataset.playerIndex=String(index);
   row.className='local-score-row'+
     (index===scoringIndex&&match.phase!=='finished'?' is-active':'')+
     (player.score===leading&&player.score>0?' is-leader':'');
   const avatar=document.createElement('span');avatar.className='local-score-avatar';avatar.textContent=index+1;
   const name=document.createElement('span');name.className='local-score-name';name.textContent=player.name;
   const points=document.createElement('span');points.className='local-score-points';
   const total=document.createElement('strong');total.textContent=displayScores[index];
   const unit=document.createElement('small');unit.textContent='POINTS';
   points.append(total,unit);
   row.append(avatar,name,points);
   row.setAttribute('aria-label',player.name+': '+displayScores[index]+' points');
   return row;
 }));
 const status=$('local-game-status');
 status.textContent=match.phase==='finished'?
   'Match complete. Remaining rack values have been deducted.':
   match.phase==='handover'?'Privacy handover: next player has not revealed their rack.':
   'Turn '+match.turnNumber+' · '+match.players[match.current].name+' builds an equation.';
 $('run-summary').textContent=match.players.length+' players · '+match.history.filter(x=>x.type==='score').length+' equations';
 $('score').textContent=displayScores[scoringIndex]??0;
 $('progress').style.width='0%';
 $('preview-status').setAttribute('aria-live','polite');
 showLocalHandover();
}
function render(){
 state.preview=inspectPlacement(state.board,state.pending);
 renderBoard();renderRack();renderPreview();
 if(isLocal()){
   renderLocalStatus();
   if(!state.busy)persistRun();
   return;
 }
 $('local-privacy').hidden=true;
 $('app').dataset.private='false';
 $('local-panel').hidden=true;
 $('local-pass-btn').hidden=true;
 const target=currentTarget(),remaining=Math.max(0,target-state.score);
 const turnsAvailable=state.phase==='playing'?
   Math.max(1,TURNS_PER_SECTOR-state.turn+1):0;
 const displayedScore=state.ceremony?
   state.ceremony.startScore+state.ceremony.awarded:state.score;
 $('score').textContent=displayedScore;$('target').textContent=target;
 $('turn').textContent=`${Math.min(state.turn,TURNS_PER_SECTOR)} / ${TURNS_PER_SECTOR}`;
 $('sector-label').textContent=`${isDrift()?'THE DRIFT':'SECTOR'} ${String(state.sector).padStart(2,'0')} · ${names[state.sector-1]||'DEEP SPACE'}`;
 $('app').dataset.mode=state.mode;
 $('app').dataset.anomaly=isDrift()?(anomalyForSector(state.sector)?.id||'none'):'none';
 $('mode-btn').textContent=isDrift()?'◈ THE DRIFT':'◈ SECTOR RUN';
 $('footer-mode').textContent=isDrift()?'⟡ REACTOR ARRAY // THE DRIFT':'⟡ REACTOR ARRAY // SECTOR RUN';
 $('rogue-summary').hidden=!isDrift();
 $('anomaly-banner').hidden=!isDrift()||!anomalyForSector(state.sector);
 if(isDrift()){
   const anomaly=anomalyForSector(state.sector);
   $('flux-count').textContent=String(state.rogue.flux);
   const upgrades=state.rogue.upgrades.map(id=>ROGUE_ITEM_BY_ID[id].name);
   $('upgrade-summary').textContent=(upgrades.length?
     `${upgrades.slice(0,2).join(' · ')}${upgrades.length>2?' · +'+(upgrades.length-2)+' more':''}`:
     'No upgrades equipped yet')+(state.rogue.pulse?' · ⚡ '+state.rogue.pulse+' charge(s)':'');
   if(anomaly){
     $('anomaly-name').textContent=anomaly.icon+' '+anomaly.name;
     $('anomaly-text').textContent=anomaly.short+
       (anomaly.id==='power-leak'&&state.rogue.upgrades.includes('leak-shield')?' · SHIELDED':'');
   }
 }
 $('bag-count').textContent=state.bag.length;
 $('bag-details-btn').disabled=state.busy;
 $('bag-details-btn').setAttribute('aria-label',
   'Show remaining tiles in the bag: '+state.bag.length+' physical tiles');
 $('remaining-label').textContent=state.phase==='won'?'TARGET ACHIEVED':
   state.phase==='lost'?(`${remaining} energy short · try again`):
   `${remaining} to go · about ${Math.ceil(remaining/turnsAvailable)} per remaining turn`;
 $('progress').style.width=Math.min(100,displayedScore/target*100)+'%';
 $('progress').setAttribute('aria-label',`${displayedScore} of ${target} energy displayed`);
 $('equation-preview').classList.toggle('ceremony-active',Boolean(state.ceremony));
 $('ceremony-readout').hidden=!state.ceremony;
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
 if(state.phase==='won')coach.textContent=isDrift()?'Reactor stabilised. Spend Flux in the Salvage Bay.':'Reactor stabilised. Open the sector report to advance.';
 else if(state.phase==='lost')coach.textContent=isDrift()?'Run ended. Review the final report; upgrades reset on a new Drift.':'Review your moves and retry this sector.';
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
 if(!$('modal').open)$('modal').showModal();
}
function showBagInventory(){
 if(state.busy)return;
 const inventory=summarizeBag(state.bag);
 showModal('TILE BAG · SCAN','Tiles remaining in the bag',
   `<div class="bag-overview"><div class="bag-overview-total">
     <strong>${inventory.total}</strong><div><span>PHYSICAL TILES</span>
     <p>Available for future draws and exchanges</p></div></div>
     <div id="bag-inventory-groups" class="bag-inventory-groups"></div>
     <p class="bag-inventory-note">Counts are exact for the current bag. Tiles already on
     the board or in your rack are not included. The equals sign is free and
     unlimited, so it is never drawn from the bag. Future draw order is not shown.</p>
     </div>`,
   [{text:'BACK TO BOARD',primary:true}]);
 const groups=$('bag-inventory-groups');
 for(const group of inventory.groups){
   const section=document.createElement('section');section.className='bag-inventory-group';
   section.setAttribute('aria-label',group.title);
   const heading=document.createElement('div');heading.className='bag-inventory-heading';
   const name=document.createElement('strong');name.textContent=group.title;
   const total=document.createElement('span');total.textContent=group.total+' remaining';
   heading.append(name,total);
   const tiles=document.createElement('div');
   tiles.className='bag-inventory-tiles bag-inventory-'+group.id;
   tiles.setAttribute('role','list');
   for(const entry of group.tiles){
     const item=document.createElement('div');
     item.className='bag-inventory-tile'+(entry.count===0?' is-empty':'');
     if(group.id==='wildcards')item.classList.add('bag-inventory-wildcard');
     item.setAttribute('role','listitem');
     item.setAttribute('aria-label',entry.label+': '+entry.count+' remaining');
     const face=document.createElement('span');face.className='bag-inventory-face';
     face.textContent=entry.symbol;
     const count=document.createElement('strong');count.className='bag-inventory-count';
     count.textContent='×'+entry.count;
     item.append(face,count);
     if(group.id==='wildcards'){
       const caption=document.createElement('small');
       caption.textContent=entry.label.replace('Blank ','');
       item.append(caption);
     }
     tiles.append(item);
   }
   section.append(heading,tiles);
   groups.append(section);
 }
}
$('bag-details-btn').onclick=showBagInventory;
function localStateFromMatch(match,{privateTurn=true}={}){
 state.mode='local';state.localMatch=match;
 state.modalEpoch++;state.ceremony=null;state.localScoringPlayer=null;
 state.localDeferPrivacy=false;state.focusedIndex=pos(CENTER,CENTER);
 state.board=match.board;state.bag=match.bag;state.pending={};
 state.rack=[];state.placementOrder=[];state.selected=null;
 state.swapping=false;state.swapSet.clear();state.recentlyPlaced=null;
 state.lockedFlash.clear();state.ended=match.phase==='finished';
 state.busy=match.phase!=='finished';
 if(match.phase==='finished')state.busy=false;
 announce(match.phase==='finished'?'Local match complete. Review the final standings.':
   privateTurn?'Hot-seat privacy enabled. Hand the device to the next player.':
   'Local multiplayer match ready.');
 persistRun();render();
 if(match.phase==='finished')showLocalResults();
}
function startNewLocalMatch(config){
 try{
   const match=makeLocalMatch(config);
   localStateFromMatch(match);
 }catch(err){
   showModal('MATCH SETUP ERROR','Please check the player settings',
     '<p>'+escapeText(err.message)+'</p>',[{text:'EDIT SETTINGS',primary:true,fn:showLocalSetup}]);
 }
}
function showLocalSetup(){
 const saved=state.localMatch||loadLocalMatch(storage,{privateOnResume:false});
 const players=saved?.players.map(p=>p.name)||['Pilot 1','Pilot 2','Pilot 3','Pilot 4'];
 const count=saved?.players.length||2;
 const seconds=saved?.turnSeconds||0;
 showModal('PASS E · LOCAL MULTIPLAYER','Set up a local match',
   `<div class="local-setup-grid">
    <div class="local-setup-row"><label for="local-player-count">PLAYERS</label>
     <select id="local-player-count" aria-label="Number of players">
       <option value="2">2 players</option><option value="3">3 players</option><option value="4">4 players</option>
     </select></div>
    <div id="local-setup-names" class="local-setup-names"></div>
    <div class="local-setup-row"><label for="local-turn-seconds">TURN TIMER</label>
      <select id="local-turn-seconds">
        <option value="0">Off · take your time</option>
        <option value="60">60 seconds</option>
        <option value="90">90 seconds</option>
        <option value="120">120 seconds</option>
      </select></div>
    <p class="local-setup-tip">One shared 13×13 board, independent 7-tile racks, and a private handover between turns. A match ends when a player goes out with an empty bag, or after two full circuits without a scoring move. Remaining rack points are deducted at the end.</p>
   </div>`,
   [{text:'CANCEL'},{text:'START MATCH →',primary:true,fn:()=>{
     const amount=Number($('local-player-count').value);
     const names=[...$('local-setup-names').querySelectorAll('input')].slice(0,amount).map(input=>input.value);
     const turnSeconds=Number($('local-turn-seconds').value);
     startNewLocalMatch({names,turnSeconds});
   }}]);
 $('local-player-count').value=String(count);
 $('local-turn-seconds').value=String(seconds);
 const wrapper=$('local-setup-names');
 const inputs=[];
 for(let i=0;i<4;i++){
   const row=document.createElement('div');row.className='local-setup-row';
   const label=document.createElement('label');label.textContent='PILOT '+(i+1);
   label.htmlFor='local-player-name-'+i;
   const input=document.createElement('input');
   input.id='local-player-name-'+i;
   input.type='text';input.maxLength=20;input.autocomplete='off';input.value=players[i]||'Pilot '+(i+1);
   row.append(label,input);wrapper.append(row);inputs.push(row);
 }
 const updateCount=()=>{const amount=Number($('local-player-count').value);
   inputs.forEach((row,i)=>{row.hidden=i>=amount;});};
 $('local-player-count').addEventListener('change',updateCount);
 updateCount();
}
function readyLocalPlayer(){
 if(!isLocal()||state.localMatch?.phase!=='handover')return;
 try{
   const match=readyLocalTurn(state.localMatch,Date.now());
   state.localMatch=match;state.board=match.board;state.bag=match.bag;
   state.rack=match.players[match.current].rack;
   state.pending={...match.pending};state.placementOrder=[...match.placementOrder];
   state.selected=null;state.swapping=false;state.swapSet.clear();
   state.recentlyPlaced=null;state.localScoringPlayer=null;
   state.ended=false;state.busy=false;state.localDeferPrivacy=false;
   announce(match.players[match.current].name+
     ' is on the board. Build one valid BIDMAS equation or exchange/pass.');
   render();
   $('board').querySelector('[tabindex="0"]')?.focus({preventScroll:true});
 }catch(err){announce(err.message,true);}
}
$('local-ready-btn').onclick=readyLocalPlayer;
function finishLocalTurn(match,message){
 state.localMatch=match;state.board=match.board;state.bag=match.bag;
 state.pending={};state.rack=[];state.placementOrder=[];
 state.selected=null;state.swapping=false;state.swapSet.clear();
 state.recentlyPlaced=null;state.lockedFlash.clear();
 state.localDeferPrivacy=false;state.localScoringPlayer=null;
 state.busy=match.phase!=='finished';state.ended=match.phase==='finished';
 announce(message);persistRun();render();
 if(match.phase==='finished')showLocalResults();
}
function localPass(reason='pass'){
 if(!isLocal()||state.busy||state.ended)return;
 if(Object.keys(state.pending).length){
   announce('Return unscored tiles to the rack before passing.',true);return;
 }
 try{
   const match=passLocalTurn({...state.localMatch,pending:{},placementOrder:[]},reason);
   const previous=state.localMatch.players[state.localMatch.current].name;
   finishLocalTurn(match,reason==='timeout'?previous+' ran out of time.':
     previous+' passed without scoring.');
 }catch(err){announce(err.message,true);}
}
$('local-pass-btn').onclick=()=>localPass('pass');
function localSwap(){
 if(!isLocal()||state.busy||state.ended)return;
 if(!state.swapping){
   if(Object.keys(state.pending).length){announce('Clear your equation before swapping.',true);return;}
   if(!state.bag.length){announce('No tiles remain in the bag.',true);return;}
   state.swapping=true;state.selected=null;
   announce('Select the rack tiles to exchange. An all-number or all-operator rack gets one free rescue exchange per turn.');
   render();return;
 }
 if(!state.swapSet.size){announce('Select at least one tile for exchange.',true);return;}
 try{
   const oldMatch={...state.localMatch,pending:{},placementOrder:[],
     players:state.localMatch.players.map((p,i)=>i===state.localMatch.current?{...p,rack:state.rack}:p)};
   const {match,free}=exchangeLocalTiles(oldMatch,[...state.swapSet]);
   if(free){
     state.localMatch=match;state.rack=match.players[match.current].rack;
     state.bag=match.bag;state.swapping=false;state.swapSet.clear();state.selected=null;
     announce('Free rescue exchange complete. Your turn continues.');render();
   }else{
     finishLocalTurn(match,'Tiles exchanged. Turn passed to the next player.');
   }
 }catch(err){announce(err.message,true);}
}
function showLocalResults(){
 if(!isLocal()||state.localMatch?.phase!=='finished')return;
 const match=state.localMatch;
 const standing=match.finalScores||localStandings(match);
 const winners=standing.filter(p=>p.winner).map(p=>p.name);
 const summary=match.finishedReason==='stalled'?
   'Two full circuits of passes or paid exchanges ended the match.':
   'A player emptied their rack with no tiles left in the bag.';
 const rows=standing.map(entry=>
  `<div class="local-result-row${entry.winner?' is-winner':''}">
    <span>${entry.winner?'★':entry.rank}</span><strong>${escapeText(entry.name)}</strong>
    <span>${entry.gross}</span><span>−${entry.penalty}</span><span>${entry.net}</span>
   </div>`).join('');
 showModal('MATCH COMPLETE',winners.length===1?
   escapeText(winners[0])+' wins!':'Shared victory!',
   `<p class="local-match-note">${summary}</p>
    <div class="local-result-legend"><span>#</span><span>PILOT</span><span>SCORED</span><span>RACK</span><span>FINAL</span></div>
    <div class="local-result-table">${rows}</div>
    <p class="local-match-note">The highest final score wins. Rack tile values are deducted from each player's earned points. Tied highest scores share the win.</p>`,
   [{text:'CHOOSE MODE',fn:showModeMenu},
    {text:'NEW LOCAL MATCH →',primary:true,fn:showLocalSetup}]);
}
function showLocalReport(){
 if(!isLocal()||!state.localMatch)return;
 const match=state.localMatch;
 if(match.phase==='finished'){showLocalResults();return;}
 const rows=match.players.map((p,i)=>
   `<div class="report-move"><span class="report-turn">P${i+1}</span>
   <strong>${escapeText(p.name)}</strong><span>${p.score} pts</span></div>`).join('');
 const moves=match.history.filter(x=>x.type==='score').slice(-5).reverse().map(x=>
   `<div class="report-move"><span class="report-turn">T${x.turn}</span>
   <strong>${escapeText(x.equation||'Equation')}</strong><span>+${x.points}</span></div>`).join('');
 showModal('LOCAL SCOREBOARD','Match standings',
   `<div class="report-moves">${rows}</div><p class="local-match-note">Scores are provisional. Remaining rack points are subtracted when the game ends.</p>
    <div class="history-heading">RECENT EQUATIONS</div>
    <div class="report-moves">${moves||'<p>No equations scored yet.</p>'}</div>`,
   [{text:'BACK TO MATCH',primary:true}]);
}
function finishLocalPresentation(){
 if(!isLocal())return;
 state.localDeferPrivacy=false;state.localScoringPlayer=null;
 const match=state.localMatch;
 state.busy=match.phase!=='finished';state.ended=match.phase==='finished';
 render();
 if(match.phase==='finished')showLocalResults();
}
function completeTurn(){
 state.pending={};state.selected=null;state.swapping=false;state.swapSet.clear();
 state.placementOrder=[];state.recentlyPlaced=null;
 if(state.score>=currentTarget()){
   state.phase='won';state.ended=true;
   state.progress=completeProgress(state.progress,
     sectorReport(state.sector,state.score,state.turn,state.stats,true,currentTarget()));
   if(isDrift())state.rogue=rewardSector(state.rogue,state.sector,state.score,state.turn).rogue;
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
function showShop(){
 if(!isDrift()||state.phase!=='won')return;
 const offers=shopOffers(state.sector,state.rogue);
 const intro=`<div class="salvage-intro">
 <div class="salvage-flux"><span>FLUX AVAILABLE</span><strong>${state.rogue.flux}</strong></div>
 <div><strong>SECTOR ${state.sector} STABILISED</strong>
 <p>+${state.rogue.lastReward} Flux earned. Buy permanent upgrades, or a single-use capacitor (+12 on the next correct equation). All equipment resets at the end of the run.</p></div>
 </div>
 <div id="salvage-grid" class="salvage-grid" role="group" aria-label="Available Salvage Bay upgrades"></div>
 <p id="salvage-feedback" class="salvage-feedback">Permanent upgrades can be installed once; Pulse Capacitors are consumed by scoring and can be bought repeatedly.</p>`;
 showModal('SALVAGE BAY',`Upgrade before sector ${state.sector+1}`,intro,[
   {text:'RUN REPORT',fn:showRunReport},
   {text:'ENTER NEXT SECTOR →',primary:true,fn:()=>freshSector(state.sector+1)}
 ]);
 const grid=$('salvage-grid');
 if(!offers.length){
   const end=document.createElement('p');
   end.className='salvage-empty';
   end.textContent='All ten upgrades installed. Your build is complete—continue into the next sector.';
   grid.append(end);
 }
 for(const item of offers){
   const card=document.createElement('div');card.className='salvage-card';
   const tag=document.createElement('span');tag.className='salvage-type';tag.textContent=item.kind;
   const icon=document.createElement('div');icon.className='salvage-icon';icon.textContent=item.icon;
   const title=document.createElement('strong');title.textContent=item.name;
   const description=document.createElement('p');description.textContent=item.description;
   const buy=document.createElement('button');buy.type='button';buy.className='salvage-buy';
   buy.textContent=item.cost+' FLUX · '+(state.rogue.flux>=item.cost?'INSTALL':'NOT ENOUGH');
   buy.disabled=state.rogue.flux<item.cost;
   buy.setAttribute('aria-label','Install '+item.name+' for '+item.cost+' Flux');
   buy.onclick=()=>{
     const purchase=purchaseUpgrade(state.rogue,item.id,state.sector);
     if(!purchase.ok){$('salvage-feedback').textContent=purchase.reason;return;}
     state.rogue=purchase.rogue;
     persistRun();render();showShop();
     $('salvage-feedback').textContent=purchase.reason+'. Upgrade equipped for the rest of this run.';
   };
   card.append(tag,icon,title,description,buy);grid.append(card);
 }
 const charge=document.createElement('div');charge.className='salvage-card salvage-consumable';
 const type=document.createElement('span');type.className='salvage-type';type.textContent=PULSE_ITEM.kind;
 const icon=document.createElement('div');icon.className='salvage-icon';icon.textContent=PULSE_ITEM.icon;
 const title=document.createElement('strong');title.textContent=PULSE_ITEM.name+' · '+state.rogue.pulse+'/3';
 const detail=document.createElement('p');detail.textContent=PULSE_ITEM.description;
 const buy=document.createElement('button');buy.className='salvage-buy';buy.type='button';
 buy.textContent=PULSE_ITEM.cost+' FLUX · '+(state.rogue.flux>=PULSE_ITEM.cost&&state.rogue.pulse<3?'CHARGE':'UNAVAILABLE');
 buy.disabled=state.rogue.flux<PULSE_ITEM.cost||state.rogue.pulse>=3;
 buy.setAttribute('aria-label','Buy single-use '+PULSE_ITEM.name+' for '+PULSE_ITEM.cost+' Flux');
 buy.onclick=()=>{
   const p=purchasePulse(state.rogue,state.sector);
   if(!p.ok){$('salvage-feedback').textContent=p.reason;return;}
   state.rogue=p.rogue;
   persistRun();render();showShop();
   $('salvage-feedback').textContent=p.reason+'. It will activate on your next scored equation.';
 };
 charge.append(type,icon,title,detail,buy);
 grid.append(charge);
}
function showSectorOutcome(){
 const won=state.phase==='won';
 const report=sectorReport(state.sector,state.score,state.turn,state.stats,won,currentTarget());
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
 if(isDrift()&&won){showShop();return;}
 if(won){
   showModal('SECTOR STABILISED',`Sector ${state.sector} complete!`,body,[
    {text:'VIEW RUN',fn:showRunReport},
    {text:'NEXT SECTOR →',primary:true,fn:()=>freshSector(state.sector+1)}
   ]);
  }else{
   if(isDrift()){
     showModal('DRIFT SIGNAL LOST',`Run ended in sector ${state.sector}`,body+
       '<p class="rogue-death-note">Your upgrades and remaining Flux reset when you start a new Drift run.</p>',[
       {text:'VIEW RUN',fn:showRunReport},
       {text:'NEW DRIFT',primary:true,fn:()=>freshSector(1,{newRun:true})}
     ]);
     return;
   }
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
 const upgraded=isDrift()?state.rogue.upgrades.map(id=>ROGUE_ITEM_BY_ID[id].name):[];
 const build=isDrift()?`<div class="rogue-report-build">
 <span>AVAILABLE FLUX <strong>${state.rogue.flux}</strong></span>
 <span>EQUIPPED <strong>${upgraded.length}</strong></span></div>
 <p class="report-note">${upgraded.length?'Your build: '+escapeText(upgraded.join(', ')):'No upgrades bought yet.'}</p>`:'';
 const body=`<div class="sector-report"><div class="report-energy"><div><span>SECTORS CLEARED</span><strong>${progress.completed.length}</strong></div>
 <div><span>RUN ENERGY</span><strong>${progress.runPoints}</strong></div></div>
 ${build}
 <p class="report-note">Current sector ${state.sector}: ${state.score} / ${currentTarget()} energy. ${isDrift()?'Drift upgrades and Flux':'Sector Run progress'} save locally on this device.</p>
 <div class="report-moves">${rows||'<p>No sectors cleared yet. Start by reaching your first target.</p>'}</div></div>`;
 const buttons=state.phase==='won'?
   isDrift()?
     [{text:'SALVAGE BAY',primary:true,fn:showShop},
      {text:'NEXT SECTOR →',fn:()=>freshSector(state.sector+1)}]:
     [{text:'BACK TO SECTOR REPORT',fn:showSectorOutcome},
      {text:'NEXT SECTOR →',primary:true,fn:()=>freshSector(state.sector+1)}]:
   state.phase==='lost'?
     isDrift()?
       [{text:'BACK TO REPORT',fn:showSectorOutcome},
        {text:'NEW DRIFT',primary:true,fn:()=>freshSector(1,{newRun:true})}]:
       [{text:'BACK TO REPORT',fn:showSectorOutcome},
        {text:'RETRY SECTOR',primary:true,fn:()=>freshSector(state.sector)}]:
     [{text:'BACK TO GAME',primary:true}];
 showModal('CAPTAIN’S LOG',isDrift()?'The Drift · Your build':'Your reactor run',body,buttons);
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
const ceremonyDelay=ms=>new Promise(resolve=>window.setTimeout(resolve,ms));
function clearCeremonyTile(removePips=false){
 $('board').querySelectorAll('.scoring-lift,.scoring-settled').forEach(cell=>{
   cell.classList.remove('scoring-lift','scoring-settled');
   cell.style.removeProperty('--ceremony-speed');
 });
 // Old point floaters are allowed to finish rising while the next tile lifts.
 // Skip/end removes them immediately so no decoration survives the ceremony.
 if(removePips)$('board').querySelectorAll('.score-pip').forEach(pip=>pip.remove());
}
function setCeremonyReadout(ctl,label){
 const shown=ctl.startScore+ctl.awarded;
 $('score').textContent=String(shown);
 if(isLocal()){
   const row=$('local-scores').querySelector('[data-player-index="'+state.localScoringPlayer+'"] .local-score-points strong');
   if(row)row.textContent=String(shown);
 }else{
   $('progress').style.width=Math.min(100,100*shown/currentTarget())+'%';
   $('progress').setAttribute('aria-label',shown+' of '+currentTarget()+' energy shown');
   $('remaining-label').textContent='TRANSFERRING · '+(ctl.awarded>=0?'+':'')+
     ctl.awarded+' / +'+ctl.total;
 }
 $('ceremony-count').textContent=(ctl.awarded>=0?'+':'')+ctl.awarded;
 $('ceremony-step').textContent=label;
 $('ceremony-tile-count').textContent=ctl.completedTiles+' / '+ctl.tileCount+' TILES';
 $('ceremony-meter-fill').style.width=
   Math.min(100,Math.max(0,100*ctl.awarded/Math.max(1,ctl.total)))+'%';
 const ticker=$('score');ticker.classList.remove('energy-tick');
 void ticker.offsetWidth;ticker.classList.add('energy-tick');
}
function showScoreResult(points,move){
 showModal('EQUATION VERIFIED',`+${points.total} energy`,
   `<p class="equation-result">${escapeText(move.text)}</p>
   <div class="score-breakdown">
   <div><span>Tile points</span><b>${points.base}</b></div>
   <div><span>Equation multiplier</span><b>×${points.multiplier}</b></div>
   <div><span>Equation length</span><b>+${points.length}</b></div>
   <div><span>Completed calculation</span><b>+${points.equation}</b></div>
   <div><span>Connected to board</span><b>+${points.crossing}</b></div>
   <div><span>Full rack bonus</span><b>+${points.sweep}</b></div>
   ${isDrift()?`<div><span>Roguelike upgrades</span><b>+${points.extra}</b></div>
   <div><span>Anomaly penalty</span><b>−${points.anomalyPenalty}</b></div>`:''}
   <div class="total"><span>TOTAL</span><b>${points.total}</b></div></div>
   ${isDrift()&&points.upgrades.length?`<p class="rogue-score-effects">${escapeText(points.upgrades.join(' · '))}</p>`:''}`,
   [isLocal()?
      {text:state.localMatch.phase==='finished'?'FINAL STANDINGS →':'HAND OVER DEVICE →',
       primary:true,fn:finishLocalPresentation}:
      {text:state.phase==='playing'?'CONTINUE →':
        isDrift()&&state.phase==='won'?'SALVAGE BAY →':'VIEW SECTOR REPORT →',
       primary:true,fn:()=>{if(state.phase!=='playing')showSectorOutcome();}}]);
}
function finishScoringCeremony(ctl){
 if(!ctl||state.ceremony!==ctl||ctl.finished)return;
 ctl.finished=true;ctl.awarded=ctl.total;
 clearCeremonyTile(true);
 $('board-frame').classList.remove('ceremony-bonus');
 state.ceremony=null;state.busy=false;state.lockedFlash.clear();
 render();
 showEnergyBurst(ctl.total);
 showScoreResult(ctl.points,ctl.move);
}
async function playScoringCeremony(ctl){
 const active=()=>state.ceremony===ctl&&!ctl.finished&&state.modalEpoch===ctl.epoch;
 if(document.hidden||window.matchMedia('(prefers-reduced-motion: reduce)').matches){
   finishScoringCeremony(ctl);return;
 }
 const duration=ceremonyDurationMs(ctl.tileCount);
 for(const stage of ctl.stages){
   if(!active())return;
   clearCeremonyTile();
   if(stage.kind==='tile'){
     const cell=$('board').querySelector('.cell[data-index="'+stage.index+'"]');
     if(cell){
       cell.style.setProperty('--ceremony-speed',duration+'ms');
       cell.classList.add('scoring-lift');
     }
     setCeremonyReadout(ctl,stage.label+(stage.premium?' · '+stage.premium:''));
     await ceremonyDelay(Math.round(duration*.72));
     if(!active())return;
     if(cell){
       cell.classList.add('scoring-settled');
       const pip=document.createElement('span');pip.className='score-pip';
       pip.textContent=stage.amount?'+'+stage.amount:'+0';
       pip.setAttribute('aria-hidden','true');
       if(stage.amount===0)pip.classList.add('score-pip-zero');
       pip.addEventListener('animationend',()=>pip.remove(),{once:true});
       cell.append(pip);
     }
     ctl.awarded+=stage.amount;ctl.completedTiles++;
     setCeremonyReadout(ctl,stage.amount?
       (stage.existing?'REUSED TILE':'TILE')+' +'+stage.amount:
       stage.label);
     await ceremonyDelay(Math.max(80,Math.round(duration*.28)));
   }else{
     $('board-frame').classList.remove('ceremony-bonus');
     void $('board-frame').offsetWidth;
     $('board-frame').classList.add('ceremony-bonus');
     ctl.awarded+=stage.amount;
     setCeremonyReadout(ctl,stage.label+' '+(stage.amount>0?'+':'')+stage.amount);
     await ceremonyDelay(155);
   }
 }
 if(!active())return;
 await ceremonyDelay(180);
 if(active())finishScoringCeremony(ctl);
}
$('skip-ceremony').onclick=()=>finishScoringCeremony(state.ceremony);
function scoreLocal(){
 if(!isLocal()||state.busy||state.ended||state.swapping)return;
 try{
   const match=state.localMatch;
   const oldIndex=match.current;
   const active={...match,pending:state.pending,placementOrder:state.placementOrder,
     players:match.players.map((p,i)=>i===oldIndex?{...p,rack:state.rack}:p)};
   const {match:updated,points,move}=scoreLocalTurn(active,state.pending);
   const stages=buildScoringCeremony(points);
   const startScore=match.players[oldIndex].score;
   // The complete shared board, the bag and this player's score are committed
   // before any animation; reloading reveals only the next privacy handover.
   state.localMatch=updated;state.board=updated.board;state.bag=updated.bag;
   state.rack=[];state.pending={};state.placementOrder=[];
   state.swapping=false;state.swapSet.clear();state.selected=null;
   state.lockedFlash=new Set(move.indices);
   state.busy=true;state.ended=updated.phase==='finished';
   state.localDeferPrivacy=true;state.localScoringPlayer=oldIndex;
   state.score=updated.players[oldIndex].score;
   const epoch=++state.modalEpoch;
   const ctl={startScore,awarded:0,total:points.total,points,move,stages,
     tileCount:stages.filter(x=>x.kind==='tile').length,
     completedTiles:0,epoch,finished:false};
   state.ceremony=ctl;
   announce(match.players[oldIndex].name+' scored a correct equation! Transferring +'+points.total+' points.');
   persistRun();render();
   setCeremonyReadout(ctl,'READY TO TRANSFER');
   void playScoringCeremony(ctl);
 }catch(err){
   announce(err.message,true);
   $('board').classList.remove('shake');void $('board').offsetWidth;
   $('board').classList.add('shake');
 }
}
function score(){
 if(isLocal())return scoreLocal();
 if(state.ended||state.swapping||state.busy)return;
 try{
   const move=validateMove(state.board,state.pending);
   const points=calculateMove(move);
   // Build the presentation before changing any game state, so a visual
   // breakdown problem cannot turn a verified equation into a lost move.
   const stages=buildScoringCeremony(points);
   const startScore=state.score;
   // Consume single-use charges and commit the whole score atomically before
   // a timer, animation, tab switch or reload can interrupt the presentation.
   if(isDrift())state.rogue=consumePulse(state.rogue);
   const changed=Object.keys(state.pending).map(Number);
   const used=new Set(Object.values(state.pending).filter(t=>t.value!=='=').map(t=>t.id));
   state.stats=recordMove(state.stats,move,points,state.turn,state.pending);
   for(const [i,tile] of Object.entries(state.pending))state.board[Number(i)]=tile;
   state.rack=state.rack.filter(t=>!used.has(t.id));
   const draw=dealPlayableRack(state.rack,state.bag,currentRackOptions());
   state.rack=draw.rack;state.bag=draw.bag;
   state.score+=points.total;
   state.busy=true;
   state.lockedFlash=new Set(changed);
   const epoch=++state.modalEpoch;
   const ctl={startScore,awarded:0,total:points.total,points,move,stages,
     tileCount:stages.filter(stage=>stage.kind==='tile').length,
     completedTiles:0,epoch,finished:false};
   state.ceremony=ctl;
   completeTurn();
   announce('Equation verified. Transferring '+points.total+' energy tile by tile.');
   render();
   setCeremonyReadout(ctl,'READY TO TRANSFER');
   void playScoringCeremony(ctl);
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
 if(isLocal())return localSwap();
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
 const draw=dealPlayableRack(state.rack,state.bag,currentRackOptions());state.rack=draw.rack;state.bag=draw.bag;
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
 if(isLocal()){
   if(state.busy)return;
   showModal('NEW LOCAL MATCH','Replace the current local match?',
     '<p>A new local match replaces this match and its scores, but does not affect Sector Run or The Drift saves.</p>',
     [{text:'KEEP MATCH'},{text:'SET UP NEW MATCH →',primary:true,fn:showLocalSetup}]);
   return;
 }
 if(state.busy)return;
 showModal('RESTART','Start a new run?',
   '<p>A new run replaces your current local save, including your sector and accumulated run points. Your completed sector history will be lost.</p>',
   [{text:'CANCEL'},{text:'NEW RUN',primary:true,fn:()=>freshSector(1,{newRun:true})}]);
};
$('run-report-btn').onclick=()=>{if(!state.busy)(isLocal()?showLocalReport():showRunReport());};
$('run-report-header').onclick=()=>{if(!state.busy)(isLocal()?showLocalReport():showRunReport());};
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
$('help-btn').onclick=()=>isLocal()?showLocalHelp():isDrift()?showDriftIntro():showTraining();
function showLocalHelp(){
 showModal('LOCAL MULTIPLAYER · FLIGHT MANUAL','Build together, compete separately',
   `<div class="training-steps">
   <div class="training-step"><span>01</span><div><strong>Your rack is private</strong>
     <p>Choose 2–4 players. Every turn begins on a secure handover screen. Tap Ready only when the named player holds the device. Never pass the screen while your rack is visible.</p></div></div>
   <div class="training-step"><span>02</span><div><strong>Score on the same board</strong>
     <p>The first correct equation crosses the centre; later ones must join a locked tile. BIDMAS and the free equals sign work as in Solo mode. A wrong equation is not scored. Use Pass Turn if you cannot play.</p></div></div>
   <div class="training-step"><span>03</span><div><strong>Finish on net points</strong>
     <p>Players alternate scoring, exchanging or passing. The match finishes when the bag is empty and a player empties their rack, or after two complete circuits without scoring. Remaining tile points are deducted from each score. The highest net score wins.</p></div></div>
   </div><p class="training-footnote">Timers can be Off, 60, 90 or 120 seconds. Timers begin only when the next player presses Ready, and an expired turn counts as a pass. No online room or login is needed.</p>`,
   [{text:'BACK TO MATCH',primary:true}]);
}
function showDriftIntro(){
 showModal('THE DRIFT · PILOT BRIEFING','An evolving reactor run',
   `<div class="training-steps">
     <div class="training-step"><span>01</span><div><strong>Build accurate equations</strong>
       <p>Every sector still uses the same BIDMAS rules, physical tile rack and premium grid. Reach the energy target within six turns.</p></div></div>
     <div class="training-step"><span>02</span><div><strong>Earn and spend Flux</strong>
       <p>Survive a sector to enter the <strong>Salvage Bay</strong>. Choose permanent upgrades for this run: strengthen sevens, boost crossings, attract wildcards or power up board multipliers.</p></div></div>
     <div class="training-step"><span>03</span><div><strong>Survive anomalies</strong>
       <p>Every third sector disrupts the reactor with a named hazard. If you fail a target, the Drift run ends and you must start again without your upgrades. Sector Run remains available separately.</p></div></div>
   </div><p class="training-footnote">Both game modes have independent automatic saves on this device. You can switch back without losing either run.</p>`,
   [{text:'BEGIN THE DRIFT →',primary:true}]);
}
function restoreMode(mode,{initial=false}={}){
 state.modalEpoch++;
 state.mode=mode;
 const previous=loadRun(storage,mode);
 if(previous){
   Object.assign(state,previous);
   state.mode=mode;
   state.rogue=mode==='rogue'?previous.rogue:null;
   state.ended=state.phase!=='playing';state.busy=false;
   state.swapping=false;state.swapSet.clear();state.selected=null;
   state.recentlyPlaced=null;state.lockedFlash.clear();
   state.focusedIndex=pos(CENTER,CENTER);
   announce(mode==='rogue'?
     'Saved Drift run restored: your upgrades, Flux and rack are intact.':
     'Saved Sector Run restored. Your board, rack, and unfinished placements are ready.');
   render();
   if(state.ended)showSectorOutcome();
 }else{
   state.rogue=mode==='rogue'?makeRogueState():null;
   freshSector(1,{newRun:true});
   if(mode==='rogue')showDriftIntro();
   else if(initial){
     let seen=false;
     try{seen=storage?.getItem(INTRO_KEY)==='seen';}catch{/* no storage */}
     if(!seen)showTraining(true);
   }
 }
}
function chooseMode(mode){
 if(!['sector','rogue','local'].includes(mode))return;
 if(state.busy&&!isLocal())return;
 if(mode==='local'){
   if(isLocal()){if(state.localMatch?.phase==='finished')showLocalResults();return;}
   const previous=loadLocalMatch(storage);
   if(previous)localStateFromMatch(previous);
   else showLocalSetup();
   return;
 }
 if(mode===state.mode){
   if(state.ended)showSectorOutcome();
   return;
 }
 // Private local racks are already persisted; returning requires a new Ready tap.
 state.localDeferPrivacy=false;
 restoreMode(mode);
}
function showModeMenu(){
 if(state.busy&&!isLocal())return;
 showModal('SELECT MODE','Choose your reactor mission',
   `<div class="mode-choice-grid">
    <div class="mode-choice">
     <span class="mode-crest">◈</span><strong>SECTOR RUN</strong>
     <p>Independent classroom practice with rising targets and retries. Your progress is saved separately.</p>
     <small>${state.mode==='sector'?'CURRENT MODE':'SEPARATE SAVE'}</small>
    </div>
    <div class="mode-choice">
     <span class="mode-crest">✧</span><strong>THE DRIFT</strong>
     <p>Win Flux, equip upgrades between sectors, survive anomalies and build a long roguelike run.</p>
     <small>${isDrift()?'CURRENT MODE':'SEPARATE SAVE'}</small>
    </div>
    <div class="mode-choice local-mode-choice">
     <span class="mode-crest">♙</span><strong>LOCAL MATCH</strong>
     <p>Two to four pilots, one shared board and private racks. Compete on the same device.</p>
     <small>${isLocal()?'CURRENT MODE':'SEPARATE SAVE'}</small>
    </div>
   </div>`,
   [{text:'SECTOR RUN',fn:()=>chooseMode('sector')},
    {text:'THE DRIFT',fn:()=>chooseMode('rogue')},
    {text:'LOCAL 2–4 →',primary:true,fn:()=>chooseMode('local')}]);
}
$('mode-btn').onclick=showModeMenu;
$('local-switch-btn').onclick=showModeMenu;
function startSolo(){
 let mode='sector';
 try{const m=storage?.getItem(ACTIVE_MODE_KEY);
   if(['sector','rogue','local'].includes(m))mode=m;
 }catch{/* no storage */}
 if(mode==='local'){
   const saved=loadLocalMatch(storage);
   if(saved){localStateFromMatch(saved);return;}
   mode='sector';
 }
 restoreMode(mode,{initial:true});
}
window.setInterval(()=>{
 if(!isLocal()||!state.localMatch||state.localMatch.phase!=='playing'||state.busy||state.ended)return;
 const match=state.localMatch;
 if(match.turnSeconds===0)return;
 $('local-time-remaining').textContent=formatLocalClock(match.deadline);
 $('local-time-remaining').classList.toggle('local-time-urgent',match.deadline-Date.now()<15000);
 if(!isLocalTimerExpired(match,Date.now()))return;
 const name=match.players[match.current].name;
 // A timeout cancels unscored placement and exchanges without discarding
 // physical rack tiles, then immediately activates the privacy handover.
 const updated={...match,pending:{},placementOrder:[],
   players:match.players.map((p,i)=>i===match.current?{...p,rack:state.rack}:p)};
 finishLocalTurn(passLocalTurn(updated,'timeout'),name+' ran out of time. The turn was passed.');
},250);
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
 }else{
   $('modal').close();
 }
};
$('modal').addEventListener('cancel',e=>{
 if($('modal-eyebrow').textContent==='EQUATION VERIFIED')e.preventDefault();
});
startSolo();
