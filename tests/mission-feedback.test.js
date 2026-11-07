import test from 'node:test';
import assert from 'node:assert/strict';
import {FEEDBACK_TONES,FEEDBACK_LABELS,feedbackTone,feedbackMessage,
 paintFeedback,connectionFeedback} from '../src/mission-feedback.js';

test('all gameplay modes share a bounded vocabulary for action feedback',()=>{
 assert.deepEqual(FEEDBACK_TONES,['info','success','warning','error']);
 for(const tone of FEEDBACK_TONES){
  assert.equal(feedbackTone(tone),tone);
  assert.ok(FEEDBACK_LABELS[tone].length>3);
 }
 assert.equal(feedbackTone('__proto__'),'info');
 assert.equal(feedbackTone('danger'),'info');
 assert.equal(feedbackTone(null),'info');
});
test('notice updates preserve plain text and avoid repeat ARIA announcements',()=>{
 let value='Waiting for your first move',writes=0;
 const element={
  dataset:{},classList:{toggle(key,enabled){assert.equal(key,'error');this.enabled=enabled;}},
  get textContent(){return value;},set textContent(x){writes++;value=x;},title:''
 };
 paintFeedback(element,' Waiting for your first move ','info');
 assert.equal(writes,0,'same status should not reannounce every render');
 assert.equal(element.dataset.tone,'info');
 paintFeedback(element,'Equation not balanced.','error');
 assert.equal(writes,1);
 assert.equal(element.dataset.tone,'error');
 assert.equal(element.classList.enabled,true);
 assert.equal(element.textContent,'Equation not balanced.');
 assert.equal(element.title,'Equation not balanced.');
 paintFeedback(element,'Equation not balanced.','error');
 assert.equal(writes,1,'identical error must not be announced twice');
 paintFeedback(element,'Turn scored.','success');
 assert.equal(element.dataset.tone,'success');
 assert.equal(element.classList.enabled,false);
 assert.equal(writes,2);
 assert.equal(feedbackMessage(null),'');
 assert.equal(feedbackMessage('<img onerror=alert(1)>'),'<img onerror=alert(1)>',
  'source must be plain text, not HTML; browser uses textContent');
 paintFeedback(null,'Any message','error');
});
test('online connection states explain the action students should take',()=>{
 const expected={
  live:'Live connection',
  reconnecting:'Reconnecting',
  polling:'Sync by refresh',
  offline:'Offline'
 };
 for(const [state,label] of Object.entries(expected)){
  const detail=connectionFeedback(state);
  assert.equal(detail.label,label);
  assert.ok(detail.description.length>=25);
  assert.ok(FEEDBACK_TONES.includes(detail.tone));
 }
 assert.match(connectionFeedback('reconnecting').description,/check the board/i);
 assert.match(connectionFeedback('polling').description,/checking room updates/i);
 assert.equal(connectionFeedback('other').label,'Offline');
});
