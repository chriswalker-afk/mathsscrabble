// Original lightweight boss illustrations for the Drift. No CDN, image
// requests, fonts or canvas: each portrait is a crisp, accessible vector.
const portraits={
 'plus-embargo':'<circle cx="70" cy="76" r="33"/><path d="M48 72q22-28 44 0-22 37-44 0Z"/><path d="M70 58v28M56 72h28"/><path d="m38 42-12-13m74 13 12-13M35 97l-15 15m85-15 15 15"/>',
 'grid-warden':'<path d="M37 36 70 17l33 19v54l-33 28-33-28z"/><path d="M47 45h46v46H47zM47 59h46M47 76h46M62 45v46M78 45v46"/><path d="m55 66 8 6 8-6 8 6 8-6"/><path d="m37 91-14 17m80-17 14 17"/>',
 'curse-weaver':'<path d="m70 20 11 30 29-17-15 29 29 10-29 12 15 27-29-18-11 29-12-29-29 18 16-27-28-12 28-10-16-29 29 17z"/><path d="M53 65q17-22 34 0-17 24-34 0z"/><path d="m53 93-13 27m47-27 13 27"/>',
 'seven-thief':'<path d="M36 35 48 21 96 21 67 108"/><path d="M43 95c-22 2-26-17-15-30l22-10M98 75q20-20 21-1l-8 26-31 21"/><path d="m46 45-17-8m69 8 17-8"/>',
 'forced-relic':'<path d="m70 15 17 30 33 25-33 25-17 30-17-30-33-25 33-25z"/><ellipse cx="70" cy="70" rx="29" ry="19"/><circle cx="70" cy="70" r="11"/><path d="m70 13 0-9M70 127v9M13 70H4m123 0h9"/>',
 'minus-embargo':'<path d="M41 24q-21 14-18 49 0 29 19 43l15-17 13 16 13-16 15 15q23-26 18-57-6-45-34-39-19-18-41 6z"/><path d="M46 69h48"/><path d="M54 51h4m24 0h4"/><path d="m33 90-14 12m102-12 12 12"/>',
 'signal-jam':'<path d="M70 19q-33 12-33 52v42M70 19q33 12 33 52v42"/><path d="M45 68q25-30 50 0M45 86q25 30 50 0"/><path d="M15 29 33 47 17 63m108-34-18 18 16 16M15 111l19-19m91 19-19-19"/><circle cx="70" cy="77" r="8"/>',
 'power-leak':'<path d="M49 19 91 19 113 50 103 101 70 123 37 101 27 50z"/><path d="M70 31 50 75h20l-8 35 29-49H70z"/><path d="M29 88 14 100m97-12 15 12m-94 0-13 20m101-20 13 20"/>',
 'critical':'<circle cx="70" cy="70" r="48"/><circle cx="70" cy="70" r="32"/><path d="M70 37v41m0 10v6"/><path d="m24 42-12-11m105 11 12-11M70 10V2M70 138v-8"/><path d="M33 110 21 121m86-11 12 11"/>',
 'tile-static':'<path d="M70 13 111 45 99 106 70 126 41 106 29 45z"/><path d="m70 13-12 36 41 57m12-61-53 4-17 57m17-57 12 77M29 45l70 61"/><path d="m49 24-12-12m66 12 12-12"/>',
 'short-circuit':'<path d="M23 34q28-34 50 5t44 0M23 102q28 34 50-5t44 0"/><path d="M38 52h15l-8 15h28l-8 14h29"/><path d="M85 49 99 67 85 85"/><circle cx="30" cy="67" r="7"/>',
 'multiplier-leech':'<path d="M25 33q45-38 90 0v62q-45 37-90 0z"/><path d="M49 40 91 82m0-42L49 82M40 104h60"/><path d="m34 47-15-12m87 12 15-12M70 102v25"/><circle cx="70" cy="68" r="31"/>'
};
const accents={
 'plus-embargo':'#f2b576','grid-warden':'#76d9d6','curse-weaver':'#fa8d9f',
 'seven-thief':'#d7a7fc','forced-relic':'#f2cb83','minus-embargo':'#a7c9ff',
 'signal-jam':'#95b8ff','power-leak':'#ffad86','critical':'#ff8b9f',
 'tile-static':'#8cdce8','short-circuit':'#c0a4fc','multiplier-leech':'#cbeca8'
};
export const bossAccent=id=>accents[id]||'#e3bd8e';
export function bossArtwork(id){
 const paths=portraits[id]||portraits['forced-relic'];
 const accent=bossAccent(id);
 // Only catalog IDs select graphics/colors; no interpolated player markup.
 return '<svg class="boss-art" viewBox="0 0 140 140" role="img" aria-label="Boss portrait" focusable="false" xmlns="http://www.w3.org/2000/svg">'+
   '<circle cx="70" cy="70" r="65" fill="#122d3e" stroke="'+accent+'" stroke-opacity=".48" stroke-width="2"/>'+
   '<circle cx="70" cy="70" r="58" fill="none" stroke="'+accent+'" stroke-opacity=".15" stroke-width="1.5" stroke-dasharray="2 7"/>'+
   '<circle cx="70" cy="70" r="45" fill="'+accent+'" fill-opacity=".12"/>'+
   '<g fill="none" stroke="'+accent+'" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">'+paths+'</g>'+
   '<circle cx="70" cy="70" r="63" fill="none" stroke="'+accent+'" stroke-opacity=".18" stroke-width="2" stroke-dasharray="14 6"/>'+
   '</svg>';
}
