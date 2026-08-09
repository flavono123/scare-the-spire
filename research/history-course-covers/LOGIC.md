# `suggestCovers` logic spec (axis 1)

SSOT for phrase + key-element combination. Implementation comes after this spec; UI details live in [`docs/HISTORY_COURSE_REDESIGN.md`](../../docs/HISTORY_COURSE_REDESIGN.md). Patterns backing the heuristics: [`patterns.md`](./patterns.md).

## Types

```ts
type CoverBackground =
  | { kind: "character" }
  | { kind: "card-beta"; cardId: string };

type CoverElementKind = "card" | "relic" | "potion"; // v1

type CoverElement = {
  kind: CoverElementKind;
  id: string; // codex id, lower/canonical as elsewhere
  copies?: number; // omit or 1 when single; >=2 shows stack/badge
};

type CoverSpec = {
  background: CoverBackground;
  phrase: string; // target <= 18 Korean chars / ~40 Latin
  elements: CoverElement[]; // length 1..3
  auto: boolean;
  suggestSeed: string; // stable seed used for this suggestion
};

type SuggestCoversInput = {
  runId: string;
  run: ReplayRun; // parsed .run
  /** optional reshuffle nonce; default 0. Changing it re-rolls. */
  reshuffle?: number;
  /**
   * Slim static table promoted from research/combo-cooccurrence.json
   * (top pairs only). Missing => weight 0 boost.
   */
  cooccurrence?: CoverCooccurrenceTable;
};

type CoverCooccurrenceTable = {
  /** key: `${kind}:${id}|${kind}:${id}` with kinds sorted */
  pairWeight: Record<string, number>;
};

type SuggestCoversResult = {
  /** Index 0 = default auto-save (character background). */
  covers: [CoverSpec, CoverSpec];
};
```

## Pipeline

```text
suggestCovers(input)
  seedBase = `${runId}:${reshuffle ?? 0}`
  pool = buildWeightedPool(run)          // cards/relics/potions with weights
  focusCard = weightedPick(pool.cards, seedBase+":focus")
  elementsA = pickElements(pool, { countSeed: seedBase+":elA", excludeCardIds: [] })
  elementsB = pickElements(pool, { countSeed: seedBase+":elB", excludeCardIds: [focusCard.id] })
  phraseA = pickPhrase(run, elementsA, seedBase+":phA")
  phraseB = pickPhrase(run, elementsB.length ? elementsB : elementsA, seedBase+":phB")
  return {
    covers: [
      { background: { kind: "character" }, phrase: phraseA, elements: elementsA, auto: true, suggestSeed: seedBase+":A" },
      { background: { kind: "card-beta", cardId: focusCard.id }, phrase: phraseB, elements: elementsB, auto: true, suggestSeed: seedBase+":B" },
    ]
  }
```

Upload flow: persist `covers[0]` as the run’s `cover_spec`. Offer `covers[1]` in UI. User edits set `auto: false`.

## Weighted pool

### Cards

From `run.players[0].deck` (normalize id: strip `CARD.` prefix / take last segment).

| Signal | Weight delta |
| --- | --- |
| base | 1 |
| `floor_added_to_deck > 1` (non-starter-ish) | +3 |
| `floor_added_to_deck > 34` (late) | +2 |
| copies in deck == 2 | +4 |
| copies == 3 | +6 |
| copies >= 4 | +8 |
| upgraded (if replay exposes upgrade / `+` id) | +2 |
| rarity rare/uncommon if codex known | +2 / +1 |
| starter strike/defend/defend-family at copies==1 | ×0.15 |

Group by id → one pool entry with `copies` and summed weight.

### Relics

From `player.relics`.

| Signal | Weight |
| --- | --- |
| base | 2 |
| `floor_added_to_deck > 0` | +2 |
| boss/rare (codex) | +3 |
| starter relic | ×0.4 |
| known low-signal junk (configurable denylist, start empty) | ×0.5 |

### Potions

