#!/usr/bin/env python3
"""Build Compendium card rows (data/sts2/{eng,kor}/cards.json) from the game.

Sources: decompiled DLL (/tmp/sts2-src, see update-game-assets) for cost, type,
rarity, target, star cost, vars, tags and OnUpgrade; PCK localization in
data/sts2/localization/{eng,kor}/cards.json for names and description_raw.
`description` is baked with src/lib/codex-bake.ts (library form: Calculated*
vars show CalculationBase), exactly as the Compendium renders it.

Modes:
  (default)        append a row for every pooled card class with a localization
                   title but no row yet (Deprecated/Mock pools are skipped)
  --update ID ...  rebuild the game-derived fields of existing rows
  --report         print every field where an existing row differs from the game
                   (review aid after a patch; older rows carry legacy noise in
                   derived fields such as Calculated* vars and hit_count)
A self-check runs first: rebuilt rows for unchanged cards must equal the stored
rows. Keywords and upgrade add_/remove_ ops come from
scripts/parse-card-keywords.py, which runs at the end of every write.

Usage: python3 scripts/add-sts2-new-cards.py [--src DIR] [--dry-run] [--report | --update ID ...]
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import re
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DATA = REPO / "data/sts2"
sys.path.insert(0, str(REPO / "scripts"))
import sts2_canonical_extract as ce  # noqa: E402

pv = ce.pv
# shortcut: parse-entity-vars.py DEFAULT_NAMES predates these XxxVar shorthands; move them there when it is next edited.
pv.DEFAULT_NAMES.setdefault("HitCountVar", "HitCount")
pv.DEFAULT_NAMES.setdefault("OstyDamageVar", "OstyDamage")


def _load(name: str, file: str):
    spec = importlib.util.spec_from_file_location(name, REPO / "scripts" / file)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


kw = _load("parse_card_keywords", "parse-card-keywords.py")

CARDS_NS = "MegaCrit.Sts2.Core.Models.Cards"
POOLS_NS = "MegaCrit.Sts2.Core.Models.CardPools"
SKIP_POOLS = {"Deprecated", "Deprived", "Mock"}
KO_TYPE = {"Attack": "공격", "Skill": "스킬", "Power": "파워", "Status": "상태이상", "Curse": "저주", "Quest": "퀘스트"}
KO_RARITY = {
    "Basic": "기본", "Common": "일반", "Uncommon": "고급", "Rare": "희귀", "Ancient": "고대의 존재",
    "Event": "이벤트", "Token": "토큰", "Status": "상태이상", "Curse": "저주", "Quest": "퀘스트",
}
# Unchanged cards covering energy/star/X cost, cost and keyword upgrades, power vars and tags.
SELF_CHECK = ["BASH", "FALLING_STAR", "BARRICADE", "ACCURACY", "AFTERIMAGE", "STRIKE_IRONCLAD", "BIASED_COGNITION", "WITHER"]
GAME_FIELDS = ["cost", "is_x_cost", "is_x_star_cost", "star_cost", "type", "rarity", "target", "color", "damage", "block",
               "hit_count", "powers_applied", "cards_draw", "energy_gain", "hp_loss", "tags", "vars", "upgrade"]
# Multi-level cards (DingyDagger): UpgradeValueBy(N + CurrentUpgradeLevel); the level is 1 during the first upgrade.
UP_LEVEL_RE = re.compile(r"base\.DynamicVars(?:\.|\[\")(\w+)(?:\"\])?\.UpgradeValueBy\(\s*(-?\d+)\s*\+\s*base\.CurrentUpgradeLevel\s*\)")


def card_pools(src: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    for p in sorted((src / POOLS_NS).glob("*CardPool.cs")):
        pool = p.name[: -len("CardPool.cs")]
        for cls in re.findall(r"ModelDb\.Card<(\w+)>\(\)", p.read_text(encoding="utf-8")):
            out.setdefault(pv.slugify(cls), pool)
    return out


def loc(lang: str, table: str) -> dict[str, str]:
    return json.loads((DATA / "localization" / lang / f"{table}.json").read_text(encoding="utf-8"))


def title(cards_loc: dict, cid: str, text: str) -> str | None:
    if f"{cid}.title" in cards_loc:
        return cards_loc[f"{cid}.title"]
    # Title variants (DINGY_DAGGER.title.dingy|fine|pristine): the class picks the first one at upgrade level 0.
    m = re.search(rf'"{cid}\.title\.(\w+)"', text)
    return cards_loc.get(f"{cid}.title.{m.group(1)}") if m else None


def ordered_vars(text: str, star_cost) -> dict | None:
    out: dict = {}
    for cls, generic, args in pv.find_var_calls(ce.canonical_block(text)):
        parsed = pv.parse_var(cls, generic, args)
        if not parsed or isinstance(parsed[1], dict) or parsed[0] in out:
            continue
        out[parsed[0]] = parsed[1]
        if parsed[0].endswith("Power") and len(parsed[0]) > 5:
            out.setdefault(parsed[0][:-5], parsed[1])
    if star_cost is not None:
        out["StarCost"] = star_cost
    return out or None


def signed(v) -> str:
    v = ce.num(str(v))
    return f"+{v}" if v >= 0 else str(v)


def upgrade_of(text: str, cost: int) -> dict | None:
    m = re.search(r"override void OnUpgrade\(\)\s*\{(.*?)\n\t\}", text, re.S)
    body = m.group(1) if m else ""
    up: dict = {}
    for name, v in ce.UP_VAR_RE.findall(body):
        key = name.lower()
        up[key] = signed(ce.num(up.get(key, "0")) + ce.num(v))
    for name, v in UP_LEVEL_RE.findall(body):
        up[name.lower()] = signed(int(v) + 1)
    delta = sum(int(x) for x in ce.UP_COST_RE.findall(body))
    if delta:
        up["cost"] = cost + delta  # rows store the upgraded cost, not the delta
    return up or None


def build(cid: str, text: str, color: str, lang: str, tables: dict) -> dict:
    m = ce.BASE_RE.search(text)
    cost, ctype, rarity, target = int(m.group(1)), m.group(2), m.group(3), m.group(4)
    star = re.search(r"CanonicalStarCost\s*=>\s*(-?\d+)", text)
    star_cost = int(star.group(1)) if star else None
    vars_ = ordered_vars(text, star_cost)
    v = vars_ or {}
    powers = [
        {"power": tables["powers"].get(f"{pv.slugify(g)}.title", g[:-5]), "amount": ce.num(str(val))}
        for cls, g, args in pv.find_var_calls(ce.canonical_block(text))
        if cls == "PowerVar" and g and (val := pv.parse_var(cls, g, args)) and (val := val[1]) is not None
    ]
    tags = re.search(r"CanonicalTags\s*=>\s*new HashSet<CardTag>\s*(\{[^}]*\}|\(\))", text)
    raw = tables["cards"].get(f"{cid}.description", "")
    return {
        "id": cid,
        "name": title(tables["cards"], cid, text),
        "description": None,  # baked in bulk later
        "description_raw": raw,
        "cost": cost,
        "is_x_cost": True if re.search(r"HasEnergyCostX\s*=>\s*true", text) else None,
        "is_x_star_cost": True if re.search(r"HasStarCostX\s*=>\s*true", text) else None,
        "star_cost": star_cost,
        "type": ctype if lang == "eng" else KO_TYPE[ctype],
        "rarity": rarity if lang == "eng" else KO_RARITY[rarity],
        "target": target,
        "color": color,
        "damage": v.get("Damage"),
        "block": v.get("Block"),
        "hit_count": v.get("HitCount"),
        "powers_applied": powers or None,
        "cards_draw": v.get("Cards"),
        "energy_gain": v.get("Energy"),
        "hp_loss": v.get("HpLoss"),
        "keywords": None,  # parse-card-keywords.py
        "tags": re.findall(r"CardTag\.(\w+)", tags.group(1)) or None if tags else None,
        "spawns_cards": None,
        "vars": vars_,
        "upgrade": upgrade_of(text, cost),
    }


def bake(rows: list[dict]) -> None:
    """Fill `description` via the site's own baker (one tsx process for all rows)."""
    js = (
        "import { bakeDescription, withLibraryCalculatedVars } from '" + str(REPO / "src/lib/codex-bake.ts") + "';"
        "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{"
        "process.stdout.write(JSON.stringify(JSON.parse(s).map(([r,v])=>bakeDescription(r,withLibraryCalculatedVars(v??{},r)))));});"
    )
    payload = json.dumps([[r["description_raw"], r["vars"]] for r in rows])
    out = subprocess.run([str(REPO / "node_modules/.bin/tsx"), "--eval", js], input=payload, capture_output=True, text=True, check=True)
    for r, d in zip(rows, json.loads(out.stdout)):
        r["description"] = d


