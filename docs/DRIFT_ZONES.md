# The Drift — Galactic Zone Map and Boss Encounters

The Drift now advances through **three-sector zones**, each named after a uniquely illustrated boss drawn at random from a twelve-boss pool. **Sectors 3, 6, 9, ...** are boss battles. The first two sectors of each zone use ordinary Drift gameplay. Winning the boss battle grants the normal Salvage Bay visit, shows the zone victory card, and advances to a new boss-named zone on the next sector.

The route display appears in the existing left telemetry panel with three numbered mission nodes and a boss portrait; it does **not** resize, obscure, or overlay the 19×19 board. Tap the route card or **ZONE MAP** in the header to view completed zones, the current three-sector path and the uncharted zone ahead. The current node glows, completed sectors show checkmarks, and the final node has a distinctive boss diamond. Boss artwork and ambient lighting use original inline SVG/CSS rather than downloads or Cloudflare services.

Boss identity is selected using browser entropy at the beginning of the zone and stored in the existing Drift local save. A reload cannot reroll it. Consecutive zones may not choose the same boss; all other combinations are possible. Older saves retain their original fixed boss encounters for already defeated zones.

## Boss pool

| Boss / Zone | Boss-sector rule |
|---|---|
| **The Addition Eater** — The Silent Sum Nebula | Physical `+` tiles are **sealed from new operator draws** for this sector. The tile still physically exists in the 151-tile inventory and can be used if already held; wildcard operators may still be configured as + |
| **The Grid Warden** — The Obsidian Grid | Eight visually marked board cells are **impassable** for physical tiles, equals signs, clicks, keyboard placements and drags |
| **The Curse Weaver** — The Crimson Fracture | Eight red **rift squares** subtract **6 energy per newly played physical tile** placed there. Only the current move is charged, never a reused locked tile, and total scores cannot become negative |
| **The Seven Thief** — The Hollow Sevens | Newly placed physical `7` tiles score **0 tile energy**, even if boosted by equipment. The digit still works mathematically |
| **The Relic Collector** — The Relic Vault | One random rack tile is highlighted. It **must be included in the next successfully scored equation**. It cannot be swapped away or transformed first. Once scored, the demand ends |
| **The Subtraction Spectre** — The Vanishing Difference | Physical `−` is sealed from fresh operator draws for the boss sector |
| **The Signal Phantom** — The Static Expanse | Double-equation (`2E`) multipliers are jammed |
| **The Energy Leech** — The Draining Deep | Every equation loses **15% energy**. Leak Shield protects the reactor |
| **The Overloaded Core** — The Overload Belt | The sector target increases by **20%** |
| **The Crystal Storm** — The Broken Constellation | Newly placed tiles on `3T` count as `2T` |
| **The Circuit Serpent** — The Narrow Signal | Equations cannot be longer than **eight consecutive squares** |
| **The Spark Devourer** — The Dimming Array | `2T` squares supply no tile multiplier, overriding Amplifier Array on those squares |

### How the random encounter works

At the start of a fresh run, a first-zone boss is chosen at random. As the player enters sectors 4, 7, 10, ... the next boss is selected from the other eleven types. Until the zone is entered, subsequent zones appear as **UNCHARTED** on the larger map. This avoids allowing players to reroll a boss by refreshing or repeatedly opening the map.

A glowing boss introduction appears when entering a new boss sector, explaining the temporary restriction **before the player starts placing tiles**. It is intentionally not replayed on an ordinary page reload. In combat, the game also shows the boss portrait and rules beside the command console.

### Board and bag safeguards

The standard bonus map remains exactly as it was. Boss-only blocked/rift squares are applied over the existing board as a temporary visual layer. The board remains symmetric in its permanent bonus-square layout. The center square and a usable initial equation route are never blocked. Boss hazards vanish when the next sector begins.

Sealed operators remain in the physical bag so tile IDs and the total of 151 physical tiles stay conserved, but the draw engine excludes them from both initial and replacement draws. Bag Scan explicitly explains this during a boss. Swapping and single-use tile-transform powers also respect the embargo; the user is not charged for an impossible draw or transformation.

Boss tile/drain scoring uses the same score preview and scoring-ceremony totals as regular Drift. Rejected moves never consume the temporary score boosters. A required tile cannot be exchanged or transformed away. All boss-specific effects disappear after the sector.

## Verification

- Unit rules: zone boundaries, random selection and no consecutive repeats, saved boss persistence, compatibility with older fixed-boss runs, all twelve temporary encounter rules, unchanged regular sectors, physical-bag conservation and scoring-ceremony arithmetic
- Browser: full map, three-node route, boss artwork, saved identity after reload, rejected blocked squares, draining squares, forced-tile swap prevention, sealed-bag warning, keyboard and phone responsiveness
- Existing Sector Run, Drift, local multiplayer, online multiplayer, Worker runtime and Alien Lab regression tests

The boss system operates entirely in the existing static GitHub Pages client. No Cloudflare Worker change or additional Worker requests are needed.

## Pass D — Illustrated worlds and the Captain's Star Chart

Each zone now has two original asset types: a recognisable **guardian
character** in `src/boss-art.js` and a bespoke **panoramic environment SVG**
in `assets/drift/zones/<boss-id>.svg`. Every zone is still named after its
saved boss; no art is selected randomly on a reload. Artwork is a cue that
helps players remember which temporary rule they face, not a new gameplay
mechanic.

The upgrade extends the *same* scene and portrait across five contexts:
the compact live route strip, the zone map's current-zone chart, the
boss's first encounter briefing, the temporary anomaly warning, and
the round-end intermission panel. The map shows the current world first;
the next zone remains **The Uncharted Beyond** until entered. Completed
zones remain accessible under **FLIGHT LOG** as collapsible history rather
than being repeated ahead of the currently active zone.

- **Approach sectors (1 and 2):** the guardian's name and upcoming effect
  are visible in the chart, but its effect is not yet applied.
- **Final sector (3):** the briefing describes the actual, existing
  boss-specific rule in a separate, legible panel; only this sector is
  affected.
- **Victory:** the zone is marked conquered, the earned score and Flux
  remain unchanged, and the player can still either visit the Salvage Bay
  or continue to the next zone.
- **Later visits / reloads:** the world scene and boss ID are derived only
  from `rogue.zoneBosses`, preserving the original encounter identity.
  Previously cleared sectors are preserved as the flight archive.

All twelve panoramas are static vector art with local gradients, shapes
and clean silhouettes. They deliberately avoid letters baked into images
and need no remote resources or Cloudflare changes. Boss portraits are
inline SVG created only from allowlisted IDs. The new layout overlays no
decoration on mathematical tiles, and the 19×19 board dimensions remain
unchanged.

The new automated checks validate the image assets, recognisable
portrait geometry, route order and history, no unvisited guardian spoilers,
the current warning illustration, reduced-motion preferences, and
320/390/768/1366-pixel responsive layouts. Existing mathematical, boss-rule
and multiplayer tests still run.
