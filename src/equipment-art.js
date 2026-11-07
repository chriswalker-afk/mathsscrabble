// Lightweight self-contained vector emblems: no network requests or icon fonts.
// Every permanent and temporary upgrade gets its own recognisable artwork.
const art={
 'ion-seven':'<path d="M21 19H49L31 53"/><path d="m44 40-8 12h7l-4 9"/>',
 crosslink:'<circle cx="36" cy="36" r="16"/><path d="M14 36h44M36 14v44"/><circle cx="36" cy="36" r="5" fill="currentColor" stroke="none"/>',
 longwave:'<path d="M10 42q9-22 18 0t18 0t18 0"/><path d="m48 18 12 0v12"/>',
 'wild-beacon':'<path d="m36 12 6 17 18 7-18 6-6 18-7-18-17-6 17-7z"/><circle cx="36" cy="36" r="7"/>',
 'operator-core':'<path d="m21 21 30 30m0-30L21 51"/><path d="M11 36h10m30 0h10M36 11v10m0 30v10"/>',
 amplifier:'<rect x="14" y="14" width="44" height="44" rx="4"/><rect x="23" y="23" width="26" height="26" rx="3"/><path d="M36 27v18m-9-9h18"/>',
 echo:'<path d="M12 36c10-21 20-21 24 0s14 21 24 0"/><path d="M15 48c6 14 16 14 21 0s15-14 21 0"/>',
 'operator-reserve':'<path d="M17 24h18m-9-9v18M38 46h18"/><circle cx="47" cy="33" r="2" fill="currentColor" stroke="none"/><circle cx="47" cy="57" r="2" fill="currentColor" stroke="none"/>',
 'flux-recycler':'<circle cx="36" cy="36" r="10"/><path d="M12 31a25 25 0 0 1 43-12m0 0V9m0 10H44M60 41a25 25 0 0 1-43 12m0 0v10m0-10h11"/>',
 'leak-shield':'<path d="M36 10 55 18v18c0 13-8 21-19 26-11-5-19-13-19-26V18z"/><path d="m27 35 7 7 13-15"/>',
 'odd-charge':'<circle cx="21" cy="30" r="5"/><circle cx="36" cy="22" r="5"/><circle cx="51" cy="30" r="5"/><path d="m24 49 8 5 14-14"/>',
 'bonus-echo':'<rect x="13" y="16" width="27" height="27" rx="3"/><rect x="30" y="29" width="27" height="27" rx="3"/><path d="m43 36 2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>',
 'length-matrix':'<path d="M10 29h52M10 43h52M14 23v26m12-24v8m12-8v8m12-8v8m12-10v26"/><path d="m13 56 9-6m-9 6 9 6"/>',
 'precision-pay':'<circle cx="36" cy="36" r="23"/><circle cx="36" cy="36" r="13"/><circle cx="36" cy="36" r="4" fill="currentColor" stroke="none"/><path d="M36 7v17M36 48v17"/>',
 'premium-dividend':'<path d="M36 9 53 23 47 49 36 61 25 49 19 23z"/><path d="m19 23 17 11 17-11M36 34v27"/>',
 'extra-swap':'<path d="M15 24h39m-9-9 9 9-9 9M57 48H18m9-9-9 9 9 9"/>',
 'wide-rack':'<rect x="10" y="27" width="15" height="20" rx="3"/><rect x="29" y="27" width="15" height="20" rx="3"/><rect x="48" y="27" width="15" height="20" rx="3"/><path d="M35 15v9m-5-4h10"/>',
 'extra-turn':'<circle cx="36" cy="38" r="21"/><path d="M36 23v16l12 7M32 11h8M52 14l6-6M20 14l-6-6"/>',
 'starter-spark':'<path d="M36 8v56M8 36h56M16 16l40 40m0-40L16 56"/><circle cx="36" cy="36" r="9"/>',
 'pulse-charge':'<path d="M43 9 19 42h19l-8 21L55 29H36z"/>',
 'double-score':'<circle cx="36" cy="36" r="22"/><path d="m23 25 25 22m0-22L23 47M21 18h30"/>',
 'power-surge':'<path d="m12 42 16-18 11 17 20-23M48 18h11v11"/><path d="M16 55h40"/>',
 'step-up':'<path d="M19 52 36 20l17 32M36 20v42"/><circle cx="19" cy="52" r="3"/>',
 'step-down':'<path d="M19 20 36 52l17-32M36 10v42"/><circle cx="53" cy="20" r="3"/>',
 'operator-shift':'<path d="M13 25h42m-9-9 9 9-9 9M59 47H17m9-9-9 9 9 9"/><circle cx="36" cy="36" r="5"/>',
 'wildcard-hunt':'<path d="m36 11 6 17 19 8-19 7-6 18-7-18-18-7 18-8z"/><path d="M19 54 53 20"/>',
 'recycle-tile':'<path d="M20 22a22 22 0 0 1 35 9m0 0 3-14m-3 14-14-5M52 50a22 22 0 0 1-35-9m0 0-3 14m3-14 14 5"/>'
};
// Fixed IDs only: no user input is interpreted as markup.
export function equipmentArt(id){
 const drawing=Object.hasOwn(art,id)?art[id]:art['starter-spark'];
 return '<svg class="equip-svg" viewBox="0 0 72 72" aria-hidden="true" focusable="false">'+
   '<circle cx="36" cy="36" r="33" fill="#0e2839" stroke="currentColor" stroke-opacity=".65" stroke-width="1.5"/>'+
   '<circle cx="36" cy="36" r="29" fill="#20404c" stroke="currentColor" stroke-opacity=".24" stroke-dasharray="2 5"/>'+
   '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="3">'+drawing+'</g></svg>';
}
