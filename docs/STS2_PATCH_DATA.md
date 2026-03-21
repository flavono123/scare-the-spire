# STS2 Patch Data Research

Research date: 2026-03-21

## 1. Current State of Changelog Data

### What exists in the project

Three identical files at:
- `data/spire-codex/changelogs.json`
- `data/spire-codex/eng/changelogs.json`
- `data/spire-codex/kor/changelogs.json`

These track **spire-codex.com website versions**, NOT actual STS2 game patches:

| Version | Date       | Title                                              |
|---------|------------|----------------------------------------------------|
| 1.0.3   | 2026-03-15 | 14-language localization support                   |
| 1.0.2   | 2026-03-12 | Event pages, power pages, SEO, card tooltips, ...  |
| 1.0.1   | 2026-03-10 | Description fixes and frontend improvements        |
| 1.0.0   | 2026-03-10 | Initial Release                                    |

### STS1 balance change data (for reference)

`data/changes.json` (3,673 lines) contains structured STS1 balance diffs using the `Change` interface from `src/lib/types.ts`:

```ts
interface Change {
  id: string;                           // e.g. "anger-wp21-damage"
  entityType: "card" | "relic" | "potion";
  entityId: string;                     // e.g. "anger"
  patch: string;                        // e.g. "Weekly Patch 21: Channel Lightning"
  date?: string;                        // e.g. "2018-04-20"
  summary?: string;
  diffs: AttributeDiff[];
}

interface AttributeDiff {
  attribute: string;      // e.g. "damage", "cost", "mechanic"
  displayName: string;    // e.g. "Damage", "Cost"
  before: string | number;
  after: string | number;
  diffType: "number" | "text" | "enum" | "image";
  upgraded?: boolean;     // true = upgrade-only change
}
```

### Conclusion: No STS2 game patch data exists in the project yet.

---

## 2. Complete STS2 Patch History

STS2 launched in Early Access on **March 5, 2026** (Steam app ID: 2868840). Initial version: **v0.98**.

### All patches as of 2026-03-21

| Version   | Date       | Type          | Summary                                                              |
|-----------|------------|---------------|----------------------------------------------------------------------|
| v0.98     | 2026-03-05 | Launch        | Early Access launch (Ironclad, Silent, Defect, Necrobinder, Regent)  |
| v0.98.1   | 2026-03-06 | Hotfix        | Day-1 fixes: MP disconnect softlock, card play crash, i18n crashes   |
| v0.98.2   | 2026-03-07 | Hotfix        | Whispering Earring softlock, Doormaker music, Beacon of Hope infinite proc, i18n fixes |
| v0.98.3   | 2026-03-10 | Hotfix        | Timeline softlock fixes                                              |
| v0.99     | 2026-03-13 | Beta          | HP cap (999,999,999), new card art (Feeding Frenzy, Sloth, Waste Away), extensive bug fixes, modding overhaul |
| v0.99.1   | 2026-03-14 | Beta Hotfix   | Architect event MP softlock, Breakthrough self-HP-loss MP fix        |
| v0.99.1   | 2026-03-17 | Stable        | Beta changes pushed to main branch                                   |
| v0.100.0  | 2026-03-20 | Beta          | **First major balance patch** -- anti-infinite pass, Phobia Mode, card reworks, relic shop price cuts, Neow blessings |

### Patch details

#### v0.98.1 (2026-03-06) -- Hotfix
- Fixed MP disconnect after Act 1 boss preventing new runs/Timeline
- Fixed crash from fast card play when targeting cancelled
- Fixed crash with untranslated text for complex plural rule languages
- Fixed intermittent crash with non-English languages
- Fixed Japanese Knife Trap translation crash (non-existent Damage variable)

#### v0.98.2 (2026-03-07) -- Hotfix
- Fixed softlock from Whispering Earring relic trying to play ally-targeted cards on Osty
- Fixed Doormaker music not transitioning when portal opens
- Fixed two active Beacon of Hope powers infinitely proccing each other
- Fixed state divergence related to Pael's Wing relic timing
- Fixed blackscreen on launch (Sentry crash reporter issue)
- Translation fixes for Russian, Turkish, Spanish, Italian, Polish, Chinese

#### v0.98.3 (2026-03-10) -- Hotfix
- Fixed additional timeline softlock instances

#### v0.99 (2026-03-13) -- Beta
**Balance:**
- HP cap: Players, enemies, and pets capped at 999,999,999 HP
- Ironclad Hellraiser power corrected

**Art:**
- New portrait art for: Feeding Frenzy, Sloth, Waste Away
- New icon for Murderous run modifier

