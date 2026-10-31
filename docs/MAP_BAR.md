# Map Progress Bar Simulator (dev only)

`/dev/map-bar` draws a progress bar out of the history course's map parts — room
icons, the ancient node, path dots, the clockwise arrival ring and the character
marker — and plays it deterministically, so `pnpm shorts:capture` can turn it
into transparent frames for slseoun-shorts (the brief is
`~/P/slseoun-shorts/docs/map-sim-brief.md`, R1–R13). It is not a map: no map
backdrop, no side nodes, no camera. Labels such as version names are not drawn;
the bar exposes anchors for the shorts to place them.

It works like the combat simulator (`docs/COMBAT_SIM.md`): the page renders
only when `process.env.NODE_ENV === "development"` and calls `notFound()`
otherwise, so a production build drops its dynamic import; it is noindex and
not in the sitemap or search index, and the navbar lists it (패치/운영 → 맵 진행
바 시뮬레이터) only on the dev server, like the combat simulator. A preset page
links back to the preset list. To check a production build, grep the emitted JS (`.next/static`,
`.next/server`) for `untouchable-history` or
`data-map-bar-stage`: they must appear only under `.next/dev`.

- Engine (pure, no DOM): `src/lib/map-bar/` (`engine.ts`, `types.ts`,
  `scenarios.ts`).
- Map parts: `src/components/map/map-parts.tsx`, shared with the history
  course's `SeededMapView` (moved there unchanged), with the numbers and icon
  names in `src/lib/sts2-map-geometry.ts` and `src/lib/sts2-map-icons.ts`.
- Page: `src/app/(main)/dev/map-bar/`.
- Test: `pnpm test:map-bar` (`scripts/map-bar.spec.ts`: layout per
  orientation, timeline windows, outcome icons, given arrivals, query parsing).

## Input

One object, given as `?json=<url-encoded JSON>`, as `?preset=<name>`
(`src/lib/map-bar/scenarios.ts`), or as query keys; query keys override the
preset and JSON.

| Key | JSON | Query | Notes |
| --- | --- | --- | --- |
| nodes | `[{ "type": "ancient" }, { "type": "unknown", "outcome": "monster" }]` | `nodes=ancient,unknown:monster,unknown` | R1. `type`: ancient, unknown, monster, elite, shop, chest, rest. Edges join neighbors. Per node `transitMs` and `holdMs` override the defaults (JSON only). |
| outcome | (per node) | `unknown:<outcome>` | R4. Only for `unknown`: monster, elite, shop, chest, rest, event, unknown. The engine maps, it does not judge. `unknown` arrives without revealing; `rest` is not a game reveal and is marked `synthetic` (R5). |
| start | `"before"` | `start=on` | `before` (default): the walk begins by arriving at node 0 — nothing stands on the bar until the marker pops there (no dots lead to it; the ring and pop do). Shorts open on the element before its first patch, so the bar needs no start node. `on`: the marker stands on node 0 from t = 0 (a start node such as an ancient) and transits begin with node 1. |
| orientation | `"vertical"` | `orientation=vertical` | R2. horizontal: left to right, marker below. vertical: bottom to top as the game map climbs, marker on the right. Icons stay upright; the dots turn with the path. |
| width, height | `720`, `140` | `width=720` | R8. Frame px, 1:1 with the PNG. Defaults fit the nodes: 160 px between nodes at scale 0.6, room for the rings and the marker. |
| reach | `2` | `reach=2` | R3. Last node the marker reaches. Default: the last node that is not a `?` without an outcome, so a trailing `?` stays ahead. |
| arrivals | `[2000, 5000, 8000]` | `arrivals=2000,5000,8000` | R7. Per node index, the time (ms) the marker pops and a `?` reveals (transit progress 0.92); with `start=on` index 0 is ignored (`arrivals=,2000,...`). A missing entry follows the previous transit plus hold. An arrival too close to the previous transit shortens the transit (warning). |
| lead | `500` | `lead=500` | Before the first transit when its arrival is not given. |
| transitMs | `2500` | `transit=1400` | R6. Default 2500, the history course's `NODE_BASE_MS`. |
| holdMs, tail, duration | `1000` | `hold=`, `tail=`, `duration=` | Between transits; after the last one (default `holdMs`); or the total. |
| scale | `0.6` | `scale=0.9` | Map scale; 0.6 is the history course's size. Everything scales with it. |
| ancientScale | `1` | `ancientScale=0.5` | Ancient node size relative to the map's (the history course draws it 125 px at 0.6). |
| ancient | `"neow"` | `ancient=orobas` | Ancient node art. |
| act | `"overgrowth"` | `act=hive` | Icon set and path colors. |
| character | `"silent"` | `character=none` | Marker icon; none draws no marker. |
| revealPulse | `0.3` | `pulse=0` | The `?` icon grows by `1 + p·sin(π·pop)` while it reveals. Not in the history course or the game; 0 turns it off. The selection ring does not pulse. |
| padding, markerOffset | | `padding=`, `markerOffset=` | Space before the first and after the last node; marker distance from its node (default 0.55 node sizes, as in the history course). |
| background | `"transparent"` | `background=paper` | R8. `paper` fills the frame with the act's map color (opaque frames). |

