# The Drift — illustrated equipment, Salvage Bay and playtesting guide

The Drift is a self-contained, single-device roguelike, distinct from Sector Run, Local Match and Online Rooms. All actions remain client-side and do not send Worker requests. Equipment lasts until used or the current run ends; a failed sector ends the run and resets Flux and equipment.

## The loadout (Pass F)

**Permanent equipment:** four large illustrated slots in the existing *left-side Mission Telemetry* panel; these items remain installed through the run. The playing board now uses 19×19 squares, with a fixed-size zoomable, scrollable viewport so its footprint in the layout stays compact. Existing saved 13×13 layouts are centred in the new grid. Each slot can be inspected by mouse or keyboard; its tooltip and details show the complete rule. A legacy saved run with more than four upgrades can finish, but cannot install another.

**Temporary power-ups:** two independent illustrated slots in the *right-side Command Console*. Tap or select a score booster to **arm** it for the next correctly scored equation, or select a tile tool and tap a physical tile in your rack. A tile tool is only consumed if a matching physical replacement exists in the finite bag. None of these transformations spends a turn. A rejected mathematical equation does not consume a score booster. Existing older saves with multiple Pulse Capacitors can be resumed.

**Slot counts:** strictly four purchases of permanent modules and two held temporaries. Purchased upgrades are nonrefundable; duplicates of permanent equipment are disallowed. Temporary powers can be purchased again after use.

## Permanent module catalog

Category tags are shown prominently in the Salvage Bay; board-space, tile-type and equation-length improvements deliberately belong to separate categories.

| Category | Module | Cost | Effect |
|---|---|---:|---|
| Tile type | Ionised Sevens | 4 | New physical 7 adds 3 base tile points; tile multipliers apply |
| Tile type | Operator Core | 5 | New physical × or ÷ adds 3 base points; tile multipliers apply |
| Tile type | Oddity Coil | 5 | New physical odd digit adds 2 base points |
| Board space | Amplifier Array | 7 | Newly played 2T squares act as 3T |
| Board space | Second Spark | 7 | Once per premium cell each sector, crossing a locked premium tile reactivates its tile/equation multiplier |
| Board space | Core Igniter | 5 | +6 energy on the sector's first correctly scored equation |
| Length bonus | Longwave Coil | 5 | +7 energy when equation spans 7+ squares |
| Length bonus | Echo Generator | 6 | +2 per newly placed physical tile after the fourth |
| Length bonus | Stretch Matrix | 6 | +2 per equation square beyond the fifth, in addition to base length scoring |
| Economy | Flux Recycler | 7 | +3 Flux on each successful sector completion |
| Economy | Precision Dividend | 5 | +2 Flux per successfully scored move using no new wildcards |
| Economy | Premium Prospect | 6 | +1 Flux for each premium square newly activated during a valid scored move |
| Rack | Wildcard Beacon | 6 | Favour at least 2 wildcard tiles when drawing, subject to supply |
| Rack | Operator Reserve | 5 | Favour × and ÷ among operator draws when available |
| Rack | Rack Extension | 8 | Drift rack becomes **6 number-kind + 3 operator-kind = 9 tiles** |
| Tactics | Exchange License | 6 | A second **separate free single-tile swap** per turn; no multi-tile swap is free |
| Tactics | Time Dilator | 8 | A seventh turn is available in each Drift sector |
| Connection | Crosslink Circuit | 5 | +5 flat energy for equations connecting to an existing locked tile |
| Defence | Leak Shield | 7 | Negate the 15% energy penalty of Power Leak on affected sectors |

A physical wildcard is still worth zero tile points regardless of its chosen face. Length, crossing, Core Igniter and Pulse bonuses are flat energy; scoring tiles and their boosts are multiplied by applicable board bonuses.

## Temporary power-ups

