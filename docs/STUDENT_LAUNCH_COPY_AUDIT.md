# Student launch audit — clarity, brevity and correctness

**Audit date:** 7 November 2026  
**Scope:** Mission Control, mathematical tile kits, Sector Run, The Drift, Local Match, Online Signal Clash, Alien Lab, Achievement Hangar, live hints, help dialogs, setup and end-of-round guidance.

## Principle

**One next action first, one brief explanation where it matters.** Keep full rules in the relevant “How to Play” or “Rules” dialog. Use board feedback for the current move, kit selection for kit facts and the Hangar for ownership. Do not repeat the same explanation in a heading, subtitle, card, footer and help dialog.

This audit checked the *current source of truth* in `src/engine.js`, `src/tile-sets.js`, `src/multiplayer.js`, `src/rogue.js`, `src/drift-bosses.js`, `src/online-rules.js`, and the achievement ownership adapters. The copy changes do **not** change game scoring, bags, time limits, achievements or persistence.

## Findings and fixes

| Area | Problem found | Launch-quality resolution |
| --- | --- | --- |
| Mission Control | Hero, mission section and captions repeated “choose a game mode” | Single short hero instruction, “Four ways to play”, concise mode cards |
| Mission Control | Tile kit introduction, footnote and bottom strip repeated rack information | Picker explains what changes and saved-game compatibility; short online host note; one compact rules strip |
| Mission Control | Some mode-card descriptions were promotional rather than actionable | Explain the objective of each mode in one sentence |
| Tile kit selector | Claimed all kits preserved a five-number/three-operator balance | Explain **5+3** for Launchpad/Orbit and **6+3 plus a bracket pair** for Nebula/Quantum |
| Drift upgrade | Rack Extension described nine tiles for all kits | Describe the actual effect: **one extra number slot in any kit** |
| The Drift | “Sector three” sounded like the only boss encounter | State that **every third sector** has a randomly selected guardian |
| The Drift | Briefing buried decisions in lengthy descriptions | Three steps: place and score, optional Flux shop, boss/zone progression |
| The Drift | Opening “BEGIN” button still appeared when opening Help mid-run | First launch says **Begin The Drift**; later help says **Back to Game** |
| Sector Run | Long welcome repeated controls and offered two buttons with identical results | Three short steps and one **Start Mission** button |
| Sector Run / Local / Drift | Bracket-pair rule could be missed by students using Nebula/Quantum | Show a short kit-specific note only when the current kit has bracket pairs |
| Local Match | Setup repeated the whole match rules in the kit description | Kit choice now shows its rack; match rules live in Help |
| Local Match | Shared-device pilot explanation was verbose | One sentence: distinct named pilot for saved rewards, otherwise Guest |
| Signal Clash | Players could not easily access Rules before creating or joining a room | Add a **How to Play** button inside the setup/lobby overlay; returns to setup or lobby |
| Signal Clash | Lobby and kit description repeated host/device setup | Keep one create/join instruction, kit-specific detail and context-aware start guidance |
| Signal Clash | Four long rules mixed scoring, server implementation, kit sizes and finish rules | Four steps: join, place, score/swap/pass, win; kit-specific bracket note |
| Alien Lab | Section subtitles were sometimes decorative rather than instructional | Direct choose-part headings; hide low-value hints, preserve useful distinctions |
| Alien Lab | Save instructions and status repeated lengthy assurances | Short, accurate save / unsaved wording and local SVG export description |
| Achievement Hangar | Profile selection and rewards were not prominent enough before a run | Mission Control points out that a pilot must be chosen **before playing** to keep earned cosmetics |
| Naming and release | “Local Crew” differed from “Local Match”; “ALPHA LAB” remained in game footers | Consistent mode name, remove alpha-phase wording |
| Keyboard | Rack shortcut text implied key 9 worked only after an upgrade | State **1–9** for available rack positions; larger racks remain clickable |