**Bug Fixes (selected):**
- Potion interaction crash during combat transitions
- Cloud save syncing crash on Windows
- Turkish locale Ironclad selection crash
- Rare save data loss on power cut during save (Windows)
- Fairy in a Bottle / Lizard Tail at 1 max HP
- Lasting Candy softlock from tutorial rewards
- Room Full of Cheese / Jungle Maze Adventure event softlocks
- Host-client map desync in MP
- Controller navigation and dropdown menu fixes

**Localization:**
- Russian template text errors, Turkish locale crashes
- Font rendering fixes for Japanese, Korean, Russian, Thai, Simplified Chinese

**Modding:**
- Eliminated PCK file requirements
- Mod dependency declarations
- Native macOS arm64 support

#### v0.99.1 (2026-03-14 beta, 2026-03-17 stable)
- Architect event MP softlock fix
- Breakthrough card self-HP-loss MP fix

#### v0.100.0 (2026-03-20) -- Beta (FIRST MAJOR BALANCE PATCH)

**Theme: Making infinites harder to achieve.**

**Card Changes -- Silent:**
- **Prepared -> Prepare** (rework): was 0-cost "Draw 1, Discard 1"; now 1-cost, Discard 2, gain 2 Energy next turn (3 upgraded)

**Card Changes -- Ironclad:**
- **Dominate** (rework): now Skill, 1-cost, Uncommon. Apply 1(2) Vulnerable, gain 1 Strength per Vulnerable on enemy, Exhaust
- **Spite** (rework): now 0-cost Attack, Uncommon. 5 damage, hits 2(3) times if you lost HP this turn. Removed card draw
- **Expect a Fight**: still grants 1 energy per attack in hand but prevents additional energy gain that turn
- **Stoke**: no longer draws cards; adds random card (upgraded gives upgraded cards)

**Card Changes -- Defect:**
- **Hotfix**: now Exhausts unless upgraded; no longer adds extra Focus

**Card Changes -- Regent:**
- **Glow** (rework): gain 1(2) Stars, draw 1 card now, draw 1 card next turn (was both immediately)
- **Alignment**: cost increased from 2 to 3 stars
- **Begone & Charge**: summoned minions flipped between cards (buffs Begone, nerfs Charge)
- **Void Form**: now Ethereal

**Card Changes -- Necrobinder:**
- **Defy** upgrade: removed extra Weak turn; grants more block instead
- **Dirge**: now Exhausts
- **Grave Warden & Seance**: no longer upgrade Soul cards generated
- **Borrowed Time**: grants more self-Doom (less when upgraded); removed energy gain

**Card Changes -- Colorless:**
- **Hidden Gem**: cannot grant Replay to cards already possessing it

**Card Changes -- Multiplayer:**
- **Huddle Up**: now Exhausts
- **Beacon of Hope**: block-sharing no longer stacks
- **Believe in You**: energy reduced by 1 (now 2 base, 3 upgraded)

**Relic Changes:**
- All shop relic costs reduced by 25 Gold
- Gold-generating relics removed from shop pool

**Neow Blessings:**
- **Hefty Tablet** (new): choose 1 of 3 rare cards; grants Injury curse
- **Neow's Talisman** (new): upgrades one Strike and one Defend
- **Neow's Fury**: now returns 3 cards (was 2)

**Enemy/Ascension Changes:**
- **Doormaker**: now permanently removes every 10th drawn card; gains 1 Strength when it does
- **Gloom**: now impacts mystery room relic find chances
- **Skulking Colony**: made deadlier
- **Terror Eel**: slightly less threatening
- **Decimillipede**: segment health reduced

**Features:**
- Phobia Mode: alternate art for Infection overlay, hive backgrounds, The Insatiable, Phrog Parasite, Wrigglers, Terror Eel, Entomancer
- New card portrait art (various)
- Character-specific VFX for energy gain

---

## 3. Proposed STS2 Change Data Structure

### 3.1 Patch metadata (`data/sts2-patches.json`)

```json
[
  {
    "id": "v0.98",
    "version": "0.98",
    "date": "2026-03-05",
    "title": "Early Access Launch",
    "type": "release",
    "steamUrl": null,
    "hasBalanceChanges": false
  },
  {
    "id": "v0.98.1",
    "version": "0.98.1",
    "date": "2026-03-06",
    "title": "Hotfix v0.98.1",
    "type": "hotfix",
    "steamUrl": "https://store.steampowered.com/news/app/2868840/view/519740319207522938",
    "hasBalanceChanges": false
  },
  {
    "id": "v0.100.0",
    "version": "0.100.0",
    "date": "2026-03-20",
    "title": "First Major Balance Patch",
    "type": "beta",
    "steamUrl": "https://store.steampowered.com/news/app/2868840/view/503978984819655259",
    "hasBalanceChanges": true
  }
]
```

### 3.2 Balance changes (`data/sts2-changes.json`)

