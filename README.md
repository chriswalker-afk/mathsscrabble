# EQUA//NOVA — Maths Scrabble

A **playable single-player prototype** of a sci-fi equation-building board game. Students build mathematically correct equations, guided by **BIDMAS**, and score by using numbered/operator tiles, premium squares, and equation length.

## Play

Serve the project root using a static web server:

```bash
python3 -m http.server 4173
```

Open http://localhost:4173. The project has no install/build step.

Drag tiles to the 13 × 13 board, or click a tile and then click its destination. Select the green **=** tile as often as required. The first complete horizontal/vertical equation must cross the centre. Later equations must share an already-scored tile. Click **Score Equation** to validate and score a move.

- 7 physical tiles per hand; the equals sign is free and unlimited.
- New tiles must lie on one row/column and complete one connected equation.
- A mathematical parser implements BIDMAS and exact rational arithmetic (currently exposed through whole-number tiles).
- Double/triple tile and equation squares are applied only when a *new non-equals tile* lands on them.
- Length bonus: +3 per square beyond 5. Playing all 7 physical rack tiles gives +20.
- Exchanging one or more rack tiles uses a turn; rack replenishes from a shuffled bag after scoring.
- Six-turn escalating single-player sectors; a freshly generated board and bag each round.

## Scope and planned work

This is an initial **Origin** (non-negative integer digits, +, −, ×, ÷) **Sector Run** test build. Brackets, signed/fraction tiles, the roguelike shop, remote multiplayer, room codes, reusable Critter Lab avatar art, audio, achievements, and persistent saves are not yet implemented. The illustrative pilot emblem is a placeholder.

**Rule prototype note:** A single submitted complete equation scores each turn. Unrelated adjacent perpendicular fragments are not checked, and this should be playtested before locking the full game rules.

## Tests

```bash
npm test
```

The test suite exercises BIDMAS, multi-digit parsing, invalid and zero-division equations, first-move positioning, intersections, connectivity and scoring. CI runs tests on pushes and pull requests.

## Hosting

The site consists of static files and is compatible with GitHub Pages served from the repository root. GitHub Pages must be enabled separately in repository Settings → Pages; deploying the branch does not automatically publish the website.
