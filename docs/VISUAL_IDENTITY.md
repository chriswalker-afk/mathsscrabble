# EQUA//NOVA: visual identity · Pass A

**Purpose:** Make EQUA//NOVA feel like one playful, tactile retro-futuristic adventure. Pass A establishes the shared visual language; Passes B–F apply it through individual scenes and character illustrations.

**Reference page:** [Visual field guide](../visual-direction.html)  
**Core CSS:** [Design system tokens](../src/design-system.css)  
**Original illustration studies:** [Reactor / Drift / Salvage](../assets/art-direction/scene-studies.svg)

## 1. Creative direction

- **World:** a slightly handmade spaceship-and-aliens universe, featuring a dependable reactor, curious crew, tangible technology, mysterious nebulae and a welcoming repair dock.
- **Emotional balance:** adventurous and charming, never grim or overly militaristic. Slight asymmetry, layered hull materials, gentle expression and playful discoveries make machinery feel inhabited.
- **Illustration:** crisp original SVGs, solid silhouettes, tasteful line variation and 2–3 planes of depth. Small accents should remain legible at phone sizes. Avoid stock photos, emoji stand-ins and huge diffuse effects.
- **Gameplay precedence:** mathematical symbols, equations, tile point values and premium labels are **functional information** and outrank decoration. No decorative art behind glyphs or tile targets. No animations that affect mathematical legibility.
- **Design accent:** teal means equipment/energy and primary interface signals; gold means rewards, continuation, and decisive outcomes; violet indicates Drift/unknown zones; powder blue indicates multiplayer/connection; coral indicates hazards.
- **Pilot role:** aliens provide personality and warmth; they should not become an obstacle to the board, timers or score.

## 2. Palette and primitives

All shared names live in `src/design-system.css`. New CSS must use these variables instead of introducing a new near-identical hard-coded shade.

| Token | Value | Role |
| --- | --- | --- |
| `--nova-void` | `#071421` | far-space background |
| `--nova-space` | `#091d2d` | canvas |
| `--nova-space-raised` | `#102b3c` | deck level |
| `--nova-panel` | `#193747` | machinery panel |
| `--nova-panel-raised` | `#264859` | highlights / depth |
| `--nova-text` | `#f5f2e5` | primary body / headings |
| `--nova-text-muted` | `#bbd5d6` | supporting text |
| `--nova-text-faint` | `#91b5be` | noncritical metadata |
| `--nova-line` | `#608a93` | hull frame |
| `--nova-teal` | `#8fe8d1` | energy, success |
| `--nova-gold` | `#f4d49b` | reward and progression |
| `--nova-violet` | `#cbb6f5` | Drift |
| `--nova-blue` | `#9ccafa` | multiplayer |
| `--nova-coral` | `#f1acaf` | hazards |
| `--nova-focus` | `#ffe0a3` | keyboard focus |

Base radii: `--nova-r-sm` 6px, `--nova-r-card` 13px, `--nova-r-panel` 16px, `--nova-r-scene` 20px. Shadows stay below UI elements; gradients should feel like painted metal, not glass reflections.

## 3. Type, imagery and composition

Keep the existing local/system sans stack (`--nova-font`) for instant loading. **Display** uses larger, confident sentence-case or short caps; **UI labels** use short uppercase with moderate tracking; **explanatory body** uses mixed case with relaxed line spacing. Aim for at least 12px on nonessential labels, 14px or more for reading, and clear actionable button labels. Avoid adding tiny labels to compensate for cramped layouts.

For illustrations, reserve a 10% safe margin for cropping, use one obvious focal point per panel, and keep lighting consistent: cool reactor light, violet cosmic light, warm salvage/workbench light. Prefer a portrait crop for mode-selection cards and a wide environment composition for story intermissions.

## 4. Reusable components

- `.nova-panel`: common machinery panel, `.nova-panel--raised`: highlighted layer.
- `.nova-scene`: illustrative frame with subtle orbit engraving and generous inner padding.
- `.nova-eyebrow`, `.nova-display`, `.nova-copy`: typography hierarchy.
- `.nova-hull-badge`: telemetry badge; `.nova-action`: clear positive action.
- `.nova-signal`: restrained ambient indicator with reduced-motion fallback.

