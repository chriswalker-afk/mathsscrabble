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
