# EQUA//NOVA — Maths Scrabble

A **playable four-mode prototype** of a sci-fi equation-building board game. Students build mathematically correct equations, guided by **BIDMAS**, and score by using numbered/operator tiles, premium squares, and equation length.

## Play

Serve the project root using a static web server:

```bash
python3 -m http.server 4173
```

Open http://localhost:4173 to see the new **Mission Control homepage**. The four large cards take you directly to Sector Run, The Drift, Local Match and Online Rooms. Alien Lab has its own wide card below them. Game boards now live at [play.html](play.html) with the selected mode in the URL (`?mode=sector`, `?mode=rogue` or `?mode=local`). The project has no install/build step for the static site.

Drag tiles to the 13 × 13 board with a mouse, finger or pen; or click/tap a tile and then its destination. Drag an unscored tile to move it, **or drag it back to the rack to remove it**. Drag rack tiles left or right to reorder them without using a turn, or tap them to select a destination. A separate **Undo Tile** button reverts the most recent placement, and **Clear Placement** returns all unscored tiles to the rack. Select the green **=** tile as often as required. The first complete horizontal/vertical equation must cross the centre. Later equations must share an already-scored tile. Click **Score Equation** to validate and score a move.

- 8 physical rack tiles per hand: 5 from the number bag and 3 from the operator bag (until a supply pool runs out). The equals sign is free and unlimited.
- New tiles must lie on one row/column and complete one connected equation.
- A mathematical parser implements BIDMAS and exact rational arithmetic (currently exposed through whole-number tiles). Pure identities such as `3=3` are disallowed: at least one actual calculation must appear.
- Double/triple tile and equation squares are applied only when a *new non-equals tile* lands on them.
- Length bonus: +3 per square beyond 5. Every completed valid calculation earns +5 and every connected equation earns another +5. Playing all 8 physical rack tiles gives +20.
- Every turn allows **one free swap of exactly one rack tile**. A second swap or swapping several tiles spends the turn. The replacement is drawn from the **same supply pool** as the tile returned, so the rack stays five number-kind and three operator-kind tiles while supply permits. Kept tiles are never redrawn.
- Three wildcard types are available: **#** (digit 0–9), **◇** (+, −, × or ÷), and **✦** (any digit or basic operator). Choose the wildcard value on placement; its tile value is always zero points.
- Six-turn escalating single-player sectors. Targets begin at **40, 55, 70, 90, 110, 135, 160 and 190**, then grow gradually. A fresh board and bag start each sector; the run's cleared sectors and lifetime energy continue across them.
- The equation readout is **in the right-hand command console**, not underneath the board. A live placement preview shows the expression, gaps/alignment issues and *potential* points. The calculation is **not evaluated** until submission, so this does not give away the answer.
- **Pass C autosave:** the board, rack order, tile bag, pending placements (including programmed blanks), sector/turn/energy, scoring history and accumulated run progress are saved locally after each meaningful action. Reloading resumes the run. A success/failure report survives reload, and scoring is saved **before** the animation. **New Run** asks for confirmation before replacing a saved game.
- Keyboard controls: 1–8 select an available rack tile, = selects an unlimited equals sign, arrows move board focus, Enter places or picks up, Backspace undoes the most recent tile, and Escape deselects.
- Responsive board sizing keeps the larger board, physical rack and primary controls visible together on standard laptop screens. On portrait phones secondary panels may sit below the play area.
- First-time players see a short three-step guide. The left-hand panel provides context-sensitive placement tips, remaining-points-per-turn guidance, the last three scored equations, and a **Run Summary** button. Sector reports include a progress bar, best move, equations scored, turns used, exchanges and a per-turn record.

## Scoring animation and tile-bag information

**Score Equation** still checks the complete expression using BIDMAS before anything scores. After a correct submission, each tile in the verified equation **lifts, settles, and reveals the exact energy it contributes**, in order. A small energy counter and the sector-energy total advance tile by tile; the equation-length, calculation, connection, rack, equipment and anomaly effects are displayed as separate score stages afterward. Values on 2T/3T and equation-multiplier squares—and equipment such as Ionised Sevens—are correctly included in each tile's animated award. Free equals and blank tiles visibly contribute zero. The complete score is written to local save **immediately**, before any animation starts.

The animation runs only while the current view is active. Use **SKIP** in the command panel to go directly to the score breakdown. Players using the browser's **reduced-motion** setting receive the completed result immediately with no tile bounce. A refresh during scoring resumes the already committed game instead of duplicating points or consuming any one-use equipment twice.

