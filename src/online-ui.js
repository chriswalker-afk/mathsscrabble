import {ONLINE_API,ONLINE_SESSION_KEY} from './online-config.js';
import {SIZE,CENTER,coords,pos,bonusAt,inspectPlacement,scoreMove,
  BLANK_KINDS,isBlank,reorderRack,freeExchangeReason} from './engine.js';
import {buildScoringCeremony,ceremonyDurationMs} from './score-ceremony.js';
import {enableTileDrag,wasDragClick} from './pointer-drag.js';
import {PILOT_PRESET_NAMES,defaultPilotAlien,alienFromStorage,getSavedPilotAlien,
  nextRandomPilotAlien,pilotProfileEqual,safePilotAlien} from './alien/profiles.js';
import {loadPilotArtwork,paintPilotAvatar} from './alien/badges.js';

const $=id=>document.getElementById(id);
const EMPTY_BOARD=Array(SIZE*SIZE).fill(null);
const state={
 view:null,code:null,token:null,pending:{},order:[],rackOrder:[],
 selected:null,swapping:false,swapIds:new Set(),busy:false,
 ws:null,connection:'offline',lastRevision:0,reconnectDelay:2500,
 reconnectTimer:null,refreshing:false,ceremony:null,focusIndex:pos(CENTER,CENTER),
 lastResultRevision:0,shownResults:false,pendingRequest:null,notice:''
};
const storage=(()=>{try{return localStorage;}catch{return null;}})();
state.alienDraft=alienFromStorage(storage,0);
function renderPilotPicker(){
 const alien=state.alienDraft;
 paintPilotAvatar($('online-own-alien'),alien,me()?.index??0,{size:68,framing:'bust'});
 const lobby=state.view?.phase==='lobby';
 $('online-alien-subtitle').textContent=lobby?
  (pilotProfileEqual(alien,state.view.you.avatar)?
   'Your alien is visible to everyone in this room.':'Choose an alien to update your seat.') :
   'Your alien joins the room with you. You can edit it first.';
 for(const button of $('online-alien-presets').querySelectorAll('button[data-preset]')){
  const id=button.dataset.preset;
  const i=PILOT_PRESET_NAMES.indexOf(id);
  paintPilotAvatar(button.querySelector('.alien-player-avatar'),
    defaultPilotAlien(i),i,{size:35,framing:'portrait'});
  button.setAttribute('aria-pressed',String(pilotProfileEqual(alien,
   defaultPilotAlien(i))));
  button.disabled=state.busy;
 }
 for(const id of ['online-alien-random','online-alien-saved'])$(id).disabled=state.busy;
}
async function selectOnlineAlien(profile){
 if(state.busy)return;
 state.alienDraft=safePilotAlien(profile,me()?.index??0);
 renderPilotPicker();
 if(state.view?.phase==='lobby'){
  const result=await mutate('profile',{avatar:state.alienDraft});
  if(!result){
   state.alienDraft=safePilotAlien(state.view.you.avatar,me()?.index??0);
   $('online-alien-note').textContent='Room update failed. Your previous alien is still selected.';
  }else $('online-alien-note').textContent='Your alien is now visible to the other pilots!';
  renderPilotPicker();
 }else $('online-alien-note').textContent='Alien chosen! You can now create or join a room.';
}
function initOnlineAlienPicker(){
 const region=$('online-alien-presets');
 for(const [i,id] of PILOT_PRESET_NAMES.entries()){
  const button=document.createElement('button');button.type='button';
  button.dataset.preset=id;button.setAttribute('aria-label','Choose '+id+' alien');
  const portrait=document.createElement('span');
  paintPilotAvatar(portrait,defaultPilotAlien(i),i,{size:35,framing:'portrait'});
  const title=document.createElement('span');title.textContent=id[0].toUpperCase()+id.slice(1);
  button.append(portrait,title);
  button.onclick=()=>void selectOnlineAlien(defaultPilotAlien(i));
  region.append(button);
 }
 $('online-alien-random').onclick=()=>void selectOnlineAlien(nextRandomPilotAlien(state.alienDraft));
 $('online-alien-saved').onclick=()=>{
  const saved=getSavedPilotAlien(storage);
  if(!saved){
   $('online-alien-note').textContent='No saved alien yet. Save one in Alien Lab then use this button.';
   return;
  }
  void selectOnlineAlien(saved);
 };
 renderPilotPicker();
}
const safeText=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const codes=/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
const formatTime=ms=>{
 const seconds=Math.max(0,Math.ceil(ms/1000));
 return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
};
const current=()=>state.view?.match;
const me=()=>state.view?.you;
const myTurn=()=>state.view?.phase==='playing'&&
  current()?.current===me()?.index&&!state.busy&&!state.ceremony;
