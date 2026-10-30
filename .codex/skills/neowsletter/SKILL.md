---
name: neowsletter
description: Turn Mega Crit Neowsletter issues into the third 슬서운변경 tab, with Korean claim notes, Codex links, and per-claim comments, then ship it. Use for 니오우스레터, Neowsletter, /neowsletter, a Steam "The Neowsletter" news link (app 2868840 or the STS1 cross-post on 646570), newsletter backfill, or a month such as 2026-08.
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
- Put a comment claim on each `##` section and on the next heading level under it, such as `### 이미 들어간 것`. The `<!-- claim:{id} -->` line comes immediately before the heading that titles that claim. A heading left at the end of the previous claim inherits that claim's id, so the permalink is one section early. Keep one claim per Q&A answer. In map, quiz, and fan-art sections, give each image its own claim with the caption that belongs to that image.
- Mega Crit and Steam source links use the patch-note original style: `spire-blue`, no underline, a trailing arrow, plus the source icons in `public/images/neowsletters/source/`.
- The letter-wide comment block matches a patch detail comment section: heading `댓글` / `Comments`, not a separate “전체 댓글” title.
- Include the map-drawing, Connections, and community fan-art sections. Save those images under `public/images/neowsletters/{id}/`.
- Compress every saved image before commit. See **Image compression** below. Do not resize in the Worker.
- Record both originals: Mega Crit `sourceUrl` and the real Steam store `steamUrl` (`/news/app/2868840/view/{id}`). Do not build that URL from an API `gid`. The `{id}` is the announcement gid from `https://store.steampowered.com/events/ajaxgetpartnereventspageable/?clan_accountid=0&appid=2868840&offset=0&count=3&l=english` (`events[].announcement_body.gid`). A link the user pastes may be the STS1 cross-post (`/news/app/646570/...`); map it to the STS2 post by title.
- The Mega Crit sitemap can lag the post by a day. When the issue is missing there, try `https://megacrit.com/news/{YYYY}-{M}-{D}-neowsletter-issue-{N}/` with the Pacific publish date and accept it only when the page `<title>` is the issue title.
- The patch renderer strips any `[WORD]` as a tag. Write the source's `[REDACTED]` as `REDACTED`, and never put other text in square brackets outside a link.
- When an image is byte-identical to one already in an earlier issue (`cmp`), such as last month's Spire Spotting silhouette, point at the earlier path instead of saving a copy. Each copy costs an asset slot.
- Acts use official names: `[gold:act]과성장[/gold]`, `[gold:act]지하 선착장[/gold]`. Look names up in `data/sts2/{kor,eng}/*.json` by id before writing.
- Each claim has one comment affordance: Lucide `MessageCircle` with the index like/comment classes, grey until hover, then gold. An empty claim stays collapsed. A claim that already has comments opens by default, shows the count beside the label, and can still be collapsed. Opening it shows a one-line composer. Written comments sit in their own inset thread, still one line, with token, nickname, time, like, and delete on the right. Thread key is `neowsletter:{id}:{claimId}`. The letter-wide thread is `neowsletter:{id}:page`.
- Keep a `[gold]` tag inside its sentence. Do not break the line to move a relic or card out of the paragraph. Static hovers are `<template>` previews, not slabs rendered in the line. Do not use the low-HP character hover on these pages.
- Do not wrap asker names or sentences in `**bold**`. The patch renderer paints that as a gold entity. Use `###` for a subsection title.
- Mirror the original's emphasis in both locales with `[b]…[/b]`, `[i]…[/i]`, and `[s]…[/s]`: every `<strong>`, `<em>`, and `<del>` inside `<main>` of the Mega Crit HTML, including asker and speaker labels, credited names, dates, and nested spans such as `[b][i]SLAY THE SPIRE 2[/i] IS OUT NEXT MONTH!![/b]`. Bare `*…*` and `~~…~~` print literally, and `**…**` paints gold. All issues from 2024-08 on follow this.
  - List the spans from the HTML first. Each claim must carry the same tags in both files. `scripts/neowsletter-anchors.spec.ts` checks this: `pnpm tsx scripts/neowsletter-anchors.spec.ts`.
  - In Korean, wrap the clause that carries the same meaning, even when the word changes (`also` can land on `이기도`, `Slay the Spire 1` on `1편`). Do not add emphasis the original lacks. A bold or italic label the note writes as a `###` heading stays a plain heading.
  - Keep a `[gold]` tag inside the emphasis, not around it: `[b][gold:card]휘갈김[/gold][/b]`.
  - Never put a tag inside markdown link text. `[[i]x[/i] y](url)` breaks the link. Wrap the whole link: `[i][x y](url)[/i]`.
  - `[b]` renders as a bright `<strong>` with a thin stroke, because the Korean service font ships only a bold face and `font-bold` alone changes nothing there.
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
8. Ship it (see **Release** below).

## Release

A new issue ships as a `docs/RELEASE_PROCESS.md` §4 urgent release: speed first, no full smoke or feature QA. Local `main` is pushed whole, so what else rides along is the user's call.

1. Commit the data, both notes, and the images together, with `Feature:` / `Expect:` / `QA:` lines naming `/patches/neowsletters/{id}` and `/en/patches/neowsletters/{id}`.
2. `pnpm patch:test`, then `pnpm patch:build`. `.patch-worker/` is build output and is not committed.
3. Serve `.patch-worker/assets` statically (for example `python3 -m http.server 8788 --directory .patch-worker/assets`) and open the list and the issue. Check in the built HTML that every claim has a thread key (`neowsletter:{id}:`), no `[gold` text is left raw, and every `/images/neowsletters/{id}/` image loads. Missing `/images/sts2/ui/...` icons are main Worker assets and are expected on this static server.
4. If a commit carries a migration that is not applied yet, stop and ask (§4 step 4). Otherwise `git push origin main`. The pre-push hook runs `tsc`. `.github/workflows/cloudflare-workers.yml` deploys. Its "Detect Cloudflare deployment scope" step must route `data/sts2-neowsletters*` and `public/images/neowsletters/*` to `patch_changed`. Without that, only the main Worker ships and the new issue 404s.
5. When the run finishes, request `/patches/neowsletters/{id}` and `/en/patches/neowsletters/{id}` on production and expect 200 before reporting it shipped.
6. If the pushed range includes commits that were not QA'd, add it to UNRELEASED.md "긴급 배포로 QA 없이 나간 범위".

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
