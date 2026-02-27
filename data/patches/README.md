# 패치 노트

슬레이 더 스파이어 패치별 원문/요약 노트.

## 구조

각 패치는 별도 md 파일로 작성:
- `weekly-patch-XX.md` — Weekly Patch (얼리 액세스)
- `v1.1.md`, `v2.0.md` — 정식 패치

## 작성 가이드

```markdown
# Weekly Patch XX: Title

- **Date**: YYYY-MM-DD
- **Source**: https://store.steampowered.com/news/...

## Balance Changes

### Cards

- CardName: change description (before → after)
- CardName+: upgraded change description

### Relics

- RelicName: change description

### Potions

- PotionName: change description

## Bug Fixes

- ...

## Other

- ...
```

## 주의사항

- 다른 세션에서 병렬로 패치 노트를 작성할 수 있음
- 파일명 충돌을 피하기 위해 **패치 번호 기반 파일명** 사용
- `data/changes.json`은 이 패치 노트에서 추출한 구조화 데이터
- 패치 노트 원문은 md, 구조화 변경은 changes.json — 둘 다 유지

## 커버리지

패치 노트 원문 **전부 수집 완료** (Steam News API 기반).

| 범위 | 총 개수 | 수집 완료 | 비고 |
|------|---------|-----------|------|
| Weekly Patch (1-56) | 56 | 56 | 얼리 액세스 (2017.11 ~ 2019.01) |
| V1.1: The Dealer | 1 | 1 | 2019.07 |
| V2.0: The Watcher | 1 | 1 | 2020.01 |
| V2.2: Happy Holidays! | 1 | 1 | 2020.12 |

## 관계

- **패치 노트 원문** (SSOT): `data/patches/*.md`
- **구조화 변경 데이터** (추출): `data/changes.json` — 패치 노트에서 추출한 diff 데이터
- 구조화 데이터는 패치 노트의 부분집합 (밸런스 변경만 추출)
