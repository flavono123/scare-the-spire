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
- Self-loops remain compact at desktop and mobile scales.
- Edge labels do not overlap arrowheads, nodes, or other labels.
- Desktop and all repository mobile presets keep the graph pannable and
  contained.
