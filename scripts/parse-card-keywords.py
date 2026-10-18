#!/usr/bin/env python3
"""Sync card `keywords` and upgrade keyword ops from the decompiled STS2 DLL.

The imported card data derived `keywords` partly from description text, so a
keyword word used as a condition ("when this card is Exhausted") became the
card's own keyword. The game's source of truth is each card class's
`CanonicalKeywords` override, plus `AddKeyword`/`RemoveKeyword` calls in
`OnUpgrade`.

Writes data/sts2/{eng,kor}/cards.json:
- `keywords`: CanonicalKeywords, localized from card_keywords.json titles
  (null when the card has none). Existing order is kept when the set matches.
- `upgrade.add_<kw>` / `upgrade.remove_<kw>`: from OnUpgrade keyword calls.

Prerequisites:
- Decompiled DLL source at /tmp/sts2-src (default). Produce with:
    ilspycmd -p -o /tmp/sts2-src "<sts2.dll path>"

Usage:
  python3 scripts/parse-card-keywords.py [--source DIR] [--dry-run]
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DATA_DIR = REPO / "data/sts2"
DEFAULT_SOURCE = Path("/tmp/sts2-src")
CARDS_NAMESPACE = "MegaCrit.Sts2.Core.Models.Cards"
LOCALES = ("eng", "kor")

_CANONICAL_RE = re.compile(
    r"IEnumerable<CardKeyword>\s+CanonicalKeywords\s*=>(?P<body>.*?);\s*$",
    re.S | re.M,
)
_KEYWORD_RE = re.compile(r"CardKeyword\.(\w+)")
_UPGRADE_RE = re.compile(
    r"void\s+OnUpgrade\s*\(\s*\)\s*\{(?P<body>.*?)^\t\}", re.S | re.M
)
_UPGRADE_KW_RE = re.compile(r"\b(Add|Remove)Keyword\s*\(\s*CardKeyword\.(\w+)\s*\)")


def class_to_id(name: str) -> str:
    return re.sub(r"(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])", "_", name).upper()


def parse_source(source: Path) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for path in sorted((source / CARDS_NAMESPACE).glob("*.cs")):
        text = path.read_text(encoding="utf-8")
        m = _CANONICAL_RE.search(text)
        keywords = _KEYWORD_RE.findall(m.group("body")) if m else []
        upgrade: dict[str, int] = {}
        um = _UPGRADE_RE.search(text)
        if um:
            for op, kw in _UPGRADE_KW_RE.findall(um.group("body")):
                upgrade[f"{op.lower()}_{kw.lower()}"] = 1
        out[class_to_id(path.stem)] = {"keywords": keywords, "upgrade": upgrade}
    return out


def keyword_titles(locale: str) -> dict[str, str]:
    table = json.loads(
        (DATA_DIR / "localization" / locale / "card_keywords.json").read_text(encoding="utf-8")
    )
    return {k[: -len(".title")]: v for k, v in table.items() if k.endswith(".title")}


def sync_locale(locale: str, game: dict[str, dict], dry_run: bool) -> list[str]:
    path = DATA_DIR / locale / "cards.json"
    cards = json.loads(path.read_text(encoding="utf-8"))
    titles = keyword_titles(locale)
    changes: list[str] = []
    for card in cards:
        info = game.get(card["id"])
        if info is None:
            changes.append(f"{card['id']}: skipped, no longer in {CARDS_NAMESPACE}")
            continue
        want = [titles[kw.upper()] for kw in info["keywords"]]
        have = card.get("keywords") or []
        if set(want) != set(have):
            card["keywords"] = want or None
            changes.append(f"{card['id']}: keywords {have} -> {want}")

        upgrade = card.get("upgrade") or {}
        have_ops = {k: v for k, v in upgrade.items() if k.startswith(("add_", "remove_"))}
        # Some entries spell an added keyword as `{"innate": true}`.
        bare = {f"add_{k}": 1 for k, v in upgrade.items() if v is True and k.upper() in titles}
        if {**have_ops, **bare} != info["upgrade"]:
            rest = {k: v for k, v in upgrade.items() if k not in have_ops and f"add_{k}" not in bare}
            merged = {**rest, **info["upgrade"]}
            card["upgrade"] = merged or None
            changes.append(f"{card['id']}: upgrade keyword ops {have_ops} -> {info['upgrade']}")
    if changes and not dry_run:
        path.write_text(json.dumps(cards, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return changes


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    game = parse_source(args.source)
    if not game:
        raise SystemExit(f"no card classes under {args.source / CARDS_NAMESPACE}")
    for locale in LOCALES:
        changes = sync_locale(locale, game, args.dry_run)
        print(f"[{locale}] {len(changes)} change(s)")
        for line in changes:
            print(f"  {line}")


if __name__ == "__main__":
    main()
