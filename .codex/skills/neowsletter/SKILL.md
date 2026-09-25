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
- Put a comment claim on each `##` section and on the next heading level under it, such as `### 이미 들어간 것`. Keep one claim per Q&A answer. In map, quiz, and fan-art sections, give each image its own claim with the caption that belongs to that image.
- Mega Crit and Steam source links use the patch-note original style: `spire-blue`, no underline, a trailing arrow, plus the source icons in `public/images/neowsletters/source/`.
- The letter-wide comment block matches a patch detail comment section: heading `댓글` / `Comments`, not a separate “전체 댓글” title.
- Include the map-drawing, Connections, and community fan-art sections. Save those images under `public/images/neowsletters/{id}/`.
- Compress every saved image before commit. See **Image compression** below. Do not resize in the Worker.
- Record both originals: Mega Crit `sourceUrl` and the real Steam store `steamUrl` (`/news/app/2868840/view/{id}`). Do not build that URL from an API `gid`.
- Each claim has one comment affordance: Lucide `MessageCircle` with the index like/comment classes, grey until hover, then gold. An empty claim stays collapsed. A claim that already has comments opens by default, shows the count beside the label, and can still be collapsed. Opening it shows a one-line composer. Written comments sit in their own inset thread, still one line, with token, nickname, time, like, and delete on the right. Thread key is `neowsletter:{id}:{claimId}`. The letter-wide thread is `neowsletter:{id}:page`.
- Keep a `[gold]` tag inside its sentence. Do not break the line to move a relic or card out of the paragraph. Static hovers are `<template>` previews, not slabs rendered in the line. Do not use the low-HP character hover on these pages.
- Do not wrap asker names or sentences in `**bold**`. The patch renderer paints that as a gold entity. Use `###` for a subsection title.
- Leave an ambiguous name untagged when several cards share it, such as Defend / 수비. Osty is `[gold]골골이[/gold]`, not a card link.
- The tab token is `/images/sts2/ancients/neow.webp`. Do not use the map node `ancient_node_neow`.
- `serviceLocale` selects `data/sts2-neowsletters/{id}.ko.md` or `{id}.md`. `gameLocale` selects Codex hover labels. Keep the written name on screen when the game locale matches the file (`kor` / `eng`). Swap the visible label only for other game locales, so `[gold:ascension]Ascension 10[/gold]` does not become the level title `Double Boss`.
- Pages are finite static routes under `/patches/neowsletters`. Register them in `scripts/build-patch-worker.tsx` in the same change. Do not render markdown in the Worker.
- Load `.codex/skills/cf-guardrails/SKILL.md` before adding routes or images. One newsletter image also occupies a main Worker public-asset slot.
- Every meaningful edit gets its own speculative commit, following `AGENTS.md`.

## Workflow

1. Find the post URL in the Mega Crit sitemap. Record issue number, publication date, and URL.
2. Read the HTML. Split it into claims a player would answer: schedule, roadmap bullets, the next heading level under a roadmap, each Q&A answer, and each map drawing, Connections puzzle, and community image with its caption. Keep those sections. Do not drop fan art.
3. Add or update `data/sts2-neowsletters.json` (`id`, `issue`, `date`, `title`, `titleKo`, `sourceUrl`, `summary`, `summaryKo`).
4. Write paired notes:
   - `data/sts2-neowsletters/{id}.ko.md`
   - `data/sts2-neowsletters/{id}.md`
   - Separate claims with a line `<!-- claim:{claimId} -->`.
   - `claimId` is lowercase `[a-z0-9-]`, stable once published.
   - Use the same claim ids and order in both files.
   - Use patch-note tags: `[gold:card]`, `[gold:relic]`, `[gold:event]`, `[gold:character]`, `[gold:ascension]승천 10[/gold]` / `[gold:ascension]Ascension 10[/gold]`.
   - Put a game image on its own line: `![alt](/images/neowsletters/{id}/file.jpg)`.
   - Compress the file first. The markdown path must match the saved extension.
5. Keep the third tab label `니오우스레터` / `Neowsletter` and the routes `/patches/neowsletters` and `/patches/neowsletters/{id}`.
6. Rebuild patch HTML (`pnpm patch:html`) and copy assets (`pnpm patch:assets`) so `/patches` serves the new tab from the patch Worker.
7. Verify the Korean list, the Korean issue, and `/en/patches/neowsletters/{id}`: cover thumbnail, `spire-blue` source links with icons and arrows, gold names that stay inside the sentence, a comment control under each claim, and an open control with a count only where comments already exist.

## Image compression

Shrink images on the authoring machine, then commit the result. A newsletter image is a static asset on both the main Worker and the patch Worker. Request-time resize spends Worker CPU and is not the path.

Cap for every file under `public/images/neowsletters/{id}/`, including `cover.png` when the download exceeds it:

- Long edge at most 1600 px. Do not upscale a smaller image.
- JPEG, quality 80.
- File size at most 400 KB. If quality 80 is still over that, lower `formatOptions` until it fits.
- Leave a file alone when it is already inside both caps, including a small PNG such as a screenshot or pixel drawing.

macOS:

```sh
sips -Z 1600 -s format jpeg -s formatOptions 80 input.png --out output.jpg
```

If the extension changes, delete the original and point both locale markdown files at the new path. `cover.png` stays the thumbnail name when it already fits. When it does not, replace it with a JPEG only if `data/sts2-neowsletters.json` `imageUrl` is updated in the same change.

## Claim shape

A claim follows the original section or one Q&A answer. Translate the sentences. Do not shorten them into a briefing.

```markdown
<!-- claim:ascension-10 -->
Clapah이 묻습니다: 슬레이 더 스파이어 2가 너무 좋습니다. [gold:ascension]승천 10[/gold]의 밸런스를 생각하고 있었는데, 1편의 승천 20보다 꽤 쉽다는 걸 알고 있습니다.

Casey: 대체로 [gold:ascension]승천 10[/gold]이 이 게임에서 둘 가장 높은 난이도에 가깝다고 생각해 왔습니다.
```
