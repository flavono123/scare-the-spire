# baking

Bake `{Var}` template defaults into codex entity descriptions for
relics, potions, and powers — pulls base values out of the decompiled
`sts2.dll` and injects them into `data/sts2/{eng,kor}/{relics,potions,powers}.json`
so the runtime baker (`src/lib/codex-bake.ts`) can render filled
descriptions.

This skill should be used when:
- "베이크 갱신", "vars 갱신", "vars 추출", "디스크립션 베이크", "baking"
- A new STS2 patch changes default base values for relic/potion/power
- The codex shows literal `{FocusPower}` / `[blue]{Var}[/blue]` text
- Triggered from `/slseoun-patch` Step 7 after entity data changes
- Triggered from `/update-game-assets` after refreshing the DLL decompile

Do NOT use for: card descriptions (already baked at extraction time),
enchantment / monster / encounter / event JSON (no `vars` column).

## Prerequisites

- `/tmp/sts2-src/` populated with the current `sts2.dll` decompile.
  If missing or stale, run the decompile from `/update-game-assets`:
  ```bash
  DLL=~/Library/Application\ Support/Steam/steamapps/common/Slay\ the\ Spire\ 2/SlayTheSpire2.app/Contents/Resources/data_sts2_macos_arm64/sts2.dll
  rm -rf /tmp/sts2-src && PATH="$HOME/.dotnet/tools:$PATH" ilspycmd -p -o /tmp/sts2-src "$DLL"
  ```

## Workflow

```bash
# Dry-run first to verify coverage matches the JSON ID counts.
python3 scripts/parse-entity-vars.py --dry-run

# Apply (rewrites vars in place on data/sts2/{eng,kor}/{relics,potions,powers}.json).
python3 scripts/parse-entity-vars.py
```

Expected coverage on a clean patch:
- relics: 293/293 ids matched
- potions: 63/63 ids matched
- powers: ~256/260 ids matched (4 unmapped are deprecated card-driven powers)

If coverage drops sharply, follow the **Self-update rule** below.

## Verification

Spot-check the runtime baked output (dev server):
```bash
curl -s http://localhost:3000/codex/relics/DATA_DISK | grep -oE '"description\\":"[^"]*"' | head -1
# Expect: 매 전투 시작 시, [gold]밀집[/gold]을 [blue]1[/blue] 얻습니다.
```

Audit how many baked descriptions still contain `{Var}` (i.e. runtime
stack values fell through to the `X` placeholder, or a SmartFormat
shape isn't handled yet):
```bash
for url in /codex/relics /codex/potions /codex/powers; do
  count=$(curl -s "http://localhost:3000$url" 2>/dev/null \
    | python3 -c 'import sys,re; html=sys.stdin.read(); print(sum(1 for m in re.finditer(r"\\\"description\\\":\\\"((?:[^\\\\\"]|\\\\.){0,300}?)\\\"", html) if re.search(r"\{[A-Z][a-zA-Z]*", m.group(1))))')
  echo "$url: $count"
done
```

Acceptable leaks come from runtime-only vars (e.g. PowerVar.Amount on
some powers) which the baker substitutes with `X`. Anything else is a
SmartFormat shape the baker hasn't learned yet — extend
`renderBody` in `src/lib/codex-bake.ts`.

## Self-update rule (read every patch)

The decompiled C# surface drifts patch-to-patch. Before declaring an
extraction "done", verify the parser still covers what the new build
adds and **update this skill + scripts in the same commit** when it
doesn't:

1. After running the parser, scan the dry-run output for unexpected
   coverage dips (e.g. relics matched suddenly < the JSON id count).
2. List new `XxxVar` shorthands MegaCrit may have added:
   ```bash
   /bin/ls /tmp/sts2-src/MegaCrit.Sts2.Core.Localization.DynamicVars
   ```
   Cross-check against `DEFAULT_NAMES` in `scripts/parse-entity-vars.py`
   and add any missing ones (read the new class to confirm its
   `defaultName` constant).
3. List new entity model directories:
   ```bash
   /bin/ls /tmp/sts2-src | grep "MegaCrit.Sts2.Core.Models\."
   ```
   If a new kind that uses `{Var}` templates appears (e.g. a future
   `Models.Statuses`), extend `parse-entity-vars.py`'s `ENTITY_DIRS`,
   plumb a `vars` column into `codex-data.ts` for that kind, and
   document it in the bullet list above.
4. If the `CanonicalVars` syntax changes (e.g. a new collection helper
   replaces `_003C_003Ez__ReadOnlySingleElementList`), `find_var_calls`
   still works (it scans for `new XxxVar(...)`), but verify with a
   spot-check on a known relic like `DataDisk` (`{FocusPower: 1}`).
5. Rev `data/sts2/meta.json` to the new game version and commit
   parser changes + data refresh together so the diff reads as one
   patch rollup.

## Output Files

| File | Content |
|------|---------|
| `data/sts2/{eng,kor}/relics.json` | `vars` field on every relic |
| `data/sts2/{eng,kor}/potions.json` | `vars` field on every potion |
| `data/sts2/{eng,kor}/powers.json` | `vars` field on every power |

## Related

- Runtime baker: `src/lib/codex-bake.ts`
- Memory note: `~/.claude/projects/-Users-hansuk-hong-P-scare-the-spire/memory/codex_var_baking.md`
- Called from: `/slseoun-patch` Step 7 (Apply Entity Data Changes), `/update-game-assets` after entity parsers
