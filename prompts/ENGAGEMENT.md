# 댓글/좋아요 시스템 스펙

## 목표

이야기 카드에 좋아요(♥)와 댓글(💬) 기능 추가.
**최우선 제약: 비용 0원 (무료 tier 내, 신용카드 불필요)**

## 요구사항 출처

- `prompts/SPEC.md` — "제외 (추후)" 섹션에서 승격
- `tasks/004-engagement.md` — 초기 후보 스택 (Vercel KV, Upstash, Turso)
- `docs/DESIGN.md` — "게이머 친화적 UI (GitHub 로그인 등 불필요)"

## 테크스택 비교 (비용 0 기준)

| 기준 | Supabase Free | Firebase Spark | Turso Free | Giscus |
|------|--------------|----------------|------------|--------|
| 비용 보장 | Hard limit, 카드 불필요 | Hard limit, 카드 불필요 | Hard limit | 완전 무료 |
| 인증 | Anonymous auth 내장 | Anonymous auth 내장 | 별도 필요 | GitHub 전용 |
| 게이머 친화 | ✅ 익명 사용 가능 | ✅ 익명 사용 가능 | ⚠️ 인증 별도 구현 | ❌ GitHub 로그인 |
| 댓글 | Postgres | Firestore | SQLite | GitHub Discussions |
| 좋아요 | Postgres | Firestore | SQLite | ❌ 미지원 |
| 실시간 | 내장 (Realtime) | 내장 (onSnapshot) | ❌ | ❌ |
| SDK 품질 | 우수 (@supabase/supabase-js) | 양호 (firebase) | 양호 (@libsql/client) | 단순 (React 컴포넌트) |
| SSG 호환 | Client SDK (hydration 후) | Client SDK (hydration 후) | API route 필요 | iframe 임베드 |
| 설정 복잡도 | 낮음 | 중간 (Firebase 콘솔) | 중간 | 매우 낮음 |

### 무료 tier 상세

**Supabase Free** (추천):
- DB: 500MB Postgres
- API: 무제한 요청
- Auth: 50K MAU, anonymous auth 포함
- Realtime: 200 동시 연결
- 대역폭: 5GB/월
- Edge Functions: 500K 호출/월

**Firebase Spark** (대안):
- Firestore: 1GB 저장, 50K reads/day, 20K writes/day
- Auth: 무제한 anonymous
- Bandwidth: 10GB/월

**기각 사유:**
- Vercel KV: 30K req/월 (너무 적음)
- Vercel Postgres: 60 compute hours/월 (제한적)
- Upstash Redis: 10K commands/day (부족할 수 있음)
- Giscus: GitHub 로그인 필수 → 게이머 친화 위반
- Turso: 인증 별도 구현 필요 → 복잡도 증가

## 선정: Supabase

**근거:**
1. 비용 0 보장 (hard limit, 카드 불필요)
2. Anonymous auth 내장 → 게이머 친화
3. Postgres → 댓글 + 좋아요 단일 DB
4. Realtime → 실시간 좋아요 카운트/새 댓글
5. RLS (Row Level Security) → 별도 백엔드 없이 보안
6. Client SDK → SSG 사이트에서 hydration 후 직접 호출 (API route 불필요)
7. Claude 모델의 Supabase 지식 풍부 → 생산성 높음

## 아키텍처

```
Browser → Supabase Client SDK (anon key + RLS)
              ├── Auth (anonymous)
              ├── Postgres (likes, comments)
              └── Realtime (live updates)

Next.js SSG (정적 HTML) → Vercel CDN
                            └── hydration 후 Supabase 연결
```

**핵심: API route 없음.** 브라우저에서 Supabase로 직접 통신.
anon key는 클라이언트에 노출되지만 RLS가 보안 담당.

## DB 스키마

```sql
-- 좋아요
create table likes (
  id uuid primary key default gen_random_uuid(),
  story_id text not null,
  user_id uuid not null references auth.users(id),
  created_at timestamptz default now(),
  unique(story_id, user_id)
);

-- 댓글
create table comments (
  id uuid primary key default gen_random_uuid(),
  story_id text not null,
  user_id uuid not null references auth.users(id),
  nickname text not null check (char_length(nickname) between 1 and 20),
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz default now()
);

-- 좋아요 집계 뷰 (캐시 역할)
create view like_counts as
  select story_id, count(*) as count
  from likes
  group by story_id;

-- 인덱스
create index idx_likes_story on likes(story_id);
create index idx_comments_story on comments(story_id, created_at);
```

## RLS 정책

```sql
-- likes
alter table likes enable row level security;
create policy "likes_read" on likes for select using (true);
create policy "likes_insert" on likes for insert
  with check (auth.uid() = user_id);
create policy "likes_delete" on likes for delete
  using (auth.uid() = user_id);

-- comments
alter table comments enable row level security;
create policy "comments_read" on comments for select using (true);
create policy "comments_insert" on comments for insert
  with check (auth.uid() = user_id);
-- 삭제/수정: 본인만 (추후 모더레이션 추가 가능)
create policy "comments_delete" on comments for delete
  using (auth.uid() = user_id);
```

## 인증 플로우

1. 사이트 첫 방문 → Supabase anonymous sign-in 자동 실행
2. 좋아요: 즉시 가능 (닉네임 불필요)
3. 댓글 작성 시: 닉네임 입력 프롬프트 → localStorage + user_metadata 저장
4. 재방문: localStorage의 세션 복원 → 기존 좋아요/댓글 유지

## 스팸 방지

- RLS: 본인 좋아요/댓글만 생성 가능
- DB constraint: story당 user당 좋아요 1개 (unique)
- 댓글 길이 제한: 1~500자
- 닉네임 길이 제한: 1~20자
- 추후 고려: Supabase Edge Function으로 rate limiting

## 구현 순서 (백엔드 우선)

### Phase 1: Supabase 설정
1. Supabase 프로젝트 생성 (Free plan)
2. Anonymous auth 활성화
3. DB 테이블/뷰/인덱스/RLS 생성
4. anon key + URL을 환경변수로 설정

### Phase 2: 클라이언트 통합
1. `@supabase/supabase-js` 설치
2. Supabase client 싱글턴 (`src/lib/supabase.ts`)
3. Anonymous auth 훅 (`useAuth`)
4. 좋아요 훅 (`useLikes`) — toggle, count, user status
5. 댓글 훅 (`useComments`) — list, create, delete

### Phase 3: UI (조정 예정)
- 이야기 카드에 좋아요 버튼 + 카운트
- 이야기 상세에 댓글 섹션
- 닉네임 입력 다이얼로그
- 실시간 업데이트 (Realtime subscription)

## 환경변수

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

## 파일 구조 (예상)

```
src/
├── lib/
│   └── supabase.ts          # Supabase client singleton
├── hooks/
│   ├── use-auth.ts           # Anonymous auth
│   ├── use-likes.ts          # Like toggle, count
│   └── use-comments.ts       # Comment CRUD
└── components/
    ├── like-button.tsx        # ♥ toggle + count
    ├── comment-section.tsx    # Comment list + form
    └── nickname-dialog.tsx    # Nickname input
```
