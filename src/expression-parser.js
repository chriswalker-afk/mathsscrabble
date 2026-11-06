// Exact, side-effect-free equation evaluator shared by all solo tile kits.
// Physical numbers (signed integers and fractions) are atomic tile values.
// Adjacent single digits retain the original multi-digit Scrabble mechanic.
const abs=x=>x<0n?-x:x;
const gcd=(a,b)=>{a=abs(a);b=abs(b);while(b){[a,b]=[b,a%b];}return a||1n;};
const fraction=(n,d=1n)=>{
 if(d===0n)throw Error('Division by zero is not allowed.');
 if(d<0n){n=-n;d=-d;}
 const g=gcd(n,d);return {n:n/g,d:d/g};
};
const add=(a,b)=>fraction(a.n*b.d+b.n*a.d,a.d*b.d);
const sub=(a,b)=>fraction(a.n*b.d-b.n*a.d,a.d*b.d);
const mul=(a,b)=>fraction(a.n*b.n,a.d*b.d);
const div=(a,b)=>fraction(a.n*b.d,a.d*b.n);
function tokenize(values){
 const tokens=[];
 for(let i=0;i<values.length;i++){
  const raw=values[i];
  if(typeof raw==='string'&&/^[0-9]$/.test(raw)){
   let digits=raw;
   while(i+1<values.length&&/^[0-9]$/.test(values[i+1]))digits+=values[++i];
   if(digits.length>13)throw Error('Numbers may contain at most 13 digits.');
   tokens.push({type:'number',value:fraction(BigInt(digits))});continue;
  }
  if(typeof raw==='string'&&/^−?[0-9]{1,6}\/[1-9][0-9]{0,5}$/.test(raw)){
   const [n,d]=raw.replace('−','-').split('/');
   tokens.push({type:'number',value:fraction(BigInt(n),BigInt(d))});continue;
  }
  if(typeof raw==='string'&&/^−[1-9][0-9]{0,5}$/.test(raw)){
   tokens.push({type:'number',value:fraction(-BigInt(raw.slice(1)))});continue;
  }
  if(['+','−','×','÷','^','√','!','(',')'].includes(raw)){
   tokens.push({type:'symbol',value:raw});continue;
  }
  throw Error('This tile value is not supported in an equation.');
 }
 return tokens;
}
function exactRoot(n){
 if(n<0n)throw Error('A real square root requires a non-negative value.');
 if(n<2n)return n;
 let x=n,y=(x+n/x)>>1n;
 while(y<x){x=y;y=(x+n/x)>>1n;}
 if(x*x!==n)throw Error('Use exact square roots that produce rational numbers.');
 return x;
}
function power(base,exponent){
 if(exponent.d!==1n||exponent.n>8n||exponent.n< -8n)
  throw Error('Powers require integer exponents between −8 and 8.');
 if(base.n===0n&&exponent.n===0n)throw Error('Zero to the power zero is undefined.');
 const magnitude=abs(exponent.n);
 if(exponent.n<0n&&base.n===0n)throw Error('Zero cannot have a negative power.');
 const n=base.n**magnitude,d=base.d**magnitude;
 return exponent.n<0n?fraction(d,n):fraction(n,d);
}
function factorial(value){
 if(value.d!==1n||value.n<0n||value.n>8n)
  throw Error('Factorials require a whole number between 0 and 8.');
 let answer=1n;
 for(let k=2n;k<=value.n;k++)answer*=k;
 return fraction(answer);
}
function evaluate(values){
 const tokens=tokenize(values);
 let i=0,operations=0;
 const at=()=>tokens[i]?.value;
 const fail=()=>{throw Error('Use a complete equation with valid BIDMAS order.');};
 const primary=()=>{
  if(!tokens[i])fail();
  if(tokens[i].type==='number')return tokens[i++].value;
  if(at()==='('){
   i++;
   const x=sum();
   if(at()!==')')throw Error('Brackets must be balanced and correctly ordered.');
   i++;return x;
  }
  fail();
 };
 const postfix=()=>{
  let x=primary();
  if(at()==='!'){i++;x=factorial(x);operations++;
   if(at()==='!')throw Error('Use brackets for repeated factorials.');}
  return x;
 };
 const powerTerm=()=>{
  let x=postfix();
  // Right-associative exponentiation: 2^3^2 = 512.
  if(at()==='^'){i++;x=power(x,prefix());operations++;}
  return x;
 };
 const prefix=()=>{
  if(at()==='+'){i++;return prefix();}
  if(at()==='−'){i++;const x=prefix();return fraction(-x.n,x.d);}
  if(at()==='√'){
   i++;const x=prefix();operations++;
   return fraction(exactRoot(x.n),exactRoot(x.d));
  }
  return powerTerm();
 };
 const product=()=>{
  let x=prefix();
  while(at()==='×'||at()==='÷'){
   const op=at();i++;const y=prefix();operations++;
   x=op==='×'?mul(x,y):div(x,y);
  }
  return x;
 };
 const sum=()=>{
  let x=product();
  while(at()==='+'||at()==='−'){
   const op=at();i++;const y=product();operations++;
   x=op==='+'?add(x,y):sub(x,y);
  }
  return x;
 };
 if(!tokens.length)fail();
 const result=sum();
 if(i!==tokens.length)fail();
 return {result,operations};
}
export function checkEquation(values){
 if(!Array.isArray(values)||values.filter(v=>v==='=').length!==1)
  throw Error('Every equation needs exactly one equals sign.');
 const equal=values.indexOf('='),left=values.slice(0,equal),right=values.slice(equal+1);
 if(!left.length||!right.length)throw Error('Put a mathematical expression on both sides of =.');
 const a=evaluate(left),b=evaluate(right);
 if(a.operations+b.operations===0)
  throw Error('Build a calculation using at least one operation. A number equalling itself is too simple.');
 if(a.result.n*b.result.d!==b.result.n*a.result.d)
  throw Error('That equation is not balanced. Check both sides using BIDMAS.');
 return {left:a.result,right:b.result,text:values.join('')};
}
