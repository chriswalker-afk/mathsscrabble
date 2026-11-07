/** Student instruction launch audit: exercise the real first-use walkthroughs,
 * clarity, context-specific bracket guidance and accurate CTA labels.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1366,height:850},reducedMotion:'reduce'});
const page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const BASE='http://127.0.0.1:4173/';
try{
 await page.goto(BASE+'index.html',{waitUntil:'networkidle'});
 assert.equal(await page.locator('.choice-card').count(),2,'two clear first-screen choices');
 assert.equal(await page.locator('.mini-cell').count(),49,'small decorative equation board');
 assert.match(await page.locator('#home-save-status').textContent(),/save automatically/i);
 await page.locator('#home-single').click();
 await page.waitForURL(/choose\.html\?type=single$/);
 assert.equal(await page.locator('.mode-option').count(),2);
 assert.equal(await page.locator('.kit-option').count(),4);
 await page.locator('[data-tile-kit="rational"]').click();
 assert.match(await page.locator('#kit-description').textContent(),/fractions/i);

 await page.goto(BASE+'play.html?mode=sector&tiles=natural',{waitUntil:'networkidle'});
 assert.equal(await page.locator('#modal').evaluate(el=>el.open),true);
 assert.match(await page.locator('#modal-title').textContent(),/ready to build/i);
 assert.equal(await page.locator('#modal-body .training-step').count(),3);
 assert.equal(await page.locator('#modal-actions button').count(),1,'one clear first-play action');
 assert.match(await page.locator('#modal-actions button').textContent(),/START MISSION/);
 assert.match(await page.locator('#modal-body').textContent(),/locked tile/);
 await page.locator('#modal-actions button').click();
 await page.locator('#help-btn').click();
 assert.match(await page.locator('#modal-actions button').textContent(),/BACK TO GAME/);
 await page.locator('#modal-actions button').click();
 assert.equal(await page.locator('#tile-set-btn').count(),0,'tile kit is chosen during game setup');
 assert.equal(await page.locator('#drift-zone-map').isHidden(),true,'zone navigation is Drift-only');

 await page.goto(BASE+'play.html?mode=rogue&tiles=rational',{waitUntil:'networkidle'});
 assert.match(await page.locator('#modal-title').textContent(),/Clear sectors, upgrade and face bosses/i);
 assert.equal(await page.locator('#modal-body .training-step').count(),3);
 assert.match(await page.locator('#modal-body').textContent(),/Every third sector/);
 assert.match(await page.locator('#modal-body').textContent(),/Place both \( and \) in the same equation/);
 assert.match(await page.locator('#modal-actions button').textContent(),/BEGIN THE DRIFT/);
 await page.locator('#modal-actions button').last().click();
 await page.locator('#help-btn').click();
 assert.match(await page.locator('#modal-actions button').textContent(),/BACK TO GAME/);
 await page.locator('#modal-actions button').click();

 await page.goto(BASE+'play.html?mode=local&tiles=rational',{waitUntil:'networkidle'});
 assert.match(await page.locator('#modal-title').textContent(),/Set up a local match/);
 await page.locator('#local-tile-set').selectOption('rational');
 assert.match(await page.locator('#local-kit-description').textContent(),/6 numbers, 3 operators and a matched \( \) pair/);
 assert.match(await page.locator('.alien-setup-note').textContent(),/save automatically by player name/i);
 await page.locator('#modal-actions button').last().click();
 await page.locator('#local-ready-btn').click();
 await page.locator('#help-btn').click();
 assert.equal(await page.locator('#modal-body .training-step').count(),3);
 assert.match(await page.locator('#modal-body').textContent(),/Handover privately/);
 assert.match(await page.locator('#modal-body').textContent(),/matched pair/);
 await page.locator('#modal-actions button').click();

 await page.goto(BASE+'online.html',{waitUntil:'networkidle'});
 assert.equal(await page.locator('#online-gate').isVisible(),true);
 assert.match(await page.locator('#gate-description').textContent(),/Each pilot joins on their own device/);
 const help=page.locator('#online-gate-help');
 assert.equal(await help.isVisible(),true,'pre-match rules must be accessible without entering a room');
 await help.click();
 assert.equal(await page.locator('#online-dialog-body .training-step').count(),5);
 assert.match(await page.locator('#online-dialog-body').textContent(),/Tap or drag tiles/);
 assert.match(await page.locator('#online-dialog-actions button').textContent(),/BACK TO SETUP/);
 await page.locator('#online-dialog-actions button').click();
 await page.locator('#online-tile-kit').selectOption('advanced');
 assert.match(await page.locator('#online-create-kit-info').textContent(),/powers|square roots/i);
 await help.click();
 assert.match(await page.locator('#online-dialog-body').textContent(),/matched pair/);
 await page.locator('#online-dialog-actions button').click();

 await page.goto(BASE+'alien-lab.html',{waitUntil:'networkidle'});
 await page.locator('#alien-app[data-ready="true"]').waitFor();
 assert.match(await page.locator('.mission-bar > p').textContent(),/save your alien for matches/);
 await page.goto(BASE+'achievement-hangar.html',{waitUntil:'networkidle'});
 assert.match(await page.locator('.intro').textContent(),/Choose a pilot, complete challenges/);
 assert.match(await page.locator('.pilot-deck p').first().textContent(),/Achievements save on this device/);
 assert.equal(await page.locator('#award-grid .award-card').count(),10);
 assert.deepEqual(errors,[],'instructions and onboarding must not cause runtime errors');
 console.log('Student launch copy audit passed: home kit facts, Sector, Drift, Local, online first-use guide, Alien Lab and Hangar.');
}finally{await browser.close();}