def image_urls(cid: str, text: str) -> tuple[str | None, str | None]:
    m = re.search(r'return "(\w+)";\s*\}\s*$', text.split("GetPortraitFilename()")[-1], re.M)
    slug = (m.group(1) if m else cid.lower())
    pub = REPO / "public/images/sts2"
    return (
        f"/static/images/cards/{slug}.png" if (pub / "cards" / f"{slug}.webp").exists() else None,
        f"/static/images/cards/beta/{slug}.png" if (pub / "cards-beta" / f"{slug}.webp").exists() else None,
    )


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--src", type=Path, default=Path("/tmp/sts2-src"))
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--report", action="store_true")
    ap.add_argument("--update", nargs="+", default=[])
    args = ap.parse_args()

    classes = {pv.slugify(p.stem): p.read_text(encoding="utf-8") for p in (args.src / CARDS_NS).glob("*.cs")}
    pools = card_pools(args.src)
    version = "v" + json.loads((DATA / "meta.json").read_text())["version"].lstrip("v")
    files = {lang: json.loads((DATA / lang / "cards.json").read_text(encoding="utf-8")) for lang in ("eng", "kor")}
    tables = {lang: {"cards": loc(lang, "cards"), "powers": loc(lang, "powers")} for lang in files}

    def rebuild(cid: str, lang: str, color: str) -> dict:
        return build(cid, classes[cid], color, lang, tables[lang])

    # Self-check: unchanged cards must round-trip.
    for lang, rows in files.items():
        by_id = {r["id"]: r for r in rows}
        built = [rebuild(cid, lang, by_id[cid]["color"]) for cid in SELF_CHECK]
        bake(built)
        for b in built:
            have = by_id[b["id"]]
            for f in GAME_FIELDS + ["name", "description", "description_raw"]:
                got = b[f]
                if f == "upgrade" and have["upgrade"]:  # keyword ops belong to parse-card-keywords.py
                    got = {**(got or {}), **{k: v for k, v in have["upgrade"].items() if k.startswith(("add_", "remove_"))}} or None
                assert got == have[f], f"self-check {lang} {b['id']}.{f}: built {got!r} != stored {have[f]!r}"
    print(f"self-check ok ({len(SELF_CHECK)} cards x eng/kor)")

    if args.report:
        for lang, rows in files.items():
            built = [rebuild(r["id"], lang, r["color"]) for r in rows if r["id"] in classes and not r.get("deprecated")]
            bake(built)
            have = {r["id"]: r for r in rows}
            for b in built:
                for f in GAME_FIELDS + ["name", "description", "description_raw"]:
                    h = have[b["id"]][f]
                    if f == "upgrade" and h:
                        h = {k: v for k, v in h.items() if not k.startswith(("add_", "remove_"))} or None
                    if b[f] != h:
                        print(f"{lang} {b['id']}.{f}: {h!r} -> {b[f]!r}")
        return 0

    changed: list[str] = []
    for lang, rows in files.items():
        by_id = {r["id"]: r for r in rows}
        if args.update:
            built = [rebuild(cid, lang, by_id[cid]["color"]) for cid in args.update]
            bake(built)
            for b in built:
                row = by_id[b["id"]]
                ops = {k: v for k, v in (row["upgrade"] or {}).items() if k.startswith(("add_", "remove_"))}
                for f in GAME_FIELDS + ["description", "description_raw"]:
                    row[f] = b[f]
                row["upgrade"] = {**(row["upgrade"] or {}), **ops} or None
                changed.append(f"{lang} update {b['id']}")
            continue
        new = [
            rebuild(cid, lang, pools[cid].lower())
            for cid in sorted(classes)
            if cid not in by_id and pools.get(cid) and pools[cid] not in SKIP_POOLS and title(tables[lang]["cards"], cid, classes[cid])
        ]
        bake(new)
        for b in new:
            img, beta = image_urls(b["id"], classes[b["id"]])
            row = {**b, "introducedInPatch": version, "image_url": img, "beta_image_url": beta}
            if lang == "eng":  # English-name order; existing rows keep their place
                idx = next((i for i, r in enumerate(rows) if r["name"].lower() > b["name"].lower()), len(rows))
                rows.insert(idx, row)
            else:
                by_id[b["id"]] = row
            changed.append(f"{lang} add {b['id']} ({b['color']})")
        if lang == "kor" and new:  # kor rows follow the eng order
            files["kor"] = rows = [by_id[r["id"]] for r in files["eng"]]
    print("\n".join(changed) or "nothing to do")
    if changed and not args.dry_run:
        for lang, rows in files.items():
            (DATA / lang / "cards.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        game = kw.parse_source(args.src)
        for lang in files:
            print(f"[{lang}] keywords: {len(kw.sync_locale(lang, game, False))} change(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
