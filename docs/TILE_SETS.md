# Four mathematical tile kits and multiplayer compatibility

The same four physical tile kits are available in **Sector Run**, **The Drift**, **Local Match** and **Online Rooms**. Select a kit on Mission Control. Sector Run and The Drift also provide an in-game kit menu; Local Match has a kit selector during match setup; the Online Rooms **host** selects a kit when creating the room. All other online pilots see the host's choice in the lobby.

| Kit | Number tiles | Operations | Private rack |
| --- | --- | --- | --- |
| **01 · Launchpad — Natural Numbers** | Digits 0–9; adjacent digits may concatenate | +, −, ×, ÷ | **8:** 5 numbers + 3 operators |
| **02 · Orbit — Integers** | Positive digits and atomic negative integers (such as −3) | +, −, ×, ÷ | **8:** 5 numbers + 3 operators |
| **03 · Nebula — Rational Numbers** | Positive digits and **positive-only** atomic fractions such as 1/2, 3/4, 3/2 | +, −, ×, ÷ and a matched ( ) pair | **11:** 6 numbers + 3 operators + 2 brackets |
| **04 · Quantum — Advanced Operations** | Integers and signed rational fractions | +, −, ×, ÷, ^, √, ! and a matched ( ) pair | **11:** 6 numbers + 3 operators + 2 brackets |

Examples: Launchpad **8 + 4 = 12**; Orbit **−3 + 7 = 4**; Nebula **(1/2 + 1/2) × 2 = 2**; Quantum **√9 + 3! = 9**.

## Physical supply, brackets and fair drawing

Every kit has **151 uniquely identified physical tiles**, including its finite number, operator, wildcard and (where applicable) bracket pools. The unlimited free equals sign never consumes a physical tile. Nebula now uses **28 positive fraction pieces** (four copies of each of seven positive fractions), with no negative fraction tiles in **new games**. The only Nebula fraction faces are **1/2, 1/4, 3/4, 5/4, 3/2, 1/3, and 2/3**. Quantum retains signed fractions. Both advanced kits draw an extra **sixth number tile** to improve playability, while retaining all three operators and one complete bracket pair.

Brackets have eight linked pair IDs per supply. Each new ( and ) pair must be played together in a single scored equation. A single half cannot be submitted or individually exchanged. In multiplayer, selecting one bracket half for an exchange automatically selects both. Exchanging the two-piece pair **uses the turn** and requires another complete pair to be available in the shared bag. Scored pairs remain on the board and may be crossed in subsequent equations. A depleted bracket pool never generates counterfeit or unmatched halves.

Every local and online player uses their own rack, drawing from **one shared** physical bag. Only the current player's rack is revealed. The Drift's Rack Extension Ship System adds one more number tile: **9 tiles** in Launchpad/Orbit and **12 tiles** in Nebula/Quantum.

## Exact mathematical checking

All four modes use the same exact rational BigInt expression engine, with the same 19 × 19 board and premium squares. Numbers on fraction or negative tiles are single atomic tokens; regular adjacent digit tiles can still form multi-digit numbers. One genuine calculation is required; simple identities are not scoreable.

BIDMAS follows brackets, powers/roots/factorials, multiplication/division, then addition/subtraction. Powers are right-associative, with integer exponents from −8 through 8; exact rational square roots are allowed, but irrational approximations are not. Factorial applies to integers 0 through 8. Division by zero, invalid expressions, mismatched brackets, implicit multiplication and false equalities are rejected without charging a turn.

## Multiplayer rules and privacy

- **Local Match:** choose the kit before starting a 2–4 player hot-seat match. Players retain private racks, timers, passing, one free *single-piece* exchange per turn, shared scoring and net-score rack penalties. Choosing a different kit for an existing saved match requires explicitly starting a new one.
- **Online Rooms:** the host selects the kit at room creation. The kit is stored in the Cloudflare Durable Object and cannot be changed by guests or by subsequent turns. The server creates and owns the physical supply and validates all placements, exact tile values/points, rack ownership, bracket exchanges, scores, deadlines and room revisions. Each authenticated snapshot contains only that pilot's private tiles. The lobby advertises the shared kit to every pilot.
- **Backwards compatibility:** an older local save or online room without a stored kit continues as Launchpad. Existing saved Nebula solo games may still include previously dealt fractions outside this new seven-value selection (including older negative fractions), rather than silently rewriting a student's completed equations. **Start a new game** to use the positive-only Nebula distribution and the larger starting rack.

**Deployment is important:** publishing the GitHub Pages front end does not publish the room Worker. After merging this change, deploy the updated **equanova-rooms** Worker at rooms.mrwalkermaths.com from the merged commit. Until then, an older Worker may not understand the kit setting; the new frontend warns instead of silently starting a non-Launchpad room with the wrong tiles. See [Online Rooms deployment](ONLINE_MULTIPLAYER.md).

## Quality checks

Automated tests cover 151-tile conservation and uniqueness; all four kits with 2, 3 and 4 pilots; positive-only Nebula fractions; 8- or 11-piece starting racks; complete bracket pairs; paid pair exchange; false-equation rejection; exact rational validation and scoring; saved Local Match integrity; online room kit persistence; private hands and server-side anti-forgery checks. Existing solo, Drift, Alien Lab and Cloudflare Durable Object runtime tests remain active.
