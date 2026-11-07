import {SIZE,CENTER,HAND_SIZE,TURNS_PER_SECTOR,pos,coords,bonusAt,makeTile,makeBag,randomFloat,refill,tilePool,validateMove,inspectPlacement,scoreMove,nextTarget,BLANK_NUMBER,BLANK_OPERATOR,BLANK_ANY,BLANK_KINDS,isBlank,freeExchangeReason,reorderRack,isOperator,isDigit,resolveBlank} from './engine.js';
import {enableTileDrag,wasDragClick} from './pointer-drag.js';
import {initBoardZoom} from './board-zoom.js';
import {SAVE_KEY,INTRO_KEY,dealPlayableRack,freshStats,freshProgress,recordMove,sectorReport,completeProgress,saveRun,loadRun} from './solo.js';
import {ACTIVE_MODE_KEY,ROGUE_ITEM_BY_ID,ROGUE_ITEMS,TEMP_ITEM_BY_ID,TEMP_ITEMS,
 MAX_PERMANENT_SLOTS,MAX_TEMPORARY_SLOTS,makeRogueState,anomalyForSector,targetForSector,
 shopOffers,shopTemperatures,purchaseUpgrade,purchaseTemporary,purchasePulse,heldConsumables,
 armedConsumable,armTemporary,consumeTemporary,useTileTemporary,earnMoveFlux,consumeBoardEcho,
 freeSwapsRemaining,markFreeSwap,turnLimit,rackSlots,rogueRackOptions,rewardSector,scoreRogueMove} from './rogue.js';
import {equipmentArt} from './equipment-art.js';
import {paintFeedback} from './mission-feedback.js';
import {salvageWorkshopMarkup,mountSalvageWorkshop} from './salvage-workshop.js';
import {renderDriftHud} from './drift-hud.js';
import {paintReactorIndicators,paintReactorTransfer} from './reactor-presentation.js';
import {zoneInfo,ensureZoneBoss,bossForSector,bossField,isBossSector,selectForcedTile,resolveBossScore,restrictedDraws} from './drift-bosses.js';
import {bossArtwork,zoneSceneUrl} from './boss-art.js';
import {renderZoneStrip,zoneMapMarkup,bossIntroMarkup,zoneVictoryMarkup,zoneIntermissionMarkup} from './drift-map.js';
import {TILE_SETS,TILE_SET_BY_ID,TILE_SET_STORAGE_KEY,normalizeTileSet,hasBracketPair,kitNumberSlots,kitRackSize,kitRackOptions} from './tile-sets.js';
import {renderTileFace,tileFaceClass} from './tile-face.js';
import {buildScoringCeremony,ceremonyDurationMs} from './score-ceremony.js';
import {summarizeBag} from './bag-inventory.js';
import {LOCAL_SAVE_KEY,LOCAL_TIMER_OPTIONS,makeLocalMatch,readyLocalTurn,scoreLocalTurn,
 passLocalTurn,exchangeLocalTiles,localStandings,saveLocalMatch,loadLocalMatch,isLocalTimerExpired,
  finishTimedMatch,isGameTimerExpired} from './multiplayer.js';
import {distinctOpening,openingPattern,loadOpeningPattern,rememberOpening} from './random-start.js';
import {shuffleAvailableRack} from './rack-shuffle.js';
import {PILOT_PRESET_NAMES,defaultPilotAlien,getSavedPilotAlien,
 nextRandomPilotAlien,safePilotAlien} from './alien/profiles.js';
import {loadPilotArtwork,paintPilotAvatar} from './alien/badges.js';
import {bindSoloRun,emitSoloAchievement,soloScoredEvidence,soloClearEvidence} from './achievements/solo-adapter.js';
import {achievementRevealMarkup,showAchievementToast} from './achievements/celebration.js';
import {loadPilots,assignLocalSeats} from './achievements/pilots.js';
import {ensureActivePilot,ensureLocalSeatPilots} from './achievements/auto-pilot.js';
import {createLocalBinding,loadLocalBinding,awardLocalTransition,
 awardLocalStart,awardLocalFinish} from './achievements/local-adapter.js';
const $=id=>document.getElementById(id);
const state={
 board:Array(SIZE*SIZE).fill(null),pending:{},rack:[],bag:[],sector:1,score:0,turn:1,
 selected:null,swapping:false,swapSet:new Set(),freeSwapTurn:0,ended:false,busy:false,
 focusedIndex:pos(CENTER,CENTER),placementOrder:[],recentlyPlaced:null,
 lockedFlash:new Set(),preview:null,modalEpoch:0,phase:'playing',
 stats:freshStats(),progress:freshProgress(),saveAvailable:false,mode:'sector',rogue:null,ceremony:null,
 localMatch:null,localScoringPlayer:null,localDeferPrivacy:false,itemTarget:null,bossGrid:null,tileSet:'natural',saveWarningShown:false
};
const storage=(()=>{try{return window.localStorage;}catch{return null;}})();
ensureActivePilot(storage);
let achievementRun=null;
let pendingSoloAwards=[];
function startAchievementRun(fresh=false){
 if(state.mode==='local')return;
 achievementRun=bindSoloRun(storage,{mode:state.mode==='rogue'?'drift':'sector',
  startedAt:state.progress.startedAt,fresh});
 const pilot=loadPilots(storage).registry.pilots.find(p=>p.id===achievementRun?.pilotId);
 const label=$('achievement-pilot');
 if(label)label.textContent=pilot?'EARNING FOR '+pilot.name.toUpperCase():'GUEST RUN · NO PERMANENT REWARDS';
 pendingSoloAwards=[];
}
function awardSolo(type,suffix,data,{defer=false,quiet=false}={}){
 if(state.mode==='local')return [];
 const result=emitSoloAchievement(storage,achievementRun,{type,suffix,data});
 if(result.awarded.length){
  if(defer)pendingSoloAwards.push(...result.awarded);
  else if(!quiet)showAchievementToast(result.awarded);
 }
 return result.awarded;
}
function takeSoloAwards(){const awards=pendingSoloAwards;pendingSoloAwards=[];return awards;}

let localSetupAliens=[];
let localSetupOwnerIds=[null,null,null,null];
let pendingLocalAwards=[],localFinalAwards=[];
function takeLocalAwards(){const awards=pendingLocalAwards;pendingLocalAwards=[];return awards;}
function recordLocalFinish(match){
 if(match.phase!=='finished')return;
 const earned=awardLocalFinish(storage,match);
 localFinalAwards=earned.flatMap((result,seat)=>result.awarded?.length?[{seat,awards:result.awarded}]:[]);
}
function localFinishMarkup(){
 return localFinalAwards.map(({seat,awards})=>
  '<div class="local-achievement-owner"><strong>'+escapeText(state.localMatch.players[seat].name)+
  ' · PILOT '+(seat+1)+'</strong>'+achievementRevealMarkup(awards)+'</div>').join('');
}
let localSetupBadges=()=>{};
function prepareLocalArtwork(){
 void loadPilotArtwork().then(()=>{
   if(isLocal()&&state.localMatch){
     renderLocalStatus();
     if(state.localMatch.phase==='handover')showLocalHandover();
   }
   localSetupBadges();
 });
}
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
  const saveDescription=state.saveAvailable?
    'Your current run, rack and unscored tiles are saved on this device.':
    'Your browser could not save this run. Keep this tab open to avoid losing progress.';
  $('save-status').title=saveDescription;
  $('save-status').setAttribute('aria-label',saveDescription);
  if(!state.saveAvailable&&!state.saveWarningShown){
    state.saveWarningShown=true;
    announce('LOCAL SAVE UNAVAILABLE. Keep this tab open; your progress may be lost on refresh.',true);
  }else if(state.saveAvailable&&state.saveWarningShown){
    state.saveWarningShown=false;
    announce('Local saving restored. Your current run is saved on this device.',false,'success');
  }
}
const names=['ORIGIN','POLARIS','THE OUTER RING','THE VOID','ION STORM','NEBULA','DARK MATTER','BEYOND'];
const isDrift=()=>state.mode==='rogue';
const isLocal=()=>state.mode==='local';
const currentTarget=()=>targetForSector(state.mode,state.sector,state.rogue);
const maxTurns=()=>isDrift()?turnLimit(state.rogue):TURNS_PER_SECTOR;
const rackCapacity=()=>isDrift()?rackSlots(state.rogue):kitRackSize(state.tileSet);
const currentRackOptions=()=>isDrift()?rogueRackOptions(state.rogue,state.sector):kitRackOptions(state.tileSet);
const isChargedTile=tile=>isDrift()&&tile&&!tile.blank&&
 ((tile.value==='7'&&state.rogue.upgrades.includes('ion-seven'))||
 (['×','÷'].includes(tile.value)&&state.rogue.upgrades.includes('operator-core')));
const calculateMove=move=>isDrift()?
  scoreRogueMove(state.board,state.pending,move,state.rogue,state.sector):
  scoreMove(state.board,state.pending,move,{rackSize:rackCapacity()});
