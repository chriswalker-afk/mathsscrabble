import test from 'node:test';
import assert from 'node:assert/strict';
import {BOSS_POOL} from '../src/drift-bosses.js';
import {makeRogueState} from '../src/rogue.js';
import {bossArtwork,bossAccent,knownZoneArt,zoneSceneUrl} from '../src/boss-art.js';
import {zoneMapMarkup,bossIntroMarkup,zoneVictoryMarkup,zoneIntermissionMarkup} from '../src/drift-map.js';

test('each of the twelve guardians has unique original art, a dedicated safe scene URL and a nonempty accent',()=>{
 assert.equal(BOSS_POOL.length,12);
 const portraits=[];
 const scenes=[];
 for(const boss of BOSS_POOL){
  assert.equal(knownZoneArt(boss.id),true);
  const url=zoneSceneUrl(boss.id);
  assert.equal(url,'./assets/drift/zones/'+boss.id+'.svg');
  assert.match(url,/^\.\/assets\/drift\/zones\/[a-z-]+\.svg$/);
  assert.match(bossAccent(boss.id),/^#[0-9a-fA-F]{6}$/);
  const svg=bossArtwork(boss.id);
  assert.match(svg,/^<svg class="boss-art"/);
  assert.ok(svg.includes(boss.name+' illustrated guardian'));
  assert.ok(svg.includes('viewBox="0 0 140 140"'));
  assert.doesNotMatch(svg,/<script|onload=|<image\b|foreignObject|javascript:/i);
  assert.ok(svg.length>700,'guardian '+boss.id+' must have a substantial illustrated silhouette');
  portraits.push(svg);scenes.push(url);
 }
 assert.equal(new Set(portraits).size,12);
 assert.equal(new Set(scenes).size,12);
 assert.equal(knownZoneArt('../other'),false);
 assert.equal(zoneSceneUrl('../other'),null,'no asset path construction from untrusted input');
 assert.equal(zoneSceneUrl('random'),null);
 assert.ok(bossArtwork('../other').includes('RELIC COLLECTOR'),
   'unknown boss renders a safe fallback portrait');
});

test('star chart features current saved zone, keeps the next guardian hidden and archives completed zones',()=>{
 const rogue={...makeRogueState(),zoneBosses:['grid-warden','seven-thief','power-leak']};
 const html=zoneMapMarkup(rogue,4,'playing');
 assert.match(html,/CAPTAIN’S STAR CHART/);
 assert.match(html,/The Hollow Sevens/,'sector four belongs to the second zone');
 assert.match(html,/CURRENT ZONE/);
 assert.match(html,/The Uncharted Beyond/);
 assert.match(html,/The Obsidian Grid/,'cleared zone remains in the archive');
 assert.ok(html.indexOf('The Hollow Sevens')<html.indexOf('The Obsidian Grid'),
   'current zone should come before completed history');
 assert.match(html,/<details class="zone-history">/);
 assert.match(html,/1 PREVIOUS ZONE/);
 assert.match(html,/zone-chart-landscape/);
 const mystery=html.slice(html.indexOf('map-uncharted'));
 assert.ok(!mystery.includes('The Draining Deep'),
   'a future guardian cannot be announced before entering its zone');
 const start=zoneMapMarkup({...makeRogueState(),zoneBosses:['grid-warden']},1,'playing');
 assert.doesNotMatch(start,/<details class="zone-history">/);
 assert.match(start,/The Uncharted Beyond/);
 const final=zoneMapMarkup({...makeRogueState(),zoneBosses:Array(33).fill('grid-warden')},99,'won');
 assert.doesNotMatch(final,/The Uncharted Beyond/,'zone 34 is outside supported map length');
});

test('encounter and round-end presentation consistently refer to the saved guardian without changing rules',()=>{
 for(const boss of BOSS_POOL){
  const rogue={...makeRogueState(),zoneBosses:[boss.id]};
  const intro=bossIntroMarkup(rogue,3);
  const win=zoneVictoryMarkup(rogue,3);
  const intermission=zoneIntermissionMarkup(rogue,3,'won');
  for(const html of [intro,win,intermission]){
   assert.ok(html.includes(zoneSceneUrl(boss.id)));
   assert.ok(html.includes(boss.name));
   assert.ok(html.includes('boss-art'));
  }
  assert.ok(intro.includes(boss.short));
  assert.ok(intro.includes(boss.description));
  assert.match(intro,/THIS SECTOR’S RULE/);
  assert.match(intro,/only in this boss sector/i);
  assert.match(intermission,/GUARDIAN DEFEATED/);
  assert.match(intermission,/UNCHARTED ZONE/);
  assert.ok(!zoneIntermissionMarkup(rogue,1,'won').includes('GUARDIAN DEFEATED'),
   'normal sector wins cannot masquerade as boss wins');
 }
});
