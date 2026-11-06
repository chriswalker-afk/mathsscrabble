# Pass E1 — Local multiplayer rulebook and quality checklist

This pass implements **one-device, 2–4 player hot-seat competition**. This mode runs entirely in the browser; Online Rooms provides separate Cloudflare-hosted multiplayer. Competitive rules deliberately do not include The Drift upgrades.

## Setting up

From Mission Control open **LOCAL MATCH**, select Launchpad, Orbit, Nebula or Quantum, and configure 2–4 distinct player names and an optional 60-, 90- or 120-second timer (or Off). Launchpad and Orbit deal **eight physical tiles** per player (five numbers and three operators); Nebula and Quantum deal **eleven** (six numbers, three operators and a linked bracket pair). Nebula fractions are positive-only in new matches. Every kit uses one finite 151-tile supply and the same 13×13 board with exact BIDMAS validation.

All three modes have **different random initial hands and a different draw order** each fresh game. Local Match, Sector Run and The Drift each remember only their own last starting pattern so back-to-back new games do not produce the same visible opening sequence. There is **no forced tutorial equation**, and neither the rack balancing nor the randomisation creates or duplicates a physical tile.

## Pilot aliens (Pass B)

Each participant has their own **Alien Lab character**. During **LOCAL MATCH** setup, choose an alien for each player using a Bloop/Orbit/Niblet/Glimmer preset, a random combination, or **USE SAVED**. For a custom look, open **CREATE A CUSTOM ALIEN IN ALIEN LAB** in a separate tab, assemble and save the alien, return to the local setup, then press USE SAVED for that participant. Players can share one device and still have different looks.

The creature is visible at **hot-seat handovers**, on each active turn's **scoreboard**, and next to the player's name in the **final podium**. Handovers remain private: only the incoming player's avatar and name are shown on the overlay, not their tiles. The save format permits historical matches without avatars and assigns them a stable default; it rejects tampered profile IDs. All avatar choices are cosmetic: the 151-tile bag, scoring, equations, timers and racks remain unchanged.

## Private turn handover

- After match setup, after every scored turn, and after every paid swap or pass, the current rack **disappears** and a full-screen handover names the next player.
- The next player must explicitly press **I'M READY · REVEAL MY TILES**. The overlay blocks mouse access and makes the underlying app inert for keyboard and screen-reader users while the handover is active.
- If a player refreshes their browser mid-turn, the current player is brought back to this handover screen, with any unscored placements preserved and the timer paused. After pressing Ready they resume their own rack and unfinished equation.
- The timer starts only on Ready. When it runs out, unscored placements are cancelled without consuming physical tiles, and the turn counts as a pass.
- The currently playing person's rack, the shared board, and the other players' **scores** are visible during a turn; the other players' rack contents are never shown.

These are practical privacy controls for passing one shared device. Because there is no online account, this version does **not** claim protection from someone inspecting browser storage using developer tools.

## Turn rules

- **Score** one mathematically true, connected equation each turn. The first equation must cross the centre; later equations must connect to a previously locked tile. The existing exact BIDMAS parser is unchanged. `3=3` and other identity-only statements are invalid.
- The player receives the complete tile, multiplier, length, connection and full-rack bonuses **on their own score**. The satisfying per-tile energy animation works here too, including SKIP and reduced motion. Scoring is committed atomically to the match before the animation begins.
- New tiles are drawn from separate number and operator supply pools, restoring five numbers (six in Nebula/Quantum), three operators and any linked bracket pair when supplies permit. No physical tiles are created, and the next draw order remains hidden.
- **Pass** voluntarily if the player cannot form an equation. No points are earned.
- **Swap** one or more rack tiles with the shared bag. Swapping **exactly one tile is free once per turn**, irrespective of the rack composition. Swapping several tiles or swapping again uses the turn. Each replacement comes from its original supply pool. A bracket pair is selected/exchanged as one two-piece set, uses the turn, and requires a complete replacement pair in the bag.
- Pending placements must be cleared before passing or swapping. There are no Drift shop upgrades or boss effects in competitive play.

## End of match and final scoring

A match ends when either:

1. A player scores an equation that empties their rack after the bag has run out.
2. There have been **two full rotations** (`2 × number of players` consecutive turns) of passes, paid swaps or timeouts without a valid scored equation.

The second rule prevents endless stalled play. Free exchanges do not advance the turn or count towards those rotations; each player can only take one free exchange in that turn.

At the end:

```
Final net score = total equation points − sum of leftover physical rack tile points
```

Wildcards have zero physical tile points even when programmed to represent a more valuable value. The equals sign is unlimited, free and absent from the bag. **The highest net score wins**, even if another player was the first to empty a rack. Tied highest net scores share first place. The match report displays gross equation score, rack penalty and final net score for every player.

## Saving and fairness

- The local match is saved at `equa-nova.local-match.v1`; existing solo saves are untouched.
- Each physical tile has one unique ID. The shared board, all players' racks and the remaining bag always total **151 physical tiles**, with no duplicates.
- The saved match is checked for consistent names, player order, current turn, rack ownership, finite supply, history and final scores before being restored.
- Scores, private handovers and completed-game states survive refresh. A new match replaces only the local match, not Solo or Drift runs.
- Online Rooms now uses the same kits with **server-authoritative** tile, bracket, turn and score validation rather than trusting browser state.

## Classroom and automated checks

1. Start games with 2, 3 and 4 players. Check distinct racks of eight (Launchpad/Orbit) or eleven (Nebula/Quantum), 151 total physical tiles and genuinely different opening patterns on successive new games.
2. Verify the **handover** fully obscures the previous player's rack, cannot be bypassed via Tab, and does not start the timer until Ready.
3. Score an opening equation, confirm the points credit only the active player, and check that a second player can connect an equation to a locked tile.
4. Test a wrong BIDMAS equation. The player must be able to revise without consuming their turn or points.
5. Test drag-to-rack, rack rearranging, keyboard placements, unlimited equals and programmable wildcards in local play.
6. Test one free single-tile exchange, then a paid second or multi-tile exchange, confirming the bag stays finite and other players' racks never change.
7. Refresh during an unfinished turn and during the scoring animation; ensure the current player sees a new handover and completed scoring cannot be awarded twice.
8. Try timers Off, 60, 90 and 120 seconds. Allow a timer to expire and check that unscored tiles return and a pass is recorded.
9. Complete a match by two full non-scoring rotations. Check the leftover-point penalties and final rankings, including ties.
10. Verify the board, rack, status and essential controls remain accessible at 1366×768, 1280×720, 768×1024 and 390×844 without horizontal overflow.

The Node suite verifies all player counts, drawing and ownership, passes, free/paid exchanges, timer transition logic, scoring, penalty calculations, corrupted saves and independent progress. The Chromium suite exercises three-player hot-seat handovers, scoring, mid-turn reload, two-rotation game end, random new matches, mode switching and small screens.

## Online Rooms

Online Signal Clash has been implemented separately with a Cloudflare Durable Object authority, short room codes, private racks, authenticated player profiles and server-validated turns. The local hot-seat privacy overlay is not a substitute for online server validation. See [ONLINE_MULTIPLAYER.md](ONLINE_MULTIPLAYER.md) for deployment, avatar identity and live testing.
