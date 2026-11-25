# Toy Box source discovery

1. Precedents (pattern evidence, not a catalog): `src/data/place-registry.json`
   (token, art, parent), `src/messages/service.ts` (subtitles, nicknames),
   `src/lib/borrowed-game-copy.ts` (titles, heroes).
2. Named things: `bin/ssy find <id|name>` gives the official ko/en name, type
   and URL. Never translate an id yourself.
3. Theme phrases and art the tool can't name:
   ```bash
   rg -ni 'term' data/sts2/localization/kor data/sts2/localization/eng
   rg --files public/images/sts2 | rg -i 'term'
   rg -ni 'TypeName|MODEL_ID' src scripts data   # relationships JSON lacks
   ```
4. Only if that leaves a real gap, inspect the current local PCK or DLL per
   `$update-game-assets` (`scripts/lib/pck.py`; decompile with `ilspycmd`, and
   reuse `/tmp/sts2-src` only if it matches the installed version). Check
   `data/sts2/meta.json` against the game's `release_info.json` before mixing
   sources. Extract only the chosen asset with the narrowest existing extractor.

Never claim two resources are related unless data, scenes or code show it.
