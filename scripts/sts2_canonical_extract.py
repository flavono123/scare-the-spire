#!/usr/bin/env python3
"""Extract canonical per-build game facts from decompiled sts2 sources.

Input : <root>/<version>/src   (scripts/sts2_decompile_builds.py)
Output: <root>/<version>/canonical/{cards,relics,potions,powers,monsters}.json and canonical/loc/<lang>/<table>.json (the build's own text)

These are what the game itself ships in each build, so the versioned entity API
can be checked against them (scripts/audit-version-api-canonical.ts).
Only numeric / structural facts are extracted; text comes from the PCK.

Usage: python3 scripts/sts2_canonical_extract.py [--force] [version ...]
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = Path(os.environ.get("STS2_BUILDS_DIR", Path.home() / "sts2-builds"))
sys.path.insert(0, str(HERE))


def _load(name: str, file: str):
    spec = importlib.util.spec_from_file_location(name, HERE / file)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


pm = _load("parse_monsters", "parse-monsters.py")
pv = _load("parse_entity_vars", "parse-entity-vars.py")

# Old and new decompiles spell the type with or without the System.* prefix.
_CANON_RE = re.compile(
    r"override\s+(?:System\.Collections\.Generic\.)?IEnumerable<DynamicVar>\s+CanonicalVars\s*=>\s*"
)


def canonical_block(text: str) -> str:
    m = _CANON_RE.search(text)
    if not m:
        return ""
    depth, j = 0, m.end()
    while j < len(text):
        c = text[j]
        if c in "({[":
            depth += 1
        elif c in ")}]":
            depth -= 1
        elif c == ";" and depth == 0:
            return text[m.end():j]
        j += 1
    return text[m.end():]


def vars_of(text: str) -> dict:
    out: dict = {}
    block = canonical_block(text)
    for cls, generic, args in pv.find_var_calls(block):
        parsed = pv.parse_var(cls, generic, args)
        if parsed and not isinstance(parsed[1], dict):
            out.setdefault(parsed[0], parsed[1])
    return out


def class_info(text: str):
    m = re.search(r"public\s+(?:sealed\s+)?(?:abstract\s+)?class\s+(\w+)\s*:\s*(\w+)", text)
    return (m.group(1), m.group(2)) if m else (None, None)


BASE_RE = re.compile(r":\s*base\(\s*(-?\d+)\s*,\s*CardType\.(\w+)\s*,\s*CardRarity\.(\w+)\s*,\s*TargetType\.(\w+)")
KEYWORDS_RE = re.compile(r"CanonicalKeywords\s*(?:=>\s*(.*?);|\{.*?\n\t\})", re.S)
UP_VAR_RE = re.compile(r"base\.DynamicVars\.(\w+)\.UpgradeValueBy\(\s*(-?[\d.]+)m?\s*\)")
UP_COST_RE = re.compile(r"base\.EnergyCost\.UpgradeBy\(\s*(-?\d+)\s*\)")
UP_KW_RE = re.compile(r"base\.(Add|Remove)Keyword\(CardKeyword\.(\w+)\)")


def power_aliases(vars_: dict) -> dict:
    # PowerVar<VulnerablePower> is readable both as VulnerablePower and Vulnerable.
    out = dict(vars_)
    for k, v in vars_.items():
        if k.endswith("Power") and len(k) > 5:
            out.setdefault(k[:-5], v)
    return out


def num(s: str):
    f = float(s)
    return int(f) if f.is_integer() else f


def extract_cards(src: Path) -> dict:
    out = {}
    d = src / "MegaCrit.Sts2.Core.Models.Cards"
    for p in sorted(d.glob("*.cs")) if d.exists() else []:
        text = p.read_text(encoding="utf-8")
        cls, base = class_info(text)
        if not cls or base != "CardModel" or "abstract" in text.split(f"class {cls}")[0][-40:]:
            continue
        m = BASE_RE.search(text)
        if not m:
            continue
        up_vars: dict = {}
        body = ""
        um = re.search(r"override void OnUpgrade\(\)\s*\{(.*?)\n\t\}", text, re.S)
        if um:
            body = um.group(1)
        for k, v in UP_VAR_RE.findall(body):
            up_vars[k] = up_vars.get(k, 0) + num(v)
        cost_up = sum(int(x) for x in UP_COST_RE.findall(body))
        add_kw = [k for a, k in UP_KW_RE.findall(body) if a == "Add"]
        rem_kw = [k for a, k in UP_KW_RE.findall(body) if a == "Remove"]
        km = KEYWORDS_RE.search(text)
        # ILSpy drops the values of array initializers (InitializeArray); report unknown instead of empty.
        kw_text = km.group(0) if km else ""
        keywords = None if "InitializeArray" in kw_text else re.findall(r"CardKeyword\.(\w+)", kw_text)
        star = re.search(r"CanonicalStarCost\s*=>\s*(-?\d+)", text)
        out[pv.slugify(cls)] = {
            "cost": int(m.group(1)),
            "isXCost": bool(re.search(r"HasEnergyCostX\s*=>\s*true", text)),
            "starCost": int(star.group(1)) if star else None,
            "type": m.group(2),
            "rarity": m.group(3),
            "target": m.group(4),
            "vars": power_aliases(vars_of(text)),
            "keywords": keywords,
            "upgrade": {"vars": up_vars, "cost": cost_up or None, "addKeywords": add_kw, "removeKeywords": rem_kw},
        }
    return out


def extract_entities(src: Path, namespace: str, base_name: str, rarity_re: str | None) -> dict:
    out = {}
    d = src / namespace
    for p in sorted(d.glob("*.cs")) if d.exists() else []:
        text = p.read_text(encoding="utf-8")
        cls, base = class_info(text)
        if not cls or base != base_name:
            continue
        rec = {"vars": vars_of(text)}
        if rarity_re:
            m = re.search(rarity_re, text)
            rec["rarity"] = m.group(1) if m else None
        out[pv.slugify(cls)] = rec
    return out


def extract_monsters(src: Path) -> dict:
    out = {}
    d = src / "MegaCrit.Sts2.Core.Models.Monsters"
    for p in sorted(d.glob("*.cs")) if d.exists() else []:
        text = p.read_text(encoding="utf-8")
        cls, base = class_info(text)
        if not cls or base != "MonsterModel":
            continue
        try:
            hp = pm.parse_hp(text)
            move_ids, dmg, blk, meta = pm.parse_moves_and_damage(text)
            graph = pm.parse_move_graph(text)
        except Exception as e:  # keep going: one odd class must not stop the build
            out[pv.slugify(cls)] = {"error": str(e)}
            continue
        out[pv.slugify(cls)] = {
            "minHp": hp["min_hp"], "minHpAscension": hp["min_hp_ascension"],
            "maxHp": hp["max_hp"], "maxHpAscension": hp["max_hp_ascension"],
            "moveIds": [pm.strip_move_suffix(m) for m in move_ids],
            "damageValues": dmg, "blockValues": blk,
            "moves": {k: {"intents": v["intents"], "intentDetails": v["intent_details"]} for k, v in meta.items()},
            "moveGraph": graph and {"initial": graph.get("initial"), "transitions": [(t["from"], t["to"], t.get("chance"), t.get("condition")) for t in graph["transitions"]]},
        }
    return out


LOC_TABLES = ["cards", "relics", "potions", "powers", "enchantments", "afflictions", "monsters", "encounters", "events", "ancients"]
PCK = "SlayTheSpire2.app/Contents/Resources/Slay the Spire 2.pck"


def extract_localization(vd: Path, out: Path) -> None:
    """Copy the build's own eng/kor text tables (flat "<ID>.title" -> string)."""
    pck = vd / PCK
    if not pck.exists():
        return
    from lib.pck import PCKReader  # noqa: E402
    reader = PCKReader(str(pck))
    try:
        for lang in ("eng", "kor"):
            (out / "loc" / lang).mkdir(parents=True, exist_ok=True)
            for table in LOC_TABLES:
                path = f"localization/{lang}/{table}.json"
                if path in reader.entries:
                    (out / "loc" / lang / f"{table}.json").write_text(
                        json.dumps(reader.read_json(path), ensure_ascii=False, indent=1, sort_keys=True))
    finally:
        reader.close()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--kinds", default="", help="comma list (cards,relics,potions,powers,monsters,loc); default all")
    ap.add_argument("versions", nargs="*")
    args = ap.parse_args()
    for vd in sorted(p for p in ROOT.iterdir() if p.is_dir() and not p.name.startswith("_")):
        if args.versions and vd.name not in args.versions:
            continue
        src = vd / "src"
        out = vd / "canonical"
        if not src.exists():
            print("no src", vd.name)
            continue
        if out.exists() and not args.force and not args.kinds and (out / "monsters.json").exists():
            print("skip", vd.name)
            continue
        out.mkdir(exist_ok=True)
        kinds = set(filter(None, args.kinds.split(","))) or {"cards", "relics", "potions", "powers", "monsters", "loc"}
        makers = {
            "cards": lambda: extract_cards(src),
            "relics": lambda: extract_entities(src, "MegaCrit.Sts2.Core.Models.Relics", "RelicModel", r"RelicRarity\s+Rarity\s*=>\s*RelicRarity\.(\w+)"),
            "potions": lambda: extract_entities(src, "MegaCrit.Sts2.Core.Models.Potions", "PotionModel", r"PotionRarity\s+Rarity\s*=>\s*PotionRarity\.(\w+)"),
            "powers": lambda: extract_entities(src, "MegaCrit.Sts2.Core.Models.Powers", "PowerModel", None),
            "monsters": lambda: extract_monsters(src),
        }
        data = {k: makers[k]() for k in makers if k in kinds}
        for k, v in data.items():
            (out / f"{k}.json").write_text(json.dumps(v, ensure_ascii=False, indent=1, sort_keys=True))
        if "loc" in kinds:
            extract_localization(vd, out)
        print("extracted", vd.name, {k: len(v) for k, v in data.items()}, flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
