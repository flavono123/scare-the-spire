# 2단계 설계: D1 스키마(그림자 사본)

관련 문서:

- [Supabase 탈출 계획](../SUPABASE_EXIT_PLAN.md) 5.5절 이식, 5.6절 환경 분리, 7절 단계
- [1단계 설계](STEP1_DESIGN.md): 같은 출처 `/api` Worker. 2단계는 이 Worker가 D1을 그림자로 읽는다.
- [이관 전 정리 조사](CLEANUP_AUDIT.md) 2절, 3.1절, 5절: 옮기지 않는 객체
- 전체 DDL: [d1/migrations/](../../d1/migrations/)의 `0003_*.sql`~`0006_*.sql`. 원본은
  [d1-schema/schema.src.sql](d1-schema/schema.src.sql)이고 `gen_schema.py`가 마이그레이션 파일을 만든다(9절). 이 문서는
  발췌만 싣는다.
- 조사·설계 작업 노트(영어): [d1-schema/notes/](d1-schema/notes/). 이 문서와 다르면 이 문서를 따른다.

## 상태

- 2026-11-08 초안. 영역별 조사 셋(참여, 장난감 상자, 런·프로필)과 설계안 셋을 하나로 합쳤다. 설계안끼리 다른
  곳은 "설계안 사이의 차이"에 고른 쪽과 이유를 적었다.
- 2026-11-08 검토 반영. 세 갈래 검토(충실도, 이관, 비용)에서 확인된 것을 모두 고쳤다. 무엇을 왜 고쳤는지는 끝의
  "검토 기록", 고치지 않고 남긴 것은 "검토에서 남긴 것"에 있다.
- 2026-11-08 사용자 선호 반영. `posts` 키를 `(service, id)`로 바꾸고, 이거 아님 저거? 좋아요를 자기 표로
  되돌렸다. 무엇을 뺐는지는 "검토 기록" 끝에 있다.
- 2026-11-08 로컬 확인(`sqlite3` 3.51.0, 빈 파일, `PRAGMA foreign_keys=ON`):
  - `0001`·`0002` 뒤에 DDL 초안(지금의 `0003`~`0006`)이 그대로 올라간다. 표 42개(새 표 39개), 이름 있는 색인 25개,
    트리거 0개.
  - 표마다 대표 행과 대량 행(글 807, 댓글 1,504, 좋아요 353, 이거 아님 저거? 좋아요 401, 이야기 302, 퍼즐상자
    런 602 등)을 넣었다. FK 자식과 지우기 연쇄 다섯 가지(월드컵, 코오오옴보, 런, 이거 아님 저거?, 댓글)가 기대대로
    지워지고 남는다. 이거 아님 저거? 글을 지우면 투표와 좋아요가 FK 연쇄로 지워진다. 같은 id를 가진 두 서비스의
    글이 두 행으로 따로 있고, 하나를 지워도 다른 하나는 그대로인지도 본다.
  - CHECK·FK 검사 30개: 막아야 할 값 23개는 막고, Supabase가 받는 값 7개는 받는다.
  - 쿼리 128개를 `EXPLAIN QUERY PLAN`으로 두 번(통계 없이, `ANALYZE` 뒤) 확인했다. 모두 의도한 색인을 쓴다.
    `service` 앞부분만 쓰는 기본키 검색(그 서비스 행을 다 읽는다)도 훑기로 본다(9절). 색인을 다 쓰지 않는 10개는
    일부러 그렇다(9절). 결과는 `plans.txt`.
- D1의 SQLite 판에서 같은 계획이 나오는지는 아직 보지 않았다. `check.py`는 이 컴퓨터의 `sqlite3`(3.51.0)만 보므로
  그대로 다시 돌려서는 알 수 없다. `0003`을 올리기 전에 로컬 D1(`wrangler d1 execute --local`)에서 `select
  sqlite_version()`을 먼저 본다. 판이 다르면 작은 실행기를 더한다: 로컬 D1에 `0001`~`0006`과
  `fixtures.sql`을 올리고, `queries.sql`의 문장마다 매개변수를 값으로 바꿔 앞에 `EXPLAIN QUERY PLAN`을 붙인 파일을
  `wrangler d1 execute --local --file --json`으로 돌려, 그 `detail` 줄을 `check.py`의 `judge()`에 넣는다(`ANALYZE`
  뒤에 한 번 더).
- 2026-11-08 두 번째 검토 반영. 다른 env 글에 단 이거 아님 저거? 좋아요, 좋아요 취소의 outbox 행, outbox 막기
  기준 `(table_name, match_key)`, 자기 쓰기 적용 실패, `threads`에 넣지 않은 좋아요 수, `check.py`의 `service`
  앞부분 검사, 글자와 번호 오류를 고쳤다. "검토 기록" 끝.
- 2026-11-08 사용자 결정 반영(10.1~10.9절). 모든 기능을 오늘 동작 그대로 옮긴다. Supabase 전제 조건 마이그레이션은
  `runs` 요약 열 하나만 남았다. 손으로 만든 요청만 만들 수 있는 값은 운영에서 고치지 않고 동기화 거절로 사람에게
  넘긴다(3.1절). 열린 질문은 없다. 첫 복사 검사, 채우기 dry-run, 1분 동기화가 기대와 다른 수나 손으로 만든 값을
  내면 그때 묻는다(카운터 어긋남과 JSON 크기는 보고만 한다, 10절 끝).
- 2026-11-08 세 번째 검토 반영. 목록의 표지 편집, 채우기 뒤의 `summary_version` 0 런, 손으로 만든 값의 거절을
  끝내는 길, 배지와 파티 캐릭터의 일일 비교, 상세의 표지, 문의 트리거 시점, 결정 번호(10.1~10.9절)를 고쳤다.
  검토가 사용자 확인으로 남긴 둘(배지 규칙, 문의 트리거 시점)은 그대로 옮기기 원칙으로 정했다(4.4절, 5.5절).
- 2026-11-08 사용자 결정: 런 요약은 D1에서만 만든다. Supabase `runs`는 바꾸지 않는다(10.2절). 위 기록의 "`runs` 요약
  열 마이그레이션"과 "채우기 dry-run"은 없어졌다. 2단계에 운영 Supabase에 올리는 마이그레이션은 변경 로그 하나다(5.1절).
- 2026-11-08 마이그레이션 `0003`~`0006`을 만들어 로컬 D1(wrangler 4.156.0, workerd 1.20261023.1)에 올렸다. 표 42개, 이름
  있는 색인 25개, 트리거 0개. D1의 SQLite는 3.53.4다(D1이 `sqlite_version()`을 막아 workerd 바이너리에서 읽었다). D1이
  50바이트 넘는 GLOB 패턴과 TEMP 표를 거절해 uuid·시각 CHECK를 같은 값만 받는 짧은 GLOB으로 나눠 쓰고(3.3절)
  `fixtures.sql`을 고쳤다. 고정 행은 `check.py`와 같은 행 수로 들어간다. `check-local-d1.py`: 쿼리 128개, 두 번 모두 규칙
  실패 0. 19개는 계획 글자만 다르고 같은 색인을 쓴다(IN 목록의 Bloom 필터 줄이 없고 EXISTS가 `SEARCH ... EXISTS`로 나온다).

## 1. 결정과 적용

사용자가 정한 여섯 가지와, 스키마에 어떻게 들어갔는지다.

1. **env 열이 없다.** 환경마다 D1이 따로다: `slseoun-prod`(Supabase `env='production'` 행),
   `slseoun-testbed`(`env='development'` 행), 로컬 `wrangler dev` D1. 어느 표에도 `env`가 없고, 어느 색인도 env로
   시작하지 않는다. 동기화와 5단계 미러는 Worker의 `API_DATA_ENV`로 env를 붙인다. 오늘 답에 `env`가 있는 곳은
   D1 어댑터가 같은 값을 넣는다. Supabase에 env가 없는 표 둘의 처리는 4.5절과 5.5절.
2. **글은 `posts` 하나에, 서비스별 열은 `post_<서비스>` 표에.** `posts`에는 모든 글이 가진 것(id, 서비스, 작성자,
   작성자 모습, 제목, 조각모음 제목, 수, 시각)이 있다. 서비스마다 1:1 표가 타입 있는 열을 갖고, `posts`를
   `(service, id)` FK로 가리키며 `ON DELETE CASCADE`다. 원소로 거르거나 조인하는 배열은 자식 표다: 코오오옴보 `resources`
   (`post_combo_resources`), 월드컵 `pool`(`post_favorite_tournament_pool`). 보여 주기만 하는 배열과 문서
   (본문 `content`, 티어표, 변형의 추가 변형안 등)는 JSON TEXT다. 역사 강의서 런도 `posts` 행이다(`service =
   'history_course'`). 이유는 2.1절. `posts`의 기본키는 `(service, id)`다(3.4절).
3. **`threads` 표가 수를 센다.** 스레드 키마다 좋아요 수, 댓글 수, 마지막 댓글 시각을 둔다. 표마다 있던 카운터
   트리거와 매번 전체를 훑던 `get_engagement_counts`를 대신한다. 수로 정렬하는 피드(장난감 상자 추천순·댓글순,
   조각모음, 역사 강의서 거르기)가 있으므로 `posts`도 `like_count`, `comment_count`를 계속 가진다. `threads`로
   조인해 정렬하면 쪽마다 그 서비스의 글 전체와 `threads` 행을 읽는다. `posts` 열이면 색인 하나로 20행만 읽는다.
   2~4단계에는 Supabase 값을 복사한다. 5단계부터 이 열은 같은 batch에서 `threads` 값을 그대로 복사한다(E13c).
   5단계에 이거 아님 저거? 글의 `like_count`만 `this_or_that_post_likes` 행에서 센다. Supabase
   `this_or_that_posts.like_count`와 원본이 같다(2.2절). 이 좋아요 수는 `threads`에 넣지 않는다. 오늘 참여 수
   답과 같다(10.9절).
4. **런 파일 원문은 자기 표에 둔다.** `post_history_course_file(post_id, raw)`. 크기(최대 277 KB)가 D1 한 행
   한도 2 MB 안이라 R2는 쓰지 않는다. 목록은 원문을 읽지 않는다. 목록이 원문에서 얻던 것은 요약 열이 대신한다.
   요약은 D1에서만 만든다(4.4절의 열 목록, 10.2절). 이미 올라간 런은 첫 복사가, 2~4단계에 새로 올라온 런은 요약
   채우기 작업(GitHub Actions)이 원문에서 계산해 넣는다. 아직 요약이 없는 런은 목록이 그 런만 원문을 받아 오늘처럼
   계산한다. Supabase `runs`는 바꾸지 않는다. 자동 표지는 오늘처럼 목록에서 브라우저가 고른다. 원문 대신 요약 열에서
   고른다. 저장된 `cover_spec`은 바꾸지 않는다.
5. **작성자 모습은 그 행에 굳힌다.** 글과 댓글을 쓸 때의 `nickname`, `avatar_id`, `avatar_kind`, `palette_id`,
   `palette_swapped`를 보통 열로 둔다(JSON 아님). 이름, 널 허용, CHECK가 Supabase와 같다. 수정할 수 있는 네
   서비스는 수정 때 다시 쓴다(오늘과 같다). 역사 강의서의 기증자 닉네임은 굳히지 않는다(기증자가 닉네임을 바꾸면
   다시 쓴다, 오늘과 같다).
6. **색인은 실제 쿼리에서 끌어냈다.** Postgres 색인 114개를 옮기지 않았다. 쿼리마다 색인을 정하고 계획으로
   확인했다(표별 설계와 `queries.sql`). 이름 있는 색인은 25개다.

## 2. 설계안 사이의 차이

세 설계안이 다르게 정한 곳과 고른 쪽이다.

### 2.1 런을 `posts`에 넣는다

- 장난감 상자안은 `runs`를 따로 두고 조각모음에서 두 결과를 Worker가 합쳤다. 참여안도 런을 따로 보고 카운터를
  `runs`에 썼다. 런·프로필안은 런을 `posts` 행으로 넣었다.
- `posts`에 넣는다. 런은 이미 어디서나 글처럼 다뤄진다: API 서비스 id `history_course`, 조각모음, 네비 점,
  프로필 활동, `like_count`·`comment_count`, 스레드 키 `history-course:<id>`. 한 표에 있으면 조각모음은 색인
  하나를 훑고(합치기 코드가 없다), 네비 최신과 프로필도 같은 색인을 쓰고, 5단계 카운터 복사도 한 표에만 한다.
- 대가: `posts.id` CHECK가 서비스에 따라 다르다(uuid, 또는 런 id 1024 바이트 이하. Postgres와 같다). 닉네임 CHECK도 런만
  `btrim` 기준이다(Postgres `runs_donor_nickname_len`과 같다). 런 행의 작성자 토큰 열은 NULL이다.
- 키는 `(service, id)`다. Supabase에서는 글 표마다(그리고 `runs`가) 기본키가 따로라 같은 id가 두 표에 있을 수
  있다. 키에 서비스를 넣으면 그런 두 행이 D1에서도 두 행이라 해가 없다(3.4절).

### 2.2 이거 아님 저거? 좋아요는 자기 표에 둔다

- 참여안은 `this_or_that_post_likes`를 따로 두었다(오늘 Postgres처럼). 장난감 상자안은 공통 `likes`에
  `this-or-that:<글 id>` 키로 합쳤다. 첫 검토까지는 합쳤다.
- 따로 둔다(사용자 선호, 검토 기록 끝). 표는 타입 있는 열(`service`, `post_id`, `user_id`, `created_at`)과 기본키
  `(service, post_id, user_id)`를 갖는다. Supabase UNIQUE `(post_id, user_id, env)`에서 env를 빼고 서비스를 앞에
  둔 것이다. 글을 FK로 가리키고 `ON DELETE CASCADE`다. Postgres FK와 같다. 없는 글에 좋아요하면
  FK 오류이고(오늘 23503처럼 Worker가 `not_found`로 바꾼다), 글을 지우면 좋아요도 연쇄로 지워진다. 이것을
  흉내 내는 Worker 문장이 필요 없다.
