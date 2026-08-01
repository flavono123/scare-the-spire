# 이거 아님 저거? 투표 기능 리서치·디자인

- 상태: 구현 전 권장안
- 범위: `/this-or-that` 목록과 상세의 익명 양자택일 투표, 운영 지표
- 비범위: 이 문서만으로 Supabase migration 적용이나 배포를 승인하지 않는다.

## 1. 결론

첫 버전은 **목록에서 바로 하는 익명 1탭 투표 → 즉시 결과 공개**로 간다.

1. 두 선택지는 같은 크기와 강조도로 동시에 보여준다.
2. 투표 전에는 `총 N표`만 보여주고 좌우 득표율은 숨긴다.
3. 게임 요소 하나를 탭하면 별도 로그인, 확인창, 제출 버튼 없이 투표한다.
4. 선택 직후 같은 자리에서 좌우 `% + 표 수`와 내 선택을 보여준다.
5. 한 게시글에는 익명 브라우저 계정당 한 번만 투표하며 v1에서는 바꿀 수 없다.
6. 투표하지 않아도 글 열기, 백과사전 이동, 좋아요, 댓글, 다음 글 탐색은 모두 가능하다.
7. `현황만 보기`와 마감 시간은 v1에 넣지 않는다.

즉, 투표는 페이지 이용의 블로커가 아니다. 결과만 독립적인 선택 전에 가려 둔다.

## 2. 리서치에서 가져온 원칙

### 결과 선공개는 선택을 왜곡한다

- Muchnik·Aral·Taylor의 대규모 무작위 실험에서 임의로 주어진 선행 평가는 이후 평가 행동과 최종 집계에 유의한 쏠림을 만들었다. 선행 +1은 다음 긍정 평가 가능성을 32%, 최종 평점을 평균 25% 높였다.
- Boukouras 등의 2023년 실험에서도 편향된 중간 여론 노출은 선호 후보의 득표율을 6.1~16%p 움직였다. 참가자가 편향을 알고 있어도 효과가 남았다.

따라서 투표 전에는 방향성 없는 `총 N표`만 사회적 증거로 노출하고, 좌우 비율·우세·득표 수는 숨긴다. “참고용 결과”라는 안내문으로 편향을 상쇄하려 하지 않는다.

### 검증된 저마찰 패턴은 1탭 후 즉시 공개다

- X Poll은 선택지를 한 번 누르면 즉시 제출하고 결과와 내 선택 체크를 보여준다. 투표는 한 번이며 공개 집계에 사용자 신원을 노출하지 않는다.
- Twitch는 Poll을 익명으로 가볍게 참여할 수 있는 도구로 설명하고, Prediction에는 blue/pink 양 진영과 선택 배지를 써서 가벼운 경쟁감을 만든다.

여기서는 X의 `1탭 → 결과` 흐름과 Twitch의 양 진영 시각 문법만 가져온다. 포인트, 배당, 손익, 승패, 카운트다운은 미래 사건 예측이 아닌 취향 투표에 맞지 않으므로 가져오지 않는다.

### `현황만 보기`를 v1에서 빼는 이유

결과를 보고 싶은 사람에게 투표를 강제하면 무성의한 표가 생기거나 이탈할 수 있다. 반대로 결과를 먼저 보여주면 선택 독립성이 깨진다. 이 서비스에서는 투표가 한 번의 큰 탭이고 투표 없이도 페이지의 다른 기능을 모두 쓸 수 있으므로, 우선 결과만 게이트하는 쪽이 더 작은 절충이다.

실제 사용자 불만이나 장기 데이터에서 이 게이트가 병목으로 확인될 때만 `관전하기`를 검토한다. 그때는 결과를 먼저 본 사용자의 후속 표를 받지 않거나 별도 집계해야 한다.

## 3. 현재 서비스에 맞춘 흐름

### 목록 카드 · 투표 전

