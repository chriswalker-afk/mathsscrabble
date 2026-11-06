// Presentation-only route map. The boss identity and progress are derived
// from the saved Drift run, so revisits cannot reroll an encounter.
import {zoneInfo,zoneNumber,ZONE_LENGTH,isBossSector,zoneBoss} from './drift-bosses.js';
import {bossArtwork,bossAccent} from './boss-art.js';
const progressNode=(number,sector,phase,large=false)=>{
 const cleared=number<sector||(number===sector&&phase==='won');
 const active=number===sector&&phase!=='won';
 const boss=number%ZONE_LENGTH===0;
 return '<span class="zone-node'+(cleared?' completed':'')+(active?' active':'')+
   (boss?' boss-node':'')+(large?' map-node':'')+'" title="Sector '+number+
   (cleared?' cleared':active?' current':boss?' boss encounter':' ahead')+'">'+
   (cleared?'✓':boss?'✦':String(number).padStart(2,'0'))+'</span>';
};
const route=(sector,phase,info,large=false)=>{
 const nodes=Array.from({length:ZONE_LENGTH},(_,i)=>
   progressNode(info.start+i,sector,phase,large));
 return '<div class="zone-route'+(large?' zone-route-large':'')+
   '" aria-label="Three-sector zone route">'+nodes.join('<span class="zone-connector" aria-hidden="true"></span>')+'</div>';
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
 const portrait=document.createElement('span');portrait.className='zone-mini-boss';
 portrait.innerHTML=bossArtwork(boss.id);
 const label=document.createElement('span');label.className='zone-mini-copy';
 label.innerHTML='<span class="zone-mini-eyebrow">ZONE '+String(info.number).padStart(2,'0')+
   (isBossSector(sector)?' · BOSS ENCOUNTER':' · ROUTE PROGRESS')+'</span>'+
   '<strong>'+boss.zone+'</strong>'+route(sector,phase,info);
 const arrow=document.createElement('span');arrow.className='zone-mini-arrow';arrow.textContent='↗';
 arrow.setAttribute('aria-hidden','true');
 element.append(portrait,label,arrow);
 element.setAttribute('aria-label','Open zone map. Zone '+info.number+
   ', '+boss.zone+', sector '+info.stage+' of 3. Final boss: '+boss.name+'.');
 element.onclick=onOpen;button.onclick=onOpen;
 button.textContent='✧ ZONE MAP';
}
function zoneCard(rogue,sector,phase,zone,current){
 const start=(zone-1)*ZONE_LENGTH+1;
 const known=current||zone<zoneNumber(sector)||Boolean(rogue.zoneBosses?.[zone-1]);
 const boss=known?zoneBoss(rogue,start):null;
 const cleared=zone<zoneNumber(sector);
 const title=boss?boss.zone:'Uncharted sector';
 const name=boss?boss.name:'UNIDENTIFIED SIGNAL';
 const marker=cleared?'CONQUERED':current?'CURRENT ZONE':'UNEXPLORED';
 return '<section class="zone-map-card'+(current?' map-current':'')+
   (cleared?' map-cleared':'')+(boss&&isBossSector(sector)&&current?' map-boss-now':'')+
   '" style="--zone-accent:'+bossAccent(boss?.id)+'">'+
   '<div class="zone-map-portrait">'+(boss?bossArtwork(boss.id):
     '<div class="zone-mystery" aria-hidden="true">?</div>')+'</div>'+
   '<div class="zone-map-details"><span class="zone-mini-eyebrow">ZONE '+String(zone).padStart(2,'0')+' · '+marker+'</span>'+
   '<h3>'+title+'</h3><p>'+name+'</p>'+
   route(sector,phase,{start},true)+
   (boss?'<small class="zone-map-rule">'+boss.short+'</small>':
     '<small class="zone-map-rule">The next boss will be chosen when you enter this zone.</small>')+
   '</div></section>';
}
export function zoneMapMarkup(rogue,sector,phase){
 const current=zoneNumber(sector);
 const cards=[];
 for(let z=1;z<=Math.min(33,current+1);z++)
   cards.push(zoneCard(rogue,sector,phase,z,z===current));
 return '<div class="zone-map-intro"><span>THE DRIFT · GALACTIC ROUTE</span>'+
   '<strong>One zone. Three sectors. One boss.</strong><p>Pass two sectors, then confront the randomly selected guardian in the third. Each zone takes its name and hazard from its boss. Your route and boss identity are saved with the run.</p></div>'+
   '<div class="zone-map-scroll">'+cards.join('')+'</div>';
}
export function bossIntroMarkup(rogue,sector){
 const info=zoneInfo(rogue,sector),boss=info.boss;
 return '<div class="boss-reveal" style="--zone-accent:'+bossAccent(boss.id)+'">'+
   '<div class="boss-reveal-portrait">'+bossArtwork(boss.id)+'</div>'+
   '<div class="boss-reveal-copy"><span class="zone-mini-eyebrow">ZONE '+String(info.number).padStart(2,'0')+
   ' · FINAL ENCOUNTER</span><h3>'+boss.name+'</h3>'+
   '<strong>'+boss.zone+'</strong><p>'+boss.description+'</p></div></div>'+
   route(sector,'playing',info,true)+
   '<p class="boss-reveal-note">This effect lasts only for this boss sector. Your permanent modules and held consumables remain available. Defeat the boss to enter the next zone.</p>';
}
export function zoneVictoryMarkup(rogue,sector){
 const info=zoneInfo(rogue,sector);
 return '<div class="zone-victory" style="--zone-accent:'+bossAccent(info.boss.id)+'">'+
  bossArtwork(info.boss.id)+'<span><strong>ZONE '+info.number+' CONQUERED</strong>'+
  '<small>'+info.boss.name+' defeated · '+info.boss.zone+'</small></span></div>';
}
