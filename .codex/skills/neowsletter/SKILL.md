---
name: neowsletter
description: Turn Mega Crit Neowsletter issues into the third 슬서운변경 tab, with Korean claim notes, Codex links, and per-claim comments. Use for 니오우스레터, Neowsletter, newsletter backfill, or a month such as 2026-08.
---

# neowsletter

Build 니오우스레터 pages from the Mega Crit original. The page is a claim index for this service, not a reprint of megacrit.com.

## Non-Negotiables

- Source of truth for prose is the Mega Crit post. Fetch the real URL from `https://megacrit.com/sitemap.xml`. Do not invent a URL, and do not treat Steam `gid` as one.
- The series starts with Issue 1 on 2024-08-07. There is no STS1-era Neowsletter to backfill.
- Backfill newest month first. One publication month is one issue id, `YYYY-MM`.
- Write claims, Q&A answers, and named game resources. Leave greetings, merch, Connections, map drawings, and fan art on the source page.
- Use official names from `data/sts2/{kor,eng}`. Do not invent a name for an unrevealed character, act, or monster. A teaser image stays an image.
- Host an image only when it depicts game content and `public/images/sts2/**` does not already have it. Save it at `public/images/neowsletters/{id}/`. Skip `srcset` derivatives. Fan art stays on the source URL.
- Comment anchors are stable claim ids. Thread key is `neowsletter:{id}:{claimId}`. Do not insert these lines into `data/sts2-patch-lines.json` or the 슬서운 변경 explorer.
- `serviceLocale` selects `data/sts2-neowsletters/{id}.ko.md` or `{id}.md`. `gameLocale` selects Codex hover labels, same as patch notes.
- Pages are finite static routes under `/patches/neowsletters`. Register them in `scripts/build-patch-worker.tsx` in the same change. Do not render markdown in the Worker.
- Load `.codex/skills/cf-guardrails/SKILL.md` before adding routes or images. One newsletter image also occupies a main Worker public-asset slot.
- Every meaningful edit gets its own speculative commit, following `AGENTS.md`.

## Workflow

1. Find the post URL in the Mega Crit sitemap. Record issue number, publication date, and URL.
2. Read the HTML. Split it into claims a player would answer: schedule, roadmap bullets, each Q&A answer, and a community event with rules. Drop the rest.
3. Add or update `data/sts2-neowsletters.json` (`id`, `issue`, `date`, `title`, `titleKo`, `sourceUrl`, `summary`, `summaryKo`).
4. Write paired notes:
   - `data/sts2-neowsletters/{id}.ko.md`
   - `data/sts2-neowsletters/{id}.md`
   - Separate claims with a line `<!-- claim:{claimId} -->`.
   - `claimId` is lowercase `[a-z0-9-]`, stable once published.
   - Use the same claim ids and order in both files.
   - Use patch-note tags: `[gold:card]`, `[gold:relic]`, `[gold:event]`, `[gold:character]`, `[gold:ascension]승천 10[/gold]` / `[gold:ascension]Ascension 10[/gold]`.
   - Put a game image on its own line: `![alt](/images/neowsletters/{id}/file.png)`.
5. Keep the third tab label `니오우스레터` / `Neowsletter` and the routes `/patches/neowsletters` and `/patches/neowsletters/{id}`.
6. Rebuild patch HTML (`pnpm patch:html`) and copy assets (`pnpm patch:assets`) so `/patches` serves the new tab from the patch Worker.
7. Verify the Korean list, the Korean issue, and `/en/patches/neowsletters/{id}`: official link, gold hovers, claim comments, and no fan-art gallery.

## Claim shape

A claim is one argument. A Q&A answer is one claim. A merch paragraph is not.

```markdown
<!-- claim:ascension-10 -->
## 승천 10

Clapah이 물었습니다. [gold:ascension]승천 10[/gold]을 1편의 승천 20에 가깝게 둘지, 지금 얼리 액세스에 둘지.

Casey: [gold:ascension]승천 10[/gold]이 이 게임의 최고 난이도에 가깝습니다. 캐릭터가 더 많아서 승천 20을 끝까지 가는 일은 고역입니다. 콘텐츠가 늘면 고난도 그림을 다시 잡습니다.
```

Preserve numbers, dates, and the answer's substance. Do not add a reaction the letter did not say.
