# Donating STS2 Run Data — TLDR

Sending your `.run` files makes 슬서운이야기's **Run Replay** more accurate.

## What runs?

v0.103.0+ builds. Especially needed:

- **Golden Compass** / **Fur Coat** acquired
- **Spoils Map** picked up + made it to Act 2 (didn't die to Act 1 boss)
- **Winged Boots** runs
- **A10 double boss** runs
- Otherwise unusual / memorable seeds

## One-liner to zip your history folder

Creates `sts2-history.zip` on your Desktop. `<steam-id>` / `<profile>` are auto-globbed.

### macOS

```bash
zip -r ~/Desktop/sts2-history.zip ~/Library/Application\ Support/SlayTheSpire2/steam/*/profile*/saves/history
```

### Windows (PowerShell)

```powershell
Compress-Archive -Path "$env:APPDATA\SlayTheSpire2\steam\*\profile*\saves\history" -DestinationPath "$env:USERPROFILE\Desktop\sts2-history.zip"
```

### Linux

```bash
zip -r ~/Desktop/sts2-history.zip ~/.local/share/SlayTheSpire2/steam/*/profile*/saves/history
```

## Or zip via GUI

Open your file manager, navigate to the `saves/` folder, then right-click `history` and compress.

- **macOS**: Finder → `Cmd+Shift+G` → paste `~/Library/Application Support/SlayTheSpire2/steam/<steam-id>/profile1/saves/` → right-click `history` → **Compress "history"**
- **Windows**: Explorer address bar → paste `%APPDATA%\SlayTheSpire2\steam\<steam-id>\profile1\saves\` → right-click `history` → **Send to → Compressed (zipped) folder**
- **Linux**: file manager → `~/.local/share/SlayTheSpire2/steam/<steam-id>/profile1/saves/` → right-click `history` → **Compress**

## Where to send

Attach the zip via Slack / email / DM.

## Is it safe?

`.run` files contain **no account, email, or real name** — only seed, build, card/relic lists, map nodes, and HP/Gold snapshots. Your Steam ID is only in the folder path, never inside the files.

---

Full version → [CONTRIBUTING.en.md](./CONTRIBUTING.en.md) · 한국어 → [CONTRIBUTING.tldr.md](./CONTRIBUTING.tldr.md)
