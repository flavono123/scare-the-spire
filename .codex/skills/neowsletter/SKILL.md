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
- Write the kept prose as a close translation of the Mega Crit sentences. Do not paraphrase a section into a shorter claim.
- Use official names from `data/sts2/{kor,eng}`. Do not invent a name for an unrevealed character, act, or monster. A teaser image stays an image.
- Do not insert newsletter claims into `data/sts2-patch-lines.json`.
- The issue cover is the thumbnail. Save it at `public/images/neowsletters/{id}/cover.png` and set `imageUrl` / `imageAlt` / `imageAltKo`. Show it on the index card and at the top of the detail page, using the patch art frame.
- Other fan art, map drawings, Connections, and merch stay on the source URL.
- Each claim has one collapsed comment affordance: a small token chip, not body text. Opening it shows a one-line composer and one-line comments. Token, nickname, time, like, and delete sit on the right. Thread key is `neowsletter:{id}:{claimId}`.
- The tab token is `/images/sts2/ancients/neow.webp`. Do not use the map node `ancient_node_neow`.
- `serviceLocale` selects `data/sts2-neowsletters/{id}.ko.md` or `{id}.md`. `gameLocale` selects Codex hover labels. Keep the written name on screen when the game locale matches the file (`kor` / `eng`). Swap the visible label only for other game locales, so `[gold:ascension]Ascension 10[/gold]` does not become the level title `Double Boss`.
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
7. Verify the Korean list, the Korean issue, and `/en/patches/neowsletters/{id}`: cover thumbnail, official link, gold hovers, and a collapsed comment control under each claim.

## Claim shape

A claim follows the original section or one Q&A answer. Translate the sentences. Do not shorten them into a briefing.

```markdown
<!-- claim:ascension-10 -->
**Clapah이 묻습니다:** 슬레이 더 스파이어 2가 너무 좋습니다. [gold:ascension]승천 10[/gold]의 밸런스를 생각하고 있었는데, 1편의 승천 20보다 꽤 쉽다는 걸 알고 있습니다.

Casey: 대체로 [gold:ascension]승천 10[/gold]이 이 게임에서 둘 가장 높은 난이도에 가깝다고 생각해 왔습니다.
```