- Postgres FK `this_or_that_post_likes_post_id_fkey`는 env를 보지 않고, INSERT 정책도 `auth.uid() = user_id`만
  본다. 투표 정책처럼 글과 env가 같은지 보는 곳이 없어 다른 env 글에 단 좋아요가 Supabase에 들어갈 수 있다
  (tasks/010 #70). env마다 따로인 D1에서는 그 행의 부모가 없어 FK가 거절한다.
- Supabase에서도 이 좋아요는 어디에도 보이지 않는다. 수 트리거, 수 뷰, 프로필 RPC가 모두 env로 글과 맞춘다. 그래서
  운영은 바꾸지 않는다. 매퍼는 이 행을 알려진 종류 `cross_env`로 세고 넣지 않으며, 거절을 저절로 닫는다(5.3절).
  일일 대조는 부모 글과 env가 같은 행만 비교한다(5.4절). 화면은 오늘과 같다(10.6절).
- 수는 같은 재계산 규칙(2.3절)을 따른다. 5단계에는 좋아요 batch에서 이 표의 행을 세어 `posts.like_count`에
  쓴다(E13c). 2~4단계에는 Supabase `this_or_that_posts.like_count`를 복사한다. 수 읽기(T15), 내 좋아요(T16),
  프로필 활동(P2, P3)은 오늘의 뷰와 RPC처럼 이 표를 읽는다.
- `threads`의 `this-or-that:<id>` 행은 오늘 `get_engagement_counts`처럼 `likes` 행과 댓글만 센다. 그래서 참여
  지도가 오늘과 같고, 대조에서 뺄 키가 없다. 이 값을 읽는 화면은 없다(10.9절).
- Supabase `likes`에 `this-or-that:` 키 행이 있으면 보통 스레드 키의 좋아요로 복사한다. 오늘과 같다.

### 2.3 파생 값은 원본 행에서 다시 센다

- 5단계의 카운터 갱신을 참여안은 "원본 행에서 다시 세어 덮어쓰기", 장난감 상자안은 "조건부 +1/-1",
  런·프로필안은 "+d"로 했다.
- 다시 센다. 동기화 재적용과 재시도에 몇 번 돌아도 같고, 어긋남이 쌓이지 않는다. 한 스레드의 행은 몇 개라 읽기도
  싸다. 같은 규칙을 이거 아님 저거? 투표 수(그 글의 투표 행)와 월드컵 `play_count`(그 대회의 플레이 행)에도
  쓴다. 후보 통계만 더하기다. 다시 세면 그 대회의 모든 플레이 `matches`를 다시 읽어야 한다. 더하기는 한
  batch(한 트랜잭션) 안이라 잃지 않는다.
- 2~4단계에는 Supabase 수를 그대로 복사한다(10.1절). Supabase 수의 어긋남(tasks/010 #68)은 전환 때 한꺼번에
  고쳐지지 않는다. 5단계에 그 글·런의 좋아요나 댓글이 바뀌면(다시 올린 런은 R14가 `threads`에서 수를 가져올 때)
  행 수로 맞춰진다. 그 뒤 활동이 없는 글에는 복사한 수가 남는다.

### 2.4 그 밖

| 주제 | 설계안들 | 고른 것과 이유 |
|---|---|---|
| `STRICT` | 참여·런안 아니오, 장난감 상자안 예 | 새 표는 모두 `STRICT`. JS에서 잘못 묶은 값(정수 열에 글자)을 바로 거절한다. 정수 값인 REAL은 정수로 바뀐다(확인함). 기존 `0001`·`0002`는 그대로 둔다 |
| `posts_keys_immutable` 트리거 | 장난감 상자안만 | 두지 않는다. service role은 Supabase에서 `created_at`을 바꿀 수 있다. D1이 그 변경을 거절하면 동기화가 멈춘다(CHECK 원칙, 3.1절). Worker의 UPDATE는 이 열을 쓰지 않는다. `service`는 키의 일부라 바뀌지 않는다 |
| JSON 텍스트 | 참여안 압축 JSON, 나머지 Postgres 텍스트 그대로 | 압축 JSON(`JSON.stringify(JSON.parse(x))`). 출처(덤프, PostgREST, Worker)와 상관없이 한 꼴이다. 비교는 어차피 값으로 한다 |
| uuid CHECK | 소문자 GLOB / `length = 36` | 소문자 GLOB 하나 |
| 시각 GLOB | 숫자 자리 / 범위 자리(`[0-1][0-9]`) | 숫자 자리 하나(3.3절) |
| JSON 크기 상한 | 런안 16 KB(표지) 등 | Postgres가 받는 값은 D1도 받아야 한다. 압축 크기는 SQLite가 잴 수 없으므로 1 MiB 텍스트 상한만 둔다. 16 KB 같은 상한은 Worker 규칙이다 |
| `posts` 기본키 | `id` 하나 | `(service, id)`. Supabase는 글 표마다 기본키가 따로다(3.4절) |
| 런 id CHECK | 런안 `isRunId` 패턴, 초안 1~1024 바이트 | Postgres 범위(1024 바이트 이하)만. 키에 서비스가 있어 런 id가 uuid 꼴이어도 다른 글과 겹치지 않는다. 꼴은 Worker `isRunId`가 본다 |
| `posts.service` CHECK | 서비스 여덟 개 목록 | 꼴만 본다(소문자와 `_`, 1~32자). 목록은 Worker와 매퍼가 갖는다. 부모 표의 목록은 바꾸려면 다시 만들어야 하고, 다시 만들면 자식이 지워진다(3.7절) |
| 런 표 이름 | `runs`, `run_files` | `post_history_course`, `post_history_course_file`, 키 열 `post_id`(이름 규칙, 3.5절) |
| 런 제목 | 런안 `posts.title = seed` | `posts.summary`(조각모음 제목)에 넣고 `title`은 NULL. `title`은 서비스 자체 제목만 |
| outbox 열 | `match`, `row` | `match_key`, `payload`(SQL 예약어를 피함). `op`에 `update`(PATCH)와 `rpc`(월드컵 플레이) 추가 |
| 변경 로그의 런 원문 | 참여안은 옛 행에서만 뺌 | 새 행과 옛 행 모두에서 빼고 `heavy_changed` 표시. 원문은 동기화가 따로 받는다(5.3절 9번) |
| 네비 최신 | `surface_latest` 표 / 색인 조회 | 표를 두지 않는다. 색인 조회 9번(8 서비스 + 주간)이고, 스냅샷은 이미 `api_cache`에 있다(참여안) |
| 프로필의 이거 아님 저거? 좋아요 수 | 런안 `posts.like_count` | `this_or_that_post_likes` 행 수. 오늘 RPC도 이 표의 행을 센다 |
| 월드컵 후보 통계(5단계) | Supabase RPC가 다시 계산 | D1이 계산한 행을 상태로 upsert한다(5.5절). 두 곳에서 계산하면 시각과 동률 순서가 달라 일일 대조가 맞지 않는다 |

검증에서 고친 것도 있다: 퍼즐상자 내 순위(X4)는 보드 목록이 기본키를 바로 찾게 바꿨고, 리더보드(X2)는 보드
목록이 바깥 반복이 되게 했다(`CROSS JOIN`). `puzzlebox_best(run_id)` 색인을 더했다. 이것이 없으면 런을 넣을
때마다 SQLite가 `puzzlebox_best`를 훑는 FK 검사를 계획한다(지연 FK 위반이 있을 때만 돌지만, 동기화는 batch마다
FK를 미룬다). outbox 읽기는 `seq` 범위로 바꿨다. 런 올리기의 요약 행(R14b)도 `CROSS JOIN`으로 JSON 배열을 바깥에
고정했다. 그러지 않으면 SQLite가 기증자의 글 전체를 먼저 훑는다. 키를 `(service, id)`로 바꾼 뒤에도 고쳤다. 서비스
표의 `service` 열은 모든 행이 같은 값이라, 통계로 보면 이 열로는 하나도 거르지 못한다. 그래서 `ANALYZE` 뒤
SQLite가 작은 서비스 표를 먼저 다 읽고 정렬하는 계획을 골랐다. 피드의 서비스 표 조인은 `CROSS JOIN`으로 `posts`를 바깥 반복에 고정했다(T1~T3, T7,
T8, T11, R1. 런 고르기 R2는 런 표를 바깥에 고정한다). `posts_user`는 `(user_id, service, created_at, id)`로 넓혔다. 기증자
닉네임 맞추기(R12)는 키를 이 색인에서 먼저 얻는다. 통계가 없으면 UPDATE가 기본키의 `service` 앞부분을 고르기
때문이다.

## 3. 공통 규칙

### 3.1 CHECK 원칙

D1 CHECK는 Supabase가 받는 행을 모두 받아야 한다. 아니면 첫 복사나 1분 동기화가 Supabase에 이미 있는 행을
거절하고, 2~4단계 동안 두 저장소가 갈라진다. 거절은 `sync_rejects`에 열린 채 남고, 열린 거절은 단계 문턱을
막는다. 손으로 만든 요청만 만들 수 있는 값은 예외다(아래 "손으로 만든 값의 규칙"). 그래서:

- D1 CHECK는 Postgres의 범위(길이, 목록, 크기)를 그대로 옮긴다.
- 1단계 Worker가 이미 하는 더 엄격한 규칙(정규식, trim, 작은 JSON 상한)은 Worker 검증으로 남긴다.
- `pg_column_size`(압축 크기) CHECK는 1 MiB 텍스트 상한으로 바꾸고, 첫 복사 스크립트가 열마다 실제 최댓값을
  보고한다.
- Postgres에 없는 CHECK는 Supabase가 그런 값을 만들 길이 없을 때만 둔다: 철학자 `week_start` 월요일(관리자
  스크립트만 쓴다, 덤프 28행 모두 월요일), 퍼즐상자 플레이어 토큰 패턴(RPC가 정규화해서만 쓴다). Supabase에는
  달지 않는다.
- 런 원문 1.9 MB와 런 요약 열의 CHECK는 D1에만 있다. Supabase `runs`는 바꾸지 않는다(10.2절). 실제 원문은 최대
  277 KB라, 1.9 MB를 넘는 원문은 손으로 만든 요청에서만 나오고 동기화 거절이 된다.

**클라이언트가 쓸 수 있는 열.** Supabase의 몇몇 열은 클라이언트가 직접(anon 키와 RLS) 또는 1단계 Worker의
파싱 없는 통과 경로로 쓸 수 있고, 보호 트리거가 없다. 앱은 여기에 D1이 받는 값만 쓴다. 손으로 만든 요청만
D1이 받지 못하는 값(NULL, `'infinity'`, 10000년, 기원전, 꼴이 다른 JSON)을 넣을 수 있다.

**손으로 만든 값의 규칙(10.6절).** 이런 값은 운영에서 고치지 않고, 막는 Supabase 마이그레이션도 두지 않는다.

- 1분 동기화는 그 행을 `sync_rejects`에 열어 두고 이유를 분명히 적는다(`bad_timestamp`, `bad_element`, `check`).
  매퍼는 값을 몰래 바꾸지 않는다: 다른 시각으로 채우거나, 원소를 버리거나, 열을 빼고 넣지 않는다.
- 첫 복사는 이런 행을 표마다 세어 보고한다(5.2절). 기대 0이다(첫 복사가 센다). 잰 것은 `runs`의 NULL
  `created_at`(2026-11-05 덤프 0행)과 다른 env 글의 이거 아님 저거? 좋아요(2026-11-05 백업 0행)뿐이다.
- 첫 복사든 1분 동기화든 이런 행이 나오면 그때 사용자에게 묻는다(그 행을 고칠지, 알려진 종류로 셀지). 그 행은
  Supabase에만 있으므로 거절을 닫기만 해서는 일일 대조의 행 차이, `derived` 차이, 그림자 차이가 남는다. 사용자가
  정하고 그 일을 마칠 때까지 일일 대조, 그림자 대조, 단계 문턱은 실패로 남는다(5.4절, 6절 9번).
- 다른 env 글에 단 이거 아님 저거? 좋아요만 예외다. Supabase에서도 보이지 않으므로 알려진 종류 `cross_env`로
  세고 넣지 않으며 거절을 저절로 닫는다(2.2절).
- 4단계에 브라우저의 직접 쓰기가 닫히고 Worker가 모든 쓰기를 검증한다. 그 뒤로는 이런 값이 생기지 않는다.

| Supabase 열 | 오늘 쓸 수 있는 길 | D1이 받지 못하는 값이 오면 | D1 |
|---|---|---|---|
| `likes`, `comment_likes`, `this_or_that_post_likes`, `this_or_that_post_votes`의 `created_at` | 보호 트리거 없음, 널 허용(`likes`, `comment_likes`) | `bad_timestamp` 거절 | `NOT NULL` + 시각 GLOB 그대로 |
| `pagestorm_drafts`, `defragment_bodies`의 `created_at`, `updated_at` | `/api/write/pagestorm-drafts`, 본문 쓰기 | `bad_timestamp` 거절 | 그대로 |
| `contact_inquiries.reply_seen_at` | `GRANT UPDATE(reply_seen_at)`, RLS 내 행 | `bad_timestamp` 거절 | 그대로 |
| `likes.story_id`, `comments.story_id` | Postgres는 `octet_length <= 1024`만 봄(`''` 받음) | 생기지 않음 | 아래 한계를 없앴다: `<= 1024`만(`threads.thread_key`도) |
| `combo_posts.resources`, `favorite_tournament_posts.pool` 원소 | jsonb 배열이면 무엇이든 | 원소가 문자열 `type`, `id`를 가진 객체가 아니면 그 글을 `bad_element` 거절 | 자식 표 `NOT NULL` 그대로 |
| `this_or_that_post_likes.env`(부모 글과 env가 다를 수 있음) | INSERT 정책은 `auth.uid() = user_id`만, FK는 env를 보지 않음. 1단계 Worker `handleLike`와 클라이언트 대체 경로가 글 확인 없이 `env`를 붙여 넣음 | `cross_env`로 세고 넣지 않음, 거절은 저절로 닫힘 | FK `(service, post_id)` 그대로 |

**자라기만 하는 스키마와 CHECK.** 7단계 전에는 스키마가 자라기만 한다. 이 말은 "새 스키마가 옛 스키마를 모두
품는다"는 뜻이다. SQLite는 CHECK를 표를 다시 만들지 않고는 바꿀 수 없으므로:

- 부모 표(`posts` 등, 3.7절)에는 목록 같은 CHECK를 두지 않는다. `posts.service`는 꼴만 보고, 제목 CHECK는 아는
  서비스에만 규칙을 두고 나머지는 느슨하다(`title IS NULL OR length(title) BETWEEN 1 AND 80`). 새 장난감 상자
  서비스는 `post_<서비스>` 표 하나를 더하는 것으로 끝난다.
- Postgres에서 옮긴 목록 CHECK는 잎 표에만 남는다: `post_transfigure`(자원 종류, 카드 종류·희귀도·색, 토큰),
  `contact_inquiries`(`game_locale` 등). 잎 표의 CHECK를 넓히는 것은 허용한다: 새 표를 만들고, 복사하고, 옛 표를
  지우고, 이름을 바꾼다. 이 D1 재작성은 같은 Supabase 넓히기보다 먼저 올린다. 커밋 6319cce0(변형 카드 종류
  넓히기)과 같은 "먼저 넓히기" 순서다. 거꾸로 하면 넓어진 Supabase 행이 D1에서 거절돼 문턱이 막힌다.

### 3.2 타입

| Postgres | D1 | 비고 |
|---|---|---|
| `timestamptz` | TEXT `YYYY-MM-DDTHH:MM:SS.ffffffZ` | 3.3절 |
| `date` | TEXT `YYYY-MM-DD` | `week_start`. 월요일 CHECK 포함 |
| `uuid` | TEXT 소문자, 하이픈, 36자 | GLOB CHECK(D1 한도 때문에 짧은 GLOB 셋, 3.3절). Supabase id를 그대로 쓴다 |
| `boolean` | INTEGER 0/1 | Postgres가 널을 허용하면 D1도 허용한다 |
| `jsonb` | TEXT + `json_valid()` | 압축 JSON |
| 배열 | 원소로 거르거나 조인하면 자식 표, 아니면 JSON 배열 TEXT | 결정 2 |
| 정수 | INTEGER | 퍼즐상자 런 id는 2~4단계 Supabase 값, 5단계부터 [2^40, 2^53) 난수 |

- 사용자 id 열에는 FK가 없다. D1에는 `auth.users`가 없고, 앱은 사용자를 지우지 않는다(`ON DELETE CASCADE`가
  한 번도 돌지 않았다). 나중에 FK를 더하려면 표를 다시 만들어야 하므로, 4단계에 `users` 표가 생겨도 FK가 아니라
  Worker가 참조한다.
- 장부 시각(리스, 시도, 동기화 실행)은 D1을 떠나지 않고 Supabase와 비교하지 않는다. `api_cache`처럼 Unix 밀리초
  INTEGER다. 기존 `runtime_flags.updated_at`은 그대로 `toISOString()` 텍스트다.

### 3.3 시각

- **저장 꼴은 하나다.** `YYYY-MM-DDTHH:MM:SS.ffffffZ`. UTC, 소수 6자리, `Z`, 27자. 모든 데이터 시각 열에 같은 GLOB
  CHECK가 있다. 다른 꼴은 들어갈 수 없다(검사 확인).
  - D1은 50바이트가 넘는 GLOB·LIKE 패턴을 거절한다(`LIKE or GLOB pattern too complex`). 그래서 한 패턴(시각 107바이트,
    uuid 260바이트) 대신 같은 값만 받는 짧은 GLOB을 AND로 묶는다. 시각은 1~10번째, 11~19번째, 20번째부터 끝 글자를
    따로 보고, uuid는 `????????-????-????-????-????????????` 꼴, `[0-9a-f-]` 글자만, 하이픈 넷을 본다. `gen_schema.py`가
    펴고 50바이트를 넘는 패턴을 막는다. 옛 한 패턴과 받는 값이 같다(4만 2천여 경우에서 차이 0, NULL 포함).
- 왜 이 꼴인가:
  - Postgres `timestamptz`는 마이크로초까지 있다. 6자리면 잃는 것이 없어 PostgREST 문자열로 정확히 되돌릴 수 있다.
  - 길이가 고정이라 SQLite BINARY 글자 순서가 시간 순서다. 그래서 `ORDER BY created_at`, `(created_at, id)` 키셋,
    색인이 모두 글자 그대로 맞다. 길이가 다른 꼴은 `...:12Z`가 `...:12.5Z` 뒤로 간다.
- **PostgREST와의 관계.** PostgREST는 `2026-11-05T11:48:12.3456+00:00`처럼 준다(끝의 0을 지우고, 정초에는
  소수가 없고, `+00:00`). import 없는 `src/lib/d1-time.ts`에 함수 셋을 둔다. Worker, 변환 스크립트, 동기화,
  일일 대조가 같이 쓴다.

  | 함수 | 하는 일 |
  |---|---|
  | `canonicalTs(text)` | Worker가 오늘 받는 꼴(`T`나 공백, 소수 0~6자리, `Z`·`+00`·`+00:00`·다른 오프셋)과 pg_dump 꼴을 저장 꼴로. 소수를 6자리로 채우고 오프셋은 초 단위 정수 계산으로 옮긴다. `Date`를 거치지 않는다(마이크로초를 잃는다). 0001~9999년 밖, `infinity`, 꼴이 틀리면 `null`. 엄격하게 둔다: `null`은 거절이다 |
  | `postgrestTs(canonical)` | 저장 꼴을 PostgREST 문자열로. 끝의 0을 지우고, 다 지워지면 `.`도 지우고, `Z`를 `+00:00`로 |
  | `nowTs()` | `new Date().toISOString()`의 `Z` 앞에 `000`을 넣는다 |

- D1 어댑터는 시각을 `postgrestTs`로 내보낸다. 그래서 3단계 답의 시각은 오늘과 바이트가 같다.
- 클라이언트가 보내는 커서는 `canonicalTs`를 거쳐 묶는다(틀리면 400). 그 뒤 비교는 글자 비교
  `(created_at, id) < (?1, ?2)`이고 색인을 쓴다. 밀리초로 자르면 `.120456` 커서가 `.120`이 되어 그 사이 행을
  건너뛰므로 자르지 않는다.
- Worker가 만드는 시각(4·5단계)은 밀리초 정밀도다. 같은 밀리초의 두 행은 `created_at`이 같지만, 목록은 모두
  `(created_at, id)`로 정렬하므로 순서가 하나로 정해진다. 미러는 저장 꼴을 보내고, Postgres는 그대로 저장한다.
- SQLite `datetime('now')`나 `strftime`으로 저장 값을 만들지 않는다.
- 데이터 시각은 `NOT NULL`이다. Supabase는 `comments`, `likes`, `comment_likes`, `chemical_posts`, `runs`의
  `created_at`에 NULL을 허용하지만 앱은 쓰지 않는다. 첫 복사가 표마다 NULL을 센다(기대 0, `runs`는 2026-11-05
  덤프에서 0). 하나라도 있으면 멈추고 그때 사용자에게 묻는다(10.3절. 정렬도 다르다: Postgres DESC는 NULL이 앞,
  SQLite는 뒤). 그 뒤 손으로 만든 요청이 넣는 NULL은 3.1절 규칙대로 `bad_timestamp` 거절이다.
- 월드컵 `rank_history[].at`만 예외다. Postgres `timestamp::text` 꼴(공백, 오프셋 없음, 끝 0 지움)을 JSON 안에
  그대로 둔다. 5단계 D1(TW5d)도 같은 꼴로 쓴다. 일일 대조는 이 값을 UTC로 보고 `canonicalTs`로 맞춰 비교한다.

### 3.4 id와 키

- Supabase id를 그대로 둔다(uuid, 런 id). 동기화와 그림자 대조가 같은 키로 맞물린다.
- 소문자 hex 글자 순서는 Postgres uuid 순서와 같다. 그래서 `id DESC` 동률 정리가 같다. Worker는 받은 id를
  소문자로 바꾼다(이미 그렇다). 5단계 새 id는 `crypto.randomUUID()`.
- **`posts`의 키는 `(service, id)`다.** Supabase는 글 표마다(그리고 `runs`가) 기본키가 따로라 같은 id가 두 표에
  있을 수 있다. 키에 서비스를 넣으면 그런 두 행이 D1에서도 두 행이라 해가 없다.
  - 서비스 표와 자식 표는 상수 `service` 열(기본값과 `CHECK (service = '<서비스>')`)을 갖고 `(service, post_id)`로
    부모를 가리킨다. 모두 `ON DELETE CASCADE`다. 월드컵 통계와 플레이는 Supabase 열 이름 그대로 `(service,
    tournament_id)`다.
  - 저장 열인 이유: VIRTUAL 생성 열은 FK 자식 열은 될 수 있지만 기본키에 넣을 수 없다(로컬 확인). 부모 키는
    기본키나 UNIQUE여야 한다. 저장 열은 행마다 몇 바이트이고, 색인이나 쓴 행이 늘지 않는다.
  - 모든 조회, upsert, 지우기, 조인이 `(service, id)`를 쓴다. 동기화 매퍼는 Supabase 표로 서비스를 안다. 스레드 키
    (`<접두사>:<id>`)는 접두사가 서비스라 둘을 이미 담는다(`threadOwner`). 접두사는 API 서비스 id가 아니라 오늘
    스레드 키 그대로다: `c-c-c-combo`, `chemical-x`, `transfigure`, `this-or-that`, `favorite-tournament`,
    `decisions-decisions`, `pagestorm`, `history-course`(Supabase `admin_story_service`,
    `apply_toybox_thread_engagement_delta`). 이 목록이 `threadOwner`의 원본이다.
  - 서비스를 가로지르는 피드(조각모음)의 정렬과 키셋은 오늘과 같다: `(created_at, id)`, 추천순·댓글순은 수가 앞이다.
    `get_defragment_feed_v2`도 `id::text`까지만 보므로 `service`를 동률 정리에 넣지 않는다.
  - id 하나로 가리키는 곳은 런 전용인 `sync_pending_raw.post_id`뿐이다(늘 `history_course`). 스레드 키와
    `defragment_bodies`에는 Supabase FK가 없다. 스레드 키에는 오늘처럼 FK를 두지 않는다. `defragment_bodies`는 앞의
    결정대로 `(service, post_id)`로 글을 가리킨다. 글을 지우면 본문도 지워지고, Supabase의 고아 본문은 세고 넣지
    않는다(5.2절, S12).
- 쓰이지 않던 대리 키는 옮기지 않는다: `likes.id`, `comment_likes.id`, `this_or_that_post_likes.id`(색인 사용
  0회). 자연 키가 기본키다. 미러 때는 Supabase가 `id`를 기본값으로 채운다.
- 정수 대리 키는 장부 표에만 있다(`outbox.seq`). 퍼즐상자 런 id는 Supabase 값 그대로다.

### 3.5 이름

- Supabase에 같은 단위로 있던 표와 열은 이름을 그대로 쓴다(`comments.story_id`, `this_or_that_post_votes`,
  `this_or_that_post_likes`, `pagestorm_drafts`, `defragment_bodies`, `puzzlebox_*`). 매퍼가 이름을 바꾸지 않아도 된다.
- `posts`를 나누며 생긴 표는 `posts`, `post_<서비스>`(1:1), `post_<서비스>_<자식 복수>`다. 서비스 이름은 API
  서비스 id(`chemical_x`, `combo`, `transfigure`, `this_or_that`, `favorite_tournament`,
  `decisions_decisions`, `pagestorm`, `history_course`).
- 1:1 표의 키는 `(service, post_id)`. 개체 표는 복수(`comments`, `likes`, `threads`).
- 새 열은 snake_case. 스레드 키 열은 오래된 이름 `story_id`(댓글·좋아요)와 새 이름 `thread_key`(`threads`)가
  섞여 있다. 옛 열을 바꾸면 모든 매퍼와 대조가 이름을 옮겨야 해서 그대로 둔다.

### 3.6 작성자 열

| 표 | 열 | CHECK |
|---|---|---|
| `comments`, `community_stories`, `posts`(런 제외), `pagestorm_drafts` | `nickname`, `avatar_id`, `avatar_kind`, `palette_id`, `palette_swapped` | 닉네임 1~20자, 토큰 세 열 합 1024 바이트 이하, `palette_swapped` 0/1/NULL |
| `posts`(런) | `nickname`만 값, 토큰은 NULL | 닉네임 trim 뒤 1~20자, 1024 바이트 이하 |
| `defragment_bodies` | `nickname` | 1~20자(오늘도 이것만 있다) |
| `puzzlebox_players` | 다섯 열 + `hidden` | RPC의 정규화 규칙(닉네임 1~24자, 토큰 패턴) |

### 3.7 그 밖의 규칙

- 새 표는 모두 `STRICT`다. 행이 작은 표는 `WITHOUT ROWID`, 문서를 담는 표는 rowid를 둔다.
- SQLite 트리거는 없다. 2~4단계에는 Supabase가 만든 파생 값을 그대로 복사해야 하는데, D1 트리거가 그 값을 다시
  계산하면 복사 값과 다툰다. 동기화는 upsert로 적용하는데, upsert에서 INSERT와 UPDATE 트리거가 다르게 돌아
  재적용에 안전하지 않다. 파생 값은 Worker batch 안의 명시적 문장이다(계획 5.5).
- `posts`에 upsert할 때는 `ON CONFLICT DO UPDATE`만 쓴다. `INSERT OR REPLACE`는 행을 먼저 지워 모든 자식 표로
  연쇄한다.
- **연쇄 부모 표는 혼자 지우거나 다시 만들지 않는다.** `posts`, `post_combo`, `post_this_or_that`,
  `post_favorite_tournament`, `post_history_course`, `comments`가 `ON DELETE CASCADE` 자식을 가진 부모다. D1은 FK를
  끌 수 없고, `defer_foreign_keys`는 연쇄를 멈추지 않는다. FK가 켜진 채 `DROP TABLE`은 먼저 암묵적 `DELETE`를
  하므로, 흔한 12단계 재작성은 자식을 모두 지운다. 부모 이름을 먼저 바꿔 두는 것도 소용없다. 자식의
  `REFERENCES`가 이름을 따라간다. (로컬 확인: 부모를 먼저 지우면 자식 1,000행이 함께 지워졌고, 잎부터 지우면 행
  변경이 0이었다.)
  - 부모를 꼭 다시 만들어야 하면 가족 전체를 다시 만든다: `*_new` 표를 모두 만들어 서로 `*_new`를 가리키게 하고,
    복사하고, 옛 표를 잎부터 위로 지우고, 이름을 부모부터 아래로 바꾼다. testbed에서 먼저 하고 행 수와
    `PRAGMA foreign_key_check`를 본다.
  - 부모 표에 목록 같은 CHECK를 두지 않는 것(3.1절)이 이 일이 생기지 않게 하는 방법이다.
- 목록 길이는 JSON 배열 하나로 묶어 `json_each(?n)`로 편다. D1의 문장당 바인딩 100개 한도(런 목록은 id 100개)를
  넘지 않고, 값마다 기본키 조회를 한다.
- D1은 FK를 기본으로 지킨다. 동기화 batch는 `PRAGMA defer_foreign_keys = ON`으로 시작한다.

## 4. 표별 설계

표 39개를 마이그레이션 넷으로 나눈다. 전체 DDL은 `d1/migrations/`의 네 파일(원본 `schema.src.sql`, 9절).

| 마이그레이션 | 표 |
|---|---|
| `0003_sync_bookkeeping.sql` | `sync_state`, `sync_rejects`, `sync_pending_raw`, `outbox`, `sync_checks`, `shadow_stats`, `shadow_diffs` |
| `0004_engagement.sql` | `comments`, `comment_likes`, `likes`, `threads`, `resource_reactions`, `resource_reaction_counts`, `community_stories` |
| `0005_posts.sql` | `posts`, `post_chemical_x`, `post_combo`, `post_combo_resources`, `post_transfigure`, `post_this_or_that`, `this_or_that_post_votes`, `this_or_that_post_likes`, `post_favorite_tournament`, `post_favorite_tournament_pool`, `favorite_tournament_candidate_stats`, `favorite_tournament_plays`, `post_decisions_decisions`, `post_pagestorm`, `pagestorm_drafts`, `defragment_bodies`, `post_history_course`, `post_history_course_file` |
| `0006_profile_contact_puzzlebox_philosophers.sql` | `profile_character_nickname_pools`, `contact_inquiries`, `puzzlebox_runs`, `puzzlebox_players`, `puzzlebox_best`, `puzzlebox_board_stats`, `colorful_philosopher_posts` |

쿼리 번호(E, T, TL, TW, R, P, C, X, F, S)는 `queries.sql`과 `plans.txt`의 번호다.

### 4.1 장부 표(`0003`)

- `sync_state`: 고리마다 한 행. `supabase_in`(2~4단계 변경 로그 적용), `outbox_out`(5~7단계 미러).
  - `low_watermark`: 그 아래 모든 id가 적용됐거나 `sync_rejects`에 적혀 있다. 열린 거절은 `sync_rejects`가
    맡아 다시 시도하므로 워터마크를 붙잡지 않는다. 단계 문턱은 여전히 막는다.
  - `high_seen`: 지금까지 읽은 가장 큰 id. 새 행은 `id > high_seen`으로 읽는다.
  - `applied_above`: `(low_watermark, high_seen]` 안에서 적용했거나 거절한 id. 최대 2,000개(CHECK). 다 차면
    `high_seen`을 더 올리지 않고 워터마크가 따라오기를 기다린다.
  - 리스, 지연 시간, 실패 수, 그리고 실행마다의 예산 수(문장, subrequest, 원문 바이트, CPU ms).
  - 리스는 `api_cache`처럼 조건부 upsert로 잡는다(S1). 창 상태는 적용 batch의 마지막 문장(S11)이 리스 주인
    조건으로 쓴다. 커밋된 일은 다시 하지 않고, 뒤의 실패가 창을 붙잡지 못한다.
- `sync_rejects`: 어느 방향이든 적용하지 못한 변경. Supabase 표 이름, D1 표, 키(`row_key`, JSON 객체), 짧은 이유
  (`reason`, 목록은 5.3절)를 둔다. `payload`는 진단용이고 다시 적용하지 않는다. 다시 시도는 그 키로 지금 행을 다시 읽어 적용한다
  (5.3절). 키마다 열린 거절은 하나다(부분 UNIQUE `sync_rejects_open_key`, S4c). 색인 `sync_rejects_open (last_at)
  WHERE resolved_at IS NULL`(S4). 열린 거절이 있으면 단계 문턱을 넘지 못한다.
- `sync_pending_raw`: 아직 받지 않은 런 원문의 런 id. 런만 있으므로 키는 런 id 하나다. 실행마다 2개까지
  받는다(S13). 워터마크를 막지 않는다.
- `outbox`: 5단계. 원본 행 변경마다 한 행을 같은 batch에 쓴다. `seq` 순서로 보낸다. 일시 오류(5xx, 시간 초과)는
  순서를 지켜 멈추고, 영구 거절(23503, 23514 같은 4xx)은 그 행을 `sync_rejects('out')`로 옮기고
  `(table_name, match_key)`가 같지 않은 다음 행으로 간다(5.5절). 받아들여진 행은 지운다(S2, S3). "outbox가 비었고 열린 `out` 거절이 없다"가 건강 신호다. 큰
  문서(런 원문, 큰 글 본문)는 넣지 않고 미러가 보낼 때 D1 표에서 읽는다(5.5절).
- `sync_checks`: 매일 대조(GitHub Actions) 결과. Supabase 원본 표(매퍼), D1 표, 종류(`rows`, `derived`)마다 하루
  한 행. 기본키에 원본 표가 들어간다. 글 일곱 표와 `runs`가 모두 `posts`로 가고, `runs`는 D1 표 셋으로 나뉘기
  때문이다.
- `shadow_stats`, `shadow_diffs`: 2단계 그림자 읽기의 날별·경로별 수와, 다른 점마다 표본 하나.

### 4.2 댓글·좋아요·반응·이야기(`0004`)

`comments`: 모든 스레드 키의 댓글. 사용자는 고칠 수 없다(오늘과 같다).

```sql
CREATE TABLE IF NOT EXISTS comments (
  id TEXT NOT NULL PRIMARY KEY CHECK (id GLOB <uuid>),
  story_id TEXT NOT NULL CHECK (length(CAST(story_id AS BLOB)) <= 1024),             -- thread key, no FK
  user_id TEXT NOT NULL CHECK (user_id GLOB <uuid>),
  nickname, avatar_id, avatar_kind, palette_id, palette_swapped,                     -- author snapshot
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 2000),
  content_blocks TEXT CHECK (json_valid(content_blocks) AND length(CAST(content_blocks AS BLOB)) <= 1048576),
  like_count INTEGER NOT NULL DEFAULT 0,                                             -- comment_likes rows
  created_at TEXT NOT NULL CHECK (created_at GLOB <ts>)
) STRICT;
```

| 색인 | 쿼리 |
|---|---|
| PK `id` | 주인 지우기(E16b), 좋아요 수 재계산(E14), `comment_likes` FK |
| `comments_thread (story_id, created_at, id)` | 스레드 읽기(E1), 내가 좋아한 댓글(E2, 색인만 읽음), 댓글 수 재계산(E13a, `max(created_at)`도 색인에서) |
| `comments_recent (created_at, id)` | 배달원(E8). 오늘 가장 비싼 앱 쿼리다(색인이 없어 861초) |
| `comments_user (user_id, created_at, id)` | 프로필 활동(P2, P3) |

- 스레드 키의 아래 한계는 없다. Postgres가 `octet_length <= 1024`만 보므로 `''`도 받는다(검사 확인).
- `comment_likes (comment_id, user_id)` PK, `WITHOUT ROWID`. 댓글을 지우면 연쇄로 지워진다. 보조 색인 없음: "내가
  좋아한 댓글"은 스레드 쪽에서 찾는다(E2).
- `likes (story_id, user_id)` PK. 스레드 키의 좋아요다(Supabase `likes`). 키 범위로 수를 세고(E13b), 내 좋아요를
  찾는다(E4). 이거 아님 저거? 좋아요는 자기 표다(2.2절, 4.3절).
- `threads (thread_key)` PK. 좋아요나 댓글이 한 번이라도 있던 키마다 한 행. 지우지 않는다(0도 남는다). 글에 FK가
  없다: 지운 글의 좋아요와 댓글은 오늘처럼 남고 셈도 남는다. `like_count`는 `likes` 행만 센다
  (`get_engagement_counts`와 같다). Supabase로 미러하지 않는다.

  ```sql
  CREATE TABLE IF NOT EXISTS threads (
    thread_key TEXT NOT NULL PRIMARY KEY,
    like_count INTEGER NOT NULL DEFAULT 0,      -- rows in likes
    comment_count INTEGER NOT NULL DEFAULT 0,   -- rows in comments
    last_comment_at TEXT,                       -- max(comments.created_at)
    updated_at INTEGER NOT NULL DEFAULT 0       -- Unix ms of the last recount
  ) STRICT, WITHOUT ROWID;
  ```

  키 목록 읽기(E3, E11, R6), 참여 지도(E7, 표 전체가 답), 3단계 범위 읽기(E7s 백과사전, E7t 이야기).
- `resource_reactions` PK `(resource_id, resource_type, game_version, user_id)`. 읽기가 모두 `resource_id`로
  거르므로 그것이 앞이다(E6, E15). `resource_reaction_counts` PK `(resource_id, resource_type, game_version)`(E5).
- `community_stories`(이야기): 장난감 상자 서비스가 아니고, 수 열도, 수 정렬도, 네비 점도 없고, 공식 이야기는
  스레드 키가 맨 id다. 그래서 `posts`에 넣지 않는다. 색인 `_recent (created_at, id)`(E10 피드),
  `_source (source, created_at, id)`(E10b 패치 페이지), `_user (user_id, created_at, id) WHERE user_id IS NOT
  NULL`(P2), `static_story_id` UNIQUE.

Worker로 옮긴 것: 서버 열 보호 트리거(`guard_insert_server_columns`)는 Worker가 행을 만드는 것으로(`created_at =
nowTs()`, `static_story_id`는 클라이언트에서 받지 않음), 카운터 트리거 둘은 재계산 문장(E13)으로,
`get_engagement_counts`는 E7로, `get_story_reaction_counts`는 지운다(쓰는 곳 없음). RLS의 "내 행만"은
`user_id = 확인된 신원`과 `DELETE ... AND user_id = ?`다.

### 4.3 글(`0005`)

```sql
CREATE TABLE IF NOT EXISTS posts (
  service TEXT NOT NULL CHECK (length(service) BETWEEN 1 AND 32 AND service NOT GLOB '*[^a-z_]*'),
  id TEXT NOT NULL,                            -- uuid, or the run id (<= 1024 bytes) for history_course
  user_id TEXT,                                -- NULL: builtin tournaments, runs whose donor was removed
  nickname TEXT NOT NULL, avatar_id, avatar_kind, palette_id, palette_swapped,
  title TEXT,                                  -- the service's own title (4 services), else NULL
  summary TEXT NOT NULL CHECK (length(summary) <= 120),   -- 조각모음 title
  like_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  ...,                                         -- id shape by service, nickname, owner, title rules
  PRIMARY KEY (service, id)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS post_combo (       -- every post_<service> table has this key shape
  service TEXT NOT NULL DEFAULT 'combo' CHECK (service = 'combo'),
  post_id TEXT NOT NULL,
  content TEXT NOT NULL, content_text TEXT NOT NULL,
  PRIMARY KEY (service, post_id),
  FOREIGN KEY (service, post_id) REFERENCES posts (service, id) ON DELETE CASCADE
) STRICT;
```

- `service`는 꼴만 본다. 아는 서비스 목록은 Worker와 매퍼에 있고, 서비스 표도 아는 서비스에만 있다. 앞으로 서비스가
  늘어도 표를 다시 만들지 않는다(3.1절, 3.7절). 검사로 "모르는 새 서비스 + uuid + 주인 + 제목"이 들어가는지 본다.
- `summary`는 `get_defragment_feed_v2`의 `left(btrim(<서비스 식>), 120)`과 같은 값을 쓰기 문장에서 계산해 둔다.
  조각모음이 서비스 표 일곱을 조인하지 않고 `posts`만 읽는다. SQLite `substr`/`trim`/`nullif`/`coalesce`는
  Postgres `left`/`btrim`/`nullif`/`coalesce`와 같이 센다(글자 단위, 공백만 자름).

  | 서비스 | `summary` 식 |
  |---|---|
  | 케미컬X, 코오오옴보 | `content_text` |
  | 변형 | `coalesce(nullif(title,''), nullif(transformed_name,''), content_text)` |
  | 이거 아님 저거? | `reason` |
  | 이아저? 월드컵, 어려운 결정 | `coalesce(nullif(title,''), note)` |
  | 서류 폭풍 | `coalesce(nullif(title,''), content_text)` |
  | 역사 강의서 | `coalesce(nullif(seed,''), id)` |

| 색인 | 쿼리 |
|---|---|
| PK `(service, id)` | 글 하나(T8, R3), 주인 확인(T21), 수정·지우기(TW2, TW3, R13), 카운터 복사(E13c), 동기화 적용(S7, S10, S12), 모든 1:1 조인, 투표·플레이순의 서비스 읽기(T4, T5: `service` 범위) |
| `posts_service_created (service, created_at, id)` | 서비스 피드 최신순(T1, T1c), 서류 폭풍 목록(T11), 역사 강의서 목록(R1), 네비 최신(E9) |
| `posts_service_likes (service, like_count, created_at, id)` | 추천순(T2) |
| `posts_service_comments (service, comment_count, created_at, id)` | 댓글순(T3), 조각모음 역사 강의서 거르기(T7) |
| `posts_created`, `posts_likes`, `posts_comments` | 조각모음 전체 판(T6a~c). 서비스를 가로지르므로 서비스 없는 색인이 필요하다. 없으면 서비스마다 20개씩 8번 읽어 합친다 |
| `posts_user (user_id, service, created_at, id)` | 프로필 활동(P2, P3), 내 런 id(R7), 기증자 닉네임 맞추기(R12) |

- 수 정렬 색인은 좋아요·댓글이 바뀔 때마다 색인 두 개를 더 쓴다. 하루 몇 번이다. 대신 쪽마다 20행만 읽는다.
- 서비스 표: `post_chemical_x`, `post_combo`, `post_transfigure`, `post_this_or_that`, `post_favorite_tournament`,
  `post_decisions_decisions`, `post_pagestorm`, `post_history_course`. 모두 `(service, post_id)` PK, `posts (service,
  id)` FK, `ON DELETE CASCADE`다(3.4절). 피드는 `CROSS JOIN`으로 `posts`를 바깥 반복에 둔다(2절 끝).
  열은 Supabase 열에서 공통 열과 죽은 열을 뺀 것이다. CHECK는 Postgres 것을 옮겼다(변형의 비용 정규식은 같은 뜻의
  GLOB).
- 피드 쿼리는 1단계 답의 열을 모두 고른다. `get_toybox_feed`는 행마다 `id, created_at, like_count, comment_count,
  recommend_score, post`를 주고 `post`는 `to_jsonb(p.*)`이다. 그래서 T1~T5는 `posts` 열(작성자 토큰 포함)과
  서비스 표 열을 모두 고르고, 자식 배열은 다시 만든다. 서류 폭풍 목록(T11)과 초안(T12)은 1단계
  `PAGESTORM_LIST_COLUMNS`와 같은 열이다(초안 답에는 `updated_at`이 없다). 어댑터의 키를 1단계 열 목록
  (`TOYBOX_POST_TABLES`의 표 열, `PAGESTORM_LIST_COLUMNS`, `RUN_SUMMARY_COLUMNS`)과 맞대는 시험을 둔다(9절).
- 자식 표: `post_combo_resources (service, post_id, ord)`, `post_favorite_tournament_pool (service, post_id, ord)`. `ord`가 배열 순서를
  지킨다. 목록은 상관 부분쿼리 `json_group_array(...)`로 배열을 다시 만든다(T1, T5, T9). 정렬에 임시 B-tree를 쓰는
  T5는 안쪽 쿼리에서 정렬과 `LIMIT 20`을 끝낸 뒤 바깥에서 풀을 만든다. 그러지 않으면 정렬 전에 후보 행 대부분의
  풀을 읽는다(검토 측정 loops=57, 풀 3,114행). 바꾼 뒤에는 풀 조회가 20번이다(로컬 `.scanstats` 확인). 원소 색인은
  아직 없다. 서버에서 원소로 거르는 쿼리가 생기면 `(resource_type, resource_id, post_id)`를 더한다.
- 이아저? 월드컵: `post_favorite_tournament_builtin` 부분 UNIQUE 색인 `(preset_key) WHERE substr(preset_key, 1,
  8) = 'builtin:'`. 기본 제공 대회 목록(T9)과 시드의 충돌 대상이다. Postgres `LIKE`는 대소문자를 가리고 SQLite
  `LIKE`는 가리지 않아 `substr`을 쓴다. T9는 `CROSS JOIN`으로 이 색인을 바깥 반복으로 고정한다.
- `favorite_tournament_plays`: 플레이 한 판이 한 행. `play_count`와 후보 통계의 원본이다. 어느 경로도 내보내지
  않는다(공개 읽기 정책을 옮기지 않아 tasks/010 #67이 함께 고쳐진다). `favorite_tournament_plays_tournament
  (service, tournament_id)` 색인은 `play_count` 재계산(TW5b)과 대회 지우기 연쇄가 쓴다.
- `favorite_tournament_candidate_stats` PK `(service, tournament_id, resource_type, resource_id)`. 통계 읽기(T10), 더하기
  upsert(TW5c), 순위 다시 매기기(TW5d, 순위가 바뀐 행만 쓴다), 5단계 미러 읽기(S15).
- `this_or_that_post_votes (service, post_id, user_id)` PK, `post_this_or_that` FK(Postgres와 같다). 내 투표(T18)는
  목록의 id로 기본키를 찾는다. 투표 수는 `post_this_or_that.left/right_vote_count`이고 5단계에 투표 행에서 다시
  센다(TW4b).
- `this_or_that_post_likes (service, post_id, user_id)` PK, `post_this_or_that` FK, `ON DELETE CASCADE`(Postgres와
  같다, 2.2절). 수 읽기(T15)와 내 좋아요(T16)는 기본키를 찾는다. 5단계 좋아요 넣기는 TL1, E13c, outbox 한 행을 한
  batch로 돈다. 글이 없으면 FK 오류로 batch 전체가 되돌아가고(outbox 행도 없다) Worker는 `not_found`로 답한다.
  이미 좋아한 글이면 오늘처럼 성공이다. 좋아요 지우기는 TL2, E13c, outbox 지우기 한 행(match `post_id` +
  `user_id`)을 한 batch로 돈다. 이 행이 없으면 Supabase 행과 `like_count`가 남아 일일 대조가 어긋나고, 5단계를
  되돌린 뒤 취소한 좋아요가 다시 보인다.
- `pagestorm_drafts`: 서류 폭풍 초안. 글이 아니다. `pagestorm_drafts_user_updated (user_id, updated_at, id)`(T12).
- `defragment_bodies`: 조각모음 덧글 본문. 키 `(service, post_id)`는 Supabase 키 `(source_service, source_id)`에서
  env를 뺀 것이다. Supabase에는 FK가 없지만 앞의 결정대로 D1은 글을 가리킨다. 글을 지우면 본문도 지워지고
  (Supabase는 고아로 남긴다), Supabase의 고아 본문은 세고 넣지 않는다(5.2절, S12). 서비스 목록 CHECK는 없다. FK가
  이미 `posts`의 서비스로 묶는다. 본문 읽기(T14)는 `posts`를 조인하지 않는다.
- 이거 아님 저거? 투표순과 이아저? 월드컵 플레이순에는 정렬 색인이 없다. 이 수는 서비스 표에 있고, 동률 정리 열은
  `posts`에 있다. 색인은 표를 넘지 못한다. 그래서 그 서비스의 글을 다 읽고 정렬한다(지금 이거 아님 저거? 글
  23개, 월드컵 47개). 서비스 글이
  2,000개쯤 되면 `created_at` 사본과 색인을 더한다(스키마가 자라기만 한다).
- 이거 아님 저거? 글 지우기(TW3, 5단계)는 투표와 좋아요를 FK 연쇄로 지운다. 글 지우기 때 연쇄로 지워지는 좋아요의
  outbox 행은 만들지 않는다. 미러된 글 지우기에서 Supabase도 FK 연쇄로 지운다.

Worker로 옮긴 것: `guard_post_server_columns`는 Worker의 INSERT가 id, 시각, 수 0, `user_id`를 직접 넣고 UPDATE가
고칠 수 있는 열만 쓰는 것으로. `apply_toybox_thread_engagement_delta`, `apply_this_or_that_like_count_delta`,
`apply_this_or_that_vote_count_delta`는 재계산 문장(E13c, TW4b)으로. `complete_favorite_tournament_play`는 Worker 검사(크기,
후보, 승자, 우승자를 TypeScript로) + batch 네 문장(TW5a~d)으로. `get_this_or_that_vote_summaries`는 카운터 읽기
(T17)로. `get_toybox_feed`, `get_defragment_feed_v2`는 T1~T7로. `defragment_source_owned`는 본문 upsert 안의
`EXISTS`(TW6)로.

### 4.4 역사 강의서(`0005`)

```sql
CREATE TABLE IF NOT EXISTS post_history_course (
  service TEXT NOT NULL DEFAULT 'history_course' CHECK (service = 'history_course'),
  post_id TEXT NOT NULL,
  seed, build, "character", ascension, win, start_time, run_time, acts_count, total_floors,  -- already columns
  cover_spec TEXT,             -- the stored cover (server-side, never written by the backfill)
  summary_version INTEGER NOT NULL DEFAULT 0,
  badges TEXT NOT NULL DEFAULT '[]',
  characters TEXT, game_mode TEXT, game_elements TEXT, list_facts TEXT,                      -- new
  CHECK (summary_version = 0 OR (characters IS NOT NULL AND game_mode IS NOT NULL
    AND game_elements IS NOT NULL AND list_facts IS NOT NULL)),
  PRIMARY KEY (service, post_id),
  FOREIGN KEY (service, post_id) REFERENCES posts (service, id) ON DELETE CASCADE
) STRICT;

CREATE TABLE IF NOT EXISTS post_history_course_file (
  service TEXT NOT NULL DEFAULT 'history_course' CHECK (service = 'history_course'),
  post_id TEXT NOT NULL,
  raw TEXT NOT NULL CHECK (length(CAST(raw AS BLOB)) <= 1900000),
  PRIMARY KEY (service, post_id),
  FOREIGN KEY (service, post_id) REFERENCES post_history_course (service, post_id) ON DELETE CASCADE
) STRICT;
```

목록이 오늘 원문에서 읽는 것을 따라가 정한 요약 열이다(`run-donation.ts` `normalizeRunSummaryRow`,
`run-cover-suggest.ts` `pickAlternatingCover`, `run-highlights.ts`, `history-course-run-index.tsx`,
`history-course-search.ts`). 요약 열은 `characters`, `game_elements`, `game_mode`, `list_facts`,
`summary_version` 다섯이다(10.2절).

| 목록이 쓰는 것 | 오늘 출처 | D1 |
|---|---|---|
| `seed`, `build`, `character`, `ascension`, `win`, `start_time`, `run_time`, `acts_count`, `total_floors` | 열(없으면 원문) | 열 그대로 |
| 파티 캐릭터 `characters` | 원문(`partyCharacters`) | 새 열, JSON 배열 |
| 배지 `badges` | 원문(`mergePartyBadges`). 읽을 때마다 다시 만든다. 올릴 때 같은 함수로 쓴 열은 읽지 않았다 | 열 그대로. 채우기가 원문에서 다시 만들어 쓴다(아래) |
| 표지 | 수동(`auto = false`)이면 `cover_spec`, 아니면 읽을 때마다 원문에서 `pickAlternatingCover`로 다시 고름 | 같은 규칙. 수동이면 `cover_spec`, 아니면 브라우저가 `list_facts`로 같은 함수를 돌려 고른다. `cover_spec`은 그대로 둔다 |
| 게임 요소 `game_elements` | 원문(`extractRunGameElements`). 검색창 아래 인기 요소 칩(첫 화면부터, 런 전체에서)과 검색 | 새 열, JSON 배열. 목록과 함께 보낸다(10.4절). 걸러도 브라우저가 목록 100개 위에서 하므로 자식 표가 아니다 |
| 게임 모드 `game_mode` | 원문 | 새 열 |
| 자동 표지 입력, 표지 문구, 강조 카드·유물 | 원문(`buildWeightedPool`, `factsFromRun`, `coverPhrasePool(run, cover.elements)`, `buildRunHighlights`) | 새 열 `list_facts`, JSON 객체(아래) |
| 좋아요·댓글 수 | 행 수(오늘 목록이 `likes`·`comments` 행을 세어 씀) | `threads`(R1이 조인) |
| 주인의 표지 편집 | 원문. 버튼이 `donated.raw`에 묶이고(`history-course-run-index.tsx`의 `onEditCover`), 편집기가 원문을 파싱한 런 전체를 받는다(`parseReplayRun`, `listRankedCoverElements`). 그 브라우저에 로컬 런이 없을 때(다른 기기) 목록에서 여는 길이 이것이다 | 버튼은 오늘처럼 주인에게 보인다. 편집기를 열 때 R3r로 원문을 받는다(3단계 클라이언트 변경). `list_facts`로는 편집기에 줄 런을 만들 수 없다 |
| 저장된 `highlight_card`, `highlight_relic`, `note_blocks` | 읽지 않음(강조는 원문에서 다시 고름) | 옮기지 않음 |

- `list_facts`는 목록이 원문에서 읽던 것 가운데 다른 열에 없는 것이다. 자동 표지 고르기가 읽는 순서 그대로 둔다:
  - 카드: 플레이어 덱 순서로 처음 나온 카드마다 `[id, 장수, 처음 얻은 층(없으면 null), 강화 여부]`.
  - 유물: 처음 나온 순서로 `[id, 얻은 층이 0보다 큰 적이 있는지]`. 포션: 플레이어 순서 그대로 id 목록(중복 포함,
    `POTION_SLOT`·`NONE` 뺌).
  - `deck_size`, `relic_count`: 플레이어마다의 최댓값(`factsFromRun`).
  - `highlight_card`, `highlight_relic`: `buildRunHighlights(run, id)`가 고른 id(런 id와 시드로 정해진다).
- 브라우저는 이 객체로 오늘과 같은 함수를 돈다. 자동 표지는 `pickAlternatingCover`, 검색 문구는 보이는 표지의
  원소로 `coverPhrasePool`, 강조는 위 id다. 그래서 표지 문구를 열로 저장하지 않는다. 문구는 보이는 표지를 따라가야
  하고, 자동 표지는 읽을 때 고르기 때문이다. 고르기 규칙(가중치, 문구 틀)이 바뀌어도 입력이 같으면 오늘처럼 바로
  반영된다. 입력이 바뀌면 `summary_version`을 올린다.
- 배지는 이와 다르다. 오늘 목록은 읽을 때마다 원문에서 `mergePartyBadges`로 배지를 다시 만든다(`RUN_SUMMARY_COLUMNS`에
  `badges`가 없다). 그래서 배지 규칙이 바뀌면 옛 런의 목록 배지도 바로 바뀐다. D1 목록은 저장된 `badges` 열을
  보이므로, 오늘과 같게 하려고 `badges`도 요약으로 다룬다.
  - D1의 `badges`는 Supabase에서 복사하지 않고 요약 열과 함께 원문에서 만든다(첫 복사, 요약 채우기). 오늘 이 열을
    읽는 화면이 없어 바뀌어 보이는 것은 없다.
  - 배지 규칙(`mergePartyBadges`)이 바뀌면 `summary_version`을 올리고 채우기를 다시 돈다. 그러면 옛 런도 오늘처럼
    새 규칙의 배지를 보인다. 일일 대조가 차이를 잡는다(5.4절).
- 저장된 `cover_spec`을 그대로 보이는 곳은 조각모음(`history_meta`)과 메타·OG(`getDonatedRunOgFields`)다. 상세와
  표지 편집기는 오늘처럼 원문에서 고른다. 오늘 상세는 `normalizeRunRow`가 수동이 아닌 표지를 원문에서
  `pickAlternatingCover`로 다시 고르고, `run-detail-loader.tsx`의 `ensureCoverSpec`이 한 번 더 고른다. D1에서는
  R3r 원문으로 같은 함수를 돈다. 그래서 상세와 IDB 캐시(`saveRun`의 `coverSpec`)의 표지가 오늘과 같다. 첫 복사와 요약
  채우기는 `cover_spec`을 Supabase 값 그대로 둔다. 바꾸면 조각모음 화면이 바뀐다(10.2절).
- `summary_version`: 0이면 아직 요약이 없다. N이면 추출기 판 N이 썼다. 추출기, 강조 고르기(`buildRunHighlights`),
  `list_facts`의 입력, 배지 규칙이 바뀌면 상수를 올리고 요약 채우기를 다시 돈다.
- 요약은 D1에서만 만든다(10.2절). Supabase `runs`에는 요약 열이 없다.
  - 첫 복사가 모든 런의 요약 열과 `badges`를 원문에서 계산해 넣는다(5.2절).
  - 2~4단계에 Supabase로 새로 올라온 런은 1분 동기화가 행과 원문만 옮기고 `summary_version = 0`으로 넣는다. 원문이
    바뀐 `heavy_changed` `U`도 0으로 되돌린다. 동기화는 요약 열과 `badges`를 Supabase에서 쓰지 않는다. 1분 동기화는
    실행마다 CPU 10 ms 한도라 거기서 원문을 파싱하지 않는다(5.3절).
  - 요약 채우기 작업: `summary_version`이 지금 판보다 작은 런을 고르고(RF1), 원문(R3r)으로 프로젝트 코드를 돌려 요약
    열과 `badges`를 쓴다(RF2). GitHub Actions에서 일일 대조 앞에 돌고(5.4절), 손으로도 돌린다. 쓰는 것은 D1뿐이다.
  - 0 런은 D1 목록이 그 런만 R3r로 원문을 받아 오늘처럼 브라우저가 계산한다. 업로드는 하루 몇 건이라 이런 런은 많아야
    몇 개이고, 화면은 오늘과 같다. 3단계 목록 클라이언트 변경에 넣는다.
  - 올릴 때 브라우저가 요약을 계산해 함께 보내는 변경은 쓰기가 D1으로 오는 5단계(R14b)에 넣는다.
- `game_elements`를 자식 표로 하면 운영에 약 62,500행이고, 한 번 복사에 15만~22만 행을 쓴다(무료 쓰기 한도 하루
  10만을 넘는다). 서버에서 원소로 거르는 쿼리가 생기면 그때 `run_game_elements`를 더한다.
- 런 id와 소유자는 `posts`에 있다. 목록(R1)은 `posts_service_created`를 훑고 서비스 표와 `threads`를 기본키로
  찾는다. `game_elements`와 `list_facts`도 함께 준다. 100개에 약 0.6 MB(570~620 KB)다(요약 약 60 KB,
  `game_elements` 약 410 KB, `list_facts` 추정 100~150 KB. 첫 복사 검사가 잰다). 오늘은 원문까지 약 7.9 MB다.
  계획 5.1절은 페이지 HTML에 넣는 첫 데이터 JSON에 상한 128 KB를 둔다. 목록 답은 그보다 커서, 역사 강의서 목록의
  첫 데이터를 어떻게 넣을지는 3단계에 따로 정한다. 런 고르기(R2)도 목록과 같은 요약 열을 고른다(1단계
  `RUN_SUMMARY_COLUMNS`에서 `raw` 대신 요약 열, `acts_count` 포함). 코오오옴보의 런 표지(R4)는 `cover_spec`과
  `list_facts`를 줘 같은 규칙으로 고른다.
- **상세와 표지 편집기의 원문.** R3(상세 메타)와 R4(코오오옴보 썸네일 표지)는 원문을 고르지 않는다. 상세와 표지
  편집기의 원문은 R3r 하나로 읽고,
  저장된 텍스트를 응답 본문 그대로 준다(JSON으로 감싸지 않음, Worker가 파싱하지 않음). 메타는 같은 요청의 헤더나
  따로 요청(R5)으로 준다. 이 답 모양 변경은 3단계에 클라이언트와 함께 들어간다. 2단계 그림자 대조는 원문을 뺀
  열로 하므로 영향이 없다. testbed에서 277 KB와 1.9 MB 원문으로 `text()`, bind, 응답의 CPU를 재서 여기 적는다.
  상한은 1.9 MB로 정했다(10.8절). 지금 최대 원문은 277 KB(중간값 약 57 KB)다.

| 색인 | 쿼리 |
|---|---|
| `post_history_course` PK `(service, post_id)` | 상세(R3), 표지(R4), 메타·OG(R5), 표지 저장(R11), 원문 저장 확인(S13c) |
| `post_history_course_start_time (start_time, post_id)` | 코오오옴보·조각모음 런 고르기 30개(R2) |
| `post_history_course_file` PK | 상세와 표지 편집기의 원문(R3r), 미러 읽기(S14) |

**5단계 공유 요청(그리고 4단계 Worker 검증 쓰기).** 1단계는 묶음 본문(상한 24 MB, 런마다 원문)을 파싱하지 않고
흘려보낸다. 5.5 MB를 JS로 흘리는 데만 CPU 77~204 ms를 썼고 Free는 10 ms다. 묶음을 파싱해 런별로 나누는 R14는
그대로는 돌 수 없다. 42개 공유면 문장도 2 + 42(R14c) + 42(outbox)로 50개를 넘는다. 그래서 스키마는 그대로 두고
요청을 바꾼다.

1. 요청 하나에 런 하나다. 본문은 원문 그대로다(`request.text()`, 이미 JSON 텍스트). Worker는 파싱하지 않고 R14c에
   묶는다. 원문 상한은 1.9 MB(표 CHECK와 같다).
2. 요약 행(`id, seed, build, character, ..., summary_version`)은 작은 JSON으로 헤더나 쿼리 필드에 담고 64 KB 상한을
   둔다. Worker는 이 작은 JSON만 파싱해 검증한다.
3. batch는 런마다 고정 4문장이다: R14a(`posts`, 원소 하나짜리 배열), R14b(`post_history_course`, 이 기증자의 런
   행 밑에만), R14c(원문, 같은 주인 확인), R14d(outbox 한 행, 원문 없음). `json_each` 다건 꼴은 N=1로 쓴다.
4. 클라이언트는 고른 런을 차례로 보내고(동시성 2~3) 결과를 모아 지금처럼 "N개 공유 · M개 이미 공유됨"을 보여 준다.
   오늘 묶음으로 바꾼 이유(런마다 보내면 42개 중 약 70%를 잃었다: Supabase 익명 인증 경합과 rate limit)는 5단계에
   없다. 쿠키 신원이라 인증 경합이 없고, Workers Rate Limiting 한도는 차례로 보내는 공유를 막지 않게 정한다.
5. 4단계에 Worker가 쓰기를 검증하고 service 키로 Supabase에 쓸 때도 같은 요청 모양을 쓴다. 4단계도 묶음을
   파싱하지 않는다.

Worker로 옮긴 것: `runs`의 서버 열 보호 트리거는 R14(올리기) 문장이 허용된 열만 쓰는 것으로. 수는 0이 아니라
`threads`에서 가져온다(다시 올린 런이 0에서 다시 시작하지 않는다). 카운터 트리거의 런 분기는 E13c로. RLS는
`user_id = 확인된 신원`과 `service = 'history_course'` 조건으로.

### 4.5 프로필·문의·퍼즐상자·다채로운 철학자들(`0006`)

- `profile_character_nickname_pools (character_id, locale)` PK. Supabase에 env가 없어 모든 D1에 같은 10행이 있다.
  P1은 표 전체를 읽는다(10행). 관리자 스크립트는 모든 D1과 Supabase에 쓴다.
- `contact_inquiries`: `user_id`, `reply_email`은 비공개다. 브라우저 답은 정해진 열 목록만 고른다(Worker 시험이
  확인). `contact_inquiries_user_created (user_id, created_at, id)` 하나가 시간당 3건 제한(C1, 조건부 INSERT 한
  문장), 우편함 점(C2), 내 문의(C3), 읽음 표시(C4)를 맡는다. 관리자 답장은 로컬 스크립트다(C5b, 답장이 바뀌면
  읽음을 지운다: `clear_contact_inquiry_reply_seen`). C1의 미러는 Supabase 트리거 마이그레이션(5.5절)에 기댄다.
- 짜증나는 퍼즐상자:
  - `puzzlebox_runs`: 끝난 판 전부. `puzzlebox_runs_user_created (user_id, created_at)`이 3초 연타와 하루 500판
    제한(X1a)을 맡는다.
  - `puzzlebox_players (user_id)`: Supabase에 env가 없어 모든 D1에 모든 행이 있다.
  - `puzzlebox_best (game, board, user_id)` PK. 보드별 순위(X1e), 리더보드(X2: 유효 보드 목록이 기본키를 찾는다),
    내 순위(X4: 보드마다 내 행을 기본키로). `puzzlebox_best_user_game`은 `puzzlebox_players` FK 자식 조회,
    `puzzlebox_best_run`은 `puzzlebox_runs` FK 자식 조회다.
  - `puzzlebox_board_stats (game, board)` PK. 배열 셋은 보여 주기만 해서 JSON이고, 한 UPDATE가 원소별로 고친다.
  - `submit_puzzlebox_run`, `puzzlebox_score_run`, `puzzlebox_run_display`는 Worker batch(X1a~e)와
    `vexing-puzzlebox-score.ts`로. SQL과 TS에 같은 채점이 두 벌 있던 것이 없어진다. 플레이어 태그
    (`left(md5(user_id), 4)`)는 Worker가 계산한다.
  - **환경마다의 뜻(5단계부터).** 오늘 `puzzlebox_players`는 사용자마다 한 행을 두 env가 함께 쓰고, 하루 500판과
    3초 연타 규칙(`submit_puzzlebox_run`의 스팸 막기)은 두 env를 합쳐 센다. 환경마다 D1이 원본이 되면:
    - 하루 500판과 3초 규칙은 그 env 안에서 센다. 실제로는 바뀌는 것이 없다. testbed와 운영은 서로 다른 익명
      사용자라 오늘도 한 사용자의 판은 한 env에만 있다(10.7절).
    - testbed에서 한 판이 운영 D1의 플레이어 행을 바꾸지 않는다. env 없는 표(`puzzlebox_players`,
      `profile_character_nickname_pools`)는 운영만 Supabase로 미러하고 testbed는 자기 D1에만 둔다(5.5절).
    - `hidden`은 관리자 스크립트가 모든 D1과 Supabase에 쓴다. 한 곳만 바꾸면 다른 리더보드에는 남는다.
- `colorful_philosopher_posts`(다채로운 철학자들): `UNIQUE (week_start, slot)`이 주 목록(F1), 릴(F3), 네비 주간
  점(F4), 다음 주 확인(F6), 관리자 upsert(F7)를 맡는다. `_resource (resource_type, resource_id, week_start)`는
  백과사전 상세의 철학자 글(F5). `week_start`는 월요일 CHECK가 있다(덤프의 28행이 모두 월요일).

## 5. 동기화와 미러

### 5.1 Supabase 쪽(2단계 마이그레이션, `docs/RELEASE_PROCESS.md`를 따른다)

변경 로그:

- `public.d1_change_log(id identity, env, table_name, op 'I'|'U'|'D', new_row jsonb, old_row jsonb,
  heavy_changed boolean, row_bytes integer, changed_at)`. service role만 읽는다(RLS 켜고 정책 없음, anon·authenticated
  권한 회수). `row_bytes`는 트리거가 적는 `octet_length(new_row::text) + octet_length(old_row::text)`다. 동기화가
  쪽을 바이트로 자를 때 쓴다(5.3절 2번).
- 함수 `d1_log_change()`: `AFTER INSERT OR UPDATE OR DELETE ... FOR EACH ROW`. `I`는 행 전체, `U`는 바뀐 열만,
  `D`는 옛 행. 바뀐 것이 없는 UPDATE는 적지 않는다. 트리거 인자로 큰 열(`runs`의 `raw`)을 이름 대면 새 행과 옛
  행 모두에서 빼고 `heavy_changed`만 남긴다. `comment_likes`는 env가 없어 부모 댓글의 env를 쓴다(연쇄 삭제라
  부모가 없으면 null = 모든 env).
- 옮기는 27개 표에 트리거를 단다. env가 없는 표(`profile_character_nickname_pools`, `puzzlebox_players`)의 행은
  env가 null이고 모든 D1에 적용된다.

런 요약을 위한 Supabase 마이그레이션은 없다. `runs`는 바꾸지 않는다(10.2절). 2단계에 운영 Supabase에 올리는
마이그레이션은 위 변경 로그 하나다. `docs/RELEASE_PROCESS.md` 5절대로 `supabase db push --dry-run`을 보여 주고
승인을 받은 뒤 올린다. 지우는 스크립트를 함께 둔다.

그 밖의 Supabase 전제 조건 마이그레이션은 두지 않는다(10.6절). 손으로 만든 요청만 만들 수 있는 값은 3.1절
규칙대로 동기화 거절이 된다.

나중 단계의 메모: `contact_inquiries_rate_limit` 트리거에 `WHEN` 붙이기(5.5절). 2단계에는 하지 않는다. service
키로 문의를 쓰는 첫 단계 전(4단계 Worker 쓰기 전)에 올린다. 4단계 Worker가 service 키로 문의를 쓰기 때문이다(5.5절).
4단계 일이라 그때 승인을 받는다.

### 5.2 첫 복사

1. Supabase 행은 하나도 바꾸지 않는다. Supabase 수는 다시 세지 않는다(10.1절).
2. 변경 로그 마이그레이션을 올리고 `max(id)`를 적는다(`W0`).
3. 옮기는 표를 `pg_dump --data-only`로 한 스냅샷에서 뜬다.
4. 표마다 같은 매퍼의 `toD1`로 바꾼다. env로 나누고(`comment_likes`는 부모 댓글의 env), 시각을 `canonicalTs`로,
   JSON을 압축 꼴로. 런은 요약 채우기 작업과 같은 코드로 원문에서 요약 열과 `badges`를 계산한다(4.4절). 아래 검사에서 기대와 다른 값이 나오면 멈추고 사용자에게 묻는다.
5. 부모 먼저 넣는다(`posts` → `post_*` → 자식 → 위성, `comments` → `comment_likes`, `puzzlebox_players` →
   `puzzlebox_runs` → `puzzlebox_best`).
6. 파생 값을 채운다: `threads`는 D1의 `likes`·`comments`에서 세고, `comments.like_count`는 `comment_likes`에서
   센다(`fixtures.sql` 끝의 두 문장과 같다).
7. 워터마크를 `W0`보다 앞에 둔다: `changed_at`이 `W0`의 `changed_at` 5분 전 이후인 가장 작은 id를 `L0`라 하고,
   `low_watermark = high_seen = L0 - 1`. 그 사이 행을 다시 적용해도 같다(멱등). `W0` 바로 아래 id가 덤프 스냅샷
   뒤에 커밋되는 경우를 놓치지 않는다. 5분 규칙이 막으려는 것과 같은 경우다. 그 뒤 cron을 켠다.

첫 복사 검사(기대와 다른 수가 나오면 그때 묻는다. 카운터 어긋남과 JSON 크기는 보고만 한다, 10절 끝):

- 데이터 시각의 NULL을 표마다 센다(기대 0, `runs`는 0). 하나라도 있으면 멈추고 묻는다(10.3절).
- 손으로 만든 값(3.1절)을 표마다 센다: `canonicalTs`를 통과하지 못하는 시각, `{type, id}` 문자열이 아닌
  `pool`·`resources` 원소. 기대 0이다(첫 복사가 센다). 있으면 멈추고 묻는다.
- 덤프가 UTC로 떠졌는지 본다(시각의 오프셋이 모두 `+00`). `timestamptz`는 UTC로 저장되므로 오프셋은 pg_dump 세션
  시간대가 UTC가 아닐 때만 달라진다. 다르면 세션 시간대를 UTC로 두고 다시 뜬다.
- `summary_version = 0`인 런 수를 보고한다(기대 0, 첫 복사가 모두 계산한다). 원문을 읽지 못한 런이 있으면 멈추고 묻는다.
- 1.9 MB를 넘는 원문을 센다(기대 0, 지금 최대 277 KB). 있으면 멈추고 묻는다.
- `list_facts`와 `game_elements`의 최대·중간 크기, 100개 목록 답의 크기를 보고한다(4.4절).
- 고아 `defragment_bodies`(그 서비스·id의 글이 없음)는 세어 보고하고 넣지 않는다.
- FK 자식(투표, 이거 아님 저거? 좋아요, 월드컵 플레이·통계)이 부모 글과 env가 같은지 센다. Postgres FK에는 env가
  없어 다른 env의 글을 가리킬 수 있고, 그런 행은 env마다 따로인 D1에서 부모가 없다. 투표는 INSERT 정책이, 플레이와
  통계는 RPC(`env = p_env`로 대회를 찾음)가 막으므로 0이어야 하고, 아니면 멈춘다. 좋아요는 막는 곳이 없다
  (tasks/010 #70, 2026-11-05 백업에서 0행). 행 수를 보고하고, 그 행은 `cross_env`로 세고 넣지 않는다.
  Supabase에서도 이 행은 어디에도 보이지 않는다. 동기화 기간 내내 같은 방식이다(5.3절 표별 대응).
- 카운터 어긋남(`like_count`·`comment_count` 대 행 수, 투표 수, 플레이 수)은 보고만 한다. 수는 Supabase 값을
  그대로 복사한다(10.1절, tasks/010 #68).
- JSON 열마다 최대 크기를 보고한다.

**다시 채우기.** 5단계 전까지는 D1을 비우고 다시 채울 수 있다(계획 7.2). `DELETE`로 비우지 않는다. 지운 행과 색인
항목도 쓴 행으로 세므로(`posts` 한 행 = 표 + 보조 색인 7개 = 8행) 비우고 채우기가 첫 복사의 두 배, 6만 행을
넘는다. 대신 `0003`~`0006`의 표를 잎부터 위로 `DROP`하고(3.7절: 잎부터면 행 변경이 0, 로컬 확인) DDL을 다시 올린
뒤 첫 복사를 한다. D1이 이 `DROP`을 쓴 행으로 세지 않는지는 testbed에서 한 번 잰다. 채우기는 DB마다 다른 날에
하고, 그날은 그림자 샘플을 0으로 둔다.

쓰는 행: 운영 기준 참여 약 3천, 글 1만~2만(풀 행 포함), 런 약 6천. 한 DB에 3만 안팎이다. 무료 쓰기 한도(계정
하루 10만)를 생각해 testbed와 운영을 다른 날 채운다.

### 5.3 1분 동기화(2~4단계)

한 번의 cron 실행은 Workers Free 한도 안에서 끝나야 한다: D1 쿼리 50개(batch 안의 문장도 하나씩 센다),
subrequest 50개, CPU 10 ms. 초안은 변경 로그 100행을 batch 하나에 넣었는데, 매퍼가 변경마다 문장 2~4개를 만들어
150~400문장이 되고, 실패하면 변경마다 따로 돌려 100번을 넘는다. 런 42개를 한 번에 공유하면 원문 42개를 받는
fetch와 약 2.4 MB(최대 11 MB) JSON 파싱이 한 실행에 몰린다. 그러면 실행이 매번 같은 곳에서 죽고 워터마크가 오르지
않는다. 그래서 행 수가 아니라 예산으로 자른다.

실행 하나의 예산(대략, 여유 5): D1 문장 45 = 리스 S1 1 + 거절 읽기 S4 1 + 거절 재시도 최대 8문장 + 본 batch 최대
35문장(마지막 S11 포함). subrequest = 로그 읽기 2(새 쪽, 창 다시 읽기) + 거절·실패 다시 읽기 최대 10 + 원문 최대 2.
원문 바이트는 실행마다 2 MB 이하.

1. **리스와 거절 먼저.** S1로 리스를 잡는다. 열린 거절을 오래된 것부터 읽어(S4) 다시 시도한다. 다시 시도는
   payload를 다시 적용하지 않는다. 그 표와 키로 Supabase의 지금 행을 하나 읽는다(service 키, 런은 `raw`를 빼고).
   행이 있으면 같은 매퍼로 upsert하고, 없으면 같은 지우기 길로 지운다(연쇄 포함). 그리고 `resolved_at`을 쓴다
   (S4d). 다시 읽어 보니 Supabase에 행이 없으면 그 거절은 저절로 닫힌다(지운 부모의 자식 같은 경우). 지금 행이
   D1 CHECK에 걸리는 결정적 거절만 열린 채 남아 그때 사용자에게 묻고(3.1절), 10번 시도 한도는 이것에만 쓴다.
2. **새 행 읽기.** `id > high_seen`이고 env가 `API_DATA_ENV`나 null인 행을 id 순서로 100개까지, 먼저 `id,
   table_name, op, row_bytes, changed_at`만 읽는다. 그 가운데 바이트 합이 512 KB 이하인 앞부분만 본문까지
   읽는다(혼자 512 KB를 넘는 행은 혼자 읽는다). 한 번의 폭주가 읽기를 막지 않는다.
3. **늦게 커밋된 행.** 실행마다 한 번 `(low_watermark, high_seen]` 창을 `id=not.in.(applied_above)`로 다시 읽는다.
   identity 값은 커밋 전에 정해져 낮은 id가 늦게 보일 수 있기 때문이다.
4. **합치기.** (표, D1 키)마다 id 순서로 합친다: `I`는 행 전체, `U`는 열을 덮고, `D`는 지우기 표시, `D` 뒤 `I`는
   행 전체. 끝이 `D`인 행은 지우기만 한다. 키가 열린 거절에 걸려 있으면 그 키의 변경은 적용하지 않고 거절에 접는다
   (다시 읽기가 이미 그 변경을 담는다). batch 안의 순서는 합친 변경마다 첫 id 순서이고, 같은 실행 안에서는 부모가
   자식보다 앞이다. 그래서 같은 쪽에서 만든 글(70)과 본문(71)이 있으면 글이 먼저 들어간다.
5. **예산 안에서 자르기.** id 순서로 변경을 받되, 매퍼 문장과 재계산(E13a, E13b, E14)을 더해 35문장을 넘기 전에
   멈춘다. 남은 것은 다음 분에 한다. 런 `I`나 `heavy_changed` `U`는 원문 없이 행만 적용하고 S13b로 원문을
   줄 세운다. 그 런의 `summary_version`은 0이다(4.4절).
6. **batch.** `PRAGMA defer_foreign_keys = ON`, 문장들, 마지막에 S11(창 상태와 예산 수를 리스 주인 조건으로 씀).
   커밋된 일은 다시 하지 않는다.
7. **실패하면 반으로 나눈다.** batch가 실패하면 반씩 나눠 다시 돈다(약 log2 n번). 한 변경만 남았을 때 그것이 FK
   오류면, 그 자리에서 1번의 다시 읽기를 한다. 그래도 안 되면 `sync_rejects`로 보낸다(S4c, 키마다 하나). 예산이
   떨어지면 나누기를 멈추고 나머지는 다음 실행에 둔다.
8. **0행도 실패다.** 부분 `U`가 `meta.changes = 0`이면(앞의 `I`가 거절됐거나 없는 행) 성공으로 치지 않고 같은
   실행 안에서 다시 읽는다. 조각모음 본문(S12)이 0행이면 다시 읽는다. Supabase에도 그 글이 없으면 고아로
   세고 닫는다. 조용히 건너뛰지 않는다.
9. **원문은 미룬다.** 실행마다 `sync_pending_raw`에서 2개까지(S13), 2 MB 이하로 받는다. 원문은 한 열만 고르고
   `Accept: text/plain`으로(또는 text를 돌려주는 service role RPC로) 받아 `await res.text()`를 그대로 묶는다(S13c,
   JSON.parse 없음). 받으면 줄에서 지운다(S13d). 줄은 워터마크를 막지 않는다. 그동안 D1 상세 어댑터는
   `post_history_course_file`이 없으면 Supabase로 돌아간다.
10. **워터마크.** `low_watermark`는 그 아래 모든 id가 적용됐거나 거절에 적혔고, `changed_at`이 5분보다 오래된 가장
    큰 id까지 올린다. 그 위에서 적용하거나 거절한 id는 `applied_above`에 둔다. 2,000개가 차면 `high_seen`을 멈춘다.
11. **기록과 경보.** `sync_state`에 실행마다 문장 수, subrequest 수, 원문 바이트, CPU(tail 이벤트의 `cpuTime`)를
    남긴다. 지연이 2분을 넘으면 알린다.
12. 하루 한 번 7일 지난 변경 로그를 지운다.

표별 대응:

| Supabase 표 | D1 행 | 파생 값 |
|---|---|---|
| `comments` | `comments`(`env`, `parent_id`, `meta` 뺌) | `threads` 댓글 쪽 재계산(옛 키와 새 키) |
| `comment_likes` | `comment_likes`(`id` 뺌) | `comments.like_count` 재계산 |
| `likes` | `likes`(`id`, `env`, `reaction_type` 뺌). `this-or-that:` 키도 보통 스레드 키로 복사한다(오늘과 같다) | `threads` 좋아요 쪽 재계산. 글·런의 수는 그 행의 변경으로 온다 |
| `this_or_that_post_likes` | `this_or_that_post_likes`(`id`, `env` 뺌). FK라 글 행 뒤에 둔다. FK 오류의 다시 읽기에서 Supabase 글이 다른 env에 있으면 `cross_env`로 세고 넣지 않으며 거절을 닫는다(2.2절, tasks/010 #70) | 없음. 글의 `like_count`는 그 글 행의 변경으로 온다 |
| `resource_reactions` | 같은 행 | 없음(합계 행이 따로 온다) |
| `resource_reaction_counts` | 같은 행(복사) | — |
| `community_stories` | 같은 행 | 없음 |
| 글 일곱 표 | `posts`(S7, `(service, id)`) + `post_<서비스>`(S7b) + 자식(S8, S9). `D`는 `(service, id)`(S10) | 수는 복사 |
| `runs` | `posts`(`service = 'history_course'`) + `post_history_course` + 원문은 S13 줄 | 수는 복사 |
| `this_or_that_post_votes`, `favorite_tournament_candidate_stats`, `favorite_tournament_plays`, `pagestorm_drafts` | 같은 행(`env`, 죽은 열 뺌) | 복사 |
| `defragment_bodies` | `(service, post_id) = (source_service, source_id)`, 글이 있을 때만(S12). 0행이면 다시 읽기, Supabase에도 글이 없으면 고아로 셈 | — |
| `profile_character_nickname_pools`, `puzzlebox_players` | 모든 D1에 같은 행 | — |
| `contact_inquiries`, `puzzlebox_runs`, `puzzlebox_best`, `puzzlebox_board_stats`, `colorful_philosopher_posts` | 같은 행(`env`, 죽은 열 뺌) | 복사 |

**파생 값은 Supabase 값을 복사한다**(계획 7.3): `posts`·런의 수, 투표 수, `play_count`, 후보 통계,
`resource_reaction_counts`, 퍼즐상자 상태. Supabase 열이 없는 값만 D1이 같은 행에서 센다: `threads`,
`comments.like_count`, `posts.summary`. 같은 행에서 세므로 Supabase가 매번 계산하는 값(`get_engagement_counts`,
HEAD count, `comment_likes(count)`)과 같다.

**매퍼는 값을 몰래 바꾸지 않는다.** `canonicalTs`가 `null`이면, JSON 꼴이 틀리면, CHECK에 걸리면 그 변경은
거절이다. 다른 값으로 채우거나 열을 버리고 넣지 않는다. 거절 이유(`sync_rejects.reason`)는 사람이 바로 알 수 있게
나눈다:

| 이유 | 뜻 | 처리 |
|---|---|---|
| `bad_timestamp` | `canonicalTs`가 `null`(무한대, 범위 밖, 꼴 틀림)이거나 D1이 값을 요구하는 곳의 NULL | 열어 두고 그때 사용자에게 묻는다. 사용자가 정한 일을 마칠 때까지 대조와 문턱은 실패다(3.1절) |
| `bad_element` | `resources`·`pool` 원소가 문자열 `type`, `id`를 가진 객체가 아니라 자식 행으로 나눌 수 없음 | 같음(3.1절) |
| `check`, `fk` | 그 밖의 CHECK·FK 오류(다시 읽어도 같을 때) | 열어 둔다 |
| `cross_env` | 다른 env 글에 단 이거 아님 저거? 좋아요 | 세고 넣지 않으며 저절로 닫는다 |
| `orphan` | 글이 없는 조각모음 본문 | 세고 넣지 않으며 저절로 닫는다 |
| `zero_rows`, `raw_fetch`, `supabase_4xx` | 0행 `U`, 원문 받기 실패, 미러 영구 거절(5.5절) | 다시 시도, 남으면 열어 둔다 |

손으로 만든 값의 거절은 기대 0이고(첫 복사가 센다, 5.2절), 4단계에 Worker가 모든 쓰기를 검증한 뒤로는 생기지
않는다.

**자기가 쓴 것 읽기**(계획 7.3): 1단계 쓰기 경로가 Supabase 쓰기에 성공하면 그 행을 D1에도 적용한다. 응답 전에
같은 요청 안에서 한다(`waitUntil`이 아님). 그래야 같은 사용자의 다음 요청(예: 지우기)보다 늦게 닿지 않는다.

- 넣기는 `ON CONFLICT DO NOTHING`이다. 동기화가 이미 더 새로운 행을 넣었으면 그것을 지키고, 지운 행은 같은 사용자의
  다음 요청보다 먼저 들어간다.
- 고치기는 사용자가 바꾼 열만 쓴다. 수 열(Supabase에서 복사하는 카운터)은 쓰지 않는다. 그래서 다른 사용자의 좋아요를
  담은 동기화 `U` 위에 옛 스냅샷을 덮지 않는다.
- 행은 쓰기 답(`return=representation`)에서, 없으면 그 행을 다시 읽어 얻는다. 런은 원문 없이 먼저 넣고 원문을
  줄 세운다(S13b).
- D1 적용이 FK나 CHECK로 실패해도 답은 Supabase 결과를 따른다. 예: 다른 사용자가 30초 전에 브라우저에서 바로 쓴
  이거 아님 저거? 글이 아직 D1에 없을 때 좋아요(투표, 댓글 좋아요, 월드컵 플레이도 같다). 실패는 로그만 남기고
  `sync_rejects`에 열지 않는다. 같은 행은 변경 로그에 있으므로 1분 동기화가 부모 글 뒤에 넣는다(4번의 순서). 이
  적용에는 `PRAGMA defer_foreign_keys`를 쓰지 않는다. 미뤄도 커밋 때 같은 FK로 실패하고, 부모 없는 행을 넣는
  길이 되어서는 안 된다.

**구현과 켜는 순서**(2026-11-08, `workers/sync/`). 코드는 `run-sync.ts`(cron), `read-after-write.ts`(쓰기 경로 29개가
부르는 도우미), `supabase-reads.ts`, `sync-sql.ts`. 시험은 `pnpm test:d1-sync`의 `d1-sync-cron`, `d1-read-after-write`,
`d1-sync-pglite`(실제 변경 로그 트리거 → 동기화 = 마지막 상태의 첫 복사).

- 스위치 둘: Worker 변수 `API_RUNTIME_FLAGS=d1`, D1 `runtime_flags`의 `sync.enabled = on`. 하나라도 아니면 cron은
  아무것도 하지 않는다(운영은 `off`라 D1도 읽지 않는다). 자기 쓰기 읽기도 같은 플래그를 본다(isolate가 30초 기억).
- 비밀 하나: `API_SUPABASE_SECRET_KEY`(`sb_secret_…`). 변경 로그 읽기, 다시 읽기, 원문, 7일 지우기에만 쓴다.
- cron: `wrangler.jsonc` 기본·testbed `triggers.crons = ["* * * * *"]`.
- 켜기(testbed 먼저, 운영은 승인 뒤 `--confirm-production`):
  1. `wrangler secret put API_SUPABASE_SECRET_KEY --env testbed` 뒤 배포.
  2. 첫 복사가 `W0`를 넘긴다. `L0`는 Supabase에서
     `select coalesce(min(id), W0 + 1) from public.d1_change_log where changed_at >= (select changed_at from public.d1_change_log where id = W0) - interval '5 minutes'`
     (`W0 = 0`, 빈 로그면 `L0 = 1`).
  3. `pnpm sync:state start --l0 <L0> --env testbed --remote`: `low_watermark = high_seen = L0 - 1`. `sync.enabled`가
     on이면 거부한다. `sync_state` 행이 없으면 cron은 `not_started`로 끝난다(리스 행도 만들지 않는다).
  4. `pnpm flags set sync.enabled on --env testbed --remote --note "…"`.
  5. 끄기는 `pnpm flags set sync.enabled off …`. 창은 남고, 7일 안에 다시 켜면 이어서 읽는다.
  6. 보기: `pnpm sync:state show --env testbed --remote`(창, 실행마다 문장·subrequest·원문 바이트, 지연, 실패, 열린 거절,
     원문 줄).
- 설계가 열어 둔 곳에서 고른 것:
  - 새 행과 창 다시 읽기를 머리줄 읽기 하나로 합쳤다(`id > low_watermark`, `not.in.(applied_above)`, 100개). 그 뒤
    본문 읽기 하나, 5분 규칙의 기준 id 읽기 하나(`changed_at < now - 5분`인 가장 큰 id, env 무관). 로그 읽기는 최대 3번,
    subrequest는 최대 16번이다.
  - `applied_above`가 1,900개를 넘으면 `id <= high_seen`만 읽는다(2,000개 CHECK 안).
  - 첫 batch가 제약 오류로 실패하고 나눌 예산이 없으면 `last_error = split:<첫 id>:<개수>`를 남기고, 다음 실행이 그
    조각을 통째로 다시 하지 않고 반부터 나눈다. 없으면 매 실행이 같은 batch에서 실패해 워터마크가 멈춘다.
  - 제약 오류(FK, CHECK)만 나누고, 그 밖의 D1 오류는 그 실행을 멈추고 `fail_count`, `last_error`만 남긴다.
  - 원문 받기 실패는 `sync_pending_raw.attempts`, `last_error`에 적고 줄 끝으로 보낸다. `sync_rejects.ref`에 넣을
    변경 로그 id가 없어 거절 행은 만들지 않는다. 빈 답(그 env에 런이 없음)이면 줄에서 지운다.
  - 0행 `U`와 고아 본문은 batch가 커밋된 뒤 다시 읽어 정한다. 그 사이에 실행이 죽으면 그 한 변경은 일일 대조가 찾는다.
  - 7일 지우기는 UTC 19:00(한국 04:00) 실행에서, 그 D1의 `low_watermark` 이하이고 자기 env나 env null인 행만.
  - 리스 55초, Supabase 호출 마감 40초. 지연 2분 초과는 Worker 로그 한 줄(`sync lag_ms=…`)로 알린다. `last_cpu_ms`는
    tail 소비자가 없어 0으로 남는다.
  - 자기 쓰기 읽기: 요청마다 D1 문장 20개, 쓰기 답은 256 KB까지 복제본에서 읽는다(그보다 큰 글은 동기화가 가져온다).
    서버가 id를 만드는 쓰기(문의, 런 하나 올리기, 월드컵 플레이, 퍼즐상자)는 그 사용자의 가장 최근 행을 service 키로
    다시 읽는다. 필터로 여러 행을 고치는 둘(문의 읽음, 기증자 닉네임)은 같은 필터의 D1 문장 하나다. 고치기는 답의
    행에서 키와 복사 카운터를 뺀 열을 쓴다.

### 5.4 일일 대조(GitHub Actions)

- 매퍼(Supabase 원본 표)마다 양쪽의 모든 행을 읽어 한 함수로 정규화한다(env와 죽은 열 빼기, 시각 `canonicalTs`,
  참/거짓, JSON은 키를 정렬해 다시 씀, `rank_history[].at`도 `canonicalTs`). 행마다 한 줄을 만들고, 줄을 **작업 안에서
  바이트 순서로 정렬해** sha-256을 낸다. `ORDER BY`에 기대지 않는다. Postgres는 글자 키(`likes.story_id`의 `:`,
  `-`, `_`, 런 id, 자원 id, `board`)를 DB 정렬 규칙으로, SQLite는 BINARY로 정렬해 같은 데이터라도 해시와 병합
  비교가 어긋난다. 결과는 `sync_checks`에 원본 표, D1 표, 종류마다 한 행.
- 매퍼마다 Supabase 쪽 쿼리를 정해 둔다:
  - `comment_likes`: env가 없으므로 `comments!inner(env)`로 부모 댓글의 env를 걸러 읽는다.
  - `defragment_bodies`: 글이 있는 본문만 비교한다. 2~4단계에 Supabase 글을 지우면 본문이 고아로 남고 D1은 연쇄로
    지운다. 고아는 "알려진 종류"로 수만 적고 날을 실패시키지 않는다.
  - `likes`: 같은 이름의 표끼리 비교한다.
  - `this_or_that_post_likes`: 같은 이름의 표끼리 비교한다. Supabase 쪽은 `this_or_that_posts!inner(env)`로 읽고
    `env=eq.<env>&this_or_that_posts.env=eq.<env>`로 부모 글과 env가 같은 좋아요만 비교한다. 다른 env의 글에 단
    좋아요는 `cross_env` "알려진 종류"로 수만 적고 날을 실패시키지 않는다(2.2절, tasks/010 #70).
  - 글 일곱 표와 `runs`: D1 `posts`를 `service`로 나눠 각 표와 `(service, id)`로 비교한다.
  - D1에만 있는 열은 `rows`에서 뺀다: `posts.summary`, `comments.like_count`, `threads` 전체, 런의 요약 열과 `badges`
  (D1이 원문에서 만든다. 아래 요약 비교가 본다).
  - 5단계의 testbed는 env 없는 표(`puzzlebox_players`, `profile_character_nickname_pools`)를 비교하지 않는다(5.5절).
- 파생(`derived`): `threads` 대 D1 행 재계산과 `rpc/get_engagement_counts`(같아야 한다), `comments.like_count` 대
  재계산. 글·런 수 대 `threads`(이거 아님 저거? 좋아요 수는 `this_or_that_post_likes` 행 수)는 참고만 한다
  (문턱을 막지 않음). Supabase의 델타 트리거가 어긋난 곳(런을 내렸다 다시 올린 경우, tasks/010 #68)이 그대로
  보인다. 2~4단계에는 고치지 않는다(10.1절).
- 런 원문은 양쪽 sha-256으로 비교한다. 요약 열은 Supabase 원문을 프로젝트 코드로 다시 읽어 비교한다. 목록이 요약
  열로 만드는 것(자동 표지, 검색 문구, 강조 카드·유물, 인기 요소, 배지 `badges` 대 원문의 `mergePartyBadges`, 파티
  캐릭터 `characters`)이 원문으로 만든 것과 같은지도 본다(4.4절). 다르면 그날은 실패이고, 그때 사용자에게 묻는다
  (첫 복사 검사와 같은 처리). 옛 탭이 올린 런, 파서나 `mergePartyBadges`가 바뀐 경우가 여기서 잡힌다.
- 같은 작업이 요약 채우기를 먼저 돈다(4.4절). 그 뒤 `summary_version = 0`인 런 수를 보고한다(기대 0).
- 열린 거절이나 행 차이가 있으면 그날은 실패다. 손으로 만든 값의 거절(3.1절)은 사용자가 그 행을 어떻게 할지 정하고
  그 일을 마칠 때까지 실패다. 그 행은 Supabase에만 있으므로, 거절을 닫기만 해서는 `rows` 차이와 `derived` 차이가
  남는다. D1 읽기는 하루 모든 행 한 번(1만 안팎)이다.

### 5.5 5단계 미러(D1 → Supabase)

- 쓰기 batch가 `outbox` 행을 같은 batch에 남긴다. 미러는 쓰기 뒤 `ctx.waitUntil`과 1분 cron에서 `seq` 순서로
  보내고, `env = API_DATA_ENV`를 붙이고, 받아들여진 행을 지운다.
- **오류 종류.** 일시 오류(5xx, 시간 초과)는 순서를 지켜 멈추고 다음에 다시 보낸다. 영구 거절(23503, 23514 같은
  4xx)은 그 행을 `sync_rejects('out')`로 옮기고, `(table_name, match_key)`가 같지 않은 다음 행은 계속 보낸다
  (`(table_name, match_key)`가 같은 뒤 행은 그 거절 뒤에 선다). 같은 id가 두 글 표에 있을 수 있으므로 `match_key`
  하나로 묶지 않는다. 열린 거절 키 `sync_rejects_open_key (direction, table_name, row_key)`와 같은 기준이다. 그래서
  거절 하나가 outbox 전체를 멈추지 않는다. 2단계로 되돌리려면 열린 `out` 거절이 0이어야
  한다.
- 원본 행만 보낸다. `threads`, `comments.like_count`, 수 열, `resource_reaction_counts`는 보내지 않는다.
  Supabase 트리거가 다시 계산한다(보내면 두 번 센다).
- **큰 문서는 outbox에 넣지 않는다.** 런 원문은 JSON 문자열로 넣으면 이스케이프로 10~30% 커져, CHECK가 받는
  1.75 MB 원문도 2 MB 행 한도를 넘는다. 그러면 같은 batch의 공유 전체가 실패한다. 그래서 런 outbox 행은
  `{id}`와 `{"read": "post_history_course"}`만 갖고(R14d), 미러가 보낼 때 S14로 D1에서 읽는다. 행이 없으면
  (뒤에 지웠으면) 지우기만 보낸다. 원문은 text/plain 본문을 받는 service role RPC로 이스케이프 없이 보낸다.
  원문을 두 번 저장하지도 않는다. 큰 글 본문(서류 폭풍, 티어표)도 같은 방식이다.
- 예외 둘:
  - 월드컵 플레이: 새 service role 전용 함수 `mirror_favorite_tournament_play(...)`를 부른다(`op = 'rpc'`). 이 함수는
    플레이 행을 넣고(본 적 있는 플레이 id는 무시) `play_count`만 다시 센다. 후보 통계는 D1이 계산한 행(S15)을
    기본키로 상태 upsert한다. Supabase는 통계를 다시 계산하지 않는다. 두 곳에서 계산하면 `rank_history[].at`이
    미러 지연만큼 다르고(Postgres는 미러 때의 `now()`), 동률 순서가 DB 정렬 규칙(덤프에 안 보임)과 BINARY로 달라
    `current_rank`가 다르다. 그러면 5단계 대조 일치 문턱에 닿을 수 없다. 4단계에는 아직 Supabase가 원본이라
    오늘의 RPC가 통계를 계산하고 D1이 복사한다.
  - 퍼즐상자 `puzzlebox_players`, `puzzlebox_best`, `puzzlebox_board_stats`: 상태로 upsert한다. 이것을 다시 만드는
    Supabase 트리거가 없어 두 번 셀 일이 없다. 5단계 마이그레이션에서 `puzzlebox_runs.id`를 `GENERATED BY
    DEFAULT`로 바꿔 D1의 난수 id를 넣을 수 있게 한다.
- **문의 트리거(4단계 전 마이그레이션).** `contact_inquiries_rate_limit`은 `WHEN`이 없는 BEFORE INSERT 트리거라
  모든 역할에 돈다. 함수의 첫 줄이 `new.user_id is distinct from (select auth.uid())`면 예외다. 미러와 4단계
  Worker는 service 키로 쓰므로 `auth.uid()`가 NULL이고, 로그인한 사용자의 문의는 매번 42501로 거절된다. 그래서
  service 키로 문의를 쓰는 첫 단계 전(4단계 Worker 쓰기 전)에, `docs/RELEASE_PROCESS.md`를 따라 되돌리기
  스크립트와 함께 올린다:

  ```sql
  DROP TRIGGER contact_inquiries_rate_limit ON public.contact_inquiries;
  CREATE TRIGGER contact_inquiries_rate_limit
    BEFORE INSERT ON public.contact_inquiries
    FOR EACH ROW
    WHEN (CURRENT_USER = ANY (ARRAY['anon'::name, 'authenticated'::name]))
    EXECUTE FUNCTION public.enforce_contact_inquiry_rate_limit();
  ```

  보호 트리거와 같은 `WHEN`이다. `WHEN`은 SECURITY DEFINER 함수 밖에서 평가되므로 `CURRENT_USER`가 부른 역할이다.
  (함수 안에서 건너뛰려면 `(select auth.role()) = 'service_role'`을 본다. 함수 안의 `current_user`는 늘
  `postgres`다.) 이 트리거를 건너뛰는 행이 잃는 것: trim과 소문자 바꾸기는 Worker가 D1에 넣기 전에 이미 한다.
  시간당 3건은 D1의 C1이 지킨다. 미러 지연으로 Supabase 쪽 창이 3건을 넘을 수도 없다. 먼저 미러된 행의
  `created_at`이 더 이르다.
- **미러되는 표마다 Supabase 트리거를 미리 통과시킨다.** testbed에서 4·5단계 시험: service role로 `user_id`가 있는
  문의를 넣으면 성공해야 한다. 더 넓게, 미러하는 표마다 service role 쓰기 하나를 모든 Supabase 트리거에
  통과시켜, 거절이 outbox에 쌓이기 전에 드러나게 한다.
- `this_or_that_post_likes`는 같은 이름의 Supabase 표로 보낸다. 사용자의 좋아요 넣기와 취소는 outbox 한 행씩이다
  (TL1, TL2, 4.3절). 글 지우기는 양쪽 모두 FK 연쇄로 그 좋아요를 지우므로, 글 지우기 때 연쇄로 지워지는 좋아요의
  outbox 행은 만들지 않는다. 없는 글의 좋아요는 D1 batch가 먼저 거절해 outbox에 닿지 않는다.
- **env 없는 표.** `puzzlebox_players`와 `profile_character_nickname_pools`는 운영 Worker만 Supabase로 미러한다.
  testbed는 자기 D1에만 둔다. 둘 다 미러하면 Supabase 한 행을 두 원본이 덮어 운영 일일 대조가 testbed 사용으로
  깨진다. 풀과 `hidden`을 쓰는 관리자 스크립트는 모든 D1과 Supabase에 쓴다.
- 지우기는 늘 소유자를 match에 넣는다. 거절된 지우기의 outbox 행이 남의 행을 지울 수 없다.
- 모든 호출은 다시 보내도 같다(중복 무시 insert, 키로 지우기, 같은 값 upsert).
- 마이그레이션 목록(5단계): `mirror_favorite_tournament_play`, `puzzlebox_runs.id` `GENERATED BY DEFAULT`, 런 원문
  text RPC. 4단계 전(service 키로 문의를 쓰는 첫 단계 전): 문의 트리거 `WHEN`.
- **5단계에서 되돌릴 때**(testbed에서 시험한 스크립트로): 쓰기를 멈추고, outbox를 비우고(열린 `out` 거절 0),
  원본 플래그를 돌린다. 그 뒤 워터마크만 옮기지 않는다. 5단계 동안 D1이 직접 센 파생 값(`posts` 수, 투표 수,
  `play_count`, 후보 통계, `resource_reaction_counts`)과 Supabase 트리거·RPC가 만든 값이 다르고, 그 Supabase 쪽 `U`
  행을 건너뛰게 되기 때문이다. 그래서 첫 복사를 다시 한다(5.2절 다시 채우기: 잎부터 `DROP`, DDL, 복사, 새 `W0`).
  Supabase가 원본일 때는 계획이 이것을 허용한다. 되돌린 뒤 후보 통계는 Supabase 값이 된다.

## 6. 그림자 읽기 대조

샘플된 `api` 요청에서 Worker는 오늘처럼 Supabase로 답하고, `ctx.waitUntil`에서 D1 어댑터를 돌려 두 답을
정규화해 비교한다. 결과는 `shadow_stats`, 다른 점은 `shadow_diffs`(8 KB까지). 샘플 비율은 그룹마다
`runtime_flags`의 `shadow.<group>`(0~1)이다. 값이 없으면 0이고, Worker는 값을 0~1로 자른다.

D1 어댑터가 답을 다시 만드는 규칙:

- 오늘 객체와 같은 키, 같은 순서. 시각은 `postgrestTs`(바이트가 같다). 0/1은 `true`/`false`, NULL은 `null`.
  JSON 열은 문자열이 아니라 JSON으로 넣는다(큰 문서는 파싱하지 않고 문자열로 이어 붙인다, CPU 10 ms).
- `env`는 `API_DATA_ENV`로 넣는다. 이거 아님 저거? `vote_rate_bps`는 Postgres와 같은 정수 나눗셈으로 계산한다.
  `resources`, `pool`은 자식 행을 `ord` 순서로 배열로 만든다. 런의 작성자 토큰 열은 `null`이다.
- 조각모음 행의 `history_meta`는 런이면 `{cover_spec, win, ascension, total_floors}`, 아니면 `null`.
- 글은 경로의 서비스와 id로 `(service, id)`를 찾는다.

| 1단계 답 | D1 출처 | 비교 |
|---|---|---|
| `read.engagement`(스레드, 좋아요, 반응, 철학자) | E1, E3, E5, F1 | 동률 묶음 정렬 뒤 바이트 비교 |
| `me.engagement` | E2, E4, E6 | 목록은 집합으로 |
| `read.engagement-counts` | E7 | 맵으로 |
| 런 참여 수, 철학자 답글 수 | E3, R6 | 맵으로 |
| `read.stories` | E10, E10b | 값으로(통과 응답이라 jsonb 띄어쓰기가 다르다) |
| `read.nav` | E8, E9, F4 | `fetchedAt` 빼고 값으로 |
| 장난감 상자 피드, 조각모음, 글 하나, 서류 폭풍, 초안, 본문 | T1~T14 | 값과 순서로 |
| 월드컵 통계, 이거 아님 저거? 수·내 좋아요·내 투표 | T10, T15~T18 | 집합으로(Postgres에 ORDER BY가 없다) |
| 역사 강의서 목록, 고르기, 상세, 표지 | R1~R5 | 원문을 뺀 같은 쿼리를 양쪽에 보내 값으로. 원문은 일일 대조가 해시로 |
| 프로필 활동·통계 | P2, P3 | 값으로, 통계는 범주별 집합 |
| 문의, 퍼즐상자, 철학자 | C2, C3, X2, X4, F1~F5 | 값으로. 내 순위는 보드별 집합 |
| 쓰기 경로 | — | 2단계에는 비교하지 않는다(쓰기는 Supabase로 가고 5.3절이 D1에 적용) |

비교할 수 없는 것과 처리:

1. **같은 정렬 값 안의 순서.** Postgres 목록 다수에 동률 정리가 없다. D1은 `id`를 더한다. 동률 묶음은 집합으로,
   `LIMIT` 경계의 동률 묶음은 개수로 비교한다. 조각모음의 uuid와 런 id 동률은 Postgres 정렬 규칙이 다를 수 있어
   집합으로 본다.
2. **jsonb 텍스트 꼴**(띄어쓰기, `1.50` 대 `1.5`): 파싱한 값으로 비교한다.
3. **죽은 열**: 철학자 `buff_count`·`nerf_count`·`rework_count`(굳은 값, 2행이 0이 아니다), 변형
   `source_game_locale`, 월드컵 `game_version`. Supabase 쪽에서 빼고 비교한다.
4. **Supabase 카운터 어긋남**: 목록의 수(`posts.like_count` 복사)와 상세의 수(`threads`, 행 수)가 Supabase에서
   이미 다른 곳(tasks/010 #68). 2~4단계에는 D1도 Supabase 수를 복사하므로 같은 경로의 두 답은 같고, 그림자
   대조에서 차이가 나지 않는다(10.1절).
5. **고아 본문**: 지운 글의 조각모음 본문은 Supabase에서 나오고 D1에서는 `[]`다. 그 id의 글이 Supabase에 없으면
   예상된 차이다.
6. **응답 상한**: PostgREST의 1 MiB 흐름 상한과 1000행 상한에 걸린 답은 건너뛰고 `skipped`로 센다.
7. **동기화 지연**: 다른 행이 최근 2분 안의 것이면 2분 뒤 한 번 더 비교한 뒤 센다.
8. **역사 강의서 자동 표지**: 두 쪽 모두 저장된 `cover_spec`과 요약 열을 주고, 자동 표지는 브라우저가 고른다
   (4.4절). 그림자 비교는 원문을 뺀 같은 열 단위라 차이가 없다. `summary_version` 0 런(2~4단계에 새로 올라와
   아직 요약 채우기를 거치지 않은 런)은 D1 목록이 그 런만 원문을 받아 오늘처럼 계산한다(4.4절).
9. **손으로 만든 값의 거절 행**: 그 행은 Supabase에만 있어, 그 행이 들어간 답(목록, 수, 참여 지도)이 D1과 다르다.
   알려진 종류로 빼지 않고 차이로 센다. 사용자가 그 행을 어떻게 할지 정하고 그 일을 마칠 때까지 그림자 대조와 단계
   문턱은 실패다(3.1절).

## 7. 옮기지 않는 것

| 객체 | 이유 |
|---|---|
| 모든 `env` 열, env CHECK, env로 시작하는 색인 | 결정 1 |
| `nav_indicators`, `debate_cycles` | CLEANUP 3.1 |
| `colorful_philosopher_reactions`, 트리거, `apply_colorful_philosopher_reaction_counts`, 정책 4개 | CLEANUP 3.1. 행은 이미 `resource_reactions`에 있다 |
| `defragment_posts`, 정책 4개, 색인 4개, 보호 트리거, Realtime 등록, 카운터 트리거의 `defragment` 분기 | CLEANUP 3.1. 행이 한 번도 없었다. `service=defragment` 읽기는 D1 어댑터가 쿼리 없이 `[]`로 답한다 |
| `comments.parent_id`(+ 자기 FK), `comments.meta` | 읽는 곳 없음 |
| `likes.reaction_type`(+ CHECK, 색인) | 늘 기본값 |
| `likes.id`, `comment_likes.id`, `this_or_that_post_likes.id` | 읽는 곳 없음. 자연 키가 기본키 |
| `this_or_that_post_likes`의 카운터 트리거, 뷰 `this_or_that_post_like_counts` | 표는 옮긴다(2.2절). 트리거는 재계산(E13c)으로, 뷰는 수 읽기(T15)로 |
| `this_or_that_posts.vote_rate_bps`와 색인 둘 | 읽는 곳 없음. 대조 동안만 어댑터가 계산 |
| `this_or_that_post_votes.created_surface`, `transfigure_posts.source_game_locale`, `favorite_tournament_posts.game_version` | 쓰기만 함. Supabase에서 NOT NULL이라 미러가 요청 값이나 기본값을 채운다 |
| `runs.highlight_card`, `highlight_relic`, `note_blocks` | 쓰기만 함. 목록은 강조를 원문에서 다시 골랐고, 이제 `list_facts`의 id로 고른다(4.4절). `badges`는 목록에 보이므로 남긴다 |
| `contact_inquiries.viewport_width`, `viewport_height` | 쓰기만 함 |
| `colorful_philosopher_posts.buff_count`, `nerf_count`, `rework_count` | 굳은 값 |
| `defragment_bodies.source_service` | `posts.service`와 같다 |
| 함수 `get_story_reaction_counts`, `get_this_or_that_vote_totals`, `get_defragment_feed`(v1) | 부르는 곳 없음 |
| 나머지 RPC 12개, 트리거 함수 전부 | Worker TypeScript + SQL로(4절) |
| 정책 `favorite_tournament_plays_read`, `puzzlebox_runs_read_own`, `defragment_posts_insert`, RLS 전체 | Worker 검사. 플레이 공개 읽기가 없어져 tasks/010 #67이 고쳐진다 |
| Postgres 색인 114개 | 쿼리에서 다시 끌어냄(이름 있는 색인 25개) |
| `surface_latest`(계획 5.1) | 색인 조회와 `api_cache`의 네비 스냅샷이 대신한다 |

## 8. 비용 추정

D1은 읽은 행(색인 행 포함)으로 센다. 무료는 계정에 하루 읽기 500만, 쓰기 10만이다. 하루 호출 수는 조사 문서의
운영 수치(2026-11-07)다.

| 화면 | 쿼리 | 한 번에 읽는 행 | 하루 호출 | 하루 행 |
|---|---|---|---|---|
| 네비 스냅샷 갱신(배달원 포함) | E8 + E9 ×8 + F4 | 약 42 | 최대 1,440 | 약 6만 |
| 참여 지도(이야기 피드, 카드 목록, 몬스터 타일, 베타 아트) | E7 | 약 270(스레드 수) | 약 120 | 약 3.3만 |
| 이야기 피드 | E10 | 약 52(지금 26개) | 약 200 | 약 1만 |
| 백과사전 상세(댓글, 수, 반응, 철학자 글) | E1, E3, E5, F5 | 약 6~15 | 약 440 | 약 0.5만 |
| 이아저? 월드컵 목록과 기본 대회 | T5, T9 | T5는 서비스 글 약 100 + 쪽에 보이는 20개 대회의 풀. T9는 기본 대회 풀 전체(최대 약 3,000) | 10~30 | 최대 9만 |
| 장난감 상자 피드 한 쪽 | T1~T3 | 약 60~80 | 약 43 | 약 0.3만 |
| 조각모음 한 쪽 | T6 | 약 60 | 약 9 | 1천 미만 |
| 역사 강의서 목록(`game_elements` 포함) | R1 | 약 400 | 약 14 | 약 0.6만 |
| 런 상세 | R3, R3r | 3 | 수십 | 1천 미만 |
| 프로필 | P2, P3 | 내 행 수십 | 약 5 | 1천 미만 |
| 문의, 퍼즐상자, 철학자 | C, X, F | 수십 | 적음 | 수천 |
| 일일 대조 | 모든 행 | 약 1만 | 1 | 약 1만 |

- 합계는 하루 약 21만 행, 무료 한도의 약 4%다. 가장 큰 항목은 기본 대회 풀(최악)과 네비 스냅샷(최악)이다. T5는
  검토에서 풀을 정렬 뒤에 만들게 바꿔, 쪽에 보이지 않는 대회의 풀은 읽지 않는다.
- 2단계 그림자 읽기는 샘플된 요청만큼 같은 읽기를 한 번 더 한다. 100%로 켜도 약 8%다.
- 역사 강의서 목록은 `game_elements`와 `list_facts`를 함께 주므로(10.4절) 읽는 행은 그대로이고 답만 크다. 100개에
  약 0.6 MB(570~620 KB), 오늘 원문 포함 약 7.9 MB다(4.4절). 어댑터는 이 두 JSON 열을 파싱하지 않고 문자열로 이어
  붙여 CPU 10 ms 안에 둔다(6절). testbed에서 이 답의 CPU를 잰다. HTML 첫 데이터 상한(128 KB)과의 관계는 4.4절.
- 쓰기:
  - 1분 동기화의 리스와 실행 기록이 DB마다 하루 약 3천 행(두 DB 약 6천).
  - 앱 쓰기는 댓글 하나가 약 7행(행 + 색인 4 + `threads` + 글 수), 좋아요가 약 4행이라 하루 1천 행 아래다. 월드컵
    순위 다시 매기기가 가장 크다(바뀐 행만 써서 오늘의 전체 다시 쓰기보다 적다).
  - 그림자 장부: 샘플 비율 r에서 S5가 약 r × (하루 /api 읽기, 측정 5천~1만) 행을 쓴다. S6은 다른 점이 나온 비교마다
    1행, 그날 처음 보는 해시면 2행이다. 100%로 켜도 하루 최대 약 2만 행이다. 동기화, `api_cache` 네비 임대(DB마다
    3천 이하), 앱 쓰기를 더한 하루 합계는 약 3.5만 이하, 한도의 35% 아래다. 트래픽이 늘어 r=1.0이 부담되면 S5를
    isolate 메모리에서 (날, 경로)별로 모아 1분에 한 번 같은 upsert로 쓴다(이미 더하기다). S6은 그대로 둔다.
  - 첫 복사는 DB마다 약 3만 행이다. 다시 채우기는 잎부터 `DROP` + 첫 복사라 다시 약 3만 행이다(`DELETE`로 비우면
    6만 행을 넘는다, 5.2절). 채우는 날은 그림자 샘플을 0으로 두고, DB마다 다른 날에 한다.
- 실행당 한도(Workers Free): 1분 동기화는 5.3절 예산(D1 문장 45, subrequest 14 안팎, 원문 2 MB)을 지킨다. 5단계
  런 공유는 요청마다 4문장이다(4.4절).

## 9. 검증

[d1-schema/](d1-schema/)에 있다. 저장소 루트에서 다시 확인한다:

```bash
python3 -I docs/supabase-exit/d1-schema/gen_schema.py docs/supabase-exit/d1-schema/schema.src.sql d1/migrations
python3 -I docs/supabase-exit/d1-schema/check.py docs/supabase-exit/d1-schema d1/migrations
python3 -I docs/supabase-exit/d1-schema/check-local-d1.py docs/supabase-exit/d1-schema
```

- `schema.src.sql`: 전체 DDL의 원본. `-- migration:` 구역마다 `gen_schema.py`가 `@UUID@`, `@TS@`, `@DATE@`를 GLOB로 펴서
  `d1/migrations/0003_*.sql`~`0006_*.sql`을 쓴다. DDL은 이 파일에서만 고친다. 원격 DB에 올린 마이그레이션은 바꾸지 않고
  새 구역을 더한다.
- `fixtures.sql`: 대표 행, 대량 행, 지우기 연쇄 검사(실패하면 CHECK 오류로 멈춘다). 이거 아님 저거? 글을 지우면(TW3)
  투표와 좋아요가 FK 연쇄로 지워지는지 본다. 같은 id의 두 서비스 글이 두 행이고, 하나를 지워도 다른 글과 그
  서비스 행이 남는지 본다.
- `queries.sql`: 쿼리 128개. 머리줄에 기대 색인과 허용 예외가 있다.
- `check.py`: 먼저 `gen_schema.py --check`로 마이그레이션 파일이 `schema.src.sql`과 같은지 본다(다르면 실패). 임시 폴더의
  빈 `check.db`에 `d1/migrations`의 `0001`~`0006`을 차례로 `PRAGMA foreign_keys=ON`으로 올리고, 고정 행을
  넣고, CHECK·FK 검사 30개를 돌리고, 쿼리마다 `EXPLAIN QUERY PLAN`을 통계 없이 한 번, `ANALYZE` 뒤 한 번 본다.
  쿼리도 실제로 실행한다(쓰기는 savepoint 안에서 되돌림). 결과는 `plans.txt`.
  - 새로 더한 검사(막아야 함): 꼴이 틀린 서비스 이름, `high_seen < low_watermark`, 같은 키의 두 번째 열린 거절, 다른
    서비스 글 밑의 서비스 행(FK), 다른 서비스 값의 `service` 열(CHECK), 없는 글의 이거 아님 저거? 좋아요(FK), 같은
    `(service, id)`의 두 번째 행, 1024 바이트를 넘는 런 id, 객체가 아닌 `list_facts`. (받아야 함): 빈 스레드 키,
    모르는 새 서비스의 글, 다른 글의 uuid와 같은 런 id.
  - 고정 행에 닫힌 `cross_env` 거절 한 행이 있다(키마다 하나 규칙은 열린 거절에만 걸린다).
- `check-local-d1.py`: 같은 계획을 로컬 D1(workerd의 SQLite)에서 읽는다. 임시 `--persist-to` 폴더에 `0001`~`0006`과
  `fixtures.sql`을 올리고(기본 로컬 D1과 원격은 건드리지 않는다), 쿼리마다 매개변수를 값으로 바꿔 `EXPLAIN QUERY PLAN`을
  `wrangler d1 execute --local --file --json` 한 번으로 돌려 `detail` 줄을 `check.py`의 `judge()`에 넣는다(`ANALYZE` 뒤에 한
  번 더). 결과는 `plans-local-d1.txt`이고, `plans.txt`와 계획이 다른 쿼리를 두 계획과 함께 적는다. 값으로 바꿔도
  3.51.0에서는 계획이 하나도 바뀌지 않는다(확인).

규칙: 기대한 색인을 써야 한다. 일반 표를 그냥 훑으면(`SCAN t`), `ORDER BY`에 임시 B-tree를 쓰면, `LIMIT` 없이
색인 전체를 걸으면 실패다. `service` 앞부분만 쓰는 기본키 검색(`SEARCH t USING PRIMARY KEY (service=?)`)도 훑기로
본다. 서비스 표와 자식 표의 기본키가 모두 상수 `service`로 시작해, 계획이 나빠지면 `SCAN`이 아니라 이 꼴로 나오고
그 서비스의 행을 다 읽기 때문이다. 보조 색인의 `(service=?)` 검색은 순서대로 걷는 것이라 `LIMIT`이 있을 때만
받는다(피드가 `posts_service_*`를 20행까지 걷는다). 서비스 범위를 일부러 읽는 T4(`t`), T5(`p`, `f`)만
`allow=svcrange:<별칭>`을 둔다. (확인: T15를 `+post_id IN ...`으로 바꾸면 이 규칙으로 실패한다.) 아래 예외만
머리줄에 허용을 적었다.

| 쿼리 | 색인을 다 쓰지 못하는 것 | 이유 |
|---|---|---|
| E7 참여 지도 | `threads` 전체 | 표 전체가 답이다. 3단계에 범위 읽기(E7s, E7t)를 더한다 |
| T4 이거 아님 저거? 투표순 | 서비스 글 전체 + 임시 정렬 | 4.3절. 정렬 수가 서비스 표에 있다 |
| T5 이아저? 월드컵 플레이순 | 같음 | 같음. 풀은 정렬 뒤 20개만 |
| T9 기본 대회 | 기본 대회 몇 개의 임시 정렬 | 기본 대회는 수십 개다 |
| TW5d 순위 다시 매기기 | 한 대회 후보의 창 함수 정렬 | 1,000행 이하, 플레이당 한 번 |
| P2, P3 프로필 | 내 행의 합집합 정렬·묶기 | 세 출처를 합치고 오프셋으로 넘긴다. 행은 수십 개 |
| X2 리더보드 | 유효 보드의 최고 기록 묶기·정렬 | 순위 창 함수에 그 행이 다 필요하다 |
| P1 닉네임 풀 | 10행 전체 | 표 전체가 답 |
| C5a 관리자 문의함 | 문의 전체 | 로컬 스크립트, 11행 |

이 밖의 116개는 두 번 모두 의도한 색인으로만 읽고, 피드(T1~T3, T6, T7, T11, E8, E10, R1, R2)는 임시 정렬이
없다.

구현 때 더할 시험(SQLite 밖, Worker와 스크립트):

- 동기화: (1) 5분 안에 100행이 넘는 폭주(운영 행 수백 개가 한 번에 바뀌는 꼴)에도 다음 실행이 새 행을 읽는다. (2) 거절된
  id 뒤로 꾸준한 변경이 이어져도 워터마크가 오른다. (3) 한 창에 런 넣기 100개와 32후보 월드컵 플레이 하나가 있을
  때 cron 실행마다 D1 쿼리 50개, subrequest 50개 이하이고 워터마크가 계속 오른다. (4) 거절 다시 시도가 옛 이미지를
  덮지 않는다(`U` 거절 뒤 새 `U`가 적용되고, 다시 시도는 Supabase 지금 행을 쓴다).
- 5단계 미러: 서로 다른 글 표의 같은 id 두 outbox 행에서, 앞 행이 영구 거절되어도 뒤 행(다른 표)은 보내진다.
  같은 `(table_name, match_key)`의 뒤 행만 기다린다. 좋아요 취소(TL2)가 outbox 지우기 행을 남긴다.
- 동기화 거절 이유: 손으로 만든 시각(`'infinity'`, NULL)은 `bad_timestamp`, `type`이 없는 `resources` 원소는
  `bad_element`로 열린 채 남고, 다른 env 글의 이거 아님 저거? 좋아요는 `cross_env`로 세고 닫힌다(3.1절, 5.3절).
- 런 요약: 운영과 testbed의 모든 런에서 목록이 요약 열로 만든 자동 표지, 검색 문구, 강조 카드·유물, 인기 요소,
  배지, 파티 캐릭터, 검색 결과가 원문으로 만든 것과 같다(4.4절). 첫 복사 검사가 먼저 이것을 센다. 1분 동기화로
  들어온 런은 `summary_version = 0`이고, 목록은 그 런만 원문으로 오늘처럼 계산하며, 요약 채우기 작업이 그 행을 채운다.
- 그림자 어댑터: 답의 키가 1단계 열 목록(`TOYBOX_POST_TABLES` 표의 열, `PAGESTORM_LIST_COLUMNS`,
  `RUN_SUMMARY_COLUMNS`, `RUN_DETAIL_COLUMNS`)과 같다. 목록·고르기는 원문 대신 요약 열이다.
- 목록의 표지 편집: 다른 기기(로컬 런 없음)에서 공유한 런의 주인이 목록에서 "표지 편집"을 누르면 오늘처럼 편집기가
  열린다. 편집기는 R3r로 원문을 받는다. 상세의 표지가 오늘처럼 원문에서 고른 표지와 같다(4.4절).
- testbed(4·5단계 전): service role 쓰기 하나를 미러되는 표마다 Supabase 트리거에 통과시킨다. 다시 채우기의
  `DROP`이 D1 쓴 행으로 세이지 않는지 잰다. 277 KB, 1.9 MB 원문의 `text()`·bind·응답 CPU를 잰다.

## 10. 결정(2026-11-08)

사용자가 정한 원칙: 모든 기능을 오늘 동작 그대로 옮긴다. 가는 길에 찾은 운영 버그는 tasks/010에 적고(#68, #69,
#70) 나중 버그 수정 묶음에서 고친다. 이 문서의 이전 열린 질문 1~10은 아래로 정해졌다. 옛 1~9번은 10.1~10.9절,
옛 10번(다른 env 글의 좋아요)은 10.6절에 합쳤다.

### 10.1 카운터 어긋남

Supabase 수를 다시 세지 않는다. 2단계는 Supabase 수 열을 그대로 복사한다. 어긋남은 tasks/010 #68이다. 전환 때
한꺼번에 고쳐지지는 않는다. 5단계에 그 글·런의 좋아요나 댓글이 바뀌면(다시 올린 런은 R14가 `threads`에서 수를
가져올 때) 재계산 규칙(2.3절)이 행 수로 맞춘다. 그 뒤 활동이 없는 글에는 복사한 수가 남는다.

### 10.2 런 요약

요약은 D1에서만 만든다. Supabase `runs`는 바꾸지 않는다(2026-11-08 사용자 결정). 첫 복사가 모든 런의 요약 열과
`badges`를 원문에서 계산해 넣고, 2~4단계에 새로 올라온 런은 요약 채우기 작업(GitHub Actions, D1만 씀)이 채운다.
그 사이 목록은 요약이 없는 런만 원문을 받아 오늘처럼 계산한다. 업로드는 하루 몇 건이라 이 길로 충분하다. 저장된
`cover_spec`은 바꾸지 않는다(조각모음이 저장 표지를 보여 준다). 목록은 오늘처럼 브라우저가 자동 표지를 고르고, 그
입력을 요약 열 `list_facts`가 담는다. 올릴 때 브라우저가 요약을 보내는 변경은 5단계에 넣는다(4.4절).

### 10.3 NULL `created_at`

첫 복사가 표마다 센다(기대 0, `runs`는 2026-11-05 덤프에서 0). 있으면 그때 묻는다. 손으로 만든 요청만 만드는 새
NULL은 10.6절을 따른다.

### 10.4 `game_elements`

오늘처럼 목록과 함께 보낸다. 검색창 아래 인기 요소 칩이 첫 화면부터 모든 런으로 만들어지고, 검색어가 런의
카드·유물 이름과 맞는다. 목록은 100개에 약 0.6 MB(570~620 KB)다(오늘 약 7.9 MB). HTML 첫 데이터 상한과의
관계는 4.4절, 3단계 일이다.

### 10.5 `donor_user_id`

오늘처럼 공개 답에 둔다. 댓글과 글도 이미 `user_id`를 준다. 이 uid는 "내 런" 표시와 무작위 고르기에서 내 런을
빼는 데만 쓴다.

### 10.6 Supabase 전제 조건

10.2절 밖의 Supabase 전제 조건 마이그레이션은 없다(`created_at` 보호 트리거, 원소 꼴 CHECK, 이거 아님 저거?
좋아요 env 정책을 뺐다). 손으로 만든 요청만 만드는 값은 운영에서 고치지 않는다. 1분 동기화가 이유를 적어
`sync_rejects`에 남기고, 첫 복사가 보고한다(기대 0, 첫 복사가 센다). 어느 쪽이든 나오면 그때 사용자에게 묻고,
사용자가 정한 일을 마칠 때까지 대조와 문턱은 실패다(3.1절). 다른 env 글의 좋아요(#70)는 `cross_env`로 세고 넣지
않으며 거절을 닫는다. 일일 대조는 같은 env 행만 비교한다. 4단계부터는 Worker가 모든 쓰기를 검증해 이런 값이
생기지 않는다(3.1절). 문의 트리거 `WHEN`은 service 키로 문의를 쓰는 첫 단계 전(4단계 Worker 쓰기 전)에 올린다
(5.1절, 5.5절).

### 10.7 퍼즐상자 env

하루 500판과 3초 규칙은 나뉜 뒤 env마다 센다. testbed와 운영은 다른 익명 사용자라 실제로 바뀌는 것이 없다
(4.5절).

### 10.8 원문 상한

1.9 MB는 D1 표 CHECK에만 둔다. Supabase는 바꾸지 않는다(10.2절). 오늘 가장 큰 원문은 277 KB(중간값 약 57 KB)다.

### 10.9 이거 아님 저거? 좋아요와 `threads`

`threads`에 넣지 않는다. 오늘 참여 수 답과 같고, 이 값을 읽는 화면은 없다(2.2절).

남은 열린 질문은 없다. 첫 복사 검사(5.2절), 일일 대조의 요약 비교(5.4절)가 기대와 다른
수를 보고하거나, 1분 동기화가 손으로 만든 값을 거절하면 그때 묻는다. 카운터 어긋남과 JSON 최대 크기는 보고만
한다.

## 검토에서 남긴 것

고치지 않았거나 다른 방법을 고른 것과 이유다.

- **월드컵 통계 A안**(RPC가 `p_created_at`과 `COLLATE "C"`로 같은 바이트를 만들기): B안(D1 행을 상태로 미러)을
  골랐다. 두 곳에서 계산하지 않으므로 정렬 규칙(열린 확인 `datcollate`)을 몰라도 된다.
- **Supabase 쪽에서 손으로 만든 값 막기**(`created_at` 보호 트리거, 원소 꼴 CHECK, 이거 아님 저거? 좋아요 env
  정책): 하지 않는다(10.6절). 운영 쓰기 경로를 바꾸기 때문이다. 이런 값은 동기화 거절이 되어 그때 사용자에게
  묻고(3.1절), 4단계 Worker 검증이 그 뒤로 막는다.
- **`likes`·`comment_likes`의 D1 `created_at` 널 허용**: 하지 않는다. D1은 `NOT NULL`이고, 손으로 만든 NULL은
  `bad_timestamp` 거절이다. 앱은 NULL을 쓰지 않는다.
- **채우기의 자동 표지 다시 고르기와 Supabase 수 다시 세기**: 하지 않는다(10.1절, 10.2절). 저장된 표지와 수를 바꾸면
  조각모음과 목록 수가 오늘과 달라진다.
- **Supabase `octet_length(story_id) >= 1`**: D1 아래 한계를 없앴다. 운영 데이터를 건드리지 않고, 빈 키 하나가 생겨도
  해가 없다.
- **글 지우기 때 이거 아님 저거? 좋아요 지우기 outbox 행 쓰기**: 쓰지 않는다. 양쪽 FK 연쇄가 같은 일을 한다. 써도
  키로 지우기라 같은 결과다.
- **런 원문 text RPC의 id 넘기기**: 이름 없는 text 인자 하나인 RPC는 다른 인자를 받지 못한다. 메타를 먼저 upsert하고
  원문을 넘기는 두 호출로 할지, 다른 길로 할지는 5단계 설계에서 정한다.
- **S5 isolate 합치기**: 지금 트래픽에서는 100%로도 하루 2만 행이라 바로 하지 않는다. 8절에 조건을 적었다.
- **비용 검토가 지적한 샘플 플래그 규칙**(샘플 값이 없으면 0, 0~1로 자름): 샘플 플래그를 설명하는 6절에 넣었다.
- **로컬 데이터 백업으로 원소 꼴과 `list_facts` 크기를 미리 세기**: 이번 검토의 자료 목록에 데이터 백업이 없어
  열지 않았다. 원소 꼴과 `list_facts` 크기는 첫 복사 검사가 센다.

## 검토 기록

초안 뒤에 세 갈래로 검토했다.

- **충실도**: D1이 Supabase가 받는 행을 모두 받는지, 같은 답을 내는지, 권한이 같은지. 1단계 Worker의 통과 경로, RLS,
  보호 트리거가 덮지 않는 클라이언트 쓰기 열, 피드 RPC의 답 열(`to_jsonb(p.*)`), 이거 아님 저거? 좋아요의 FK를 봤다.
  - 바꾼 것: 같은 글 id가 Supabase의 두 글 표에 있을 수 있는 문제를 찾았다(지금은 복합 키로 푼다, 3.4절). 런
    올리기의 요약 행과 원문은 이 기증자의 런 밑에만 들어간다(R14b, R14c). "클라이언트가 쓸 수 있는 열" 표와 2단계
    전제 조건(3.1절, 5.1절. 전제 조건은 뒤에 사용자 결정으로 뺐다). 이거 아님 저거? 좋아요의 FK와 연쇄(지금은 자기 표의 FK, 2.2절). 피드·고르기·서류 폭풍
    쿼리를 1단계 답의 열 전체로 넓혔다(T1~T5, T9, T11, T12, R2). 퍼즐상자 env별
    뜻(4.5절).
- **이관**: 동기화, 거절, 미러, 되돌리기가 실제 순서와 실패에서 멈추지 않는지. 변경 로그 창, 거절 재시도, 부분 `U`,
  batch 안 순서, 자기 쓰기 읽기, 5단계 미러의 Supabase 트리거, 자라기만 하는 규칙과 CHECK, 일일 대조의 정렬과 키를
  봤다.
  - 바꾼 것: `sync_state.high_seen`, 거절도 워터마크 아래로 치는 규칙, 늦은 커밋 창 다시 읽기, 첫 복사 워터마크를
    `W0` 앞에(5.2절, 5.3절). 거절은 키로 다시 읽어 적용하고 payload를 다시 쓰지 않는다(`sync_rejects`에 `d1_table`,
    `row_key`, `reason`, 키마다 열린 거절 하나). 0행 `U`는 실패. 첫 id 순서의 batch. 자기 쓰기 읽기는 응답 전에,
    넣기는 `DO NOTHING`, 고치기는 바꾼 열만. 미러 오류 종류. 문의 트리거 `WHEN` 마이그레이션. 월드컵 통계는 상태
    미러(B안). 런 outbox에 원문 없음. `posts.service`를 꼴 CHECK로, 제목 CHECK를 아는 서비스에만, 부모 표 `DROP`
    금지와 가족 재작성 절차(3.1절, 3.7절). `sync_checks` 기본키에 원본 표, 바이트 순서 해시, 매퍼별 Supabase 쿼리.
    되돌리기는 첫 복사를 다시.
- **비용**: D1 읽은 행·쓴 행과 Workers Free 실행 한도(쿼리 50, subrequest 50, CPU 10 ms). 그림자 장부 쓰기, 동기화
  batch 크기, 런 원문 fetch와 파싱, 5단계 런 공유, 월드컵 풀 부분쿼리, 다시 채우기를 봤다.
  - 바꾼 것: 동기화를 실행당 예산으로 자르고, 실패는 반으로 나누고, 원문은 줄(`sync_pending_raw`)에서 실행마다 2개를
    텍스트로 받는다(5.3절). 5단계 공유는 요청 하나에 런 하나, 4문장(4.4절). 상세의 원문은 응답 본문 그대로(R3r).
    T5는 풀을 정렬 뒤에 만든다(loops 20). 다시 채우기는 잎부터 `DROP`. 8절에 그림자 장부와 다시 채우기의 쓰기 수를
    더했다.
- **사용자 선호(첫 검토 뒤)**: 참조 무결성과 타입 있는 열을 JSON과 흉내 문장보다 앞에 두고, 운영 Supabase 쓰기 경로는
  덜 바꾸는 쪽으로 두 가지를 바꿨다.
  - `posts` 키를 `(service, id)`로. 서비스 표와 자식 표는 `(service, post_id)`로 가리킨다(3.4절). 한 id 공간을 지키려고만
    있던 것을 뺐다: Supabase의 글 id 서버 생성(`gen_random_uuid()`), 런 id 꼴 CHECK(`runs_id_shape`. 다른 이유가 없다.
    URL과 스레드 키에 쓰는 꼴은 Worker `isRunId`가 본다), 서비스가 다른 적용을 막던 조건과 `service_mismatch`
    거절, 첫 복사와 일일 대조의 겹침 세기(`id_collision`, `sync_checks`의 `collision`), 남의 글 가로채기 설명.
  - 이거 아님 저거? 좋아요를 자기 표 `this_or_that_post_likes`로 되돌렸다(2.2절). Postgres와 같은 FK와 연쇄가 생겨,
    공통 `likes`에 합치며 생긴 것을 뺐다: Supabase `likes_not_this_or_that` CHECK와 행 옮기기, 1단계 Worker의 접두사
    거절, FK와 연쇄를 흉내 내던 문장(옛 TL1~TL1c, TW3a. 지금 TL1은 FK에 맡기는 넣기 한 문장이다), 그림자·일일 대조의 `this-or-that:` 예외.
  - 함께 고친 것: 피드의 서비스 표 조인을 `CROSS JOIN`으로, `posts_user`에 `service`를 넣고, R12는 키를 색인에서 먼저
    얻는다(2절 끝). 5.1절 전제 조건은 둘(`created_at` 보호, 원소 꼴)이 남았다. 두 번째 검토가 셋째를 더했다(아래). 셋 모두 뒤에
    사용자 결정으로 뺐다(끝).
- **두 번째 검토(사용자 선호 반영 뒤)**:
  - 좋아요를 자기 표로 되돌리며 FK가 생겨, 다른 env 글에 단 좋아요(Supabase는 받는다)가 D1에서 거절되는 길이
    새로 열렸다. 투표는 INSERT 정책의 env `EXISTS`가, 월드컵 플레이·통계는 RPC의 `env = p_env`가 이미 막으므로
    열린 곳은 좋아요뿐이다(이전 요약의 "투표에도 원래 있던 문제"는 틀렸다). 옛 5.1절 3번(정책, 뒤에 뺐다), 3.1절 표 한
    줄, 5.2절 검사의 처리(`cross_env`로 세고 넣지 않음), 5.3절 표별 대응, 5.4절 Supabase 쪽 쿼리, 옛 10절 10번.
  - 좋아요 취소(TL2)에 outbox 지우기 행을 더하고, "outbox 행을 만들지 않는다"를 글 지우기의 연쇄로 범위를 밝혔다.
  - outbox 막기 기준을 `(table_name, match_key)`로(4.1절, 5.5절, 스키마 주석). 미러 시험에 같은 id의 두 글 표 행.
  - 자기 쓰기 적용이 FK·CHECK로 실패해도 답은 Supabase 결과대로, 행은 1분 동기화에 맡긴다(5.3절).
  - `threads`에 넣지 않은 이거 아님 저거? 좋아요 수를 결정으로 올렸다(옛 10절 9번, 지금 10.9절).
  - `check.py`가 `service` 앞부분만 쓰는 기본키 검색을 실패로 본다(9절). T4, T5만 `svcrange` 허용.
  - 코오오옴보 스레드 키 접두사를 `fixtures.sql`과 `queries.sql`에서 실제 `c-c-c-combo:`로 고쳤고, 접두사 목록을
    3.4절에 적었다. 그 밖에 절 번호 참조, 글 표 수(일곱 표와 `runs`), 스키마 주석, 9절 피드 목록, 5.5절 "예외 둘",
    옛 10절 2번·5번의 권하는 답, D1 SQLite 판 확인 방법(상태).
- **사용자 결정 반영(두 번째 검토 뒤)**: 모든 기능을 오늘 동작 그대로 옮긴다는 결정(10.1~10.9절)을 적용했다.
  - 뺀 것: 5.1절 전제 조건 셋(`created_at` 보호 트리거, 원소 꼴 CHECK, 이거 아님 저거? 좋아요 env 정책)과 그에
    기댄 `NOT VALID`·`VALIDATE` 순서, 첫 복사 전 Supabase 수 다시 세기, 채우기의 자동 표지 다시 고르기, 요소
    거르기용 따로 읽기(옛 R1e). 3.1절의 "손으로 만든 값의 규칙" 하나가 대신한다.
  - 바꾼 것: 요약 열 `cover_phrases`를 `list_facts`로 바꿨다. 목록은 자동 표지를 브라우저가 읽을 때 고르므로, 문구도
    보이는 표지를 따라 브라우저가 만들어야 오늘과 같다. `list_facts`는 자동 표지 고르기, 표지 문구, 강조 카드·유물이
    원문에서 읽던 입력이다(4.4절). R1·R2가 `game_elements`·`list_facts`를 주고, R4가 `list_facts`를 주고, R11은
    `cover_spec`만 쓴다.
  - 더한 것: 거절 이유 `bad_timestamp`, `bad_element`, `cross_env`(5.3절, 스키마 주석), 고정 행의 닫힌 `cross_env`
    거절, `list_facts` 객체 CHECK 검사, 채우기 dry-run의 비교 수(5.1절), 일일 대조의 목록 결과 비교(5.4절).
- **세 번째 검토(사용자 결정 반영 뒤)**:
  - 목록의 "표지 편집"이 원문에 묶여 있는 것을 4.4절 표에 더했다. D1에서는 편집기를 열 때 R3r로 원문을 받는다.
    9절 시험에 넣었다.
  - 채우기 뒤 옛 탭이 올린 `summary_version = 0` 런: 첫 복사 검사와 일일 대조가 세고, 그 행만 다시 채우고, 3단계
    조건에 "0개"를 넣었다(4.4절, 5.1절, 5.2절, 5.4절, 6절 8번).
  - 손으로 만든 값의 거절을 끝내는 길: 그때 사용자에게 묻고, 사용자가 정한 일을 마칠 때까지 대조와 문턱은 실패다
    (3.1절, 5.3절 표, 5.4절, 6절 9번, 10절 끝). "오늘 0"은 "기대 0(첫 복사가 센다)"과 잰 근거로 고쳤다.
  - 일일 대조의 목록 비교에 배지와 파티 캐릭터를 더했다(5.4절). 배지 규칙이 바뀔 때는 `summary_version`을 올려
    다시 채운다(4.4절). `summary_version`을 올리는 조건에 강조 고르기를 더했다.
  - 상세는 저장 표지가 아니라 원문에서 고른 표지를 보인다(4.4절, 스키마 주석).
  - 문의 트리거 `WHEN` 시점을 "4단계 Worker 쓰기 전"으로 맞췄다(5.1절, 5.5절, 10.6절).
  - 결정 이름 D1~D9가 데이터베이스 D1과 겹쳐 10.1~10.9절로 바꿨다. 옛 질문 번호와의 대응, #68이 고쳐지는 범위(2.3절,
    10.1절), 덤프 오프셋 검사를 손으로 만든 값에서 뺀 것(5.2절), 두 dry-run 나누기(5.1절), HTML 첫 데이터 상한 설명과
    목록 크기(4.4절, 8절, 10.4절), 결정 3의 단계, 6절 4번, R4 설명을 고쳤다.
  - 다른 문서: 계획 문서의 2단계 설명, tasks/010 #68·#70의 참조.
