// Pass E: Salvage Bay display with in-place updates. Purchase rules,
 // inventory and randomised stock remain entirely inside rogue.js.
 import {ROGUE_ITEM_BY_ID,TEMP_ITEM_BY_ID,MAX_PERMANENT_SLOTS,MAX_TEMPORARY_SLOTS,
  shopOffers,shopTemperatures,heldConsumables} from './rogue.js';
 import {equipmentArt} from './equipment-art.js';
 import {workshopDeviceArt,workshopAccent,workshopOfferState} from './workshop-art.js';
 export function salvageWorkshopMarkup(){return "<div class=\"drift-salvage-hero\">\n  <img src=\"./assets/salvage-bay.svg\" width=\"1200\" height=\"470\" alt=\"An orbital workshop with a reactor spacecraft suspended on a maintenance cradle, welding arms, diagnostic panels and glowing tool stands.\">\n  <div class=\"drift-salvage-caption\">\n    <span>BAY 07 · ORBITAL MAINTENANCE</span><strong>YOUR SHIP. OUR WORKSHOP.</strong>\n    <p>Choose equipment for the next jump. Ship Systems stay installed for the run; Mission Gadgets are one-use tools.</p>\n    <span class=\"workshop-crew-label\">✦ REPAIR CREW ON DUTY</span>\n  </div>\n </div>\n <div class=\"drift-shop-budget workshop-console\" aria-label=\"Live workshop resources\">\n  <div><span>AVAILABLE FLUX</span><strong id=\"bay-flux\" class=\"workshop-flux-value\">0</strong></div>\n  <div><span>SHIP SYSTEMS INSTALLED</span><strong id=\"bay-system-count\">0 / 4</strong></div>\n  <div><span>GADGETS IN LOCKER</span><strong id=\"bay-gadget-count\">0 / 2</strong></div>\n </div>\n <section class=\"workshop-installed\" aria-label=\"Your installed systems and carried gadgets\">\n   <div class=\"workshop-installed-heading\"><span>YOUR LOADOUT</span><small>Equipment joins the reactor HUD after launch</small></div>\n   <div class=\"workshop-loadout\">\n     <div class=\"workshop-loadout-group\"><span class=\"workshop-loadout-title\">SHIP SYSTEMS · PERMANENT</span>\n      <div id=\"bay-equipped-systems\" class=\"workshop-equipped-grid workshop-systems\" role=\"group\" aria-label=\"Four Ship System bays\"></div>\n     </div>\n     <div class=\"workshop-loadout-group\"><span class=\"workshop-loadout-title\">MISSION GADGETS · ONE USE</span>\n      <div id=\"bay-equipped-gadgets\" class=\"workshop-equipped-grid workshop-gadgets\" role=\"group\" aria-label=\"Two Mission Gadget bays\"></div>\n     </div>\n   </div>\n </section>\n <section class=\"workshop-catalog workshop-system-catalog\" aria-labelledby=\"workshop-systems-title\">\n   <div class=\"workshop-section-header\"><div><span>01 · MODULE DEPOT</span><h3 id=\"workshop-systems-title\">Ship Systems</h3>\n     <p>Install up to four independent upgrades. They stay aboard throughout the Drift.</p></div>\n     <span id=\"bay-system-offers\" class=\"workshop-stock-count\" aria-label=\"Available Ship System stock\">4 ON DISPLAY</span></div>\n   <div id=\"salvage-grid\" class=\"salvage-grid\" role=\"group\" aria-label=\"Randomly selected Ship System offers\"></div>\n </section>\n <section class=\"workshop-catalog workshop-gadget-catalog\" aria-labelledby=\"workshop-gadgets-title\">\n   <div class=\"workshop-section-header\"><div><span>02 · GADGET LOCKER</span><h3 id=\"workshop-gadgets-title\">Mission Gadgets</h3>\n    <p>Store up to two single-use tools. Arm boosts or manipulate a rack tile during play.</p></div>\n    <span id=\"bay-gadget-offers\" class=\"workshop-stock-count\" aria-label=\"Mission Gadget stock\">3 ON DISPLAY</span></div>\n   <div id=\"salvage-temporary-grid\" class=\"salvage-grid\" role=\"group\" aria-label=\"Randomly selected Mission Gadgets\"></div>\n </section>\n <p id=\"salvage-feedback\" class=\"salvage-feedback workshop-feedback\" role=\"status\" aria-live=\"polite\" tabindex=\"-1\">Four Ship Systems and three Mission Gadgets are drawn after each cleared sector. This bay keeps its stock until you launch; upgrades are never rerolled by opening the workshop.</p>";}

 function equippedSlot(item,index,temporary,feedback,purchasedId){
  const kind=temporary?'Mission Gadget':'Ship System';
  if(!item){
   const slot=document.createElement('div');
   slot.className='workshop-slot is-empty';slot.setAttribute('role','img');
   slot.setAttribute('aria-label','Empty '+kind+' bay '+(index+1));
   slot.innerHTML='<span class="workshop-slot-plus" aria-hidden="true">＋</span><span class="workshop-slot-label">EMPTY</span>';
   return slot;
  }
  const slot=document.createElement('button');slot.type='button';
  slot.className='workshop-slot is-filled';
  slot.dataset.itemId=item.id;slot.dataset.category=item.kind;
  if(item.id===purchasedId)slot.classList.add('is-new');
  slot.style.setProperty('--workshop-accent',workshopAccent(item.kind));
  slot.title=item.name+' · '+item.kind+'\n'+item.description;
  slot.setAttribute('aria-label',kind+' bay '+(index+1)+': '+item.name+'. '+item.description);
  const icon=document.createElement('span');icon.className='workshop-slot-art';icon.innerHTML=equipmentArt(item.id);
  const name=document.createElement('span');name.className='workshop-slot-label';name.textContent=item.name;
  slot.append(icon,name);
  slot.addEventListener('click',()=>{
   feedback.textContent=item.name+' · '+(temporary?'Carried gadget: ':'Installed system: ')+item.description;
  });
  return slot;
 }
 function shopCard(item,temporary,{rogue,onPurchase,paint}){
  const card=document.createElement('article');
  card.className='salvage-card'+(temporary?' salvage-consumable':'');
  card.dataset.category=item.kind;card.dataset.itemId=item.id;
  card.style.setProperty('--workshop-accent',workshopAccent(item.kind));
  const stage=document.createElement('div');stage.className='workshop-item-stage';
  stage.innerHTML=workshopDeviceArt(item.id,temporary);
  const kind=document.createElement('span');kind.className='salvage-type';kind.textContent=item.kind;
  const name=document.createElement('strong');name.textContent=item.name;
  const copy=document.createElement('p');copy.textContent=item.description;
  const detail=document.createElement('div');detail.className='workshop-card-detail';
  const lifespan=document.createElement('span');lifespan.textContent=temporary?'ONE USE':'INSTALLED SYSTEM';
  const cost=document.createElement('span');cost.className='workshop-price-tag';cost.textContent=item.cost+' FLUX';
  detail.append(lifespan,cost);
  const buy=document.createElement('button');buy.className='salvage-buy';buy.type='button';
  const slots=temporary?heldConsumables(rogue).length:rogue.upgrades.length;
  const maxSlots=temporary?MAX_TEMPORARY_SLOTS:MAX_PERMANENT_SLOTS;
  const availability=workshopOfferState({flux:rogue.flux,slots,maxSlots,cost:item.cost});
  buy.disabled=availability!=='available';
  const status=availability==='full'?'SLOTS FULL':
    availability==='unaffordable'?'NOT ENOUGH':temporary?'STORE GADGET':'INSTALL SYSTEM';
  // Cost comes first for existing tests and the screen-reader purchase flow.
  buy.textContent=item.cost+' FLUX · '+status;
  buy.setAttribute('aria-label',(temporary?'Store ':'Install ')+item.name+' for '+item.cost+
    ' Flux'+(buy.disabled?' ('+(availability==='full'?'slots full':'insufficient Flux')+')':''));
  buy.addEventListener('click',()=>{
    const result=onPurchase(item.id,temporary);
    const feedback=document.getElementById('salvage-feedback');
    if(!result.ok){if(feedback)feedback.textContent=result.reason;return;}
    const viewport=document.getElementById('drift-hub-body');
    const scroll=viewport.scrollTop;
    paint(result.rogue,item.id);
    viewport.scrollTop=scroll;
    if(feedback)feedback.textContent=result.reason+
      (temporary?'. Stored in your Gadget Locker.':'. Fitted to your ship for this Drift.');
    const original=document.querySelector(
      '.salvage-card[data-item-id="'+item.id+'"] .salvage-buy:not(:disabled)');
    const next=original||document.querySelector(
      (temporary?'#salvage-temporary-grid':'#salvage-grid')+' .salvage-buy:not(:disabled)');
    (next||feedback)?.focus({preventScroll:true});
  });
  card.append(stage,kind,name,copy,detail,buy);
  return card;
 }

 // The view is redrawn in the *same* dialog after a purchase; scroll and stock
 // stay stable. The host supplies the purchasing function and persists state.
 export function mountSalvageWorkshop({rogue,sector,onPurchase}){
  const root=document.getElementById('drift-hub-body');
  if(!root||!root.querySelector('#salvage-grid'))return;
  const feedback=root.querySelector('#salvage-feedback');
  function paint(currentRogue,purchasedId=null){
   const systems=shopOffers(sector,currentRogue),gadgets=shopTemperatures(sector,currentRogue);
   const installed=currentRogue.upgrades.map(id=>ROGUE_ITEM_BY_ID[id]).filter(Boolean);
   const inventory=heldConsumables(currentRogue).map(id=>TEMP_ITEM_BY_ID[id]).filter(Boolean);
   root.querySelector('#bay-flux').textContent=currentRogue.flux;
   root.querySelector('#bay-system-count').textContent=installed.length+' / '+MAX_PERMANENT_SLOTS;
   root.querySelector('#bay-gadget-count').textContent=inventory.length+' / '+MAX_TEMPORARY_SLOTS;
   root.querySelector('#bay-system-offers').textContent=systems.length+' ON DISPLAY';
   root.querySelector('#bay-gadget-offers').textContent=gadgets.length+' ON DISPLAY';
   root.querySelector('#bay-equipped-systems').replaceChildren(...Array.from({length:MAX_PERMANENT_SLOTS},(_,i)=>
     equippedSlot(installed[i],i,false,feedback,purchasedId)));
   root.querySelector('#bay-equipped-gadgets').replaceChildren(...Array.from({length:MAX_TEMPORARY_SLOTS},(_,i)=>
     equippedSlot(inventory[i],i,true,feedback,purchasedId)));
   const systemGrid=root.querySelector('#salvage-grid'),gadgetGrid=root.querySelector('#salvage-temporary-grid');
   if(!systems.length){
    const empty=document.createElement('p');empty.className='salvage-empty';
    empty.textContent=installed.length===MAX_PERMANENT_SLOTS?
      'All four Ship System bays are occupied. Your modules are ready to fly.':
      'No more Ship Systems are on display in this bay.';
    systemGrid.replaceChildren(empty);
   }else{
    systemGrid.replaceChildren(...systems.map(item=>
      shopCard(item,false,{rogue:currentRogue,onPurchase,paint})));
   }
   gadgetGrid.replaceChildren(...gadgets.map(item=>
     shopCard(item,true,{rogue:currentRogue,onPurchase,paint})));
  }
  paint(rogue);
 }
