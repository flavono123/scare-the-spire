# Combat Simulator (dev only)

`/dev/combat-sim` plays a short, deterministic combat on a 1080x1920 portrait
stage so `pnpm shorts:capture` can turn it into frames for slseoun-shorts.
It exists only on the dev server: the page renders when
`process.env.NODE_ENV === "development"` and calls `notFound()` otherwise, and
that check is inlined at build time, so production drops the dynamic import
and emits no engine or scene chunk. It is not in the sitemap, nav or search
index, and `robots` is noindex. To check a production build, grep the
emitted JS (`.next/static`, `.next/server`, `.open-next/server-functions`) for
strings such as `doormaker-grasp-0.102.0` or `data-combat-sim-stage`: they
must appear only under `.next/dev`.

- Engine (pure, no DOM): `src/lib/combat-sim/` (`engine.ts`, `timeline.ts`,
  `card-effects.ts`, `hooks.ts`; `catalog.ts` builds the per-version data on the
  server).
- Scene: `src/app/(main)/dev/combat-sim/`.
- Test: `pnpm test:combat-sim` (`scripts/combat-sim.spec.ts`, engine only).
- Assets: `python3 scripts/extract-combat-ui-assets.py --archive-version 0.102.0`
  writes `public/images/sts2/combat-ui/**` and `data/sts2/combat-ui-assets.json`
  (energy counter layers, pile buttons, block icon, archived power icons).

## Input

One object of top-level axes, given as `?json=<url-encoded JSON>`, as
`?preset=<name>` (`src/lib/combat-sim/scenarios.ts`), or as query keys. Query
keys override the preset and JSON.

| Key | JSON | Query | Notes |
| --- | --- | --- | --- |
| version | `"0.102.0"` | `version=0.102.0` | Values and text via `getVersionedEntity`; card TargetType, move intents the versioned monster lost, and GRASP_POWER/WEIGHTED text come from `~/sts2-builds/<version>/canonical`. |
| character | `"SILENT"` | `character=SILENT` | HP and max energy from character data. Optional; required by the `player` and `cards` parts. |
| parts | `["player", "cards"]` | `parts=player,cards`, `parts=none` | What the stage shows and the server loads. The encounter (background, monsters, intents, monster HP) is always there; `player` adds the character and its HP bar, `cards` the hand, piles, energy orb and card play. Default: both with a character, none without (encounter only). Without `cards`, no card data, affliction text, energy counter, card trail or energy VFX is loaded and card actions are skipped. |
| encounter | `"DOORMAKER_BOSS"` | `encounter=AXEBOTS_NORMAL` | Composition from the archived `Encounters/<Name>.cs`, else site data. |
| energy, maxEnergy | `3`, `3` | `energy=3/3` | |
| hp | `70` | `hp=40` | Player current HP. |
| hand, drawPile, discardPile, exhaustPile | `["PREPARED+", "STRIKE_SILENT*5"]` | `hand=ACROBATICS,PREPARED+`, `draw=…`, `discard=…`, `exhaust=…` | `+` is upgraded, `*N` repeats. Order is kept; draws take `drawPile[0]` first. |
| powers | `{ "DOORMAKER": ["GRASP_POWER:1"], "player": [] }` | `powers=DOORMAKER=GRASP_POWER:1` | Key: `player`, a monster id, or a monster index. Applied at setup, so `AfterApplied` runs. |
| moves | `{ "DOORMAKER": "GRASP" }` | `moves=DOORMAKER=GRASP` | Current move (intent); default is the move graph's initial move. |
| relics | `[]` | — | Accepted, ignored. |
| seed | `1` | `seed=7` | Only used to reshuffle the discard pile into an empty draw pile. |
| script | see below | `script=wait:600,play:ACROBATICS,…` | |

Script actions:

| JSON | Query token | Effect |
| --- | --- | --- |
| `{ "do": "play", "card": "PREPARED+", "target": 0, "choose": ["STRIKE_SILENT"] }` | `play:PREPARED+@0>STRIKE_SILENT\|STRIKE_SILENT` | Play the first hand card with that id and upgrade state. `choose` names the cards a discard prompt picks (from the right of the hand); without it the rightmost cards are discarded. |
| `{ "do": "endTurn" }` | `end` | Hand to discard; Retain stays, Ethereal exhausts. |
| `{ "do": "monsterTurn" }` | `monsters` | Each monster runs its current move's attack intents, then follows its move graph. |
| `{ "do": "startTurn" }` | `start` | Block clears, energy refills, draw 5. |
| `{ "do": "addCard", "card": "SHIV", "pile": "hand" }` | `add:SHIV@hand` | A card enters combat; runs `AfterCardEnteredCombat`. |
| `{ "do": "wait", "ms": 600 }` | `wait:600` | |

Encounter-only scenes (e.g. `preset=axebots-0.103.2` vs `axebots-0.104.0`,
or `?version=0.103.2&encounter=AXEBOTS_NORMAL&script=wait:2000`) move the
encounter down, give the monsters the full width and grow the background.

View options (not part of the input): `t=<ms>|end` starts paused there,
`autoplay=1`, `frame=<css width>` (default 360), `badges=1` shows
unimplemented/rejected tags in the frame (the dev panel log always lists them).

## Rules implemented

Read from the archived build source (`~/sts2-builds/<version>/src`), checked
against 0.102.0:

- Card play order (`PlayCardAction`, `CardModel.OnPlayWrapper`): `CanPlay`
  (Unplayable keyword, energy), pay energy, hand -> play, affliction `OnPlay`,
  `CustomScaledWait(0.25-0.35s)` (300 ms), `BeforeCardPlayed`, the card's
  effect, `AfterCardPlayed`, then the result pile: Power is removed, Exhaust
  keyword exhausts, otherwise discard.
- Draw (`CardPileCmd.Draw`): one at a time from the top, stops at 10 cards in
  hand; an empty draw pile takes the discard pile shuffled (seeded RNG, not the
  game's `Rng.Shuffle` order).
- `PlayerCmd.LoseEnergy`: clamps at 0.
- Damage removes block first, then HP. Strength/Weak/Vulnerable and
  Dexterity/Frail are not applied; when present the step is tagged unimplemented.

Card effects (`card-effects.ts`; numbers come from the versioned card vars):

| Op | Cards |
| --- | --- |
| draw N, then discard N chosen | ACROBATICS (draw Cards, discard 1), PREPARED (draw/discard Cards) |
| block | DEFEND_* (all five), SURVIVOR (then discard 1) |
| damage to target | STRIKE_* (all five), NEUTRALIZE (Weak tagged unimplemented) |

Any other card pays its cost and goes to its result pile; its effect is shown
as "미구현: <card> 효과".

Power and affliction hooks (`hooks.ts`):

| Id | Hook | Rule | Checked builds |
| --- | --- | --- | --- |
| GRASP_POWER | AfterApplied | Afflict every player card without an affliction with WEIGHTED(Amount) | 0.102.0–0.104.0 |
| GRASP_POWER | AfterCardEnteredCombat | Same, for the entering card | 0.102.0–0.104.0 |
| GRASP_POWER | AfterRemoved | Clear WEIGHTED from every card | 0.102.0–0.104.0 |
| WEIGHTED | affliction OnPlay | `PlayerCmd.LoseEnergy(Amount)` | 0.102.0–0.104.0 |

Other hook points (`beforeCardPlayed`, `afterCardPlayed`) are wired but no power
uses them yet. A rule used outside its checked builds adds a warning.

Monster turn: single and multi attack intents deal `damageValues[key].normal`
x repeat; every other intent (buff, debuff, summon, phase power swaps) is
tagged unimplemented.

## Scene and capture

Everything on the stage follows the 0.102.0 node code and scenes; the only
deliberate departures are for the 9:16 frame and are marked "9:16" below.

- Layout (`stage-layout.ts`): game UI geometry times `UI_SCALE` (1.15), pinned
  to the same screen corners: draw / discard / exhaust piles and their 80x80
  buttons, the hand anchored at the bottom center with the game's per-count
  slot table (x, y, angle) and scale 0.8. 9:16: hand x offsets are squeezed when
  a slot would leave the 1080-wide stage, the energy orb is raised to clear the
  hand, and the play position sits between the creatures and the hand instead
  of the screen center.
- Timeline (`timeline.ts`): beat lengths are what the game awaits (0.25 s per
  draw, 0.25 s play tween, CustomScaledWait 0.3 s, discards about a frame since
  the flight is not awaited, instant energy). `select` is the simulator's
  stand-in for the player lifting the card (hover pose, 0.3 s).
- Card motion (`card-motion.ts`): NHandCardHolder lerps (k 7 / 8 / 10) for
  every hand change; draws spawn at the draw pile at scale 1; the played card
  tweens to the play position at scale 0.8 (Cubic Out); discards and the result
  pile fly on NCardFlyVfx arcs (seeded speed, acceleration, duration, arc),
  darkening and shrinking, then pile counts rise on arrival with the button
  bump (1.25 -> 1, 0.5 s Expo Out). Exhaust fades the card over 0.3 s.
- VFX (`vfx-layer.tsx`): the character's card trail (both Line2D trails with
  width curves, gradients and the texture's cross profile; silhouette sprites;
  BigSparks / LittleSparks), and the energy gain glow and polar ring with their
  curves. NDamageNumVfx damage numbers. Particle randomness is seeded per event.
