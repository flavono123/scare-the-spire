# Node Simulator (dev only)

`/dev/node-sim` plays a deterministic scene of a map node that is not a combat (today: the Blitz
merchant room) on the same 1080x1920 stage as [`/dev/combat-sim`](COMBAT_SIM.md), so
`pnpm shorts:capture` records it frame by frame for slseoun-shorts. Same rules as the combat
simulator: the page renders only when `process.env.NODE_ENV === "development"` (the check is
inlined at build time, so production drops the dynamic import and emits no node-sim chunk), it is
not in the sitemap, nav or search index, and `robots` is noindex. To check a production build,
grep the emitted JS for `data-node-sim-stage`: it must appear only under `.next/dev`.

- Engine (pure, no DOM): `src/lib/node-sim/` (`blitz-merchant.ts`, `loc-format.ts`, `scenarios.ts`).
- Scene: `src/app/(main)/dev/node-sim/` (`blitz-merchant-stage.tsx`, `game-hover-tip.tsx`, `placed-spine.tsx`).
- Test: `pnpm test:node-sim` (`scripts/node-sim.spec.ts`, engine only).
- Assets: `python3 scripts/extract-blitz-merchant-assets.py --archive-version 0.113.0` writes
  `public/images/sts2/blitz-merchant/**` (entry icons, tray tokens, rug, enchantment icons),
  `public/spine/sts2/blitz-merchant/**` (merchant, merchant hand, each character's `<c>_shop`
  atlas; the character skeletons already shipped for combat are reused) and
  `data/sts2/blitz-merchant.json` (kor/eng lines and the layout read from the scenes).

## Capture

```bash
# One entry: the room, the inventory opening, that entry hovered with its tooltip (about 4.3 s)
pnpm shorts:capture --url "/dev/node-sim?preset=blitz-merchant-card_enchant" --frames --fps 30 --out ~/_NOAV/P/slseoun-shorts/<dir>/card_enchant
# All 20 entry types in enum order, one frame directory each (01-card_upgrade ... 20-full_heal_and_max_hp):
# copy the batch file to the output directory first; a batch writes next to its file.
cp scripts/shorts-batches/blitz-merchant-tour.json ~/_NOAV/P/slseoun-shorts/<dir>/
pnpm shorts:capture --batch ~/_NOAV/P/slseoun-shorts/<dir>/blitz-merchant-tour.json
# A still of the hovered entry, English
pnpm shorts:capture --url "/dev/node-sim?preset=blitz-merchant-glam&locale=eng" --t end --out glam.png
```

The capture treats the page like the combat simulator: `frame=1080` at device scale 1, the same
seek-and-repaint per frame, `frames.json` with times, `actionEnds`, `input` and the final state.

## Input

Query keys, a `?preset=<name>`, or `?json=<url-encoded JSON>` (query keys win over JSON, JSON over the preset).

| Key | Example | Notes |
| --- | --- | --- |
| node | `blitz_merchant` | The only node so far (`NODE_TYPES` in `scenarios.ts`). |
| preset | `blitz-merchant-card_enchant` | `blitz-merchant-<entry>` for each of the 20 entry types (snake case), and `blitz-merchant-browse` (hover slots 1 to 6, buy slot 6). Without a preset: `entry=X` starts from X's scene, anything else from browse. |
| version | `0.113.0` | The data is 0.113.0's; another version warns. |
| locale | `kor`, `eng` | Game text and font (kor: GyeonggiCheonnyeonBatang, eng: Kreon). |
| seed | `1` | Draws the stock, CardEnchant's enchantment and the prismatic character. |
| character | `IRONCLAD` | The player's merchant pose; excluded from the prismatic draw. IRONCLAD, SILENT, DEFECT, REGENT, NECROBINDER, FOOL. |
| act | `overgrowth` | Room background: overgrowth, hive, glory, underdocks. |
| entry | `card_enchant`, `CardEnchant` | The stock must hold this entry: the seed is advanced until a draw has it (warned). |
| entries | `CardUpgrade,Relic,Potions,CardRemoval,CardRewards,Glam` | The six slots, in order (warns when it breaks the game's 5 + 1 cursed rule). |
| enchant | `SHARP` | CardEnchant's enchantment: SHARP 2, NIMBLE 3, ADROIT 3, STEADY 1, SWIFT 2, VIGOROUS 5. |
| prismatic | `NECROBINDER` | PrismaticCardReward's character. |
| open | `1` | Start with the inventory open (no room shot). |
| script | `wait:500,open,hover:CardEnchant,wait:2500` | Actions below, comma separated. |

Script actions (an entry is its type, snake or Pascal case, or its slot 1 to 6):

| Token | Effect (0.113.0 source) |
| --- | --- |
| `wait:<ms>` | |
| `open` | `NMerchantInventory.Open`: backstop to 80% black (1.0 s Sine InOut), rug from y -1000 to 80 (0.7 s Quint Out), back button in (0.35 s Back Out). Lasts 1 s. |
| `close` | Backstop out (0.8 s), rug up (0.5 s Cubic Out), back button out. Lasts 0.8 s. |
| `hover:<entry>` | `NMerchantSlot.OnFocus`: the slot scales to 1.1 (0.05 s), `NBlitzMerchantSlot.CreateHoverTip` shows the tips right of the hitbox (left for the third column), the merchant hand points at the slot. Lasts 0 ms; follow it with a wait. |
| `unhover` | Scale back to 1 (0.5 s Expo Out), tip gone, the hand returns after 2 s. |
| `buy:<entry>` | The entry is used (icon and tray token hidden), choices go down by one (Cursed Choices adds two); at 0 every other entry is disabled (DarkGray). The selection screen the entry opens is not simulated. |

View options: `t=<ms>|end`, `autoplay=1`, `frame=<css width>` (default 360), `zoom=full|fit|<n>`
and `camera=<x>`. The stage is a 9:16 window onto the 16:9 game screen: `zoom=full` (default,
1920/1080) shows the screen's full height and 607 game px of its width; the camera cuts to frame
the hovered slot with its tip (tip fully in view), shows the merchant before the inventory opens
and the first hovered slot while it opens. `zoom=fit` shows the whole screen width letterboxed;
`camera=<x>` pins the left edge (game px). Nothing outside the 1920x1080 screen is drawn.

`isolate=1` draws only the first hovered slot (icon, its 25% shadow, the 1.1 hover scale), its tip set and the
merchant hand over a plain `#09090b` stage (no room, backstop, rug, other slots, selection line or back button).
The slot and its tip set are centred as one group at a fixed 1.5 stage px per game px for every entry (the hand
comes in from the top); `zoom` and `camera` are ignored. The tips always sit right of the slot (the game puts them
left for the third column) so the object is at the same place in every cut. The slot is on stage from t=0; its tips
show while it is hovered. Use it with `open=1`, since the slot rides the rug while it drops in:

```bash
pnpm shorts:capture --url "/dev/node-sim?node=blitz_merchant&entry=glam&open=1&script=hover:glam,wait:2500&isolate=1" --frames --fps 30 --out ~/_NOAV/P/slseoun-shorts/<dir>/glam
```

## What is drawn

- Room (`blitz_merchant_room.tscn`): the act's combat background (the `a` layers flattened, 2764.8x1296
  scaled 1.5 at the center + 23 px), the player's merchant pose (`<c>_merchant.tscn`, `relaxed_loop`), the Blitz
  merchant Spine (`animation` loop) and the six tray tokens on its `TOKEN_n` slots while their entries are stocked.