These components appear in the [visual reference page](../visual-direction.html) and can be adopted as the future Passes B–F extend the game. The existing game modes already use the shared palette, focus settings and panel finishes without changing tile geometry or scoring.

## 5. Motion, interaction, accessibility

Motion language: signals breathe slowly (~2.7s), buttons react quickly (~140ms), scenes transition in ~240ms, special reveals can take ~580ms. A score ceremony may be more elaborate, but must leave the maths and total unambiguous.

- Keep the existing reduced-motion options. The design system disables its optional ambient animation and button movement under `prefers-reduced-motion: reduce`.
- All interactive controls have visible keyboard focus. Active status requires both shape/text and colour, never colour alone.
- Test viewport widths 320px, 390px, 768px, 1366px. The zoomable 19×19 grid and rack stay the focus and do not expand horizontally when decorated.
- Never load remote fonts, background videos, or additional JavaScript frameworks solely for decorative purposes.
- Artwork is original, with meaningful alt text when it conveys content and empty/hidden alt when purely decorative.

## 6. Follow-up pass responsibilities

| Pass | Area | Visual task |
| --- | --- | --- |
| B | Mission Control | full illustrations per mode and better kit samples |
| C | Reactor | polished frame, score animation, equipment HUD, fine-tuned mobile clarity |
| D | Drift | twelve memorable boss characters, unique zones and journey map |
| E | Salvage / progression | unique 3D-feeling equipment miniatures and reactive ship art |
| F | Multiplayer / Alien Lab | character-forward rooms and final accessibility/visual QA |

Pass A intentionally avoids modifying any game rules (except the independently requested, tested Salvage stock randomisation), boss abilities, rack counts, board coordinates or online protocol. It supplies the design foundation for the following passes.

## 7. Pass B — Mission Control artwork and mode selection (implemented)

The homepage has been rebuilt as a game entrance rather than a purely
instrument-panel directory. A scenic spaceship bridge introduces the
universe, and the four game modes appear first as full-card navigation.
A clearly labelled CURRENT TILE KIT control in the hero jumps to the
mathematical kit selector. Selecting a kit changes every mode's launch
link and the hero readout without erasing existing games.

### Original art files

| Asset | Narrative purpose |
| --- | --- |
| `assets/mission-control/bridge.svg` | cockpit with alien crew member and distant planet |
| `assets/mission-control/sector.svg` | glowing equation reactor and training apparatus |
| `assets/mission-control/drift.svg` | strange nebula, small spacecraft and boss encounter |
| `assets/mission-control/local.svg` | two friendly pilots playing on a shared tabletop |
| `assets/mission-control/online.svg` | communication tower, ships and network links |
| `assets/mission-control/kit-launchpad.svg` | introductory rocket hardware |
| `assets/mission-control/kit-orbit.svg` | signed-number orbital ring |
| `assets/mission-control/kit-nebula.svg` | colourful segmented fractions |
| `assets/mission-control/kit-quantum.svg` | advanced mathematical energy instrument |
| `assets/mission-control/alien-lab.svg` | cheerful crew workshop banner |

SVGs are lightweight, self-contained, drawn for EQUA//NOVA and contain no
script, font, image imports or network resources. Each appears with
`alt=""`, since card headings and descriptions already explain the
destination. They are not substitutes for functional text.

### Mathematical clarity and responsive composition

Each kit button contains a legible real-text equation using small,
tactile tiles; its original illustration is purely decorative. Illustrations
sit behind a dark gradient scrim on mode cards while the labels remain
separate DOM text. Full-card links, keyboard focus, save/resume labels,
existing 19×19 gameplay and multiplayer protocols remain unchanged.

At narrow widths, decorative illustrations crop and labels remain in the
foreground. The image hover zoom disables under reduced-motion preferences.
The home layout deliberately presents mission choices before optional kit
customisation; the current kit is always visible above the modes.

### Quality gates

`tests/mission-art-browser.mjs` verifies ten SVG assets decode, no mobile
overflow at 320/390/768/1366px, readable kit examples, intact full-card
links, correct chosen-kit persistence, keyboard interaction through the
existing home test and reduced-motion animation rules. The artwork is
not exported into the gameplay board.

