#!/usr/bin/env python3
"""Extract STS2 event option -> result page transitions from decompiled DLL source.

The event JSON lists every page but not which option leads to which page, so the
Codex event view could not reach end pages such as DONE / VICTORY whose id differs
from the option id. This walks each option handler (and the methods it calls) for
SetEventState / SetEventFinished page keys.

  Produce the source with: ilspycmd -p -o /tmp/sts2-src "<path to sts2.dll>"
  Run: python3 scripts/extract-event-option-targets.py [--source DIR]

Output: data/sts2/event-option-targets.json
  { "targets": { EVENT: { PAGE: { OPTION: [RESULT_PAGE, ...] } } },
    "finished": { EVENT: [END_PAGE, ...] } }
Only pages that exist in data/sts2/kor/events.json are kept. More than one result
page means a random or conditional outcome (source order). An empty list means
the option ends the event without a page (e.g. straight into combat). Finished
pages are shown through SetEventFinished: the event ends there with no options.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = Path("/tmp/sts2-src/MegaCrit.Sts2.Core.Models.Events")
EVENTS = ROOT / "data/sts2/kor/events.json"
OUT = ROOT / "data/sts2/event-option-targets.json"

METHOD_RE = re.compile(
    r"^\t(?:private|public|protected|internal)[^\n=;]*?\b(\w+)(?:<[^>]*>)?\s*\([^)]*\)(?:\s*where [^\n]*)?\s*\n\t\{", re.M
)
# Keys may be interpolated ($"...{x}...") or concatenated ("...options." + name).
SEG = r"[A-Z0-9_{}A-Za-z +\[\]().]+?"
OPTION_KEY_RE = re.compile(rf'\$?"([A-Z0-9_]+)\.pages\.({SEG})\.options\.([^"]*)"(\s*\+)?')
PAGE_KEY_RE = re.compile(rf'\$?"([A-Z0-9_]+)\.pages\.({SEG})\.(?:description|options\.[A-Z0-9_]+\.description)"')


def block_end(text: str, open_idx: int, open_ch: str = "{", close_ch: str = "}") -> int:
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
        elif c == open_ch:
            depth += 1
        elif c == close_ch:
            depth -= 1
            if depth == 0:
                return i
        i += 1
    raise ValueError("unbalanced block")


def split_args(s: str) -> list[str]:
    args, depth, cur, in_str, i = [], 0, [], False, 0
    while i < len(s):
        c = s[i]
        cur.append(c)
        if in_str:
            if c == "\\":
                cur.append(s[i + 1])
                i += 1
            elif c == '"':
                in_str = False
        elif c == '"':
            in_str = True
        elif c in "([{":
            depth += 1
        elif c in ")]}":
            depth -= 1
        elif c == "," and depth == 0:
            cur.pop()
            args.append("".join(cur).strip())
            cur = []
        i += 1
    if cur:
        args.append("".join(cur).strip())
    return args


def strip_event_options(body: str) -> str:
    """Drop nested `new EventOption(...)` expressions: their handlers belong to the next page."""
    out, i = [], 0
    while (j := body.find("new EventOption(", i)) >= 0:
        out.append(body[i:j])
        i = block_end(body, j + len("new EventOption"), "(", ")") + 1
    out.append(body[i:])
    return "".join(out)


def parse_methods(text: str) -> dict[str, str]:
    methods: dict[str, str] = {}
    for m in METHOD_RE.finditer(text):
        end = block_end(text, m.end() - 1)
        methods[m.group(1)] = methods.get(m.group(1), "") + text[m.end() - 1 : end + 1]
    return methods


def glob(seg: str, wildcard: bool = False) -> re.Pattern:
    if wildcard:
        seg += "{}"
    return re.compile("^" + ".+".join(re.escape(p) for p in re.split(r"\{[^}]*\}", seg)) + "$")


def page_keys(event_id: str, s: str, pages: list[str]) -> list[str]:
    out: list[str] = []
    for ev, seg in PAGE_KEY_RE.findall(s):
        if ev != event_id:
            continue
        pat = glob(seg)
        out += [p for p in pages if pat.match(p) and p not in out]
    return out


def outcome(
    event_id: str, entry: str, methods: dict[str, str], text: str, pages: list[str], finished: set[str]
) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()
    queue = [entry]
    path: list[str] = []

    def add(keys: list[str]) -> None:
        found.extend(k for k in keys if k not in found)

    while queue:
        body = strip_event_options(queue.pop(0))
        path.append(body)
        if "shouldResumeAfterCombat: true" in body and "Resume" not in seen:
            seen.add("Resume")
            queue.append(methods.get("Resume", ""))
        for call in re.finditer(r"SetEvent(?:State|Finished)\(", body):
            arg = split_args(body[call.end() : block_end(body, call.end() - 1, "(", ")")])[0]
            keys = page_keys(event_id, arg, pages)
            if not keys:
                # Dynamic description: a local LocString, a helper returning one, or a
                # LocString the caller passed in.
                called = [methods[n] for n in re.findall(r"\b(\w+)\s*\(", arg) if n in methods]
                keys = page_keys(event_id, "".join(path + called), pages)
            if not keys:
                # Key held in data (e.g. a field on a choice record): page keys the class
                # declares outside any L10NLookup call.
                bare = re.sub(r'L10NLookup\(\$?"[^"]*"\)', "", text)
                keys = page_keys(event_id, bare, pages)
            add(keys)
            if call.group(0).startswith("SetEventFinished"):
                finished.update(keys)
        for name in re.findall(r"\b([A-Za-z_]\w*)\b", body):
            if name in methods and name not in seen and name != "GenerateInitialOptions":
                if re.search(rf"\bEventOption>?\s+{name}\(", text):
                    continue
                seen.add(name)
                queue.append(methods[name])
    return found


def extract_file(path: Path, events: dict[str, dict], finished: set[str]) -> tuple[str | None, dict]:
    text = path.read_text(encoding="utf-8")
    methods = parse_methods(text)
    result: dict[str, dict[str, list[str]]] = {}
    event_id = None
    for m in re.finditer(r"new EventOption\(", text):
        args = split_args(text[m.end() : block_end(text, m.end() - 1, "(", ")")])
        if len(args) < 3 or args[1] == "null":
            continue
        # The key is usually the third argument; dynamic-title options pass it later.
        key_src = next((a for a in args[2:] if OPTION_KEY_RE.search(a)), args[2])
        initial = re.match(r'InitialOptionKey\("(\w+)"\)', key_src)
        if initial and (ev := PAGE_KEY_RE.search(text)):
            key_src = f'"{ev.group(1)}.pages.INITIAL.options.{initial.group(1)}"'
        keys = list(OPTION_KEY_RE.finditer(key_src))
        if not keys:
            # Key from a helper (e.g. GetRiderLocKey(rider)): every key in its body.
            helper = re.match(r"(\w+)\s*\(", key_src)
            keys = list(OPTION_KEY_RE.finditer(methods.get(helper.group(1), ""))) if helper else []
        for key in keys:
            event_id = extract_option(key, args[1], methods, text, events, result, finished) or event_id
    return event_id, result


def extract_option(
    key: re.Match, handler: str, methods: dict[str, str], text: str, events: dict, result: dict, finished: set[str]
) -> str | None:
    event_id = key.group(1)
    event = events.get(event_id)
    if not event:
        return None
    data_pages = {p["id"]: [o["id"] for o in p.get("options") or []] for p in event.get("pages") or []}
    page_ids = list(data_pages)
    lam = re.match(r"(?:async\s*)?(?:\([^)]*\)\s*=>|delegate)\s*(.*)", handler, re.S)
    if not lam and handler not in methods and (alias := re.search(rf"\b{re.escape(handler)}\s*=\s*(\w+);", text)):
        handler = alias.group(1)  # Func<Task> onChosen = Claim;
    entry = lam.group(1) if lam else methods.get(handler, handler)
    found = outcome(event_id, entry, methods, text, page_ids, finished)
    page_pat = glob(key.group(2))
    opt_pat = glob(key.group(3), wildcard=bool(key.group(4)) or not key.group(3))
    for page, opts in data_pages.items():
        if not page_pat.match(page):
            continue
        for opt in opts:
            if opt_pat.match(opt):
                prev = result.setdefault(page, {}).setdefault(opt, [])
                prev.extend(p for p in found if p not in prev)
    return event_id


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    args = ap.parse_args()
    events = {e["id"]: e for e in json.loads(EVENTS.read_text(encoding="utf-8"))}
    out: dict[str, dict] = {"targets": {}, "finished": {}}
    for path in sorted(args.source.glob("*.cs")):
        finished: set[str] = set()
        event_id, result = extract_file(path, events, finished)
        if event_id and result:
            out["targets"][event_id] = result
            if finished:
                out["finished"][event_id] = sorted(finished)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}: {len(out['targets'])} events")


if __name__ == "__main__":
    main()
