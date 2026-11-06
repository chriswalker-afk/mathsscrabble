# Sector Run — balancing and classroom QA guide

This is a **working calibration**, not a claim of completed student testing. Pass C improves the default playability of the solo game. The targets should be adjusted after watching actual students play.

## First principles

- **Mathematics before points.** The engine checks whole equations with BIDMAS. A submitted equation must contain a genuine binary operation; `3=3` is invalid. Students still have to decide whether the equation balances. The planning preview only estimates score and structural validity.
- **A balanced hand is a chance, not a solution.** When the bag permits, drawing completes a seven-tile rack with at least four number-capable tiles, one operation-capable tile, and one wildcard. A wildcard may satisfy multiple roles. Previously held tiles never disappear or change.
- **The bag remains finite.** Rebalancing searches through the remaining shuffled bag and removes each drawn physical tile exactly once; it does not duplicate, fabricate or magically replace an unwanted rack tile. Blank-number, blank-operation and blank-any tiles remain worth zero points.
- **Relief from impossible draws.** An all-number or all-operator rack has the existing free exchange. Mixed-rack exchanges still cost one turn.
- **The board matters.** Connecting to an existing locked tile gives five bonus points and creating a valid calculation gives five points. Premium multiplier squares and length bonuses provide a second way to improve a modest hand. Board tile points are visible in the rack, tooltips and score report, but **not overlaid on symbols** in the grid.

## Sector pacing

| Sector | Energy target | Average energy needed over six turns |
|---|---:|---:|
| 1 | 40 | 6.7 |
| 2 | 55 | 9.2 |
| 3 | 70 | 11.7 |
| 4 | 90 | 15 |
| 5 | 110 | 18.3 |
| 6 | 135 | 22.5 |
| 7 | 160 | 26.7 |
| 8 | 190 | 31.7 |

Beyond sector 8 the target grows by about 18% each sector. These averages **are not per-turn minimums**: a player can clear the target early with a high-scoring equation.

## Early playtest protocol

1. Ask students to build a correct opening equation using both taps and drag-and-drop. Record how long they take, whether they notice the free equals sign, and whether the wildcard selector is immediately understandable.
2. Let students attempt at least two connected equations. Record whether they understand how a pre-existing tile joins the new expression and whether they use premium squares deliberately.
3. Watch for unproductive all-number, all-operation, or mixed-but-unusable racks. Note how often students exchange tiles and whether they recognise the free exchange.
4. At each sector completion, record total points, turns, equations, invalid attempts and exchanges from the report. Avoid relying only on whether they beat the target.
5. Ask whether every symbol on the enlarged 13×13 board is readable on an ordinary school laptop (1366×768, 1280×720), portrait tablet and phone. Confirm that board tile points no longer obscure mathematical notation.
6. Reload mid-move and immediately after submitting an equation, then confirm rack order, pending tiles, score, turn and completed-sector history are intact.

### Signals that warrant adjustment

- **Too hard:** Several students repeatedly spend six turns without a single complete equation, or must spend multiple paid exchanges to create their first expression. Check the tile-bag composition and whether the opening tutorial needs a better example before simply reducing targets.
- **Too easy:** Students routinely meet a sector target in one trivial short equation with no deliberate use of the grid. Check if crossing and fixed-equation bonuses are disproportionate.
- **Scoring confusion:** Students cannot explain why a move was worth its displayed points. Inspect the breakdown and clarify which newly placed tile activated which square; do not hide the rules.
- **Interaction friction:** Students repeatedly misplace tiles, abandon drags, or overlook that they can reorder their rack. Check pointer hit areas and the strength of the landing preview.

## Automated checks

The Node test suite checks hundreds of shuffled bags, total physical tile conservation, balanced seven-tile draws, exact BIDMAS checking, free exchanges, and validated local saves. The Chromium smoke test covers a first play, wrong-answer correction, wildcard programming, scoring, drag and keyboard interaction, reload with an unfinished equation, refresh during scoring, completed-sector restoration, and the board/rack fit at multiple screen sizes. These are **software checks**, not a substitute for classroom usability tests.

## Local save scope

Progress uses browser `localStorage`. It includes the locked board, pending placements, rack order, remaining bag, sector state, score, move reports and completed sectors. Reloading the same browser resumes that state. Browser privacy modes or clearing site data may prevent the restore; this version does not sync across devices.

## Next build

**Pass D — Roguelike:** Salvage Bay shop between sectors, tile and board upgrades, run-specific abilities, and sector anomalies with explicit balancing safeguards. Build on the deterministic equation and solo-state modules; keep the core BIDMAS validation independent of upgrades.
