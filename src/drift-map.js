// Presentation-only Drift route map. Boss choices come from the saved run.
// All zone art URLs and portrait markup are selected from the fixed boss catalog.
import {zoneInfo,zoneNumber,ZONE_LENGTH,isBossSector,zoneBoss} from './drift-bosses.js';
import {bossArtwork,bossAccent,zoneSceneUrl} from './boss-art.js';

const scene=(boss,className)=>{
 const src=boss&&zoneSceneUrl(boss.id);
 return src?'<img class="'+className+'" src="'+src+'" alt="" aria-hidden="true" loading="lazy" decoding="async">':'';
};
const progressNode=(number,sector,phase,large=false)=>{
 const cleared=number<sector||(number===sector&&phase==='won');
 const active=number===sector&&phase!=='won';
 const boss=number%ZONE_LENGTH===0;
 const label=cleared?'CLEARED':active?'CURRENT':boss?'GUARDIAN':'AHEAD';
 return '<span class="zone-node'+(cleared?' completed':'')+(active?' active':'')+
   (boss?' boss-node':'')+(large?' map-node':'')+'" title="Sector '+number+' · '+label+
   '" aria-label="Sector '+number+', '+label.toLowerCase()+'">'+
   (cleared?'✓':boss?'✦':String(number).padStart(2,'0'))+'</span>';
};
const route=(sector,phase,info,large=false)=>{
 const nodes=Array.from({length:ZONE_LENGTH},(_,i)=>
   progressNode(info.start+i,sector,phase,large));
 const path='<div class="zone-route'+(large?' zone-route-large':'')+
   '" role="group" aria-label="Sectors '+info.start+' through '+(info.start+2)+'; third sector is the guardian">'+
   nodes.join('<span class="zone-connector" aria-hidden="true"></span>')+'</div>';
 return path+(large?'<div class="zone-route-stage-labels" aria-hidden="true"><span>ARRIVAL</span><span>DEEP SPACE</span><span>GUARDIAN</span></div>':'');
};

export function renderZoneStrip(rogue,sector,phase,onOpen){
 const element=document.getElementById('drift-zone-map');
 const button=document.getElementById('zone-map-btn');
 const visible=Boolean(rogue);
 element.hidden=!visible;button.hidden=!visible;
 if(!visible)return;
 const info=zoneInfo(rogue,sector),boss=info.boss;
 element.style.setProperty('--zone-accent',bossAccent(boss.id));
 element.classList.toggle('boss-approach',isBossSector(sector));
 element.replaceChildren();
 const landscape=zoneSceneUrl(boss.id);
 if(landscape){
  const image=document.createElement('img');image.className='zone-strip-landscape';
  image.src=landscape;image.alt='';image.setAttribute('aria-hidden','true');
  image.decoding='async';element.append(image);
 }
 const portrait=document.createElement('span');portrait.className='zone-mini-boss';
 portrait.innerHTML=bossArtwork(boss.id);
 portrait.setAttribute('aria-hidden','true');
 const label=document.createElement('span');label.className='zone-mini-copy';
 label.innerHTML='<span class="zone-mini-eyebrow">ZONE '+String(info.number).padStart(2,'0')+
   (isBossSector(sector)?' · GUARDIAN AHEAD':' · FLIGHT ROUTE')+'</span>'+
   '<strong>'+boss.zone+'</strong>'+route(sector,phase,info);
 const arrow=document.createElement('span');arrow.className='zone-mini-arrow';
 arrow.textContent='↗';arrow.setAttribute('aria-hidden','true');
 element.append(portrait,label,arrow);
 element.setAttribute('aria-label','Open the Drift zone map. Zone '+info.number+
   ', '+boss.zone+', sector '+info.stage+' of 3. Final guardian: '+boss.name+'.');
 element.onclick=onOpen;button.onclick=onOpen;
 button.textContent='✧ ZONE MAP';
}

function zoneCard(rogue,sector,phase,zone,current){
 const start=(zone-1)*ZONE_LENGTH+1;
 const known=current||zone<zoneNumber(sector)||Boolean(rogue.zoneBosses?.[zone-1]);
 const boss=known?zoneBoss(rogue,start):null;
 const cleared=zone<zoneNumber(sector)||current&&phase==='won'&&isBossSector(sector);
 const title=boss?boss.zone:'The Uncharted Beyond';
 const name=boss?boss.name:'UNIDENTIFIED SIGNAL';
 const marker=cleared?'ZONE CONQUERED':current?'CURRENT ZONE':'UNCHARTED';
 const image=scene(boss,'zone-card-landscape');
 return '<section class="zone-map-card'+(current?' map-current':'')+
   (cleared?' map-cleared':'')+(!boss?' map-uncharted':'')+
   (boss&&isBossSector(sector)&&current&&phase!=='won'?' map-boss-now':'')+
   '" style="--zone-accent:'+bossAccent(boss?.id)+'">'+
   '<div class="zone-card-scenery" aria-hidden="true">'+image+'</div>'+
   '<div class="zone-map-card-inner">'+
   '<div class="zone-map-portrait">'+(boss?bossArtwork(boss.id):
     '<div class="zone-mystery" aria-hidden="true">?</div>')+'</div>'+
   '<div class="zone-map-details"><span class="zone-mini-eyebrow">ZONE '+String(zone).padStart(2,'0')+' · '+marker+'</span>'+
   '<h3>'+title+'</h3><p>'+name+'</p>'+
   route(sector,phase,{start},true)+
   (boss?'<small class="zone-map-rule">GUARDIAN RULE · '+boss.short+'</small>':
     '<small class="zone-map-rule">Its guardian will be revealed when you enter this zone.</small>')+
   '</div></div></section>';
}

