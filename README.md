# EQUA//NOVA — Maths Scrabble

A **playable single-player prototype** of a sci-fi equation-building board game. Students build mathematically correct equations, guided by **BIDMAS**, and score by using numbered/operator tiles, premium squares, and equation length.

## Play

Serve the project root using a static web server:

```bash
python3 -m http.server 4173
```

Open http://localhost:4173. The project has no install/build step.

Drag tiles to the 13 × 13 board with a mouse, finger or pen; or click/tap a tile and then its destination. Drag an unscored tile to move it, or tap it to pick it up. A separate **Undo Tile** button reverts the most recent placement, and **Clear Placement** returns all unscored tiles to the rack. Select the green **=** tile as often as required. The first complete horizontal/vertical equation must cross the centre. Later equations must share an already-scored tile. Click **Score Equation** to validate and score a move.

- 7 physical tiles per hand; the equals sign is free and unlimited.
- New tiles must lie on one row/column and complete one connected equation.
- A mathematical parser implements BIDMAS and exact rational arithmetic (currently exposed through whole-number tiles).
- Double/triple tile and equation squares are applied only when a *new non-equals tile* lands on them.
- Length bonus: +3 per square beyond 5. Playing all 7 physical rack tiles gives +20.
- Exchanging one or more rack tiles uses a turn; rack replenishes from a shuffled bag after scoring.
- Six-turn escalating single-player sectors; a freshly generated board and bag each round.
- A live placement preview shows the assembled mathematical expression, any gaps/alignment issues, and *potential* points. The calculation is **not evaluated** until the player presses **Score Equation**, so this does not give away the answer.
- Keyboard controls: 1–7 select an available rack tile, = selects an unlimited equals sign, arrows move board focus, Enter places or picks up, Backspace undoes the most recent tile, and Escape deselects.
- Responsive board sizing keeps the board, preview and rack visible together on standard laptop screens. On portrait phones secondary panels may sit below the play area.

## Scope and planned work

This is an initial **Origin** (non-negative integer digits, +, −, ×, ÷) **Sector Run** test build. Brackets, signed/fraction tiles, the roguelike shop, remote multiplayer, room codes, reusable Critter Lab avatar art, audio, achievements, and persistent saves are not yet implemented. The illustrative pilot emblem is a placeholder.

**Rule prototype note:** A single submitted complete equation scores each turn. Unrelated adjacent perpendicular fragments are not checked, and this should be playtested before locking the full game rules.

## Tests

```bash
npm run check
```

The test suite exercises BIDMAS, multi-digit parsing, invalid and zero-division equations, first-move positioning, intersections, connectivity, scoring and non-spoiling previews. It also syntax-checks the browser modules. GitHub Actions runs these checks on pushes and pull requests.

Pass B adds real-browser smoke tests for turn submission, wrong-equation correction, physical mouse/touch dragging, tile undo, keyboard grid navigation and responsive laptop/mobile geometry. The separate Chromium CI job runs `node tests/browser-smoke.mjs` against a local static server and uploads diagnostic screenshots.

## Suggested classroom playtest

Try a first equation such as **8 + 4 = 12** crossing the centre. Before scoring, deliberately use **13** to check that the game rejects a mathematically false equation only when you submit it. Verify the Double Tile score calculation. Then build a perpendicular equation reusing the 8, use drag and tap methods, replace and undo a tile, and try exchanging a few tiles. Check the board and seven-tile rack on a 1366 × 768 laptop and a touchscreen.

The next planned pass is **C — Core solo gameplay**: improve the bag and rack balance, progression and sector goals, saving/continuing runs, and the classroom onboarding experience. The existing six-turn Sector Run is an initial version to be developed further.

## Hosting

The site consists of static files and is compatible with GitHub Pages served from the repository root. GitHub Pages must be enabled separately in repository Settings → Pages; deploying the branch does not automatically publish the website.
