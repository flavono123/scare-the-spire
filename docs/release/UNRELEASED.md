# 미배포 기능 대장

마지막 정기 배포 이후의 기능 기대치와 열린 worktree를 기록한다.
작성·관리 규칙: [../RELEASE_PROCESS.md](../RELEASE_PROCESS.md).

기준점: 마지막 성공 프로덕션 실행 `438e5e86`(2026-11-09). 범위는 `438e5e86..main`.

## 열린 worktree

| 이름 | 브랜치 | 목적 | 상태 |
|---|---|---|---|
| domain-migration-c54d7b | claude/domain-migration-c54d7b | 도메인 이전(레거시 호스트 안내, 리다이렉트, robots/sitemap) | 11커밋, main보다 332 뒤처짐. 2026-10-26 정기 배포에서 제외 |
| step3-reads | step3/reads | Supabase 이관 3단계: 읽기를 D1으로(`read.<group>` 플래그, 역사 강의서 요약 목록·R3r 원문) | testbed 확인 끝(모든 그룹 `read.<group>` = d1로 둠). `refactor/supabase-exit`에 병합 대기 |
| supabase-exit | refactor/supabase-exit | Supabase → D1 이관. 계획은 [SUPABASE_EXIT_PLAN.md](../SUPABASE_EXIT_PLAN.md) 7절 | 2~5단계 코드를 2026-11-09 운영에 냈다(`438e5e86`). 운영은 5단계(모든 `source.<group>` = d1, 동기화 꺼짐, 쿠키 신원, 직접 쓰기 닫힘)다. 6단계 클라이언트 정리는 작업 묶음 WP0~WP-W가 병합됐고 WP-Z(WP-B 패치 릴 포함)는 병합 대기, 배포 전 |
| step6-* | step6/<묶음> | 6단계 작업 묶음([STEP6_PLAN.md](../supabase-exit/STEP6_PLAN.md) 3절). 묶음마다 `.claude/worktrees/step6-<묶음>` | `step6/wp-z`가 마지막(`step6/patch-reels` 병합). `refactor/supabase-exit`에 병합한 뒤 worktree와 브랜치를 지운다 |
| supabase-exit | refactor/supabase-exit | Supabase → D1 이관. 계획은 [SUPABASE_EXIT_PLAN.md](../SUPABASE_EXIT_PLAN.md) 7절 | 2~5단계 코드를 2026-11-09 운영에 냈다(`438e5e86`). 운영은 1단계 화면 전환(전 그룹 api)과 2단계 동기화·그림자가 켜져 있다. 3단계부터 계속한다 |

## Supabase 마이그레이션

