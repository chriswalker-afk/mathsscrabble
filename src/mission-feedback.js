// Pass F: one semantic treatment for action and connection feedback across
// Sector Run, The Drift, local multiplayer and online rooms.
//
// Messages remain plain text in their existing ARIA-live logs. There are no
// transient overlays over mathematical tiles and no timers which could hide
// a problem before a student has understood it.
export const FEEDBACK_TONES=Object.freeze(['info','success','warning','error']);
export const FEEDBACK_LABELS=Object.freeze({
 info:'COMMS',success:'CONFIRMED',warning:'ATTENTION',error:'CHECK MOVE'
});
export function feedbackTone(value){
 return FEEDBACK_TONES.includes(value)?value:'info';
}
export function feedbackMessage(value){
 return String(value??'').trim();
}
export function paintFeedback(target,message,tone='info'){
 if(!target)return;
 const resolved=feedbackTone(tone);
 const text=feedbackMessage(message);
 // Only update the live region if its text actually changes. This avoids
 // repeated announcements during unrelated board/room re-renders.
 target.dataset.tone=resolved;
 target.classList.toggle('error',resolved==='error');
 if(target.textContent!==text)target.textContent=text;
 target.title=text;
}
export function connectionFeedback(mode){
 switch(mode){
  case 'live':return {label:'Live connection',description:'Real-time room signal connected.',tone:'success'};
  case 'polling':return {label:'Sync by refresh',description:'Live signal unavailable. Checking room updates periodically.',tone:'warning'};
  case 'reconnecting':return {label:'Reconnecting',description:'Room signal interrupted. Reconnecting; check the board before submitting another move.',tone:'warning'};
  default:return {label:'Offline',description:'No active room signal. Join or create a room.',tone:'info'};
 }
}
