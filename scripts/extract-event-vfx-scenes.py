#!/usr/bin/env python3
"""Compile STS2 event VFX scenes and textures into browser-only static assets.

The source of truth is the local game PCK. Godot scene values are parsed at
authoring time so neither Next.js nor the Cloudflare Worker performs PCK work,
JSON joins, or texture decoding at request time.

Run with the optional texture dependencies:
  uv run --with pillow --with texture2ddecoder python scripts/extract-event-vfx-scenes.py
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.ctex import ctex_to_image, parse_import_file
from scripts.lib.pck import PCKReader, default_pck_path


SCENE_PREFIX = "scenes/vfx/events/"
MIRROR_SCENE = "scenes/vfx/whole_screen/mirror_vfx.tscn"
OUT_ROOT = ROOT / "public/images/sts2/event-vfx/runtime"
SCENE_OUT_ROOT = ROOT / "public/generated/event-vfx/scenes"
INDEX_PATH = ROOT / "data/sts2/event-vfx-scenes.json"

SCENE_RE = re.compile(r"^scenes/vfx/events/(?P<slug>.+)_vfx\.tscn$")
SECTION_RE = re.compile(r"^\[(?P<kind>[a-z_]+)(?P<header>.*)]$")
HEADER_VALUE_RE = re.compile(r'(?P<key>[a-z_]+)=(?:"(?P<quoted>[^"]*)"|(?P<plain>[^ ]+))')
PROPERTY_RE = re.compile(r"^(?P<key>[A-Za-z0-9_./-]+)\s*=\s*(?P<value>.*)$")


@dataclass(frozen=True)
class Token:
    kind: str
    value: str


TOKEN_RE = re.compile(
    r"""
    (?P<space>\s+)
    |(?P<number>[+-]?(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?)
    |(?P<string>"(?:\\.|[^"\\])*")
    |(?P<identifier>[A-Za-z_][A-Za-z0-9_./-]*)
    |(?P<punct>[][{}(),:&])
    """,
    re.VERBOSE,
)


class GodotValueParser:
    def __init__(self, text: str):
        self.tokens = [
            Token(match.lastgroup or "", match.group())
            for match in TOKEN_RE.finditer(text)
            if match.lastgroup != "space"
        ]
        self.index = 0

    def peek(self, value: str | None = None) -> Token | None:
        if self.index >= len(self.tokens):
            return None
        token = self.tokens[self.index]
        if value is not None and token.value != value:
            return None
        return token

    def take(self, value: str | None = None) -> Token:
        token = self.peek(value)
        if token is None:
            actual = self.peek()
            raise ValueError(f"expected {value!r}, got {actual!r}")
        self.index += 1
        return token

    def parse(self) -> Any:
        if self.peek("&"):
            self.take("&")
            return self.parse()
        token = self.take()
        if token.kind == "number":
            number = float(token.value)
            return int(number) if number.is_integer() and not any(c in token.value for c in ".eE") else number
        if token.kind == "string":
            return json.loads(token.value)
        if token.value == "true":
            return True
        if token.value == "false":
            return False
        if token.value in {"null", "Nil"}:
            return None
        if token.value == "[":
            return self.parse_sequence("]")
        if token.value == "{":
            return self.parse_dict()
        if token.kind == "identifier":
            if self.peek("("):
                self.take("(")
                values = self.parse_sequence(")")
                return {"$": token.value, "v": values}
            return token.value
        raise ValueError(f"unsupported token {token}")

    def parse_sequence(self, terminator: str) -> list[Any]:
        values: list[Any] = []
        while not self.peek(terminator):
            values.append(self.parse())
            if self.peek(","):
                self.take(",")
            elif not self.peek(terminator):
                raise ValueError(f"expected comma before {self.peek()!r}")
        self.take(terminator)
        return values

    def parse_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {}
        while not self.peek("}"):
            key = self.parse()
            self.take(":")
            result[str(key)] = self.parse()
            if self.peek(","):
                self.take(",")
            elif not self.peek("}"):
                raise ValueError(f"expected comma before {self.peek()!r}")
        self.take("}")
        return result


def parse_value(text: str) -> Any:
    parser = GodotValueParser(text)
    value = parser.parse()
    if parser.peek() is not None:
        raise ValueError(f"unparsed value tail: {text!r} at {parser.peek()!r}")
    return value


def bracket_balance(text: str) -> int:
    balance = 0
    quote = False
    escaped = False
    for char in text:
        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                quote = False
            continue
        if char == '"':
            quote = True
        elif char in "[({":
            balance += 1
        elif char in "]) }".replace(" ", ""):
            balance -= 1
    return balance


def parse_properties(lines: list[str], scene_path: str) -> dict[str, Any]:
    properties: dict[str, Any] = {}
    index = 0
    while index < len(lines):
        line = lines[index].strip()
        index += 1
        if not line or line.startswith(";"):
            continue
        match = PROPERTY_RE.match(line)
        if not match:
            raise ValueError(f"{scene_path}: malformed property line {line!r}")
        key = match.group("key")
        raw = match.group("value")
        balance = bracket_balance(raw)
        while balance > 0 and index < len(lines):
            continuation = lines[index].strip()
            index += 1
            raw += "\n" + continuation
            balance += bracket_balance(continuation)
        try:
            properties[key] = parse_value(raw)
        except ValueError as error:
            raise ValueError(f"{scene_path}: failed to parse {key}={raw!r}: {error}") from error
    return properties


def parse_header(header: str) -> dict[str, str]:
    result: dict[str, str] = {}
    for match in HEADER_VALUE_RE.finditer(header):
        result[match.group("key")] = match.group("quoted") or match.group("plain") or ""
    return result


def parse_scene(text: str, scene_path: str) -> dict[str, Any]:
    sections: list[tuple[str, dict[str, str], list[str]]] = []
    current: tuple[str, dict[str, str], list[str]] | None = None
    for raw_line in text.splitlines():
        match = SECTION_RE.match(raw_line.strip())
        if match:
            current = (match.group("kind"), parse_header(match.group("header")), [])
            sections.append(current)
        elif current is not None:
            current[2].append(raw_line)

    ext_resources: dict[str, dict[str, str]] = {}
    sub_resources: dict[str, dict[str, Any]] = {}
    nodes: list[dict[str, Any]] = []
    for kind, header, lines in sections:
        if kind == "ext_resource":
            ext_resources[header["id"]] = {
                "path": header.get("path", "").removeprefix("res://"),
                "type": header.get("type", ""),
            }
        elif kind == "sub_resource":
            sub_resources[header["id"]] = {
                "props": parse_properties(lines, scene_path),
                "type": header.get("type", ""),
            }
        elif kind == "node":
            nodes.append(
                {
                    "name": header.get("name", ""),
                    "parent": header.get("parent"),
                    "props": parse_properties(lines, scene_path),
                    "type": header.get("type", ""),
                }
            )
    return {
        "ext": ext_resources,
        "nodes": nodes,
        "resources": sub_resources,
        "source": scene_path,
        "version": 1,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pck", default=default_pck_path(), help="Path to Slay the Spire 2.pck")
    parser.add_argument("--force", action="store_true", help="Rewrite unchanged textures")
    parser.add_argument("--dry-run", action="store_true", help="Validate and report without writing")
    return parser.parse_args()


def texture_output_path(source_path: str) -> Path:
    return (OUT_ROOT / Path(source_path)).with_suffix(".webp")


def public_url(path: Path) -> str:
    return "/" + path.relative_to(ROOT / "public").as_posix()


def extract_texture(reader: PCKReader, source_path: str, force: bool, dry_run: bool) -> dict[str, Any]:
    import_path = f"{source_path}.import"
    if import_path not in reader.entries:
        raise FileNotFoundError(f"missing texture import: {import_path}")
    ctex_path = parse_import_file(reader.read_file(import_path))
    if not ctex_path or ctex_path not in reader.entries:
        raise FileNotFoundError(f"missing ctex for {source_path}: {ctex_path}")
    image = ctex_to_image(reader.read_file(ctex_path))
    if image is None:
        raise ValueError(
            f"cannot decode {source_path}; run with Pillow and texture2ddecoder installed"
        )
    output_path = texture_output_path(source_path)
    if not dry_run and (force or not output_path.exists()):
        output_path.parent.mkdir(parents=True, exist_ok=True)
        image.save(output_path, "WEBP", lossless=True, method=6)
    return {
        "height": image.height,
        "source": source_path,
        "src": public_url(output_path),
        "width": image.width,
    }


def ref_id(value: Any, kind: str) -> str | None:
    if not isinstance(value, dict) or value.get("$") != kind:
        return None
    values = value.get("v")
    return str(values[0]) if isinstance(values, list) and values else None


def attach_texture_metadata(scene: dict[str, Any], textures: dict[str, dict[str, Any]]) -> None:
    for resource_id, resource in scene["ext"].items():
        if resource["type"] != "Texture2D":
            continue
        source_path = resource["path"]
        resource["texture"] = textures[source_path]

    for resource in scene["resources"].values():
        props = resource["props"]
        if resource["type"] == "CanvasItemMaterial":
            props.setdefault("blend_mode", 0)


def write_json(path: Path, value: Any, dry_run: bool) -> None:
    text = json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n"
    if dry_run:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or path.read_text() != text:
        path.write_text(text)


def main() -> int:
    args = parse_args()
    scene_outputs: dict[str, dict[str, Any]] = {}
    texture_cache: dict[str, dict[str, Any]] = {}

    with PCKReader(args.pck) as reader:
        scene_paths = sorted(
            path for path in reader.entries if SCENE_RE.match(path)
        )
        scene_paths.append(MIRROR_SCENE)

        for scene_path in scene_paths:
            slug = "mirror" if scene_path == MIRROR_SCENE else SCENE_RE.match(scene_path).group("slug")  # type: ignore[union-attr]
            scene = parse_scene(reader.read_file(scene_path).decode("utf-8"), scene_path)
            for ext_resource in scene["ext"].values():
                if ext_resource["type"] != "Texture2D":
                    continue
                source_path = ext_resource["path"]
                if source_path not in texture_cache:
                    texture_cache[source_path] = extract_texture(
                        reader, source_path, args.force, args.dry_run
                    )
            attach_texture_metadata(scene, texture_cache)
            output_path = SCENE_OUT_ROOT / f"{slug}.json"
            write_json(output_path, scene, args.dry_run)
            scene_outputs[slug] = {
                "nodes": len(scene["nodes"]),
                "src": public_url(output_path),
                "textures": sum(1 for item in scene["ext"].values() if item["type"] == "Texture2D"),
            }

    initial_scenes = {
        slug.upper(): slug
        for slug in scene_outputs
        if slug not in {
            "dense_vegetation_slice",
            "mirror",
            "trial_merchant",
            "trial_noble",
            "trial_nondescript",
        }
    }
    index = {
        "initialScenes": initial_scenes,
        "oneShots": {"DENSE_VEGETATION": {"TRUDGE_ON": "dense_vegetation_slice"}},
        "scenes": scene_outputs,
        "specialScenes": {"REFLECTIONS": "mirror"},
        "trialScenes": {
            "MERCHANT": "trial_merchant",
            "NOBLE": "trial_noble",
            "NONDESCRIPT": "trial_nondescript",
        },
        "version": 1,
    }
    write_json(INDEX_PATH, index, args.dry_run)
    total_bytes = sum(path.stat().st_size for path in OUT_ROOT.rglob("*.webp")) if OUT_ROOT.exists() else 0
    print(
        f"event vfx scenes={len(scene_outputs)} textures={len(texture_cache)} "
        f"texture_bytes={total_bytes} dry_run={args.dry_run}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
