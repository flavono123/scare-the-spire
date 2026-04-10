# slseoun-patch (슬서운변경)

Fetch Steam patch notes for STS2 and convert them into 슬서운변경 (rich patch notes).

This skill should be used when:
- "슬서운변경", "패치노트 가져와", "패치 업데이트", "새 패치", "rich patch"
- "Steam 패치노트", "스팀 패치", "patch notes fetch"
- A new STS2 patch is released and needs to be ingested
- User specifies a version like "v0.101.0" to process

## Overview

슬서운변경 converts raw Steam patch notes into a structured, enriched Korean format:
1. **Fetch** — Pull raw text from Steam API (SSOT)
2. **Extract** — Parse bullet points and clear statements; skip greetings/community fluff and images
3. **Translate** — Convert to Korean using in-game i18n for game entities (cards, relics, powers, etc.)
4. **Enrich** — Apply BBCode markup for text effects (entity highlighting, buff/nerf indicators)

## Data Sources

### Steam API (SSOT)
```
GET https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/
  ?appid=2868840
  &count=10
  &maxlength=300000
  &format=json
  &feeds=steam_community_announcements
```

Filter by `tags` containing `"patchnotes"`. Each item has:
- `gid` — unique ID
- `title` — e.g. "Beta Patch Notes - v0.101.0"
- `contents` — plain text (no HTML/BBCode), sections separated by newlines
- `date` — Unix timestamp
- `url` — Steam community URL

### Existing Data
- `data/sts2-patches.json` — Patch index (version, date, title, steamUrl, summary)
- `data/sts2-patch-notes/` — Per-version markdown files (raw English structured notes)
- `src/lib/codex-data.ts` — Game entity data (cards, relics, potions) for name matching
- `src/lib/codex-types.ts` — Type definitions

## Workflow

### Step 1: Fetch Raw Patch Notes

```bash
curl -s "https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=2868840&count=10&maxlength=300000&format=json&feeds=steam_community_announcements" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for item in data['appnews']['newsitems']:
    if 'patchnotes' in item.get('tags', []):
        print(f'{item[\"title\"]} (gid={item[\"gid\"]})')
"
```

To fetch a specific version's content, filter by title containing the version string.

**For updating an existing version**: The same version may receive content updates (e.g. semver corrections). In that case, re-fetch and overwrite the raw notes.

### Step 2: Extract & Structure

From the raw plain text:
1. **Keep**: Bullet-point items, card/relic/enemy change descriptions, balance numbers
2. **Skip**: Greeting paragraphs ("Hey everyone..."), community messages, image references (`{STEAM_CLAN_IMAGE}`)
3. **Title**: Use the Steam API `title` field exactly as-is (e.g. `# Beta Patch Notes - v0.101.0`). Do NOT add subtitles, summaries, or annotations below the title.
4. **No annotations**: Do NOT add descriptive lines between the title and the first section (e.g. "This patch is live on the Beta Branch", "Design commentary from Anthony included"). Go straight from `# Title` to `## First Section`.
5. **Structure** as markdown with sections:
   - Use `##` for major sections (CONTENT, BALANCE, BUG FIXES, etc.)
   - Use `###` for sub-sections (Card Changes - Silent, Relic Changes, etc.)
   - Use `- **Name**: description` for individual changes
   - Card rework format: `**OldName -> NewName** (rework): description`
   - Preserve upgrade values in parentheses: `5(7)` means base(upgraded)

Save to `data/sts2-patch-notes/{version}.md` (English structured version).

### Step 3: Translate to Korean

Create a Korean version alongside the English one. Rules:
- Game entities use **official Korean translations** from `src/lib/codex-data.ts`
  - Cards: use `nameKo` field
  - Relics: use `nameKo` field
  - Powers/keywords (Vulnerable, Strength, Block, etc.): use in-game Korean (취약, 힘, 방어도, etc.)
  - Cards with English-only names (e.g. "hello world", "null"): keep English
- Section headers: translate to Korean
- Descriptive text: natural Korean translation
- Numbers and mechanical descriptions: preserve exactly

### Step 4: Enrich with BBCode

Apply text effects to the Korean version for rich rendering:

