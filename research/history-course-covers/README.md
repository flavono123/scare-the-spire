# History Course cover research

Local learning corpus for axis-1 YouTube-style covers.

```bash
# from repo root (needs .env.local + yt-dlp)
node research/history-course-covers/harvest.mjs
```

| File | Committed? | Role |
| --- | --- | --- |
| `LOGIC.md` | yes | `suggestCovers` SSOT |
| `patterns.md` | yes | harvest observations → templates |
| `sources.md` | yes | channel ids + 슬갤 seed URLs |
| `harvest.mjs` | yes | re-runnable collector |
| `*.json` / `*.jsonl` | no | dumps (combo, YT titles, 슬갤, deck stats) |