const visibleRack=()=>{
 const rack=current()?.rack||[];
 const byId=new Map(rack.map(t=>[t.id,t]));
 const ordered=state.rackOrder.filter(id=>byId.has(id)).map(id=>byId.get(id));
 const seen=new Set(ordered.map(t=>t.id));
 for(const tile of rack)if(!seen.has(tile.id))ordered.push(tile);
 return ordered;
};
const showNotice=(message,bad=false)=>{
 state.notice=message;
 $('online-log').textContent=message;
 $('online-log').classList.toggle('error',bad);
};
const gateError=(text)=>{
 $('online-gate-error').textContent=text;
 $('online-gate-error').hidden=!text;
};
const sessionStore=()=>{
 if(!storage)return;
 try{
  if(state.code&&state.token)storage.setItem(ONLINE_SESSION_KEY,
    JSON.stringify({code:state.code,token:state.token}));
  else storage.removeItem(ONLINE_SESSION_KEY);
 }catch{}
};
const requestId=()=>crypto.randomUUID();
async function requestApi(path,{method='GET',body,auth=false}={}){
 const headers={'Accept':'application/json'};
 if(body!==undefined)headers['Content-Type']='application/json';
 if(auth){
   if(!state.token)throw new Error('Your private room key was lost. Rejoin the room.');
   headers.Authorization='Bearer '+state.token;
 }
 let response;
 try{
   response=await fetch(ONLINE_API+path,{
     method,headers,body:body===undefined?undefined:JSON.stringify(body),
     cache:'no-store',mode:'cors',signal:AbortSignal.timeout(12000)
   });
 }catch(err){
   throw new Error('Unable to reach the online room server. Check your connection or its Cloudflare deployment.');
 }
 let result;
 try{result=await response.json();}catch{throw new Error('The room server returned an unreadable response.');}
 if(!response.ok){
   const error=new Error(result.error||'Unable to complete the room request.');
   error.status=response.status;throw error;
 }
 return result;
}
const roomPath=()=>'/api/rooms/'+state.code;
const saveRoomFromServer=(payload,{reset=false}={})=>{
 const old=state.view,view=payload.room||payload;
 if(!view||!codes.test(view.code))throw new Error('Invalid room response.');
 if(reset||!old||old.code!==view.code){
   state.pending={};state.order=[];state.rackOrder=[];state.swapIds.clear();
   state.selected=null;state.swapping=false;state.shownResults=false;
 }else if(old.revision!==view.revision){
   const oldMatch=old.match,newMatch=view.match;
   const boardChanged=Boolean(oldMatch&&newMatch&&
     oldMatch.board.some((cell,i)=>cell?.id!==newMatch.board[i]?.id));
   const turnChanged=oldMatch?.turn!==newMatch?.turn||oldMatch?.current!==newMatch?.current;
   const oldRack=(oldMatch?.rack||[]).map(t=>t.id).join('|');
   const newRack=(newMatch?.rack||[]).map(t=>t.id).join('|');
   if(boardChanged||turnChanged||oldRack!==newRack){
     state.pending={};state.order=[];state.selected=null;
     state.swapIds.clear();state.swapping=false;
   }
 }
 state.view=view;state.code=view.code;state.lastRevision=view.revision;
 if(view.you?.avatar)state.alienDraft=safePilotAlien(view.you.avatar,view.you.index);
 if(!state.ceremony)render();
 if(view.phase==='finished'&&!state.shownResults&&!state.ceremony&&!state.busy){
   state.shownResults=true;queueMicrotask(showResults);
 }
};
const setConnection=mode=>{
 state.connection=mode;
 const badge=$('online-connection');badge.textContent=
   mode==='live'?'● LIVE':mode==='reconnecting'?'◌ RECONNECTING':mode==='polling'?'● SYNC':'OFFLINE';
 badge.className='online-connection'+(mode==='live'?' is-live':mode==='reconnecting'?' is-reconnecting':'');
 $('online-dot').style.background=mode==='live'?'#84ebc8':mode==='reconnecting'?'#ead28e':'#7c94a0';
};
function disconnectSockets(){
 if(state.reconnectTimer){clearTimeout(state.reconnectTimer);state.reconnectTimer=null;}
 if(state.ws){
   const ws=state.ws;state.ws=null;
   ws.onclose=null;ws.onmessage=null;ws.onerror=null;
   try{ws.close();}catch{}
 }
}
function connectSocket(){
 if(!state.code||!state.token)return;
 disconnectSockets();
 let ws;
 try{
   ws=new WebSocket(ONLINE_API.replace(/^http/,'ws')+roomPath()+'/ws');
 }catch{setConnection('polling');return;}
 state.ws=ws;
 ws.onopen=()=>{
   if(state.ws!==ws)return;
   state.reconnectDelay=2500;
   setConnection('live');
 };
 ws.onmessage=event=>{
   let msg;
   try{msg=JSON.parse(event.data);}catch{return;}
   if(msg.type==='expired'){
     showNotice('This room has expired. Create or join a new room.',true);
     clearSession();return;
   }
   if(msg.type==='revision'&&msg.revision>state.lastRevision&&!state.busy)
     void refreshRoom();
 };
 ws.onerror=()=>{if(state.ws===ws)setConnection('reconnecting');};
 ws.onclose=()=>{
   if(state.ws!==ws)return;
   state.ws=null;setConnection('reconnecting');
   state.reconnectTimer=setTimeout(()=>{
     if(!state.code||!state.token)return;
     connectSocket();void refreshRoom();
   },state.reconnectDelay);
   state.reconnectDelay=Math.min(60000,state.reconnectDelay*1.75);
 };
}
function clearSession(){
 disconnectSockets();state.view=null;state.code=null;state.token=null;
 state.pending={};state.order=[];state.rackOrder=[];state.swapIds.clear();
 state.busy=false;state.ceremony=null;state.shownResults=false;
 history.replaceState(null,'',location.pathname);
 sessionStore();setConnection('offline');
 render();gateError('');
}
async function refreshRoom(){
 if(!state.code||!state.token||state.refreshing||state.busy)return;
 state.refreshing=true;
 try{
   const response=await requestApi(roomPath()+'/state',{auth:true});
   saveRoomFromServer(response);
   if(state.connection!=='live')setConnection('polling');
 }catch(err){
   setConnection('reconnecting');
   if(err.status===401||err.status===404||err.status===410){
     const code=state.code;clearSession();
     $('online-join-code').value=code;
     gateError('Saved access is no longer valid. Rejoin the room using its code.');
   }else showNotice(err.message,true);
 }finally{state.refreshing=false;}
}
function showEntry(){
 if($('online-pilot-picker').parentElement!==$('online-avatar-entry-slot'))
  $('online-avatar-entry-slot').append($('online-pilot-picker'));
 renderPilotPicker();
 $('online-gate').hidden=false;
 $('online-entry').hidden=false;
 $('online-lobby').hidden=true;
 $('gate-title').textContent='Play together, from anywhere.';
 $('gate-description').textContent=
   'Host a room or enter a six-character code. Only your own seven tiles appear on this device.';
}
function showLobby(){
 if(!state.view)return;
 if($('online-pilot-picker').parentElement!==$('online-avatar-lobby-slot'))
  $('online-avatar-lobby-slot').append($('online-pilot-picker'));
 renderPilotPicker();
 const v=state.view;
 $('online-gate').hidden=false;
 $('online-entry').hidden=true;
 $('online-lobby').hidden=false;
 $('gate-title').textContent='Pilots assembling.';
 $('gate-description').textContent='Share the room code with your group. All players join on their own devices.';
 $('lobby-code').textContent=v.code;
 $('online-lobby-count').textContent=v.people.length+' / '+v.maxPlayers;
 const players=$('online-lobby-players');
 players.replaceChildren(...v.people.map((p,i)=>{
   const node=document.createElement('div');node.className='online-lobby-player';
   const avatar=document.createElement('span');avatar.className='local-score-avatar';
   paintPilotAvatar(avatar,p.avatar,i,{size:52,framing:'bust'});
   const name=document.createElement('strong');name.textContent=p.name;
   const badge=document.createElement('small');badge.textContent=p.host?'HOST':'PILOT';
   node.append(avatar,name,badge);return node;
 }));
 const host=v.you.host,ready=v.people.length>=2;
 $('online-start-match').hidden=!host;
 $('online-start-match').disabled=!host||!ready||state.busy;
 $('online-lobby-note').textContent=host?
   (ready?'You can launch with '+v.people.length+' pilots, or wait until all '+v.maxPlayers+' seats are filled.':'At least two pilots must join before the host can start.'):
   'Waiting for '+v.people[0].name+' to start the match. The lobby updates live.';
}
function renderStandings(){
 const v=state.view,match=v?.match;
 const container=$('online-scores');container.replaceChildren();
 if(!match)return;
 const displayed=match.players.map((p,i)=>({...p,displayScore:
   state.ceremony&&i===state.ceremony.player?
     state.ceremony.start+state.ceremony.awarded:p.score}));
 const top=Math.max(...displayed.map(x=>x.displayScore));
 for(const p of displayed){
   const row=document.createElement('div');
   row.className='local-score-row'+(p.index===match.current&&v.phase==='playing'?' is-active':'')+
     (p.displayScore===top&&p.displayScore>0?' is-leader':'');
   row.dataset.playerIndex=String(p.index);
   const avatar=document.createElement('span');avatar.className='local-score-avatar';
   paintPilotAvatar(avatar,p.avatar,p.index,{size:38,framing:'portrait'});
   const name=document.createElement('span');name.className='local-score-name';name.textContent=p.name+
     (p.index===v.you.index?' · YOU':'');
   const score=document.createElement('span');score.className='local-score-points';
   const strong=document.createElement('strong');strong.textContent=p.displayScore;
   const small=document.createElement('small');small.textContent=p.rackCount+' TILES';
   score.append(strong,small);row.append(avatar,name,score);
   row.setAttribute('aria-label',p.name+': '+p.displayScore+' points');
   container.append(row);
 }
}
function renderBoard(){
 const board=$('board'),view=state.view,match=view?.match;
 const lockedBoard=match?.board||EMPTY_BOARD;
 const focus=board.contains(document.activeElement);
 const preview=inspectPlacement(lockedBoard,state.pending);
 const playing=myTurn(),nodes=[];
 for(let i=0;i<SIZE*SIZE;i++){
   const [r,c]=coords(i),locked=lockedBoard[i],pending=state.pending[i];
   const tile=pending||locked,bonus=bonusAt(r,c);
   const node=document.createElement('button');node.type='button';
   node.className='cell'+(bonus?' bonus-'+bonus.toLowerCase():'')+
     (tile?' occupied':'')+(pending?' pending':'')+
     (state.selected&&playing&&!locked?' drop-ready':'')+
     (preview.indices?.includes(i)?' path-cell':'');
   node.dataset.index=String(i);node.dataset.locked=String(Boolean(locked));
   node.tabIndex=state.focusIndex===i?0:-1;
   node.setAttribute('role','gridcell');
   node.setAttribute('aria-label','Row '+(r+1)+', column '+(c+1)+': '+
     (tile?tile.value:(bonus||'empty'))+(pending?', unscored':''));
   if(tile){
     const glyph=document.createElement('span');glyph.className='board-tile'+
       (isBlank(tile)?' placed-wildcard':'');glyph.textContent=tile.value;
     node.append(glyph);
   }else if(bonus){
     const glyph=document.createElement('span');glyph.className='bonus-label';
     glyph.textContent=bonus==='START'?'✳':bonus;node.append(glyph);
   }
   node.onclick=e=>{if(!wasDragClick(e))placeAt(i);};
   node.addEventListener('keydown',e=>{
     const keys={ArrowLeft:[0,-1],ArrowRight:[0,1],ArrowUp:[-1,0],ArrowDown:[1,0]};
     if(keys[e.key]){
       e.preventDefault();const [dr,dc]=keys[e.key];
       state.focusIndex=pos(Math.max(0,Math.min(12,r+dr)),Math.max(0,Math.min(12,c+dc)));
       $('#board').querySelector('[data-index="'+state.focusIndex+'"]')?.focus({preventScroll:true});
     }else if((e.key==='Delete'||e.key==='Backspace')&&state.pending[i]){
       e.preventDefault();removePending(i);
     }
   });
   if(pending&&playing)enableTileDrag(node,{kind:'pending',index:i},onTileDrop);
   nodes.push(node);
 }
 board.replaceChildren(...nodes);
 if(focus)board.querySelector('[data-index="'+state.focusIndex+'"]')?.focus({preventScroll:true});
}
function renderRack(){
 const v=state.view,match=v?.match;
 const all=visibleRack();
 const used=new Set(Object.values(state.pending).filter(t=>t.value!=='=').map(t=>t.id));
 const rack=all.filter(t=>!used.has(t.id)),enabled=myTurn();
 const root=$('rack');root.replaceChildren();
 for(const [index,tile] of rack.entries()){
   const button=document.createElement('button');button.type='button';
   button.className='tile'+(state.selected===tile.id?' selected':'')+
     (state.swapIds.has(tile.id)?' marked':'')+
     (isBlank(tile)?' wildcard wildcard-'+tile.blank:'');
   button.dataset.tileId=tile.id;button.dataset.rackIndex=String(index);
   const face=document.createElement('span');face.textContent=isBlank(tile)?
     BLANK_KINDS[tile.blank].symbol:tile.value;
   const p=document.createElement('sub');p.textContent=isBlank(tile)?
     (tile.blank==='blank-number'?'N':tile.blank==='blank-operator'?'OP':'ALL'):tile.points;
   button.append(face,p);
   button.disabled=!enabled;
   button.setAttribute('aria-label',isBlank(tile)?
     'Blank '+BLANK_KINDS[tile.blank].label+', zero points':'Tile '+tile.value+', '+tile.points+' points');
   button.setAttribute('aria-pressed',String(state.selected===tile.id||state.swapIds.has(tile.id)));
   button.onclick=e=>{
     if(wasDragClick(e))return;
     if(state.swapping){
       state.swapIds.has(tile.id)?state.swapIds.delete(tile.id):state.swapIds.add(tile.id);
     }else state.selected=state.selected===tile.id?null:tile.id;
     render();
   };
   if(enabled&&!state.swapping)enableTileDrag(button,{kind:'rack',id:tile.id},onTileDrop);
   root.append(button);
 }
 $('online-rack-count').textContent=rack.length+' / 8';
 $('equals-tile').disabled=!enabled||state.swapping;
 $('equals-tile').classList.toggle('selected',state.selected==='equals');
 $('online-rack-label').textContent=match?'YOUR PRIVATE RACK · '+v.you.name.toUpperCase():'YOUR PRIVATE RACK';
}
function renderPreview(){
 const board=current()?.board||EMPTY_BOARD,preview=inspectPlacement(board,state.pending);
 const eligible=Boolean(freeExchangeReason(current()?.rack||[]))&&!current()?.freeExchangeUsed&&state.swapIds.size<=1;
 $('equation-preview').dataset.state=state.swapping?'swap':preview.status;
 $('equation-preview').classList.toggle('ceremony-active',Boolean(state.ceremony));
 $('ceremony-readout').hidden=!state.ceremony;
 $('online-expression').textContent=state.swapping?'TILE EXCHANGE':preview.text||'—';
 $('online-preview-status').textContent=state.swapping?
   (eligible?'Select one tile for a free swap; swapping several costs your turn.':'Choose tiles to replace; exchanging uses the turn.'):
   myTurn()?preview.feedback:'Wait for your turn. Only the current pilot can submit.';
 $('online-potential').textContent=preview.ready&&!state.swapping?
   '+'+scoreMove(board,state.pending,preview).total:'—';
 const can=myTurn();
 $('online-score').disabled=!can||state.swapping||!Object.keys(state.pending).length;
 $('online-clear').disabled=!can||(!state.swapping&&!Object.keys(state.pending).length);
 $('online-pass').disabled=!can;
 $('online-swap').disabled=!can||(current()?.bagCount||0)<1;
 $('online-swap').textContent=state.swapping?
   '⇄ CONFIRM ('+state.swapIds.size+')':eligible?'⇄ FREE SWAP':'⇄ SWAP';
 $('online-undo').disabled=!can||!state.order.length;
}
function render(){
 const v=state.view,match=v?.match;
 if(!v){showEntry();}
 else if(v.phase==='lobby'){showLobby();}
 else {$('online-gate').hidden=true;gateError('');}
 $('online-room-code').textContent=v?.code||'······';
 $('online-room-code').title=v?.code?'Room '+v.code:'';
 $('online-share').disabled=!v;
 $('online-title').textContent=v?
   v.phase==='lobby'?'WAITING · ROOM '+v.code:
   v.phase==='finished'?'SIGNAL CLASH · FINAL SCORES':
   'SIGNAL CLASH · ROOM '+v.code:'SIGNAL CLASH · ONLINE';
 $('online-clock').textContent=match?.deadline?formatTime(match.deadline-Date.now()):
   v?.turnSeconds?v.turnSeconds+'s':'NO TIMER';
 $('online-current').replaceChildren();
 const currentText=document.createElement('span');
 currentText.textContent=v?.phase==='finished'?'Match finished. Check the final standings.':
   match?(myTurn()?'Your turn: build a correct BIDMAS equation.':
      match.players[match.current].name+' is choosing their move.'):'Waiting for pilots to join.';
 if(match&&v.phase==='playing'){
   const portrait=document.createElement('span');
   paintPilotAvatar(portrait,match.players[match.current].avatar,match.current,
     {size:35,framing:'portrait'});
   $('online-current').append(portrait);
 }
 $('online-current').append(currentText);
 $('online-bag-count').textContent=match?.bagCount??'—';
 $('online-bag').disabled=!match;
 $('app').dataset.onlineTurn=String(myTurn());
 const recent=match?.lastMoves||[];
 $('online-moves').replaceChildren(...recent.slice(-3).reverse().map(m=>{
   const row=document.createElement('div');row.className='history-row';
   const who=document.createElement('span');who.textContent=match.players[m.player]?.name||'Pilot';
   const what=document.createElement('strong');what.textContent=m.equation?m.equation+' · +'+m.points:
     (m.type==='timeout'?'TIME OUT':m.type.toUpperCase().replace('-',' '));
   row.append(who,what);return row;
 }));
 renderStandings();renderBoard();renderRack();renderPreview();
}
function removePending(i){
 if(!state.pending[i])return;
 const prior=state.pending[i];delete state.pending[i];
 state.order=state.order.filter(x=>x!==i);
 if(prior.value!=='=')state.selected=prior.id;
 render();
}
function placeAt(index){
 if(!myTurn()||state.swapping)return;
 if(state.pending[index])return removePending(index);
 if(current()?.board[index]||!state.selected)return;
 if(state.selected==='equals'){
   state.pending[index]={id:'free-equals-'+index,value:'=',points:0};
   state.order.push(index);state.selected=null;render();return;
 }
 const tile=visibleRack().find(t=>t.id===state.selected);
 if(!tile||Object.values(state.pending).some(t=>t.id===tile.id))return;
 if(isBlank(tile)){
   showWildcard(tile,value=>{
     state.pending[index]={...tile,value,points:0};state.order.push(index);
     state.selected=null;render();
   });
   return;
 }
 state.pending[index]=tile;state.order.push(index);state.selected=null;render();
}
function onTileDrop(payload,target){
 if(!myTurn()||state.swapping)return;
 if(target.kind==='board'){
   if(payload.kind==='pending'){
     if(payload.index===target.index)return;
     if(current()?.board[target.index])return;
     const old=state.pending[payload.index];
     if(!old)return;
     const swapped=state.pending[target.index];
     if(swapped)state.pending[payload.index]=swapped;
     else delete state.pending[payload.index];
     state.pending[target.index]=old;
     state.order=state.order.map(i=>i===payload.index?target.index:
       i===target.index?payload.index:i);
     render();return;
   }
   if(payload.kind==='rack'){state.selected=payload.id;placeAt(target.index);}
 }else if(target.kind==='rack'){
   if(payload.kind==='pending')removePending(payload.index);
   else if(payload.kind==='rack'){
     const all=visibleRack(),hidden=Object.values(state.pending).filter(t=>t.value!=='=').map(t=>t.id);
     const rearranged=reorderRack(all,payload.id,target.index,hidden);
     state.rackOrder=rearranged.map(t=>t.id);render();
   }
 }
}
function showDialog(eyebrow,title,content,buttons=[{label:'CLOSE'}]){
 $('online-dialog-eyebrow').textContent=eyebrow;
 $('online-dialog-title').textContent=title;
 const body=$('online-dialog-body');
 body.replaceChildren();
 if(typeof content==='string')body.textContent=content;
 else if(content)body.append(content);
 const actions=$('online-dialog-actions');
 actions.replaceChildren(...buttons.map(x=>{
   const b=document.createElement('button');b.type='button';
   b.className=x.primary?'primary-command':'secondary-command';
   b.textContent=x.label;
   b.onclick=()=>{$('online-dialog').close();x.action?.();};return b;
 }));
 if(!$('online-dialog').open)$('online-dialog').showModal();
}
$('online-dialog-close').onclick=()=>$('online-dialog').close();
function showWildcard(tile,callback){
 const content=document.createElement('div');
 const note=document.createElement('p');note.textContent='Assign a value to your '+BLANK_KINDS[tile.blank].label.toLowerCase()+
   ' wildcard. Its physical tile is worth zero points.';
 const choices=document.createElement('div');choices.className='online-wild-grid';
 for(const value of BLANK_KINDS[tile.blank].choices){
   const button=document.createElement('button');button.type='button';button.textContent=value;
   button.onclick=()=>{$('online-dialog').close();callback(value);};
   choices.append(button);
 }
 content.append(note,choices);
 showDialog('WILDCARD PROGRAMMER','Choose a value',content,[{label:'CANCEL'}]);
}
function showBag(){
 const inventory=current()?.bagInventory;if(!inventory)return;
 const wrap=document.createElement('div');wrap.className='bag-overview';
 const count=document.createElement('div');count.className='bag-overview-total';
 const total=document.createElement('strong');total.textContent=inventory.total;
 const detail=document.createElement('div');
 detail.textContent='PHYSICAL TILES LEFT IN SHARED BAG';
 count.append(total,detail);wrap.append(count);
 const groups=document.createElement('div');groups.className='bag-inventory-groups';
 for(const group of inventory.groups){
   const section=document.createElement('section');section.className='bag-inventory-group';
   const heading=document.createElement('div');heading.className='bag-inventory-heading';
   const title=document.createElement('strong');title.textContent=group.title;
   const remaining=document.createElement('span');remaining.textContent=group.total+' remaining';
   heading.append(title,remaining);section.append(heading);
   const tiles=document.createElement('div');tiles.className='bag-inventory-tiles bag-inventory-'+group.id;
   for(const tile of group.tiles){
     const item=document.createElement('div');item.className='bag-inventory-tile'+(!tile.count?' is-empty':'');
     const face=document.createElement('span');face.className='bag-inventory-face';face.textContent=tile.symbol;
     const num=document.createElement('strong');num.className='bag-inventory-count';num.textContent='×'+tile.count;
     item.append(face,num);item.setAttribute('aria-label',tile.label+': '+tile.count+' remaining');
     tiles.append(item);
   }
   section.append(tiles);groups.append(section);
 }
 wrap.append(groups);
 const note=document.createElement('p');note.className='bag-inventory-note';
 note.textContent='Only physical tiles remaining in the bag are counted. Tiles in any player rack or already on the board are excluded. The equals sign is unlimited and free; future draw order is hidden.';
 wrap.append(note);
 showDialog('BAG SCAN','Remaining shared tiles',wrap);
}
function showResults(){
 const match=current();if(!match?.standings)return;
 state.shownResults=true;
 const content=document.createElement('div');
 const intro=document.createElement('p');
 intro.textContent=match.reason==='stalled'?
   'Two full circuits without scoring ended the match.':'A pilot went out after the bag emptied.';
 content.append(intro);
 const table=document.createElement('div');table.className='online-results';
 for(const p of match.standings){
   const row=document.createElement('div');
   row.className='online-result'+(p.winner?' is-winner':'');
   const rank=document.createElement('strong');rank.textContent=p.winner?'★':String(p.rank);
   const portrait=document.createElement('span');portrait.className='alien-result-avatar';
   paintPilotAvatar(portrait,state.view.people[p.index]?.avatar,p.index,{size:40,framing:'bust'});
   const name=document.createElement('strong');name.textContent=p.name;
   const gross=document.createElement('span');gross.textContent=p.gross+' pts';
   const net=document.createElement('span');net.textContent='−'+p.penalty+' = '+p.net;
   row.classList.add('alien-online-result');
   row.append(rank,portrait,name,gross,net);table.append(row);
 }
 content.append(table);
 const note=document.createElement('p');
 note.textContent='The winner has the highest final score after subtracting leftover rack tile points. Tied top scores share first place.';
 content.append(note);
 showDialog('SIGNAL CLASH COMPLETE','Final standings',content,
   [{label:'VIEW BOARD',primary:true},{label:'NEW ROOM',action:()=>{
     clearSession();showEntry();
   }}]);
}
$('online-help').onclick=()=>{
 const wrap=document.createElement('div');
 wrap.className='training-steps';
 const rules=[
  ['One board, private racks','Each of 2–4 pilots joins with a code, keeps a private eight-tile rack and shares the same 13×13 board.'],
  ['Build and submit real equations','The first correct equation crosses the centre; later ones share a locked tile. BIDMAS applies. No 3 = 3 shortcuts.'],
  ['Score, pass or swap','Premium squares, equation length and crossing awards apply. The server independently validates all tile ownership, maths, scores and timers.'],
  ['Finish on net points','When the bag is empty and someone goes out, or two full rounds pass without scoring, leftover rack tile values are deducted.']
 ];
 for(const [i,[title,body]] of rules.entries()){
   const row=document.createElement('div');row.className='training-step';
   const num=document.createElement('span');num.textContent=String(i+1).padStart(2,'0');
   const detail=document.createElement('div');const t=document.createElement('strong');t.textContent=title;
   const p=document.createElement('p');p.textContent=body;detail.append(t,p);row.append(num,detail);wrap.append(row);
 }
 showDialog('FLIGHT MANUAL','Online Signal Clash',wrap,[{label:'BACK TO BOARD',primary:true}]);
};
async function copyInvite(){
 if(!state.code){showNotice('Create or join a room first.',true);return;}
 const url=new URL('online.html#'+state.code,location.href).href;
 try{
   await navigator.clipboard.writeText(url);
   showNotice('Invite copied. Share the link with your other pilots.');
 }catch{
   showDialog('ROOM INVITE','Copy this room link',url,[{label:'CLOSE',primary:true}]);
 }
}
$('online-share').onclick=copyInvite;
$('lobby-copy').onclick=copyInvite;
$('online-bag').onclick=showBag;
$('equals-tile').onclick=()=>{if(!myTurn()||state.swapping)return;
 state.selected=state.selected==='equals'?null:'equals';render();};
