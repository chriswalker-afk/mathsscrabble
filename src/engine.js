// Pure game rules. Both a future multiplayer server and this solo client can use these.
import {normalizeTileSet,hasBracketPair,FRACTION_VALUES,BRACKET_PAIRS_PER_BAG} from './tile-sets.js';
import {checkEquation} from './expression-parser.js';
export {checkEquation};
export const SIZE = 13;
export const CENTER = 6;
export const HAND_SIZE = 8;
export const NUMBER_SLOTS = 5;
export const OPERATOR_SLOTS = 3;
export const TURNS_PER_SECTOR = 6;
export const TARGETS = [40, 55, 70, 90, 110, 135, 160, 190];
export const BLANK_NUMBER = 'blank-number';
export const BLANK_OPERATOR = 'blank-operator';
export const BLANK_ANY = 'blank-any';
export const BLANK_KINDS = Object.freeze({
 [BLANK_NUMBER]:{label:'NUMBER',symbol:'#',choices:'0123456789'.split('')},
 [BLANK_OPERATOR]:{label:'OPERATOR',symbol:'◇',choices:['+','−','×','÷']},
 [BLANK_ANY]:{label:'ANY TILE',symbol:'✦',choices:[...'0123456789','+','−','×','÷']}
});
export const isBlank = tile => Boolean(tile?.blank && BLANK_KINDS[tile.blank]);
export const isDigit = value => typeof value==='string' && /^[0-9]$/.test(value);
export const isOperator = value => ['+','−','×','÷','^','√','!'].includes(value);
export function resolveBlank(tile,value){
 if(!isBlank(tile)||!BLANK_KINDS[tile.blank].choices.includes(value))throw Error('That symbol cannot be assigned to this blank tile.');
 return {...tile,value,points:0};
}
/** Physical tiles are drawn from separate number and operator pools.
 * Universal wildcards belong to the number pool so every tile has one stable bag.
 */
export const tilePool=tile=>['(',')'].includes(tile?.value)?'brackets':
  isOperator(tile?.value)||tile?.blank===BLANK_OPERATOR?'operators':'numbers';
export function freeExchangeReason(availableRack){
 return availableRack?.length?'one tile each turn':null;
}
/** Reorder visible physical tiles while retaining any unscored board tiles in hand. */
export function reorderRack(rack,sourceId,index,hiddenIds=[]){
 const hidden=new Set(hiddenIds);
 const visible=rack.filter(tile=>!hidden.has(tile.id));
 const source=rack.find(tile=>tile.id===sourceId);
 if(!source)return rack;
 const sourceIndex=visible.findIndex(tile=>tile.id===sourceId);
 const without=visible.filter(tile=>tile.id!==sourceId);
 const insert=Math.min(without.length,Math.max(0,index-(sourceIndex>=0&&sourceIndex<index?1:0)));
 without.splice(insert,0,source);
 return [...without,...rack.filter(tile=>hidden.has(tile.id)&&tile.id!==sourceId)];
}
const BASIC_POINTS={'0':1,'1':1,'2':2,'3':2,'4':2,'5':3,'6':3,'7':3,'8':4,'9':4,
 '+':2,'−':2,'×':3,'÷':4,'(':0,')':0,'^':5,'√':5,'!':5,'=':0};
