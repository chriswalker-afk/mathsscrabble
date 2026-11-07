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