| Type | Power | Cost | Activation |
|---|---|---:|---|
| Score boost | Pulse Capacitor | 3 | +12 flat energy to the next correctly scored equation |
| Score boost | Double Reactor | 7 | Double the next equation's final energy total |
| Score boost | Power Surge | 5 | Add 50% of the next equation's final energy, rounded down |
| Tile swap | Step Up | 3 | Select a physical digit 0–8; trade it for that digit +1 in the number bag |
| Tile swap | Step Down | 3 | Select a physical digit 1–9; trade it for that digit −1 in the number bag |
| Tile swap | Operator Shift | 3 | Select an operator; swap + ↔ × or − ↔ ÷ using the operator bag |
| Tile swap | Wildcard Hunt | 5 | Replace one selected rack tile with an available wildcard **from the same bag** |
| Tile swap | Recycle Tile | 2 | Replace one rack tile with a different physical tile from its original bag |

**Conservation:** Tile powers always exchange a physical tile with a tile in the relevant bag. They never invent or duplicate a tile or change its points/ID. If the desired replacement has run out, nothing is consumed. A score booster is applied only on successful mathematical validation, and the committed score is saved before the animation begins. The scoring ceremony includes the temporary final-score multiplier as a separate stage so its total equals the authoritative score.

The legacy Pulse Capacitor's automatic next-equation activation remains supported; tap a different stored score booster to choose which effect should fire first.

## Salvage Bay shop

The game first opens an **after-action results screen**, not the shop: it shows score versus target, equations, turns, best move, Flux earned and the current zone map. The player can **continue immediately without shopping** or enter the **Salvage Bay**. The Bay has a dedicated, larger layout, original orbital repair-hangar illustration, visible Flux and installed inventory, clear equipment categories, and sticky bottom navigation back to the report or ahead to the next sector. The shop is accessible after completing a sector. It shows **four rotating permanent offers** and **three temporary offers** (always Pulse Capacitor plus two rotating other powers), grouped into their own sections with visible categories and costs. Buying does not use a turn. Bought permanent modules leave the pool. You may buy several upgrades per shop as long as there are free slots and enough Flux. The normal scoring engine, unchanged 19×19 board and original four-room / Solo modes remain compatible.

On clearing a sector, Flux reward is

`4 + floor(sector energy / 30) + max(0, 6 - turns used) + (Flux Recycler ? 3 : 0)`.

This currency carries to subsequent sectors. Precision Dividend and Premium Prospect also award Flux *immediately on valid scored moves*. Successful sector completion grants the end reward once, even if reloaded during animation.

## Anomalies

Boss anomalies still occur every third sector: Power Leak (−15%), Signal Jam (2E suppression), Critical Reactor (+20% target), Tile Static (3T acts as 2T). Board-space reactivation is tracked per individual square and resets when entering the next sector. All score previews use the same power-up engine; the exact mathematical truth of an equation is still checked only when submitting.

## Quality checklist

- Verify the four permanent SVG pieces and two temporary SVG pieces remain visible without obscuring any board square on a 1366×768 laptop and on portrait phones.
- Verify the extra rack slot displays *6 numbers + 3 operators* without reducing board size or overflowing, and the seventh-turn upgrade enables precisely one extra turn.
- Verify one free single-tile swap normally; with Exchange License, two **separate** free one-tile swaps, never a free multi-tile swap. Sector Run and multiplayer should be unaffected.
- Verify Step Up 3→4 when a physical 4 is in the bag, rejection when none remain, and the exact total of 151 physical tile IDs before and after.
- Verify a score booster is unchanged by a mathematically incorrect submission, consumed after an accepted score, and restored after a page reload.
- Verify Second Spark cannot repeatedly harvest one premium square in a sector, and resets in the next sector.
- Verify no more than four permanent purchases or two temporary power-ups; check zero-cost/malformed purchases, replay safety, and save corruption validation.
- Verify the existing scoring animation, results-first intermission, direct-continue path without shopping, Salvage Bay artwork, sticky shop navigation on narrow screens, Sector Run and multiplayer regression tests.
