// Public inventory of the physical bag (not the secret draw order).
// Groups adapt to each maths kit and retain base-mode group IDs for tests.
import {BLANK_KINDS,BLANK_NUMBER,BLANK_OPERATOR,BLANK_ANY,tilePool,POINTS} from './engine.js';
const digits=Array.from({length:10},(_,i)=>String(i));
const basics=['+','−','×','÷'];
const advanced=['^','√','!'];
const brackets=['(',')'];
const wildcards=[BLANK_NUMBER,BLANK_OPERATOR,BLANK_ANY];
const minusDigits=Array.from({length:9},(_,i)=>'−'+(i+1));
const fractionOrder=(value)=>{
 const sign=value.startsWith('−')?1:0;
 const [n,d]=value.replace('−','').split('/').map(Number);
 return n/d+sign*.00001;
};
export function summarizeBag(bag){
 if(!Array.isArray(bag))throw Error('Expected a tile bag.');
 const counts=new Map();
 for(const tile of bag){
   const value=tile.blank||tile.value;
   if(value==='='||(!Object.hasOwn(POINTS,value)&&!BLANK_KINDS[value]))
     throw Error('Unsupported physical tile in bag.');
   counts.set(value,(counts.get(value)||0)+1);
 }
 const group=(id,title,keys)=>({
   id,title,total:keys.reduce((sum,key)=>sum+(counts.get(key)||0),0),
   tiles:keys.map(key=>({
     key,symbol:BLANK_KINDS[key]?.symbol||key,
     label:BLANK_KINDS[key]?('Blank '+BLANK_KINDS[key].label.toLowerCase()):key,
     count:counts.get(key)||0
   }))
 });
 const fractions=[...counts.keys()].filter(v=>typeof v==='string'&&v.includes('/'))
   .sort((a,b)=>fractionOrder(a)-fractionOrder(b));
 const has=(values)=>values.some(v=>counts.has(v));
 const groups=[
   group('numbers','NUMBER TILES · 0–9',digits),
   ...(has(minusDigits)?[group('signed','NEGATIVE INTEGER TILES',minusDigits)]:[]),
   ...(fractions.length?[group('fractions','RATIONAL NUMBER TILES',fractions)]:[]),
   group('operators','BASIC OPERATION TILES',basics),
   ...(has(advanced)?[group('advanced','ADVANCED OPERATION TILES',advanced)]:[]),
   ...(has(brackets)?[group('brackets','MATCHED BRACKET PAIRS · ( )',brackets)]:[]),
   group('wildcards','BLANK / WILDCARD TILES',wildcards)
 ];
 return {
   total:bag.length,
   pools:{numbers:bag.filter(t=>tilePool(t)==='numbers').length,
     operators:bag.filter(t=>tilePool(t)==='operators').length,
     ...(has(brackets)?{brackets:bag.filter(t=>tilePool(t)==='brackets').length}:{})},
   groups
 };
}