export function zoneMapMarkup(rogue,sector,phase){
 const current=zoneNumber(sector);
 const active=zoneInfo(rogue,sector);
 const history=Array.from({length:current-1},(_,i)=>current-1-i);
 const intro='<div class="zone-map-intro"><span>THE DRIFT · CAPTAIN’S STAR CHART</span>'+
   '<strong>Your journey through the unknown</strong><p>Each zone has two approach sectors and one guardian encounter. The guardian is saved when you enter the zone, so reloading never changes it.</p></div>';
 const hero='<div class="zone-chart-hero" style="--zone-accent:'+bossAccent(active.boss.id)+'">'+
   scene(active.boss,'zone-chart-landscape')+
   '<div class="zone-chart-content"><span>NOW EXPLORING · ZONE '+String(current).padStart(2,'0')+'</span>'+
   '<strong>'+active.name+'</strong><small>STAGE '+active.stage+' / 3 · '+(isBossSector(sector)?'GUARDIAN ENCOUNTER':'GUARDIAN APPROACH')+'</small></div>'+
   '<span class="zone-chart-coordinate" aria-hidden="true">✧ · '+String(sector).padStart(2,'0')+'</span></div>';
 const routeCards='<div class="zone-map-scroll" aria-label="Current and upcoming zones">'+
   zoneCard(rogue,sector,phase,current,true)+
   (current<33?zoneCard(rogue,sector,phase,current+1,false):'')+'</div>';
 const archive=history.length?'<details class="zone-history"><summary>FLIGHT LOG · '+history.length+
   ' PREVIOUS '+(history.length===1?'ZONE':'ZONES')+
   '<span aria-hidden="true">⌄</span></summary><div class="zone-history-grid">'+
   history.map(z=>zoneCard(rogue,sector,phase,z,false)).join('')+
   '</div></details>':'';
 return intro+hero+routeCards+archive;
}
export function bossIntroMarkup(rogue,sector){
 const info=zoneInfo(rogue,sector),boss=info.boss;
 return '<div class="boss-reveal" style="--zone-accent:'+bossAccent(boss.id)+'">'+
   scene(boss,'boss-reveal-landscape')+
   '<div class="boss-reveal-portrait">'+bossArtwork(boss.id)+'</div>'+
   '<div class="boss-reveal-copy"><span class="zone-mini-eyebrow">ZONE '+
   String(info.number).padStart(2,'0')+' · FINAL ENCOUNTER</span>'+
   '<h3>'+boss.name+'</h3>'+
   '<strong>'+boss.subtitle+'</strong>'+
   '<div class="boss-effect-plate"><span>THIS SECTOR’S RULE</span>'+
   '<b>'+boss.short+'</b></div>'+
   '<p>'+boss.description+'</p></div></div>'+
   route(sector,'playing',info,true)+
   '<p class="boss-reveal-note">The rule applies only in this boss sector. Your four installed Ship Systems and carried Mission Gadgets stay available. Defeat the guardian to reach the next zone.</p>';
}
export function zoneVictoryMarkup(rogue,sector){
 const info=zoneInfo(rogue,sector);
 return '<div class="zone-victory" style="--zone-accent:'+bossAccent(info.boss.id)+'">'+
   scene(info.boss,'zone-victory-landscape')+
   '<span class="zone-victory-boss">'+bossArtwork(info.boss.id)+'</span>'+
   '<span><strong>ZONE '+info.number+' CONQUERED</strong>'+
   '<small>'+info.boss.name+' defeated · '+info.boss.zone+'</small></span></div>';
}

// The intermission map is compact, scenic, and confined to its existing card.
export function zoneIntermissionMarkup(rogue,sector,phase){
 const info=zoneInfo(rogue,sector),boss=info.boss;
 const done=isBossSector(sector);
 const next=done?'NEXT · UNCHARTED ZONE':'NEXT · SECTOR '+String(sector+1).padStart(2,'0');
 return '<div class="drift-map-feature" style="--zone-accent:'+bossAccent(boss.id)+'">'+
   scene(boss,'drift-feature-landscape')+
   '<div class="drift-map-feature-art" aria-hidden="true">'+bossArtwork(boss.id)+'</div>'+
   '<div class="drift-map-feature-info"><span class="drift-feature-kicker">ZONE '+
   String(info.number).padStart(2,'0')+' · '+(done?'GUARDIAN DEFEATED':'ROUTE PROGRESS')+'</span>'+
   '<strong>'+boss.zone+'</strong><span class="drift-feature-boss">'+boss.name+'</span>'+
   route(sector,phase,info,true)+
   '<small class="drift-map-next">'+next+'</small></div></div>';
}
