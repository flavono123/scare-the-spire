# CardTile 게임 정합 SSOT (2026-04-26)

게임 추출본: `/private/tmp/sts2-extract-new/` (sts2 v0.104.0, GDRE Tools + ILSpy)

## 1. 카드 이름 (TitleLabel)

소스: `src/Core/Helpers/StsColors.cs` + `src/Core/Nodes/Cards/NCard.cs::UpdateTitleLabel`

```
unupgraded:  font_color = StsColors.cream                        = #FFF6E2
upgraded:    font_color = StsColors.green                        = #7FFF00
shadow:      font_shadow_color = Color(0,0,0,0.188)
shadow_offset = (2,2), shadow_outline_size = 12
outline_size = 12
```

희귀도별 outline (`GetTitleLabelOutlineColor`):
| 희귀도 | StsColors | HEX |
|---|---|---|
| Basic / Common / Token / Ancient | cardTitleOutlineCommon | `#4D4B40` |
| Uncommon | cardTitleOutlineUncommon | `#005C75` |
| Rare | cardTitleOutlineRare | `#6B4B00` |
| Curse | cardTitleOutlineCurse | `#550B9E` |
| Quest | cardTitleOutlineQuest | `#7E3E15` |
| Status | cardTitleOutlineStatus | `#4F522F` |
| Event / 강화 | cardTitleOutlineSpecial | `#1B6131` |

강화 시 outline은 *항상* `cardTitleOutlineSpecial`(#1B6131) — 희귀도 무관.

## 2. 에너지 코스트 (EnergyLabel) / 별 코스트 (StarLabel)

소스: `CardPoolModel.cs` + 각 `CardPools/<Pool>.cs::EnergyOutlineColor`

```
font_color = StsColors.cream = #FFF6E2 (정상)
              StsColors.green = #7FFF00 (modifier로 감소)
              StsColors.red   = #FF5555 (modifier로 증가)
shadow = Color(0,0,0,0.188), offset (2,2), shadow_outline_size = 16
outline_size = 16
```

캐릭터 풀별 outline:
| 풀 | HEX |
|---|---|
| Ironclad    | `#802020` |
| Silent      | `#1A6625` |
| Defect      | `#1D5673` |
| Necrobinder | `#803367` |
| Regent      | `#803D0E` |
| Quest       | `#431E14` |
| 그 외(Curse/Status/Colorless/Event) | `#5C5440` (CardPoolModel 기본값) |

별 코스트 outline: `StsColors.defaultStarCostOutline` = `#175561` (Regent 전용)

## 3. 카드 배너(리본) HSV (희귀도별)

소스: `materials/cards/banners/card_banner_*_mat.tres` — 베이스 텍스처는 `card_banner.png` (회색-청록). HSV 셰이더가 색상 변환.

| 희귀도 | h | s | v |
|---|---|---|---|
| common | 1.0 | 0.0 | 0.85 |
| uncommon | 1.0 | 1.0 | 1.0 |
| rare | 0.563 | 1.198 | 1.14 |
| ancient | 0.0 | 0.2 | 0.9 |
| curse | 0.27 | 1.1 | 0.9 |
| quest | 0.515 | 1.727 | 0.9 |
| event | 0.875 | 0.85 | 0.9 |
| status | 0.634 | 0.35 | 0.8 |

CSS filter 변환: `hue-rotate(${h*360-360}deg) saturate(${s}) brightness(${v})`.

## 4. 카드 프레임 HSV (캐릭터별)

`materials/cards/frames/card_frame_<color>_mat.tres`
| 색 | h | s | v |
|---|---|---|---|
| red (ironclad) | 0.025 | 0.85 | 1.0 |
| green (silent) | 0.32 | 0.45 | 1.2 |
| blue (defect) | 0.55 | 0.9 | 1.0 |
| pink (necrobinder) | 0.965 | 0.55 | 1.2 |
| orange (regent) | 0.12 | 1.5 | 1.2 |
| colorless | 1.0 | 0.0 | 1.2 |
| curse | 0.85 | 0.05 | 0.55 |
| quest | 1.0 | 1.0 | 1.0 |

## 5. 폰트 사이즈 (598×844 카드 기준)

`scenes/cards/card.tscn` (Min/Max는 `MegaLabel` 자동 축소 범위)

| 라벨 | font_size (max) | min | offset (w×h) |
|---|---|---|---|
| TitleLabel | 26 | (default) | 210×54 |
| DescriptionLabel | 21 | 12 | 243×136 |
| EnergyLabel | 32 | 22 | 46×56 |
| StarLabel | 22 | 16 | 28×40 |
| TypeLabel | 16 | 10 | 44×28 |

비율(카드 width 598 기준 cqi/%):
- 타이틀: 26/598 = **4.35cqi**
- 설명: 21/598 = **3.51cqi**
- 코스트: 32/598 = **5.35cqi**
- 타입: 16/598 = **2.68cqi**
- 별: 22/598 = **3.68cqi**

→ `container-type: inline-size`로 카드 컨테이너 잡고 cqi 단위 사용.

## 6. Hover Tip 9-slice

`scenes/ui/hover_tip.tscn` + `images/ui/hover_tip*.png`
- region: `Rect2(0, 0, 339, 107)`
- patch margins: left=55, top=43, right=91, bottom=32
- title font: gold #EFC851, font_size=22, shadow offset (3,2)
- desc default_color: cream #FFF6E2, shadow (3,2,0.251)
- variants:
  - `hover_tip.png` — 기본 (검정/회색)
  - `hover_tip_buff.png` — 버프(녹색)
  - `hover_tip_debuff.png` — 디버프(빨강) — `materials/ui/hover_tip_debuff.tres`는 `h=0.47 s=2.0 v=0.9` HSV

## 7. 인챈트 데이터

`data/sts2/{kor,eng}/enchantments.json` — 22종, `card_type: Attack | Skill | null` (null=공통).
- `description`: 인챈트 설명 (호버 툴팁용)
- `extra_card_text`: 카드 본문 추가 텍스트 (인챈트 적용 시 카드 설명 끝에 append)
- `image_url`: 인챈트 아이콘 (`/images/sts2/enchantments/<id>.webp`)

`card_enchant.png` 슬롯 텍스처: 코스트 아이콘 아래 (`offset(-166,-116) → (-94,-62)` = 72×54). 인챈트 아이콘은 슬롯 안쪽에 그려짐.