## Current, verified rules that student copy must preserve

| Topic | Actual rule |
| --- | --- |
| Tile kits | Launchpad and Orbit have 8 rack tiles (5 numbers, 3 operators). Nebula and Quantum have 11 (6 numbers, 3 operators, a linked bracket pair). |
| Brackets | A physical ( ) pair must be placed together in one scored equation or exchanged together. |
| Equations | One contiguous row or column, first equation across the centre, later equations connected to a locked tile. A real calculation is required; `3 = 3` is not enough. |
| Maths | BIDMAS. The `=` sign is unlimited and free. Blanks take a chosen number or operator and score zero base points. |
| Scoring | Tile values, premium-square multipliers, equation length, connecting locked tiles and rack-clearing bonuses can contribute. |
| Swaps | A one-tile exchange is free once each turn when the bag has a suitable replacement. Extra tiles or a bracket-pair exchange cost a turn. |
| Sector Run | Reach the escalating sector energy target in six turns. A new run replaces the existing same-mode save. |
| The Drift | Normally six turns per sector; Time Dilator adds a seventh. Salvage Bay offers up to four installed Ship Systems and two carried Mission Gadgets. Every third sector ends a named zone with a randomly assigned boss effect. |
| Multiplayer | Two to four players share the board. Local racks are hidden between handovers. Online racks stay private and server-side validation decides scores and match results. |
| Match ending | The match ends when someone clears their rack with an empty bag, or after two complete non-scoring circuits. Leftover rack tile points are deducted; top net score wins (ties allowed). |
| Achievements | Each mode has ten original permanent achievements, with three extra Alien Radio badges in Online Signal Clash. Students must bind a named pilot **before** starting a run/match/room for those rewards to be kept. Guest play remains possible. |
| Saving | Solo runs, Drift runs, avatars and achievements are stored on the device. Pilot progress does not sync across devices; the Hangar supports export/import backup. |

## Student-facing information architecture

- **Mission Control:** choose the mode and next game's kit; learn why a named pilot matters.
- **Sector Run:** first-run three-step guide; live board feedback shows what to place next.
- **The Drift:** first-run special rules and after-sector choices; the board teaches placement contextually.
- **Local Match:** player count, kit, optional timer and individual pilot choices; privacy overlay explains Ready before every handover.
- **Signal Clash:** one entry choice (create or join), obvious prematch Rules, a lobby indicating when the host can start and server-verified score feedback.
- **Alien Lab:** choose parts, choose colours, save; badges explain Free / Earned / Locked where shown.
- **Achievement Hangar:** create/select a pilot, browse one mode at a time and see challenges, progress and preview rewards. Backup lives with the profile settings.

## Automated launch gate

`tests/student-copy-audit.test.js` checks source facts, game-kit geometry, obsolete language, mode-specific essentials and instruction length. `tests/student-copy-audit-browser.mjs` exercises the real first-use dialogs and controls for all four modes, including the pre-match Signal Clash Rules, kit-specific bracket guidance, Alien Lab and Hangar. Existing layout/achievement/online privacy tests remain mandatory.

### Final human check before classroom launch

On at least one school laptop and one phone, ask a student who has never used the site to:
1. Create a pilot in Hangar, then return Home without help.
2. Choose Nebula and find how to place its linked brackets.
3. Start a Sector Run, score one equation and explain the free swap.
4. Open The Drift and identify the choice after a cleared sector.
5. Start a two-player Local Match without exposing the previous rack.
6. Create and join an online room on two actual devices and find the scoring rules before starting.
7. Return to Hangar and see which challenge earned the reward.

Record any step requiring unsolicited teacher explanation. Copy is ready for student release once **all CI checks pass** and these short manual smoke tests show no blockers.

**Boundary:** This is a user-facing instructional copy and first-use UX audit. It is not a change to game mechanics, a security certification or a guarantee of cross-device identity.