**Next pass:** Pass C should improve gameplay HUD detail, equipment display
and score feedback without allowing decorative elements to obscure
equations, tile values, board coordinates or 19×19 viewport interactions.

## 8. Pass C — Reactor and gameplay polish (implemented)

This pass retains the existing game logic, rack sizes, premium-square
notation and zoomable 19×19 board. Its new custom artwork and instruments
are confined to the machinery *around* the mathematical grid.

### Reactor hardware

- The old separate viewport label/zoom strip is a compact instrument head
  with an engraved reactor-core graphic, four existing zoom commands,
  percentage readout and a state label.
- State labels are deliberately modest: **READY TO CHECK** means tiles are
  geometrically ready for BIDMAS validation, *not* that the equation is true.
  Other states include **SELECT TILES**, **BUILDING EQUATION**,
  **ADJUST PLACEMENT**, **EXCHANGING TILES**, **TRANSFERRING ENERGY** and
  **SECTOR STABILISED**. This display never awards points.
- The existing border and corner hardware have stronger material depth,
  readable state colours and small edge effects. The board and its tiles
  retain the same dimensions and their original text contrast.
- `assets/reactor/reactor-core.svg` is original, lightweight decoration.
  `src/reactor-pass-c.css` is loaded after gameplay styles to isolate
  this visual upgrade from the rules.

### Energy and scoring

- The energy track is now a real `role="progressbar"`, with a
  current value and target that update during tile-by-tile scoring.
  Local multiplayer intentionally does not expose a meaningless sector
  target; the track becomes presentational there.
- The verified score is still committed to the save before the ceremony,
  so skipping, refreshing, or enabling reduced motion cannot duplicate
  rewards or alter the rack.
- The concluding **+ energy** animation now appears in the narrow console
  readout, outside the board. The new instrument bar also indicates
  animation progress without covering mathematical symbols.
- The score breakdown remains explicit about tile points, multiplier,
  length, connection, upgrades and anomalies; its new presentation uses
  the same painted-hull visual language as Mission Control.

### Pilots and installed equipment

- The existing Alien Lab profile is rendered as a small custom pilot
  portrait on the desktop telemetry rail, with an original core medallion
  as fallback. Loading an avatar is asynchronous and never delays or
  mutates the current match.
- Permanently installed equipment receives distinctive chassis styling
  by category, and mission gadgets show larger **ARMED** /
  **CHOOSE TILE** indicators in addition to existing icon and
  `aria-pressed` attributes.
- Mobile retains the four-slot Ship System row and two-slot Mission
  Gadget row. The installed-system names remain available in a compact
  text summary and through the existing tap-to-inspect action.
  Desktop medallions remain hidden on mobile so that the score, board
  and rack are not pushed down.

### Regression gates

`tests/reactor-presentation.test.js` validates status vocabulary and
precedence. `tests/reactor-pass-c-browser.mjs` verifies full zoom controls,
four screen widths, no overflow, a real pilot portrait, progressbar
semantics, correct incremental scoring and skip behaviour, and equipped
Drift gadgets with clear status feedback. All previous solo, Local Match,
Online Rooms, sector progression, and Cloudflare tests still run.

**Next pass: D — Drift world-building.** Give each boss a recognisable
character and zone scene, then improve the route map and encounter effects
using the shared identity, while retaining the underlying boss rules.

## 9. Pass D — The Drift worlds, bosses and star chart (implemented)

**Goal:** Make Drift progression feel like travelling through a sequence of
places inhabited by memorable characters. Pass D adds 12 bespoke space
environments and 12 visually differentiated guardian portraits. The
vocabulary retains the homemade spacecraft aesthetic from Pass A and
the readable equipment hierarchy of Pass C.

The full **Captain's Star Chart** opens with an illustrated current-zone
banner, followed by the current route and the still-unidentified next zone.
Past zones live in an accessible, collapsible flight log. This prevents
deep runs from opening at the beginning of a long list, while preserving
the journey history. Each route still has three fixed nodes; the third is
a guardian encounter and has its own shape. The boss identity, type and
effect always come from the saved run and are never rolled by the UI.