From end-of-run potion slots if present; else skip. Base weight 1; rare +1. Cap potions to at most 1 of the 1–3 elements unless pool is tiny.

### Co-occurrence soft boost

When picking the 2nd/3rd element, for each candidate C already-chosen A:

- look up `pairWeight[key(A,C)]` from static table (default 0)
- add `min(3, pairWeight)` to C’s temporary weight

Promote later: top ~50 pairs from `combo-cooccurrence.json` into e.g. `src/data/cover-cooccurrence.json` (committed slim file). Refresh manually; no runtime scrape.

## `pickElements`

1. `n = 1 + (hash(countSeed) % 3)` → 1..3
2. Without replacement on `(kind,id)`, weighted picks.
3. If picked card has `copies >= 2`, set `element.copies = copies` (shows synergy).
4. Prefer mixed kinds when `n >= 2` only as a soft re-roll once (if first two same kind and a different kind exists with weight≥ median, swap 2nd). Not a hard rule — same-type stacks are allowed and desirable.
5. Fallback: if pool empty, elements = `[]` and phrase uses character + floors only.

## `pickPhrase`

Templates are **filled from run facts + chosen element display names** (game locale via existing i18n). Never invent damage.

Template families (Korean first; EN mirrors later):

| id | Template | When |
| --- | --- | --- |
| `hook_mash` | `{e0}` or `{e0} {e1}` (names only, ≤18) | default; hash picks mash vs below |
| `hook_why` | `{e0} 왜 씀` | element0 is card/relic |
| `hook_copies` | `{e0} {n}장` | element0.copies ≥ 2 |
| `hook_relics` | `{relicCount}유물` | relicCount ≥ 20 |
| `hook_deck` | `덱 {deckSize}장` | deckSize ≥ 40 or ≤ 8 |
| `hook_floor` | `{floors}층까지` | !win && floors ≥ 40 |
| `hook_win` | `A{ascension} 클리어` | win |
| `hook_not_normal` | `보통 {e0}이 아니다` | uncommon/rare e0 (particle 이/가 by jamo) |

Selection: filter applicable → stable weighted pick by `phraseSeed`. Prefer templates that mention at least one chosen element when elements nonempty.

English locale: short literal mirrors (`Why {e0}?`, `{n}× {e0}`, `Not just {e0}`) using `.font-game-title`.

## Background assets

- **character**: prefer wide still if available (`/spine/sts2/character-select/...` or `select_{slug}.webp`), else `char_select_{slug}.webp`. Character fill color class: Ironclad `spire-red`, Silent `spire-green`, Defect `spire-aqua`, Regent `spire-orange`, Necrobinder `spire-pink`.
- **card-beta**: `/images/sts2/cards-beta/{id}.webp` if file exists in static map / known set; else `/images/sts2/cards/{id}.webp`.

## Persistence

- Local IDB `StoredRun.coverSpec?: CoverSpec`
- Supabase `runs.cover_spec jsonb` (migration via supabase-migrations skill). Keep legacy `highlight_*` / `note_blocks` readable as fallback until backfill: if `cover_spec` null, derive a one-shot cover from `buildRunHighlights` + empty phrase placeholder — or regenerate with `suggestCovers` client-side once.

Listing queries select `cover_spec` (not full `raw`) for shared index cards.

## Stability & reshuffle

- Same `runId` + `reshuffle=0` → identical suggestions.
- UI “다시 섞기” increments `reshuffle` and overwrites only if `auto === true` or user confirms.

## Out of scope (here)

- AI / LLM phrase generation
- Live trend scraping
- Damage / one-turn-kill claims
- Axes 2–3 replay UX

## Minimal self-check (when implementing)

One assert-style unit/demo: fixed fixture `.run` + empty cooccurrence → `covers[0].background.kind === "character"`, `covers[1].background.kind === "card-beta"`, `covers[1].elements.every(e => e.id !== covers[1].background.cardId)`, `elements.length` in 1..3, phrase length ≤ 40.