Reuse the existing `Change` / `AttributeDiff` interface from `src/lib/types.ts` with these adaptations:

1. **`entityId`** must map to spire-codex card/relic IDs (uppercase, snake_case: `PREPARED`, `DOMINATE`, `WHISPERING_EARRING`)
2. **`entityType`** expanded: `"card" | "relic" | "potion" | "enemy" | "blessing"` for STS2's broader scope
3. **New `diffType` values**: add `"rework"` (already used informally in STS1 data) and `"boolean"` (for toggles like "now Exhausts")

```json
[
  {
    "id": "prepared-v100-rework",
    "entityType": "card",
    "entityId": "PREPARED",
    "patch": "v0.100.0",
    "date": "2026-03-20",
    "summary": "Prepared reworked into Prepare: now costs 1 energy, discards 2 cards, grants 2 energy next turn (3 upgraded).",
    "diffs": [
      {
        "attribute": "name",
        "displayName": "Name",
        "before": "Prepared",
        "after": "Prepare",
        "diffType": "text"
      },
      {
        "attribute": "cost",
        "displayName": "Cost",
        "before": 0,
        "after": 1,
        "diffType": "number"
      },
      {
        "attribute": "mechanic",
        "displayName": "Mechanic",
        "before": "Draw 1 card. Discard 1 card.",
        "after": "Discard 2 cards. Next turn, gain 2 Energy.",
        "diffType": "rework"
      },
      {
        "attribute": "mechanic",
        "displayName": "Mechanic",
        "before": "Draw 2 cards. Discard 1 card.",
        "after": "Discard 2 cards. Next turn, gain 3 Energy.",
        "diffType": "rework",
        "upgraded": true
      }
    ]
  },
  {
    "id": "hotfix-card-v100-exhaust",
    "entityType": "card",
    "entityId": "HOTFIX",
    "patch": "v0.100.0",
    "date": "2026-03-20",
    "summary": "Hotfix now Exhausts unless upgraded. No longer adds extra Focus.",
    "diffs": [
      {
        "attribute": "exhaust",
        "displayName": "Exhaust",
        "before": false,
        "after": true,
        "diffType": "boolean"
      },
      {
        "attribute": "focus",
        "displayName": "Focus Gain",
        "before": "Gains Focus",
        "after": "No longer gains Focus",
        "diffType": "text"
      }
    ]
  },
  {
    "id": "shop-relics-v100-price",
    "entityType": "relic",
    "entityId": "_SHOP_ALL",
    "patch": "v0.100.0",
    "date": "2026-03-20",
    "summary": "All shop relic costs reduced by 25 Gold. Gold-generating relics removed from shop pool.",
    "diffs": [
      {
        "attribute": "shopCost",
        "displayName": "Shop Cost",
        "before": "Original price",
        "after": "-25 Gold",
        "diffType": "text"
      }
    ]
  }
]
```

### 3.3 Linking changes to spire-codex entities

The spire-codex data uses uppercase snake_case IDs (e.g., `PREPARED`, `AKABEKO`). The change `entityId` should use these exact IDs to enable direct lookup.

Lookup flow:
```
Change.entityId ("PREPARED")
  -> CodexCard by matching card.id from spire-codex/eng/cards.json
  -> Get Korean name, image, description for display
```

### 3.4 Extended `DiffType` enum for STS2

```ts
export type DiffType =
  | "number"    // numeric value change (damage 5->6)
  | "text"      // free-text description change
  | "enum"      // constrained value change (rarity common->uncommon)
  | "boolean"   // toggle (exhaust: false->true)
  | "rework"    // mechanic redesign (before/after description)
  | "image";    // art change
```

---

## 4. Strategy for Parsing Plaintext Patch Notes into Structured Data

### 4.1 The challenge

STS2 patch notes are written in natural language with inconsistent formatting:
- "Prepared -> Prepare" (name change + rework)
- "now exhausts" (boolean toggle)
- "cost increased from 2 to 3 stars" (numeric)
- "removed energy gain" (feature removal)
- "summoned minions flipped between cards" (swap, hard to structure)

### 4.2 Recommended approach: Semi-automated with LLM assistance

**Phase 1: Manual curation for v0.100.0 (MVP)**
- v0.100.0 is the only balance patch so far
- Approximately 20-25 individual card/relic changes
- Manually create `data/sts2-changes.json` by reading the patch notes
- This is feasible to do by hand in ~1 hour

**Phase 2: LLM-assisted parsing for future patches**
- Use Claude API to parse new patch notes into `Change[]` JSON
- Provide the schema + examples from Phase 1 as few-shot context
- Human review required for accuracy (especially reworks)