$('online-undo').onclick=()=>{if(!myTurn()||!state.order.length)return;
 removePending(state.order.at(-1));};
$('online-clear').onclick=()=>{
 if(!myTurn())return;
 state.pending={};state.order=[];state.swapIds.clear();state.swapping=false;
 state.selected=null;render();
};
async function mutate(endpoint,payload){
 if(!state.view||state.busy)return;
 state.busy=true;render();
 const request={id:requestId(),revision:state.view.revision,...payload};
 state.pendingRequest={endpoint,request};
 try{
   const result=await requestApi(roomPath()+'/'+endpoint,{
     method:'POST',auth:true,body:request
   });
   state.pendingRequest=null;
   saveRoomFromServer(result);
   return result;
 }catch(err){
   showNotice(err.message,true);
   if(err.status===409||err.status===403)state.pendingRequest=null;
   // Allow the conflict recovery request while the action spinner is active.
   state.busy=false;
   await refreshRoom();
   if(!err.status){
     showDialog('CONNECTION INTERRUPTED','Confirm your last action',
       'The server may have received your move. Reconnect and review the board before submitting another turn.',
       [{label:'BACK TO BOARD',primary:true},
        {label:'RETRY SAME ACTION',action:retryPending}]);
   }
   return null;
 }finally{state.busy=false;render();}
}
async function retryPending(){
 const pending=state.pendingRequest;
 if(!pending||!state.code)return;
 state.busy=true;render();
 try{
   const response=await requestApi(roomPath()+'/'+pending.endpoint,{method:'POST',auth:true,body:pending.request});
   state.pendingRequest=null;saveRoomFromServer(response);
   if(response.event?.type==='scored')void playScoring(response.event);
 }catch(err){showNotice(err.message,true);await refreshRoom();}
 finally{state.busy=false;render();}
}
function clearCeremony(){
 const cells=$('board').querySelectorAll('.scoring-lift,.scoring-settled');
 cells.forEach(cell=>{cell.classList.remove('scoring-lift','scoring-settled');cell.style.removeProperty('--ceremony-speed');});
 $('board').querySelectorAll('.score-pip').forEach(p=>p.remove());
}
function ceremonyReadout(ctl,label){
 $('ceremony-readout').hidden=false;
 $('equation-preview').classList.add('ceremony-active');
 $('ceremony-count').textContent=(ctl.awarded>=0?'+':'')+ctl.awarded;
 $('ceremony-tile-count').textContent=ctl.tiles+' / '+ctl.tileCount+' TILES';
 $('ceremony-step').textContent=label;
 $('ceremony-meter-fill').style.width=Math.max(0,Math.min(100,
   100*ctl.awarded/Math.max(1,ctl.total)))+'%';
 const score=$('online-scores').querySelector('[data-player-index="'+ctl.player+'"] .local-score-points strong');
 if(score)score.textContent=String(ctl.start+ctl.awarded);
}
function endScoring(ctl){
 if(!ctl||state.ceremony!==ctl||ctl.finished)return;
 ctl.finished=true;state.ceremony=null;state.busy=false;
 clearCeremony();$('ceremony-readout').hidden=true;
 $('equation-preview').classList.remove('ceremony-active');
 render();
 showNotice('Equation verified. +'+ctl.total+' points awarded.');
 const content=document.createElement('div');
 const equation=document.createElement('p');equation.className='equation-result';
 equation.textContent=ctl.move.text;
 const breakdown=document.createElement('div');breakdown.className='score-breakdown';
 const lines=[
  ['Tile points',String(ctl.points.base)],
  ['Equation multiplier','×'+ctl.points.multiplier],
  ['Length bonus','+'+ctl.points.length],
  ['Correct calculation','+'+ctl.points.equation],
  ['Shared tile connection','+'+ctl.points.crossing],
  ['Played full rack','+'+ctl.points.sweep],
  ['TOTAL','+'+ctl.total]
 ];
 for(const [label,amount] of lines){
   const row=document.createElement('div');if(label==='TOTAL')row.className='total';
   const title=document.createElement('span');title.textContent=label;
   const val=document.createElement('b');val.textContent=amount;row.append(title,val);breakdown.append(row);
 }
 content.append(equation,breakdown);
 showDialog('SERVER VERIFIED','+'+ctl.total+' points',content,[{label:'CONTINUE',primary:true,action:()=>{
   if(state.view?.phase==='finished')showResults();
 }}]);
}
async function playScoring(event){
 const points=event.points,move=event.move;
 if(!points||!move)return;
 const stages=buildScoringCeremony(points);
 const match=current(),player=event.by;
 const ctl={start:match.players[player].score-points.total,
   awarded:0,total:points.total,stages,move,points,player,
   tileCount:stages.filter(s=>s.kind==='tile').length,tiles:0,finished:false};
 state.ceremony=ctl;state.busy=true;render();ceremonyReadout(ctl,'READY TO TRANSFER');
 if(document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches){
   endScoring(ctl);return;
 }
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const active=()=>state.ceremony===ctl&&!ctl.finished;
 const speed=ceremonyDurationMs(ctl.tileCount);
 for(const stage of stages){
   if(!active())return;
   clearCeremony();
   if(stage.kind==='tile'){
     const cell=$('board').querySelector('[data-index="'+stage.index+'"]');
     if(cell){cell.style.setProperty('--ceremony-speed',speed+'ms');cell.classList.add('scoring-lift');}
     ceremonyReadout(ctl,'TILE '+(ctl.tiles+1));
     await pause(Math.round(speed*.7));
     if(!active())return;
     if(cell){
       cell.classList.add('scoring-settled');
       const pop=document.createElement('span');pop.className='score-pip';
       pop.textContent=stage.amount?'+'+stage.amount:'+0';
       pop.addEventListener('animationend',()=>pop.remove(),{once:true});
       cell.append(pop);
     }
     ctl.awarded+=stage.amount;ctl.tiles++;
     ceremonyReadout(ctl,stage.value+'  +'+stage.amount);
     await pause(Math.round(speed*.3));
   }else{
     ctl.awarded+=stage.amount;ceremonyReadout(ctl,stage.label);
     await pause(130);
   }
 }
 if(active())endScoring(ctl);
}
$('skip-ceremony').onclick=()=>endScoring(state.ceremony);
$('online-score').onclick=async()=>{
 if(!myTurn()||!Object.keys(state.pending).length)return;
 const check=inspectPlacement(current().board,state.pending);
 if(!check.ready){showNotice(check.feedback||'Finish the equation first.',true);return;}
 const placements=Object.entries(state.pending).map(([i,t])=>({
   index:Number(i),tileId:t.value==='='?'=':t.id,value:t.value
 }));
 const result=await mutate('action',{type:'score',placements});
 if(result?.event?.type==='scored')void playScoring(result.event);
};
$('online-pass').onclick=async()=>{
 if(!myTurn())return;
 if(Object.keys(state.pending).length){showNotice('Return your unscored tiles before passing.',true);return;}
 const result=await mutate('action',{type:'pass'});
 if(result){
   showNotice('Turn passed. Waiting for the next pilot.');
   if(state.view?.phase==='finished')showResults();
 }
};
$('online-swap').onclick=async()=>{
 if(!myTurn())return;
 if(!state.swapping){
   if(Object.keys(state.pending).length){showNotice('Clear unscored tiles before swapping.',true);return;}
   state.swapping=true;state.selected=null;render();
   showNotice('Select exactly one tile to swap free once per turn. Multiple tiles cost the turn.');
   return;
 }
 if(!state.swapIds.size){showNotice('Select at least one tile from your rack.',true);return;}
 const result=await mutate('action',{type:'exchange',ids:[...state.swapIds]});
 if(result){
   showNotice(result.event?.type==='free-exchange'?
     'Free tile swap complete. You may still score this turn.':'Tiles exchanged; the turn has passed.');
   if(state.view?.phase==='finished')showResults();
 }
};
$('online-start-match').onclick=async()=>{
 if(!state.view?.you.host||state.view.people.length<2)return;
 gateError('');
 const result=await mutate('start',{});
 if(result)showNotice('Match started! Build equations with BIDMAS.');
};
$('online-create-form').onsubmit=async e=>{
 e.preventDefault();gateError('');
 $('online-create-button').disabled=true;
 try{
   const data=await requestApi('/api/rooms',{method:'POST',body:{
     name:$('online-host-name').value,
     maxPlayers:Number($('online-player-limit').value),
     turnSeconds:Number($('online-timer-settings').value),
     avatar:state.alienDraft
   }});
   state.token=data.token;saveRoomFromServer(data,{reset:true});
   sessionStore();history.replaceState(null,'','#'+state.code);
   connectSocket();showNotice('Room created. Share the code and invite your pilots.');
 }catch(err){gateError(err.message);}
 finally{$('online-create-button').disabled=false;}
};
$('online-join-form').onsubmit=async e=>{
 e.preventDefault();gateError('');
 const code=$('online-join-code').value.trim().toUpperCase();
 if(!codes.test(code)){gateError('Enter the six characters from the host.');return;}
 $('online-join-button').disabled=true;
 try{
   const data=await requestApi('/api/rooms/'+code+'/join',{
     method:'POST',body:{name:$('online-join-name').value,avatar:state.alienDraft}
   });
   state.token=data.token;saveRoomFromServer(data,{reset:true});
   sessionStore();history.replaceState(null,'','#'+state.code);
   connectSocket();showNotice('Joined room '+code+'. Waiting for the host.');
 }catch(err){gateError(err.message);}
 finally{$('online-join-button').disabled=false;}
};
$('online-leave-lobby').onclick=async()=>{
 if(!state.view||state.view.phase!=='lobby'||state.busy)return;
 state.busy=true;render();
 try{
   await requestApi(roomPath()+'/leave',{method:'POST',auth:true,
     body:{id:requestId(),revision:state.view.revision}});
   clearSession();
 }catch(err){
   gateError(err.message);
 }finally{state.busy=false;render();}
};
async function restore(){
 let previous;
 try{previous=JSON.parse(storage?.getItem(ONLINE_SESSION_KEY)||'null');}catch{}
 const invite=location.hash.slice(1).toUpperCase();
 if(codes.test(invite))$('online-join-code').value=invite;
 if(previous&&codes.test(previous.code)&&typeof previous.token==='string'&&
   (!codes.test(invite)||invite===previous.code)){
   state.code=previous.code;state.token=previous.token;
   try{
     const response=await requestApi(roomPath()+'/state',{auth:true});
     saveRoomFromServer(response,{reset:true});
     connectSocket();showNotice('Reconnected to room '+state.code+'.');
   }catch(err){
     if([401,404,410].includes(err.status))clearSession();
     gateError(err.message);
   }
 }else showEntry();
}
window.setInterval(()=>{
 if(!state.view)return;
 const match=current();
 if(match?.deadline)$('online-clock').textContent=formatTime(match.deadline-Date.now());
},250);
// Event-first syncing: hibernating room WebSockets deliver every authoritative
// revision. Avoid repeated HTTP+Durable Object reads while the socket is live.
// Only fall back to bounded polling while the connection is unavailable.
window.setInterval(()=>{
 if(state.view&&!state.busy&&!document.hidden&&state.connection!=='live')void refreshRoom();
},30000);
document.addEventListener('visibilitychange',()=>{
 if(!document.hidden&&state.view&&!state.busy)void refreshRoom();
});
window.addEventListener('keydown',event=>{
 if($('online-dialog').open||!$('online-gate').hidden||!myTurn())return;
 if(event.key==='='||event.key==='Enter'&&document.activeElement===$('equals-tile')){
   state.selected='equals';render();return;
 }
 if(event.key==='Escape'){state.selected=null;state.swapping=false;state.swapIds.clear();render();return;}
 if(event.key==='Backspace'&&state.order.length){
   event.preventDefault();removePending(state.order.at(-1));return;
 }
 const i=Number(event.key);
 if(i>=1&&i<=8&&String(i)===event.key){
   const used=new Set(Object.values(state.pending).map(t=>t.id));
   const tiles=visibleRack().filter(t=>!used.has(t.id));
   if(tiles[i-1]){state.selected=tiles[i-1].id;render();}
 }
});
initOnlineAlienPicker();
void loadPilotArtwork().then(()=>{
 renderPilotPicker();
 if(state.view)render();
});
render();
void restore();
