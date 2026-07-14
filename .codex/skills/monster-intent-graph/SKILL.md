---
name: monster-intent-graph
description: Extract, verify, mock up, implement, or revise Slay the Spire 2 monster intent FSM graphs and phase layouts. Use when changing monster move-pattern extraction, intent graph routing, start nodes, random or conditional transitions, reversible phases, progressive boss phases, Graphviz mockups, or representative intent-graph QA in scare-the-spire.
---

# Monster Intent Graph

Treat the game DLL/PCK and extracted locale as the source of truth. Use Graphviz
only as an offline layout oracle; ship hand-authored SVG geometry and existing
static game assets, not a Graphviz runtime dependency.

Read [references/layout-rules.md](references/layout-rules.md) before changing a
graph, phase classifier, or route.

## Workflow

1. Inspect `data/sts2/{kor,eng}/monsters.json` and the matching decompiled
   `MegaCrit.Sts2.Core.Models.Monsters/*.cs` source. Confirm the initial state,
   follow-ups, random repeat rules, conditions, and lifecycle callbacks.
2. Fix extraction before presentation when the extracted graph disagrees with
   source. Never hand-correct a probability or transition for visual
   convenience.
3. Normalize the graph into action states, transition edges, a visible start
   entry, and optional phase containers.
4. Classify action topology and phase topology separately. Derive the class
   from graph structure and source semantics, not the monster ID.
5. Generate a Graphviz mockup with final node dimensions and placeholder game
   assets. Review edge size, ports, labels, crossings, and phase direction.
6. Reproduce the accepted geometry in the TypeScript renderer with cubic SVG
   paths. Keep arrowhead and edge colors identical and omit `100%` labels.
7. Add representative Playwright assertions for topology, direction, start
   visibility, labels, overlap, and mobile containment.

## Classification

- **No phase container**: terminal, one-way sequence, fixed cycle, or random
  cluster without a lifecycle or combat-mode boundary.
- **Reversible conditional phases**: combat can move between phase containers
  in both directions after reevaluating a condition. Stack phase containers
  vertically and show both directed phase transitions. Fabricator's
  `CanFabricate` / `!CanFabricate` modes are the reference case.
- **Progressive phases**: leaving a phase is irreversible during the fight.
  Place phase containers left to right and show only forward connectors.
  Test Subject's death-and-respawn forms are the reference case.

Use strongly connected components as evidence, but include lifecycle state
changes that occur outside `FollowUpState` (death, respawn, summoned ally death,
or immediate move replacement). Do not mistake disconnected extracted loops for
independent phases before checking those callbacks.

## Iteration Rule

When a newly audited monster does not fit, update this skill's classification or
layout rule and the generic implementation before adding per-monster behavior.
Allow a monster-ID exception only when the game source itself is structurally
irregular and the exception cites that source in code and tests.

## Cloudflare Boundary

Keep graph derivation in extraction/build steps or bounded client-side geometry.
Do not parse all monsters, run Graphviz, or perform layout search in a Worker
request. Reuse extracted static JSON and existing game assets.
