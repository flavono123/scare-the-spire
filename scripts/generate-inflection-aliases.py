#!/usr/bin/env python3
"""Inflected names the game shows another resource's hover tip for.

A card, relic, power or potion whose text has [gold]Exhausted[/gold] or [gold]꿰뚫린[/gold]
attaches the Exhaust or Impaled tip in its C# class (HoverTipFactory). This pairs each such
gold word with the tip its own class attaches, so the site's renderers can show the same tip
for the inflected word. English keyword titles also get their regular -s/-es/-ed forms.

Reads data/sts2/localization and the decompiled DLL (default /tmp/sts2-src, see update-game-assets).
Writes data/sts2/inflection-aliases.json: {"kor"|"eng": {"<type>:<ID>": [alias, ...]}}.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOC = ROOT / "data/sts2/localization"
OUT = ROOT / "data/sts2/inflection-aliases.json"
TABLES = [("cards", "Cards", ""), ("relics", "Relics", ""), ("powers", "Powers", "Power"), ("potions", "Potions", "")]
TIP_RE = re.compile(r"HoverTipFactory\.(\w+)(?:<(\w+)>)?\((?:(?:CardKeyword|StaticHoverTip)\.(\w+))?")


def snake(name: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).upper()


def tip_entity(method: str, generic: str | None, enum: str | None) -> str | None:
    """The site entity ("type:ID") a HoverTipFactory call shows."""
    if method == "FromKeyword" and enum:
        return f"keyword:{snake(enum)}"
    if method == "Static" and enum:
        key = snake(enum)
        return "keyword:" + {"SUMMON_DYNAMIC": "SUMMON_STATIC", "REPLAY_DYNAMIC": "REPLAY", "REPLAY_STATIC": "REPLAY"}.get(key, key)
    if method == "ForArrow":
        return "keyword:ARROW"
    if method == "ForEnergy":
        return "keyword:ENERGY"
    if not generic:
        return None
    if method.startswith("FromPower"):
        return f"power:{snake(generic.removesuffix('Power'))}"
    if method.startswith("FromCard"):
        return f"card:{snake(generic)}"
    if method == "FromOrb":
        return f"keyword:{snake(generic)}"
    return None


def load(loc: str, table: str) -> dict:
    return json.loads((LOC / loc / f"{table}.json").read_text(encoding="utf-8"))


def entity_titles(loc: str) -> dict[str, str]:
    """"type:ID" -> title for every entity a tip can point at."""
    titles = {}
    strip = lambda v: re.sub(r"\{Hotkey:.*?\(\{\}\)\}", "", v).strip()
    for k, v in load(loc, "card_keywords").items():
        if k.endswith(".title"):
            titles[f"keyword:{k[:-6]}"] = strip(v)
    # Keyword ids as the site lists them (src/lib/codex-data.ts): one Replay and one Summon entry, no energy counter.
    site_ids = {"REPLAY_STATIC": "REPLAY", "REPLAY_DYNAMIC": None, "SUMMON_DYNAMIC": None, "ENERGY_COUNT": None}
    for k, v in load(loc, "static_hover_tips").items():
        if k.endswith(".title"):
            site_id = site_ids.get(k[:-6], k[:-6])
            if site_id:
                titles.setdefault(f"keyword:{site_id}", strip(v))
    for k, v in load(loc, "orbs").items():
        if k.endswith(".title"):
            titles[f"keyword:{k[:-6]}"] = strip(v)
    for k, v in load(loc, "powers").items():
        if k.endswith(".title"):
            titles[f"power:{k[:-6].removesuffix('_POWER')}"] = v.strip()
    for k, v in load(loc, "cards").items():
        if k.endswith(".title"):
            titles[f"card:{k[:-6]}"] = v.strip()
    return titles


# Verb and noun keywords cards attach (CardKeyword / StaticHoverTip in the DLL); adjectives such as
# Eternal, Ethereal, Innate, Sly, Unplayable and Fatal have no -s/-ed forms.
GAMEPLAY_KEYWORDS = [f"keyword:{k}" for k in (
    "EXHAUST", "RETAIN", "REPLAY", "TAROT", "ARROW", "FORGE", "SUMMON_STATIC", "CHANNELING", "EVOKE",
    "STUN", "TRANSFORM", "BLOCK", "COOK",
)]


NOUN_KEYWORDS = {"keyword:TAROT", "keyword:ARROW"}  # plural only


def regular_forms(word: str) -> set[str]:
    plural = word + ("es" if re.search(r"(s|sh|ch|x|z)$", word) else "s")
    if word.endswith("e"):
        past = word + "d"
    elif re.search(r"^[^aeiou]*[aeiou][bdgmnprt]$", word.lower()):
        past = word + word[-1] + "ed"  # Stun -> Stunned
    else:
        past = word + "ed"
    return {plural, past}


def is_inflection(word: str, base: str, loc: str) -> bool:
    if word == base or len(base) < 2:
        return False
    w, b = word.lower(), base.lower()
    if loc == "eng":
        return w.startswith(b) or (len(b) > 3 and w.startswith(b[:-1]))
    common = next((i for i, (x, y) in enumerate(zip(w, b)) if x != y), min(len(w), len(b)))
    return w.startswith(b) or common >= max(2, len(b) - 1)


def generate(src: Path) -> dict:
    out: dict[str, dict[str, set[str]]] = {}
    for loc in ("kor", "eng"):
        titles = entity_titles(loc)
        every_title = {t for t in titles.values()}
        found: dict[str, set[str]] = {}
        for table, folder, suffix in TABLES:
            for key, text in load(loc, table).items():
                if not key.endswith(".description") or not isinstance(text, str):
                    continue
                model = "".join(w.capitalize() for w in key[: -len(".description")].removesuffix("_POWER").lower().split("_"))
                cs = src / f"MegaCrit.Sts2.Core.Models.{folder}" / f"{model}{suffix}.cs"
                if not cs.exists():
                    continue
                tips = {e for e in (tip_entity(*m) for m in TIP_RE.findall(cs.read_text(encoding="utf-8"))) if e in titles}
                for word in re.findall(r"\[gold\]([^\[]+)\[/gold\]", text):
                    word = word.strip()
                    if word in every_title:
                        continue
                    for entity in tips:
                        if is_inflection(word, titles[entity], loc):
                            found.setdefault(entity, set()).add(word)
        if loc == "eng":
            # Regular English forms (Exhausts, Arrows, Replays) of the keywords the game attaches to card text.
            for entity in GAMEPLAY_KEYWORDS:
                title = titles.get(entity, "")
                if re.fullmatch(r"[A-Za-z]{4,}", title):
                    forms = regular_forms(title)
                    if entity in NOUN_KEYWORDS:
                        forms = {f for f in forms if f.endswith("s")}
                    found.setdefault(entity, set()).update(forms - every_title)
        out[loc] = {e: sorted(v) for e, v in sorted(found.items())}
    return out


def self_check(data: dict) -> None:
    assert "꿰뚫린" in data["kor"].get("power:IMPALED", []), "Bow Smack's 꿰뚫린 should alias Impaled"
    assert "Exhausted" in data["eng"].get("keyword:EXHAUST", []), "Dark Embrace's Exhausted should alias Exhaust"
    assert regular_forms("Stun") == {"Stuns", "Stunned"} and regular_forms("Forge") == {"Forges", "Forged"}
    assert not any(a.endswith(("aled", "abled")) for v in data["eng"].values() for a in v), "adjective keywords get no -ed"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", default="/tmp/sts2-src", help="decompiled sts2.dll root")
    args = parser.parse_args()
    data = generate(Path(args.source))
    self_check(data)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)}: " + ", ".join(f"{loc} {len(v)} resources" for loc, v in data.items()))
