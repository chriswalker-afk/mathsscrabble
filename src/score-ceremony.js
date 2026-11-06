// Presentation-only energy transfer script. Never changes the mathematical
// score, tile bag, turn count, equipment, or saved game state.
const bonusSteps=[
 ['equation','VALID CALCULATION','equation'],
 ['length','EQUATION LENGTH','length'],
 ['crossing','CONNECTED EQUATION','crossing'],
 ['sweep','FULL RACK','sweep'],
 ['extra','EQUIPPED ABILITIES','upgrade']
];
export function buildScoringCeremony(points){
 if(!points||!Array.isArray(points.tileScores)||!Number.isSafeInteger(points.multiplier)||
    points.multiplier<1||!Number.isSafeInteger(points.total))
   throw Error('A complete, integer-valued score breakdown is required.');
 const stages=points.tileScores.map((tile,index)=>{
   if(!Number.isInteger(tile.index)||tile.index<0||
      !Number.isSafeInteger(tile.points)||tile.points<0||
      typeof tile.value!=='string')
     throw Error('Invalid tile score contribution.');
   const amount=tile.points*points.multiplier;
   return {
     kind:'tile',index:tile.index,value:tile.value,amount,
     existing:Boolean(tile.existing),premium:tile.premium||null,
     label:tile.value==='='?'FREE EQUALS':tile.points===0?'WILDCARD · 0 POINTS':
       tile.existing?'REUSED TILE':tile.premium?
       'PREMIUM TILE':'TILE '+(index+1)
   };
 });
 for(const [key,label,id] of bonusSteps){
   const amount=points[key]||0;
   if(!Number.isSafeInteger(amount)||amount<0)throw Error('Invalid bonus amount.');
   if(amount)stages.push({kind:'bonus',id,amount,label});
 }
 const penalty=points.anomalyPenalty||0;
 if(!Number.isSafeInteger(penalty)||penalty<0)throw Error('Invalid anomaly deduction.');
 if(penalty)stages.push({kind:'penalty',id:'anomaly',amount:-penalty,label:'REACTOR ANOMALY'});
 const temporaryBoost=points.temporaryBoost||0;
 if(!Number.isSafeInteger(temporaryBoost)||temporaryBoost<0)throw Error('Invalid temporary boost.');
 if(temporaryBoost)stages.push({kind:'bonus',id:'temporary',amount:temporaryBoost,label:'TEMPORARY POWER-UP'});
 const subtotal=stages.reduce((sum,stage)=>sum+stage.amount,0);
 if(subtotal!==points.total){
   throw Error('Score animation must exactly match the verified game score.');
 }
 return stages;
}
export function ceremonyDurationMs(tileCount){
 // Faster choreography for long equations; no turn should become a long wait.
 return tileCount>9?245:tileCount>6?280:320;
}
