// Pass E: painted-metal display cases and a consistent colour language for
// the Salvage Bay's original equipment catalog. This is presentation only.
// Only IDs from the fixed catalog reach the SVG generator.
import {ROGUE_ITEM_BY_ID,TEMP_ITEM_BY_ID} from './rogue.js';
import {equipmentArt} from './equipment-art.js';

const accents=Object.freeze({
 'TILE TYPE':'#f5d3a0','CONNECTION':'#9ed8e8','LENGTH BONUS':'#c6b2f1',
 'RACK':'#c2e8b0','BOARD SPACE':'#8fe8d1','ECONOMY':'#f5db9e',
 'DEFENCE':'#a9d7f5','TACTICS':'#e9b5a3',
 'SCORE BOOST':'#f0b18c','TILE SWAP':'#b8c6fa'
});
export function workshopAccent(kind){return accents[kind]||'#b5d7d2';}
export function workshopOfferState({flux,slots,maxSlots,cost}){
 if(slots>=maxSlots)return 'full';
 if(flux<cost)return 'unaffordable';
 return 'available';
}
export function workshopDeviceArt(id,temporary=false){
 const catalog=temporary?TEMP_ITEM_BY_ID:ROGUE_ITEM_BY_ID;
 const item=Object.hasOwn(catalog,id)?catalog[id]:null;
 if(!item)return '';
 const accent=workshopAccent(item.kind);
 const sigil=equipmentArt(id).replace('<svg class="equip-svg"',
   '<svg class="equip-svg" x="70" y="20" width="99" height="99"');
 const shell=temporary?
  '<path d="M68 10H170L187 30V98L170 119H68L52 99V29Z" fill="#182e47" stroke="'+accent+'" stroke-width="5"/>'+
  '<rect x="82" y="4" width="75" height="16" rx="5" fill="#c7cbc1" stroke="#425d68" stroke-width="4"/>'+
  '<rect x="83" y="111" width="74" height="17" rx="4" fill="#a5b4b4" stroke="#415d6b" stroke-width="4"/>'+
  '<path d="M53 30L34 47V83L53 102M186 30L204 47V82L186 102" stroke="'+accent+'" stroke-width="8" fill="none"/>'+
  '<path d="M66 25H175M66 103H175" stroke="#c7e7dd" stroke-opacity=".4" stroke-width="3"/>'
  :
  '<path d="M20 31L45 11H196L220 31V104L199 126H44L20 104Z" fill="#223d4b" stroke="'+accent+'" stroke-width="5"/>'+
  '<path d="M44 16H196L208 32H31Z" fill="#91a9a6" stroke="#e7e2c9" stroke-width="3"/>'+
  '<path d="M29 108H214L199 121H43Z" fill="#62808b" stroke="#d2dbc5" stroke-width="3"/>'+
  '<path d="M34 41H53M34 54H53M34 67H53M34 80H53M185 41H206M185 54H206M185 67H206M185 80H206" stroke="#99b9b7" stroke-width="5"/>'+
  '<circle cx="32" cy="24" r="5" fill="#f2d89b"/><circle cx="210" cy="24" r="5" fill="#f2d89b"/>';
 const decor=temporary?
  '<rect x="58" y="50" width="14" height="36" rx="5" fill="'+accent+'" fill-opacity=".5"/>'+
  '<rect x="168" y="50" width="14" height="36" rx="5" fill="'+accent+'" fill-opacity=".5"/>':
  '<path d="M63 28V105M177 28V105" stroke="'+accent+'" stroke-opacity=".3" stroke-width="2"/>';
 return '<svg class="workshop-device" viewBox="0 0 240 134" width="240" height="134" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">'+
  '<ellipse cx="120" cy="122" rx="111" ry="10" fill="#071b27" opacity=".7"/>'+
  '<path d="M13 124H226" stroke="'+accent+'" stroke-opacity=".28" stroke-width="3"/>'+
  shell+decor+sigil+
  '<circle cx="47" cy="112" r="3" fill="'+accent+'"/><circle cx="194" cy="112" r="3" fill="'+accent+'"/>'+
  '</svg>';
}