for(let digit=1;digit<=9;digit++)BASIC_POINTS['−'+digit]=BASIC_POINTS[String(digit)]+1;
for(const value of FRACTION_VALUES){
 const numerator=Math.abs(Number(value.replace('−','').split('/')[0]));
 BASIC_POINTS[value]=Math.min(6,2+Math.ceil(numerator/2)+(value.startsWith('−')?1:0));
}
export const POINTS=Object.freeze(BASIC_POINTS);
export const pos = (r,c) => r * SIZE + c;
export const coords = index => [Math.floor(index / SIZE), index % SIZE];
export function bonusAt(r,c) {
 // Design all bonuses using absolute distances from the central square.
 // Each rule is unchanged by rotations and reflection across either axis
 // or either diagonal. The shared source governs all game modes and scoring.
 const a=Math.abs(r-CENTER),b=Math.abs(c-CENTER);
 const near=Math.min(a,b),far=Math.max(a,b);
 if(a===0 && b===0) return 'START';
 if(near===6 && far===6) return '3E';
 if((near===5 && far===5)||(near===3 && far===3)) return '2E';
 if(near===1 && far===4) return '3T';
 if((near===0 && (far===3||far===6)) ||
    (near===1 && far===1) ||
    (near===2 && far===4)) return '2T';
 return '';
}
let nextId = 0;
export const makeTile = (value,options={}) => ({
 id:'tile-'+(++nextId),
 value:BLANK_KINDS[value]?null:value,
 points:BLANK_KINDS[value]?0:(POINTS[value]??0),
 ...(BLANK_KINDS[value]?{blank:value}:{}),
 ...(options.pairId?{pairId:options.pairId}:{})
});
/** Web Crypto-backed entropy for fresh games, with Math.random fallback for
 * environments without crypto. Inject a seeded rng in unit tests. */
export function randomFloat(){
  if(typeof crypto!=='undefined'&&typeof crypto.getRandomValues==='function'){
    const draw=new Uint32Array(1);crypto.getRandomValues(draw);
    return draw[0]/4294967296;
  }
  return Math.random();
}
/** All kits contain 151 physical tiles; 16 digits become 8 bracket pairs. */
export function makeBag(random=randomFloat,tileSet='natural') {
 const kit=normalizeTileSet(tileSet),values=[];
 let fractionIndex=0,bracketIndex=0;
 for(let digit=0;digit<=9;digit++){
   const copies=digit<=4?9:7;
   for(let i=0;i<copies;i++){
     if(kit==='integer'&&digit>0&&i<3)values.push('−'+digit);
     else if(hasBracketPair(kit)&&i<(digit<=3?5:4)){
       if(fractionIndex<FRACTION_VALUES.length){
         values.push(FRACTION_VALUES[fractionIndex++]);
       }else{
         const pair=Math.floor(bracketIndex/2);
         values.push({value:bracketIndex%2===0?'(':')',pairId:'paren-'+pair});
         bracketIndex++;
       }
     }else values.push(String(digit));
   }
 }
 if(hasBracketPair(kit)&&bracketIndex!==BRACKET_PAIRS_PER_BAG*2)
   throw Error('Bracket supply must contain eight complete pairs.');
 for(const [value,count] of [['+',18],['−',14],['×',12],['÷',10]]){
   for(let i=0;i<count;i++){
     let face=value;
     if(kit==='advanced'){
       if(value==='+'&&i<5)face='^';
       else if(value==='−'&&i<5)face='√';
       else if(value==='×'&&i<4)face='!';
     }
     values.push(face);
   }
 }
 for(const [value,count] of [[BLANK_NUMBER,7],[BLANK_OPERATOR,5],[BLANK_ANY,5]])
   for(let i=0;i<count;i++)values.push(value);
 for(let i=values.length-1;i>0;i--){
   const j=Math.min(i,Math.floor(random()*(i+1)));
   [values[i],values[j]]=[values[j],values[i]];
 }
 return values.map(v=>typeof v==='string'?makeTile(v):makeTile(v.value,{pairId:v.pairId}));
}
export function refill(rack,bag) {
 const nextRack=[...rack],nextBag=[...bag];
 for(const [pool,target] of [['numbers',NUMBER_SLOTS],['operators',OPERATOR_SLOTS]]){
   while(nextRack.filter(t=>tilePool(t)===pool).length<target){
     const index=nextBag.findLastIndex(t=>tilePool(t)===pool);
     if(index<0)break;
     nextRack.push(nextBag.splice(index,1)[0]);
   }
 }
 return {rack:nextRack,bag:nextBag};
}
const abs=n=>n<0n?-n:n;
const gcd=(a,b)=>{a=abs(a);b=abs(b);while(b){[a,b]=[b,a%b];}return a||1n;};
export function fraction(n,d=1n){
  if(d===0n)throw Error('Division by zero is not allowed.');
  if(d<0n){n=-n;d=-d;}
  const g=gcd(n,d);return {n:n/g,d:d/g};
}
const add=(a,b)=>fraction(a.n*b.d+b.n*a.d,a.d*b.d);
const sub=(a,b)=>fraction(a.n*b.d-b.n*a.d,a.d*b.d);
const mul=(a,b)=>fraction(a.n*b.n,a.d*b.d);
const div=(a,b)=>fraction(a.n*b.d,a.d*b.n);
/**
 * Non-judgemental placement inspection for the board UI. It intentionally does
 * not evaluate the arithmetic: the student still has to submit an equation to
 * discover whether it balances. The official validator remains authoritative.
 */
