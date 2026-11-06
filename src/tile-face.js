// Physical tile face presentation; fractions get an actual stacked numerator
// and denominator, not a tiny '1/2' string overlaid on the game board.
export const isFractionValue=v=>typeof v==='string'&&/^−?\d+\/\d+$/.test(v);
export const tileFaceClass=v=>isFractionValue(v)?'fraction-tile':
 ['(',')'].includes(v)?'bracket-tile':/^−[0-9]$/.test(v)?'signed-tile':
 ['^','√','!'].includes(v)?'advanced-tile':'';
export function renderTileFace(node,value){
 node.replaceChildren();
 if(!isFractionValue(value)){node.textContent=value??'';return;}
 const parts=value.split('/'),num=document.createElement('span');
 const bar=document.createElement('span'),den=document.createElement('span');
 node.classList.add('fraction-face');
 num.className='frac-numerator';num.textContent=parts[0];
 bar.className='frac-rule';bar.setAttribute('aria-hidden','true');
 den.className='frac-denominator';den.textContent=parts[1];
 node.append(num,bar,den);
 node.setAttribute('aria-label',value.replace('−','negative '));
}
