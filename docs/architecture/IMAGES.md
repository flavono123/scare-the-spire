# 이미지 처리

## 원본 소스

- **카드 이미지**: slaythespire.wiki.gg
  - 기본: `https://slaythespire.wiki.gg/images/{Color}-{WikiName}.png`
  - 강화: `https://slaythespire.wiki.gg/images/{Color}-{WikiName}Plus.png`
  - 베타: `https://slaythespire.wiki.gg/images/Beta-{Color}-{WikiName}-Art.png`
  - Color: Red (Ironclad), Green (Silent), Blue (Defect), Purple (Watcher), Colorless, Curse
- **유물 이미지**: slaythespire.wiki.gg
  - `https://slaythespire.wiki.gg/images/{RelicName}.png`

## WebP 변환

원본 PNG를 WebP 340w (카드) / 원본 크기 (유물 아이콘)으로 변환하여 git에 직접 커밋.
LFS 불필요.

### 변환 명령

```bash
# 카드 (340w, quality 80)
cwebp -q 80 -resize 340 0 input.png -o output.webp

# 유물 (원본 크기 유지, quality 80)
cwebp -q 80 input.png -o output.webp
```

### 결과

| 대상 | 원본 | WebP | 절감 |
|------|------|------|------|
| 카드 (1083 files) | 211MB PNG | 28MB WebP | 87% |
| 유물 (182 files) | TBD | TBD | - |

## 파일 구조

```
public/images/
├── cards/
│   ├── {id}.webp            # 기본 아트
│   ├── {id}_upgraded.webp   # 강화 아트 (저주/상태이상 제외)
│   └── {id}_beta.webp       # 베타 아트
└── relics/
    └── {id}.webp            # 유물 아이콘
```

## 네이밍 규칙

- id = `toSlug(name)`: 소문자, `.` `'` 제거, 비영숫자 → `-`
- Strike/Defend: `strike-ironclad`, `defend-silent` 등 클래스 suffix
- 강화: `_upgraded` suffix
- 베타: `_beta` suffix

## 프로덕션 아트 변경

얼리 액세스 이후 프로덕션 카드/유물 아트가 변경된 이력 없음.
"캡틴 팔콘 Flying Knee" 등은 모두 베타 아트 (인게임 토글).
