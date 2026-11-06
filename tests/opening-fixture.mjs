// Browser tests deliberately set a known rack when they need to exercise a
// specific mathematical equation. Normal player starts are always randomized.
export const DEMO_TILES=['8','+','4','1','2','−','blank-operator','blank-any'];
export async function installKnownRack(page,mode='sector'){
 const key=mode==='rogue'?'equa-nova.drift.v1':'equa-nova.sector-run.v1';
 await page.evaluate(({key,wanted})=>{
   const data=JSON.parse(localStorage.getItem(key));
   if(!data)throw Error('No current solo game for '+key);
   const supply=[...data.rack,...data.bag];
   const fixed=[];
   for(const wantedTile of wanted){
     const at=supply.findIndex(t=>(t.blank||t.value)===wantedTile);
     if(at<0)throw Error('Bag missing fixture tile '+wantedTile);
     fixed.push(supply.splice(at,1)[0]);
   }
   data.rack=fixed;data.bag=supply;
   localStorage.setItem(key,JSON.stringify(data));
 },{key,wanted:DEMO_TILES});
 await page.reload({waitUntil:'networkidle'});
}
