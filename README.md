# CognitiveOS

A **cognitive load simulator**, not another to-do app. Lay out a day of tasks, meetings, alerts and deadlines; CognitiveOS estimates minute by minute how loaded your mind is, shows **what is driving it**, and lets you try a different way of working before you live it.

The model adds up six drivers of load, each tied to published research: task complexity, switching and attention residue, notifications, open loops, deadline pressure and fatigue. Because load is a sum, every "why?" answer is exact arithmetic, not an approximation.

> **Not a diagnostic tool.** CognitiveOS produces an estimate under stated assumptions. It does not measure anyone's ability and is not for monitoring other people. Values marked *stand-in* are chosen values awaiting calibration.

📄 **[Project documentation (PDF)](docs/CognitiveOS-Documentation.pdf)**: the science, the model, scenarios, screens, architecture and the 6-week plan, written before any code.

## Status

Weeks 1–4 of the [6-week plan](docs/CognitiveOS-Documentation.pdf) are complete, plus the landing page:

- [x] `params.ts`: every value the model uses, with its citation and a stand-in flag (19 sources in `sources.ts`)
- [x] Day file format (Zod), with overlap and bounds checks
- [x] Deterministic minute-step engine: seeded alert arrivals, switches with attention residue, alert detours, batching and quiet windows, open loops, deadlines that ease as work gets done, fatigue that drains on breaks
- [x] Exact per-minute explanations: driver shares plus the events still contributing ("Switched from Code to Report at 11:05, still leaving residue")
- [x] Levers as pure functions: batch alerts, write plans, cluster meetings, add breaks, mute alerts, quiet windows, drop or hand over a task
- [x] Scenario library: the sample day plus six people, each with a lever and a checked expectation
- [x] Property tests (fast-check): deterministic, shares add up, bounded, more alerts never help, plans never hurt, breaks never add fatigue, fast enough to re-simulate while dragging
- [x] Scroll-driven 3D landing page (three.js): nine vignettes, including the sample day as a 3D landscape built from the real engine output, morphing into its what-if
- [x] The crew: six original mascots, one per driver (Brainy, Flip, Ping, Loopy, Tick, Yawn), drawn in code with moods from calm to frazzled; they walk across the hero and react to load in the app
- [x] Week 3: Day Builder (`/app.html`): drag to move, drag edges to resize, drag past a neighbour to swap, click a lane to add, full keyboard control; the engine re-runs in a Web Worker as you drag
- [x] Week 4: Load chart on the same time scale as the timeline, scrubbable cursor, the crew panel and an exact "why?" card, zone minutes and driver shares, alert and open-task controls, the scenario library with a one-click lever
- [ ] Week 5: What-If Lab (side-by-side compare, each lever's share of the change)
- [ ] Week 6: NASA-TLX check-in, polish, deploy

One honest result already: in the *chopped-up maker* scenario, clustering meetings cuts morning switches but creates one long hard block, so fatigue rises. Breaks win part of it back. The test suite checks for that trade-off rather than pretending every lever is a free win.

## Run it

```bash
npm install
npm run dev        # landing page at http://localhost:5173 · simulator at /app.html
npm test           # engine tests (Vitest + fast-check)
npm run build      # typecheck + production build
npm run docs       # rebuild the documentation PDF (needs Chrome)
```

## Layout

```
src/engine/        the model: pure TypeScript, no UI imports
  params.ts        every number, with its source and stand-in flag (single source of truth)
  sources.ts       the 19 references
  schema.ts        day file format (Zod)
  simulate.ts      minute-step tick loop
  explain.ts       exact "why?" for any minute
  summary.ts       zone minutes, driver shares
  levers.ts        what-if transforms (pure Day → Day)
src/scenarios/     the sample day and the six-person scenario library
src/characters/    the crew (canvas-drawn mascots and cards) and the walking crowd
src/app/           the simulator: Day Builder, load chart, crew and why panels
src/landing/       scroll-driven 3D landing page (three.js scene + chapters)
docs/              project documentation (HTML source + PDF)
```

The figures in the PDF come from an earlier 90-line prototype (`docs/source/model.mjs`), so their numbers differ slightly from the engine in `src/engine`. The landing page uses the real engine.

## Credits

- The walking crowd adapts Skiper UI's *Skiper 39 · Canvas_Landing_004* CrowdCanvas ([skiper-ui.com](https://skiper-ui.com), by @gurvinder-singh02), itself inspired by [zadvorsky's CodePen](https://codepen.io/zadvorsky/pen/xxwbBQV). Its walkers are the CognitiveOS crew rather than Open Peeps.
- Animation by [GSAP](https://gsap.com) (standard no-charge licence); 3D by [three.js](https://threejs.org).
- Visual style shared with [my portfolio](https://ananyapenumudi-ops.github.io/).

© 2026 Ananya Penumudi.