View options (not part of the input): `t=<ms>|end` starts paused there,
`autoplay=1`.

## Timeline

Each transit into node *i* follows the history course's Phase 4
(`transitWindows`): dots on the edge into *i* paint over progress 0–0.70 (dot
*k* of *N* at *k/N*), the ring sweeps clockwise from 12 o'clock over 0.70–0.92,
and the marker pops on *i* over 0.92–1.00 (scale 0 → 1.15 → 1, opacity 0 → 1)
while it stays on *i − 1* before that. The first arrival (node 0 with
`start=before`) has no dots to paint and no marker to leave, as the history
course's step 1: the bar shows every node as an unvisited `?` until then.

| Node state | When | Look (history course) |
| --- | --- | --- |
| inactive | not reached yet | icon 0.52, outline 0.72, no ring, scale 0.95 |
| active (sweeping) | its transit until 0.92 | full opacity, no steady ring, scale 1; the sweep ring draws from 0.70 |
| current | from 0.92 until the next transit | steady ring, scale 1.08 |
| active | passed | ring at 0.92, scale 1 |

Scale changes ease over 0.3 s (CSS `ease`), as the node wrapper's
`transition-transform duration-300` does there. Departure from the history
course: a `?` shows its outcome at the arrival (0.92), not when its transit
starts. The ancient node has no ring and no sweep.

Events (`window.__bar.events`, `frames.json`): per reached node `depart`,
`ring` (0.70, rooms only), `arrive` (0.92), `reveal` (same time, with the icon
and `synthetic`), `settle` (1.0); with `start=on` also `start` on node 0 at 0.

`untouchable-history` (rework-untouchable): `?` → monster (0.100.0), `?` →
monster (0.102.0), `?` → chest (0.104.0), and the next version still `?`.
Defaults give arrivals at 2800, 6300 and 9800 ms and an 11 s timeline.

Outcome icons: monster → `map_unknown_monster`, elite → `map_unknown_elite`,
shop → `map_unknown_shop`, chest → `map_unknown_chest`, event and unknown →
`map_unknown`, rest → `map_rest` (synthetic).

## Capture

`window.__bar`: `ready()`, `seek(t)`, `state()`, `play()`, `pause()`,
`frameTimes(fps)`, `duration`, `events`, `anchors` (node centers, sizes and
marker spots in frame px), `width`, `height`, `input`. `state()` gives the
transit, the marker (node, x, y, scale, opacity), the ring (node, angle) and
per node its state, icon, reveal, synthetic flag, scale, pulse and painted
dots.

```bash
pnpm shorts:capture --url "/dev/map-bar?preset=untouchable-history" --frames --fps 30 --out ~/P/slseoun-shorts/<dir>/bar
pnpm shorts:capture --url "/dev/map-bar?preset=untouchable-history&orientation=vertical" --t 6300 --out ~/P/slseoun-shorts/<dir>/bar.png
```

Frames are transparent PNGs at the bar's size (device scale 1). The capture
keeps only the stage painting (`visibility` on everything else) over a
transparent default background set once through CDP, instead of
`omitBackground` per shot, and otherwise seeks like the combat simulator
(software raster, the stage repainted from nothing at every seek), so the same
input and time give byte-identical PNGs. `frames.json` adds `events`,
`anchors`, `synthetic` and per frame `states`; a single shot's sidecar adds
`events`, `anchors` and `state`.

## Not done

- Labels and their values (version names): the shorts draw them on the anchors.
- R14 (the node's last scene after a reveal).
- Boss nodes, map backdrop, side nodes, camera.