function announce(message,isError=false,tone='info'){
 paintFeedback($('log'),message,isError?'error':tone);
 $('footer-text').textContent=message.toUpperCase();
 if(isError){
   $('equation-preview').dataset.state='error';
   $('preview-status').textContent=message;
 }
}
function freshSector(sector=1,{newRun=false}={}){
 state.modalEpoch++;
 if(newRun||sector===1||!state.progress)state.progress=freshProgress();
 if(isDrift()&&(newRun||sector===1||!state.rogue))state.rogue=makeRogueState(state.tileSet);
 if(isDrift())state.rogue.tileSet=state.tileSet;
 if(!isDrift())state.rogue=null;
 if(isDrift()){
   state.rogue=ensureZoneBoss(state.rogue,sector,randomFloat);
   state.rogue={...state.rogue,echoed:[],swapTurn:0,swapsUsed:0,forcedTile:null};
 }
 state.itemTarget=null;
 state.stats=freshStats();state.phase='playing';state.ceremony=null;
 state.board=Array(SIZE*SIZE).fill(null);state.pending={};state.sector=sector;
 state.turn=1;state.score=0;state.freeSwapTurn=0;state.ended=false;state.busy=false;
 state.selected=null;state.swapping=false;state.swapSet.clear();
 state.placementOrder=[];state.lockedFlash.clear();state.recentlyPlaced=null;
 state.focusedIndex=pos(CENTER,CENTER);
 // Each fresh board starts from a fully shuffled 151-tile bag. We then
 // draw a balanced but randomly ordered hand, rather than the old fixed
 // tutorial hand. Consecutive openings are never visibly identical.
 const deal=distinctOpening(()=>{
   const bag=makeBag(randomFloat,state.tileSet);
   return dealPlayableRack([],bag,currentRackOptions());
 },loadOpeningPattern(storage,state.mode),
   game=>game.rack,(game,rack)=>({...game,rack}));
 state.rack=deal.rack;state.bag=deal.bag;
 state.bossGrid=isDrift()?bossField(state.rogue,sector):null;
 if(newRun||sector===1)startAchievementRun(true);
 if(isDrift())state.rogue=selectForcedTile(state.rogue,sector,state.rack,randomFloat);
 rememberOpening(storage,state.mode,state.rack);
 const anomaly=isDrift()?anomalyForSector(sector,state.rogue):null;
 announce(sector===1?
   (isDrift()?'THE DRIFT begins. Build equations to earn energy, then buy upgrades with Flux.':
     'First mission: use your shuffled tiles to create a true equation through the glowing centre. BIDMAS checks it when you submit.'):
   anomaly?
     `Sector anomaly: ${anomaly.name}. ${anomaly.short}. Build carefully.`:
     'New sector online. Use the centre to begin and aim for the new energy target.');
 $('board-frame').classList.remove('reactor-scored');
 render();
 if(isDrift()&&isBossSector(sector))showBossEncounter();
}
const valueAt=i=>state.pending[i]||state.board[i];
function selectTile(id){
 if(state.ended||state.swapping||state.busy)return;
 if(state.itemTarget){applyTileTemporary(id);return;}
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
 if(isDrift()&&state.bossGrid?.blocked.has(index)){
   announce('The Grid Warden has blocked that square.',true);return;
 }
 // Replacing a pending tile returns the displaced physical tile to the rack.
 state.pending[index]=tile;
 state.placementOrder=state.placementOrder.filter(i=>i!==index);
 state.placementOrder.push(index);
 state.recentlyPlaced=index;state.selected=null;render();
}
function placePayload(payload,index){
 if(state.ended||state.swapping||state.busy||!Number.isInteger(index)||index<0||index>=SIZE*SIZE)return;
 if(state.board[index]){announce('This tile is locked. Choose an empty square.',true);return;}
 if(isDrift()&&state.bossGrid?.blocked.has(index)){
   announce('A boss blockade prevents placing tiles on that square.',true);return;
 }
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
 if(isDrift()&&state.bossGrid?.blocked.has(index)){
   announce('This square is blocked by the boss.',true);return;
 }
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
 const rawBonus=bonusAt(r,c),anomaly=isDrift()?anomalyForSector(state.sector,state.rogue):null;
 const blocked=Boolean(isDrift()&&state.bossGrid?.blocked.has(i));
 const rift=Boolean(isDrift()&&state.bossGrid?.rifts.has(i));
 const bonus=isDrift()&&anomaly?.id==='multiplier-leech'&&rawBonus==='2T'?'NO':
   isDrift()&&rawBonus==='2T'&&state.rogue.upgrades.includes('amplifier')?'3T':
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
   (state.lockedFlash.has(i)?' locked-flash':'')+
   (blocked?' boss-blocked':'')+(rift?' boss-rift':'');
 node.setAttribute('role','gridcell');
 node.setAttribute('aria-label',`Row ${r+1}, column ${c+1}: ${blocked?'BLOCKED':rift?'RIFT minus six energy':tile?tile.value:bonus||'empty'}${tile&&tile.value!=='='?', '+tile.points+' tile points':''}${pending?', unscored':''}`);
 node.dataset.index=String(i);
 node.dataset.locked=String(locked);
 node.tabIndex=state.focusedIndex===i?0:-1;
 if(tile){
   const inner=document.createElement('span');
   inner.className='board-tile'+(isBlank(tile)?' placed-wildcard':'')+
     (tileFaceClass(tile.value)?' '+tileFaceClass(tile.value):'')+
     (pending&&isChargedTile(tile)?' charged-tile':'');
   renderTileFace(inner,tile.value);
   // Keep board symbols completely unobstructed. Point values remain visible
   // on the rack, in the equation breakdown, and in this accessible tooltip.
   if(tile.value!=='=')node.title=`${tile.value} · ${tile.points} tile points${pending&&isChargedTile(tile)?' (+3 upgrade boost)':''}`;
   node.append(inner);
 }else if(blocked){
   const label=document.createElement('span');label.className='boss-cell-label';label.textContent='⊠';node.append(label);
 }else if(rift){
   const label=document.createElement('span');label.className='boss-cell-label';label.textContent='−6';node.append(label);
 }else if(bonus){
   const label=document.createElement('span');label.className='bonus-label';
   label.textContent=bonus==='START'?'✳':bonus;node.append(label);
 }
 if(isDrift()&&locked&&tile.value!=='='&&state.rogue.upgrades.includes('bonus-echo')&&
    ['2T','3T','2E','3E'].includes(rawBonus)){
   const spent=(state.rogue.echoed||[]).includes(i);
   node.classList.add(spent?'second-spark-spent':'second-spark-ready');
   const note=spent?'Second Spark already used here this sector.':
     'Second Spark ready: this premium can reactivate once when crossed.';
   node.title=(node.title?node.title+' · ':'')+note;
   node.setAttribute('aria-label',node.getAttribute('aria-label')+'. '+note);
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
 button.className='tile'+(state.itemTarget?' consumable-target':'')+(isChargedTile(tile)?' charged-rack-tile':'')+
   (state.selected===tile.id?' selected':'')+
   (state.swapping&&state.swapSet.has(tile.id)?' marked':'')+
   (isBlank(tile)?' wildcard wildcard-'+tile.blank:'')+
   (tileFaceClass(tile.value)?' '+tileFaceClass(tile.value):'')+
   (isDrift()&&state.rogue.forcedTile===tile.id?' boss-required':'');
 button.dataset.tileId=tile.id;
 button.dataset.rackIndex=String(rackIndex);
 button.setAttribute('aria-label',isBlank(tile)?
   `Blank ${BLANK_KINDS[tile.blank].label.toLowerCase()}: choose a value when placing, zero tile points`:
   `Tile ${tile.value}, worth ${tile.points} points`);
 if(isDrift()&&state.rogue.forcedTile===tile.id)
   button.setAttribute('aria-label',button.getAttribute('aria-label')+'. REQUIRED BY BOSS in your next equation.');
 button.setAttribute('aria-pressed',String(state.selected===tile.id||state.swapSet.has(tile.id)));
 const main=document.createElement('span');renderTileFace(main,isBlank(tile)?BLANK_KINDS[tile.blank].symbol:tile.value);
 const points=document.createElement('sub');
 points.textContent=isBlank(tile)?({[BLANK_NUMBER]:'N',[BLANK_OPERATOR]:'OP',[BLANK_ANY]:'ALL'})[tile.blank]:tile.points;
 button.append(main,points);
 button.addEventListener('click',event=>{
   if(wasDragClick(event))return;
   if(state.itemTarget){applyTileTemporary(tile.id);return;}
   if(state.swapping){
     if(tile.pairId){
       const pair=state.rack.filter(t=>t.pairId===tile.pairId);
       const marked=pair.every(t=>state.swapSet.has(t.id));
       pair.forEach(t=>marked?state.swapSet.delete(t.id):state.swapSet.add(t.id));
     }else state.swapSet.has(tile.id)?state.swapSet.delete(tile.id):state.swapSet.add(tile.id);
     renderRack();return;
   }
   selectTile(tile.id);
 });
 if(!state.itemTarget&&!state.swapping&&!state.busy)enableTileDrag(button,{kind:'rack',id:tile.id},onTileDrop);
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
 $('rack-count').textContent=`${available.length} / ${rackCapacity()}`;
 $('equals-tile').classList.toggle('selected',state.selected==='equals');
 $('equals-tile').setAttribute('aria-pressed',String(state.selected==='equals'));
 $('equals-tile').disabled=state.ended||state.swapping||state.busy;
 const eligible=Boolean(freeExchangeReason(state.rack))&&state.swapSet.size<=1&&
   (isLocal()?!state.localMatch?.freeExchangeUsed:
     isDrift()?freeSwapsRemaining(state.rogue,state.turn,state.freeSwapTurn)>0:state.freeSwapTurn!==state.turn);
 $('swap-btn').textContent=state.swapping?
   `⇄ CONFIRM ${eligible?'FREE ':''}SWAP (${state.swapSet.size})`:
   eligible?'⇄ FREE TILE SWAP'+(isDrift()&&freeSwapsRemaining(state.rogue,state.turn,state.freeSwapTurn)>1?' ×2':''):'⇄ SWAP TILES';
 $('swap-btn').classList.toggle('free-exchange',Boolean(eligible));
 $('swap-btn').disabled=state.ended||state.busy||state.bag.length===0;
 $('score-btn').disabled=state.ended||state.swapping||state.busy||!Object.keys(state.pending).length;
 $('undo-btn').textContent=state.swapping?'× CANCEL':'× CLEAR';
 $('undo-btn').disabled=state.busy||state.ended||(!state.swapping&&!state.itemTarget&&
   !state.selected&&!Object.keys(state.pending).length);
 $('shuffle-rack-btn').disabled=state.busy||state.ended||state.swapping||Boolean(state.itemTarget)||available.length<2;
 $('undo-last-btn').disabled=state.ended||state.busy||!state.placementOrder.length;
 $('new-btn').disabled=state.busy;
}
function renderPreview(){
 const preview=state.preview;
 const box=$('equation-preview');
 box.dataset.state=state.swapping?'swap':preview.status;
 $('preview-equation').textContent=state.swapping?'TILE EXCHANGE':preview.text||'—';
 const freeReason=Boolean(freeExchangeReason(state.rack))&&state.swapSet.size<=1&&
   (isLocal()?!state.localMatch?.freeExchangeUsed:
     isDrift()?freeSwapsRemaining(state.rogue,state.turn,state.freeSwapTurn)>0:state.freeSwapTurn!==state.turn);
 $('preview-status').textContent=state.swapping?
   (freeReason?'Choose exactly one tile for your free swap; multiple tiles cost a turn.':
     'Choose tiles to replace — this uses a turn.'):
   freeReason&&!Object.keys(state.pending).length?
     isDrift()&&freeSwapsRemaining(state.rogue,state.turn,state.freeSwapTurn)>1?
       'Two separate free single-tile swaps available this turn.':
       'One free single-tile swap available this turn.':preview.feedback;
 let points=null;
 if(!state.swapping&&preview.ready){
   try{points=calculateMove(preview);}catch(error){
     $('preview-status').textContent=error.message;
     box.dataset.state='error';
   }
 }
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
 $('app').inert=hidden; // prevent keyboard/screen-reader access to private rack underneath
 if(!hidden)return;
 const player=match.players[match.current];
 paintPilotAvatar($('local-handover-avatar'),player.avatar,match.current,
   {size:108,framing:'bust'});
 $('local-handover-avatar').classList.add('alien-handover-avatar');
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
 if(match.gameDeadline)$('local-handover-context').textContent+=' · Game '+formatLocalClock(match.gameDeadline);
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
 $('mode-btn').textContent='⌂ HOME';
 $('footer-mode').textContent='⟡ EQUA//NOVA // LOCAL MULTIPLAYER';
 $('sector-label').textContent=match.phase==='finished'?'LOCAL MATCH · '+TILE_SET_BY_ID[state.tileSet].short.toUpperCase()+' · FINAL SCORES':
   state.ceremony&&state.localScoringPlayer!==null?
     'LOCAL MATCH · SCORING':
     'LOCAL MATCH · '+TILE_SET_BY_ID[state.tileSet].short.toUpperCase()+' · '+match.players[match.current].name.toUpperCase();
 $('target').textContent='—';
 $('turn').textContent=String(match.turnNumber);
 $('bag-count').textContent=match.bag.length;
 $('bag-details-btn').disabled=state.busy||match.phase!=='playing';
 $('bag-details-btn').setAttribute('aria-label','View '+match.bag.length+' remaining tiles in the shared bag');
 $('score-btn').disabled=state.busy||match.phase!=='playing'||state.swapping||!Object.keys(state.pending).length;
 $('local-pass-btn').disabled=state.busy||match.phase!=='playing';
 $('local-pass-btn').textContent='↪ PASS';
 $('score-btn').querySelector('strong').textContent='⚡ SCORE';
 $('undo-btn').textContent=state.swapping?'× CANCEL':'× CLEAR';
 const eligible=!match.freeExchangeUsed&&state.swapSet.size<=1;
 $('swap-btn').textContent=state.swapping?
   '⇄ CONFIRM'+(eligible?' FREE':''):'⇄ '+(eligible?'FREE SWAP':'SWAP');
 $('new-btn').disabled=false;
 const gameClock=$('local-game-remaining');
 gameClock.textContent=match.gameDeadline?formatLocalClock(match.gameDeadline):
   match.gameSeconds?Math.ceil(match.gameSeconds/60)+' min game':'NO GAME LIMIT';
 gameClock.classList.toggle('local-time-urgent',match.gameDeadline>0&&match.gameDeadline-Date.now()<60000);
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
   const avatar=document.createElement('span');avatar.className='local-score-avatar';
   paintPilotAvatar(avatar,player.avatar,index,{size:38,framing:'portrait'});
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
 $('energy-progress').setAttribute('role','presentation');
 $('energy-progress').removeAttribute('aria-valuenow');
 $('energy-progress').removeAttribute('aria-valuemax');
 $('preview-status').setAttribute('aria-live','polite');
 showLocalHandover();
}
function showEquipmentInfo(item){
 if(state.busy)return;
 showModal(item.kind,item.name,
   '<div class="equipment-info-art">'+equipmentArt(item.id)+'</div><p>'+item.description+
   '</p><p>Installed until the end of your current Drift run.</p>',
   [{text:'BACK TO BOARD',primary:true}]);
}
function activateTemporary(id){
 if(!isDrift()||state.busy||state.ended||state.swapping)return;
 const item=TEMP_ITEM_BY_ID[id];
 if(!item||!heldConsumables(state.rogue).includes(id))return;
 if(Object.keys(state.pending).length){
   announce('Clear unscored tiles before activating equipment.',true);return;
 }
 if(item.action==='score'){
   const armed=armTemporary(state.rogue,id);
   if(!armed.ok){announce(armed.reason,true);return;}
   state.rogue=armed.rogue;state.itemTarget=null;
   announce(item.name+' armed for your next correctly scored equation.');render();return;
 }
 state.itemTarget=state.itemTarget===id?null:id;
 state.selected=null;
 announce(state.itemTarget?'Choose a rack tile for '+item.name+'. No turn will be used.':
   'Power-up selection cancelled.');render();
}
function applyTileTemporary(tileId){
 if(!isDrift()||!state.itemTarget||state.busy||state.ended)return;
 if(state.rogue.forcedTile===tileId){announce('This tile is claimed by the boss. It must be used in an equation.',true);return;}
 const result=useTileTemporary(state.rogue,state.rack,state.bag,state.itemTarget,tileId);
 if(!result.ok){announce(result.reason,true);return;}
 const replacement=result.rack.find(t=>!state.rack.some(old=>old.id===t.id));
 if(replacement&&restrictedDraws(state.rogue,state.sector).includes(replacement.value)){
   announce('That operator is sealed from the bag by the boss.',true);return;
 }
 const consumedGadget=state.itemTarget;
 state.rogue=result.rogue;state.rack=result.rack;state.bag=result.bag;
 state.itemTarget=null;state.selected=null;
 persistRun();
 awardSolo('gadget-used','s'+state.sector+'-t'+state.turn+'-use-'+consumedGadget,{gadgetId:consumedGadget});
 announce(result.reason+'. Power-up consumed without spending a turn.');
 render();
}
function render(){
 $('achievement-hangar-link').hidden=isLocal();
 state.preview=inspectPlacement(state.board,state.pending);
 $('app').dataset.tileSet=state.tileSet;
 $('app').dataset.bracketKit=String(hasBracketPair(state.tileSet));
 $('operator-rules-note').textContent=state.tileSet==='advanced'?
   'Use +, −, ×, ÷, powers (^), roots (√) or factorials (!). Brackets are linked pairs; equals is unlimited.':
   hasBracketPair(state.tileSet)?
     'Use +, −, × or ÷ with positive fractions and linked bracket pairs. Equals is unlimited.':
     'Use +, −, × or ÷. Equals signs are unlimited and free.';
 renderBoard();renderRack();renderPreview();
 paintReactorIndicators({
   preview:state.preview,phase:state.phase,swapping:state.swapping,
   ceremony:Boolean(state.ceremony),mode:state.mode,
   score:state.score,target:isLocal()?null:currentTarget()
 });
 renderDriftHud(isDrift()?state.rogue:null,state.itemTarget,activateTemporary,showEquipmentInfo);
 renderZoneStrip(isDrift()?state.rogue:null,state.sector,state.phase,showZoneMap);
 // Both solo and local competition share the same scoring ceremony display.
 $('equation-preview').classList.toggle('ceremony-active',Boolean(state.ceremony));
 $('ceremony-readout').hidden=!state.ceremony;
 if(isLocal()){
   renderLocalStatus();
   if(!state.busy)persistRun();
   return;
 }
 $('local-privacy').hidden=true;
 $('app').dataset.private='false';
 $('app').inert=false;
 $('local-panel').hidden=true;
 $('local-pass-btn').hidden=true;
 $('score-btn').querySelector('strong').textContent='⚡ SCORE EQUATION';
 const target=currentTarget(),remaining=Math.max(0,target-state.score);
 const turnsAvailable=state.phase==='playing'?
   Math.max(1,maxTurns()-state.turn+1):0;
 const displayedScore=state.ceremony?
   state.ceremony.startScore+state.ceremony.awarded:state.score;
 $('score').textContent=displayedScore;$('target').textContent=target;
 $('turn').textContent=`${Math.min(state.turn,maxTurns())} / ${maxTurns()}`;
 $('sector-label').textContent=isDrift()?`THE DRIFT ${String(state.sector).padStart(2,'0')} · ZONE ${zoneInfo(state.rogue,state.sector).number} · ${zoneInfo(state.rogue,state.sector).name.toUpperCase()}`:
   `SECTOR ${String(state.sector).padStart(2,'0')} · ${names[state.sector-1]||'DEEP SPACE'}`;
 $('app').dataset.mode=state.mode;
 $('app').dataset.tileSet=state.tileSet;
 $('app').dataset.bracketKit=String(hasBracketPair(state.tileSet));
 $('tile-set-btn').textContent='◇ '+TILE_SET_BY_ID[state.tileSet].short.toUpperCase();
 $('tile-set-btn').setAttribute('aria-label','Select maths tile set, currently '+TILE_SET_BY_ID[state.tileSet].title);
 $('app').dataset.expandedRack=String(isDrift()&&rackCapacity()>HAND_SIZE);
 $('app').dataset.anomaly=isDrift()?(anomalyForSector(state.sector,state.rogue)?.id||'none'):'none';
 $('mode-btn').textContent='⌂ HOME';
 $('footer-mode').textContent=isDrift()?'⟡ REACTOR ARRAY // THE DRIFT':'⟡ REACTOR ARRAY // SECTOR RUN';
 $('rogue-summary').hidden=!isDrift();
 $('drift-loadout').hidden=!isDrift();
 $('anomaly-banner').hidden=!isDrift()||!anomalyForSector(state.sector,state.rogue);
 if(isDrift()){
   const anomaly=anomalyForSector(state.sector,state.rogue);
   $('flux-count').textContent=String(state.rogue.flux);
   const upgrades=state.rogue.upgrades.map(id=>ROGUE_ITEM_BY_ID[id].name);
   $('upgrade-summary').textContent=(upgrades.length?
     `${upgrades.slice(0,2).join(' · ')}${upgrades.length>2?' · +'+(upgrades.length-2)+' more':''}`:
     'No upgrades equipped yet')+(state.rogue.pulse?' · ⚡ '+state.rogue.pulse+' charge(s)':'');
   if(anomaly){
     $('boss-banner-art').innerHTML=bossArtwork(anomaly.id);
     const scene=zoneSceneUrl(anomaly.id);
     if(scene&&$('anomaly-scene').getAttribute('src')!==scene)$('anomaly-scene').src=scene;
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
 $('energy-progress').setAttribute('role','progressbar');
 $('energy-progress').setAttribute('aria-valuemin','0');
 $('energy-progress').setAttribute('aria-valuemax',String(target));
 $('energy-progress').setAttribute('aria-valuenow',String(Math.max(0,Math.min(target,displayedScore))));
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
 if(state.phase==='won')coach.textContent=isDrift()?'Sector cleared. Review your results and zone route, or visit the Salvage Bay.':'Reactor stabilised. Open the sector report to advance.';
 else if(state.phase==='lost')coach.textContent=isDrift()?'Run ended. Review the final report; upgrades reset on a new Drift.':'Review your moves and retry this sector.';
 else if(state.swapping)coach.textContent=
   isDrift()&&freeSwapsRemaining(state.rogue,state.turn,state.freeSwapTurn)>1?
     'Exchange License: two separate free one-tile swaps this turn.':
     'Choose which rack tiles to replace.';
 else if(state.board.every(t=>!t)&&!placed)coach.textContent=
   'START · Your first equation must cross the glowing centre.';
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
function showZoneMap(){
 if(!isDrift())return;
 const earned=awardSolo('zone-map-opened','zone-map-first',{}, {quiet:true});
 const returnAction=state.phase==='won'?showSectorOutcome:
   state.phase==='lost'?showSectorOutcome:undefined;
 showModal('GALACTIC ROUTE','The Drift · Zone Map',
   zoneMapMarkup(state.rogue,state.sector,state.phase)+achievementRevealMarkup(earned),
   [{text:'BACK TO '+(state.phase==='won'?'ROUND RESULTS':state.phase==='lost'?'REPORT':'BOARD'),primary:true,fn:returnAction}]);
}
function showBossEncounter(){
 if(!isDrift()||!isBossSector(state.sector))return;
 const info=zoneInfo(state.rogue,state.sector);
 showModal('BOSS APPROACH · ZONE '+info.number,
   info.boss.name,
   bossIntroMarkup(state.rogue,state.sector),
   [{text:'VIEW ZONE MAP',fn:showZoneMap},{text:'ENGAGE BOSS →',primary:true}]);
}
function showBagInventory(){
 if(state.busy)return;
 const inventory=summarizeBag(state.bag);
 showModal('TILE BAG · SCAN','Tiles remaining in the bag',
   `<div class="bag-overview"><div class="bag-overview-total">
     <strong>${inventory.total}</strong><div><span>PHYSICAL TILES</span>
     <p>Available for future draws and exchanges</p></div></div>
      ${isDrift()&&restrictedDraws(state.rogue,state.sector).length?
       '<p class="bag-seal-notice">BOSS EMBARGO · '+restrictedDraws(state.rogue,state.sector).join(', ')+
       ' tiles are sealed from draws during this sector. They remain in the physical inventory.</p>':''}
     <p class="bag-pool-summary">NUMBER BAG <strong>${inventory.pools.numbers}</strong> · OPERATOR BAG <strong>${inventory.pools.operators}</strong>${inventory.pools.brackets!==undefined?' · BRACKETS <strong>'+inventory.pools.brackets+'</strong>':''}</p>
     <div id="bag-inventory-groups" class="bag-inventory-groups"></div>
     <p class="bag-inventory-note">Counts are exact for the current bag. Tiles already on
     the board or in your rack are not included. The equals sign is free and
     unlimited, so it is never drawn from the bag. Future draw order is not shown. The ✦ wildcard is in the number bag.</p>
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
 match=finishTimedMatch(match);
 prepareLocalArtwork();
 state.mode='local';state.localMatch=match;state.tileSet=normalizeTileSet(match.tileSet);
 state.modalEpoch++;state.ceremony=null;state.localScoringPlayer=null;
 state.localDeferPrivacy=false;state.focusedIndex=pos(CENTER,CENTER);
 state.board=match.board;state.bag=match.bag;state.pending={};
 state.rack=[];state.placementOrder=[];state.selected=null;
 state.swapping=false;state.swapSet.clear();state.recentlyPlaced=null;
 state.lockedFlash.clear();state.ended=match.phase==='finished';
 state.busy=match.phase!=='finished';
 if(match.phase==='finished')state.busy=false;
 if(match.phase==='finished')recordLocalFinish(match);
 announce(match.phase==='finished'?'Local match complete. Review the final standings.':
   privateTurn?'Hot-seat privacy enabled. Hand the device to the next player.':
   'Local multiplayer match ready.');
 persistRun();render();
 if(match.phase==='finished')showLocalResults();
}
function startNewLocalMatch(config){
 try{
   const match=distinctOpening(
     ()=>makeLocalMatch(config,randomFloat),
     loadOpeningPattern(storage,'local'),
     game=>game.players[0].rack,
     (game,rack)=>({...game,players:game.players.map((player,i)=>
       i===0?{...player,rack}:player)})
   );
   rememberOpening(storage,'local',match.players[0].rack);
   try{storage?.setItem(TILE_SET_STORAGE_KEY,match.tileSet);}catch{/* storage optional */}
   const profiles=loadPilots(storage);
   const autoOwners=ensureLocalSeatPilots(storage,match.players.map(p=>p.name),
    match.players.map(p=>p.avatar),localSetupOwnerIds.slice(0,match.players.length));
   const latest=loadPilots(storage);
   const owners=assignLocalSeats(latest.registry,autoOwners);
   createLocalBinding(storage,match,owners);
   pendingLocalAwards=[];localFinalAwards=[];
   localSetupBadges=()=>{};
   localStateFromMatch(match);
   const started=awardLocalStart(storage,match);
   // Keep each seat's first award for its own private handover.
   for(const [seat,result] of started.entries())if(seat===match.current)
    pendingLocalAwards.push(...result.awarded);
 }catch(err){
   showModal('MATCH SETUP ERROR','Please check the player settings',
     '<p>'+escapeText(err.message)+'</p>',[{text:'EDIT SETTINGS',primary:true,fn:showLocalSetup}]);
 }
}
function showLocalSetup({fromHome=false}={}){
 const saved=state.localMatch||loadLocalMatch(storage,{privateOnResume:false});
 const players=saved?.players.map(p=>p.name)||['Pilot 1','Pilot 2','Pilot 3','Pilot 4'];
 const count=saved?.players.length||2;
 const seconds=saved?.turnSeconds||0;
 const gameSeconds=saved?.gameSeconds||0;
 const queryKit=new URLSearchParams(location.search).get('tiles');
 const selectedKit=TILE_SET_BY_ID[queryKit]?queryKit:normalizeTileSet(saved?.tileSet||storage?.getItem(TILE_SET_STORAGE_KEY));
 localSetupAliens=Array.from({length:4},(_,i)=>safePilotAlien(saved?.players?.[i]?.avatar,i));
 const savedOwners=saved?loadLocalBinding(storage,saved):null;
 localSetupOwnerIds=Array.from({length:4},(_,i)=>savedOwners?.seatIds[i]??null);
 const profiles=loadPilots(storage).registry.pilots;
 prepareLocalArtwork();
 showModal('ALIEN CREW · LOCAL MULTIPLAYER','Set up a local match',
   `<div class="local-setup-grid">
    <div class="local-setup-row"><label for="local-player-count">PLAYERS</label>
     <select id="local-player-count" aria-label="Number of players">
       <option value="2">2 players</option><option value="3">3 players</option><option value="4">4 players</option>
     </select></div>
    <div class="local-setup-row"><label for="local-tile-set">MATHEMATICAL KIT</label>
      <select id="local-tile-set">${TILE_SETS.map(kit=>'<option value="'+kit.id+'">'+kit.tier+' · '+kit.short.toUpperCase()+' — '+kit.title+'</option>').join('')}</select></div>
     <div id="local-setup-names" class="local-setup-names"></div>
    <div class="local-setup-row"><label for="local-game-seconds">GAME TIMER</label>
      <select id="local-game-seconds"><option value="0">Off</option><option value="300">5 minutes</option><option value="600">10 minutes</option><option value="900">15 minutes</option><option value="1200">20 minutes</option><option value="1800">30 minutes</option></select></div>
     <div class="local-setup-row"><label for="local-turn-seconds">TURN TIMER</label>
      <select id="local-turn-seconds">
        <option value="0">Off · take your time</option>
        <option value="60">60 seconds</option>
        <option value="90">90 seconds</option>
        <option value="120">120 seconds</option>
      </select></div>
    <p class="local-setup-tip" id="local-kit-description" aria-live="polite"></p>
   </div>`,
   [{text:fromHome?'BACK TO HOME':'CANCEL',fn:fromHome?showModeMenu:undefined},{text:'START MATCH →',primary:true,fn:()=>{
     const amount=Number($('local-player-count').value);
     const names=[...$('local-setup-names').querySelectorAll('input')].slice(0,amount).map(input=>input.value);
     const turnSeconds=Number($('local-turn-seconds').value);
      startNewLocalMatch({names,avatars:localSetupAliens.slice(0,amount),turnSeconds,
        gameSeconds:Number($('local-game-seconds').value),tileSet:$('local-tile-set').value});
   }}]);
 $('local-player-count').value=String(count);
 $('local-turn-seconds').value=String(seconds);
 $('local-game-seconds').value=String(gameSeconds);
 $('local-tile-set').value=selectedKit;
 const describeKit=()=>{
   const kit=TILE_SET_BY_ID[$('local-tile-set').value];
   $('local-kit-description').textContent=kit.short+' · '+kit.desc+' Rack: '+
     kitNumberSlots(kit.id)+' numbers, 3 operators'+(kit.brackets?' and a matched ( ) pair':'')+'.';
 };
 $('local-tile-set').addEventListener('change',describeKit);describeKit();
 const wrapper=$('local-setup-names');
 const groups=[],portraits=[];
 const labels={bloop:'Bloop',orbit:'Orbit',niblet:'Niblet',glimmer:'Glimmer'};
 const paint=()=>portraits.forEach((element,i)=>
   paintPilotAvatar(element,localSetupAliens[i],i,{size:52,framing:'bust'}));
 localSetupBadges=()=>{
   if($('local-setup-names')===wrapper)paint();
 };
 for(let i=0;i<4;i++){
   const group=document.createElement('div');group.className='local-pilot-setup';
   group.dataset.seat=String(i);
   const row=document.createElement('div');row.className='local-setup-row';
   const label=document.createElement('label');label.textContent='PILOT '+(i+1);
   label.htmlFor='local-player-name-'+i;
   const input=document.createElement('input');input.id='local-player-name-'+i;
   input.type='text';input.maxLength=20;input.autocomplete='off';
   input.value=players[i]||'Pilot '+(i+1);
   row.append(label,input);group.append(row);
   const alienRow=document.createElement('div');alienRow.className='alien-setup-row';
   const caption=document.createElement('label');caption.htmlFor='local-alien-'+i;
   caption.textContent='THEIR ALIEN';
   const controls=document.createElement('div');controls.className='alien-setup-choice';
   const portrait=document.createElement('span');portraits.push(portrait);
   const select=document.createElement('select');select.id='local-alien-'+i;
   select.setAttribute('aria-label','Choose alien for pilot '+(i+1));
   for(const id of PILOT_PRESET_NAMES){
     const opt=document.createElement('option');opt.value=id;opt.textContent=labels[id];
     select.append(opt);
   }
   const unique=document.createElement('option');unique.value='custom';unique.textContent='Custom alien';
   select.append(unique);
   const chooseOption=()=>{
     const matched=PILOT_PRESET_NAMES.find((id,k)=>
       JSON.stringify(localSetupAliens[i])===JSON.stringify(defaultPilotAlien(k)));
     select.value=matched||'custom';
   };
   chooseOption();
   select.addEventListener('change',()=>{
     if(select.value==='custom')return;
     localSetupAliens[i]=defaultPilotAlien(PILOT_PRESET_NAMES.indexOf(select.value));
     paint();
   });
   const random=document.createElement('button');random.type='button';
   random.textContent='✧ RANDOM';random.setAttribute('aria-label','Random alien for pilot '+(i+1));
   random.onclick=()=>{localSetupAliens[i]=nextRandomPilotAlien(localSetupAliens[i]);chooseOption();paint();};
   const savedButton=document.createElement('button');savedButton.type='button';
   savedButton.textContent='USE SAVED';savedButton.title='Use the design saved in Alien Lab';
   savedButton.onclick=()=>{
     const savedAlien=getSavedPilotAlien(storage);
     if(!savedAlien){
       const tip=wrapper.querySelector('.alien-setup-note');
       if(tip)tip.textContent='No saved alien yet. Open Alien Lab and save one, then press USE SAVED.';
       return;
     }
     localSetupAliens[i]=savedAlien;chooseOption();paint();
   };
   controls.append(portrait,select,random,savedButton);
   alienRow.append(caption,controls);group.append(alienRow);
    const ownerRow=document.createElement('div');ownerRow.className='local-setup-row local-owner-row';
    const ownerLabel=document.createElement('label');ownerLabel.textContent='ACHIEVEMENTS FOR';
    ownerLabel.htmlFor='local-pilot-owner-'+i;
    const ownerSelect=document.createElement('select');ownerSelect.id='local-pilot-owner-'+i;
    ownerSelect.className='local-owner-select';
    ownerSelect.add(new Option('Save automatically for this pilot',''));
    for(const p of profiles)ownerSelect.add(new Option(p.name+' · saved pilot',p.id));
    ownerSelect.value=localSetupOwnerIds[i]??'';
    ownerSelect.addEventListener('change',()=>{
      localSetupOwnerIds[i]=ownerSelect.value||null;
      const p=profiles.find(p=>p.id===localSetupOwnerIds[i]);
      if(p&&(input.value==='Pilot '+(i+1)||input.value===players[i]))input.value=p.name;
    });
    ownerRow.append(ownerLabel,ownerSelect);group.append(ownerRow);
    wrapper.append(group);groups.push(group);
 }
 const link=document.createElement('a');link.className='alien-editor-link';
 link.href='./alien-lab.html';link.target='_blank';link.rel='noopener noreferrer';
 link.textContent='✳ CREATE A CUSTOM ALIEN IN ALIEN LAB ↗';
 const tip=document.createElement('p');tip.className='alien-setup-note';
 tip.textContent='Achievements save automatically by player name. Choose a saved pilot to use their existing rewards.';
 wrapper.append(link,tip);paint();
 const updateCount=()=>{const amount=Number($('local-player-count').value);
   groups.forEach((group,i)=>{group.hidden=i>=amount;});};
 $('local-player-count').addEventListener('change',updateCount);
 updateCount();
}
function readyLocalPlayer(){
 if(!isLocal()||state.localMatch?.phase!=='handover')return;
 if(isGameTimerExpired(state.localMatch)){
  finishLocalTurn(finishTimedMatch(state.localMatch),'Game timer expired. Final standings are ready.');return;
 }
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
    const result=awardLocalTransition(storage,match,{
      seat:match.current,type:'turn-ready',suffix:'t'+match.turnNumber+'-ready',data:{}
    });
    // The handover button was just confirmed by this player, not the previous seat.
    const visibleAwards=[...pendingLocalAwards,...result.awarded];
    pendingLocalAwards=[];
    if(visibleAwards.length)showAchievementToast(visibleAwards);
   $('board').querySelector('[tabindex="0"]')?.focus({preventScroll:true});
 }catch(err){announce(err.message,true);}
}
$('local-ready-btn').onclick=readyLocalPlayer;
function finishLocalTurn(match,message){
 if(state.ceremony){state.ceremony.finished=true;state.ceremony=null;state.modalEpoch++;clearCeremonyTile();}
 state.localMatch=match;state.board=match.board;state.bag=match.bag;
 state.pending={};state.rack=[];state.placementOrder=[];
 state.selected=null;state.swapping=false;state.swapSet.clear();
 state.recentlyPlaced=null;state.lockedFlash.clear();
 state.localDeferPrivacy=false;state.localScoringPlayer=null;
 state.busy=match.phase!=='finished';state.ended=match.phase==='finished';
 announce(message);persistRun();recordLocalFinish(match);render();
  if(match.phase==='finished')showLocalResults();
}
function expireLocalBeforeAction(){
 if(!isLocal()||!state.localMatch||!isGameTimerExpired(state.localMatch))return false;
 finishLocalTurn(finishTimedMatch(state.localMatch),'The game timer expired. Final standings are ready.');
 return true;
}
function localPass(reason='pass'){
 if(expireLocalBeforeAction()||!isLocal()||state.busy||state.ended)return;
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
 if(expireLocalBeforeAction()||!isLocal()||state.busy||state.ended)return;
 if(!state.swapping){
   if(Object.keys(state.pending).length){announce('Clear your equation before swapping.',true);return;}
   if(!state.bag.length){announce('No tiles remain in the bag.',true);return;}
   state.swapping=true;state.selected=null;
   announce('Choose exactly one tile for your free swap each turn. Exchanging several costs your turn.');
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
     announce('Free tile swap complete. Your turn continues.');render();
      const earned=awardLocalTransition(storage,match,{
       seat:match.current,type:'free-exchange',suffix:'t'+match.turnNumber+'-free',data:{}
      });
      if(earned.awarded.length)showAchievementToast(earned.awarded);
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
 const summary=match.finishedReason==='time-limit'?
  'The game timer expired. All players’ remaining rack points are deducted.':
  match.finishedReason==='stalled'?
   'Two full circuits of passes or paid exchanges ended the match.':
   'A player emptied their rack with no tiles left in the bag.';
 const rows=standing.map(entry=>
  `<div class="local-result-row alien-result-row${entry.winner?' is-winner':''}">
    <span class="alien-result-rank">${entry.winner?'★':entry.rank}</span>
    <span class="alien-result-portrait" data-pilot-index="${entry.index}"></span>
    <strong>${escapeText(entry.name)}</strong>
    <span>${entry.gross}</span><span>−${entry.penalty}</span><span>${entry.net}</span>
   </div>`).join('');
 showModal('MATCH COMPLETE',winners.length===1?
   escapeText(winners[0])+' wins!':'Shared victory!',
   `<p class="local-match-note">${summary}</p>
    <div class="local-result-legend alien-result-legend"><span>#</span><span>ALIEN</span><span>PILOT</span><span>SCORED</span><span>RACK</span><span>FINAL</span></div>
    <div class="local-result-table">${rows}</div>
    <p class="local-match-note">The highest final score wins. Rack tile values are deducted from each player's earned points. Tied highest scores share the win.</p>
    ${localFinishMarkup()}`,
   [{text:'CHOOSE MODE',fn:showModeMenu},
    {text:'NEW LOCAL MATCH →',primary:true,fn:showLocalSetup}]);
 $('modal-body').querySelectorAll('.alien-result-portrait').forEach(node=>{
   const i=Number(node.dataset.pilotIndex);
   paintPilotAvatar(node,match.players[i]?.avatar,i,{size:40,framing:'bust'});
   node.classList.add('alien-result-avatar');
 });
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
 }else if(state.turn>=maxTurns()){
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
function showDriftHub(eyebrow,title,body,buttons,view){
 const hub=$('drift-hub');
 if($('modal').open)$('modal').close();
 hub.dataset.view=view;
 $('drift-hub-eyebrow').textContent=eyebrow;
 $('drift-hub-title').textContent=title;
 $('drift-hub-body').innerHTML=body;
 $('drift-hub-actions').replaceChildren(...buttons.map(({text,fn,kind})=>{
   const button=document.createElement('button');button.type='button';
   button.className=kind==='go'?'drift-go':kind==='bay'?'drift-bay':'drift-back';
   button.textContent=text;
   button.onclick=()=>{hub.close();fn?.();};
   return button;
 }));
 $('drift-hub-close').onclick=()=>hub.close();
 if(!hub.open)hub.showModal();
 $('drift-hub-body').scrollTop=0;
}
function showDriftRoundSummary(report){
 if(!isDrift()||state.phase!=='won')return;
 const progress=state.progress,info=zoneInfo(state.rogue,state.sector);
 const best=report.best?escapeText(report.best.equation)+' · +'+report.best.points+' energy':'No scored equations';
 const content=`<div class="drift-summary">
 <p class="drift-summary-heading">MISSION COMPLETE · ${escapeText(info.name)} · SECTOR ${String(state.sector).padStart(2,'0')}</p>
 <div class="drift-summary-energy">
   <div><small>ENERGY COLLECTED</small><strong>${report.score}</strong></div>
   <div><small>SECTOR TARGET</small><strong>${report.target}</strong></div>
   <div class="drift-flux-award"><small>FLUX SALVAGED</small><strong>+${state.rogue.lastReward}</strong></div>
 </div>
 <div class="drift-summary-meter" aria-label="${Math.min(100,Math.round(100*report.score/report.target))}% of sector target"><div style="width:${Math.min(100,Math.round(100*report.score/report.target))}%"></div></div>
 <div class="drift-summary-layout">
   <section class="drift-summary-card drift-summary-map" aria-label="Zone map after this round">
     <h3>YOUR POSITION IN THE DRIFT</h3>
     ${zoneIntermissionMarkup(state.rogue,state.sector,'won')}
     <button type="button" id="drift-full-map" class="drift-map-full">EXPLORE FULL ZONE MAP ↗</button>
   </section>
   <section class="drift-summary-card" aria-label="Round scoring breakdown">
     <h3>ROUND TELEMETRY</h3>
     <div class="drift-summary-stats">
       <div><small>EQUATIONS</small><strong>${report.equations}</strong></div>
       <div><small>TURNS USED</small><strong>${report.turnsUsed}/${maxTurns()}</strong></div>
       <div><small>FREE SWAPS</small><strong>${report.freeExchanges}</strong></div>
     </div>
     <p class="drift-summary-best"><strong>BEST CALCULATION</strong><br>${best}</p>
     <div class="drift-summary-recent"><h3>RECENT SCORING MOVES</h3>${reportRows(report.moves.slice(-3))}</div>
   </section>
 </div>
 </div>`;
 showDriftHub('THE DRIFT · SECTOR '+String(state.sector).padStart(2,'0')+' CLEAR',
   isBossSector(state.sector)?'Zone guardian defeated':'Reactor stabilised',
   content,[
     {text:'⛭ VISIT SALVAGE BAY',kind:'bay',fn:showShop},
     {text:'CONTINUE TO SECTOR '+String(state.sector+1).padStart(2,'0')+' →',kind:'go',fn:()=>freshSector(state.sector+1)}
   ],'results');
 $('drift-full-map').onclick=()=>{$('drift-hub').close();showZoneMap();};
}
function showShop(){
 if(!isDrift()||state.phase!=='won')return;
 const earned=awardSolo('salvage-entered','salvage-first',{}, {quiet:true});
 showDriftHub('THE DRIFT · OPTIONAL UPGRADE STOP',
  'Salvage Bay · Deck 07',achievementRevealMarkup(earned)+salvageWorkshopMarkup(),[
    {text:'← ROUND RESULTS',kind:'back',fn:showSectorOutcome},
    {text:'CONTINUE TO SECTOR '+String(state.sector+1).padStart(2,'0')+' →',kind:'go',fn:()=>freshSector(state.sector+1)}
  ],'salvage');
 mountSalvageWorkshop({
   rogue:state.rogue,sector:state.sector,
   onPurchase:(id,temporary)=>{
     const result=temporary?purchaseTemporary(state.rogue,id,state.sector):
       purchaseUpgrade(state.rogue,id,state.sector);
     if(result.ok){
       state.rogue=result.rogue;
       persistRun();render();
       const data=temporary?{gadgetId:id}:{installedSystems:state.rogue.upgrades.length};
       const suffix=temporary?'buy-'+id+'-s'+state.sector+'-f'+state.rogue.flux:'install-'+id;
       const awards=awardSolo(temporary?'gadget-bought':'system-installed',suffix,data,{quiet:true});
       if(awards.length){
         const notice=document.createElement('div');
         notice.innerHTML=achievementRevealMarkup(awards);
         $('drift-hub-body').prepend(notice);
       }
     }
     return result;
   }
 });
}
function showSectorOutcome(){
 const won=state.phase==='won';
 const report=sectorReport(state.sector,state.score,state.turn,state.stats,won,currentTarget());
 const best=report.best?`${escapeText(report.best.equation)} (+${report.best.points})`:'No scored equations';
 const message=won?
   'Target reached. Your run continues into a fresh sector.':
   report.equations?
     'You can retry this sector with a new rack. Look for connections and premium squares.':
     'Start with a short correct equation, then connect to existing tiles for more points.';
 const body=`<div class="sector-report">
 <div class="report-energy"><div><span>ENERGY COLLECTED</span><strong>${report.score}</strong></div>
 <div><span>SECTOR TARGET</span><strong>${report.target}</strong></div></div>
 <div class="report-meter"><div style="width:${Math.min(100,Math.round(100*report.score/report.target))}%"></div></div>
 <div class="report-facts"><div><span>Equations</span><strong>${report.equations}</strong></div>
 <div><span>Turns used</span><strong>${report.turnsUsed}/${maxTurns()}</strong></div>
 <div><span>Best move</span><strong>${report.best?report.best.points:0} pts</strong></div>
 <div><span>Free exchanges</span><strong>${report.freeExchanges}</strong></div></div>
 <p class="report-best">Best calculation: ${best}</p>
 ${reportRows(report.moves)}
 <p class="report-note">${message}</p></div>`;
 if(isDrift()&&won){showDriftRoundSummary(report);return;}
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
     [{text:'ROUND RESULTS',primary:true,fn:showSectorOutcome},
      {text:'SALVAGE BAY',fn:showShop}]:
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
   $('energy-progress').setAttribute('aria-valuenow',String(Math.max(0,Math.min(currentTarget(),shown))));
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
 paintReactorTransfer(ctl.awarded,ctl.total);
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
   ${isDrift()&&points.upgrades.length?`<p class="rogue-score-effects">${escapeText(points.upgrades.join(' · '))}</p>`:''}
   ${isLocal()?achievementRevealMarkup(takeLocalAwards()):achievementRevealMarkup(takeSoloAwards())}`,
   [isLocal()?
      {text:state.localMatch.phase==='finished'?'FINAL STANDINGS →':'HAND OVER DEVICE →',
       primary:true,fn:finishLocalPresentation}:
      {text:state.phase==='playing'?'CONTINUE →':
        isDrift()&&state.phase==='won'?'VIEW ROUND RESULTS →':'VIEW SECTOR REPORT →',
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
 if(expireLocalBeforeAction()||!isLocal()||state.busy||state.ended||state.swapping)return;
 try{
   const match=state.localMatch;
   const oldIndex=match.current;
   const active={...match,pending:state.pending,placementOrder:state.placementOrder,
     players:match.players.map((p,i)=>i===oldIndex?{...p,rack:state.rack}:p)};
   const {match:updated,points,move}=scoreLocalTurn(active,state.pending);
    let evidence=null;
    try{evidence=soloScoredEvidence({board:match.board,pending:state.pending,move,
      points,tileSet:match.tileSet});}
    catch{/* Achievement telemetry cannot reject an otherwise correct equation. */}
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
   announce(match.players[oldIndex].name+' scored a correct equation! Transferring '+points.total+' points.',false,'success');
    persistRun();
    const earned=evidence?awardLocalTransition(storage,updated,{
     seat:oldIndex,type:'move-scored',suffix:'t'+match.turnNumber+'-score',data:evidence
    }):{awarded:[]};
    pendingLocalAwards=earned.awarded;
    recordLocalFinish(updated);
    render();
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
   const scoredTurn=state.turn,scoredSector=state.sector;
   let evidence=null;
   try{evidence=soloScoredEvidence({board:state.board,pending:state.pending,move,points,tileSet:state.tileSet});}
   catch{/* Achievement evidence must never reject a valid mathematical move. */}
   // Consume single-use charges and commit the whole score atomically before
   // a timer, animation, tab switch or reload can interrupt the presentation.
   if(isDrift()){
     state.rogue=resolveBossScore(state.rogue,state.sector,state.pending);
     state.rogue=consumeBoardEcho(state.rogue,points.echoedIndices);
     state.rogue=earnMoveFlux(state.rogue,state.pending).rogue;
     if(points.tempApplied)state.rogue=consumeTemporary(state.rogue,points.tempApplied);
   }
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
   // The accepted move and sector transition have been persisted, before animation.
   if(evidence)awardSolo('move-scored','s'+scoredSector+'-t'+scoredTurn+'-score',evidence,{defer:true});
   if(isDrift()&&points.tempApplied)
     awardSolo('gadget-used','s'+scoredSector+'-t'+scoredTurn+'-use-'+points.tempApplied,
       {gadgetId:points.tempApplied},{defer:true});
   if(state.phase==='won'){
     awardSolo('sector-cleared','s'+scoredSector+'-cleared',
       soloClearEvidence({sector:scoredSector,stats:state.stats,
         installedSystems:isDrift()?state.rogue.upgrades.length:0}),{defer:true});
     if(isDrift()&&isBossSector(scoredSector))
       awardSolo('guardian-defeated','s'+scoredSector+'-guardian',{sector:scoredSector},{defer:true});
   }
   announce('Equation verified. Transferring '+points.total+' energy tile by tile.',false,'success');
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
 if(state.itemTarget){announce('Finish or cancel your selected power-up first.',true);return;}
 if(!state.swapping){
   if(Object.keys(state.pending).length){
     announce('Clear your equation before swapping tiles.',true);return;
   }
   if(!state.bag.length){announce('The bag is empty; swapping is unavailable.',true);return;}
   state.swapping=true;state.selected=null;
   announce((isDrift()?freeSwapsRemaining(state.rogue,state.turn,state.freeSwapTurn)>0:
     state.freeSwapTurn!==state.turn)?
     'Choose exactly one tile for a free swap. Selecting several costs your turn.':
     'Your free swap is used. Exchanging tiles now costs a turn.');render();return;
 }
 if(!state.swapSet.size){announce('Select at least one tile to exchange.',true);return;}
 if(state.rack.some(t=>state.swapSet.has(t.id)&&t.pairId)){
   announce('Bracket halves stay linked. Play both together instead of exchanging them.',true);return;
 }
 if(isDrift()&&state.rogue.forcedTile&&state.swapSet.has(state.rogue.forcedTile)){
   announce('The boss demands that tile. Use it in a correct equation before swapping.',true);return;
 }
 if(state.swapSet.size>state.bag.length){announce('Not enough tiles remain in the bag.',true);return;}
 const free=state.swapSet.size===1&&(isDrift()?
   freeSwapsRemaining(state.rogue,state.turn,state.freeSwapTurn)>0:
   state.freeSwapTurn!==state.turn);
 const kind=t=>tilePool(t);
 const sealed=new Set(isDrift()?restrictedDraws(state.rogue,state.sector):[]);
 for(const pool of ['numbers','operators']){
   const needed=state.rack.filter(t=>state.swapSet.has(t.id)&&kind(t)===pool).length;
   const available=state.bag.filter(t=>kind(t)===pool&&!sealed.has(t.value)).length;
   if(needed>available){announce('Not enough '+pool+' remain in that bag.',true);return;}
 }
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
   if(isDrift())state.rogue=markFreeSwap(state.rogue,state.turn,state.freeSwapTurn);
   state.freeSwapTurn=state.turn;
   state.swapping=false;state.swapSet.clear();state.selected=null;
   persistRun();
   if(!isDrift())awardSolo('free-exchange','s'+state.sector+'-t'+state.turn+'-free-'+state.stats.freeExchanges,{});
   announce(`Exchanged ${exchanged.length} tile(s) for free. Your turn is unchanged.`,false,'success');
   render();
 }else{
   state.stats.paidExchanges++;
   completeTurn();
   announce(`Exchanged ${exchanged.length} tile(s). Turn spent.`,false,'success');
   render();
   if(state.phase!=='playing')showSectorOutcome();
 }
}
function clear(){
 if(state.ended||state.busy)return;
 if(state.itemTarget){state.itemTarget=null;announce('Power-up selection cancelled.');render();return;}
 if(state.swapping){
   state.swapping=false;state.swapSet.clear();announce('Tile exchange cancelled.');
 }else{
   state.pending={};state.selected=null;state.placementOrder=[];state.recentlyPlaced=null;
   announce('Unscored tiles returned to the rack.');
 }
 render();
}
function shuffleRack(){
 if(state.ended||state.busy||state.swapping||state.itemTarget)return;
 const placed=new Set(Object.values(state.pending).filter(tile=>tile.value!=='=').map(tile=>tile.id));
 const visible=state.rack.filter(tile=>!placed.has(tile.id));
 if(visible.length<2)return;
 state.rack=shuffleAvailableRack(state.rack,placed);
 state.selected=null;state.recentlyPlaced=null;
 announce('Rack shuffled. Tiles and turn unchanged.');
 render();
}
$('shuffle-rack-btn').onclick=shuffleRack;
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
 const bracketNote=hasBracketPair(state.tileSet)?
  '<p class="training-footnote">In Nebula and Quantum, place both ( and ) in one equation; exchange them as a pair.</p>':'';
 const message=`<div class="training-steps">
   <div class="training-step"><span>01</span><div><strong>Start at the centre</strong>
     <p>Build a true equation through the glowing centre square, such as <em>8 + 4 = 12</em>. Use BIDMAS; <em>3 = 3</em> alone does not score.</p></div></div>
   <div class="training-step"><span>02</span><div><strong>Place your tiles</strong>
     <p>Tap a rack tile, then a square (or drag it). The <strong>=</strong> sign is free. Blank tiles let you choose a number or operator.</p></div></div>
   <div class="training-step"><span>03</span><div><strong>Score and connect</strong>
     <p>Press <strong>Score Equation</strong> to check your maths. Later equations must join a locked tile. Reach the target within six turns; one single-tile swap is free each turn.</p></div></div>
  </div>${bracketNote}
  <p class="training-footnote">Your run and achievements save to your pilot automatically on this device. The Hangar lets you switch pilots or export progress.</p>`;
 showModal(firstVisit?'WELCOME TO THE REACTOR':'FLIGHT MANUAL',
  firstVisit?'Ready to build your first equation?':'How to play EQUA//NOVA',
  message,[{text:firstVisit?'START MISSION →':'BACK TO GAME',primary:true,fn:firstVisit?rememberIntro:undefined}]);
}
$('help-btn').onclick=()=>isLocal()?showLocalHelp():isDrift()?showDriftIntro():showTraining();
function showLocalHelp(){
 const bracketNote=hasBracketPair(state.tileSet)?
  '<p class="training-footnote">Place or exchange both ( and ) together as a matched pair.</p>':'';
 showModal('LOCAL MULTIPLAYER · FLIGHT MANUAL','Share a board, keep your rack private',
  `<div class="training-steps">
    <div class="training-step"><span>01</span><div><strong>Handover privately</strong>
      <p>Pass the device before tapping <strong>Ready</strong>. Only the current player sees their rack.</p></div></div>
    <div class="training-step"><span>02</span><div><strong>Score or swap</strong>
      <p>Start through the centre; later equations join locked tiles. Use the free <strong>=</strong>, then press <strong>Score</strong> to check BIDMAS. You may pass or swap.</p></div></div>
    <div class="training-step"><span>03</span><div><strong>Highest net score wins</strong>
      <p>The match ends when someone empties their rack after the bag runs out, or after two rounds without scoring. Unused tile points are deducted.</p></div></div>
   </div>${bracketNote}<p class="training-footnote">Timers are optional and start after Ready. A timeout counts as a pass.</p>`,
  [{text:'BACK TO MATCH',primary:true}]);
}
function showDriftIntro(firstVisit=false){
 const bracketNote=hasBracketPair(state.tileSet)?
  '<p class="training-footnote">Place both ( and ) in the same equation; exchange them as a pair.</p>':'';
 showModal('THE DRIFT · PILOT BRIEFING','Clear sectors, upgrade and face bosses',
  `<div class="training-steps">
    <div class="training-step"><span>01</span><div><strong>Reach the target</strong>
      <p>Tap or drag tiles to build true BIDMAS equations: first through the centre, then joined to locked tiles. The = sign is free. Reach each target in six turns (seven with Time Dilator).</p></div></div>
    <div class="training-step"><span>02</span><div><strong>Spend Flux or continue</strong>
      <p>After a clear, visit the optional <strong>Salvage Bay</strong> for up to four Ship Systems and two one-use Mission Gadgets, or continue straight away.</p></div></div>
    <div class="training-step"><span>03</span><div><strong>Beat the zone boss</strong>
      <p>Each zone has three sectors. Every third sector has a random boss with a temporary rule. Failure ends your Drift run.</p></div></div>
   </div>${bracketNote}<p class="training-footnote">Sector Run and Drift save separately. Achievement progress is saved automatically to your pilot on this device.</p>`,
  [{text:firstVisit?'BEGIN THE DRIFT →':'BACK TO GAME',primary:true}]);
}
function restoreMode(mode,{initial=false}={}){
 state.modalEpoch++;
 state.mode=mode;
 const previous=loadRun(storage,mode);
 if(previous){
   Object.assign(state,previous);
   // Old saved games predate the per-turn free-swap marker.
   state.freeSwapTurn=previous.freeSwapTurn??0;
   state.mode=mode;
   state.rogue=mode==='rogue'?previous.rogue:null;
   state.tileSet=normalizeTileSet(previous.tileSet);
   state.bossGrid=mode==='rogue'?bossField(state.rogue,state.sector):null;
   state.ended=state.phase!=='playing';state.busy=false;
   state.swapping=false;state.swapSet.clear();state.selected=null;
   state.recentlyPlaced=null;state.lockedFlash.clear();
   state.focusedIndex=pos(CENTER,CENTER);state.itemTarget=null;
   startAchievementRun(false);
   announce(mode==='rogue'?
     'Saved Drift run restored: your upgrades, Flux and rack are intact.':
     'Saved Sector Run restored. Your board, rack, and unfinished placements are ready.');
   render();
   if(state.ended)showSectorOutcome();
   const requestedKit=new URLSearchParams(location.search).get('tiles');
   if(TILE_SET_BY_ID[requestedKit]&&requestedKit!==state.tileSet)
     confirmTileSetChange(requestedKit);
 }else{
   state.tileSet=normalizeTileSet(new URLSearchParams(location.search).get('tiles')||storage?.getItem(TILE_SET_STORAGE_KEY));
   state.rogue=mode==='rogue'?makeRogueState(state.tileSet):null;
   freshSector(1,{newRun:true});
   if(mode==='rogue')showDriftIntro(true);
   else if(initial){
     let seen=false;
     try{seen=storage?.getItem(INTRO_KEY)==='seen';}catch{/* no storage */}
     if(!seen)showTraining(true);
   }
 }
}
// Mode selection now lives on the dedicated home page, not a duplicate dialog.
function startChosenTileSet(id){
 state.tileSet=normalizeTileSet(id);
 try{storage?.setItem(TILE_SET_STORAGE_KEY,state.tileSet);}catch{/* optional storage */}
 freshSector(1,{newRun:true});
 announce(TILE_SET_BY_ID[id].title+' tile kit engaged. New shuffled supply ready.',false,'success');
}
function confirmTileSetChange(id){
 const set=TILE_SET_BY_ID[id];
 if(!set)return;
 if(state.tileSet===id){
   announce(set.title+' is already the active tile kit.');
   return;
 }
 showModal('CHANGE PHYSICAL TILE KIT',set.short+' · '+set.title,
   '<p>Changing mathematical tiles starts a fresh '+(isDrift()?'Drift':'Sector Run')+
   ' run. Your current board, score, '+(isDrift()?'ship systems and Flux':'progress')+
   ' will be replaced.</p><p><strong>New kit:</strong> '+set.desc+'</p>'+
   (set.brackets?'<p>Brackets come as a matched ( ) pair and occupy two extra rack positions.</p>':''),
   [{text:'KEEP CURRENT RUN'},{
     text:'START WITH '+set.short.toUpperCase()+' →',primary:true,fn:()=>startChosenTileSet(id)
   }]);
}
function showTileSetMenu(){
 if(isLocal()||state.busy)return;
 const body='<p class="kit-dialog-explain">Starting racks — Launchpad/Orbit: 5 numbers + 3 operators. Nebula/Quantum: 6 numbers + 3 operators + a matched ( ) pair.</p>'+
   '<div class="kit-dialog-grid" role="group" aria-label="Choose a maths tile kit">'+
   TILE_SETS.map(kit=>'<button class="kit-dialog-card'+(kit.id===state.tileSet?' is-current':'')+
     '" type="button" data-kit-choice="'+kit.id+'" aria-pressed="'+(kit.id===state.tileSet)+'">'+
     '<span>'+kit.tier+' · '+kit.short.toUpperCase()+'</span>'+
     '<strong>'+kit.title+'</strong>'+
     '<em>'+kit.sample+'</em><small>'+kit.operations+'</small>'+
     '</button>').join('')+'</div>'+
   '<p class="kit-dialog-explain">Quantum adds powers (−8 to 8), exact square roots and factorials (0! to 8!). Choosing another kit starts a new run.</p>';
 showModal('CHOOSE YOUR MATHS KIT','Four levels of equations',body,
   [{text:'BACK TO BOARD',primary:true}]);
 document.querySelectorAll('[data-kit-choice]').forEach(button=>{
   button.onclick=()=>confirmTileSetChange(button.dataset.kitChoice);
 });
}
$('tile-set-btn').onclick=showTileSetMenu;
function showModeMenu(){
 window.location.assign('./index.html');
}
$('mode-btn').onclick=showModeMenu;
$('local-switch-btn').onclick=showModeMenu;

function startSolo(){
 const requested=new URLSearchParams(window.location.search).get('mode');
 let mode=['sector','rogue','local'].includes(requested)?requested:'sector';
 if(!['sector','rogue','local'].includes(requested)){
   try{
     const previous=storage?.getItem(ACTIVE_MODE_KEY);
     if(['sector','rogue','local'].includes(previous))mode=previous;
   }catch{/* optional browser storage */}
 }
 if(mode==='local'){
   // The second-step setup deliberately starts a new match, never silently
   // replaces an old match on an ordinary visit to the board.
   if(new URLSearchParams(location.search).get('setup')==='ready'){
    try{
     const raw=sessionStorage.getItem('equa-nova.pending-launch.v1');
     sessionStorage.removeItem('equa-nova.pending-launch.v1');
     const config=JSON.parse(raw||'null');
     if(config?.version===1&&config.mode==='local'&&
       Array.isArray(config.names)&&config.names.length>=2&&config.names.length<=4&&
       Array.isArray(config.avatars)&&config.avatars.length===config.names.length&&
       [0,60,90,120].includes(config.turnSeconds)&&TILE_SET_BY_ID[config.tileSet]){
      localSetupOwnerIds=[null,null,null,null];
      startNewLocalMatch({names:config.names,avatars:config.avatars,
       turnSeconds:config.turnSeconds,gameSeconds:config.gameSeconds??0,tileSet:config.tileSet});
      return;
     }
    }catch{/* Fall back to the existing safe match or setup dialog. */}
   }
   const saved=loadLocalMatch(storage);
   if(saved){
      localStateFromMatch(saved);
      const requestedKit=new URLSearchParams(location.search).get('tiles');
      if(TILE_SET_BY_ID[requestedKit]&&normalizeTileSet(saved.tileSet)!==requestedKit){
        showModal('DIFFERENT MATCH KIT','Start with '+TILE_SET_BY_ID[requestedKit].short+'?',
          '<p>Your saved match uses '+TILE_SET_BY_ID[normalizeTileSet(saved.tileSet)].short+
          '. The selected '+TILE_SET_BY_ID[requestedKit].short+
          ' kit requires a new local match; the current match can still be resumed.</p>',
          [{text:'KEEP SAVED MATCH'},{text:'SET UP NEW MATCH →',primary:true,fn:()=>showLocalSetup({fromHome:true})}]);
      }
      return;
    }
   // The first Local Match visit starts in setup; backing out returns home.
   showLocalSetup({fromHome:true});
   return;
 }
 restoreMode(mode,{initial:mode==='sector'});
}
window.setInterval(()=>{
 if(!isLocal()||!state.localMatch||state.ended)return;
 const match=state.localMatch;
 if(match.gameDeadline){
  $('local-game-remaining').textContent=formatLocalClock(match.gameDeadline);
  $('local-game-remaining').classList.toggle('local-time-urgent',match.gameDeadline-Date.now()<60000);
 }
 if(isGameTimerExpired(match)){
  finishLocalTurn(finishTimedMatch(match),'The game timer expired. Final standings are ready.');return;
 }
 if(match.phase!=='playing'||state.busy||match.turnSeconds===0)return;
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
 if(event.key==='Escape'&&state.itemTarget){
   state.itemTarget=null;announce('Power-up selection cancelled.');render();return;
 }
 if(event.key==='Escape'&&state.selected){
   state.selected=null;render();return;
 }
 if(state.swapping)return;
 if(event.key==='='){
   event.preventDefault();selectTile('equals');return;
 }
 if(/^[1-9]$/.test(event.key)){
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

initBoardZoom();

// The pilot's own Alien Lab creation joins the reactor HUD. Loading its SVG
// parts never blocks gameplay or changes rack, board or saved-run state.
void loadPilotArtwork().then(()=>{
 if(isLocal())return;
 const chosen=getSavedPilotAlien(storage)||defaultPilotAlien(0);
 paintPilotAvatar($('pilot-portrait'),chosen,0,{size:94,framing:'bust'});
 $('pilot-name').textContent='PILOT // YOUR ALIEN';
});
