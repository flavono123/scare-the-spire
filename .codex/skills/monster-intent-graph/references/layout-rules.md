# Intent Graph Layout Rules

## Evidence order

1. Decompiled monster state machine and lifecycle callbacks
2. Extracted `move_graph`, move details, and encounter composition
3. Korean game locale, then English game locale
4. Graphviz mockup geometry
5. Hand-authored SVG implementation

Do not promote an inferred edge to certain when the source or extraction is
partial. Fix the extractor or retain a partial-data notice.

## Visual grammar

- Render the entry as localized service text only: `시작` in Korean and
  `Initial` in English. It is an entry marker, not an action state, and must
  not use a game icon or button asset.
- Render action states with the existing `hover_tip.png` tooltip frame and show
  official Korean above official English.
- Resolve attack and block values from each extracted `intent_details` key
  before any legacy move-ID heuristic. Show the matching in-game intent asset
  and effective number in the action state; a valid attack must not degrade to
  a text-only node because its move ID differs from its damage key.
- Reuse the Intent Graph mod palette exactly: gold `#EFC851` for normal edges
  and labels, red `#FF4545` for conditional and phase-transition edges, cyan
  `#29EBC0` for group and phase borders, and translucent dark blue
  `rgba(26, 36, 56, 0.55)` for group and phase backgrounds.
- Use the same color for every edge and its arrowhead.
- Use cubic curves. Avoid right-angle paths and paths hidden behind nodes.
- Omit `100%`. Put `50%` or other branch probabilities on the edge.
- Start all probability branches from the same visible source point when the
  underlying choice happens at one state.
- Put localized mode names such as `제작 가능` / `제작 불가` or
  `Can Fabricate` / `Cannot Fabricate` on cross-phase edges. Never abbreviate
  conditions as `Y` or `N`, and keep condition nodes out of the graph.
- Explain the exact game condition in a hover tooltip on the edge label. Derive
  the explanation from the decompiled predicate or lifecycle callback rather
  than guessing from the visible mode name.
- Attach self-loops to adjacent ports on the same node side. Keep the loop close
  to the node; do not span the full node width.
- Omit the redundant self-loop edge when a fixed cycle contains one action.
  The visible entry and fixed-cycle label already communicate the repetition.
- Route every non-self edge outside unrelated node rectangles. Approach the
  target from its left port with a left-to-right final tangent whenever the
  layout permits it, including return arcs.
- Route multiple entry branches from one shared source through separate outer
  lanes. Never let a farther entry edge pass behind an earlier action node.
- Treat spacing as part of the graph grammar, not a per-monster adjustment.
  For the generic renderer, keep action nodes at least 80 px apart horizontally
  and 48 px vertically when their rectangles share the other axis. Keep action
  nodes at least 24 px inside a group or phase border.
- Keep an external edge lane at least 24 px from a parallel group or phase
  border. Cross a border only on the way to or from a contained state, with a
  predominantly perpendicular tangent; never track along the border.
- Give shared outer corridors separate lanes. Use at least 40 px between lanes
  when both carry probability or condition labels, and keep distinct approach
  lanes until the final target segment instead of merging paths early.
- Keep edge-label rectangles clear of container borders and other labels. Use
  10 px as the minimum rendered border clearance and do not stack duplicate
  probability labels at the same coordinates.

## Motion and edge focus

- Show direction with an animated SVG dash offset that moves from the source
  toward the target. Keep the solid base edge faint so the moving dashes remain
  legible without changing the Intent Graph mod color.
- Animate with CSS, not React state or `requestAnimationFrame`. A detail page
  renders one graph, so confirm the maximum transition count in extracted data
  and keep the number of simultaneous animations bounded by that count.
- Respect `prefers-reduced-motion: reduce`. Retain a static dashed edge and its
  arrowhead, but remove all dash-offset animation.
- Give each edge a transparent, approximately 18 px hover stroke below action
  nodes and labels. Provide the same focus behavior from its keyboard-focusable
  probability or condition label.
- On hover or focus, redraw the selected edge in a dedicated layer above
  unrelated nodes and base edges but below labels. Add a dark under-stroke,
  preserve the edge and arrowhead color, and highlight both source and target
  nodes with that same color.
- Dim unrelated edges, labels, containers, entries, and nodes with opacity and
  saturation. Avoid background blur: it adds paint cost and makes game text
  harder to read.
- Keep source and target nodes above the focused edge so their tooltip frames
  remain intact. Never let the interaction stroke block node clicks or label
  focus.
- Prototype motion and focus on one dense representative graph before enabling
  them globally. Verify pointer hover, keyboard focus, reduced motion, passive
  playback frames, and every repository mobile preset before rollout.

## Phase direction

### Reversible conditional phases

Stack containers top to bottom. Center a narrower lower container under the
upper container. Draw both phase directions on opposite sides so they do not
overlap. Keep action transitions inside their owning container.

Fabricator evidence:

- Encounter starts with Fabricator alone, so the visible start enters the
  `CanFabricate` phase.
- `CanFabricate` is true while the number of living teammates is below four.
- Every move returns to the same conditional branch, so the fight may move from
  either mode to the other on a later turn.

### Progressive phases

Place containers left to right in combat order. Draw phase connectors only to
the right. Never add a return connector unless the game source can restore an
earlier phase.

Order actions inside each container from that phase's actual entry target,
then follow the in-phase transition cycle. Do not expose Tarjan/SCC discovery
order in the UI; disconnected later phases often have no useful global
reachability order until lifecycle transitions are included.

Test Subject evidence:

- Phase 1 alternates Bite and Skull Bash.
- The first death schedules Respawn and enters the repeating Multi-Claw phase.
- The second death schedules Respawn and enters the Lacerate, Big Pounce,
  Burning Growl cycle.
- The third form removes the revival power, so no edge returns to an earlier
  form.

Represent lifecycle-only transitions with the official move name on the phase
connector when they are not ordinary `FollowUpState` edges.

## Graphviz mockup defaults

Use `dot` with `compound=true`, `newrank=true`, and `splines=spline`. Set final
node dimensions before judging routes. Prefer `headport` and `tailport` or port
suffixes such as `node:w -> node:nw` to constrain attachments. Prefer `xlabel`
for self-loop labels so the label does not inflate the loop during layout.

Treat Graphviz output as a routing sketch. Copy the accepted ports and curve
envelope into cubic SVG paths; do not copy Graphviz-generated styling or add a
runtime dependency.

## Review checklist

- Entry marker is visible and reaches the true first choice or action.
- Every action and label comes from extracted game data.
- Every edge has a source-code path or is explicitly partial.
- Phase direction matches reachability: vertical reversible, horizontal
  progressive.
- No edge crosses a node or obscures Korean/English text.
- Node, container, edge-lane, and label clearances meet the common spacing
  tokens; inspect rendered rectangles and sampled SVG paths rather than judging
  only the TypeScript coordinates.
- Branches from the same state share one origin, and every non-self arrow enters
  with an unambiguous left-to-right final tangent when the layout permits it.
- Every extracted attack or block intent renders its game asset and value.
- Self-loops remain compact at desktop and mobile scales.
- Edge labels do not overlap arrowheads, nodes, or other labels.
- Desktop and all repository mobile presets keep the graph pannable and
  contained.