| 파일 | Rollout | Order | 적용 | 확인 |
|---|---|---|---|---|
| `20261115000000_drop_favorite_tournament_plays_read.sql`(tasks/010 #67: 이아저? 월드컵 플레이 기록 `favorite_tournament_plays`의 anon 읽기 정책과 select 권한 삭제. 읽는 클라이언트 없음, 되돌리기 `favorite-plays-read/rollback_favorite_tournament_plays_read.sql`) | contract-cleanup | later-release(읽는 앱이 없어 순서와 무관하게 안전하다. 사용자 승인 때 앞당길 수 있다) | 적용 안 함 | 로컬 PGlite `pnpm test:write-gate` 통과 |
| `20261109150000_worker_read_actor.sql`(4단계 쿠키만 있는 신원의 개인 읽기: 프로필·퍼즐상자 읽기 RPC 넷의 `worker_*` 래퍼, service_role만. 되돌리기 `worker-read-actor/rollback_worker_read_actor.sql`) | db-first-additive | before-push(어느 env든 `identity.mode = cookie` 전. testbed는 이미 cookie라 그 전까지 프로필 통계·활동과 퍼즐상자 `me` 읽기가 실패) | 적용 안 함(`step4/prereqs`) | 로컬 PGlite `pnpm test:write-gate` 통과(개인 읽기 22가지 동등, 되돌리기 두 번) |

## D1 마이그레이션

`d1/migrations/`. 운영 DB는 그 표를 쓰는 코드가 나가기 전에 적용한다(`npx wrangler d1 migrations apply slseoun-prod --remote`,
사용자 승인).

| 파일 | testbed(`slseoun-testbed`) | 운영(`slseoun-prod`) |
|---|---|---|
| 0007(4단계 전제: 토큰 서명 키 목록과 폐기 `api_verification_keys`, Worker 소유라 첫 복사의 다시 채우기가 건드리지 않음) | testbed 배포 때 적용(`step4/prereqs`) | 적용 안 함. 표가 없어도 지금과 같다(고정 키만, 1분에 한 번 읽기 실패) |

## 긴급 배포로 QA 없이 나간 범위

- 2026-11-13 v0.113.0 패치노트 긴급 배포(작업 도구 `7d2f9a2a`)에 다른 세션 커밋이 같이 나감: `88fcf932`·`e9cec30e`(문의함 화면, dev 전용), `f2abe1a4`(`pnpm cf:limits` 스크립트), `97ec500b`·`d00b2be3`(/dev/admin CF 한도 탭, dev 전용), `7bdd202b`(문서). 운영 화면 영향 없음.

## 기능 기대치

### sts1-compendium-remaining-types
- Feature: STS1 백과사전 새 분류 8개([tasks/012](../../tasks/012-sts1-compendium-remaining-types.md)). 이벤트 52종(목록은 막·공용·사당, 상세는 게임 이벤트 화면: 패널·배너 제목·액자 그림·리본 선택지, 장면 이동, 무작위 결과 탭, 캐릭터별 본문, 승천 조절기, 얻고 잃는 카드·유물·포션·저주와 전투 몬스터 토큰), 키워드(게임 키워드 47 + 구체 5 + 경지 3, STS1 툴팁 모양, 상세에 쓰는 카드·유물·포션·파워), 승천 1~20(누르면 그 단계로 맞춘 몬스터 도감), 모드 43(커스텀 모드 화면 순서와 색, 일일 도전 표시, 게임에서 쓸 수 없는 6종은 "폐기됨"으로 따로, 게임에 아이콘이 없는 9종은 아이콘 없이, 상세에 같이 못 쓰는 모드·토큰), 역병 13(유물 팝업 모양 상세, 쌓일 때 문구), 니오우(대기 동작 스파인, 한 목록에 버튼 위치·첫 보스 미도달 축복 태그 필터), 도전 과제 46(달성 아이콘 격자, 호버에 조건과 토큰), 점수 31줄(사망·승리 화면 줄 모양, 쓰지 않는 3종 따로). 이벤트 장면은 바이트코드에서 옮긴 `data/sts1/events/*.json`(형식은 그 README, 검사 `scripts/check-sts1-events.ts`를 CI에서 돈다), 문구·그림은 `extract-sts1-compendium.py --only extras`, 니오우 스켈레톤은 `render-sts1-monsters.mjs --npcs`. 멘션 호버·사이트맵·STS1 Worker 경로·게임 전용 로케일 목록까지. 게임이 툴팁을 띄우지 않는 이름 언급(기괴한 트로피의 긍지, 불치병의 판금 갑옷, 스타터 덱의 양자택일, 치명타의 하수인, 승천 10의 등반자의 골칫거리, 네온의 플라즈마, 하트브레이커의 타락한 심장, 기본으로의 회귀의 타격·수비, 둥지·콜로세움의 광신자)은 본문 링크와 "관련 ○○" 레일로 잇는다. 이벤트 본문의 "NL NL"이 두 번 줄바꿈된다(31종).
- Expect: /compendium/sts1/events/big-fish에서 [상자]를 누르면 다음 장면, [떠난다] 뒤 ↺ 처음으로. /compendium/sts1/events/the-mausoleum 승천 15에서 저주 확률 50%→100%. /compendium/sts1/keywords/exhaust 레일에 소멸 카드. /compendium/sts1/ascensions 줄을 누르면 /compendium/sts1/monsters가 그 승천으로 열린다. /compendium/sts1/modifiers/blight-chests에 역병 토큰 7개와 호버. /compendium/sts1/neow에서 니오우가 움직이고 왼쪽 "첫 보스에 닿지 못한 다음 판"을 누르면 2줄만 남는다. /compendium/sts1/blights/grotesquetrophy 본문 "긍지를"과 관련 카드가 /compendium/sts1/cards/pride로 간다. /en·/ja 목록, /en 상세 200. 정적 파일 main은 목록 8×28 + 그림 약 +130, 상세 약 130×4는 STS1 Worker.
- QA: 로컬 dev 내장 브라우저(1440·375 폭)로 확인. 이벤트 52종 전 장면을 클릭 순회(승천 0·15 두 번, 깨진 문구 0). 8분류 게임 한국어 이름·설명 전수 대조 누락 0. 영어·게임 언어(ja·zh·de) 목록, en 상세 200. 확인 못 함: 게임 화면과 나란히 놓은 캡처(게임을 실행하지 못함), 원격 testbed, 이벤트 승천 15 외의 승천 분기(13 마인드 블룸 보상은 글에 숫자가 없어 표시 안 함).
- Commits: `af2ba850`부터.

### sts1-worker
- Feature: STS1 백과사전 상세(ko·en)를 별도 Worker `scare-the-spire-sts1`이 서비스 바인딩 `STS1_WORKER`로 다시 서비스한다(8cd3f7eb 되돌리기, main 정적 파일 예산 미사용). 게임 전용 로케일은 목록 모달로 308. main 애셋에 없는 `/_next/static`은 STS1 Worker에 묻는다. STS1 링크·댓글 링크·사이트맵·canonical이 다시 상세 페이지를 가리킨다. CI는 STS1 Worker를 main보다 먼저 배포한다. 설계는 [docs/designs/sts1-compendium-worker.md](../designs/sts1-compendium-worker.md).
- Expect: /compendium/sts1/cards/strike-r, /en/compendium/sts1/relics/burning-blood가 문서·RSC 모두 200과 `x-cf-static-page: compendium`, /cards/bash는 200과 `x-cf-static-page: legacy`. /ja/compendium/sts1/cards/strike-r은 /ja/compendium/sts1/cards?card=strike-r로 308. STS1 댓글 링크(sts1-codex:card:strike)는 /compendium/sts1/cards/strike#comments로 간다. STS1 목록 타일은 그냥 클릭하면 모달, 새 탭이면 상세. /sitemap.xml에 /compendium/sts1/<type>/<slug>가 다시 있다.
- QA: 위 경로들(문서·RSC), STS1 목록 타일 클릭·새 탭, 이야기·byrdispatch의 STS1 댓글 링크, /sitemap.xml, /compendium/sts1/cards/strike-r canonical. 브랜치에서 로컬만 확인함(cf:build 검사, pre-push, cf:size, 로컬 testbed 스모크 204/206, 기능 20/20, 새로고침 없는 이동 3/3). 원격 testbed(2026-11-18, `3642dce0`, STS1 testbed Worker 첫 배포): `cf:smoke --scope all` 204/206(실패 2개는 운영에도 있는 "Latest Korean/English patch" 옛 기대값), `qa:cf:testbed` 15/16(실패 1개는 운영에도 있는 게임 전용 로케일 prefetch 미완료, tasks/010 #80), 위 Expect 경로를 curl로 확인(ko·en 상세 문서·RSC 200 `compendium`, `/cards/bash` 200 `legacy`, `/ja` 문서 308·RSC 404는 병합 전과 같음, canonical, 사이트맵 STS1 상세 1,584개), 새로고침 없는 이동 4/4(ko STS1 상세↔상세, STS2 목록→STS1 상세, STS1 상세→STS2 목록, en 상세→상세, 페이지 오류 0). 확인 못 함: 운영 첫 배포(Worker `scare-the-spire-sts1`이 처음 생긴다), 이야기·byrdispatch의 STS1 댓글 링크, 목록 타일 새 탭 클릭.
- Commits: `640b452d`~`3c1ed6a8`, 병합 커밋.

### v0113-history-course-map
- Feature: 역사 강의서가 v0.113 런의 지도를 다시 그린다. 일반 런은 v0.113.0 지도 생성 규칙(휴식처 5행부터, 타입 큐 순서 유지, 경로 정리 후 보정 규칙, 하위 Rng로 섞기)을 따르고, 블리츠 런은 고정 일직선 지도(고대 → 몬스터·몬스터·상점·엘리트·보물·휴식처 → 보스)를 쓴다. v0.113 업데이트 전에 시작해 후에 끝난 런은 이전 규칙 지도로 돌아간다. 상단 바 보스 초상화는 그 막에서 싸운 보스를 보이고, 보스까지 못 간 막만 예측한다. 블리츠 상점 칸은 블리츠 상인 깔개에 품목 6개를 슬롯 순서로 깔고, 산 품목마다 한 단계씩 칸이 비며 보상이 그 칸에서 상단 바로 날아간다. 남은 선택 수 문구가 줄고(두 개 더 선택은 +1), 다 쓰면 남은 품목이 어두워진다.
- Expect: v0.113.1 일반 런(예: 프로필1 `1794965035.run`)과 블리츠 런(`1794919035.run`)의 지도에 캐릭터 위치와 지나온 경로가 나오고 칸을 넘기면 지도가 따라 올라간다. 블리츠 지도는 칸 8개짜리 한 줄이다. 각 막 보스 칸에서 상단 바 초상화가 실제 싸운 보스다. v0.111 이하 런은 그대로다.
- QA: 프로필1 런 191개를 `analyzeReplayRun`으로 확인(v0.113 런 전 막 경로 1개, 보스 불일치 0, 기존 v0.111 Spoils 3막 미매칭은 변경 전과 같음). 로컬 dev 브라우저(공유 끔, 외부 호스트 차단)로 블리츠·v0.113.1 일반·업데이트를 걸친 런 확인. 블리츠 상점 칸 39개를 재생해 품목 6개, 산 품목 수만큼 빈 칸, 남은 선택 문구 감소, 페이지 오류 0을 확인. 확인 못 함: v0.113 지도 세로 배치 공식(행 높이 반영)은 반영 안 함, 블리츠 상점의 남은 선택 문구는 게임 위치(깔개 맨 아래)라 재생기 하단 타임라인과 겹친다, 희귀 품목 반짝임(RareVfx) 없음, 카드 보상 묶음 배정은 보상 3장 기준.
- Commits: `25e71dd0`(다른 세션 커밋에 섞여 들어간 휴식처·보정 규칙과 블리츠 지도), `371dc81b`, `c1d21a82`, `338bc95b`.

### v0113-blitz-dread-compendium
- Feature: 백과사전 새 분류 둘. 블리츠 상점(`/compendium/blitz-shop`, 상인 품목 20종을 상인의 양탄자에 6칸씩 배치, 칸에 마우스를 올리면 게임식 툴팁, 클릭 시 상세 모달)과 드레드 권능(`/compendium/dominions`, 보스 12명의 권능과 드레드 규칙, 막별). 블리츠 필터는 분류(서비스 정의, 품목 2개 이상인 것만: 강화·카드 보상·인챈트·유물)·희귀도·저주, 정렬은 게임 순서·분류순·이름순과 방향. 인챈트·캐릭터 카드 보상은 템플릿 하나로 묶고 상세에서 값을 고른다. 드레드 필터는 막·분류(서비스 정의: 적 강화·플레이어 약화·피해·상태이상 추가). 두 상세 모두 관련 리소스 레일(소스에서 정의한 관계, `blitz-dread-relations.ts`): 블리츠는 인챈트·캐릭터·블리츠 저주 10장, 권능은 보스 전투·몬스터·파워·카드. 게임 로컬라이제이션 15개 언어, 검색 색인, 네비·백과사전 첫 화면 카드, 사이트맵, 권능은 설명 속 자동 링크·호버까지. 블리츠 품목은 이름("유물", "포션")이 일반 용어라 자동 링크 대상에서 뺐다.
- Expect: /compendium/blitz-shop에 양탄자 4장(6·6·6·2칸), 3열 칸의 툴팁은 왼쪽으로 열림, 분류 "인챈트"를 켜면 3개. /compendium/blitz-shop/card_enchant 상세에서 "활기"를 고르면 설명이 "카드 1장에 활기을(를) 인챈트합니다."로 바뀐다. /compendium/dominions 분류 "적 강화"·"플레이어 약화"는 4개, "상태이상 추가"는 2개(영겁의 모래시계·영혼 물교기). /compendium/dominions/kaiser_crab 레일에 관련 전투·몬스터(분쇄기·로켓)·파워(판금). /compendium/blitz-shop/glam 레일에 호화와 저주 10장. /en, /ru 페이지는 그 언어 문구. 정적 파일 약 +170.
- QA: 위 경로를 로컬 dev 브라우저로 확인함(ko·en·ru, 블리츠 툴팁·필터·모달·값 선택, 드레드 필터, 모바일 375 폭). 확인 못 함: `pnpm cf:build` 정적 파일 수, 패치 이력 칸(두 분류 모두 아직 없음), 터치 기기 툴팁(탭하면 바로 모달).
- Commits: `41afaf8e`부터, `d0623de2`(Worker 정적 라우팅에 두 분류 추가. 없으면 `pnpm cf:build`의 cf:assets가 막혔다).

### v0113-pets-compendium
- Feature: 백과사전 새 분류 펫(`/compendium/pets`). 게임이 `PlayerCmd.AddPet`으로 플레이어 편에 세우는 5종: 골골이(네크로바인더 소환), 그리고 `AddsPet` 유물의 워피·짹짹이·섀다인·파엘의 군체. 인덱스·상세 모두 게임 스파인 대기 동작으로 그리고, 스킨은 게임의 기본값(짹짹이 형태 1, 섀다인 머리 1+아이언클래드 눈, 파엘의 군체 눈). 상세 무대 밑에서 외형을 토큰으로 고른다: 짹짹이·섀다인 머리 1~4(스켈레톤에서 그 부위만 떼어 낸 그림, `scripts/render-sts2-pet-look-tokens.py`), 섀다인 눈은 캐릭터별 냠냠 쿠키 토큰, 파엘의 군체 외형(눈·뿔·가시·날개 중 하나). 토큰에 마우스를 올리면 그 외형 이름(머리 N, 캐릭터 이름, 눈·뿔·가시·날개)만 띄운다. 외형을 바꾸면 고른 행동이 풀린다. 게임이 트는 행동(골골이 공격·쑤시기·피격·사망·부활, 워피 피격·사망, 짹짹이 공격, 섀다인 공격·진화, 파엘의 군체 방어·잠들기·깨어나기)은 몬스터처럼 오른쪽 "행동" 레일에서 재생하고, 고른 행동을 다시 누르면 풀린다. 상세 무대는 대기와 제자리 액션을 담는 고정 프레임(스켈레톤에서 계산)이라 액션마다 화면이 다시 잡히지 않는다. 설명은 게임 문구(유물 설명, 골골이는 "소환" 툴팁, 워피는 체력 변수가 없는 이벤트 문구). 상세 기본 정보 레일은 몬스터처럼 영어명만 두고, 관련 리소스 레일(게임 문구에서 펫 이름, 골골이는 "소환"까지 금색으로 언급하는 카드·파워·유물·포션·이벤트, 그리고 유물이 건드리는 카드). 반대쪽으로 카드·유물·파워·포션·이벤트·고대의 존재 상세에 "관련 펫" 줄. 검색, 호버, 자동 링크(유물과 이름이 같은 펫은 유물이 먼저), 네비·백과사전 첫 화면 카드, 사이트맵. 필터는 없다(어느 기준으로 나눠도 한 마리짜리 묶음이 생김).
- Expect: /compendium/pets에 5마리. /compendium/pets/osty 레일에 캐릭터 네크로바인더, 유물 3(뼈 플루트·구속된 성물함·해방된 성물함), 카드 26, 파워 6, 포션 뼈다귀 영액. /compendium/pets/byrdine에 "진화 전: 짹짹이". /compendium/cards/poke, /compendium/relics/wuppy, /compendium/ancients/pael, /compendium/events/byrdonis_nest 레일에 관련 펫. /en/compendium/pets/byrdpip은 영어 문구. 정적 파일 약 +50.
- QA: 위 경로를 로컬 dev로 확인함(ko·en, 역방향 레일 6종). 확인 못 함: 화면 캡처(브라우저 창이 숨겨져 있었음), `pnpm cf:build` 정적 파일 수, 캐릭터 상세의 관련 펫(캐릭터 상세엔 레일이 없음).
- Commits: `f4df2a78`(데이터. 다른 세션의 블리츠 승천 변경이 섞여 들어감), 그 다음 화면 커밋.

### v0113-blitz-ascension
- Feature: 승천 백과사전에 블리츠 승천. 블리츠 승천 1~5는 게임에서 일반 승천 2·4·8·9·5를 그대로 쓴다(`AscensionHelper.GetLevelForBlitz`). 인덱스에 "게임 모드"(기본·블리츠, 게임 번역) 필터: 둘은 각자 켜고 끄는 필터이고 처음엔 아무것도 켜지 않아 기본(11)과 블리츠(6)가 모드별 묶음으로 다 나온다. 블리츠 묶음은 블리츠 단계 순으로, 게임의 블리츠 아이콘(초록 번개, `packed/character_select/blitz_top_bar_icon.png`)과 연두 숫자, 밑에 "승천 N". 0단계는 게임처럼 숫자 없음. 상세에 "블리츠 N" 배지, 검색·자동 링크 별칭 "블리츠 승천 N"/"Blitz Ascension N". 새 페이지 없음.
- Expect: /compendium/ascensions 처음엔 17개(기본·블리츠 묶음), "블리츠"만 켜면 6개(0~5, 초록 번개), 1=지친 여행자(승천 2), 5=등반자의 골칫거리(승천 5). /compendium/ascensions/level_08 상세에 "블리츠 3". /ja/compendium/ascensions 필터 이름은 ゲームモード·スタンダード·ブリッツ.
- QA: 위 경로를 로컬 dev로 확인함(ko 인덱스·상세, en 상세, ja 필터 이름). 확인 못 함: 모바일 폭 화면 캡처(브라우저 창이 숨겨져 있었음).
- Commits: 데이터 쪽(`blitzLevel`, 게임 모드 이름)은 펫 세션 커밋 `f4df2a78`에 섞여 들어갔고, 화면은 그 다음 커밋.

### byrdispatch-2026-11-19
- Feature: 섀소식 2026-11-19(ko·en, 캡처 2장). 백과사전 새 메뉴 블리츠 상점·드레드 권능·펫은 섀소식 제목에 메뉴 아이콘과 링크가 붙고, 다음 섀소식이 나올 때까지 네비 백과사전(STS2) 드롭다운 행에 NEW, 백과사전 아이콘에 초록 새 서비스 점이 뜬다(장난감 상자 새 서비스와 같은 방식). main 네비(STS1 Worker 상세 포함)와 patch Worker 네비가 같은 데이터를 읽는다.
- Expect: /byrdispatch 맨 위가 2026-11-19, 블리츠 상점 목록·카드 모음집 태그 필터 캡처가 보인다. /, /patches/<버전>, /compendium/sts1/cards/strike-r 네비의 백과사전 아이콘에 초록 점, 드롭다운에 블리츠 상점·드레드 권능·펫 NEW. /en에서도 같다.
- QA: 로컬 dev /byrdispatch(제목 아이콘·링크, 초록 점, NEW 3행). 확인 못 함: patch Worker·STS1 Worker 네비는 testbed에서 본다.
- Commits: `b743c5de`, `b489b0d0`, `3c5c251e`, `e7100ee3`.

### v0113-codex-backfill
- Feature: v0.113.0 백과사전 백필(worktree `v0113-codex-backfill`을 `a822bf5c`로 병합). 새 캐릭터 풀(6번째 캐릭터: 타입·카드 타일 프레임·에너지 아이콘·필터·`[fool]` 색·캐릭터 페이지), 신규 카드 121·유물 17·포션 3·파워 39·이벤트 5·에포크 9·몬스터 2, 기존 카드 43장 갱신, 변경 기록(카드·유물·몬스터·이벤트·포션·파워), 베타 그림만 있는 유물·파워·에포크의 그림 표시, 티어 리스트·페이지스톰의 노랑/풀 색, 영문 짧은 이름 Fool, 패치 줄 생성과 옛 패치노트 공식 개명 반영, 패치 이력 인덱스 재검증(no-cache). 드레드 모드 값을 걸러 내도록 몬스터·조우 파서 수정.
- Expect: /compendium/characters에 풀이 6번째로 나오고 /compendium/characters/fool이 체력 77·골드 99·시작 덱을 보인다. /compendium/cards?card=FOOLISH_SHOT 모달이 풀 프레임으로 뜬다. /compendium/relics?relic=bath_robes가 베타 그림으로 뜬다. /patches/0.113.0의 새 이름이 모두 링크된다. /compendium/monsters/infested_prism 패치 이력에 v0.113.0이 있다. 옛 버전 선택 시 새 카드·유물이 보이지 않는다. 정적 파일은 약 16,000개.
- QA: 위 경로들(브라우저로 확인함: 캐릭터 목록·상세, 카드 상세·모달, 유물 모달, 패치노트 링크, 몬스터 이력). 확인 못 함: 영문 페이지 전체, 모바일 폭, 옛 버전 선택기, 티어 리스트·페이지스톰 색 선택기.
- Commits: `8cd3f7eb`(STS1 상세 내리기, 이미 배포)부터 `a822bf5c`까지.

### supabase-exit-step3-reads
- Feature: 화면 그룹별 읽기 저장소 플래그 `read.<group>`(supabase | d1). d1이면 GET이 D1에서 답한다. 역사 강의서 목록·상세·표지 편집기·코오오옴보 런 고르기가 두 답 모양을 다 읽는다.
- Expect: 플래그가 없으면(운영 기본) 아무것도 바뀌지 않는다. testbed에서 `read.<group>` = d1이면 화면이 supabase일 때와 같고, 역사 강의서 목록 답이 약 0.5 MB로 줄며(원문 없음), 상세와 표지 편집기가 `/api/read/history-run/raw`로 원문을 받는다.
- QA: testbed `/history-course`, `/en/history-course`, `/history-course/<run id>`, 목록의 표지 편집(주인), 코오오옴보 글쓰기의 도전 이력 참조, 백과사전 카드·유물 상세, 장난감 상자 피드들, 다채로운 철학자들, 퍼즐상자, 프로필, 문의. 모바일 320px ko·en
- Commits: step3/reads

### step4-prereqs
- Feature: Supabase 탈출 4단계를 운영에 켜기 전 필요한 것(`step4/prereqs`, refactor/supabase-exit에 합칠 브랜치).
  경로 플래그 env 기본값(`API_PATH_DEFAULT`, 빌드 `NEXT_PUBLIC_API_PATH_DEFAULT`), D1 토큰 서명 키 목록과 폐기
  (`api_verification_keys`, `scripts/verification-keys.ts`), worker 방식 역사 강의서 런 하나씩 공유(Supabase 원본),
  쿠키만 있는 신원의 개인 읽기(읽기 게이트, `20261109150000_worker_read_actor.sql`).
- Expect: 두 기본값을 넣지 않고 `write.history-runs = rls`, `identity.mode = token`이면 모든 화면이 지금과 같다.
  testbed(쿠키 방식, 모든 `write.<group> = worker`)에서 역사 강의서 업로드·공유가 "N개 공유 · M개 이미 공유됨"을
  지금처럼 보이고 Supabase `runs`에 원문 그대로 들어간다. 프로필·문의함·임시 저장·좋아요 표시 등 개인 읽기가 토큰 없이
  같은 값을 보인다(읽기 RPC 넷은 위 Supabase 마이그레이션 적용 뒤).
- QA: testbed `/history-course` 업로드·공유, `/profile`, 문의함 점, 페이지스톰 임시 저장, 이거 아님 저거? 좋아요·투표 표시,
  퍼즐상자 순위. 운영은 기본값과 마이그레이션을 넣는 배포 때.
- Commits: `step4/prereqs`의 커밋들.

### supabase-exit-step6-client
- Feature: Supabase 이관 6단계 클라이언트 정리. 브라우저에 `@supabase/supabase-js`와 Supabase 직접 경로(legacy 읽기·쓰기,
  Realtime 채널, supabase-js 세션 갱신·익명 가입)가 없다. 모든 데이터 호출은 같은 출처 `/api/read|me|write/*`와
  `/api/auth/claim`이고 신원은 서명 쿠키만 쓴다. CSP `connect-src`에서 `*.supabase.co`를 뺐다. `next build`는 아무것도
  읽지 않고, 패치 빌드는 셸 패치 릴을 배포된 사이트의 `/api`에서 굽는다(결정 D1 B안). CI 빌드에는 Supabase URL·키가
  없다. 플래그 CLI는 `path.<group>` legacy, `identity.mode` token, `write.<group>` rls를 `--old-client` 없이 거절한다.
- Expect: 화면은 지금(5단계 운영)과 같다. DNS로 `*.supabase.co`를 막은 새 브라우저에서 홈, 백과사전 상세 댓글·좋아요·반응,
  패치 노트 줄 댓글, 장난감 상자 피드·상세·쓰기, 조각모음, 역사 강의서, 퍼즐상자, 프로필, 문의가
  데이터와 함께 뜨고 쓰기가 된다. 다채로운 철학자들과 네비의 새 글 점·배달부도 `3669c1b2` 핫픽스 뒤에는 Worker가
  D1에서 읽는다(tasks/010 #75, #76 해소). `*.supabase.co` 요청 0, `securitypolicyviolation` 0, `/api` 409 0, "데이터베이스가
  응답하지 않습니다" 없음. 기존 supabase-js 세션이 있는 브라우저는 같은 uid로 claim한다(만료된 토큰은 Worker가 refresh).
  Worker가 409 `surface_legacy`를 주거나 표식 헤더가 없으면 legacy로 가지 않고 "데이터베이스가 응답하지 않습니다"를
  보인다. 셸 패치 `/patches/2026-11-12`, `/patches/2026-09-11`(14개 언어)의 변형 릴 15개 순서와 철학자 카드가 사이트
  `/api`의 최신 값과 같다. 그 릴 읽기가 실패하면 운영 패치 빌드가 멈춘다(지금과 같음. `ALLOW_BUILD_WITHOUT_API=1`로 우회). 미리 그린 HTML은 패치 릴 데이터를 빼고 6단계 전과 같다.
- QA: 병합 뒤 `pnpm cf:testbed` 전체와 공통 브라우저 확인(새 프로필 Chromium, `--host-resolver-rules="MAP *.supabase.co ~NOTFOUND"`,
  `slseoun_qa` 쿠키 없음): https://scare-the-spire-testbed.flavono123.workers.dev/ ,
  https://scare-the-spire-testbed.flavono123.workers.dev/c-c-c-combo ,
  https://scare-the-spire-testbed.flavono123.workers.dev/history-course ,
  https://scare-the-spire-testbed.flavono123.workers.dev/patches/2026-11-12 ,
  https://scare-the-spire-testbed.flavono123.workers.dev/en/patches/2026-11-12 ,
  https://scare-the-spire-testbed.flavono123.workers.dev/patches/2026-09-11 에서 (a) supabase.co 요청 0, (b) CSP 위반 0,
  (c) `/api` 409 0, (d) "응답 없음" 문구 없음. 기존 testbed Supabase 세션을 localStorage에 넣은 두 번째 프로필로 댓글
  하나를 써 uid가 그대로인지 본다. 배포 전 두 Worker의 직전 버전 id를 기록하고, 배포 뒤 운영을 같은 방법으로 확인한다.
  넘어갈 조건은 Supabase 로그에서 운영 referer의 `/rest/v1`, `/auth/v1`, `/realtime` 요청 0건이다.
- Commits: `refactor/supabase-exit`의 6단계 병합(`step6/wp0`, `wp-a`, `wp-p`, `wp-n`, `wp-c`, `wp-d`, `wp-h`, `wp-t1`,
  `wp-t2`, `wp-q`, `wp-w`, `step6/wp-z`(`step6/patch-reels` 포함)). OG D1(`step6/og-d1`)과 관리 도구(`step6/dev-tools`)는
  2026-11-09에 먼저 나갔다.

### code-read-cross-links
- Feature: 관련 리소스 레일과 이벤트 선택지 호버를 게임 코드에서 읽는다(`scripts/extract-code-relations.py` → `data/sts2/code-relations.json`, 손 표와 합집합). v0.113 신규 이벤트(전쟁군주의 성지·노누파이페의 대욕장·고문 박물관·뻔한 비밀의 폭포·곤경에 처한 워피)와 기존 누락(유물→카드 20, 유물→인챈트 6, 카드·유물·포션→파워)이 채워지고, 이벤트 ↔ 고대의 존재 레일이 새로 생긴다. 런타임에 굴리는 이벤트 값(대욕장 유물, 박물관 유물, 워피 체력 5%)을 모든 게임 언어에서 채운다. 패치 때 `pnpm codex:relations`, CI에 `pnpm codex:event-templates`.
- Expect: /compendium/events/shrine_of_the_warlord 레일 카드 3(서투름·강력한 방패·강력한 무기)·유물 강력한 날개·고대의 존재 탄스, "날개를 가져간다" 호버에 서투름+강력한 날개. /compendium/events/thermae_nonupeipe "노누파이페의 유물을 얻습니다", 호버에 죄책감+노누파이페 유물 9개, 레일에 노누파이페. /compendium/ancients/tanx 레일에 전쟁군주의 성지. /compendium/cards/mighty_shield·/compendium/relics/mighty_wings 레일에 전쟁군주의 성지.
- QA: 위 경로를 로컬 dev로 확인함(직접 페이지, 이벤트 목록 모달). 확인 못 함: 카드 176장·유물 86개에 늘어난 파워 레일 전수 화면, ko 외 언어 화면.
- Commits: `b91c7bc4`, `1cde02e9`, `4e33f5b3`, `a21c077b`(2026-11-19 `c624132b`까지 push), `23a293a2`, `8fdcd0ad`(선택지 미리보기가 종류별 4개 초과면 겹쳐 쌓고 +N. 대욕장 +5, 쓰레기 더미 +6, 레피 상자 포션 +59).

### shorts-sim-capture-tools
- Feature: 쇼츠용 전투 시뮬레이터(dev 전용 `/dev/combat-sim`)와 `pnpm shorts:capture`·`shorts:changes` 개선(0.113 쇼츠 요청). `monsters=`·`monsterHp=`, `hp=0`·`intents=0`·`ui=card`·`bgHeight`·`feetY`·`crop`·`layout=shorts`·`layer=`, 몬스터 사망, 카드 연출(애니메이션·타격 VFX·화면 흔들림·대상 화살표), `--layers`, `--no-flavor`·`--art-only`, 다운로드 버튼 재시도, `shorts:changes`의 `class`(new·same-tile·wording·tile_changed), 패치 날 보관 스크립트. 운영 번들에는 `public/images/sts2/vfx/hit`(10)·`combat-ui/fool`(6)·`combat-ui/targeting_arrow_*`(2)·휴식 장소 이미지 3장이 정적 애셋으로 들어가고, 유물 타일과 에포크 상세에 `data-capture-*` 속성만 더해졌다.
- Expect: 운영 화면은 그대로다(속성만 추가, 새 이미지는 참조하는 곳 없음). `/compendium/relics/byrdpip`·`/compendium/epochs/fool1_epoch` 화면과 이미지 다운로드가 지금과 같다. `pnpm cf:limits`의 main 정적 애셋이 약 20개 늘어난다(예산 19,500 안).
- QA: 없음(dev 도구). 확인함: 위 두 상세 페이지의 캡처, `pnpm test:combat-sim`, `tsc`.
- Commits: `1bf5c04b`부터 이 항목을 쓴 커밋까지(`scripts/`·`docs/COMBAT_SIM.md`·`src/app/(main)/dev/combat-sim`·`src/lib/combat-sim`).

### known-issues-fixes-2
- Feature: tasks/010 #62~79 처리(2026-11-15). 게임 요소 선택 창(코오오옴보·변형 작성, 코오오옴보 목록 필터)에서 Esc가 선택 창만 닫음(#63). 게임 전용 언어 페이지의 JS 끈 헤더 링크가 그 언어 접두사로 감(#64). 케미컬 X 상세가 읽기 실패와 없는 글을 구분(#73). 이야기를 쓸 때 목록이 100개로 잘리지 않음(#72). DOM 저장소 없는 브라우저가 첫 페이지 밖에서도 쓰기 가능(#74). 카드 20장의 수치·비용·X 비용·대상을 게임에 맞추고 ko 행이 영어이던 3장을 한국어로(#77). 무한의 컨베이어 접시 값 40 골드(#78). 파워 DIAMOND_DIADEM·DOOR_REVIVAL 폐기 표시(#79). 꺼져 있는 상세 OG 보강: 유튜브 썸네일 주소, 어려운 결정 제목(#69, #71). dev 전용·테스트: 관리 글 서비스 중복 키(#66), contact spec(#65). Supabase 마이그레이션 1건은 만들기만 했다(#67, 위 표).
- Expect: `/c-c-c-combo` 작성창에서 선택 창을 열고 Esc 한 번이면 선택 창만 닫히고 두 번째가 작성창을 닫는다. `/ja/compendium/cards`를 JS 없이 열면 헤더 둘째 줄 링크가 `/ja`, `/ja/compendium` …이다(ko·en 페이지는 그대로). `/en/compendium/cards/hemokinesis`가 Deal 15 damage, `seance`가 비용 1(강화 0), `begone`·`not_yet` 대상 Self, `all_for_one`·`bullet_time`·`jackpot`·`scrape`·`transfigure`에 X 비용 표시 없음. `/compendium/events/endless_conveyor`와 en 판에 40 골드. `/compendium/powers/diamond_diadem`·`door_revival`이 폐기 표시(회색). `/patches/changes`에서 이야기를 쓰면 줄별 이야기 수가 줄지 않는다. DETAIL_SHELL_OG와 마이그레이션이 꺼져 있어 운영 OG와 DB는 그대로다.
- QA: 위 경로들. 확인함: Esc 동작(Playwright, dev 서버, 고치기 전에는 실패), 케미컬 X 상세의 읽기 실패·없는 글 화면(Playwright 모의 응답), 빌드 산출물의 ja·de 헤더 링크, `scripts/contact.spec.ts` 5개, `detail-shell-og.spec.ts`, `api-identity-client.spec.ts`, `test:write-gate`, `i18n:validate`, `tsc`. 확인 못 함: 이야기 목록 잘림(브라우저), 영문 카드 20장 전체의 모달 화면, 실제 WebView(#74).
- Commits: `7b2b8616`, `c0ebccac`, `214ddf9b`, `464b2a45`, `ac1087ab`, `9a9ba0ff`, `6565fe37`, `50b4d6bb`, `ad97242e`, `1bd87ba8`, `ef686fa8`, `7624530b`, `9e13ff0e`, `8b93262f`.

<!--
### <항목-id>
- Feature:
- Expect:
- QA:
- Commits:
-->
