# Task 009: 과거 빌드 depot 기반 API 보강과 공통 렌더 변경

## 상태: TODO

## 분류

대규모 리팩토링. 시작 전에 worktree 사용 승인을 받는다
([docs/RELEASE_PROCESS.md](../docs/RELEASE_PROCESS.md) 1절).

## 목표

과거 게임 빌드 원본(depot)을 근거로 버전별 API를 보강하고, 특히 STS1 컴펜디움을 같은 구조로
올린다. 그에 맞춰 서비스 전반의 카드/유물 등 공통 렌더를 바꾼다.

## 참고

- STS2 구 빌드 아카이브: `AGENTS.md` "STS2 구 빌드 아카이브", [docs/STS2_DEPOT_MANIFESTS.md](../docs/STS2_DEPOT_MANIFESTS.md)
- 버전 API 전수 조사: [docs/VERSION_API_AUDIT.md](../docs/VERSION_API_AUDIT.md)
- Steam 로그인은 사용자가 직접 한다.

## 백로그

- [ ] STS1 과거 빌드 depot manifest 확보 및 아카이브 구성 (STS2 방식과 동일 위치 규칙)
- [ ] STS1 빌드별 정답 데이터 추출 (카드/유물/포션/파워 등)
- [ ] 버전 API 보강: STS1·STS2 공통 스키마로 버전별 값 제공, 정답 대조 테스트
- [ ] STS1 컴펜디움을 버전 API 기반으로 재구성
- [ ] 공통 렌더(카드/유물 타일, hover, 패치 diff 표시)를 버전 API에 맞게 변경하고 전 서비스 적용
- [ ] 게임 정합 전수 검수 (전 항목·타입별)
