# The Drift — Pass D rulebook and classroom quality checks

**Status:** implemented as the separate roguelike mode on the Pass D feature branch. These costs, targets and bonuses are provisional game-balance values to test with students; no real classroom playtest is claimed here.

## Modes and saved progress

Choose between **Sector Run** and **The Drift** via the `◈ MODE` button. Both use exactly the same BIDMAS validator, unscored tile movement, physical rack and finite tile bag. They have independent local browser saves and therefore do not overwrite each other. Sector Run is repeatable classroom practice; The Drift is a run-based challenge with permanent upgrades lasting **only for the duration of that run**.

In The Drift, reach the sector energy target within six turns. Every completed sector awards Flux and opens the **Salvage Bay**. Buy upgrades, then advance to a new board. If you do not reach a target by the final turn, the run ends and you can start a new Drift without carrying over upgrades or currency. A refresh during the completion animation resumes the same won/lost phase; it must not duplicate Flux or score.

## Flux economy

On a successful sector:

```
Flux earned = 4 + floor(sector energy / 30)
              + (6 − turns used)
              + (3 if Flux Recycler is equipped)
```

This rewards correct, efficient play, but also guarantees basic shop currency for a six-turn victory. It is based on **sector score**, not cumulative run score, and paid **only once per cleared sector**. The shop can be visited and purchases made multiple times before proceeding. Unspent Flux rolls forward to subsequent sectors. Each purchased item is applied instantly to the **future** play rules; it does not retroactively change previous sector scores.

### Shop stock

The Salvage Bay shows **four rotating permanent upgrade offers** after each sector, plus a Pulse Capacitor card. New purchases replace a permanent offer with another unowned item where available. Every permanent upgrade can be bought once.

| Upgrade | Cost | Actual effect |
|---|---:|---|
| Ionised Sevens | 4 | Nonblank 7 tiles **you newly place** earn +3 base tile points, multiplied by their current tile square |
| Crosslink Circuit | 5 | +5 flat energy when an equation intersects a previously locked tile |
| Longwave Coil | 5 | +7 flat energy for equations at least seven board cells long |
| Wildcard Beacon | 6 | Newly completed racks seek **two wildcards** while the finite bag permits |
| Operator Core | 5 | Nonblank × and ÷ tiles **you newly place** earn +3 base tile points |
| Amplifier Array | 7 | 2T squares act as 3T for newly placed physical tiles; board labels show 3T |
| Echo Generator | 6 | +2 flat energy for each physical tile newly placed after the fourth |
| Operator Reserve | 5 | New racks seek **two operator-capable tiles** while the bag permits |
| Flux Recycler | 7 | +3 additional Flux on future sector wins |
| Leak Shield | 7 | Removes the Power Leak penalty on any sector with that anomaly |
| Pulse Capacitor | 3 | **Single-use:** +12 energy on next mathematically valid scored equation, then one charge is consumed; hold up to three |

Wildcards are **zero-point tiles** even when they represent a boosted 7 or operator. The capacitor is only consumed on a valid scoring action, never on a rejected equation. Multiple capacitors queue for later valid equations (at most one triggers on any equation). They are available after every victory while carrying capacity and funds permit.

## Sector anomalies

Every **third** sector contains a boss anomaly. These rotate deterministically, so players can learn and plan for later encounters.

| Sector sequence | Anomaly | Gameplay consequence |
|---|---|---|
| 3, 15, 27, … | **Power Leak** | Lose 15% of each scored equation's energy (rounded down). Leak Shield cancels it |
| 6, 18, 30, … | **Signal Jam** | Newly used 2E squares do not multiply an equation. Squares display `JAM` |
| 9, 21, 33, … | **Critical Reactor** | Sector target increases by 20%, rounded up |
| 12, 24, 36, … | **Tile Static** | 3T squares score as 2T for newly placed tiles; displayed as 2T |

Multipliers and upgrade boosts are applied before a Power Leak penalty. A correct equation is always validated by the same BIDMAS parser whether an anomaly is present or not. The preview uses the **same scoring function as submission**, including installed upgrades, capacitors and active anomalies, so the displayed possible score is trustworthy without giving away whether the maths is correct.

## Balanced racks and conservation

The starting bag has 151 physical tiles (digits, operators and the three wildcard types). **No roguelike upgrade creates or duplicates a tile**: bonus rack rules select a suitable existing tile from the shuffled bag when available. Ordinary minimum rack composition is four number-capable, one operator-capable and one wildcard. Operator Reserve and Wildcard Beacon increase those targets without removing any tiles already held. If the necessary types are exhausted, the rack simply fills from what remains. Free swaps for all-number or all-operator racks still work.

## Student experience and readability

- Mode selection is in the header; the board remains the large centre element and there is no second page/scrolling requirement on laptop.
- The left panel displays current Flux and the equipped build; the right panel shows the active anomaly with the important changed rule.
- The shop uses short cards, immediately visible prices and descriptions, with unaffordable purchases disabled.
- Anomalies that change premium-square values update board labels, not just invisible scoring.
- Score breakdown explicitly shows updated base points, equation multipliers, equipment bonuses and anomaly losses. The mathematical symbols never receive small point-score overlays on the board.
- A Drift loss cannot be retried with upgrades retained. The loss report provides a new-run action; the independent Sector Run save is unaffected.

## Testing checklist

1. On a new browser, play an opening Sector Run equation, switch to The Drift, and switch back again. Confirm the Sector Run's board and scores are unchanged.
2. In The Drift, win a sector and buy a permanent upgrade. Refresh in the shop. Confirm both Flux and purchase are preserved without a duplicate win reward.
3. Purchase a capacitor. Try an incorrect equation: confirm the charge stays available. Correct and submit it: confirm exactly one charge is consumed and +12 was incorporated in the displayed potential and actual energy score.
4. Use a 7 on a 2T square with Ionised Sevens or an operator on a 2T square with Operator Core. Confirm both original tile and upgrade values receive the active multiplier.
5. Equip Amplifier Array; a 2T square must visibly become 3T. In a Signal Jam sector, a 2E square should visibly show JAM and not multiply energy.
6. Start sectors 3, 6, 9 and 12; verify that each anomaly text and actual mathematical scoring or target agree.
7. Reach the final turn without meeting a Drift sector target. Confirm the run ends, the only restart creates a new unequipped run, and the other mode's save survives.
8. Test on 1366×768 and 1280×720 laptops, 768×1024 portrait tablet, and a 390×844 phone. The board, rack and critical game actions should remain readable and accessible without unintended horizontal scrolling.

The automated Node suite tests exact mathematical scoring, currency conservation, duplicate purchase safeguards, anomaly rotation, shop offers and loss/win save validation. The Chromium browser suite tests switching, real scoring, purchase/reload, starter-sector completion, boss visibility, capacitors and permadeath. **Human playtesting is still required** to calibrate the economy and check whether the choices feel meaningfully different.

## After Pass D

**Pass E:** competitive multiplayer. Begin with 2–4 player local pass-and-play (private rack handovers and end-of-game leftover-tile deductions), then online rooms with server-authoritative turns and reconnect behaviour. Keep roguelike upgrades separate from competitive rules.
