# Achievement Hangar — Pass A: Registry, Ownership and Progress Engine

**Status:** Implementation foundation. **Not yet active in gameplay.** See [Issue #27](https://github.com/chriswalker-afk/mathsscrabble/issues/27) for the full forty-achievement plan and Passes B–E.

This pass intentionally does **not** add SVG artwork, modify `alien-manifest.json`, award achievements on user actions, or expose locked items in Alien Lab. It gives the next passes stable, tested contracts.

## Locked-in design

- **40 stable achievements:** `S01–S10` (Sector Run), `D01–D10` (Drift), `L01–L10` (Local Match), `O01–O10` (Online Signal Clash). Every mode contains **6 easy / 3 moderate / 1 hard** challenges. Every achievement maps to its own future cosmetic (40 distinct new part IDs/palette tokens).
- **All existing options remain free:** `FREE_ALIEN_OPTIONS` captures all 4 heads, 4 eyes, 4 mouths, 4 bodies, 4 arms, 4 legs, 7 accessories (including none), 6 palettes, and the 4 free starter presets. It intentionally does not replace the v1 manifest or change existing avatar selection or server allowlists.
- **Cosmetics only:** achievements do not change scoring, maths validation, tile distributions, random stock, bosses, time limits, matching or network authority.
- **No performance-pressure incentives:** no daily streaks, time-limited tasks, paywalls or rewards for incorrect maths.

## Modules and responsibilities

| Module | Contract |
| --- | --- |
| `src/achievements/catalog.js` | Immutable 40-entry registry, reward lookup, tier counts, and immutable original-free baseline. |
| `src/achievements/pilots.js` | Device-local named pilot profiles, secure random IDs, explicit local seat-owner binding and guest support, strict avatar validation, safe one-time legacy avatar copy. |
| `src/achievements/events.js` | Strict typed event contract per game mode, trusted-action requirements and local-seat-to-pilot adapter. |
| `src/achievements/engine.js` | Pure reducer, per-pilot progress, set-like permanent unlocks, deduplicated event receipts, distinct run/match counting, free/earned entitlement lookup. |
| `src/achievements/storage.js` | Separate versioned local storage keys, bounded save validation, opt-in legacy profile migration and export/import backups with rollback on failure. |
| `tests/achievement-catalog-pilots.test.js` | Free options, 40 rewards, pilot ownership, migration, corrupt saves and backup integrity. |
| `tests/achievement-engine.test.js` | All 40 unlock conditions, hard thresholds, duplicate prevention, local seat privacy and online event contract. |

## Game event contract

An event is recorded **only after a successful, verified game transition**, never merely because someone clicked a button, opened a scoring ceremony or reloaded a results screen.

The current reducer expects this shape for solo/Drift/local play:

```js
{
  id: 'run-a:score:001', // stable for the original action; identical after retries
  pilotId: 'pilot-00112233445566778899aabb', // explicit saved pilot
  mode: 'sector',   // sector | drift | local | online
  type: 'move-scored',
  scopeId: 'sector-run-unique-0001', // MUST be new for every New Run
  authority: 'local-transition',
  data: {
    points: 32, wildcards: 1, crossing: 1, numberTiles: 3,
    premium: true, tileSet: 'natural'
  }
}
```

For online play, add `roomId` with an opaque stable *room instance* identifier and set `authority:'server-confirmed'`. The matching `scopeId` must be a stable **match instance ID**, not just a reusable six-character lobby code. The adapter must construct these events only from **server-confirmed action results and confirmed room snapshots**. The string `server-confirmed` alone is not proof against a modified browser. The Worker must remain authoritative for moves, rack ownership, mathematical scoring, game outcomes and rooms.

**Contract table:**

| Mode | Events | Required evidence |
| --- | --- | --- |
| Sector | `move-scored`, `free-exchange`, `sector-cleared` | Score points, wildcard count, crossing count, number tiles placed, premium-square usage, kit; full confirmed sector report with equation count / invalid attempts |
| Drift | `zone-map-opened`, `salvage-entered`, `system-installed`, `gadget-bought`, `gadget-used`, `sector-cleared`, `guardian-defeated` | Purchase result, installed system count, gadget ID on *successful application*, cleared sector report, *actual* guardian victory |
| Local | `match-started`, `turn-ready`, `move-scored`, `free-exchange`, `match-finished` | Registered seat owner ID, actual player action/score, completed standings and participation, stable match instance ID |
| Online | `room-joined`, `lobby-multi`, `match-started`, `move-scored`, `match-finished` | **Server-confirmed** room/match snapshots, exact actor, actual score, connected tiles, kit and completed standings |

Each event has mode-specific exact keys, bounded numeric values and a unique ID. The reducer requires a registered pilot ID; **guests are not credited**. `assignLocalSeats` rejects assigning the same saved pilot to two seats. `localSeatAchievementEvent` resolves the currently acting seat and returns `null` for guests. Do not fall back to the currently active pilot when a local guest scores.

### Counters and replay safety

- `seen` stores the most recent **256** event IDs per pilot; duplicate IDs never award again. Permanent unlocks are a set of the 40 known IDs.
- For **S08/S10**, sector reports 1–3 or clean reports 1–5 must come from the **same unique run**, never mixed across runs. The first accepted report for a sector is immutable for that run.
- For **D09/D10**, two distinct applied gadget types or three distinct guardian sectors must occur in a single Drift run. Installing three systems is evaluated from a verified 3-system equipment state.
- For **L10/O10**, three **different completed match IDs** are required; repeated results never increment a counter. For **O08**, at least two distinct tile kits must have scored across **different room instances**.
- Trackers are deliberately bounded to the most recent **8** runs; match-win counters stop at 3. Achieved rewards never disappear when old replay receipts are eventually evicted. New Run only resets the separate gameplay state.

## Browser data and pilot migration

| Key | Meaning |
| --- | --- |
| `equa-nova.alien.v1` | **Unchanged** existing Alien Lab design and established multiplayer avatars |
| `equa-nova.pilot-profiles.v1` | Optional saved pilot names, IDs and safe avatar snapshots; active pilot ID |
| `equa-nova.achievements.v1` | Separate per-pilot unlocks and progress, independent of runs |
| Original Sector / Drift / local match keys | **Unchanged**, including old saves |

A **Pilot ID is only a local reference**, not an account or proof of identity; names can repeat on different devices. Call `securePilotId()` only on a securely random-capable device (or pass 12 secure random bytes to `createPilotId`). `initialisePilotAchievements()` copies a valid existing Alien Lab avatar to a newly created first profile **without changing or deleting the original save**. Invalid legacy avatars are ignored and existing invalid profile/progress records are not silently overwritten.

`exportPilotAchievements` and `importPilotAchievements` produce a strictly validated portable JSON backup. `restorePilotAchievements` is an explicit *replacement*, not background syncing; the UI must present a user confirmation and recommend exporting the current progress first. All saving is local to the browser/device. Cross-device syncing, account identity and server-enforced cosmetic ownership do **not** exist yet.

## Pass B — next step

1. Illustrate all **40 distinct new parts/palettes** to the existing **320×360**, seven-layer, head/face/shoulder/hip anchor contract with safe SVG assets.
2. Expand the manifest and renderer **safely**, updating the strict client/server allowlist, presets, save validation, randomiser and compatibility tests while preserving all existing free choices and old avatars.
3. Add **locked/unlocked/preview** cards in Alien Lab, an Achievement Hangar page, progress text and a queued celebration view. Integrate the pilot chooser with a guest option; do not make login compulsory.
4. Do **not** issue unlocks from UI clicks yet. Verified gameplay adapters are Pass C (Sector and Drift) and Pass D (local and online). This separation prevents the new visuals from accidentally awarding things without evidence.

**Pass A release safety:** No new art or game mode code is modified. There is no Cloudflare Worker deployment for this pass.

## Pass B: Hangar and Alien Lab integration

The production manifest now lists 36 original fixed-viewBox SVG layers and four earned palettes in addition to the original free catalogue. Every reward ID is defined by the stable catalog; rewards never affect points or game rules.

- Mission Control links to `achievement-hangar.html`; Alien Lab has a Hangar shortcut. Mode tabs, completion, locked/earned filters, full condition text, cosmetic previews, and a device-local profile selector are available in Hangar.
- Create up to 12 local profiles; guest mode remains usable without permanent awards. Exports and explicitly confirmed imports use the versioned JSON backup API from Pass A.
- Alien Lab uses `ownsAlienOption` to identify free, earned and locked cards. Locked choices may be previewed without updating the canonical editor state, undo history, or saved avatar; the save button checks entitlements again. The randomiser selects from free and earned choices only.
- The Worker import of the approved manifest continues to validate fixed part and palette IDs, not arbitrary SVG, CSS or URLs.
- The old `equa-nova.alien.v1` save remains unchanged. Pilot identity and achievement progress are stored separately and may be switched at the Hangar.

**Important:** New achievements are not automatically awarded yet. Pass C adds Sector/Drift event adapters and Pass D handles per-seat local and server-confirmed online awards. Celebration can deep-link to `achievement-hangar.html?unlocked=S01` (or another earned ID) after gameplay is safely complete.

### Pass B verification

Run `npm run check` and all existing browser / artwork tests. New `tests/achievement-hangar-pass-b.test.js` checks manifest registration, original free options, and reward payloads. Keep legacy exhaustive geometric matching focused on the original free sample set; all 66 SVG layers are loaded and audited for basic canvas compatibility. Pass E remains the complete 320/390/768/1366px composition and accessibility review.

## Pass C: verified Sector Run and The Drift achievements

The browser game now imports `src/achievements/solo-adapter.js`. Sector Run and Drift share the 40-entry catalog without using the same local ownership: each **new run** captures the active named pilot from the Hangar. Guest runs have no permanent awards. A stored owner reference is scoped by mode and `progress.startedAt`; switching the active pilot after a run starts does not transfer its achievements. Loading a legacy pre-Pass-C run binds it once when it is resumed. A deleted pilot cannot keep receiving awards.

Events are emitted **after successful rules-engine state transitions**, never from animation frames, modal views, or a failed score submission:

| Mode | Event evidence | Conditions |
| --- | --- | --- |
| Sector | Validated scored move | S01, S03, S05, S06, S07 |
| Sector | Successful free single-tile swap | S04 |
| Sector | Successful sector clear and true invalid-attempt count | S02, S08, S09, S10 |
| Drift | Open real Zone Map and enter earned Salvage Bay | D01, D02 |
| Drift | Successful purchase, installed-system count | D03, D04, D08 |
| Drift | Successfully applied tile-changing gadget or consumed scoring boost after a valid score | D05, D09 |
| Drift | Successful sector clear with installed systems and actual boss-sector victory | D06, D07, D10 |

Each move/sector/purchase uses a deterministic receipt under the pilot's run scope. `awardForVerifiedEvent` prevents replayed receipts and `saveAchievementStore` writes only to the separate achievement key. An invalid or unwritable achievement store fails closed **without affecting the saved run or scoring**. No competitive online event can be manufactured by this adapter.

### Celebrations

`src/achievements/celebration.js` supplies original reward previews and named award badges. Scoring medals are queued until the tile-by-tile scoring ceremony has finished and are displayed on the ordinary score-result panel. The Zone Map and Salvage Bay show new awards in those existing screens. Free exchanges and successfully used tile gadgets use a dismissible, nonmodal notice, with reduced-motion support. The scoring sequence and gameplay remain fully usable for guest pilots. The game HUD states which saved pilot is the current run's achievement owner, with a Hangar link.

### Automated verification

- `tests/achievement-solo-pass-c.test.js`: scoped ownership, guest mode, switching, distinct receipts, the five-clean-sector challenge, all ten Drift rewards, and invalid-storage isolation.
- `tests/achievement-pass-c-browser.mjs`: real browser scoring, deferred medal reveal, saved-run ownership after a pilot switch, free exchange, Zone Map, and successful Salvage Bay purchase receipts.
- `npm run check`, the full existing Chromium regression suites, and the Cloudflare Worker dry-run remain required.

**Remaining:** Pass D binds each local seat to its own saved pilot and verifies online awards from authoritative server-confirmed outcomes. Pass E conducts the final responsive/cosmetic combination and quality audit.


## Pass D: Local and Online Multiplayer achievements

### Local — a named pilot in each hot seat

Local match setup now includes an **Achievements for** dropdown per player: each seat explicitly selects a different saved pilot or **Guest (no permanent progress)**. The existing alien selector and the player's displayed match name are independent of achievement ownership. A Pilot cannot be assigned to two seats in one match. At creation a separate, versioned \`equa-nova.achievements.local-owner.v1\` record stores the match scope, immutable seat assignments and matching roster/kit. The original local game save and rack privacy remain unchanged.

The following milestones emit only after verified game transitions:

- L01: the created local match starts (each selected owner independently).
- L02: that seat has actually pressed **Ready** at its private handover.
- L03–L05: a mathematically validated score, computed from the old board and new tiles before the handover. The winning seat alone earns the reward.
- L06: a successful free single-tile exchange by that seat.
- L07–L10: actual completed match standings, scored-move totals and winner status per seat. L10 requires three distinct match scopes.

Guests never earn permanent rewards. Old match saves without the owner sidecar continue playing with no automatic achievement attribution. If a pilot is deleted or a sidecar is malformed, the owner fails closed rather than guessing. The scoring celebration remains in the scorer's post-animation result; final-match awards are identified by seat/name only after private racks are hidden.

### Online — Worker-authored evidence, not browser scores

Online **Signal Clash** uses \`src/achievements/online-milestones.js\` within the shared, server-authoritative room rules. The Cloudflare Worker records at most 48 compact receipts per room, **only** when a join, lobby population, start, validated score or match finish succeeds. Rejected equations, fabricated rack tiles and duplicate action IDs never create receipts. Timed-out final matches also receive completion evidence.

A \`/state\` or action response returns a stable room instance ID and **only the authenticated seat's milestone receipts**. Tokens, private opponent racks and other seats' milestones never appear in the response. Receipt types support online achievements O01–O10, including two mathematical tile kits across different rooms (O08) and three completed wins in distinct rooms (O10).

On create/join, the browser binds that authenticated seat to the **currently active device-local pilot** and saves a separate \`equa-nova.achievements.online-owner.v1\` reference. It cannot be transferred by switching active profiles later. The client validates room and seat scope, deduplicates the verified receipts and keeps unlocks in the separate local achievement store. Reconnections replay the same evidence harmlessly. Older rooms without receipts remain playable, but award nothing; users should create a new room after deploying the updated Worker.

**Trust limitation:** Pilot names and unlock saves are device-local, not permanent online accounts. Only the Worker is authoritative for **game results**, not cross-device ownership of cosmetic saves. Local storage/backup files are not cryptographically protected against manual editing. True account-linked, tamper-resistant cross-device achievements would require authentication and a remote progress database.

### Deploy and verify

The site and the Cloudflare room Worker **both** need to be deployed from the same merged Pass D code. Merging only GitHub Pages will not update the Worker. Before inviting students, verify the Worker health endpoint, server-authenticated milestone responses and the browser's named-pilot label.

Run \`npm run check\`, \`tests/achievement-pass-d.test.js\`, \`tests/achievement-pass-d-local-browser.mjs\`, the enhanced \`tests/online-browser.mjs\` and \`tests/online-worker-runtime.mjs\` via the CI workflow. Also retest 390px phone layouts and local-private handovers. Pass E remains the full cross-combination and accessibility release audit.
