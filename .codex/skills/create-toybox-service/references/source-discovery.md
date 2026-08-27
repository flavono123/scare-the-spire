# Toy Box source discovery

Use this reference while choosing or verifying a Toy Box service title,
functional subtitle, hero phrase, token asset, or background art.

## Search order

1. Inspect the existing service patterns:
   - `src/lib/site-nav-items.ts`
   - `src/messages/service.ts`
   - `src/lib/page-og-images.ts`
   - `src/lib/service-metadata.ts`
   - `src/lib/borrowed-game-copy.ts`
   - `data/i18n/borrowed-game-phrases.json`
   - `src/app/**/page-content.tsx`
   - `src/components/service-background.tsx`
2. Search extracted game text and structured resources before opening raw game
   files:
   ```bash
   rg -ni 'term|canonical_id' \
     data/sts2/localization data/sts2/kor data/sts2/eng
   ```
3. Search the tracked asset inventory and actual files:
   ```bash
   rg -ni 'term|canonical_id' \
     data/sts2/images-index.json data/sts2/public-image-files.json
   rg --files public/images/sts2 | rg -i 'term|canonical_id'
   ```
4. Search code for behavioral or ownership relationships that are not present
   in structured JSON:
   ```bash
   rg -ni 'TypeName|MODEL_ID|canonical_id' src scripts data
   ```
5. If the extracted repository sources cannot settle the choice, inspect the
   current local PCK and DLL using the source paths and decompile procedure in
   `.codex/skills/update-game-assets/SKILL.md`.
   - Use `scripts/lib/pck.py` or the closest existing extractor to inspect PCK
     entry paths, localization, scenes, and textures.
   - Reuse `/tmp/sts2-src` only after confirming it represents the current local
     game version. Otherwise decompile the current DLL there with `ilspycmd`.
   - Search the decompiled models and event code with `rg`; do not infer a
     relationship from filenames alone when code can verify it.
6. Extract a new public asset only when the chosen source is absent from
   `public/images/sts2/**`. Use or extend the narrowest existing extractor.
   Do not refresh unrelated game data or assets as part of service creation.

Prefer sources from the same local game version. Check `data/sts2/meta.json`
and the local game's `release_info.json` before mixing repository extraction
output with raw PCK or DLL evidence.

## Candidate rules

Build a coherent identity rather than four independent choices:

- **Title:** Prefer an exact game-localized title when a game resource naturally
  names the service. A service-created Korean title is acceptable when it is a
  deliberate wordplay or clearer product name; do not present it as game text.
- **Functional subtitle:** Write a short service-owned verb phrase for what the
  visitor does (`게임 요소 투표하기`). Wrap it with
  `슬레이 더 스파이어 2 {기능 설명} - 슬서운 이야기` for metadata. On-page `h2`
  is the phrase only. Do not borrow a `gameLocale` line into this slot.
- **Hero phrase:** Prefer a concise line from the same resource or a closely
  related event. It may be an exact `gameLocale` line or a minimal,
  mechanically documented substitution. Keep the source table, key, original
  text, and replacement rule. Page-only; never metadata. Omit when no honest
  line exists.
- **Token:** Prefer a transparent, icon-like asset that stays legible in both
  navigation and the page header. The same-name relic, badge, potion, power, or
  token wins over a merely decorative match.
- **Background:** Prefer card portrait or event art whose subject expresses the
  service action. Confirm that the composition survives the dark
  `ServiceBackground` treatment and mobile crop.
- **Default nickname:** When the service posts a nickname, pick an exact
  in-game identity noun from the same resource, or a minimal documented
  adaptation. Do not invent `익명의 ~술사` labels. Chemical X's
  `익명의 투입터리안` is the documented exception.

Rank candidates by semantic fit, game-source evidence, cross-locale viability,
asset availability, small-size token legibility, and background crop quality.
Do not invent translations, resource relationships, or missing art.

When the user asks only for recommendations, return two or three coherent sets
and recommend one. For every value, include:

| Field | Value | Status | Evidence |
| --- | --- | --- | --- |
| Title | Localized or service title | provided / exact / adapted | table and key, or service rationale |
| Functional subtitle | `{기능 설명}` + metadata template | service-owned | verb phrase; not a game quote |
| Hero phrase | Localized line or omitted | exact / adapted / omitted | table, key, and replacement if any |
| Token | Public asset path | exact / related | resource id and source |
| Background | Public asset path | exact / related | card/event id and source |
| Default nickname | Identity noun for empty-profile posts | exact / adapted / service-owned exception | table and key, or documented exception |

For direct implementation, choose one best-supported set and record the same
evidence in the final report.

## Existing precedents

Use these as pattern evidence, not as a fixed catalog:

| Service | Title source | Functional subtitle (planned) | Hero / page-only copy | Token | Background |
| --- | --- | --- | --- | --- | --- |
| Chemical X | `CHEMICAL_X` relic / service spelling | 게임 요소로 짧은 글 쓰기 | none; `legacyName` aside. Tea Master line is input copy | `relics/chemical_x.webp` | `cards/eradicate.webp` |
| History Course | `relics:HISTORY_COURSE.title` | 런 도전 이력 다시 보기 | Lantern Key event quote with `RUN_HISTORY.title` substitution | `relics/history_course.webp` | `events/war_historian_repy.webp` |
| This or That? | `events:THIS_OR_THAT.title` | 게임 요소 투표하기 | Final line of the same event description | `relics/choices_paradox.webp` | `events/this_or_that.webp` |
| C-c-c-Combo | Service-owned title | 게임 요소 조합 공유하기 | none required; Amalgamator line is input copy today | `badges/ccccombo.webp` | `events/amalgamator.webp` |
| 조각모음 | `cards.DEFRAGMENT.title` | 커뮤니티 | `FOCUS_POWER.description` from the Focus power the card applies | `powers/focus_power.webp` | `cards/defragment.webp` |

`data/i18n/borrowed-game-phrases.json` is the precedent for documenting adapted
game text. Generated localized copy belongs in the existing static generation
flow, not in request-time Worker work.