```text
초반에 하나만 가져갈 수 있다면?
닉 · 방금                                      48표

┌──────────── 이거 ────────────┐  VS  ┌──────────── 저거 ────────────┐
│        기존 게임 요소 렌더       │      │        기존 게임 요소 렌더       │
└──────────────────────────────┘      └──────────────────────────────┘

하나를 고르면 현황이 보여요                   댓글 · 좋아요 · 링크
```

- 목록에서 두 게임 요소 전체를 각각 `<button>`으로 만든다. 모바일에서도 현재의 좌우 비교 구도를 유지하므로 별도 제출 버튼이 없다.
- 현재 카드 전체의 `role="link"`는 제거한다. 제목과 댓글 수만 상세 링크가 되고, 선택 버튼과 링크의 키보드 동작을 분리한다.
- 좌우 모두 같은 면적, 광도, 움직임, 문구 구조를 쓴다. 기본 선택이나 한쪽만 먼저 움직이는 효과는 없다.
- `aria-label`에는 `{게임 요소 이름}을 이거/저거로 선택`을 넣는다.

### 목록 카드 · 투표 직후

```text
이거 62% · 30표  ━━━━━━━━━━━──────  저거 38% · 19표
👍 내 선택
```

- 게임 요소 크기는 그대로 둔다. 결과 때문에 양쪽 카드 폭이 달라지지 않는다.
- 아래의 한 줄 결과 막대만 `spire-blue`와 `spire-pink` 비율로 채운다.
- 선택한 쪽에는 STS2 `thumb_up` emote와 `내 선택`을 함께 표시한다. 색만으로 상태를 전달하지 않는다.
- 숫자는 낙관적으로 즉시 갱신하되 저장 실패 시 원래 상태로 되돌리고 기존 engagement/storage 장애 UI를 재사용한다.
- 결과 막대는 한 번만 짧게 전환하고 `prefers-reduced-motion`에서는 움직이지 않는다.

### 상세 페이지

- 현재 큰 게임 요소 렌더와 백과사전 링크는 유지한다.
- 링크와 투표 버튼을 겹치지 않게 각 요소 아래에 기존 `GameChoiceFrame` 기반의 `이거 선택` / `저거 선택` 버튼을 둔다.
- 모바일의 `왼쪽 요소 → VS → 오른쪽 요소` 세로 구조는 유지한다.
- 투표 후에는 목록과 같은 결과 막대와 내 선택을 헤더 아래에 표시한다. 댓글은 현재 위치를 유지한다.

### 저장 중·이미 투표함

- 첫 탭 즉시 선택 상태를 보여주고 버튼을 잠깐 비활성화한다. 익명 세션 생성과 insert는 뒤에서 진행한다.
- 기존 세션에 표가 있으면 첫 렌더부터 결과와 내 선택을 보여준다.
- v1은 최종 선택이다. 실수 탭이 실제 문제로 확인되기 전에는 확인 모달, 수정, 취소, 투표 이력을 만들지 않는다.

## 4. 게임 우선 시각 정책

새 토큰이나 제목을 만들지 않는다.

| 역할 | 기존 자산/컴포넌트 |
| --- | --- |
| 서비스 제목 | 게임 공식 `이거 아님 저거?` |
| 서비스 토큰 | `/images/sts2/relics/choices_paradox.webp` (`선택의 역설`) |
| 페이지 배경 | `/images/sts2/events/this_or_that.webp` |
| 선택 프레임 | `GameChoiceFrame` + `/images/sts2/ui/event_button.png` |
| 선택 확인 | `/images/sts2/ui/emote/thumb_up.png` |
| 카드/유물 등 | 현재 `CardTile`, `EntityPreview`, `hover_tip.png` 렌더 |

좌우 진영은 고정된 `spire-blue` / `spire-pink`로 구분한다. 기존 의미가 강한 green/red의 버프/너프 조합은 쓰지 않는다. 게임 요소 자체의 gold·캐릭터 색은 그대로 두고, 진영색은 얇은 레일·포커스·결과 막대에만 쓴다.