**Phase 3: Automated pipeline (if patch frequency warrants)**
1. Fetch Steam news RSS/API for app 2868840
2. Feed raw text to LLM with structured output schema
3. Output candidate `Change[]` for human review
4. Merge approved changes into `data/sts2-changes.json`

### 4.3 Pattern recognition rules

| Pattern | DiffType | Example |
|---------|----------|---------|
| `X from N to M` | number | "damage increased from 5 to 8" |
| `X now costs N` | number | "now costs 1 energy" |
| `now Exhausts/Ethereal/Innate` | boolean | "now Exhausts" |
| `renamed to X` / `X -> Y` | text (name) | "Prepared -> Prepare" |
| `reworked: description` | rework | "Dominate reworked to apply Vulnerable..." |
| `removed X` / `no longer X` | text or boolean | "no longer draws cards" |
| `reduced by N` / `increased by N` | number (relative) | "costs cut by 25 Gold" |

### 4.4 Entity ID resolution

The tricky part is mapping natural-language card names to spire-codex IDs. Strategy:
1. Build a name-to-ID lookup from `data/spire-codex/eng/cards.json` and `relics.json`
2. Fuzzy match patch note card names against this lookup
3. Flag unresolved names for manual review

---

## 5. MVP Implementation Plan for Enriched Patch Display

### Goal
Display STS2 patch notes with interactive card/relic links, keyword hover tooltips, and structured balance change visualization.

### Phase 1: Data layer (week 1)
1. Create `data/sts2-patches.json` with patch metadata (all 7 patches listed above)
2. Create `data/sts2-changes.json` with structured diffs for v0.100.0 balance changes (~25 entries)
3. Add TypeScript types extending the existing `Change`/`AttributeDiff` interfaces for STS2-specific needs

### Phase 2: Patch list page (week 1-2)
- Route: `/patches` or integrated into existing codex layout
- List all patches with date, version, type badge (hotfix/beta/stable)
- Show balance change count per patch
- Link to individual patch detail pages

### Phase 3: Patch detail page (week 2)
- Route: `/patches/[version]`
- Render patch notes with **entity-linked mentions**: card/relic names are clickable links to their codex pages
- Show structured diffs in a visual format:
  - Number diffs: `6 -> 8` with green/red color coding
  - Rework diffs: side-by-side before/after
  - Boolean diffs: badge toggle (e.g., `+Exhaust`)
- **Keyword hover tooltips**: game keywords (Vulnerable, Exhaust, Ethereal, etc.) show definitions from `data/spire-codex/eng/keywords.json`

### Phase 4: Card/relic page integration (week 3)
- On each card's codex page, show a "Patch History" section
- List all `Change` entries for that entity, sorted chronologically
- Visual diff timeline showing how the card evolved across patches

### Phase 5: Polish (week 3-4)
- Search/filter patches by entity name or change type
- RSS/notification for new patch notes
- Korean localization of patch summaries

### Key components to build
- `PatchCard` -- summary card for patch list
- `DiffVisualization` -- renders `AttributeDiff[]` with before/after styling
- `EntityMention` -- inline card/relic name with hover preview + link
- `KeywordTooltip` -- hover tooltip pulling from keywords.json
- `PatchTimeline` -- chronological change history for a single entity

---

## Sources

- [Steam News - STS2](https://store.steampowered.com/news/app/2868840)
- [SteamDB - STS2 Patches](https://steamdb.info/app/2868840/patchnotes/)
- [PatchBot - STS2](https://patchbot.io/games/slay-the-spire-2)
- [v0.100.0 Beta Patch Notes (Steam)](https://store.steampowered.com/news/app/2868840/view/503978984819655259)
- [v0.99 Beta Patch Notes (Steam)](https://store.steampowered.com/news/app/2868840/view/502852451136700758)
- [v0.99.1 Patch Notes (Steam)](https://store.steampowered.com/news/app/2868840/view/502852451136701666)
- [v0.98.2 Hotfix (Steam)](https://store.steampowered.com/news/app/2868840/view/519740319207524327)
- [v0.98.1 Hotfix (Steam)](https://store.steampowered.com/news/app/2868840/view/519740319207522938)
- [v0.98.3 Hotfix (Steam)](https://store.steampowered.com/news/app/2868840/view/519740319207525149)
- [PCGamesN - v0.100.0 analysis](https://www.pcgamesn.com/slay-the-spire-2/patch-notes-infinites-nerfed)
- [GameWatcher - Patch roadmap](https://www.gamewatcher.com/news/slay-the-spire-2-patch-notes-roadmap-of-updates)
- [Mega Crit official](https://www.megacrit.com/)
- [EGW - v0.99 detailed notes](https://egw.news/gaming/news/33197/slay-the-spire-2-caps-hp-at-nearly-a-billion-crush-CCZa_ZVwO)
