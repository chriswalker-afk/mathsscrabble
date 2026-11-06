# Pass E1 — Local multiplayer rulebook and quality checklist

This pass implements **one-device, 2–4 player hot-seat competition**. It does **not** yet implement online room codes or WebSocket matchmaking. Competitive rules deliberately do not include The Drift upgrades.

## Setting up

Choose **◈ MODE → LOCAL 2–4**, then configure 2–4 distinct player names and a turn timer: Off, 60, 90 or 120 seconds. Starting the match deals seven physical tiles to each player from one shuffled 151-tile bag. They all play on the same 13×13 board with the same premium squares and rigorous BIDMAS equation validator.

All three modes have **different random initial hands and a different draw order** each fresh game. Local Match, Sector Run and The Drift each remember only their own last starting pattern so back-to-back new games do not produce the same visible opening sequence. There is **no forced tutorial equation**, and neither the rack balancing nor the randomisation creates or duplicates a physical tile.

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
- New tiles are drawn from the single shared bag, bringing the player's hand up to seven when possible. Balancing chooses valid tiles from the shuffled bag, without revealing upcoming order.
- **Pass** voluntarily if the player cannot form an equation. No points are earned.
- **Swap** one or more rack tiles with the shared bag. A mixed rack's swap uses the turn. A rack with only numbers or only operators may use **one free rescue exchange per turn**, after which any further exchange costs the turn.
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
- The future online version will require **server-authoritative** validation rather than trusting local browser state.

## Classroom and automated checks

1. Start games with 2, 3 and 4 players. Check distinct racks of seven, 151 total physical tiles and genuinely different opening patterns on successive new games.
2. Verify the **handover** fully obscures the previous player's rack, cannot be bypassed via Tab, and does not start the timer until Ready.
3. Score an opening equation, confirm the points credit only the active player, and check that a second player can connect an equation to a locked tile.
4. Test a wrong BIDMAS equation. The player must be able to revise without consuming their turn or points.
5. Test drag-to-rack, rack rearranging, keyboard placements, unlimited equals and programmable wildcards in local play.
6. Test free all-number/all-operator exchanges, then a paid exchange, confirming the bag stays finite and other players' racks never change.
7. Refresh during an unfinished turn and during the scoring animation; ensure the current player sees a new handover and completed scoring cannot be awarded twice.
8. Try timers Off, 60, 90 and 120 seconds. Allow a timer to expire and check that unscored tiles return and a pass is recorded.
9. Complete a match by two full non-scoring rotations. Check the leftover-point penalties and final rankings, including ties.
10. Verify the board, rack, status and essential controls remain accessible at 1366×768, 1280×720, 768×1024 and 390×844 without horizontal overflow.

The Node suite verifies all player counts, drawing and ownership, passes, free/paid exchanges, timer transition logic, scoring, penalty calculations, corrupted saves and independent progress. The Chromium suite exercises three-player hot-seat handovers, scoring, mid-turn reload, two-rotation game end, random new matches, mode switching and small screens.

## Pass E2 — Online multiplayer

The next pass should reuse the pure rules module for 2–4 player rooms with **short room codes, host settings, private hands, connected player identities, server-validated moves, turn timers, reconnection and room expiry**. A room authority such as a Cloudflare Durable Object can sequence turns without allowing clients to see opponents' racks or manipulate authoritative scores. The local UI must not be treated as a substitute for server privacy or validation.
