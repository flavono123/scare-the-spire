---
name: slseoun-channel
description: Answer questions about the user's own YouTube channel 슬서운이야기 (@scarethespire) — "내 채널", "내 영상", "내 쇼츠", 조회수, 댓글, 시리즈, 예약, 썸네일 — from the local read-only channel view in slseoun-shorts instead of the YouTube API or web pages. Use when a feature or content task here needs what is on the channel: which shorts exist, how they did, what viewers said.
---

# 슬서운이야기 channel view

The channel is mirrored in `/Users/flavono123/P/slseoun-shorts` (uploads, scheduled
and private ones, daily counts, comments, playlists, series, the local export of
each upload). Read it with one command; it prints a few lines of text, needs no
network and changes nothing.

| Command (`python3 ~/P/slseoun-shorts/youtube/channel.py ...`) | Output |
| --- | --- |
| (no arguments) | One screen: channel counts, latest and scheduled uploads, recent comments, to-dos, series progress |
| `find <words>` | Matching videos, one line each, by export name, label (`베타 아트 21`), title, YouTube id, series or character |
| `video <name, id, label or 0.109>` | One video: title, state and time, counts, related video, thumbnail, local files, production note, comments |
| `series [name]` | Every series, or one series episode by episode |
| `comments [video] [--days N] [--grep word]` | Comments, one per line, newest first (`~` = date is approximate) |
| `top [--by views|likes|comments] [--days N]` | Ranking of public videos |
| `todo` | What to fix in YouTube Studio (related video, playlist, tags, game title) |
| `sync` | Refresh first, only when the output says `동기화 … 오래됨` (about 7 s) |

Add `--json` for the same data as JSON. Times are KST; `안 올림` is a short made
but not uploaded.

- Do not call the YouTube Data API, yt-dlp or youtube.com for these questions;
  the view already joins them.
- Do not copy the view, its database or viewer comments into this repo. Quote
  only what the task needs; comments are viewers' words.
- Making a short belongs to slseoun-shorts (see `shorts-asset-handoff`).
