# EQUA//NOVA — Maths Scrabble

A **playable single-player prototype** of a sci-fi equation-building board game. Students build mathematically correct equations, guided by **BIDMAS**, and score by using numbered/operator tiles, premium squares, and equation length.

## Play

Serve the project root using a static web server:

```bash
python3 -m http.server 4173
```

Open http://localhost:4173. The project has no install/build step.

Drag tiles to the 13 × 13 board with a mouse, finger or pen; or click/tap a tile and then its destination. Drag an unscored tile to move it, **or drag it back to the rack to remove it**. Drag rack tiles left or right to reorder them without using a turn, or tap them to select a destination. A separate **Undo Tile** button reverts the most recent placement, and **Clear Placement** returns all unscored tiles to the rack. Select the green **=** tile as often as required. The first complete horizontal/vertical equation must cross the centre. Later equations must share an already-scored tile. Click **Score Equation** to validate and score a move.

- 7 physical tiles per hand; the equals sign is free and unlimited.
- New tiles must lie on one row/column and complete one connected equation.
- A mathematical parser implements BIDMAS and exact rational arithmetic (currently exposed through whole-number tiles). Pure identities such as `3=3` are disallowed: at least one actual calculation must appear.
- Double/triple tile and equation squares are applied only when a *new non-equals tile* lands on them.
- Length bonus: +3 per square beyond 5. Every completed valid calculation earns +5 and every connected equation earns another +5. Playing all 7 physical rack tiles gives +20.
- Exchanging one or more rack tiles normally uses a turn. A rack of **only numbers** or **only operators** qualifies for a free exchange (no turn consumed). **Pass C balances freshly drawn tiles** (without removing tiles you kept): where the bag permits, a complete rack offers at least four number-capable tiles, an operator-capable tile and a wildcard.
- Three wildcard types are available: **#** (digit 0–9), **◇** (+, −, × or ÷), and **✦** (any digit or basic operator). Choose the wildcard value on placement; its tile value is always zero points.
- Six-turn escalating single-player sectors. Targets begin at **40, 55, 70, 90, 110, 135, 160 and 190**, then grow gradually. A fresh board and bag start each sector; the run's cleared sectors and lifetime energy continue across them.
- The equation readout is **in the right-hand command console**, not underneath the board. A live placement preview shows the expression, gaps/alignment issues and *potential* points. The calculation is **not evaluated** until submission, so this does not give away the answer.
- **Pass C autosave:** the board, rack order, tile bag, pending placements (including programmed blanks), sector/turn/energy, scoring history and accumulated run progress are saved locally after each meaningful action. Reloading resumes the run. A success/failure report survives reload, and scoring is saved **before** the animation. **New Run** asks for confirmation before replacing a saved game.
- Keyboard controls: 1–7 select an available rack tile, = selects an unlimited equals sign, arrows move board focus, Enter places or picks up, Backspace undoes the most recent tile, and Escape deselects.
- Responsive board sizing keeps the larger board, physical rack and primary controls visible together on standard laptop screens. On portrait phones secondary panels may sit below the play area.
- First-time players see a short three-step guide. The left-hand panel provides context-sensitive placement tips, remaining-points-per-turn guidance, the last three scored equations, and a **Run Summary** button. Sector reports include a progress bar, best move, equations scored, turns used, exchanges and a per-turn record.

## Scope and planned work

This is an initial **Origin** (non-negative integer digits, +, −, ×, ÷) **Sector Run** test build. Brackets, signed/fraction tiles, the roguelike shop, remote multiplayer, room codes, reusable Critter Lab avatar art, audio, achievements, and persistent saves are not yet implemented. The illustrative pilot emblem is a placeholder.

**Rule prototype note:** A single submitted complete equation scores each turn. Unrelated adjacent perpendicular fragments are not checked, and this should be playtested before locking the full game rules.

## Tests

```bash
npm run check
```

The test suite exercises BIDMAS, non-trivial equations, intersections, scoring, wildcards, free swaps and rack reordering. **Pass C also tests hundreds of shuffled rack draws, save corruption/duplicate tile protection, programmed wildcard restoration, report deduplication, storage failures and victory/defeat resume.** It also syntax-checks the browser modules. GitHub Actions runs these checks on pushes and pull requests.

The Chromium smoke tests cover true and false equations, wildcard programming, mouse/touch dragging, rack-to-board and board-to-rack movement, reorder/undo, keyboard navigation, first-visit onboarding, pending-move restoration, an interrupted scoring animation, victory resume, sector continuation, corrupted-save recovery and responsive laptop/mobile geometry. The separate Chromium CI job runs `node tests/browser-smoke.mjs` against a local static server and uploads diagnostic screenshots.

## Suggested classroom playtest

Try a first equation such as **8 + 4 = 12** crossing the centre. Before scoring, deliberately use **13** to check that the game rejects a mathematically false equation only when you submit it. Verify the Double Tile score calculation. Then build a perpendicular equation reusing the 8, use drag and tap methods, replace and undo a tile, and try exchanging a few tiles. Check the board and seven-tile rack on a 1366 × 768 laptop and a touchscreen.

**Pass C — Core solo gameplay** adds balanced rack replenishment, autosave/restore, sector reports, persistent cumulative run progress, a first-visit guide and contextual hints. The target curve is a prototype calibration; before locking the difficulty, collect classroom playtest observations as described in [docs/SOLO_BALANCE.md](docs/SOLO_BALANCE.md).

**Next planned pass: D — Roguelike sector progression.** Add between-sector shop/upgrades, richer anomalies and run-specific decisions without changing the validated BIDMAS engine. The existing six-turn Sector Run is an initial version to be developed further.

## Saved games and privacy

Saving uses only this browser's `localStorage` (key `equa-nova.sector-run.v1`). No server account, external data service or login is involved. The small `AUTOSAVED` indicator is visible on desktop. If storage is blocked, the game still works in the current tab but **progress will not survive a reload**. Clearing browser site data or switching devices removes access to the saved game. Every new run overwrites the previous local saved run after confirmation.

## Hosting

The site consists of static files and is compatible with GitHub Pages served from the repository root. GitHub Pages must be enabled separately in repository Settings → Pages; deploying the branch does not automatically publish the website.
