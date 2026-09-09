# QA Report: 슬서운이야기

| Field | Value |
|-------|-------|
| **Date** | 2026-09-09 |
| **URL** | http://localhost:3000/history-course/174nxe7x9zfpgm1t |
| **Branch** | main |
| **Commit** | 23e5e169 (report follows) |
| **Tier** | Quick |
| **Scope** | History Course last scenes (검슝 쳐내기) |
| **Pages visited** | 1 route, floors 0:8 / 0:10 / 1:3 plus playback bar |

## Health Score: 86/100

| Category | Score |
|----------|-------|
| Console | 80 |
| Links | 95 |
| Visual | 78 |
| Functional | 90 |
| UX | 88 |
| Performance | 85 |
| Content | 90 |

## Top 3 Things to Fix

1. **ISSUE-001: 검슝 쳐내기 playback freeze** — Play showed as playing but the ticker could stall when the timeline identity churned or rAF was starved.
2. **ISSUE-002: Last-scene beats too short** — Default 2× playback halved 500ms steps; dedicated last-scene beats now stay 1× wall-clock at 1200ms.
3. **ISSUE-004: Treasure last-scene background** — Combat cave + map chest was wrong; game SSOT is a black room + `chest_room_act_*` Spine from the PCK (no screenshot required).

## Summary

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High | 2 |
| Medium | 1 |
| Low | 0 |
| **Total** | **4** |

## Issues

### ISSUE-001: 검슝 쳐내기 playback freeze

| Field | Value |
|-------|-------|
| **Severity** | critical |
| **Category** | functional |
| **URL** | /history-course/174nxe7x9zfpgm1t |

**Description:** Playback could stay at 0ms with Play/Pause still toggling. Last-scene overlays and intro gating stole hits; catalog identity rebuilt the timeline and cancelled the rAF loop. Play now forces `replayReady`, overlays are `pointer-events-none`, the ticker keeps timeline/rate on refs, and a 50ms watchdog advances if rAF is starved.

**Repro Steps:**

1. Open `/history-course/174nxe7x9zfpgm1t`
2. Wait for the stage, then click a floor marker (pauses)
3. Click Play
4. **Observe:** `data-history-global-ms` must increase; Play must be the top hit target

---

### ISSUE-002: Intra-node last-scene beats too short

| Field | Value |
|-------|-------|
| **Severity** | high |
| **Category** | ux |
| **URL** | /history-course/174nxe7x9zfpgm1t |

**Description:** 500ms timeline steps at default 2× were ~250ms wall-clock. Last-scene beats are now 1200ms and play at 1× wall-clock; map transit still follows the selected rate.

**Repro Steps:**

1. Leave rate at 2×
2. Play through combat loot / card pick / event choice
3. **Observe:** each last-scene beat is about 1.2s real time

---

### ISSUE-003: Card-pick and shop cards too large

| Field | Value |
|-------|-------|
| **Severity** | high |
| **Category** | visual |
| **URL** | /history-course/174nxe7x9zfpgm1t (combat card pick, shop 1:3) |

**Description:** Reward cards used a nested `12.5%` of an indefinite parent (and previously `sm:w-[240px]` on a ~1120px stage). Shop tiles overflowed the rug. Cards now fit the stage (`12.5%` of the overlay for picks) or the rug slot (`195/1747` of the inventory).

**Repro Steps:**

1. Jump to a shop (1:3) or a combat card-pick beat
2. **Observe:** cards sit in the rug/reward row instead of filling a third of the stage

---

### ISSUE-004: Treasure last-scene used the wrong background

| Field | Value |
|-------|-------|
| **Severity** | medium |
| **Category** | visual |
| **URL** | /history-course/174nxe7x9zfpgm1t floor 0:10 |

**Description:** Treasure is not the act combat cave. `scenes/rooms/treasure_room.tscn` is a black `ColorRect` plus `chest.tscn` (`ChestVisual` scale 0.4 at Godot world `(-2, 66)`). Spine `chest_room_act_{1,2,3}` comes from the PCK; no in-game screenshot is required. Headless Playwright in this environment has no WebGL, so the actor may stay on the black ColorRect there; desktop Chrome with WebGL should draw the chest room.

**Repro Steps:**

1. Jump to treasure (0:10, 1:9, 2:8)
2. **Observe:** black room + act chest Spine, not Overgrowth cave + map chest icon

---

## Fixes Applied

| Issue | Fix Status | Commit | Files Changed |
|-------|-----------|--------|---------------|
| ISSUE-001 | verified (Playwright: pause/resume + floor-jump Play on 검슝 쳐내기) | 397722ae | history-course-shell, error boundary, run-detail-loader, playback spec |
| ISSUE-002 | verified (unit: last-scene multiplier stays 1 at 2×) | 930976dd | history-last-scene-steps, history-playback-rate |
| ISSUE-003 | verified (Playwright shop tile width 6–16% of stage) | 82a0f545 | fitted-card-tile, card-reward-screen, merchant-shop-screen |
| ISSUE-004 | verified structure; Spine draw needs WebGL | 23e5e169 | treasure-room-stage, PCK extract, last-scene assets |

---

## Ship Readiness

| Metric | Value |
|--------|-------|
| Health score | ~62 → 86 (+24) |
| Issues found | 4 |
| Fixes applied | 4 |
| Deferred | Treasure Spine pixels in WebGL-less automation |

Playwright `scripts/history-course-playback.spec.ts`: 5 passed (playback, floor-jump resume, donated run, treasure mount, shop card scale).
`scripts/history-last-scene.spec.ts`: ok.
