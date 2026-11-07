# Alien Radio and private rack planning · Signal Clash

## Student behaviour

Each player can select a fixed non-verbal Alien Radio transmission (alien-language glyphs or playful illustrations). The player’s chosen alien avatar appears to speak the callout on **every connected device**: a bubble next to the avatar in desktop standings, or a compact avatar-and-bubble overlay on phones. Messages carry **no mathematical/gameplay meaning**. There is no free-text chat or score change.

The rules enforce **one transmission per authenticated player in each global turn**, even when it is another player's turn. The button stays available to view the gallery or recent transmissions after sending, but choices are disabled until the shared turn changes. Messages use the same live WebSocket revision updates as board moves (with polling fallback). A short-lived announcement includes the sender's name for assistive technology. The visual bubble fades when it is no longer recent and respects reduced-motion settings.

All players can drag to rearrange their own racks and place, move, return, or undo tentative tiles on **their private board view** while waiting. They can inspect the usual equation feedback and score preview. These draft placements are client-only: they never reach the room server until that player's turn and a deliberate **Score** submission. Pass and Swap remain turn-locked. After another player scores, only conflicting draft squares or no-longer-owned tiles are returned, with a warning; all other tentative placements survive.

## Radio catalogue and achievements

Eight transmissions are immediately free: Zib Zorb, Wobbly Planet, Tiny Flying Saucer, Bubble Cloud, Glorp Glorp, Space Octopus, Stardust, and Bleep Bloop. Three extras live in the Achievement Hangar:

| Badge | Earn condition | Callout |
| --- | --- | --- |
| O11 · First Contact (easy) | Send 1 accepted transmission | Galactic Squid 🦑 |
| O12 · Radio Regular (moderate) | Send 3 transmissions on different turns in one Signal Clash room | Floating Jelly 🪼 |
| O13 · Deep Space Broadcaster (hard) | Send 8 transmissions on different turns in one Signal Clash room | Cosmic Rainbow 🌈 |

This adds three **cosmetic** online badges, for **43 total** across the game (40 original avatar-part unlocks preserved). New badges use the same bounded event receipts and local pilot backup/restore as existing achievements. They do not grant stronger tiles, special turns, points, or matchmaking advantages.

**Identity limit:** The room server enforces fixed IDs and the per-turn rate limit but does not authenticate a saved pilot's long-term achievements: those are stored on the player's device, not in a cross-device account. Thus the unlocked-cosmetic picker relies on device-local entitlements; the Worker cannot independently prove a bonus glyph is owned. This is equivalent to the existing Alien Lab cosmetics model.

## Server contract and deployment

`POST /api/rooms/:code/callout` requires a bearer token and a JSON object:

```json
{"id":"unique-client-action-id","revision":123,"calloutId":"zib"}
```

The Durable Object serially validates the authenticated room seat, a whitelisted catalogue ID, room phase, per-seat per-turn quota, revision and request-ID replay; the server returns an updated filtered per-seat snapshot plus a cosmetic event. Only `id`, `by`, `calloutId`, `turn` and `at` appear in the shared last-16 callout history. Other players' racks, tokens, saved pilot data and score state stay private. `gameplayRevision` tracks the last game action; cosmetic-only revisions do not invalidate in-flight but otherwise-current score/pass/exchange submissions.

**Deploy the GitHub client and Cloudflare room Worker from the same merged commit.** Deploying only the website will leave `/callout` unavailable. The Worker change is additive to the SQLite Durable Object stored room and preserves old rooms with no callout fields (with empty/default radio history).

Test coverage includes `tests/online-callouts.test.js`, the two-device mocked `tests/online-browser.mjs`, actual Cloudflare `tests/online-worker-runtime.mjs`, achievement catalogue/engine/store tests, and existing release/browser tests. After merge and worker deploy, smoke-test two separate phones and a laptop, including stale draft reconciliation, one-per-turn blocking and avatar identity.
