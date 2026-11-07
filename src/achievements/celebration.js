/** Presentation-only achievement celebrations. Awards come from the fixed catalog.
 * These render AFTER game transitions and never determine a gameplay outcome.
 */
const colours=Object.freeze({
 'aurora-gold':'#d6a546','warp-mint':'#59e7d1',
 'copper-dawn':'#d78c5f','cosmic-violet':'#9a7aff'
});
const clean=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;')
 .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const preview=a=>a.reward.collection==='palettes'?
 '<span class="achievement-new-palette" style="--badge-colour:'+colours[a.reward.id]+'"></span>':
 '<img src="./assets/aliens/'+clean(a.reward.collection)+'/'+clean(a.reward.id)+'.svg" alt="" width="62" height="72" loading="lazy">';
export function achievementRevealMarkup(awards){
 if(!Array.isArray(awards)||!awards.length)return '';
 return '<section class="achievement-reveal" aria-label="New achievements earned">'+
 '<p class="achievement-reveal-top">✦ ACHIEVEMENT UNLOCKED · ALIEN COSMETICS EARNED</p>'+
 '<div class="achievement-reveal-grid">'+awards.map(a=>'<article class="achievement-reveal-item">'+
 preview(a)+'<div><span>'+clean(a.tier.toUpperCase())+' · '+clean(a.id)+'</span>'+
 '<strong>'+clean(a.title)+'</strong><small>NEW: '+clean(a.reward.name)+'</small></div></article>').join('')+
 '</div><a class="achievement-reveal-link" href="./achievement-hangar.html?unlocked='+
 encodeURIComponent(awards[0].id)+'">VIEW REWARDS IN THE HANGAR ↗</a></section>';
}
/** A dismissible, non-modal acknowledgment for validated non-scoring events. */
export function showAchievementToast(awards){
 if(!Array.isArray(awards)||!awards.length)return;
 let notice=document.getElementById('achievement-toast');
 if(!notice){
  notice=document.createElement('aside');notice.id='achievement-toast';
  notice.className='achievement-toast';notice.setAttribute('role','status');
  notice.setAttribute('aria-live','polite');
  document.body.append(notice);
 }
 notice.replaceChildren();
 const close=document.createElement('button');close.type='button';close.textContent='×';
 close.className='achievement-toast-close';close.setAttribute('aria-label','Dismiss achievement notification');
 close.addEventListener('click',()=>notice.remove());
 const heading=document.createElement('strong');heading.textContent='✦ ACHIEVEMENT UNLOCKED';
 const content=document.createElement('p');
 content.textContent=awards.map(a=>a.title+' · '+a.reward.name).join(' • ');
 const link=document.createElement('a');link.href='./achievement-hangar.html?unlocked='+
  encodeURIComponent(awards[0].id);link.textContent='VIEW IN HANGAR ↗';
 notice.append(close,heading,content,link);
}
