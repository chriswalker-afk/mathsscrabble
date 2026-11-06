// Four progressive, classroom-facing physical tile kits.
// Sector Run and the Drift use this client-side registry. Multiplayer stays
// on its shared server-validated original tile rules until protocol support.
export const TILE_SET_STORAGE_KEY='equa-nova.tile-set.v1';
export const TILE_SETS=Object.freeze([
 {id:'natural',title:'NATURAL NUMBERS',short:'Launchpad',icon:'①',tier:'01',desc:'Digits 0–9 and +, −, ×, ÷. Adjacent digit tiles can make multi-digit numbers.',sample:'8 + 4 = 12',
  numbers:'0–9',operations:'+ − × ÷',brackets:false,advanced:false},
 {id:'integer',title:'INTEGERS',short:'Orbit',icon:'±',tier:'02',desc:'Includes negative-number tiles as single values, alongside the basic operators.',sample:'−3 + 7 = 4',
  numbers:'−9 to 9',operations:'+ − × ÷',brackets:false,advanced:false},
 {id:'rational',title:'RATIONAL NUMBERS',short:'Nebula',icon:'½',tier:'03',desc:'Positive and negative fractions, all basic operations, plus a matched pair of bracket tiles.',sample:'(½ + ½) × 2 = 2',
  numbers:'Fractions & integers',operations:'+ − × ÷, ( )',brackets:true,advanced:false},
 {id:'advanced',title:'ADVANCED OPERATIONS',short:'Quantum',icon:'√',tier:'04',desc:'Rational number tiles, bracket pairs and powers, square roots and factorials.',sample:'√9 + 3! = 9',
  numbers:'Fractions & integers',operations:'+ − × ÷ ^ √ !, ( )',brackets:true,advanced:true}
]);
export const TILE_SET_BY_ID=Object.freeze(Object.fromEntries(TILE_SETS.map(x=>[x.id,x])));
export const normalizeTileSet=id=>Object.hasOwn(TILE_SET_BY_ID,id)?id:'natural';
export const hasBracketPair=id=>Boolean(TILE_SET_BY_ID[normalizeTileSet(id)].brackets);
export const hasAdvancedOperators=id=>Boolean(TILE_SET_BY_ID[normalizeTileSet(id)].advanced);
export const BRACKET_PAIRS_PER_BAG=8;
export const FRACTION_VALUES=Object.freeze([
 '1/2','−1/2','2/3','−2/3','3/4','−3/4',
 '3/2','−3/2','5/4','−5/4','1/3','−1/3',
 '2/5','−2/5','4/3','−4/3','5/2','−5/2',
 '3/5','−3/5','7/4','−7/4','1/4','−1/4',
 '2/7','−2/7','5/3','−5/3'
]);
export const NATURAL_SYMBOLS=Object.freeze(['+','−','×','÷']);
export const ADVANCED_SYMBOLS=Object.freeze(['^','√','!']);
export function tileValueAllowed(id,value){
 const set=normalizeTileSet(id);
 if(typeof value!=='string')return false;
 if(/^[0-9]$/.test(value)||NATURAL_SYMBOLS.includes(value))return true;
 if(value.startsWith('blank-'))return true;
 if(set==='integer')return /^−[1-9]$/.test(value);
 if(set==='rational'||set==='advanced')
   return FRACTION_VALUES.includes(value)||
     (hasBracketPair(set)&&['(',')'].includes(value))||
     (set==='advanced'&&ADVANCED_SYMBOLS.includes(value));
 return false;
}