#### Entity Highlighting (gold) & Type Disambiguation
STS2에서는 카드와 파워가 같은 이름인 경우가 매우 많다 (굴뚝, 발병, 측면 공격, 반사, 쇄도 등 130+개).
`[gold]이름[/gold]`은 entity lookup에서 **마지막으로 등록된 타입**(보통 파워)으로 연결되므로, 카드를 가리킬 때는 반드시 `[gold:card]`를 사용해야 한다.

**규칙: 충돌 가능한 이름은 항상 타입 힌트를 명시한다.**
- Card: `[gold:card]측면 공격[/gold]`
- Power: `[gold:power]굴뚝[/gold]`
- Enchantment: `[gold:enchantment]주입[/gold]`

**충돌이 없는 이름은 `[gold]`만 쓴다** (유물, 몬스터, 이벤트, 키워드 등 대부분 충돌 없음):
- Relic names: `[gold]진자[/gold]` (Pendulum)
- Powers/keywords (충돌 없는 것): `[gold]취약[/gold]`, `[gold]힘[/gold]`, `[gold]방어도[/gold]`

**판단 기준**: 패치노트 문맥에서 어떤 타입인지 확인하고, 해당 이름이 카드+파워 양쪽에 존재하면 타입 힌트를 붙인다. 패치노트는 카드 변경이 주류이므로 대부분 `[gold:card]`가 된다.

#### Character Colors (section headers)
- Ironclad sections: `[red]아이언클래드[/red]`
- Silent sections: `[green]사일런트[/green]`
- Defect sections: `[aqua]디펙트[/aqua]`
- Regent sections: `[orange]리젠트[/orange]`
- Necrobinder sections: `[pink]네크로바인더[/pink]`

#### Ancient references
- Ancient names: `[blue]고대의 존재[/blue]`

#### Buff/Nerf indicators
When the original patch note clearly indicates a buff or nerf, use a **prefix label** style — the effect goes on the label word only, not on the changed values:
- Buff: `([green][sine]버프[/sine][/green])` as prefix in the parenthetical tag, e.g. `- [gold]카드명[/gold] ([green][sine]버프[/sine][/green]): 피해량 5 -> 7`
- Nerf: `([red][jitter]너프[/jitter][/red])` as prefix in the parenthetical tag, e.g. `- [gold]카드명[/gold] ([red][jitter]너프[/jitter][/red]): 코스트 2 -> 3`
- Do NOT wrap the actual changed values in effects — only the label word (버프/너프) gets the animation.

### Step 5: Get Steam Store URL

The Steam API `gid` does NOT match the Steam store page URL. You cannot construct the URL automatically.

Use `AskUserQuestion` to ask the user for the Steam store URL:
```
이 패치의 Steam 스토어 URL을 알려주세요 (예: https://store.steampowered.com/news/app/2868840/view/...).
모르면 "skip"을 입력하세요 — steamUrl을 null로 설정합니다.
```

If the user provides a URL, use it as-is. If "skip", set `steamUrl: null`.

### Step 6: Update Patch Index

Add/update entry in `data/sts2-patches.json`:
```json
{
  "id": "v0.101.0",
  "version": "0.101.0",
  "date": "2026-03-24",
  "title": "Beta Patch Notes - v0.101.0",
  "titleKo": "베타 패치 노트 - v0.101.0",
  "type": "beta",
  "steamUrl": null,
  "summary": "...",
  "summaryKo": "...",
  "hasBalanceChanges": true
}
```

**Rules:**
- `title`: Use Steam API `title` field exactly as-is. Do NOT invent subtitles or add descriptions after the version.
- `titleKo`: Direct Korean translation of the Steam title only. Do NOT add content summaries.
- `steamUrl`: Only use user-provided URL from Step 5. NEVER construct from API gid — they don't match.
- `summary`/`summaryKo`: Brief factual list of key changes. Keep to what the patch actually says.

### Step 7: Apply Entity Data Changes

패치노트에 밸런스/컨텐츠 변경이 있으면, 해당 엔티티 데이터 파일에도 반영해야 한다.

#### 7a. PCK 로컬라이제이션 동기화

게임 PCK 파일 안에 `localization/{lang}/cards.json`, `localization/{lang}/relics.json` 등 최신 설명 텍스트가 있다.
패치 적용 시 **반드시 PCK에서 최신 description_raw를 추출**하여 데이터 파일을 업데이트한다.

