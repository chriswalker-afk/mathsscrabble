// Pure game rules. Both a future multiplayer server and this solo client can use these.
export const SIZE = 13;
export const CENTER = 6;
export const HAND_SIZE = 7;
export const TURNS_PER_SECTOR = 6;
export const TARGETS = [45, 60, 75, 95, 115, 140, 170, 205];
export const POINTS = Object.freeze({'0':1,'1':1,'2':2,'3':2,'4':2,'5':3,'6':3,'7':3,'8':4,'9':4,'+':2,'−':2,'×':3,'÷':4,'(':0,')':0,'=':0});
export const pos = (r,c) => r * SIZE + c;
export const coords = index => [Math.floor(index / SIZE), index % SIZE];
export function bonusAt(r,c) {
  if (r===CENTER && c===CENTER) return 'START';
  if ((r===0||r===12)&&(c===0||c===12)) return '3E';
  if ((r===1||r===11)&&(c===1||c===11)) return '2E';
  if ((r===2||r===10)&&(c===5||c===7)) return '3T';
  if ((r===3||r===9)&&(c===3||c===9)) return '2E';
  if ((r===0||r===12)&&c===6) return '2T';
  if ((c===0||c===12)&&r===6) return '2T';
  if ((r===5||r===7)&&(c===5||c===7)) return '2T';
  if ((r+c)%9===0 && r>1 && r<11 && c>1 && c<11) return '2T';
  return '';
}
let nextId = 0;
export const makeTile = (value) => ({id:'tile-'+(++nextId),value,points:POINTS[value]??0});
export function makeBag(random=Math.random) {
  const values=[];
  for(let digit=0;digit<=9;digit++) for(let i=0;i<(digit<=4?9:7);i++) values.push(String(digit));
  for(const [value,count] of [['+',23],['−',17],['×',15],['÷',13]]) for(let i=0;i<count;i++) values.push(value);
  for(let i=values.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[values[i],values[j]]=[values[j],values[i]];}
  return values.map(makeTile);
}
export function refill(rack,bag) {
  const nextRack=[...rack], nextBag=[...bag];
  while(nextRack.length<HAND_SIZE && nextBag.length)nextRack.push(nextBag.pop());
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
function parseExpression(source){
  const text=source.replaceAll('×','*').replaceAll('÷','/').replaceAll('−','-').replace(/\s/g,'');
  let p=0;
  const fail=()=>{throw Error('Use a complete equation with valid BIDMAS order.');};
  function primary(){
    if(text[p]==='+'){p++;return primary();}
    if(text[p]==='-'){p++;const x=primary();return fraction(-x.n,x.d);}
    if(text[p]==='('){p++;const x=expression();if(text[p++]!==')')fail();return x;}
    const m=/^\d+/.exec(text.slice(p));
    if(!m)fail();p+=m[0].length;return fraction(BigInt(m[0]));
  }
  function product(){
    let x=primary();
    while(text[p]==='*'||text[p]==='/'){const op=text[p++],y=primary();x=op==='*'?mul(x,y):div(x,y);}
    return x;
  }
  function expression(){
    let x=product();
    while(text[p]==='+'||text[p]==='-'){const op=text[p++],y=product();x=op==='+'?add(x,y):sub(x,y);}
    return x;
  }
  if(!text)fail();
  const result=expression();
  if(p!==text.length)fail();
  return result;
}
export function checkEquation(values){
  const symbols=values.join('');
  if(values.filter(x=>x==='=').length!==1)throw Error('Every equation needs exactly one equals sign.');
  const [left,right]=symbols.split('=');
  if(!left||!right)throw Error('Put a mathematical expression on both sides of =.');
  const a=parseExpression(left),b=parseExpression(right);
  if(a.n*b.d!==b.n*a.d)throw Error('That equation is not balanced. Check both sides using BIDMAS.');
  return {left:a,right:b,text:symbols};
}
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
      const checked=checkEquation(tiles.map(t=>t.value));
      return {indices,tiles,orientation,...checked};
    }catch(err){lastError=err;}
  }
  throw lastError||Error('Invalid placement.');
}
export function scoreMove(board,pending,move){
  let base=0,multiplier=1,bonuses=[];
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
  }
  const length=Math.max(0,move.indices.length-5)*3;
  const physicalCount=Object.values(pending).filter(t=>t.value!=='=').length;
  const sweep=physicalCount===HAND_SIZE?20:0;
  return {base,multiplier,length,sweep,total:base*multiplier+length+sweep,bonuses};
}
export function nextTarget(sector){return TARGETS[sector-1]??Math.round(205*Math.pow(1.18,sector-8));}
