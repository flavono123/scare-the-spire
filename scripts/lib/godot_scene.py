"""Small parser for the text Godot scene values used by static asset extractors."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any


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
            raise ValueError(f"expected {value!r}, got {self.peek()!r}")
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
        elif char in "])}":
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
    return {
        match.group("key"): match.group("quoted") or match.group("plain") or ""
        for match in HEADER_VALUE_RE.finditer(header)
    }


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