```python
# PCK에서 카드/유물 설명 텍스트 추출 (v3 format)
# localization/eng/cards.json → CARD_ID.title, CARD_ID.description
# localization/kor/cards.json → same
# localization/eng/relics.json → RELIC_ID.title, RELIC_ID.description
# localization/kor/relics.json → same
```

이 단계는 설명 텍스트 변경(Writing 섹션)과 메커닉 변경 모두를 커버한다.

#### 7b. 수치/키워드 변경 수동 적용

PCK 로컬라이제이션에 없는 필드들은 패치노트를 보고 직접 수정:

- **damage, block, cost, star_cost, hit_count, energy_gain**: 숫자 직접 변경
- **vars**: 카드 변수값 (예: `vars.Damage`, `vars.Forge`, `vars.SpeedsterPower`)
- **rarity**: 영문(`Common`/`Uncommon`/`Rare`) + 한국어(`일반`/`고급`/`희귀`)
- **keywords**: `Exhaust`/`소멸`, `Innate`/`선천성`, `Ethereal`/`미완` 등
- **upgrade**: 강화 효과 변경 (예: `"+2"` → `"+4"`, `{"innate": true}`)
- **deprecated**: 삭제된 카드는 `"deprecated": true, "deprecatedInPatch": "vX.Y.Z"`
- **Monster HP**: `min_hp`, `max_hp`, `min_hp_ascension`, `max_hp_ascension`

#### 7c. 신규 엔티티 추가

새 카드/유물이 추가되면:
1. PCK에서 한국어 이름 확인 (localization/{lang}/cards.json, relics.json)
2. `data/sts2/{lang}/cards.json` 또는 `relics.json`에 새 항목 추가
3. 기존 항목의 필드 구조를 참고하여 동일한 스키마 준수
4. **rarity, pool 등은 영문 키 사용** (한국어 데이터도 `"shared"`, `"Uncommon"` 등 — 단, 한국어 전용 필드인 rarity만 한국어: `"고급"`, `"희귀"` 등)
5. 유물 이미지가 PCK에 있으면 추출하여 `public/images/sts2/relics/` 에 WebP로 저장
6. 카드 이미지는 `scripts/extract-card-portraits.py --force` 로 추출

#### 7d. sts2-changes.json 업데이트

`data/sts2-changes.json`에 밸런스 변경 기록을 추가한다. 기존 항목 구조 참고.

#### 7e. meta.json 업데이트

`data/sts2/meta.json`의 `version`과 `extractedAt`을 새 패치 버전으로 업데이트.

### Step 8: Speculative Commit

Per CLAUDE.md rules, commit after each meaningful edit:
- Commit raw English notes first
- Commit Korean enriched version
- Commit patches.json update
- Commit entity data changes
- Commit sts2-changes.json
- Commit meta.json

## Output Files

| File | Content |
|------|---------|
| `data/sts2-patch-notes/{version}.md` | Structured English patch notes |
| `data/sts2-patch-notes/{version}.ko.md` | Korean enriched (BBCode) patch notes |
| `data/sts2-patches.json` | Updated patch index |
| `data/sts2/{eng,kor}/cards.json` | Updated card data (descriptions, stats, keywords) |
| `data/sts2/{eng,kor}/relics.json` | Updated relic data |
| `data/sts2/{eng,kor}/monsters.json` | Updated monster HP |
| `data/sts2-changes.json` | Balance change tracking entries |
| `data/sts2/meta.json` | Version + extractedAt |

## Game Entity Reference

For Korean translations, check these sources in order:
1. `src/lib/codex-data.ts` — Primary source for card/relic/potion names
2. In-game terminology (common powers, keywords):
   - Strength → 힘, Block → 방어도, Vulnerable → 취약, Weak → 약화
   - Exhaust → 소멸, Ethereal → 영묘, Innate → 선천
   - Energy → 에너지, Draw Pile → 뽑을 더미, Discard Pile → 버린 더미
   - Doom → 파멸, Soul → 영혼, Star → 별
3. If unsure, keep the English name and mark with `<!-- TODO: i18n -->` for review
