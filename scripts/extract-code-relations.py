#!/usr/bin/env python3
"""Extract STS2 resource cross-links (related rails + event option hover tips) from decompiled DLL source.

Hand-written relation tables in src/lib/codex-references.ts and event-detail.tsx missed every
event a patch added. This reads what each model's code actually references, so re-running it on
a new build (slseoun-patch / update-game-assets) links new content without hand edits.

  Produce the source with: ilspycmd -p -o /tmp/sts2-src "<path to sts2.dll>"
  Run: python3 scripts/extract-code-relations.py [--source DIR] [--check]

Output: data/sts2/code-relations.json
  { "event"|"relic"|"potion"|"card": { ID: { card|relic|potion|enchantment|power|ancient: [ID, ...] } },
    "eventOptions": { EVENT: { OPTION: { card|relic|potion: [ID, ...] } } } }
References are typed generic arguments (ModelDb.Card<X>, RelicCmd.Obtain<X>, PowerCmd.Apply<X>,
HoverTipFactory.FromCard<X>, ...) plus `is <Ancient>` checks. Only ids present in data/sts2/kor/*.json
are kept. An option's hover tips are the HoverTipFactory calls built for that EventOption; a
non-generic FromRelic(x) (a rolled relic) takes the event's relic pool.
--check exits 1 when the committed JSON is stale.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = Path("/tmp/sts2-src")
OUT = ROOT / "data/sts2/code-relations.json"
NS = "MegaCrit.Sts2.Core.Models."
DIRS = {"card": "Cards", "relic": "Relics", "potion": "Potions", "enchantment": "Enchantments", "power": "Powers"}
DATA = {"card": "cards", "relic": "relics", "potion": "potions", "enchantment": "enchantments", "power": "powers"}
SOURCES = {"event": "Events", "relic": "Relics", "potion": "Potions", "card": "Cards"}
# Only the links a detail page has a rail for (the JSON ships in the client bundle).
KEEP = {
    "event": {"card", "relic", "potion", "enchantment", "power", "ancient"},
    "relic": {"card", "enchantment", "power"},
    "potion": {"card", "enchantment", "power"},
    "card": {"enchantment", "power"},
}

GENERIC_RE = re.compile(r"\b(\w+)<((?:[\w.]+\.)?[A-Z]\w*)>")
QUALIFIED_KIND = {f"{NS}{d}.": k for k, d in DIRS.items()}
IS_RE = re.compile(r"\bis\s+([A-Z]\w*)\b")
# Option keys are literal ("EVENT.pages.PAGE.options.OPT") or EventModel.InitialOptionKey("OPT").
OPTION_RE = re.compile(r'new EventOption\(this,[^"]*?(?:"([A-Z0-9_]+)\.pages\.([A-Z0-9_]+)\.options\.([A-Z0-9_]+)"|InitialOptionKey\("([A-Z0-9_]+)"\))')
# EventModel.RelicOption<T>(): option id is the relic id and its hover tip is the relic.
RELIC_OPTION_RE = re.compile(r"\bRelicOption<([A-Z]\w*)>\(")
HOVER_GENERIC_RE = re.compile(r"HoverTipFactory\.From(Card|CardWithCardHoverTips|Relic|Potion)<(?:[\w.]+\.)?([A-Z]\w*)>")
HOVER_DYNAMIC_RE = re.compile(r"HoverTipFactory\.From(Card|Relic|Potion)\((?!\))")
METHOD_START_RE = re.compile(r"^\t(?:private|public|protected|internal)\b", re.M)


def snake(name: str) -> str:
    return re.sub(r"(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])", "_", name).upper()


def class_id(kind: str, cls: str) -> str:
    return snake(cls[: -len("Power")] if kind == "power" and cls.endswith("Power") else cls)


def call_end(text: str, open_idx: int) -> int:
    depth, i, in_str = 0, open_idx, False
    while i < len(text):
        c = text[i]
        if in_str:
            if c == "\\":
                i += 1
            elif c == '"':
                in_str = False
        elif c == '"':
            in_str = True
        elif c == "(":
            depth += 1
        elif c == ")":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return len(text)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    src: Path = args.source
    if not (src / f"{NS}Events").is_dir():
        print(f"missing decompiled source under {src}. Run: ilspycmd -p -o /tmp/sts2-src <sts2.dll>", file=sys.stderr)
        return 2

    known = {k: {e["id"] for e in json.loads((ROOT / f"data/sts2/kor/{f}.json").read_text())} for k, f in DATA.items()}
    kind_of: dict[str, str] = {}
    for kind, d in DIRS.items():
        for p in (src / f"{NS}{d}").glob("*.cs"):
            kind_of.setdefault(p.stem, kind)
    event_files = sorted((src / f"{NS}Events").glob("*.cs"))
    ancients = {p.stem for p in event_files if re.search(r":\s*AncientEventModel\b", p.read_text())}
    ancients.discard("DeprecatedAncientEvent")

    def refs(text: str) -> dict[str, set[str]]:
        out: dict[str, set[str]] = {}
        # `is X` only counts for ancients (`Act.Ancient is Tanx`); `card is Strike` style checks are not links.
        for name in [m.group(2) for m in GENERIC_RE.finditer(text)] + [c for c in IS_RE.findall(text) if c in ancients]:
            # Namespace-qualified names (Models.Relics.LostWisp) say their kind; LostWisp is also an event.
            prefix, _, cls = name.rpartition(".")
            kind = QUALIFIED_KIND.get(prefix + ".") if prefix else ("ancient" if cls in ancients else kind_of.get(cls))
            if not kind:
                continue
            rid = snake(cls) if kind == "ancient" else class_id(kind, cls)
            if kind == "ancient" or rid in known[kind]:
                out.setdefault(kind, set()).add(rid)
        return out

    texts = {p.stem: p.read_text() for p in event_files}
    result: dict[str, dict] = {k: {} for k in SOURCES}
    result["eventOptions"] = {}
    for source_kind, d in SOURCES.items():
        files = event_files if source_kind == "event" else sorted((src / f"{NS}{d}").glob("*.cs"))
        for p in files:
            if source_kind == "event" and (p.stem in ancients or p.stem.startswith("Deprecated")):
                continue
            text = p.read_text()
            own_id = snake(p.stem) if source_kind == "event" else class_id(source_kind, p.stem)
            if source_kind != "event" and own_id not in known[source_kind]:
                continue
            found = refs(text)
            # An event that rolls from an ancient's options (`ModelDb.AncientEvent<A>() ... .Relic`) links A's relics.
            excluded = {class_id("relic", c) for c in re.findall(r"\.Relic is ([A-Z]\w*)", text)}
            rolled: set[str] = set()
            for a in found.get("ancient", set()) if source_kind == "event" else ():
                cls = next(c for c in ancients if snake(c) == a)
                if f"AncientEvent<{cls}>" in text and ".Relic" in text:
                    rolled |= refs(texts[cls]).get("relic", set()) - excluded
            if rolled:
                found.setdefault("relic", set()).update(rolled)
            found.get(source_kind, set()).discard(own_id)
            # A power named after its source (FlexPotionPower, AggressionPower) is that source's own implementation.
            found.get("power", set()).discard(own_id)
            entry = {k: sorted(v) for k, v in sorted(found.items()) if v and k in KEEP[source_kind]}
            if entry:
                result[source_kind][own_id] = entry
            if source_kind != "event":
                continue
            starts = [m.start() for m in METHOD_START_RE.finditer(text)]
            # Hand-built tips held in fields: `static readonly HoverTip _x = new HoverTip(new LocString("relics", "WUPPY.title"), ...)`.
            field_tips = {
                name: (table[:-1], key)
                for name, table, key in re.findall(r'\b(_\w+) = new HoverTip\(new LocString\("(cards|relics|potions)", "([A-Z0-9_]+)\.', text)
            }
            prev_end = 0
            for m in OPTION_RE.finditer(text):
                event_key, _page, option, initial_option = m.groups()
                event_key, option = event_key or own_id, option or initial_option
                end = call_end(text, m.start() + len("new EventOption"))
                method_start = max([s for s in starts if s < m.start()], default=0)
                window = text[max(prev_end, method_start) : end]
                prev_end = end
                tips: dict[str, set[str]] = {}
                for fn, cls in HOVER_GENERIC_RE.findall(window):
                    kind = "card" if fn.startswith("Card") else fn.lower()
                    rid = class_id(kind, cls)
                    if rid in known[kind]:
                        tips.setdefault(kind, set()).add(rid)
                for name, (kind, rid) in field_tips.items():
                    if re.search(rf"\b{name}\b", window) and rid in known[kind]:
                        tips.setdefault(kind, set()).add(rid)
                # A rolled model (FromRelic(OfferedRelic)) can be any of the event's pool: the ancient's relics if it rolls from one.
                for fn in HOVER_DYNAMIC_RE.findall(window):
                    kind = fn.lower()
                    pool = rolled if kind == "relic" and rolled else set(entry.get(kind, []))
                    tips.setdefault(kind, set()).update(pool)
                if tips and event_key == own_id:
                    slot = result["eventOptions"].setdefault(own_id, {}).setdefault(option, {})
                    for k, v in tips.items():
                        slot[k] = sorted(set(slot.get(k, [])) | v)
            for cls in RELIC_OPTION_RE.findall(text):
                rid = class_id("relic", cls)
                if rid in known["relic"]:
                    result["eventOptions"].setdefault(own_id, {}).setdefault(rid, {})["relic"] = [rid]

    rendered = json.dumps(result, ensure_ascii=False, indent=1, sort_keys=True) + "\n"
    if args.check:
        if not OUT.exists() or OUT.read_text() != rendered:
            print(f"{OUT.relative_to(ROOT)} is stale: run python3 scripts/extract-code-relations.py", file=sys.stderr)
            return 1
        return 0
    OUT.write_text(rendered)
    print(f"wrote {OUT.relative_to(ROOT)}: " + ", ".join(f"{k} {len(v)}" for k, v in result.items()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
