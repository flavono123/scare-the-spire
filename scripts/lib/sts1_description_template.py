"""Symbolic replay of STS1 description builders (Java 8 StringBuilder chains).

`AbstractPower.updateDescription()` and `AbstractRelic.getUpdatedDescription()`
concatenate localized `DESCRIPTIONS[i]` fragments with numbers. Replaying the
bytecode keeps the exact fragment order the game uses instead of guessing.

Template parts:
- {"text": i}                 DESCRIPTIONS[i]
- {"literal": "..."}          constant string from the class
- {"value": 6}                constant number
- {"var": "amount"}           runtime value (rendered as X)
- {"name": true}              the resource's own localized NAME
- {"period": true}            LocalizedStrings.PERIOD (ui.json "Period")
- {"color": "y", "inner": p}  FontHelper.colorString(p, "y")
- {"format": p, "args": [..]} String.format(p, args...)
- {"unknown": true}           anything the replay cannot resolve
"""

from __future__ import annotations

import re
from typing import Any

from scripts.lib.java_classfile import (
    JavaClass,
    descriptor_arg_count,
    iter_opcodes,
    s1_from,
    s2_from,
    u2_from,
)

_DESC = ("descriptions",)


class _Builder:
    def __init__(self) -> None:
        self.parts: list[dict[str, Any]] = []


class _Array:
    def __init__(self, size: int) -> None:
        self.items: list[Any] = [None] * max(size, 0)


def _part(value: Any) -> dict[str, Any]:
    if isinstance(value, tuple) and value:
        tag = value[0]
        if tag == "desc":
            return {"text": value[1]}
        if tag == "concat":
            return {"concat": value[1]}
        if tag == "field":
            return {"var": value[1]}
        if tag == "name":
            return {"name": True}
        if tag == "period":
            return {"period": True}
        if tag == "colored":
            return {"color": value[1], "inner": _part(value[2])}
        if tag == "format":
            return {"format": _part(value[1]), "args": [_part(item) for item in value[2]]}
    if isinstance(value, bool):
        return {"value": int(value)}
    if isinstance(value, (int, float)):
        return {"value": int(value) if float(value).is_integer() else value}
    if isinstance(value, str):
        return {"literal": value}
    return {"unknown": True}