- Inventory (`merchant_inventory.tscn`): backstop, rug, six `blitz_merchant_entry.tscn` slots (240 px icon with
  its 25% shadow at +20,+16), the selection line ("N개의 아이템을 더 선택할 수 있습니다", Kreon/Batang 28 with a
  12 px 50% outline), the back button and the merchant hand Spine (`default`; its position follows
  `NMerchantHand._Process` stepped at 60 fps and the `rotate_me` bone rotation formula).
- Hover tips (`hover_tip.tscn` via `NHoverTipSet`): 360 wide, 5 px apart, nine-patch and shadow, title Kreon
  Bold 22 gold with the icon, description 22 cream with the BBCode colors (StsColors gold, blue, red, purple).
  Text is `MERCHANT.blitz.<entry>_entry.{title,description}` through the SmartFormat subset the lines use
  (Korean plural takes the first word, so the game shows "예리(을)를"). CardEnchant and Glam add the enchantment's
  tip at its amount (`HoverTipFactory.FromEnchantment`) and its extra tip (Steady: Retain, Glam: Replay).

## Not simulated

- The selection screen a bought entry opens (card reward, deck pick, relic, potion), its curse and history line.
- Merchant fire (`vfx_stepped_shader_fire_flat`), embers and glows, the green "done" state after the last pick,
  the slots' RareVfx / CursedVfx particles, the room's lights and stars, animated background layers, the
  proceed button, the merchant's speech, sounds.
- The stock's random numbers are this simulator's seeded stream (the weights and order are the game's), and the
  hand's drift is a seeded noise standing in for FastNoiseLite Perlin.

## Adding the next node type (rest site, treasure, event, shop)

1. Extract: a `scripts/extract-<node>-assets.py` like `extract-blitz-merchant-assets.py` that reads the room
   scene, its UI scenes and the loc tables from the PCK into `public/**` and `data/sts2/<node>.json`
   (check `pnpm cf:limits` first; each file counts).
2. Engine: `src/lib/node-sim/<node>.ts` with `run<Node>(input, data)` (stock or options, beats with start/end,
   `duration`, `actionEnds`, warnings, `notSimulated`) and `<node>StateAt(result, layout, t)`, a pure function of
   `t` so any frame can be seeked. Reuse `loc-format.ts` for game lines.
3. Input: add the node to `NODE_TYPES`, its presets to `NODE_SIM_PRESETS` and its keys and script verbs to
   `parseNodeSimQuery` (keep `wait`, `hover:<thing>`, `buy`/`pick:<thing>` as the shared verbs).
4. Stage: a `<node>-stage.tsx` in game coordinates inside the same 9:16 camera; `GameHoverTip` and
   `PlacedSpine` are shared. Pick it by `input.node` in `node-sim-dev-page.tsx` / `node-sim-client.tsx`
   (the `window.__sim` handle stays the same, so `shorts:capture` needs no change).
5. Spec: extend `scripts/node-sim.spec.ts`, and list the node here.