선택 영역은 최소 44×44보다 크게 유지하고, 키보드 포커스와 선택 문구를 제공한다. 목록에서는 현재 게임 요소 영역 전체가 타깃이라 별도 작은 라디오 버튼을 만들지 않는다.

## 5. 데이터 계약

기존 `this_or_that_posts`가 질문과 좌우 선택지를 이미 갖고 있으므로 generic poll/options 모델을 만들지 않는다. CLI migration 하나로 다음 테이블만 추가한다.

```text
this_or_that_post_votes
- post_id uuid -> this_or_that_posts(id) on delete cascade
- user_id uuid -> auth.users(id) on delete cascade
- choice text check ('left', 'right')
- created_surface text check ('index', 'detail')
- env text
- created_at timestamptz
- unique (post_id, user_id, env)
- index (env, post_id, choice)
```

RLS는 본인 행의 select/insert만 허용하고 v1에는 update/delete 정책을 만들지 않는다. 공개 조회는 raw `user_id` 행이 아니라 `post_id`, `left_count`, `right_count`, `total_count`만 반환하는 bounded 집계 RPC로 제한한다. 목록은 최대 50개 post id만 한 번에 요청하고 Realtime 구독은 추가하지 않는다.

익명 사용자는 기존 `useAuth.ensureUser()`의 `signInAnonymously()`를 그대로 쓴다. 이는 사람 한 명이 아니라 브라우저에 유지되는 익명 Supabase 계정 단위의 중복 방지다. 공개 UI는 `N명` 대신 `N표`로 표현한다.

배포는 DB-first additive로 한다.

1. 기존 앱이 무시할 새 테이블과 RPC migration을 별도 커밋·적용한다.
2. 원격 계약을 확인한다.
3. 새 앱을 배포한다.

새 앱은 구 DB에서 동작하지 않으므로 같은 배포에 migration과 앱 변경을 묶지 않는다.

## 6. Cloudflare Free 비용

- 공개 Next/Worker 요청에 Supabase, Cloudflare Analytics, 집계 subrequest를 추가하지 않는다.
- 브라우저가 Supabase로 bounded count/own-status read와 투표 insert만 보낸다.
- 전체 투표 행 다운로드, Worker SSR 집계, Realtime, KV, Durable Object, Analytics Engine을 추가하지 않는다.
- 따라서 새 Worker CPU와 subrequest 비용은 0이고, 공개 페이지의 현재 static/OpenNext 경계도 바꾸지 않는다.

## 7. dev/admin과 참여 지표

### 지표 이름

정확한 전환율로 부르지 않는다. Cloudflare와 Supabase는 같은 사용자를 연결하지 않고, 목록 한 번 읽는 동안 여러 게시글에 투표할 수 있다.

```text
투표 밀도 = 해당 기간 새 투표 수 / /this-or-that* 비봇 page loads × 100
표시: 읽힘 100회당 18.4표

참여 계정 근사 = 해당 기간 고유 익명 voter UUID / 같은 page loads × 100
표시: 읽힘 100회당 7.2개 익명 계정
```

`Visits`는 고유 사용자가 아니라 외부 referrer/direct로 시작된 page view이므로 기본 분모로 쓰지 않는다. Cloudflare Web Analytics는 custom event도 지원하지 않으므로 카드 노출 대비 정확한 funnel은 기존 도구만으로 만들 수 없다.

### 비교 화면

같은 기간·같은 `/this-or-that*` 경로에 대해 다음 행동을 합치지 말고 나란히 둔다.

- 투표: 새 표, 고유 익명 voter UUID, index/detail 최초 투표 비중
- 좋아요: 고유 좋아요 계정 / 읽힘 100회
- 댓글: 고유 댓글 작성 계정 / 읽힘 100회
- 작성: 새 이거저거 / 읽힘 100회

기본은 최근 완료된 7일과 직전 7일을 비교하고, 최근 28일의 일별 중앙값과 25~75% 구간을 평시 기준으로 함께 본다. 패치 공개일은 표시하거나 별도로 제외한다. 사이트 전체 방문량이나 어제 하루의 패치 spike를 분모로 쓰지 않는다.