def _flatten(parts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    flat: list[dict[str, Any]] = []
    for part in parts:
        if "concat" in part:
            flat.extend(_flatten(part["concat"]))
        elif "inner" in part:
            inner = _flatten([part["inner"]])
            flat.append({**part, "inner": inner[0] if len(inner) == 1 else {"concat": inner}})
        elif "format" in part:
            fmt = _flatten([part["format"]])
            flat.append({
                "format": fmt[0] if len(fmt) == 1 else {"concat": fmt},
                "args": [
                    (lambda items: items[0] if len(items) == 1 else {"concat": items})(_flatten([arg]))
                    for arg in part["args"]
                ],
            })
        else:
            flat.append(part)
    return flat


def _static_aliases(cls: JavaClass) -> dict[str, Any]:
    """Map static String fields assigned from DESCRIPTIONS[i] in <clinit>."""
    aliases: dict[str, Any] = {}
    clinit = cls.method("<clinit>")
    if not clinit or not clinit.code:
        return aliases
    stack: list[Any] = []
    for _start, op, arg in iter_opcodes(clinit.code):
        if 2 <= op <= 8:
            stack.append(op - 3)
        elif op == 16:
            stack.append(s1_from(arg))
        elif op == 178:
            _owner, _name, desc = cls.fieldref(u2_from(arg))
            stack.append(_DESC if desc == "[Ljava/lang/String;" else None)
        elif op == 180:
            if stack:
                stack.pop()
            _owner, name, desc = cls.fieldref(u2_from(arg))
            stack.append(_DESC if name == "DESCRIPTIONS" else None)
        elif op == 50:
            index = stack.pop() if stack else None
            array = stack.pop() if stack else None
            stack.append(("desc", index) if array == _DESC and isinstance(index, int) else None)
        elif op == 179:
            _owner, name, desc = cls.fieldref(u2_from(arg))
            value = stack.pop() if stack else None
            if desc == "Ljava/lang/String;" and isinstance(value, tuple) and value[0] == "desc":
                aliases[name] = value
        elif op in {182, 183, 184, 185}:
            _owner, _name, desc = cls.methodref(u2_from(arg))
            for _ in range(descriptor_arg_count(desc) + (0 if op == 184 else 1)):
                if stack:
                    stack.pop()
            if not desc.endswith(")V"):
                stack.append(None)
        elif op == 18 or op in {19, 20}:
            stack.append(None)
        elif op == 87 and stack:
            stack.pop()
        elif op == 89 and stack:
            stack.append(stack[-1])
    return aliases


def replay_description_templates(
    cls: JavaClass,
    method_name: str,
    *,
    sink: str,
    descriptor: str | None = None,
) -> list[list[dict[str, Any]]]:
    """Return templates assigned to `description` (sink="field") or returned (sink="return")."""
    method = cls.method(method_name, descriptor)
    if not method or not method.code:
        return []
    aliases = _static_aliases(cls)
    stack: list[Any] = []
    locals_: dict[int, Any] = {}
    templates: list[list[dict[str, Any]]] = []

    def pop() -> Any:
        return stack.pop() if stack else None

    def load(index: int, is_int: bool) -> Any:
        if index in locals_:
            return locals_[index]
        if index == 0:
            return "this"
        # Description builders only keep amounts in int parameters.
        return ("field", "amount") if is_int else ("local",)

    for _start, op, arg in iter_opcodes(method.code):
        if op in {21, 25}:
            stack.append(load(arg[0], op == 21))
            continue
        if 26 <= op <= 29:
            stack.append(load(op - 26, True))
            continue
        if 42 <= op <= 45:
            stack.append(load(op - 42, False))
            continue
        if op in {54, 58}:
            locals_[arg[0]] = pop()
            continue
        if 59 <= op <= 62 or 75 <= op <= 78:
            locals_[(op - 59) % 4 if op <= 62 else op - 75] = pop()
            continue
        if op == 1:
            stack.append(None)
        elif 2 <= op <= 8:
            stack.append(op - 3)
        elif op in {11, 12, 13}:
            stack.append(float(op - 11))
        elif op == 16:
            stack.append(s1_from(arg))
        elif op == 17:
            stack.append(s2_from(arg))
        elif op == 18:
            stack.append(cls.ldc_value(arg[0]))
        elif op in {19, 20}:
            stack.append(cls.ldc_value(u2_from(arg)))
        elif 22 <= op <= 24 or 30 <= op <= 41:
            stack.append(("local",))
        elif op == 50:  # aaload
            index = pop()
            array = pop()
            stack.append(("desc", index) if array == _DESC and isinstance(index, int) else None)
        elif 46 <= op <= 53:
            pop()
            pop()
            stack.append(None)
        elif op == 83:  # aastore
            value = pop()
            index = pop()
            array = pop()
            if isinstance(array, _Array) and isinstance(index, int) and 0 <= index < len(array.items):
                array.items[index] = value
        elif 79 <= op <= 86:
            pop()
            pop()
            pop()
        elif 54 <= op <= 78:
            pop()
        elif op == 87:
            pop()
        elif op == 88:
            pop()
            pop()
        elif op == 89:
            stack.append(stack[-1] if stack else None)
        elif op in {116, 117, 118, 119}:  # neg
            value = pop()
            stack.append(-value if isinstance(value, (int, float)) else value)
        elif 96 <= op <= 115:
            right = pop()
            left = pop()
            if isinstance(left, (int, float)) and isinstance(right, (int, float)):
                if op in {96, 97, 98, 99}:
                    stack.append(left + right)
                elif op in {100, 101, 102, 103}:
                    stack.append(left - right)
                elif op in {104, 105, 106, 107}:
                    stack.append(left * right)
                else:
                    stack.append(None)
            else:
                stack.append(left if isinstance(left, tuple) else right if isinstance(right, tuple) else None)
        elif 133 <= op <= 147:
            continue
        elif 148 <= op <= 152:
            pop()
            pop()
            stack.append(0)
        elif 153 <= op <= 158 or op in {198, 199}:
            pop()
        elif 159 <= op <= 166:
            pop()
            pop()
        elif op in {170, 171}:
            pop()
        elif op == 178:  # getstatic
            owner, name, desc = cls.fieldref(u2_from(arg))
            if desc == "[Ljava/lang/String;" and owner == cls.name:
                stack.append(_DESC)
            elif name in aliases:
                stack.append(aliases[name])
            elif name == "NAME" and desc == "Ljava/lang/String;":
                stack.append(("name",))
            elif name == "PERIOD" and owner.endswith("LocalizedStrings"):
                stack.append(("period",))
            else:
                stack.append(("static", name))
        elif op == 180:  # getfield
            receiver = pop()
            _owner, name, desc = cls.fieldref(u2_from(arg))
            if name == "DESCRIPTIONS" and desc == "[Ljava/lang/String;":
                stack.append(_DESC)
            elif name == "NAME" and desc == "Ljava/lang/String;":
                stack.append(("name",))
            elif receiver == "this" and desc in {"I", "F", "Z"}:
                stack.append(("field", name))
            elif receiver == "this" and name == "name" and desc == "Ljava/lang/String;":
                stack.append(("name",))
            elif isinstance(receiver, tuple) and receiver[0] == "ref":
                stack.append(("field", f"{receiver[1]}.{name}"))
            else:
                stack.append(("ref", name))
        elif op == 181:  # putfield
            value = pop()
            pop()
            _owner, name, _desc = cls.fieldref(u2_from(arg))
            if sink == "field" and name == "description":
                templates.append(_flatten([_part(value)]))
        elif op == 179:
            pop()
        elif op == 187:  # new
            name = cls.class_name(u2_from(arg))
            stack.append(_Builder() if name == "java.lang.StringBuilder" else ("new", name))
        elif op == 189:  # anewarray
            size = pop()
            stack.append(_Array(size if isinstance(size, int) else 0))
        elif op in {182, 183, 184, 185}:
            owner, name, desc = cls.methodref(u2_from(arg))
            args = [pop() for _ in range(descriptor_arg_count(desc))][::-1]
            receiver = pop() if op != 184 else None
            if owner == "java.lang.StringBuilder":
                if name == "<init>":
                    if isinstance(receiver, _Builder) and args:
                        receiver.parts.append(_part(args[0]))
                    continue
                if name == "append" and isinstance(receiver, _Builder):
                    receiver.parts.append(_part(args[0] if args else None))
                    stack.append(receiver)
                    continue
                if name == "toString" and isinstance(receiver, _Builder):
                    stack.append(("concat", list(receiver.parts)))
                    continue
            if owner in {"java.lang.Integer", "java.lang.String", "java.lang.Float"} and name in {
                "toString",
                "valueOf",
            } and args:
                stack.append(args[0])
                continue
            if owner == "java.lang.String" and name == "format" and len(args) == 2 and isinstance(args[1], _Array):
                stack.append(("format", args[0], args[1].items))
                continue
            if owner.endswith("FontHelper") and name == "colorString" and len(args) == 2:
                color = args[1] if isinstance(args[1], str) else "y"
                stack.append(("colored", color, args[0]))
                continue
            if not desc.endswith(")V"):
                stack.append(("call", name))
        elif op == 192:
            continue
        elif op == 176:  # areturn
            value = pop()
            if sink == "return":
                templates.append(_flatten([_part(value)]))
        elif 172 <= op <= 177:
            pop()
    return templates


def _has_unknown(part: Any) -> bool:
    if isinstance(part, dict):
        if part.get("unknown"):
            return True
        return any(_has_unknown(value) for value in part.values() if isinstance(value, (dict, list)))
    if isinstance(part, list):
        return any(_has_unknown(item) for item in part)
    return False


def template_is_resolved(template: list[dict[str, Any]]) -> bool:
    return bool(template) and not _has_unknown(template)


def pick_template(templates: list[list[dict[str, Any]]]) -> list[dict[str, Any]] | None:
    """Prefer the first resolved branch: STS1 builders put the player-facing / positive case first."""
    for template in templates:
        if template_is_resolved(template):
            return template
    return templates[0] if templates else None


_FORMAT_SPEC = re.compile(r"%(?:(\d+)\$)?[-#+ 0,(]*\d*(?:\.\d+)?([sdfS])")


def render_template(
    template: list[dict[str, Any]],
    descriptions: list[str],
    *,
    name: str = "",
    period: str = ".",
    unresolved: str = "X",
) -> str:
    def render(part: dict[str, Any]) -> str:
        if "concat" in part:
            return "".join(render(item) for item in part["concat"])
        if "text" in part:
            index = part["text"]
            return descriptions[index] if 0 <= index < len(descriptions) else ""
        if "literal" in part:
            return str(part["literal"])
        if "value" in part:
            return str(part["value"])
        if "var" in part:
            return unresolved
        if part.get("name"):
            return name
        if part.get("period"):
            return period
        if "inner" in part:
            inner = render(part["inner"])
            return " ".join(f"#{part['color']}{word}" for word in inner.split(" ") if word)
        if "format" in part:
            fmt = render(part["format"])
            args = [render(arg) for arg in part["args"]]
            cursor = iter(range(len(args)))

            def substitute(match: re.Match[str]) -> str:
                if match.group(1):
                    index = int(match.group(1)) - 1
                else:
                    index = next(cursor, len(args))
                return args[index] if 0 <= index < len(args) else ""

            return _FORMAT_SPEC.sub(substitute, fmt).replace("%%", "%")
        return ""

    return "".join(render(part) for part in template)
