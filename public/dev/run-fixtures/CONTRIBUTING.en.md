# Donating STS2 Run Data

The **Run Replay** feature on 슬서운이야기 (Seul-seo-un Story) regenerates the map from a STS2 `.run` file's seed and overlays history on top. The more real-world plays we have across diverse situations, the better our reproduction accuracy and visualization quality. If you have any of the runs below in your history, sending them over is a huge help.

## What kinds of runs do we need?

Currently only v0.103.0+ builds reproduce accurately. Underrepresented categories:

- **Tezcatara Golden Compass** (`RELIC.GOLDEN_COMPASS`) acquired — drops from Tezcatara ancient
- **Nonupeipe Fur Coat** (`RELIC.FUR_COAT`) acquired — drops from Nonupeipe ancient
- Runs that picked up **Spoils Map** (`CARD.SPOILS_MAP`) **and made it to Act 2** — i.e. didn't die to the Act 1 boss
- Runs using **Winged Boots** (`RELIC.WINGED_BOOTS`) — across as many characters/ascensions as possible
- **High-ascension (A10) double boss** runs — saw two bosses on the final act
- Otherwise unusual seeds (memorable maps, rare encounters, etc.)

You can confirm the build by opening the `.run` file in any text editor and looking for `"build_id": "..."`. Builds older than v0.103.0 don't match our game source, so we can't validate them even if you send them.

## `.run` file location (per OS)

Replace `<steam-id>` and `<profile>` to match your install. Most users with a single profile have `profile1`.

### macOS

```
~/Library/Application Support/SlayTheSpire2/steam/<steam-id>/profile1/saves/history/
```

In Finder: `Cmd+Shift+G` → paste the path above.

### Windows

```
%APPDATA%\SlayTheSpire2\steam\<steam-id>\profile1\saves\history\
```

or

```
C:\Users\<username>\AppData\Roaming\SlayTheSpire2\steam\<steam-id>\profile1\saves\history\
```

Paste the path into Explorer's address bar.

### Linux

```
~/.local/share/SlayTheSpire2/steam/<steam-id>/profile1/saves/history/
```

or, under Steam Proton, somewhere beneath Steam's compatibility data:

```
~/.steam/steam/steamapps/compatdata/<app-id>/pfx/drive_c/users/steamuser/AppData/Roaming/SlayTheSpire2/...
```

## File structure

Each run is a `.run` file named after a Unix timestamp (e.g. `1776007587.run`). The contents are **JSON text** — readable in any plain-text editor.

## Privacy

`.run` files **do not contain account info, email, real name, or any other PII**. What they do contain:

- seed, build, ascension, game mode, win/loss
- character, card/relic lists with the floor each was acquired on
- map node-type sequence + per-floor HP/Gold snapshots
- encounter IDs, turn counts

Your Steam ID is only in the folder path, never inside the files. Safe to share.

## How to send

- One or two files: just attach them (Slack / email / DM)
- Many files: zip the whole `history` folder
- Telling us the `seed` field makes the run instantly identifiable

## What happens to donated runs

Donated runs get moved into `public/dev/run-fixtures/` under a meaningful filename and registered in `index.json`. From there the verification script (`scripts/verify-replay-fixtures.ts`) and the dev page (`/dev/run-replay`) pick them up immediately.
