import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1366,height:768}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const base='http://127.0.0.1:4173/';
const cell=(r,c)=>page.locator('.cell[data-index="'+((r+3)*19+(c+3))+'"]');
async function stored(){
 return page.evaluate(()=>{
  const reg=JSON.parse(localStorage.getItem('equa-nova.pilot-profiles.v1'));
  const awards=JSON.parse(localStorage.getItem('equa-nova.achievements.v1'));
  return Object.fromEntries(reg.pilots.map(p=>[p.name,awards?.pilots?.[p.id]?.unlocked||[]]));
 });
}
async function prepareRack(){
 await page.evaluate(()=>{
  const k='equa-nova.local-match.v1',m=JSON.parse(localStorage.getItem(k));
  const supply=[...m.players[0].rack,...m.bag],wanted=['8','+','4','1','2'];
  const rack=[];
  for(const value of wanted){
   const at=supply.findIndex(t=>!t.blank&&t.value===value);
   if(at<0)throw Error('Missing fixture tile '+value);
   rack.push(supply.splice(at,1)[0]);
  }
  for(const pool of ['numbers','operators','operators']){
   const at=supply.findIndex(t=>pool==='operators'
    ?t.blank==='blank-operator'||['+','−','×','÷'].includes(t.value)
    :t.blank!=='blank-operator'&&!['+','−','×','÷'].includes(t.value));
   if(at<0)throw Error('Missing remaining fixture tile');
   rack.push(supply.splice(at,1)[0]);
  }
  m.players[0].rack=rack;m.bag=supply;localStorage.setItem(k,JSON.stringify(m));
 });
 await page.reload({waitUntil:'networkidle'});
}
async function place(value,r,c){
 if(value==='=')await page.locator('#equals-tile').click();
 else await page.locator('#rack .tile').evaluateAll((nodes,v)=>{
  const button=nodes.find(n=>n.querySelector('span')?.textContent===v);
  if(!button)throw Error('Missing rack value '+v);button.click();
 },value);
 await cell(r,c).click();
}
try{
 await page.goto(base+'achievement-hangar.html',{waitUntil:'networkidle'});
 for(const name of ['Ari','Bea']){
  await page.locator('#pilot-name').fill(name);
  await page.locator('#pilot-create button[type=submit]').click();
 }
 const ids=await page.evaluate(()=>JSON.parse(localStorage.getItem('equa-nova.pilot-profiles.v1')).pilots.map(p=>p.id));
 await page.goto(base+'play.html?mode=local',{waitUntil:'networkidle'});
 await page.locator('#local-pilot-owner-0').selectOption(ids[0]);
 await page.locator('#local-pilot-owner-1').selectOption(ids[1]);
 assert.equal(await page.locator('#local-player-name-0').inputValue(),'Ari');
 assert.equal(await page.locator('#local-player-name-1').inputValue(),'Bea');
 await page.locator('#modal-actions button').last().click();
 assert.equal(await page.locator('#local-privacy').isVisible(),true);
 let progress=await stored();
 assert.ok(progress.Ari.includes('L01'));assert.ok(progress.Bea.includes('L01'));
 await prepareRack();
 await page.locator('#local-ready-btn').click();
 progress=await stored();
 assert.ok(progress.Ari.includes('L02'));
 assert.ok(!progress.Bea.includes('L02'),'only the current private seat receives a ready award');
 for(const [s,r,c] of [['8',6,3],['+',6,4],['4',6,5],['=',6,6],['1',6,7],['2',6,8]])await place(s,r,c);
 await page.locator('#score-btn').click();
 progress=await stored();
 assert.ok(progress.Ari.includes('L03'),'first validated score belongs to Ari');
 assert.ok(!progress.Bea.includes('L03'),'other seats must not inherit scored awards');
 assert.equal(await page.locator('#modal .achievement-reveal').count(),0,
  'do not interrupt score ceremony');
 await page.locator('#skip-ceremony').click();
 assert.match(await page.locator('#modal .achievement-reveal').textContent(),/Local Spark/i);
 await page.locator('#modal-actions button').last().click();
 assert.equal(await page.locator('#local-privacy').isVisible(),true);
 await page.locator('#local-ready-btn').click();
 progress=await stored();assert.ok(progress.Bea.includes('L02'));
 await page.locator('#swap-btn').click();
 await page.locator('#rack .tile:not(.wildcard)').first().click();
 await page.locator('#swap-btn').click();
 progress=await stored();
 assert.ok(progress.Bea.includes('L06'),'free exchange credits Bea');
 assert.ok(!progress.Ari.includes('L06'));
 for(let i=0;i<4;i++){
  if(i>0)await page.locator('#local-ready-btn').click();
  await page.locator('#local-pass-btn').click();
 }
 const completed=await page.evaluate(()=>JSON.parse(localStorage.getItem('equa-nova.local-match.v1')));
 assert.equal(completed.phase,'finished');
 assert.equal(await page.locator('#modal-eyebrow').textContent(),'MATCH COMPLETE');
 progress=await stored();
 assert.ok(progress.Ari.includes('L07'),'participant who scored gets Full Circle');
 assert.ok(progress.Ari.includes('L08'),'winning participant gets Friendly Champion');
 assert.ok(!progress.Bea.includes('L08'));
 assert.ok(!progress.Bea.includes('L07'),'Bea never scored in this match');
 assert.match(await page.locator('#modal .local-achievement-owner').textContent(),/Ari/i);
 await page.reload({waitUntil:'networkidle'});
 assert.equal(await page.locator('#modal-eyebrow').textContent(),'MATCH COMPLETE');
 assert.deepEqual(await stored(),progress,'persisted awards must not replay on refresh');
 assert.deepEqual(errors,[]);
 console.log('Pass D local browser passed: explicit seat owners, private handover, correct score medal, exclusive free exchange, final result and refresh.');
}finally{await browser.close();}