export function inspectPlacement(board,pending) {
  const added=Object.entries(pending).map(([key,tile])=>({index:Number(key),tile}));
  if(!added.length)return {status:'empty',ready:false,indices:[],text:'',feedback:'Select a tile, then drag or tap a square to begin.'};
  if(added.some(({index})=>board[index]))return {status:'locked',ready:false,indices:[],text:'',feedback:'Locked tiles cannot be replaced.'};
  const rows=new Set(added.map(x=>coords(x.index)[0]));
  const cols=new Set(added.map(x=>coords(x.index)[1]));
  if(rows.size>1&&cols.size>1)return {status:'alignment',ready:false,indices:added.map(x=>x.index),text:'',feedback:'Place all new tiles in one row or one column.'};
  const directions=rows.size===1&&cols.size===1?['h','v']:[rows.size===1?'h':'v'];
  const first=board.every(tile=>!tile);
  const choices=directions.map(orientation=>{
    const line=orientation==='h'?coords(added[0].index)[0]:coords(added[0].index)[1];
    const axes=added.map(x=>orientation==='h'?coords(x.index)[1]:coords(x.index)[0]);
    let min=Math.min(...axes),max=Math.max(...axes);
    const at=axis=>orientation==='h'?pos(line,axis):pos(axis,line);
    while(min>0&&board[at(min-1)])min--;
    while(max<SIZE-1&&board[at(max+1)])max++;
    const indices=Array.from({length:max-min+1},(_,k)=>at(min+k));
    const tiles=indices.map(index=>pending[index]||board[index]);
    const gap=tiles.some(tile=>!tile);
    const central=indices.includes(pos(CENTER,CENTER));
    const connects=indices.some(index=>!!board[index]);
    const text=tiles.map(tile=>tile?.value??'·').join('');
    const equalCount=tiles.filter(tile=>tile?.value==='=').length;
    const parts=text.split('=');
    const mathShape=equalCount===1&&parts.every(side=>side.length>0 && !side.includes('·'));
    const complete=!gap&&(first?central:connects);
    let status='building',feedback='Keep building your equation.';
    if(gap){status='gap';feedback='Fill the gaps in your equation.';}
    else if(first&&!central){status='centre';feedback='Your first equation must cross the central reactor square.';}
    else if(!first&&!connects){status='connect';feedback='Connect to an existing locked tile.';}
    else if(!mathShape){status='building';feedback='Add a free equals sign and complete both sides.';}
    else{status='ready';feedback='Placement ready. Submit to check BIDMAS.';}
    return {status,ready:complete&&mathShape,indices,tiles,orientation,text,feedback,complete,connects};
  });
  // A one-cell move can touch an existing horizontal or vertical chain.
  // Prefer the orientation with a complete geometry and longer connection.
  choices.sort((a,b)=>Number(b.ready)-Number(a.ready)||Number(b.complete)-Number(a.complete)||Number(b.connects)-Number(a.connects)||b.indices.length-a.indices.length);
  return choices[0];
}
export function validateMove(board,pending) {
  const added=Object.entries(pending).map(([key,tile])=>({index:Number(key),tile}));
  if(!added.length)throw Error('Place some tiles on the grid first.');
  if(!added.some(x=>x.tile.value!=='='))throw Error('At least one tile must come from your rack.');
  if(added.some(x=>board[x.index]))throw Error('A locked tile cannot be replaced.');
  const rows=new Set(added.map(x=>coords(x.index)[0])),cols=new Set(added.map(x=>coords(x.index)[1]));
  if(rows.size>1&&cols.size>1)throw Error('Place new tiles in one row or one column.');
  const orientations=(rows.size===1&&cols.size===1)?['h','v']:[rows.size===1?'h':'v'];
  let lastError;
  for(const orientation of orientations){
    try{
      const line=orientation==='h'?coords(added[0].index)[0]:coords(added[0].index)[1];
      const axes=added.map(x=>orientation==='h'?coords(x.index)[1]:coords(x.index)[0]);
      let min=Math.min(...axes),max=Math.max(...axes);
      const at=axis=>orientation==='h'?pos(line,axis):pos(axis,line);
      while(min>0&&board[at(min-1)])min--;
      while(max<SIZE-1&&board[at(max+1)])max++;
      const indices=Array.from({length:max-min+1},(_,k)=>at(min+k));
      if(indices.some(i=>!board[i]&&!pending[i]))throw Error('The equation cannot contain empty gaps.');
      const isFirst=board.every(x=>!x);
      if(isFirst&&!indices.includes(pos(CENTER,CENTER)))throw Error('Your first equation must pass through the central reactor.');
      if(!isFirst&&!indices.some(i=>board[i]))throw Error('Connect your new equation to an existing tile.');
      const tiles=indices.map(i=>pending[i]||board[i]);
      // Newly used bracket tiles must include both physical halves of the
      // same pair. No orphan bracket may be scored or left for a later turn.
      const usedPairs=new Map();
      for(const {tile} of added){
        if(!tile.pairId)continue;
        const faces=usedPairs.get(tile.pairId)||[];
        faces.push(tile.value);usedPairs.set(tile.pairId,faces);
      }
      for(const faces of usedPairs.values()){
        if(faces.length!==2||!faces.includes('(')||!faces.includes(')'))
          throw Error('Bracket tiles travel in pairs. Play both ( and ) together.');
      }
      const checked=checkEquation(tiles.map(t=>t.value));
      return {indices,tiles,orientation,...checked};
    }catch(err){lastError=err;}
  }
  throw lastError||Error('Invalid placement.');
}
export function scoreMove(board,pending,move,{rackSize=HAND_SIZE}={}){
  let base=0,multiplier=1,bonuses=[];
  const tileScores=[]; // The exact score contributed by each visible equation cell.
  for(const index of move.indices){
    const tile=pending[index]||board[index];
    let points=tile.points||0;
    const [r,c]=coords(index);
    const bonus=pending[index]&&tile.value!=='='?bonusAt(r,c):'';
    if(bonus==='2T'){points*=2;bonuses.push('Double tile');}
    if(bonus==='3T'){points*=3;bonuses.push('Triple tile');}
    if(bonus==='2E'){multiplier*=2;bonuses.push('Double equation');}
    if(bonus==='3E'){multiplier*=3;bonuses.push('Triple equation');}
    base+=points;
    tileScores.push({index,value:tile.value,points,
      existing:Boolean(board[index]),premium:bonus||null});
  }
  const length=Math.max(0,move.indices.length-5)*3;
  const physicalCount=Object.values(pending).filter(t=>t.value!=='=').length;
  const sweep=physicalCount===rackSize?20:0;
  const equation=5; // each genuinely calculated equality earns energy
  const crossing=move.indices.some(index=>Boolean(board[index]))?5:0;
  return {base,multiplier,length,sweep,equation,crossing,
    total:base*multiplier+length+sweep+equation+crossing,bonuses,tileScores};
}
export function nextTarget(sector){return TARGETS[sector-1]??Math.round(TARGETS[TARGETS.length-1]*Math.pow(1.18,sector-TARGETS.length));}
