# Cover phrase & element patterns

Harvested 2026-08-09 via `harvest.mjs`. Raw dumps (`*.json`, `*.jsonl`) stay local/gitignored.

## Corpus sizes

| Source | Count | Notes |
| --- | --- | --- |
| combo_posts | 57 | entity blocks + short `content_text` |
| combo pairs | 140 | almost all count=1; CLONE dominates singles |
| donated runs (deck stats) | 80 / 80 with deck | dup hist: 1×1336, 2×136, 3×51, 4×72, 5+×18 |
| YouTube 중괄호 | 60 | short hooks + `{Slay the Spire 2}` suffix |
| YouTube 모카계 | 27 | challenge / rank / “without X” runs |
| YouTube 최점모 | 32 | guide/info + “what if every X” |
| 슬갤 seeds | 53 | titles from retired brief URLs |

## Phrase grammar (what to template)

### A. 중괄호 short hook (primary for auto covers)

Length mostly ≤12 chars (Korean). Rarely a full sentence. Types:

1. **Portmanteau / mashed names** — `밀집모자람`, `철붕`, `악랄한 게구리`, `타락한 잿빛 타격`
2. **Count + noun** — `32유물`, `저주 세 개 시작`, `공격성+ 2장 쓰기`, `1장 2장 2장 더`, `내 덱은 아무튼 1장임`
3. **Reaction / judgment** — `악형 왜 씀`, `엘리트 잡아야 함`, `없으면 만들어`
4. **Feel adjective + build noun** — `폭풍의 강함`, `빅 네크`

→ Auto templates should prefer **short**, name-ish lines filled from 1–2 weighted elements + optional run fact (copies, relic count, floor).

### B. 슬갤 clickbait (secondary templates)

Observed buckets on seed titles:

| Bucket | Signals | Examples |
| --- | --- | --- |
| Big number | `\d{3,}`, 억/만, 딜, 장 | `0코 999999999딜 쓰냐`, `골골이 체력 1557찍었다` |
| Infinite / loop | 무한, 0코, 루프 | `무덤폭발 2장 0코로 만들면 무한루프됨` |
| Combo done | 콤보, 완성, 뽕, 레전드 | `콤보 완성했다`, `리젠트무한덱완성` |
| Unlucky | 억까, 참사, 실력겜이라며 | `이겜 운빨겜 아니라며! 실력겜이라며!` |

`.run` has floors / win / deck size / max_hp / damage_taken but **not** combat damage dealt. So big-number templates may use **deck size, relic count, max HP, floors** — not invented “딜”. Prefer hooks that do not claim damage.

### C. 모카계 / 최점모 (weaker for cover phrase)

Longer guide titles (`Why You Should Pick…`, `챌린지 공격 카드 없이…`). Useful as **tone reference** (constraint run, “what if every X”) but too long for 16:9 cover. Do not paste as-is.

### D. 코오오옴보 `content_text`

Often mirrors 중괄호: short mashed name + optional YouTube title echo + entity stack.

- `향수 + 영혼의 힘 호각 불기 쓰냐` → `{A} + {B} {verb}?`
- `1장 2장 2장 더 … 8뽑 아님 10뽑` → escalating counts
- Repeated same entity in text (`야성 야성 야성`) → **copies** on cover elements

Top entities (n=57): `enchantment:CLONE` (15) ≫ bombardment / momentum / souls_power. Co-occurrence pairs are sparse (almost all 1). Static pair table still useful as soft boost when both present; do not treat count=1 as strong signal.

## Element grammar

1. **Count 1–3** icons on cover (슬갤/중괄호 thumbnails rarely show more than a handful).
2. **Same type OK** — card+card, relic+relic.
3. **Same card with copies** — donated runs show multi-copy decks are common enough (2–4× buckets). Show `{ id, copies }` when copies≥2 and that card is selected.
4. **Enchantments / powers** appear often in combo posts; cover v1 kinds: `card | relic | potion`. Extend to enchantment/power only if UI stack already supports them (combo does).
5. **Background card-beta variant** must **exclude** that card id from the element row.

## Background observations

- Character bust / cinematic still reads instantly (중괄호 Ironclad-style thumbs).
- Card-art background works when the hook is “about that card”; then elements should be the **enablers** (relics / other cards), not the same card again.
- Beta art path preferred when present (`cards-beta/`).

## Weighting hints from donated decks

- Non-starter acquisitions (~74% of unique card ids in sample) should dominate the pool.
- Late-floor picks are rarer but more “run defining” → modest weight bump.
- Duplicate cards (2+) are the best free synergy signal without AI.

## Anti-patterns

- Long guide sentences on the cover.
- Claiming damage / turn-kill numbers not present in `.run`.
- Uniform random starter Strike/Defend as the only highlight.
- Putting the focus card both as beta background and in the 1–3 element row.
