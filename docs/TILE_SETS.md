# Maths tile kits and ship equipment

## Four selectable maths tile kits

From the EQUA//NOVA home screen, select a mathematical kit before entering **Sector Run** or **The Drift**. The choice also appears as a **◇ KIT** button in the game header. Switching an existing run requires an explicit confirmation and starts a new run; it does not silently replace an existing save. The choice is stored locally, survives reloads and remains fixed for subsequent sectors. These kits run entirely in the GitHub Pages client; no Cloudflare Worker queries are needed.

| Kit | Number tiles | Operator tiles | Other tiles | Sample correct equation |
|---|---|---|---|---|
| 01 **Launchpad — Natural Numbers** | Single digits 0–9 (adjacent digits may form integers) | +, −, ×, ÷ | 3 zero-point wildcard types; unlimited free equals | `8 + 4 = 12` |
| 02 **Orbit — Integers** | Positive digits and physical signed tiles such as `−3` | +, −, ×, ÷ | Wildcards; free equals | `−3 + 7 = 4` |
| 03 **Nebula — Rational Numbers** | Positive digits and atomic fractions such as `1/2`, `3/4`, `−2/3`, `3/2` | +, −, ×, ÷ | One linked pair of bracket tiles, wildcards; free equals | `(1/2 + 1/2) × 2 = 2` |
| 04 **Quantum — Advanced Operators** | Same integers and signed fractions as Nebula | +, −, ×, ÷, exponent `^`, square root `√`, factorial `!` | One bracket pair; wildcards; free equals | `√9 + 3! = 9` |

**Physical supplies:** Each kit has 151 unique physical tiles. Every fresh rack keeps **five number-kind tiles and three operator-kind tiles**, drawn from their respective supply categories. Nebula and Quantum hold **two extra bracket halves**, making ten physical rack pieces by default. In The Drift, the Rack Extension Ship System adds one further number tile (nine in the first two kits, eleven in Nebula/Quantum). Bag inventory shows the actual fractions, signed numbers, advanced operators and bracket supply remaining.

### Why bracket pairs are linked

The two physical tiles `(` and `)` belong to one bracket pair with a shared internal identifier. Both halves are drawn together from a separate pool of eight physical pairs; **both must be placed and used in the same scored equation**, not held as unmatched singles. Neither may be exchanged individually or transformed by a Mission Gadget. A partial pair is rejected without losing a turn. Existing locked brackets can still be crossed to make new calculations, but each newly used pair is atomic as a set.

### Exact mathematical evaluation

All validation uses exact rational arithmetic with BigInt numerators and denominators, not floating-point estimates. Each physical fraction or signed-number tile is **one number token**; `−3` is not the same physical object as the operator `−` followed by `3`. Adjacent single-digit tiles still concatenate (`1` then `2` makes twelve); a signed or fractional token cannot be accidentally concatenated with a neighbour.

BIDMAS precedence: brackets → powers/roots/factorials → multiplication/division → addition/subtraction. Powers are right-associative: `2 ^ 2 ^ 3 = 256`. Negative powers are allowed through an explicit minus operator. For controlled difficulty and exact scoring:

- **Exponents** must evaluate to an integer from −8 to 8. Non-integer powers are rejected.
- **Square roots** must be real and exactly rational, for example `√(1/4) = 1/2` is valid and `√2 = 1` is invalid.
- **Factorials** apply only to whole numbers from 0 to 8. `3! = 6`, `0! = 1`.
- Division by zero, mismatched brackets, missing operators, implicit multiplication, and equalities without a genuine operation are invalid.

Correct mathematical solutions still depend on valid board placement: new tiles lie on one continuous straight line, the first equation crosses the centre, and later equations connect to locked tiles. Bracket pairs and fraction tiles never change the board's original dimensions or its symmetric bonus pattern.

### Drift upgrade vocabulary

The old labels “permanent upgrades” and “temporary power-ups” have been replaced on player-facing screens:

- **Ship Systems** — four mounted, illustrated upgrades that remain installed for the entire run, such as Second Spark or Rack Extension.
- **Mission Gadgets** — up to two single-use illustrated tools or score boosts, such as Double Reactor, Pulse Capacitor or Step Up.

Their costs, scoring rules and equipment limits do not change. Step Up and Step Down can exchange any physical number (including signed integers and rational fractions) for a tile exactly one larger or smaller if an eligible physical tile remains in the number bag. No tile is fabricated and an unavailable exchange does not consume the gadget.

### Multiplayer compatibility

Local Match and Online Rooms still use the existing **Launchpad** (natural number) tile set and unchanged 151-tile shared rulebook. The expanded parser and UI are client-side for Sector Run and The Drift. This avoids accidentally offering choices that the Cloudflare multiplayer Worker does not validate yet. Extending the tile-kit protocol to multiplayer would be a separate feature with server-side rules and compatibility tests.

## Quality assurance

- Four physical bags each contain 151 distinct IDs and correct number/operator distributions.
- Bracket sets have eight complete pair IDs, with an intact pair in every refill when supplies allow.
- Correct and incorrect signed, fractional, bracketed, exponent, root and factorial equations are checked exactly.
- All four kits save and resume without erasing current board/rack/Flux, and kit switching requires explicit confirmation.
- Rack and board remain usable on 320–390px phones and common laptops; fraction faces are stacked and legible rather than overlaid with tiny text.
- Legacy runs with no stored kit continue on Launchpad; The Drift's twelve boss rules and Cloudflare Worker are unaffected.
