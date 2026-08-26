---
name: youtube-content-collector
description: Collects Slay the Spire 2 community trends as monitored topics and a smaller set of safe YouTube Shorts script candidates. Use when the user mentions 슬갤, 동향, 유튜브 대본, 과거 시점 조사, a patch-day trend scan, or asks to collect current or historical community reactions.
---

# youtube-content-collector

Collect topics for one-person editorial review. This is not a bulk scraper,
public archive, or automatic publishing workflow.

## Inputs

Resolve these before browsing:

- `mode`: `now`, `trigger`, or `historical`.
- `window`: exact KST dates/times. `now` defaults to the latest 48 hours.
- `patch_context`: verify a version from the repository's patch data or a
  primary source; otherwise use `null` and explain the uncertainty.
- Optional operator-owned 재미 memory: use it when supplied, but never create
  channel-performance memory under `src/`, `public/`, or another tracked path.

For `historical`, accept either an explicit date range or a patch version plus
`before/after N days`. Ask for the missing range only when it materially changes
the investigation.

## Collection workflow

1. Read [reference.md](reference.md).
2. Browse the public web as a person would. Use DC Inside `board/slay` as the
   primary source; inspect both recommended posts and topic-bearing general
   posts. Do not build a scraper, unofficial dump API, or request-time Worker.
3. Record only evidence visible on the public page: title, timestamp,
   recommendation/comment signals, short body excerpt, short comments, and
   canonical URL. Never invent inaccessible or deleted content.
4. Add at most one or two relevant topics from other STS2 communities. Keep
   슬서운이야기 low-weight until its community is active, then read existing
   public feeds/comments without full-scanning Supabase.
5. Apply the gates below before ranking.
6. Produce a broad `watchlist` of 8–20 topics and a smaller
   `script_candidates` list of 2–5. Do not return only the top candidate.

## Editorial rubric

Use these signals in order; visible popularity is only supporting evidence:

- Punch density: one clear 15–45 second beat (`×1.5`).
- Timeliness or period relevance (`×1.4`).
- Three short comments that form a readable exchange (`×1.3`).
- One screenshot or game state that carries the climax (`×1.1`).
- Visible recommendations, views, or comment count (`×0.5`).

Seed types:

- 패치 멘붕 / 고평가 뒤집힘
- 런 사망 스크린샷의 타이밍
- 카드·유물 한줄 과대/과소
- 번역·이름 드립
- 멀티/고대 도박 실패의 동질감

Name a new type narrowly when the observed topic does not fit a seed. Avoid
guides, recruitment, FAQs, surveys, and generic clear screenshots even when
their counts are high.

## Mandatory gates

Never place a flagged item in `script_candidates`:

- Creative writing, fan fiction, fan art, or other authored work whose value is
  the work itself.
- Streamer footage, donation audio, thumbnails, or another YouTube/video clip.
- A sexual joke as the punchline.
- Real-name or personal-information exposure, targeted nickname harassment, or
  party disputes.
- Reposted material whose origin cannot be verified.

Keep a noteworthy rejected topic in `watchlist` with explicit flags so the
operator can see what was excluded. Graphic game imagery may remain watchlisted
with a mosaic/edit warning; do not soften a sexual or harassment item to save
it.

## Output contract

Follow [reference.md](reference.md#output-contract) exactly:

- State `mode`, the KST window, verified patch context, and limitations.
- Every watchlist row needs topic, type, source, heat evidence, reason, URL, and
  flags.
- Every candidate needs a short body excerpt and URL, an author label, and
  three short verbatim comments with links.
- If comment permalinks do not exist, reuse the post URL and say so. If only
  two safe comments exist, include two and mark the shortage; never pad with
  ads, disputes, or unrelated replies.
- Quotes are highlights, not full-post reproductions. Keep source links so the
  operator can review context and handle attribution or deletion requests.

## Limits

Historical search may miss deleted posts, edits, posts outside search results,
and recommendation-list changes. DC date labels can be ambiguous around year
boundaries. State these gaps instead of implying completeness.

Media expansion is out of scope. If collection later expands from text to
images, songs, or video, apply stricter rights review; fan art, other YouTube
videos, and streamer clips remain discard-by-default.