Illustrations are placed exclusively on backgrounds of the map cards,
boss briefing, anomaly panel and after-action card. All labels,
target values and equations remain independent DOM text with adequate
contrast over dark gradient scrims. The 19×19 board stays its existing
size, with no overlaid art. Every boss's **this sector's rule** is explicit
in the encounter briefing, and its artwork stays consistent across views.

| File | Responsibility |
| --- | --- |
| `src/boss-art.js` | Safe allowlisted boss portraits and scenic URL lookup |
| `assets/drift/zones/*.svg` | 12 original self-contained environment panoramas |
| `src/drift-map.js` | Scenic chart, current/next/history, guardian intro and round end |
| `src/drift-world.css` | Layering, contrast, responsive composition and motion |
| `tests/drift-world.test.js` | Portrait coverage, fixed IDs, no spoilers, rule accuracy |
| `tests/drift-world-browser.mjs` | 24 SVGs, 4 widths, archive, warning, reduced motion |

**Next art pass:** Pass E can concentrate on the Salvage Bay workshop and
micro-interactions, aligning its hardware catalogue with the richer worlds
without overloading the board interface.

## 10. Pass E — Orbital Salvage Bay and equipment showroom (implemented)

**Objective:** Turn the optional Drift upgrade stop into a memorable,
inhabited repair workshop with tactile equipment rather than another
listing of text cards. The suspended reactor vessel remains the anchor
image; a new self-contained transparent SVG overlays the same hangar
with a cheerful toolbelt-wearing alien mechanic, spanner, helper drone,
tool cabinets, diagnostic lights and a workbench.

### Information architecture

1. **Workshop arrival:** one concise banner identifies the repair bay and
   reminds players that Ship Systems persist while Mission Gadgets are
   consumed once.
2. **Flux and installed capacity:** three high-contrast instruments update
   instantly after each purchase: wallet balance, 0–4 Ship System slots,
   and 0–2 carried gadgets.
3. **Fitted loadout:** a six-bay equipment rack with existing item-specific
   SVG insignia and category hues. Filled bays can be selected to inspect
   the item's actual effect; empty bays show clear placeholders.
4. **Module depot and Gadget Locker:** the original four system offers and
   three gadget offers appear in separate labelled galleries. Each has a
   substantial original SVG case/cartridge, item name, effect description,
   cost and an actionable INSTALL / STORE button. Disabled purchases
   explain whether Flux or capacity is insufficient.
5. **Continue or return:** the original round-results and launch controls
   remain in the fixed footer; the player never has to navigate to another
   shop or change screens to buy.

The item-specific inner emblems continue to come from
`src/equipment-art.js`; `src/workshop-art.js` gives those
unique designs a dimensional physical casing. Permanent modules use
fitted metal cabinets; one-use gadgets use rechargeable-looking
cartridges, without pretending gadgets are permanent. All SVG content
is constructed from the existing allowlisted item catalog.

### Behaviour and accessibility

`src/salvage-workshop.js` owns only the view. It invokes
`purchaseUpgrade` / `purchaseTemporary` through the game app and
always accepts the game engine's returned state. It does **not**
reroll stock, compute prices, write saves or invent purchase outcomes.
The screen repaints in the *same modal* after a successful purchase,
preserving the scroll location and moving keyboard focus to a viable
next action (or the live confirmation). A result message is announced
with an existing `role=status` region.

The new visual styles are scoped to
`#drift-hub[data-view="salvage"]`. They cannot affect the 19×19 board
or rack. The hero artwork is supplied by an original local SVG and
does not introduce a second decorative image element for screen
readers. All essential text is DOM text independent of SVG. Layouts
adapt at 320, 390, 768 and 1366 pixels, keep the fixed launch footer
visible, and disable all decorative transitions under the user's
reduced-motion preference.

New unit and end-to-end browser regressions check every equipment
asset, seeded stock persistence across buys and reopening, live Flux,
remaining stock, 4+2 slots, equipment explanations, keyboard focus,
image decoding, phone overflow and the existing boss/rack math rules.

**Next art pass:** F — finishing polish on smaller screens and
communication states, followed by a holistic consistency audit.
