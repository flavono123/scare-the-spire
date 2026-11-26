#!/usr/bin/env python3
"""Hover tips the game attaches to each element, and which of its gold words name one.

The game colors a word with [gold] and, separately, gives each element a tip list in code
(HoverTipFactory calls in ExtraHoverTips / HoverTips / EventOption, plus the base model's
rules: a card's keywords, Block for GainsBlock, Evoke for orb cards). Gold words are never
tips by themselves. This pairs every gold word of an element's text, in every game locale,
with the tip of that element's own list whose title it spells (or a regular inflection:
Exhausted, 꿰뚫린) or with nothing.

Reads the decompiled DLL (default /tmp/sts2-src, see update-game-assets) and
data/sts2/localization. Writes:
- data/sts2/game-tips.json: {"tips": {type: {ID: [spec, ...]}}} (spec: {"kind", "id", ...})
- data/sts2/gold-tips/<locale>.json: {"<type>:<ID>": {gold word: "<kind>:<ID>" | null}}

Run on patch day after `pnpm i18n:sync`. The audit is `pnpm game-tips:audit` (reads only
committed data); deploys never run this script.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOC = ROOT / "data/sts2/localization"
TIPS_OUT = ROOT / "data/sts2/game-tips.json"
GOLD_OUT = ROOT / "data/sts2/gold-tips"


def _load(name: str, file: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / file)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


card_keywords = _load("parse_card_keywords", "parse-card-keywords.py")

STATIC_ENUM_TO_ID = {"ReplayDynamic": "REPLAY_DYNAMIC", "ReplayStatic": "REPLAY_STATIC",
                     "SummonDynamic": "SUMMON_DYNAMIC", "SummonStatic": "SUMMON_STATIC"}


def snake(name: str) -> str:
    return card_keywords.class_to_id(name)


def power_id(cls: str) -> str:
    return snake(cls.removesuffix("Power"))


TOKEN_RE = re.compile(
    r"FromForge\(\)"
    r"|ForEnergy\(|\bEnergyHoverTip\b"
    r"|ForArrow\(|\bArrowHoverTip\b"
    r"|Static\(StaticHoverTip\.(?P<static>\w+)"
    r"|FromKeyword\(CardKeyword\.(?P<keyword>\w+)\)"
    r"|FromPowerWithPowerHoverTips<(?P<power_tips>\w+)>"
    r"|FromPower<(?P<power>\w+)>"
    r"|FromCardWithCardHoverTips<(?P<card_tips>\w+)>(?P<card_tips_args>\([^)]*\))?"
    r"|FromCard<(?P<card>\w+)>(?P<card_args>\([^)]*\))?"
    r"|FromPotion<(?P<potion>\w+)>"
    r"|FromRelic(?:ExcludingItself)?<(?P<relic>\w+)>"
    r"|FromEnchantment<(?P<enchantment>\w+)>"
    r"|FromOrb<(?P<orb>\w+)>"
    r"|FromAffliction<(?P<affliction>\w+)>"
)


def tip_specs(body: str, src: Path, expand: bool = True) -> list[dict]:
    """HoverTipFactory calls in source order, as tip specs (duplicates dropped)."""
    specs: list[dict] = []
    for m in TOKEN_RE.finditer(body):
        raw = m.group(0)
        if raw.startswith("FromForge"):
            specs.append({"kind": "forge"})
        elif "Energy" in raw:
            specs.append({"kind": "static", "id": "ENERGY"})
        elif "Arrow" in raw:
            specs.append({"kind": "static", "id": "ARROW"})
        elif m.group("static"):
            enum = m.group("static")
            specs.append({"kind": "static", "id": STATIC_ENUM_TO_ID.get(enum, snake(enum))})
        elif m.group("keyword"):
            specs.append({"kind": "keyword", "id": snake(m.group("keyword"))})
        elif m.group("power_tips"):
            cls = m.group("power_tips")
            specs.append({"kind": "power", "id": power_id(cls)})
            if expand:
                specs.extend(tip_specs(member_body(read(src / "MegaCrit.Sts2.Core.Models.Powers" / f"{cls}.cs"), "ExtraHoverTips"), src, False))
        elif m.group("power"):
            specs.append({"kind": "power", "id": power_id(m.group("power"))})
        elif m.group("card_tips") or m.group("card"):
            args = m.group("card_tips_args") or m.group("card_args") or ""
            spec = {"kind": "card_with_tips" if m.group("card_tips") else "card", "id": snake(m.group("card_tips") or m.group("card"))}
            if re.search(r"upgrade\s*:\s*true|\(true\)", args):
                spec["upgrade"] = True
            specs.append(spec)
        else:
            kind = next(k for k in ("potion", "relic", "enchantment", "orb", "affliction") if m.group(k))
            specs.append({"kind": kind, "id": snake(m.group(kind))})
            if kind == "affliction" and expand:
                # AfflictionModel.HoverTips = [self] + ExtraHoverTips.
                specs.extend(tip_specs(member_body(read(src / "MegaCrit.Sts2.Core.Models.Afflictions" / f"{m.group(kind)}.cs"), "ExtraHoverTips"), src, False))
    out, seen = [], set()
    for spec in specs:
        key = json.dumps(spec, sort_keys=True)
        if key not in seen:
            seen.add(key)
            out.append(spec)
    return out


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore") if path.exists() else ""


def member_body(text: str, name: str) -> str:
    """The expression or getter body of the first `name` member declaration."""
    m = re.search(rf"\b{name}\b\s*(=>|\n\s*\{{)", text)
    if not m:
        return ""
    if m.group(1) == "=>":
        end = text.find(";\n", m.end())
        return text[m.end():end if end != -1 else len(text)]
    start = text.index("{", m.start())
    depth = 0
    for i in range(start, len(text)):
        depth += {"{": 1, "}": -1}.get(text[i], 0)
        if depth == 0:
            return text[start:i]
    return text[start:]


# type -> (model namespace, loc table, tip member, loc key prefix -> ID)
MODEL_TYPES = {
    "card": ("Cards", "cards", "ExtraHoverTips"),
    "relic": ("Relics", "relics", "ExtraHoverTips"),
    "potion": ("Potions", "potions", "ExtraHoverTips"),
    "power": ("Powers", "powers", "ExtraHoverTips"),
    "enchantment": ("Enchantments", "enchantments", "ExtraHoverTips"),
    "affliction": ("Afflictions", "afflictions", "ExtraHoverTips"),
    "orb": ("Orbs", "orbs", "ExtraHoverTips"),
    "modifier": ("Modifiers", "modifiers", "HoverTips"),
}

# Tables whose text the Compendium shows; the game attaches no tip list to them, so every gold word is plain.
PLAIN_TABLES = {
    "keyword": ["card_keywords", "static_hover_tips"],
    "event": ["events"],
    "ancient": ["ancients"],
    "ascension": ["ascension"],
    "epoch": ["epochs"],
    "encounter": ["encounters"],
    "character": ["characters"],
    "badge": ["badges"],
    "intent": ["intents"],
    "monster": ["monsters"],
}


def loc_id(type_: str, key: str) -> str:
    head = key.split(".", 1)[0]
    return head.removesuffix("_POWER") if type_ == "power" else head


def model_tips(src: Path) -> dict[str, dict[str, list[dict]]]:
    tips: dict[str, dict[str, list[dict]]] = {}
    keywords = card_keywords.parse_source(src)
    for type_, (namespace, _table, member) in MODEL_TYPES.items():
        out: dict[str, list[dict]] = {}
        for path in sorted((src / f"MegaCrit.Sts2.Core.Models.{namespace}").glob("*.cs")):
            text = read(path)
            id_ = power_id(path.stem) if type_ == "power" else snake(path.stem)
            specs = tip_specs(member_body(text, member), src)
            if type_ == "card":
                # CardModel.HoverTips: ExtraHoverTips, Evoke, Block, then each keyword (Ethereal adds Exhaust).
                if re.search(r"override OrbEvokeType OrbEvokeType\s*=>\s*OrbEvokeType\.(?!None\b)", text):
                    specs.append({"kind": "static", "id": "EVOKE"})
                if re.search(r"override bool GainsBlock\s*=>\s*true", text):
                    specs.append({"kind": "static", "id": "BLOCK"})
                info = keywords.get(id_, {"keywords": [], "upgrade": {}})
                added = [k.removeprefix("add_").upper() for k in info["upgrade"] if k.startswith("add_")]
                for kw in [*info["keywords"], *added]:
                    specs.append({"kind": "keyword", "id": snake(kw)})
                    if kw.upper() == "ETHEREAL":
                        specs.append({"kind": "keyword", "id": "EXHAUST"})
                specs = [s for i, s in enumerate(specs) if s not in specs[:i]]
            if specs:
                out[id_] = specs
        tips[type_] = out
    tips["event"] = event_tips(src)
    return tips


def event_tips(src: Path) -> dict[str, list[dict]]:
    """EventOption hover tips by option text key ("EVENT.pages.P.options.O")."""
    out: dict[str, list[dict]] = {}
    for path in sorted((src / "MegaCrit.Sts2.Core.Models.Events").glob("*.cs")):
        text = read(path)
        for m in re.finditer(r"new EventOption\(", text):
            depth, i = 0, m.end() - 1
            for i in range(m.end() - 1, len(text)):
                depth += {"(": 1, ")": -1}.get(text[i], 0)
                if depth == 0:
                    break
            args = text[m.end():i]
            key = re.search(r'"([A-Z0-9_]+\.pages\.[A-Z0-9_]+\.options\.[A-Z0-9_]+)"', args)
            if not key:
                continue
            body = args
            if not TOKEN_RE.search(args) and re.search(r"\b\w+\.ToArray\(\)|\bGet\w*HoverTips\(", args):
                # Tips built into a local list or helper: scan the enclosing method (class members open with "\n\t{").
                body = text[max(0, text.rfind("\n\t{", 0, m.start())):i]
                helper = re.search(r"\b(Get\w*HoverTips)\(", args)
                if helper:
                    body += member_body(text, helper.group(1))
            specs = tip_specs(body, src)
            if specs:
                out[key.group(1)] = specs
    return out


def titles(locale: str) -> dict[str, str]:
    """"kind:ID" -> title in this locale, for every tip a spec can name."""
    def table(name: str) -> dict:
        path = LOC / locale / f"{name}.json"
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}

    def strip(value: str) -> str:
        value = re.sub(r"\{Hotkey:.*?\(\{\}\)\}", "", value)
        value = re.sub(r"\{[^{}]*\}", "", value)  # a runtime amount: 소환 {Summon}
        return re.sub(r"\[/?\w+(?::[^\]]*)?\]", "", value).strip()

    out: dict[str, str] = {}
    for kind, name, suffix in (("keyword", "card_keywords", ""), ("static", "static_hover_tips", ""), ("power", "powers", "_POWER"),
                               ("card", "cards", ""), ("potion", "potions", ""), ("relic", "relics", ""),
                               ("enchantment", "enchantments", ""), ("orb", "orbs", ""), ("affliction", "afflictions", "")):
        for key, value in table(name).items():
            if key.endswith(".title") and isinstance(value, str) and "." not in key[:-6]:
                out[f"{kind}:{key[:-6].removesuffix(suffix)}"] = strip(value)
    # Replay and Summon tips are keyed by their static form in the Compendium.
    for dynamic, static in (("REPLAY_DYNAMIC", "REPLAY_STATIC"), ("SUMMON_DYNAMIC", "SUMMON_STATIC")):
        if f"static:{static}" in out:
            out.setdefault(f"static:{dynamic}", out[f"static:{static}"])
    return out


def spec_refs(spec: dict) -> list[str]:
    kind = spec["kind"]
    if kind == "forge":
        return ["static:FORGE", "card:SOVEREIGN_BLADE"]
    if kind == "card_with_tips":
        return [f"card:{spec['id']}"]
    return [f"{kind}:{spec['id']}"]


def is_inflection(word: str, base: str, locale: str) -> bool:
    """A regular -s/-ed/-ing form (Exhausted) or a Korean ending (꿰뚫린 for 꿰뚫림)."""
    if word == base or len(base) < 2:
        return False
    w, b = word.lower(), base.lower()
    if locale == "eng":
        # One word plus a regular ending: Shivs, Exhausted, Stunned, Impale (for Impaled); never "Exhaust Pile".
        stems = [b, b[:-1]] if len(b) > 3 else [b]
        return any(re.fullmatch(re.escape(stem) + r"(?:s|es|d|ed|[a-z]ed|ing)?", w) for stem in stems)
    if locale == "kor":
        # Only the last syllable changes, on names of three or more (꿰뚫린, 꿰뚫을 for 꿰뚫림): 손 is not 손상.
        return len(b) >= 3 and len(w) == len(b) and w[:-1] == b[:-1]
    return False


GOLD_RE = re.compile(r"\[gold\](.*?)\[/gold\]", re.S)


CHOICE_RE = re.compile(r"\{\w+:(?:show:)?([^{}|]*)\|([^{}|]*)\}")


def gold_words(text: str) -> list[str]:
    """Gold words as rendered: both sides of an {IfUpgraded:show:A+|A} choice; runtime slots ({Card1}) are left out."""
    words = []
    for raw in GOLD_RE.findall(text):
        raw = re.sub(r"\[/?\w+(?::[^\]]*)?\]", "", raw)
        choice = CHOICE_RE.search(raw)
        variants = [CHOICE_RE.sub(lambda m, i=i: m.group(i), raw) for i in (1, 2)] if choice else [raw]
        for word in (v.strip() for v in variants):
            if word and "{" not in word and word not in words:
                words.append(word)
    return words


def pair(word: str, refs: list[str], title_of: dict[str, str], locale: str) -> str | None:
    key = word.lower()
    bare = key.rstrip("+")  # an upgraded card: 하수인 투하+
    exact = [r for r in refs if title_of.get(r, "").lower() in (key, bare if r.startswith("card:") else key)]
    if exact:
        return exact[0]
    inflected = [r for r in refs if title_of.get(r) and is_inflection(word, title_of[r], locale)]
    return inflected[0] if len(inflected) == 1 else None


# Compendium keyword ids: the static Replay and Summon tips each have one entry.
SITE_KEYWORD_ID = {"REPLAY_STATIC": "REPLAY", "REPLAY_DYNAMIC": "REPLAY", "SUMMON_DYNAMIC": "SUMMON_STATIC"}


def site_ref(ref: str) -> str:
    """A tip as the Compendium names it: card keywords, static tips and orbs are all keywords."""
    kind, id_ = ref.split(":", 1)
    if kind in ("keyword", "static", "orb"):
        return f"keyword:{SITE_KEYWORD_ID.get(id_, id_)}"
    return ref


def gold_tips(tips: dict[str, dict[str, list[dict]]], locale: str) -> dict[str, dict[str, str | None]]:
    title_of = titles(locale)
    out: dict[str, dict[str, str | None]] = {}

    def add(element: str, text: str, refs: list[str]) -> None:
        for word in gold_words(text):
            ref = pair(word, refs, title_of, locale)
            out.setdefault(element, {})[word] = ref and site_ref(ref)

    for type_, (_ns, table, _member) in MODEL_TYPES.items():
        path = LOC / locale / f"{table}.json"
        if not path.exists():
            continue
        for key, text in json.loads(path.read_text(encoding="utf-8")).items():
            if not isinstance(text, str) or key.endswith(".title"):
                continue
            id_ = loc_id(type_, key)
            refs = [r for spec in tips[type_].get(id_, []) for r in spec_refs(spec)]
            add(f"{type_}:{id_}", text, [f"{type_}:{id_}", *refs])  # an element's own tip comes first in its list
    for type_, tables in PLAIN_TABLES.items():
        for table in tables:
            path = LOC / locale / f"{table}.json"
            if not path.exists():
                continue
            for key, text in json.loads(path.read_text(encoding="utf-8")).items():
                if not isinstance(text, str) or key.endswith(".title"):
                    continue
                option = re.match(r"([A-Z0-9_]+\.pages\.[A-Z0-9_]+\.options\.[A-Z0-9_]+)\.", key)
                refs = [r for spec in tips["event"].get(option.group(1), []) for r in spec_refs(spec)] if type_ == "event" and option else []
                add(f"{type_}:{key.split('.', 1)[0]}", text, refs)
    return {k: dict(sorted(v.items())) for k, v in sorted(out.items())}


def self_check(tips: dict, gold: dict[str, dict]) -> None:
    kor, eng = gold["kor"], gold["eng"]
    assert kor["card:BOW_SMACK"]["꿰뚫린"] == "power:IMPALED", "Bow Smack attaches Impaled"
    assert eng["card:DARK_EMBRACE"]["Exhausted"] == "keyword:EXHAUST", "Dark Embrace attaches Exhaust"
    assert kor["card:FORBIDDEN_GRIMOIRE"]["덱"] is None, "no card attaches the top bar Deck tip"
    assert kor["card:CHARGE"]["변화"] is None and kor["card:CHARGE"]["하수인 투하"] == "card:MINION_DIVE_BOMB"
    assert kor["event:AROMA_OF_CHAOS"]["변화"] == "keyword:TRANSFORM", "Aroma of Chaos attaches Transform"
    assert {"kind": "static", "id": "BLOCK"} in tips["card"]["BONE_SHARDS"], "GainsBlock adds Block"
    assert {"kind": "keyword", "id": "EXHAUST"} in tips["card"]["ASCENDERS_BANE"], "Ethereal adds Exhaust"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=Path("/tmp/sts2-src"), help="decompiled sts2.dll root")
    args = parser.parse_args()
    tips = model_tips(args.source)
    locales = sorted(p.name for p in LOC.iterdir() if p.is_dir())
    gold = {locale: gold_tips(tips, locale) for locale in locales}
    self_check(tips, gold)
    # Compendium keywords: every keyword tip a gold word names somewhere, plus the keywords printed on cards.
    keywords = sorted({ref.split(":", 1)[1] for data in gold.values() for words in data.values() for ref in words.values()
                       if ref and ref.startswith("keyword:")}
                      | {spec["id"] for specs in tips["card"].values() for spec in specs if spec["kind"] == "keyword"})
    assert "DECK" not in keywords and "ROOM_UNKNOWN_ELITE" not in keywords, "UI tips are not keywords"
    TIPS_OUT.write_text(json.dumps({"keywords": keywords, "tips": tips}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    GOLD_OUT.mkdir(exist_ok=True)
    for locale, data in gold.items():
        (GOLD_OUT / f"{locale}.json").write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    words = sum(len(v) for v in gold["kor"].values())
    plain = sum(1 for v in gold["kor"].values() for t in v.values() if t is None)
    print(f"Wrote {TIPS_OUT.relative_to(ROOT)} ({sum(len(v) for v in tips.values())} elements) and "
          f"{len(gold)} locales; kor: {words} gold words, {plain} without a tip")


if __name__ == "__main__":
    main()