### 자격 증명 경계

현재 `/dev/admin`은 환경 플래그만 있고 사용자 인증이 없으므로 Cloudflare API token이나 Supabase service-role key를 넣지 않는다.

- `/dev/admin`: 공개 집계 RPC로 총 표와 게시글별 좌우 결과만 표시할 수 있다.
- Cloudflare 대비 보고서: 기존 `cf:metrics`와 같은 운영자 전용 CLI가 Web Analytics GraphQL과 공개 Supabase 집계를 읽어 터미널에 출력한다.
- CLI 결과를 나중에 admin에서 꼭 봐야 할 때만 비밀이 없는 정적 snapshot 주입을 추가한다.

현재 admin의 `좋아요` 타일은 `likes`의 8종 반응을 모두 세면서 `reaction_type`을 읽지 않으므로 이거저거 참여 기준선으로 재사용하지 않는다.

## 8. 남용과 프라이버시

v1의 방어선은 익명 세션 + RLS + `(post_id, user_id, env)` unique 제약이다. 브라우저 저장소를 지우거나 새 브라우저를 쓰면 다시 투표할 수 있으므로 여론조사나 1인 1표라고 주장하지 않는다.

raw IP 저장, 브라우저 fingerprint, 매 투표 CAPTCHA는 추가하지 않는다. 실제 자동화가 확인되면 요청 속도·신규 익명 계정 비율을 보고 그때 짧은 rate limit과 Managed Turnstile을 단계적으로 검토한다.

## 9. 구현 완료 조건

- 목록과 상세에서 로그인 UI·확인창 없이 한 번 탭해 투표된다.
- 투표 전에는 총 표 수만, 투표 후에는 좌우 비율·표 수·내 선택이 보인다.
- 양쪽의 사전 면적·강조·애니메이션이 대칭이다.
- 같은 익명 계정은 게시글당 한 표만 insert할 수 있다.
- raw voter UUID는 공개 집계 응답이나 admin 표에 포함되지 않는다.
- 모바일 320px에서 선택 타깃, 결과 숫자, 댓글·좋아요 컨트롤이 겹치지 않는다.
- 키보드만으로 두 선택지를 구분해 투표할 수 있고 포커스가 보인다.
- Supabase 실패 시 읽을 수 있는 게시글까지 숨기지 않는다.
- Worker 요청 경로에는 새 fetch나 집계가 없다.

## 10. 명시적으로 미루는 것

- `현황만 보기` / 관전 모드
- 투표 수정·취소·이력
- 마감 시간, 승자 선언, 알림
- 이상형 월드컵 대진·시드·랭킹
- 포인트, 배당, 보상, 공개 진영 배지
- 정확한 카드 impression tracking과 A/B 실험 인프라
- Turnstile, IP 저장, fingerprint
- 프로필의 투표 활동 내역

## 11. 출처

- [Social influence bias: a randomized experiment (Science, 2013)](https://pubmed.ncbi.nlm.nih.gov/23929980/)
- [Can biased polls distort electoral results? Evidence from the lab (2023)](https://eprints.soton.ac.uk/476142/2/1_s2.0_S0176268023000277_main.pdf)
- [X Polls — how to vote](https://help.x.com/en/using-x/x-polls)
- [Twitch Polls and Channel Points Predictions](https://blog.twitch.tv/en/2021/05/24/polls-and-channel-points-predictions-have-leveled-up-with-twitch-api-and-eventsub-support/)
- [WCAG 2.2 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)
- [Cloudflare Web Analytics high-level metrics](https://developers.cloudflare.com/web-analytics/data-metrics/high-level-metrics/)
- [Cloudflare Web Analytics FAQ](https://developers.cloudflare.com/web-analytics/faq/)
- [OWASP Bot Management and Anti-Automation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Bot_Management_and_Anti-Automation_Cheat_Sheet.html)
