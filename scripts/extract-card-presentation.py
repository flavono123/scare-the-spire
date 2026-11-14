#!/usr/bin/env python3
"""Extract what the game shows when a card is played, from the archived build source.

For every `Models/Cards/<Card>.cs` it reads the `OnPlay` body and writes, in source order, the
presentation steps the combat simulator replays: the player's `TriggerAnim`, `DamageCmd.Attack`
chains (hit count, attacker animation, `WithHitFx` scene), dedicated VFX nodes
(`N...Vfx.Create(...)`), `GainBlock`, and waits. Numbers stay symbolic (`CastAnimDelay`,
`DynamicVars.Damage`): the simulator resolves them from the character and the versioned card vars.
`other` lists the commands (`PowerCmd.Apply`, `CardPileCmd.Draw`, ...) the simulator does not replay.

    python3 scripts/extract-card-presentation.py --archive-version 0.113.0

Reads  ~/sts2-builds/<version>/src/MegaCrit.Sts2.Core.Models.Cards/*.cs
Writes data/sts2/card-presentation.json
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "sts2", "card-presentation.json")


def pascal_to_id(name: str) -> str:
    return re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", name).upper()


def balanced(text: str, open_at: int) -> tuple[str, int]:
    """`text[open_at]` is `(`: return the text inside the matching parens and the index after them."""
    depth = 0
    in_string = False
    i = open_at
    while i < len(text):
        ch = text[i]
        if in_string:
            if ch == "\\":
                i += 1
            elif ch == '"':
                in_string = False
        elif ch == '"':
            in_string = True
        elif ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                return text[open_at + 1 : i], i + 1
        i += 1
    raise ValueError("unbalanced parentheses")


def split_args(args: str) -> list[str]:
    """Split on top-level commas (outside parens, braces and strings)."""
    parts: list[str] = []
    depth = 0
    in_string = False
    start = 0
    for i, ch in enumerate(args):
        if in_string:
            if ch == '"' and args[i - 1] != "\\":
                in_string = False
        elif ch == '"':
            in_string = True
        elif ch in "({[":
            depth += 1
        elif ch in ")}]":
            depth -= 1
        elif ch == "," and depth == 0:
            parts.append(args[start:i].strip())
            start = i + 1
    tail = args[start:].strip()
    if tail:
        parts.append(tail)
    return parts


def unquote(value: str) -> str | None:
    value = value.strip()
    return value[1:-1] if len(value) >= 2 and value[0] == '"' and value[-1] == '"' else None


def on_play_body(source: str) -> str | None:
    match = re.search(r"Task OnPlay\([^)]*\)\s*\{", source)
    if not match:
        return None
    depth = 0
    for i in range(match.end() - 1, len(source)):
        if source[i] == "{":
            depth += 1
        elif source[i] == "}":
            depth -= 1
            if depth == 0:
                return source[match.end() : i]
    return None


def chain_calls(chain: str) -> list[tuple[str, str]]:
    """`.A(x).B(y)` -> [("A", "x"), ("B", "y")] for the top-level chain."""
    calls: list[tuple[str, str]] = []
    i = 0
    while i < len(chain):
        match = re.compile(r"\.(\w+)\s*(?:<[^>()]*>)?\s*\(").search(chain, i)
        if not match:
            break
        args, end = balanced(chain, match.end() - 1)
        calls.append((match.group(1), args))
        i = end
    return calls


def attack_step(chain_args: str, chain: str) -> dict:
    """One `DamageCmd.Attack(<amount>)...Execute(` chain."""
    step: dict = {"op": "attack", "amount": chain_args.strip()}
    for name, args in chain_calls(chain):
        parts = split_args(args)
        if name == "WithHitCount":
            step["hitCount"] = args.strip()
        elif name == "WithNoAttackerAnim":
            step["attackerAnim"] = None
        elif name == "WithAttackerAnim":
            step["attackerAnim"] = {"name": unquote(parts[0]) or parts[0], "delay": parts[1] if len(parts) > 1 else None}
        elif name == "WithHitFx":
            hit = {"scene": unquote(parts[0]) if parts else None}
            if len(parts) > 2 and unquote(parts[2]):
                hit["sfx"] = unquote(parts[2])
            step["hitFx"] = hit
        elif name == "Targeting":
            step["targeting"] = "target"
        elif name == "TargetingAllOpponents":
            step["targeting"] = "allEnemies"
        elif name == "TargetingRandomOpponents":
            step["targeting"] = "randomEnemy"
        elif name == "WithHitVfxSpawnedAtBase":
            step["hitVfxAtBase"] = True
        elif name == "SpawningHitVfxOnEachCreature":
            step["hitVfxOnEach"] = True
        elif name in ("WithAttackerFx", "BeforeDamage", "WithHitVfxNode", "AfterAttackerAnim"):
            step.setdefault("hooks", {})[name] = re.sub(r"\s+", " ", args).strip()
    return step


STEP_PATTERNS = [
    ("trigger", re.compile(r"CreatureCmd\.TriggerAnim\(")),
    ("attack", re.compile(r"DamageCmd\.Attack\(")),
    ("vfx", re.compile(r"\b(N\w+Vfx)\.Create\(")),
    ("block", re.compile(r"CreatureCmd\.GainBlock\(")),
    ("wait", re.compile(r"\bCmd\.(?:Wait|CustomScaledWait)\(")),
    ("sfx", re.compile(r"SfxCmd\.Play\(")),
]


def presentation(body: str) -> list[dict]:
    found: list[tuple[int, dict]] = []
    for kind, pattern in STEP_PATTERNS:
        for match in pattern.finditer(body):
            args, end = balanced(body, match.end() - 1)
            parts = split_args(args)
            if kind == "trigger":
                step = {"op": "anim", "who": parts[0], "name": unquote(parts[1]) or parts[1], "delay": parts[2] if len(parts) > 2 else None}
            elif kind == "attack":
                rest = body[end:]
                stop = re.search(r"\.Execute\(", rest)
                chain = rest[: stop.start()] if stop else rest
                step = attack_step(args, chain)
            elif kind == "vfx":
                color = re.search(r'new Color\("#?([0-9a-fA-F]{6,8})"\)', args)
                step = {"op": "vfx", "class": match.group(1), "args": re.sub(r"\s+", " ", args).strip()}
                if color:
                    step["color"] = color.group(1).lower()
                if "GetBottomOfHitbox" in args:
                    step["anchor"] = "bottomOfHitbox"
            elif kind == "block":
                step = {"op": "block"}
            elif kind == "sfx":
                step = {"op": "sfx", "event": unquote(parts[0]) or parts[0]}
            else:
                step = {"op": "wait", "seconds": ", ".join(parts)}
            found.append((match.start(), step))
    found.sort(key=lambda entry: entry[0])
    return [step for _, step in found]


HANDLED_COMMANDS = {"DamageCmd.Attack", "CreatureCmd.TriggerAnim", "CreatureCmd.GainBlock", "Cmd.Wait", "Cmd.CustomScaledWait", "SfxCmd.Play"}
# Commands that only read or schedule; they do not change what the player sees on the stage.
IGNORED_COMMANDS = {"Cmd.Wait"}


def other_commands(body: str) -> list[str]:
    """Commands the presentation does not replay (`PowerCmd.Apply`, `CardPileCmd.Draw`, ...), once each."""
    seen: list[str] = []
    for match in re.finditer(r"\b(\w+Cmd)\.(\w+)\s*(?:<[^>()]*>)?\s*\(", body):
        name = f"{match.group(1)}.{match.group(2)}"
        if name not in HANDLED_COMMANDS and name not in seen:
            seen.append(name)
    return seen


def class_wait_seconds(vfx_dir: str, class_name: str) -> float | None:
    """`float WaitTime { get; private set; } = 0.2f;` of a dedicated VFX node."""
    path = os.path.join(vfx_dir, f"{class_name}.cs")
    if not os.path.exists(path):
        return None
    match = re.search(r"float WaitTime\s*\{[^}]*\}\s*=\s*([0-9.]+)f", open(path, encoding="utf8").read())
    return float(match.group(1)) if match else None


def resolve_waits(steps: list[dict], vfx_dir: str) -> None:
    for step in steps:
        if step["op"] != "wait":
            continue
        raw = step["seconds"]
        literal = re.fullmatch(r"([0-9.]+)f?", raw.strip())
        if literal:
            step["seconds"] = float(literal.group(1))
            continue
        owner = re.fullmatch(r"(\w+)\.WaitTime", raw.strip())
        if owner:
            class_name = owner.group(1)[0].upper() + owner.group(1)[1:]
            seconds = class_wait_seconds(vfx_dir, class_name)
            if seconds is not None:
                step["seconds"] = seconds
                step["of"] = class_name


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--archive-version", default="0.113.0")
    parser.add_argument("--builds-dir", default=os.environ.get("STS2_BUILDS_DIR") or os.path.expanduser("~/sts2-builds"))
    args = parser.parse_args()

    cards_dir = os.path.join(args.builds_dir, args.archive_version, "src", "MegaCrit.Sts2.Core.Models.Cards")
    if not os.path.isdir(cards_dir):
        sys.exit(f"no decompiled cards at {cards_dir} (see docs/COMBAT_SIM.md, 'Build archive')")

    vfx_dir = os.path.join(args.builds_dir, args.archive_version, "src", "MegaCrit.Sts2.Core.Nodes.Vfx")
    cards: dict[str, dict] = {}
    for file in sorted(os.listdir(cards_dir)):
        if not file.endswith(".cs"):
            continue
        source = open(os.path.join(cards_dir, file), encoding="utf8").read()
        class_match = re.search(r"public (?:sealed |abstract )?class (\w+) : \w*Card\w*", source)
        if not class_match or "Mock" in class_match.group(1):
            continue
        body = on_play_body(source)
        if body is None:
            continue
        steps = presentation(body)
        resolve_waits(steps, vfx_dir)
        other = other_commands(body)
        if steps or other:
            cards[pascal_to_id(class_match.group(1))] = {"source": file, "steps": steps, **({"other": other} if other else {})}

    payload = {
        "archiveVersion": args.archive_version,
        "note": "Read from OnPlay in source order. Numbers are symbolic; the simulator resolves them from the character and the versioned card vars.",
        "cards": cards,
    }
    with open(OUT, "w", encoding="utf8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=1)
        handle.write("\n")
    ops: dict[str, int] = {}
    for card in cards.values():
        for step in card["steps"]:
            ops[step["op"]] = ops.get(step["op"], 0) + 1
    print(f"{OUT}: {len(cards)} cards, steps {ops}")


if __name__ == "__main__":
    main()
