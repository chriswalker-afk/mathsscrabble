# ALIEN LAB // Pass A1 — Modular alien pilot artwork

**Status:** A1 supplies original art, shared anatomy, reusable SVG rendering, a strict data model and automated pixel compatibility tests. **A2 adds the interactive creator** at [alien-lab.html](../alien-lab.html), plus editing, explicit local saves and SVG export. Multiplayer avatar selection and server-backed seat binding are **Pass B**. This pass leaves all existing EQUA//NOVA gameplay and the standalone [Critter Lab](https://github.com/chriswalker-afk/avatar) unchanged.

For visual inspection on a local web server or deployed GitHub Pages branch, visit **[alien-preview.html](../alien-preview.html)**. The specimen vault shows four curated aliens, their 48/64/96/240px renderings, and every part option on a neutral base character. This is a **review-only gallery, not an interactive editor**.

## What was actually made

Thirty original, hand-authored SVG components, all transparent, with exactly seven configurable categories:

| Part category | Starter choices | Notes |
| --- | --- | --- |
| Heads | orb, pear, jelly, facet | Four recognisably different silhouettes |
| Eyes | twin, cyclops, trio, visor | Fixed high-contrast face art; pupils are not recoloured |
| Mouths | smile, surprised, toothy, zigzag | Compact expressions inside the common mouth safe zone |
| Bodies | bean, puff, suit, jelly | Round, plush, astronaut, translucent forms |
| Arms | mittens, noodles, claws, tentacles | Symmetrical shoulder connections, with playful different poses |
| Legs/movement | stubs, spindles, tentacles, hover | Distinct silhouettes; a hover ring has no ground feet |
| Accessories | none, antennae, horns, helmet, jetpack, badge, companion | Three rear and three front overlay options; none is virtual |

Six palettes: **mint, lavender, coral, aqua, saffron, cosmic-blue**. Each has approved 7-token colour slots: primary, light, dark, belly, accent, spot, blush. The avatar has independent **skin** (head/arms/legs), **outfit** (body), and **accent** (accessory) colour selections; the eyes, mouth, and fixed outlines remain legible. There are **28,672** base head × eye × mouth × body × arm × movement × accessory combinations before the 216 colour-role combinations.

The four starter presets are **Bloop, Orbit, Niblet, Glimmer**. Their versioned configurations live in the manifest, not in the UI code.

## Shared anatomical and layer contract

The reference canvas is **320 × 360** with a transparent background. **Never crop, stretch or independently scale a component**; each SVG occupies the same complete viewBox. Rendering preserves exact visible proportions at any output width/height.

| Joint/reference | Fixed coordinates (SVG units) |
| --- | --- |
| Centerline | x = 160 |
| Neck / head-to-torso seam | y = 154 |
| Hip / torso-to-movement seam | y = 260 |
| Left shoulder | (113, 190) |
| Right shoulder | (207, 190) |
| Eye region center | (160, 101) |
| Mouth center | (160, 143) |
| Shared safe box, eyes | x 103–217; y 56–130 |
| Shared safe box, mouth | x 135–185; y 129–164 |
| Head accessory anchor | (160, 53) |
| Chest accessory anchor | (192, 225) |
| Rear accessory anchor | (160, 207) |

**Draw order:**
1. Rear accessories (antennae, horns, jetpack)
2. Legs/movement
3. Arms
4. Body
5. Head
6. Eyes
7. Mouth
8. Front accessories (helmet, badge, companion)

A character has **six physical SVG layers**, plus one optional accessory layer. "None" is an allowlisted virtual option and deliberately has no SVG file. Rear items stay behind the torso/head; front items sit over the correct zone. Head surfaces contain every permitted eye/mouth choice. Torso joints intentionally overlap the head, arm roots and leg roots; these are organic overlaps, not displayed bolts.

The manifest currently declares **universal compatibility**. Do not add a part that needs special casing or manual per-combination offsets unless you update the manifest compatibility schema and the visual tests. A1 intentionally chooses shared coordinates over hidden exceptions.

## Files and API

- **alien-manifest.json:** version, canvas and anchor schema, part allowlists, palette values and roles, rear/front attachment metadata, four starter presets.
- **assets/aliens/{heads,eyes,mouths,bodies,arms,legs,accessories}/\*.svg:** original same-origin artwork (30 files).
- **src/alien/model.js:** dependency-free functions for configuration and validation; safe for a Cloudflare Worker or Node import.
- **src/alien/renderer.js:** browser-only SVG parsing, strict node/attribute checks, preloading and DOM-based composition.
- **alien-preview.html / src/alien/preview.js / src/alien/preview.css:** static, deliberately non-editable art review.
- **tests/alien-model.test.js:** exact schema, malicious-data handling, all 28,672 structural combinations, 216 role-colour permutations and physical asset file contract.
- **tests/alien-art-browser.mjs:** real Chromium raster audit of all 30 SVGs, every compatible head/body, head/eye, head/mouth, torso/arm and torso/leg pairing, badge position, 48px silhouette distinction, recolouring, SVG export and browser safety.

