/** ACHIEVEMENT HANGAR — immutable Pass A source of truth.
 * Registry is data only: art is NOT unlocked, rendered or added to the v1
 * alien-manifest until Pass B. Conditions become earnable when their verified
 * game event adapters are wired in Passes C and D.
 * `event` names are stable integration points for `engine.js`.
 */
export const ACHIEVEMENT_MODES=Object.freeze(['sector','drift','local','online']);
export const ACHIEVEMENT_TIERS=Object.freeze(['easy','moderate','hard']);
export const ACHIEVEMENT_VERSION=1;

export const FREE_ALIEN_OPTIONS=Object.freeze({
 heads:Object.freeze(['orb','pear','jelly','facet']),
 eyes:Object.freeze(['twin','cyclops','trio','visor']),
 mouths:Object.freeze(['smile','surprised','toothy','zigzag']),
 bodies:Object.freeze(['bean','puff','suit','jelly']),
 arms:Object.freeze(['mittens','noodles','claws','tentacles']),
 legs:Object.freeze(['stubs','spindles','tentacles','hover']),
 accessories:Object.freeze(['none','antennae','horns','helmet','jetpack','badge','companion']),
 palettes:Object.freeze(['mint','lavender','coral','aqua','saffron','cosmic-blue'])
});
export const FREE_ALIEN_PRESETS=Object.freeze(['bloop','orbit','niblet','glimmer']);
export function isFreeAlienOption(collection,id){
 return Object.hasOwn(FREE_ALIEN_OPTIONS,collection)&&FREE_ALIEN_OPTIONS[collection].includes(id);
}
const DEFS=[
  {
    "id": "S01",
    "mode": "sector",
    "tier": "easy",
    "title": "Ignition",
    "description": "Score your first validated equation.",
    "reward": {
      "collection": "accessories",
      "id": "star-antennae",
      "name": "Starlight Antennae"
    },
    "rule": {
      "event": "move-scored",
      "target": 1
    }
  },
  {
    "id": "S02",
    "mode": "sector",
    "tier": "easy",
    "title": "Core Stable",
    "description": "Clear your first sector.",
    "reward": {
      "collection": "legs",
      "id": "rocket-soles",
      "name": "Rocket Soles"
    },
    "rule": {
      "event": "sector-cleared",
      "target": 1
    }
  },
  {
    "id": "S03",
    "mode": "sector",
    "tier": "easy",
    "title": "Clever Blank",
    "description": "Use a wildcard in a validated equation.",
    "reward": {
      "collection": "eyes",
      "id": "sparkle",
      "name": "Sparkle Eyes"
    },
    "rule": {
      "event": "move-scored",
      "target": 1
    }
  },
  {
    "id": "S04",
    "mode": "sector",
    "tier": "easy",
    "title": "Fresh Deal",
    "description": "Complete a free one-tile exchange.",
    "reward": {
      "collection": "accessories",
      "id": "shuffle-goggles",
      "name": "Shuffle Goggles"
    },
    "rule": {
      "event": "free-exchange",
      "target": 1
    }
  },
  {
    "id": "S05",
    "mode": "sector",
    "tier": "easy",
    "title": "Linked Logic",
    "description": "Score an equation connected to a previously locked tile.",
    "reward": {
      "collection": "arms",
      "id": "cable",
      "name": "Cable Arms"
    },
    "rule": {
      "event": "move-scored",
      "target": 1
    }
  },
  {
    "id": "S06",
    "mode": "sector",
    "tier": "easy",
    "title": "Number Juggler",
    "description": "Use 3 or more newly placed number tiles in a valid equation.",
    "reward": {
      "collection": "mouths",
      "id": "cheeky",
      "name": "Cheeky Grin"
    },
    "rule": {
      "event": "move-scored",
      "target": 1
    }
  },
  {
    "id": "S07",
    "mode": "sector",
    "tier": "moderate",
    "title": "Premium Orbit",
    "description": "Score a validated move activating a 2T, 3T, 2E or 3E bonus.",
    "reward": {
      "collection": "bodies",
      "id": "reactor-vest",
      "name": "Reactor Vest"
    },
    "rule": {
      "event": "move-scored",
      "target": 1
    }
  },
  {
    "id": "S08",
    "mode": "sector",
    "tier": "moderate",
    "title": "Star Trail",
    "description": "Clear Sector 3 within one continuous Sector Run.",
    "reward": {
      "collection": "heads",
      "id": "comet",
      "name": "Comet Head"
    },
    "rule": {
      "event": "sector-cleared",
      "target": 3
    }
  },
  {
    "id": "S09",
    "mode": "sector",
    "tier": "moderate",
    "title": "Clean Circuit",
    "description": "Clear a sector with 3+ validated equations and zero invalid submissions.",
    "reward": {
      "collection": "palettes",
      "id": "aurora-gold",
      "name": "Aurora Gold"
    },
    "rule": {
      "event": "sector-cleared",
      "target": 1
    }
  },
  {
    "id": "S10",
    "mode": "sector",
    "tier": "hard",
    "title": "Precision Pilot",
    "description": "Clear Sectors 1–5 in the same run with zero invalid submissions in all five.",
    "reward": {
      "collection": "accessories",
      "id": "solar-halo",
      "name": "Solar Halo"
    },
    "rule": {
      "event": "sector-cleared",
      "target": 5
    }
  },
  {
    "id": "D01",
    "mode": "drift",
    "tier": "easy",
    "title": "Chart Reader",
    "description": "Open your first Zone Map.",
    "reward": {
      "collection": "accessories",
      "id": "star-compass",
      "name": "Star Compass"
    },
    "rule": {
      "event": "zone-map-opened",
      "target": 1
    }
  },
  {
    "id": "D02",
    "mode": "drift",
    "tier": "easy",
    "title": "Salvage Visitor",
    "description": "Enter the Salvage Bay after a cleared sector.",
    "reward": {
      "collection": "eyes",
      "id": "mechanic-goggles",
      "name": "Mechanic Goggles"
    },
    "rule": {
      "event": "salvage-entered",
      "target": 1
    }
  },
  {
    "id": "D03",
    "mode": "drift",
    "tier": "easy",
    "title": "First Fitting",
    "description": "Purchase a Ship System.",
    "reward": {
      "collection": "bodies",
      "id": "engineer-overalls",
      "name": "Engineer Overalls"
    },
    "rule": {
      "event": "system-installed",
      "target": 1
    }
  },
  {
    "id": "D04",
    "mode": "drift",
    "tier": "easy",
    "title": "Pocket Gadget",
    "description": "Store your first Mission Gadget.",
    "reward": {
      "collection": "accessories",
      "id": "gadget-pouch",
      "name": "Gadget Pouch"
    },
    "rule": {
      "event": "gadget-bought",
      "target": 1
    }
  },
  {
    "id": "D05",
    "mode": "drift",
    "tier": "easy",
    "title": "Field Test",
    "description": "Successfully activate/apply a Mission Gadget.",
    "reward": {
      "collection": "arms",
      "id": "ion-gloves",
      "name": "Ion Gloves"
    },
    "rule": {
      "event": "gadget-used",
      "target": 1
    }
  },
  {
    "id": "D06",
    "mode": "drift",
    "tier": "easy",
    "title": "Test Flight",
    "description": "Clear a sector with at least one installed Ship System.",
    "reward": {
      "collection": "legs",
      "id": "ion-skates",
      "name": "Ion Skates"
    },
    "rule": {
      "event": "sector-cleared",
      "target": 1
    }
  },
  {
    "id": "D07",
    "mode": "drift",
    "tier": "moderate",
    "title": "Guardian Breaker",
    "description": "Defeat a zone guardian (sector 3/6/9/etc.).",
    "reward": {
      "collection": "heads",
      "id": "guardian-mask",
      "name": "Guardian Mask"
    },
    "rule": {
      "event": "guardian-defeated",
      "target": 1
    }
  },
  {
    "id": "D08",
    "mode": "drift",
    "tier": "moderate",
    "title": "Built to Last",
    "description": "Install 3 Ship Systems within one Drift run.",
    "reward": {
      "collection": "bodies",
      "id": "mech-suit",
      "name": "Mech Suit"
    },
    "rule": {
      "event": "system-installed",
      "target": 3
    }
  },
  {
    "id": "D09",
    "mode": "drift",
    "tier": "moderate",
    "title": "Field Specialist",
    "description": "Use 2 distinct Mission Gadget types in a single Drift run.",
    "reward": {
      "collection": "palettes",
      "id": "warp-mint",
      "name": "Warp Mint"
    },
    "rule": {
      "event": "gadget-used",
      "target": 2
    }
  },
  {
    "id": "D10",
    "mode": "drift",
    "tier": "hard",
    "title": "Deep Drifter",
    "description": "Defeat 3 zone guardians in one uninterrupted Drift run.",
    "reward": {
      "collection": "heads",
      "id": "nebula-crown",
      "name": "Nebula Crown"
    },
    "rule": {
      "event": "guardian-defeated",
      "target": 3
    }
  },
  {
    "id": "L01",
    "mode": "local",
    "tier": "easy",
    "title": "Crew Assembly",
    "description": "Start a match with 2–4 pilots; credit only registered local pilot profiles, not anonymous guests.",
    "reward": {
      "collection": "accessories",
      "id": "crew-pin",
      "name": "Crew Pin"
    },
    "rule": {
      "event": "match-started",
      "target": 1
    }
  },
  {
    "id": "L02",
    "mode": "local",
    "tier": "easy",
    "title": "Your Turn",
    "description": "Complete your own private Ready/handover for the first time.",
    "reward": {
      "collection": "eyes",
      "id": "wink",
      "name": "Wink Eyes"
    },
    "rule": {
      "event": "turn-ready",
      "target": 1
    }
  },
  {
    "id": "L03",
    "mode": "local",
    "tier": "easy",
    "title": "Local Spark",
    "description": "Score your first validated equation in a local match.",
    "reward": {
      "collection": "mouths",
      "id": "cheer",
      "name": "Cheer Mouth"
    },
    "rule": {
      "event": "move-scored",
      "target": 1
    }
  },
  {
    "id": "L04",
    "mode": "local",
    "tier": "easy",
    "title": "Side by Side",
    "description": "Score a valid move connected to a previously locked tile.",
    "reward": {
      "collection": "arms",
      "id": "handshake",
      "name": "Handshake Arms"
    },
    "rule": {
      "event": "move-scored",
      "target": 1
    }
  },
  {
    "id": "L05",
    "mode": "local",
    "tier": "easy",
    "title": "Party Trick",
    "description": "Use a wildcard in a validated local equation.",
    "reward": {
      "collection": "heads",
      "id": "swirl",
      "name": "Swirl Head"
    },
    "rule": {
      "event": "move-scored",
      "target": 1
    }
  },
  {
    "id": "L06",
    "mode": "local",
    "tier": "easy",
    "title": "Fair Exchange",
    "description": "Make a free one-tile exchange in local play.",
    "reward": {
      "collection": "palettes",
      "id": "copper-dawn",
      "name": "Copper Dawn"
    },
    "rule": {
      "event": "free-exchange",
      "target": 1
    }
  },
  {
    "id": "L07",
    "mode": "local",
    "tier": "moderate",
    "title": "Full Circle",
    "description": "Finish a match in which your own pilot scored at least once.",
    "reward": {
      "collection": "legs",
      "id": "sturdy-boots",
      "name": "Sturdy Boots"
    },
    "rule": {
      "event": "match-finished",
      "target": 1
    }
  },
  {
    "id": "L08",
    "mode": "local",
    "tier": "moderate",
    "title": "Friendly Champion",
    "description": "Finish in the winning position of a completed local match.",
    "reward": {
      "collection": "bodies",
      "id": "varsity-jacket",
      "name": "Varsity Jacket"
    },
    "rule": {
      "event": "match-finished",
      "target": 1
    }
  },
  {
    "id": "L09",
    "mode": "local",
    "tier": "moderate",
    "title": "Everyone Shines",
    "description": "Finish a match where all pilots scored 1+ valid moves and you participated.",
    "reward": {
      "collection": "accessories",
      "id": "team-pennant",
      "name": "Team Pennant"
    },
    "rule": {
      "event": "match-finished",
      "target": 1
    }
  },
  {
    "id": "L10",
    "mode": "local",
    "tier": "hard",
    "title": "Tabletop Legend",
    "description": "Win 3 distinct completed local matches under the same saved pilot ID.",
    "reward": {
      "collection": "heads",
      "id": "champion-crest",
      "name": "Champion Crest"
    },
    "rule": {
      "event": "match-finished",
      "target": 3
    }
  },
  {
    "id": "O01",
    "mode": "online",
    "tier": "easy",
    "title": "Signal Acquired",
    "description": "Server confirms that you successfully created or joined a room.",
    "reward": {
      "collection": "accessories",
      "id": "longwave-antenna",
      "name": "Longwave Antenna"
    },
    "rule": {
      "event": "room-joined",
      "target": 1
    }
  },
  {
    "id": "O02",
    "mode": "online",
    "tier": "easy",
    "title": "Hello Pilot",
    "description": "Server lobby confirms 2+ pilots have joined your room.",
    "reward": {
      "collection": "eyes",
      "id": "twin-visor",
      "name": "Twin Visor"
    },
    "rule": {
      "event": "lobby-multi",
      "target": 1
    }
  },
  {
    "id": "O03",
    "mode": "online",
    "tier": "easy",
    "title": "Systems Live",
    "description": "Your room successfully starts a match.",
    "reward": {
      "collection": "legs",
      "id": "signal-soles",
      "name": "Signal Soles"
    },
    "rule": {
      "event": "match-started",
      "target": 1
    }
  },
  {
    "id": "O04",
    "mode": "online",
    "tier": "easy",
    "title": "Verified!",
    "description": "Score your first server-validated equation.",
    "reward": {
      "collection": "mouths",
      "id": "pixel-smile",
      "name": "Pixel Smile"
    },
    "rule": {
      "event": "move-scored",
      "target": 1
    }
  },
  {
    "id": "O05",
    "mode": "online",
    "tier": "easy",
    "title": "Network Link",
    "description": "Server validates a scored equation connected to a previously locked tile.",
    "reward": {
      "collection": "arms",
      "id": "satellite",
      "name": "Satellite Arms"
    },
    "rule": {
      "event": "move-scored",
      "target": 1
    }
  },
  {
    "id": "O06",
    "mode": "online",
    "tier": "easy",
    "title": "Remote Explorer",
    "description": "Finish an online match in which you submitted at least one scored move.",
    "reward": {
      "collection": "palettes",
      "id": "cosmic-violet",
      "name": "Cosmic Violet"
    },
    "rule": {
      "event": "match-finished",
      "target": 1
    }
  },
  {
    "id": "O07",
    "mode": "online",
    "tier": "moderate",
    "title": "Room Captain",
    "description": "Host a completed online match with at least 2 pilots.",
    "reward": {
      "collection": "bodies",
      "id": "captain-coat",
      "name": "Captain's Coat"
    },
    "rule": {
      "event": "match-finished",
      "target": 1
    }
  },
  {
    "id": "O08",
    "mode": "online",
    "tier": "moderate",
    "title": "Kit Hopper",
    "description": "Score an equation in 2 distinct mathematical tile kits in distinct rooms.",
    "reward": {
      "collection": "heads",
      "id": "hologram",
      "name": "Hologram Head"
    },
    "rule": {
      "event": "move-scored",
      "target": 2
    }
  },
  {
    "id": "O09",
    "mode": "online",
    "tier": "moderate",
    "title": "Victory Signal",
    "description": "Finish an online match as a game-designated winner.",
    "reward": {
      "collection": "accessories",
      "id": "orbit-flag",
      "name": "Orbit Flag"
    },
    "rule": {
      "event": "match-finished",
      "target": 1
    }
  },
  {
    "id": "O10",
    "mode": "online",
    "tier": "hard",
    "title": "Galactic Champion",
    "description": "Win 3 completed online matches in 3 distinct match IDs, each with 2+ pilots.",
    "reward": {
      "collection": "heads",
      "id": "stellar-antlers",
      "name": "Stellar Antlers"
    },
    "rule": {
      "event": "match-finished",
      "target": 3
    }
  }
];
export const ACHIEVEMENTS=Object.freeze(DEFS.map(item=>Object.freeze({
 ...item,reward:Object.freeze({...item.reward}),rule:Object.freeze({...item.rule})
})));
export const ACHIEVEMENT_BY_ID=Object.freeze(Object.fromEntries(ACHIEVEMENTS.map(a=>[a.id,a])));
export const ACHIEVEMENTS_BY_MODE=Object.freeze(Object.fromEntries(
 ACHIEVEMENT_MODES.map(mode=>[mode,Object.freeze(ACHIEVEMENTS.filter(a=>a.mode===mode))])
));
export function getAchievement(id){return Object.hasOwn(ACHIEVEMENT_BY_ID,id)?ACHIEVEMENT_BY_ID[id]:null;}
export function rewardForAchievement(id){return getAchievement(id)?.reward??null;}
export function achievementForReward(collection,id){
 return ACHIEVEMENTS.find(a=>a.reward.collection===collection&&a.reward.id===id)??null;
}
export function assertAchievementCatalog(){
 if(ACHIEVEMENTS.length!==40||new Set(ACHIEVEMENTS.map(a=>a.id)).size!==40)
  throw Error('Achievement catalog must have 40 unique IDs.');
 const prizes=new Set();
 for(const [mode,definitions] of Object.entries(ACHIEVEMENTS_BY_MODE)){
  if(definitions.length!==10||definitions.filter(a=>a.tier==='easy').length!==6||
     definitions.filter(a=>a.tier==='moderate').length!==3||
     definitions.filter(a=>a.tier==='hard').length!==1)
    throw Error('Achievement tiers are unbalanced for '+mode+'.');
  for(const a of definitions){
   if(!a.id.match(/^[SDLO][0-9]{2}$/)||!a.title||!a.description||!a.rule.event||
      !Number.isInteger(a.rule.target)||a.rule.target<1||a.rule.target>5||
      !Object.hasOwn(FREE_ALIEN_OPTIONS,a.reward.collection)||
      isFreeAlienOption(a.reward.collection,a.reward.id))
    throw Error('Invalid award definition '+a.id+'.');
   const prize=a.reward.collection+'/'+a.reward.id;
   if(prizes.has(prize))throw Error('Duplicate reward '+prize);
   prizes.add(prize);
  }
 }
 return true;
}
assertAchievementCatalog();