**Click/tap the IN BAG count** in Mission Telemetry to inspect every remaining digit (0–9), operation (+, −, ×, ÷), and each of the three blank tile types (#, ◇, ✦). The pop-in groups tiles with their exact current counts, including types that have run out. It does **not** include tiles already on the board or in the rack. It never reveals the bag's draw order, which may be adjusted by playable-rack balancing. The equals sign is unlimited and is not part of the physical bag. Opening the pop-in is free and does not change the game.

## Random starting tiles and fresh draws

**Every fresh game and sector begins with a newly shuffled 151-tile bag**, using browser-generated randomness when available. The former fixed opening hand has been removed. Starting racks are *balanced but random*: where the bag permits, each eight-tile rack contains **five number-kind and three operator-kind tiles**, including corresponding wildcard types. The two draw pools are independently finite. Their **positions are shuffled**, rather than always placing the blank first and the operation second. Newly drawn tiles also appear in a randomized order, while tiles you choose to keep retain their positions.

The game remembers the most recent opening rack pattern separately for Sector Run, The Drift and Local Match; if a new opening would look identical to the previous one, it is reshuffled (and if necessary rearranged). **No physical tiles are invented, duplicated or removed to avoid repetition.** A new game also creates an independent bag order, so later draws are not locked into a tutorial sequence. The opening pattern history is local to this browser and is not a competitive seed, server record or cross-device guarantee.

## Alien Lab — Pass B multiplayer pilot identities

Alien Lab now supplies original **cute alien pilots throughout multiplayer**. Before a **Local Match**, choose a different alien for each of the 2–4 players (Bloop/Orbit/Niblet/Glimmer starter, Surprise Me, or the last alien saved in [Alien Lab](alien-lab.html)). Private hot-seat handovers, the active score strip, game reports and final podium display each player's own alien.

In **Online Signal Clash**, choose an alien before creating or joining a room. While waiting in the lobby, each player can change **only their own** design and everyone sees the update. When the host starts, those designs lock for that match; reloading or reconnecting restores the server-held alien. Icons appear on room cards, the active turn, scoreboards and final results. Small phone-sized portraits remain visible in score strips without shrinking the board.

The [shared profile contract](src/alien/profiles.js) accepts only the versioned 7-part + 3-palette identifiers in \`alien-manifest.json\`. The server validates and stores these cosmetic identifiers in each player's Durable Object seat; it never accepts an uploaded SVG, arbitrary image URL, script or score modification. Existing local saves/old online clients without avatars receive safe starter aliens. The original animal Critter Lab stays unchanged. **Online rooms still require separate Cloudflare Worker deployment** before public multiplayer can work.

For setup instructions and security checks see [Alien Lab profile integration](docs/ALIEN_AVATAR.md) and [Online Rooms deployment](docs/ONLINE_MULTIPLAYER.md).

## Alien Lab — A1 artwork + A2 interactive creator

The first phase of the sci-fi **Alien Lab** avatar maker is ready for review: **30 original, interchangeable SVG components** (four each for heads, eyes, mouths, bodies, arms and legs/movement; six optional accessories) plus **six independent colour palettes**. The shared transparent **320×360** canvas and anatomical anchors let all **28,672 base combinations** connect cleanly. Face elements, shoulder seams, neck seams and hip seams are independently tested, and the renderer keeps high-contrast outlines at small scoreboard sizes.

**Build your own alien:** open [Alien Lab](alien-lab.html), or select the **Alien Lab** card on the homepage. Returning home keeps each existing game save.

**Pass A3 visual polish:** category thumbnails now zoom to the chosen feature (eyes, mouths, arms, legs and extras) instead of shrinking the whole creature; the **48px player portrait** and **72px lobby bust** are framed for readable expressions, while the downloadable SVG stays full-body and transparent. A previous/next category guide makes it easier to finish all seven decisions, and the colours have been adjusted for stronger contrast. The large creature blinks and gently floats (respecting reduced-motion settings), but player icons do not animate. Automated [A3 visual quality tests](tests/alien-a3-browser.mjs) review 64 face variants, 64 body/arm/leg combinations, 42 accessory–palette pairings, 24 skin/head colourways, all front overlays and six screen sizes; labeled contact sheets are uploaded by CI for human design review. Pass A2 now provides live previews, clickable SVG thumbnails for **heads, faces (eyes and mouth), bodies, arms, movement, extras** and **three independently selectable colours**; the four curated starters, **Surprise Me**, reset, undo/redo, browser-only save/restore and a fully transparent **SVG export**. The editor works on desktop/tablet and stacks with a compact sticky preview on phones. Art remains in the reviewable [A1 Specimen Vault](alien-preview.html).

The underlying safe `src/alien/model.js` supports normalising, validating, randomising and serialising versioned choices without arbitrary SVG or remote art. Pass B connects these safe designs to Local Match and Online Rooms seats, including reconnects, scoreboards and results.

See the [Alien Lab artwork and integration contract](docs/ALIEN_AVATAR.md). The existing standalone animal **Critter Lab** and the EQUA//NOVA game modes are unchanged.

## Pass E2 — Online Signal Clash

**Online Rooms** extends multiplayer to two to four people on **different devices**. One pilot creates a six-character room code, others join with the link, and the host starts the match. Players see one shared 13×13 board, their **own private eight-tile rack**, live scoreboards and optional server-enforced turn timers. All completed equations are checked using BIDMAS and scored **by the Cloudflare server**, not the player's browser. Passes, free/paid swaps, finite bag, final rack-point deductions, tie handling, reconnection and the existing satisfying tile-scoring animation are supported.

The online experience lives in [online.html](online.html), uses [server/worker.js](server/worker.js) with one SQLite-backed Cloudflare Durable Object per game and leaves Sector Run, The Drift and Local Match entirely independent. WebSockets announce room revisions, but each player retrieves only their own authorised state.

**Deployment status:** This repository contains the online implementation; **GitHub Pages alone cannot host the room server**. The `equanova-rooms` Worker and `rooms.mrwalkermaths.com` custom domain were initially deployed on 6 November 2026. Before students can play across devices, the Worker must be kept deployed with its endpoint at `rooms.mrwalkermaths.com`. See the [complete online deployment and testing guide](docs/ONLINE_MULTIPLAYER.md). The automated online browser test simulates the server and does not prove that a live Cloudflare service is available.

## Game modes

Select any of the **four full-size, keyboard-accessible mode cards** on the homepage. The in-game **⌂ HOME** control returns to Mission Control without deleting the other modes' saved games. The old mode-selection pop-up and its duplicate bottom buttons have been removed.

**Sector Run** remains the straightforward classroom practice mode: BIDMAS equation building, six-turn sectors, balanced racks, one free tile swap each turn, and a regular cumulative run report. You can retry a failed sector.

**Local Match (Pass E1)** is a 2–4 player pass-and-play mode on one device. Players have private eight-tile racks refilled to **five numbers and three operators** from two shared finite supply pools, share the 13×13 board and score equations using the identical BIDMAS engine. A full-screen privacy handover hides the rack while the device changes hands; the next player explicitly presses **Ready** before their turn timer begins. Timers can be Off, 60, 90 or 120 seconds. Players may pass or exchange tiles, with one free single-tile swap on any turn. The match ends when the bag is empty and someone empties their rack, or after two full rotations without scoring. Every remaining physical rack tile's point value is **deducted** from that player's accumulated score; highest final net score wins, and ties share the win. Local Match has its own private, validated browser save. No online room or account is required. See [Local multiplayer rules and QA](docs/LOCAL_MULTIPLAYER.md).

**The Drift** is a separate roguelike. The equation engine and board are familiar, but completing each sector awards **Flux**, which is spent in the **Salvage Bay** before the next sector. Each permanent upgrade can be installed once and changes real scoring, rack or board rules. You can also buy a repeatable single-use **Pulse Capacitor**, adding 12 energy to the next correct equation. Every third sector has a deterministic reactor anomaly. If you fail the target in The Drift, the run ends and you must start over without the purchased upgrades or Flux.

The current Salvage Bay offers:
- **Tile upgrades** — Ionised Sevens (+3 points for new sevens) and Operator Core (+3 for new multiplication/division tiles).
- **Equation upgrades** — Crosslink Circuit (+5 for connected equations), Longwave Coil (+7 for equations at least seven cells long) and Echo Generator (+2 per newly played physical tile after the fourth).
- **Board upgrade** — Amplifier Array upgrades fresh 2T squares to 3T.
- **Rack upgrades** — Wildcard Beacon favours two wildcards where supply allows, and Operator Reserve favours × and ÷ among the three operator tiles, when the remaining bag permits.
- **Economy and defence** — Flux Recycler adds three Flux per cleared sector; Leak Shield neutralises the Power Leak anomaly.
- **Single-use equipment** — Pulse Capacitor, cost 3 Flux, provides +12 on the next correct submission; maximum three charges carried.

The shop presents four rotating permanent choices plus the capacitor. Prices, purchases, upgrades, unspent Flux and charge usage are saved automatically. Flux rewards happen only once per cleared sector, even if a player refreshes during the score animation. See [The Drift rules and QA guide](docs/DRIFT_RULES.md) for the exact economy and anomaly schedule.

## Scope and planned work

This is a playable **Origin** (non-negative integer digits, +, −, ×, ÷) prototype with **Sector Run, The Drift, Local Match and Online Rooms**. Online Rooms uses a separately deployed Cloudflare Worker for multiplayer. Returning to the static homepage does not send a Worker request. Brackets, signed/fraction tile sets, reusable Critter Lab avatars, signed/fraction/advanced tile sets, audio and achievements are not yet implemented. The illustrative pilot emblem remains a placeholder.

**Rule prototype note:** A single submitted complete equation scores each turn. Unrelated adjacent perpendicular fragments are not checked, and this should be playtested before locking the full game rules.

## Tests

```bash
npm run check
```

The test suite exercises BIDMAS, non-trivial equations, intersections, scoring, wildcards, free swaps and rack reordering. **Pass C also tests hundreds of shuffled rack draws, save corruption/duplicate tile protection, programmed wildcard restoration, report deduplication, storage failures and victory/defeat resume.** It also syntax-checks the browser modules. GitHub Actions runs these checks on pushes and pull requests.

The Chromium smoke tests cover the full-card mission homepage, mobile and keyboard navigation, save-preserving returns, all four modes, including the online two-device UI with a simulated server, and randomized starting racks, independent saves, Salvage Bay purchases, anomalies, roguelike permadeath, consumable usage, the bag pop-in, tile-by-tile scoring with skip/reduced-motion/refresh cases, and true and false equations, wildcard programming, mouse/touch dragging, rack-to-board and board-to-rack movement, reorder/undo, keyboard navigation, first-visit onboarding, pending-move restoration, an interrupted scoring animation, victory resume, sector continuation, corrupted-save recovery and responsive laptop/mobile geometry. The separate Chromium CI job runs the Solo, Drift, scoring-ceremony and local-match browser scenarios against a local static server and uploads diagnostic screenshots.

## Suggested classroom playtest

Try a first equation such as **8 + 4 = 12** crossing the centre **when those tiles are available**. New starts are randomized; use a different correct calculation if they are not. Before scoring, deliberately use **13** to check that the game rejects a mathematically false equation only when you submit it. Verify the Double Tile score calculation. Then build a perpendicular equation reusing the 8, use drag and tap methods, replace and undo a tile, and try exchanging a few tiles. Check the board and eight-tile rack on a 1366 × 768 laptop and a touchscreen.

**Pass C — Core solo gameplay** adds balanced rack replenishment, autosave/restore, sector reports, persistent cumulative run progress, a first-visit guide and contextual hints. The target curve is a prototype calibration; before locking the difficulty, collect classroom playtest observations as described in [docs/SOLO_BALANCE.md](docs/SOLO_BALANCE.md).

**Pass D — Roguelike progression** adds The Drift: separate mode selection, Salvage Bay purchases, permanent and one-use upgrades, real tile/rack/board multipliers, rotating boss-sector anomalies, run-specific Flux and death/restart rules. **Pass E1 — local multiplayer** adds 2–4 player hot-seat play with private rack handovers, optional turn timers, shared scoring, finite bag, pass/exchange rules and endgame penalties. **Pass E2 adds online multiplayer** with private room codes, reconnection and server-authoritative turns; see the separate Cloudflare deployment guide. Existing solo saves remain independent. Calibrate shop and anomaly difficulty with real students before fixing the final economy.

## Saved games and privacy

Saving uses only this browser's `localStorage`. Sector Run uses `equa-nova.sector-run.v1`, The Drift uses `equa-nova.drift.v1`, Local Match uses `equa-nova.local-match.v1`, and the most recently chosen mode is remembered using `equa-nova.last-mode.v1`. Existing Sector Run saves remain compatible with the new mode switch. No server account, external data service or login is involved. The small `AUTOSAVED` indicator is visible on desktop. If storage is blocked, the game still works in the current tab but **progress will not survive a reload**. Clearing browser site data or switching devices removes access to the saved game. Starting a new run overwrites **only that mode's** previous local save after confirmation; switching modes keeps the other run intact.

## Hosting

The site consists of static files and is compatible with GitHub Pages served from the repository root. GitHub Pages must be enabled separately in repository Settings → Pages; deploying the branch does not automatically publish the website.
