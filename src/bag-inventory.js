// Public inventory of remaining physical bag tiles, never the draw order.
import {BLANK_KINDS,BLANK_NUMBER,BLANK_OPERATOR,BLANK_ANY,tilePool,isDigit,isOperator} from './engine.js';

const digitSymbols=Array.from({length:10},(_,i)=>String(i));
const operationSymbols=['+','−','×','÷'];
const blankSymbols=[BLANK_NUMBER,BLANK_OPERATOR,BLANK_ANY];

export function summarizeBag(bag){
 if(!Array.isArray(bag))throw Error('Expected a tile bag.');
 const counts=new Map([...digitSymbols,...operationSymbols,...blankSymbols].map(key=>[key,0]));
 for(const tile of bag){
   const key=tile.blank||tile.value;
   if(!counts.has(key))throw Error('Unsupported physical tile in bag.');
   counts.set(key,counts.get(key)+1);
 }
 const group=(id,title,keys)=>({
   id,title,total:keys.reduce((sum,key)=>sum+counts.get(key),0),
   tiles:keys.map(key=>({
     key,symbol:BLANK_KINDS[key]?.symbol||key,
     label:BLANK_KINDS[key]?('Blank '+BLANK_KINDS[key].label.toLowerCase()):key,
     count:counts.get(key)
   }))
 });
 return {
   total:bag.length,
   pools:{numbers:bag.filter(t=>tilePool(t)==='numbers').length,
          operators:bag.filter(t=>tilePool(t)==='operators').length},
   groups:[
     group('numbers','NUMBER TILES · 0–9',digitSymbols),
     group('operators','OPERATION TILES',operationSymbols),
     group('wildcards','BLANK / WILDCARD TILES',blankSymbols)
   ]
 };
}
