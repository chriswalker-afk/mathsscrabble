import test from 'node:test';
import assert from 'node:assert/strict';
import {ROGUE_ITEMS,TEMP_ITEMS} from '../src/rogue.js';
import {workshopAccent,workshopOfferState,workshopDeviceArt} from '../src/workshop-art.js';
import {salvageWorkshopMarkup} from '../src/salvage-workshop.js';

test('every installed system and single-use gadget gets a safe distinct display assembly',()=>{
 const samples=new Set();
 const items=[...ROGUE_ITEMS.map(item=>({...item,temporary:false})),
  ...TEMP_ITEMS.map(item=>({...item,temporary:true}))];
 assert.ok(items.length>=27);
 for(const item of items){
  assert.match(workshopAccent(item.kind),/^#[0-9a-f]{6}$/i);
  const art=workshopDeviceArt(item.id,item.temporary);
  assert.ok(art.includes('viewBox="0 0 240 134"'),item.id+' should use the common product frame');
  assert.ok(art.includes('workshop-device'),item.id);
  assert.ok(art.includes('equip-svg'),item.id+' needs the correct original sigil');
  assert.ok(art.length>850,item.id+' should be illustrated beyond a bare line glyph');
  assert.doesNotMatch(art,/<script\b|onload=|foreignObject|javascript:/i);
  samples.add(art);
 }
 assert.equal(samples.size,items.length,'each item needs a recognisable distinct design');
 assert.equal(workshopDeviceArt('../secret',false),'');
 assert.equal(workshopDeviceArt('constructor',true),'');
});
test('purchase availability communicates reasons without changing any pricing or stock',()=>{
 const data={flux:5,slots:1,maxSlots:4,cost:5};
 assert.equal(workshopOfferState(data),'available');
 assert.equal(workshopOfferState({...data,cost:7}),'unaffordable');
 assert.equal(workshopOfferState({...data,slots:4}),'full');
 assert.equal(workshopOfferState({...data,slots:4,cost:100}),'full');
 assert.equal(workshopOfferState({...data,slots:2,maxSlots:2,flux:100}),'full');
});
test('the workshop view preserves exactly the existing shop regions and clear choices',()=>{
 const html=salvageWorkshopMarkup();
 for(const id of ['salvage-grid','salvage-temporary-grid','salvage-feedback',
   'bay-flux','bay-system-count','bay-gadget-count','bay-equipped-systems','bay-equipped-gadgets'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/Ship Systems stay installed for the run/);
 assert.match(html,/one-use tools/);
 assert.match(html,/workshop-crew-label/);
 assert.match(html,/salvage-bay\.svg/);
 assert.match(html,/role="status" aria-live="polite"/);
 assert.doesNotMatch(html,/<script\b/i);
});