- Cards: CardTile, with the Weighted overlay (a CPU port of
  `devoured.gdshader` with `weighted.tscn` uniforms) in the tile's affliction
  slot, the slot card.tscn's OverlayContainer occupies: above the frame and
  portrait border, below banner, plaque and cost. Checked against 0.103.x
  gameplay footage (crimson frame, ragged crimson edge in the description box,
  clean art, title and cost). Playable cards get the teal highlight (on 0.5 s
  Cubic Out, off 0.5 s Linear); unplayable costs turn #FF5555 / #501717.
- Energy orb: the counter scene's layers; rotation layers turn
  `(i + 1) * 30 deg/s` (5 at 0 energy); at 0 the layers dim (`energy_orb_dark`)
  and the label turns red. Spending energy has no animation in the game
  (NEnergyCounter only refreshes the label); gains restart the back/front VFX.
- Health bar (`health_bar.tscn`): nine-patch background, block outline and
  fill textures with their modulate colors, the clipping mask, the lagging
  middleground (holds 1 s, then 1 s Expo Out), Kreon Bold 24 label with glyph
  spacing 1 and outline 16 (#900000, #1B3045 with block), block icon and label.
- Spine actors (`spine-actor.tsx`) rebuild their pose from the cue list on
  every `t` (physics reset, not simulated). Doormaker and other still-art
  monsters use `monster-static-art.ts` by current move.
- `window.__sim`: `ready()`, `seek(t)`, `step()`, `play()`, `pause()`,
  `state()`, `frameTimes(fps)`, `duration`, `actionEnds`, `input`.

```bash
pnpm shorts:capture --url "/dev/combat-sim?preset=doormaker-grasp-0.102.0" --t 3190 --out ~/P/slseoun-shorts/<dir>/grasp.png
pnpm shorts:capture --url "/dev/combat-sim?preset=doormaker-grasp-0.102.0" --frames --fps 30 --out ~/P/slseoun-shorts/<dir>/frames
```

The stage is 360x640 CSS px and the capture's device scale is 3, so every
PNG is 1080x1920. A frame sequence writes `0000.png...` and `frames.json`
(times, input, final state). Same input and time give byte-identical PNGs.

## Not simulated or not ported

- Rules: relics, potions, rewards, most enemy AI, damage modifiers, card
  generation by effects.
- UI: the hand's discard-selection mode (the simulator picks and discards
  without the selection screen), the "not enough energy" thought bubble, the
  card highlight's SDF ripple (a soft band stands in), the card shadow, the
  exhaust ash particles, the reshuffle's silhouette-only flight (cards fly like
  discards), the energy gain ribbons / specks / flipbooks (listed per character
  in `combat-ui-assets.json` `notExported`), and NDamageBlockedVfx.