Pure model exports include **assertAlienManifest, defaultAlien, normaliseAlien, validateAlienPayload, serializeAlien, parseStoredAlien, randomAlien, presetAlien, alienLayers, alienAssetPath, alienDescription**. The browser renderer exports **validateAlienSvg, loadAlienLibrary, renderAlienSVG, serializeAlienSVG**.

For future use:

~~~js
import {assertAlienManifest,presetAlien,serializeAlien} from './src/alien/model.js';
import {loadAlienLibrary,renderAlienSVG} from './src/alien/renderer.js';

const library=await loadAlienLibrary('./');
const alien=presetAlien(library.manifest,'bloop');
document.querySelector('#avatar').replaceChildren(
  renderAlienSVG(alien,library,{width:64,height:72})
);
const configuration=serializeAlien(alien,library.manifest);
~~~

The pure data model knows **only allowlisted IDs**. It never accepts raw HTML, SVG, colours, URLs or user-provided paths. The browser loader refuses cross-origin asset bases; it parses SVGs with an allowlist of harmless shape elements/attributes and recolours only approved data slots. Saved configurations should be stored under **equa-nova.alien.v1** (never overwrite Critter Lab or any game-save key).

Illustrative compact representation:

~~~json
{
  "version": 1,
  "head": "orb",
  "eyes": "twin",
  "mouth": "smile",
  "body": "bean",
  "arms": "mittens",
  "legs": "stubs",
  "accessory": "antennae",
  "colours": {"skin": "mint", "outfit": "lavender", "accent": "saffron"}
}
~~~

**Frontend recovery:** Use normaliseAlien for tolerant recovery from corrupted local storage. **Online Worker validation:** Use validateAlienPayload to **reject**, not silently repair, arbitrary or malicious data. Validate the server-side accepted IDs against the bundled manifest before publishing them as player metadata. Send only the JSON configuration (bounded to 1024 bytes), never a rendered SVG.

## How to add a new part

1. Sketch the full character and choose a **distinct silhouette or expression** that remains legible at 48px (not merely another recolour).
2. Draw one original transparent SVG using **viewBox="0 0 320 360"**, width/height 320×360, and the same artboard and anatomical anchors.
3. Give the root **data-alien-part**, **data-part-id**, **data-art-version="1"**, **data-anchor-x="160"**, **data-anchor-neck-y="154"**, and **data-anchor-hip-y="260"**. Provide a safe title and description.
4. Use only self-contained **g, path, circle, ellipse, rect, line, polyline, polygon** elements and ordinary geometric/fill/stroke attributes. No embedded CSS, scripts, masks, filters, external links, images, event handlers or fonts.
5. Tag recolourable areas with **data-color-slot="primary"** (etc.), and strokes with **data-stroke-slot="primary"**. Preserve constant dark outlines and face contrast.
6. Add the ID to its catalogue in **alien-manifest.json** and adjust the deliberately fixed A1 catalogue-size validation when a future pass expands the library.
7. Run the Node and Chromium tests, inspect all seam pairs (especially with the narrowest and widest heads and torso styles), inspect all palettes at 48px, and review the asset gallery before merging.

New artwork should never be added merely because it parses. Tests must confirm that it fits the common joints, remains within the canvas and cannot obscure faces.

## Verification

Local pure tests:

~~~sh
npm run check
~~~

Chromium test (after a one-time Playwright browser install):

~~~sh
python3 -m http.server 4173 --bind 127.0.0.1
node tests/alien-art-browser.mjs
~~~

CI runs these tests alongside the existing Sector Run, Drift, Local Match and Online Rooms tests. The **real SVG compositor** is shared by the specimen gallery and the browser test, and generates transparent, standalone SVGs for later export. Tests are valuable mechanical checks, but a human visual review of expressions, clipping, scale and personality is still required before A2.

## Next passes

**A2 — implemented:** [Alien Lab creator](../alien-lab.html) (also linked from the EQUA//NOVA **Mode** picker, without reducing the board area) includes all seven editor sections, zoomed face thumbnails, six palettes for each of three colour roles, four presets, randomisation, reset, 30-step undo/redo, explicit save/load, transparent self-contained SVG export, keyboard tab navigation, mobile sticky preview and reduced-motion support. `src/alien/editor-state.js` keeps editing and browser persistence testable separately from `src/alien/editor.js`. `tests/alien-editor-state.test.js` and `tests/alien-editor-browser.mjs` cover these controls, sandboxed saved state, failed storage, corrupt saves, no regression to other game keys and responsive screens. Keep the artwork/renderer reusable and the main game board unchanged.

**A3:** Thorough aesthetics audit: check every permitted pairing at scoreboard scale, polish silhouettes, collision/occlusion edge cases, responsive student flow and focus states; refine art based on classroom feedback.

**B (after acceptance):** Add *Edit Alien* and quick random alien selection to Local Match setup and Online Room lobby; allow the server to receive only safe validated configs, preserve them across room reconnects and render in scoreboards, active-turn markers and results. No avatar choice ever affects tile draws, maths, timers or scoring.
