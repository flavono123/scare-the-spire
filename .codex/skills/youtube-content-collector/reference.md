# Collector reference

## Public source navigation

Primary gallery:

- List: `https://gall.dcinside.com/mgallery/board/lists/?id=slay`
- Recommended list:
  `https://gall.dcinside.com/mgallery/board/lists/?id=slay&exception_mode=recommend`
- Post:
  `https://gall.dcinside.com/mgallery/board/view/?id=slay&no={post_number}`

Use the gallery's visible controls instead of synthesizing undocumented query
parameters. Open each source before reporting it and reduce copied post URLs to
the stable `id=slay&no=...` form when that form resolves.

The list exposes post number, category, title, comment-count signal, author,
date/time, views, and recommendations. A post page exposes the title, author
label, full timestamp, body, attachments, and comment thread. Current-day list
dates can appear as a time and current-year dates can omit the year; verify the
full timestamp on the post page. DC comments generally do not expose durable
per-comment URLs, so use the canonical post URL and state that limitation.

For historical work:

1. Bound the KST window before browsing.
2. Do not assume an advanced date-range filter. When the public gallery exposes
   only basic keyword search, locate the window through manual list pagination;
   page numbers drift as new posts arrive and are not durable evidence.
   Search likely terms from the verified patch context, but do not treat keyword
   results as a complete census.
3. Open every reported post and verify its full timestamp. Do not infer a year
   from a list-only `MM.DD` label.
4. Record deleted, inaccessible, edited, or search-truncated material only as a
   limitation; never reconstruct its text from snippets.

DC's public search and recommendation state can change, and historical
recommended-list membership is not a permanent archive.

For topic work:

1. Resolve the supplied term against game/repository data and public usage.
   Record the canonical subject and aliases actually searched. If multiple
   meanings remain plausible, ask instead of merging unrelated results.
2. Search the supplied wording first, then verified Korean canonical names and
   common aliases. Use an English name or resource ID only when public posts
   demonstrably use it.
3. A requested date window is optional. Without one, report `window: null` and
   set `observed_range` to the earliest and latest verified matching posts; this
   is search coverage, not a claim that no older material exists.
4. Keep only posts whose body or context is genuinely about the subject. A
   keyword appearing in navigation, quoted unrelated text, or boilerplate is
   not a match.

## Source balance

- `slgall`: the default and dominant source.
- `other`: at most one or two watchlist topics from public communities that
  substantially overlap with STS2. Do not substitute unrelated high-volume
  communities.
- `slseoun`: low weight until the site's community is active. Then inspect
  public pages for Compendium and patch comments, Toy Box feeds, 조각모음, and
  이야기. Treat latest/recommended/comments and the existing Toy Box score
  (`like × 4 + comment × 6`) as heat signals, not as the definition of fun.

Do not turn the site into a scraping app. Do not production-full-scan Supabase.
Use public pages as a person would, or an operator-approved local/admin path.

## Heat and flags

Write `heat` as visible evidence, for example:

```text
작성 3시간 / 추천 12 / 댓글 9
```

Omit a metric that is not visible. Do not estimate it.

Use short stable flags where applicable:

- `creative-work`
- `fan-art`
- `streamer-clip`
- `other-video-repost`
- `sexual-punchline`
- `real-name-or-pii`
- `nickname-harassment`
- `party-recruitment`
- `party-dispute`
- `guide-or-faq`
- `survey`
- `unverified-origin`
- `graphic-visual-edit`
- `deleted-or-inaccessible`

Items with rights, sexual, identity, harassment, or unverifiable-origin flags
cannot become candidates. Recruitment, guide/FAQ, and survey items are not the
channel sentiment and also stay out of candidates.

## Output contract

Return Korean Markdown or YAML with every field below. Keep the watchlist broad
and candidates selective.

```yaml
mode: now | trigger | historical | topic
query: supplied subject for topic mode, otherwise null
resolved_subject:
  canonical: verified game/community subject, or null
  aliases_searched: []
window: # null when topic mode has no requested dates
  from: ISO-8601 timestamp or YYYY-MM-DD
  to: ISO-8601 timestamp or YYYY-MM-DD
  tz: KST
observed_range: # required for topic mode
  from: earliest verified matching post
  to: latest verified matching post
  tz: KST
patch_context:
  version: verified version or null
  note: verification source and relevance
limitations:
  - deleted posts, search gaps, broadened window, or other concrete limits

watchlist:
  - topic: exact or faithfully shortened topic title
    type: seeded or narrowly observed type
    source: slgall | other | slseoun
    heat: visible recommendation/comment/time evidence
    why: one line explaining the current or period-specific reaction
    url: canonical public URL
    flags: []

script_candidates:
  - topic: same topic as a watchlist item
    type: same type as the watchlist item
    body:
      excerpt: one or two short source sentences, never a long reproduction
      url: canonical public URL
      author_label: public gallery nickname or anonymous label; no real identity
    comments:
      - text: short verbatim comment
        url: comment permalink, or the post URL with no-permalink note
      - text: short verbatim comment
        url: comment permalink, or the post URL with no-permalink note
      - text: short verbatim comment
        url: comment permalink, or the post URL with no-permalink note
    flags: []
    skip_reason: null
```

If fewer than eight distinct topics or two safe candidates can be verified,
return the smaller set and explain the shortfall in `limitations`. Never fill a
quota with fabricated, unrelated, risky, or duplicated material.

## Final checks

- Every URL opens and every reported timestamp belongs to the requested window.
- Every count in `heat` was visible during this run.
- Every candidate also appears in `watchlist`.
- Candidate excerpts and comments are short, verbatim, and context-preserving.
- Candidate flags are empty and `skip_reason` is `null`.
- Rejected high-heat items remain visible in `watchlist` with their flags.
- The response contains both layers; it does not hide the board behind a single
  recommendation.
