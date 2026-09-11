#!/usr/bin/env python3
"""Extract STS1 latest card / relic / potion data and assets from desktop-1.0.jar.

After regenerating `public/images/sts1`, bump `STS1_IMAGE_CACHE_BUSTER`
in `src/lib/sts1/image-cache.ts` so immutable `/images` cache headers pick
up the new files.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import struct
import sys
from io import BytesIO
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.java_classfile import (  # noqa: E402
    JavaClass,
    descriptor_arg_count,
    iter_opcodes,
    parse_class_file,
    s1_from,
    s2_from,
    u2_from,
)
from scripts.lib.sts1_jar import default_sts1_jar_path, open_sts1_jar  # noqa: E402

STS1_LOCALES = [
    "kor",
    "eng",
    "zhs",
    "jpn",
    "deu",
    "fra",
    "ita",
    "spa",
    "ptb",
    "rus",
    "pol",
    "tha",
    "tur",
]

CARD_ADD_METHODS = (
    "addRedCards",
    "addGreenCards",
    "addBlueCards",
    "addPurpleCards",
    "addColorlessCards",
    "addCurseCards",
)

COLOR_TO_POOL = {
    "RED": "ironclad",
    "GREEN": "silent",
    "BLUE": "defect",
    "PURPLE": "watcher",
    "COLORLESS": "colorless",
    "CURSE": "curse",
}

RELIC_ADD_TO_POOL = {
    "add": "shared",
    "addRed": "ironclad",
    "addGreen": "silent",
    "addBlue": "defect",
    "addPurple": "watcher",
}

CHARACTER_POTION_IDS = {
    "ironclad": ("BloodPotion", "ElixirPotion", "HeartOfIron"),
    "silent": ("Poison Potion", "CunningPotion", "GhostInAJar"),
    "defect": ("FocusPotion", "PotionOfCapacity", "EssenceOfDarkness"),
    "watcher": ("BottledMiracle", "StancePotion", "Ambrosia"),
}

LETTER_POTION_SIZES = {"t", "s", "m", "h"}
FOLDER_POTION_SIZES = {
    "sphere": "sphere",
    "bottle": "bottle",
    "heart": "heart",
    "snecko": "snecko",
    "fairy": "fairy",
    "ghost": "ghost",
    "jar": "jar",
    "bolt": "bolt",
    "card": "card",
    "moon": "moon",
    "spiky": "spiky",
    "eye": "eye",
    "anvil": "anvil",
}

CHAR_SELECT_ICONS = {
    "ironclad": "images/ui/charSelect/ironcladButton.png",
    "silent": "images/ui/charSelect/silentButton.png",
    "defect": "images/ui/charSelect/defectButton.png",
    "watcher": "images/ui/charSelect/watcherButton.png",
}

# Extra STS1 UI chrome used by Compendium filters / keyword tips.
# Jar folder -> public/images/sts1/<dest>
STS1_UI_EXTRA_FOLDERS = (
    ("images/ui/run_mods/", "run-mods"),
    ("images/ui/tip/", "tips"),
)

# libGDX Color packed RGBA (or float tuples) from Color.<clinit>.
GDX_COLORS: dict[str, tuple[int, int, int, int]] = {
    "CLEAR": (0, 0, 0, 0),
    "BLACK": (0, 0, 0, 255),
    "WHITE": (255, 255, 255, 255),
    "LIGHT_GRAY": (191, 191, 191, 255),
    "GRAY": (127, 127, 127, 255),
    "DARK_GRAY": (63, 63, 63, 255),
    "BLUE": (0, 0, 255, 255),
    "NAVY": (0, 0, 128, 255),
    "ROYAL": (65, 105, 225, 255),
    "SLATE": (112, 128, 144, 255),
    "SKY": (135, 206, 235, 255),
    "CYAN": (0, 255, 255, 255),
    "TEAL": (0, 128, 128, 255),
    "GREEN": (0, 255, 0, 255),
    "CHARTREUSE": (127, 255, 0, 255),
    "LIME": (50, 205, 50, 255),
    "FOREST": (34, 139, 34, 255),
    "OLIVE": (107, 142, 35, 255),
    "YELLOW": (255, 255, 0, 255),
    "GOLD": (255, 215, 0, 255),
    "GOLDENROD": (218, 165, 32, 255),
    "ORANGE": (255, 165, 0, 255),
    "BROWN": (139, 69, 19, 255),
    "TAN": (210, 180, 140, 255),
    "FIREBRICK": (178, 34, 34, 255),
    "RED": (255, 0, 0, 255),
    "SCARLET": (255, 52, 28, 255),
    "CORAL": (255, 127, 80, 255),
    "SALMON": (250, 128, 114, 255),
    "PINK": (255, 105, 180, 255),
    "MAGENTA": (255, 0, 255, 255),
    "PURPLE": (160, 32, 240, 255),
    "VIOLET": (238, 130, 238, 255),
    "MAROON": (176, 48, 96, 255),
}

# Settings.* colors used as potion lab outlines (packed RGBA8888 from Settings.<clinit>).
# Float-constructed entries stay here; int/hex fields are filled from Settings.<clinit>.
SETTINGS_COLORS: dict[str, tuple[int, int, int, int]] = {
    "HALF_TRANSPARENT_BLACK_COLOR": (0, 0, 0, 128),
    "RED_RELIC_COLOR": (255, 101, 99, 191),
    "GREEN_RELIC_COLOR": (127, 255, 0, 191),
    "BLUE_RELIC_COLOR": (135, 206, 235, 191),
    "PURPLE_RELIC_COLOR": (200, 60, 255, 191),
}

_SETTINGS_COLOR_CACHE: dict[str, tuple[int, int, int, int]] | None = None


def rgba8888_tuple(value: int) -> tuple[int, int, int, int]:
    packed = value & 0xFFFFFFFF
    return (
        (packed >> 24) & 255,
        (packed >> 16) & 255,
        (packed >> 8) & 255,
        packed & 255,
    )


def gdx_value_of(hex_str: str) -> tuple[int, int, int, int]:
    """libGDX Color.valueOf: RRGGBB or RRGGBBAA, optional leading #."""
    text = hex_str[1:] if hex_str.startswith("#") else hex_str
    red = int(text[0:2], 16)
    green = int(text[2:4], 16)
    blue = int(text[4:6], 16)
    alpha = int(text[6:8], 16) if len(text) >= 8 else 255
    return (red, green, blue, alpha)


def rainbow_liquid_rgba(millis: int = 0) -> tuple[int, int, int, int]:
    """One frame of AbstractPotion.updateEffect RAINBOW (case 3).

    liquidColor.{r,g,b} = (cosDeg(((millis + offset) / 10) % 360) + 1.25) / 2.3
    with offsets 0 / 1000 / 2000. Epoch 0 is a deterministic in-game frame.
    """

    def channel(offset: int) -> int:
        degrees = ((millis + offset) // 10) % 360
        value = (math.cos(math.radians(degrees)) + 1.25) / 2.3
        return max(0, min(255, int(round(value * 255))))

    return (channel(0), channel(1000), channel(2000), 255)


def parse_settings_colors(jar) -> dict[str, tuple[int, int, int, int]]:
    cls = parse_jar_class(jar, "com.megacrit.cardcrawl.core.Settings")
    clinit = cls.method("<clinit>")
    colors = dict(SETTINGS_COLORS)
    if not clinit or not clinit.code:
        return colors
    pending: tuple[int, int, int, int] | None = None
    last_int: int | None = None
    last_hex: str | None = None
    for _start, op, arg in iter_opcodes(clinit.code):
        if op == 18:
            value = cls.ldc_value(arg[0])
            if isinstance(value, int):
                last_int = value
            elif isinstance(value, str):
                last_hex = value
        elif op in {19, 20}:
            value = cls.ldc_value(u2_from(arg))
            if isinstance(value, int):
                last_int = value
            elif isinstance(value, str):
                last_hex = value
        elif op in {183, 184}:
            owner, name, _desc = cls.methodref(u2_from(arg))
            if not owner.endswith("graphics.Color"):
                continue
            if name == "<init>" and last_int is not None:
                pending = rgba8888_tuple(last_int)
            elif name == "valueOf" and last_hex:
                pending = gdx_value_of(last_hex)
            last_int = None
            last_hex = None
        elif op == 179:
            _owner, name, desc = cls.fieldref(u2_from(arg))
            if pending and desc.endswith("graphics/Color;"):
                colors[name] = pending
            pending = None
            last_int = None
            last_hex = None
    return colors


def settings_colors(jar) -> dict[str, tuple[int, int, int, int]]:
    global _SETTINGS_COLOR_CACHE
    if _SETTINGS_COLOR_CACHE is None:
        _SETTINGS_COLOR_CACHE = parse_settings_colors(jar)
    return _SETTINGS_COLOR_CACHE


def color_from_name(name: str, extra: dict[str, tuple[int, int, int, int]] | None = None) -> tuple[int, int, int, int] | None:
    if name in GDX_COLORS:
        return GDX_COLORS[name]
    if extra and name in extra:
        return extra[name]
    return SETTINGS_COLORS.get(name)


def resolve_color_value(value: Any, extra: dict[str, tuple[int, int, int, int]] | None = None) -> tuple[int, int, int, int] | None:
    if value is None:
        return None
    if isinstance(value, tuple) and len(value) == 4 and all(isinstance(part, int) for part in value):
        return value
    if isinstance(value, tuple) and value:
        tag = value[0]
        if tag == "rgba" and len(value) == 2 and isinstance(value[1], tuple):
            return resolve_color_value(value[1], extra)
        if tag == "rgba8888" and len(value) == 2 and isinstance(value[1], int):
            return rgba8888_tuple(value[1])
        if tag == "static" and len(value) >= 3:
            return color_from_name(str(value[2]), extra)
    if isinstance(value, str):
        return color_from_name(value, extra)
    return None


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower())
    return slug.strip("-")


def legacy_slug(name: str, card_class: str | None = None) -> str:
    base = name.lower().replace(".", "").replace("'", "")
    base = re.sub(r"[^a-z0-9]+", "-", base).strip("-")
    if card_class and base in {"strike", "defend"}:
        return f"{base}-{card_class}"
    return base


def unique_slugs(values: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        if not value or value in seen:
            continue
        seen.add(value)
        ordered.append(value)
    return ordered


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def parse_jar_class(jar, class_name: str) -> JavaClass:
    return parse_class_file(jar.read(class_name.replace(".", "/") + ".class"))


def enum_name(value: Any) -> str | None:
    if isinstance(value, tuple) and value and value[0] == "enum":
        return value[2]
    return None


def walk_code(cls: JavaClass, code: bytes) -> dict[str, Any]:
    stack: list[Any] = []
    puts: list[tuple[str, Any]] = []
    supers: list[tuple[str, str, list[Any]]] = []
    static_calls: list[tuple[str, str, list[Any]]] = []
    news: list[str] = []
    virtuals: list[tuple[str, str, list[Any]]] = []

    for _start, op, arg in iter_opcodes(code):
        if op == 1:
            stack.append(None)
        elif 2 <= op <= 8:
            stack.append(op - 3)
        elif op == 11:
            stack.append(0.0)
        elif op == 12:
            stack.append(1.0)
        elif op == 16:
            stack.append(s1_from(arg))
        elif op == 17:
            stack.append(s2_from(arg))
        elif op == 18:
            stack.append(cls.ldc_value(arg[0]))
        elif op in {19, 20}:
            stack.append(cls.ldc_value(u2_from(arg)))
        elif op == 21:
            stack.append(("local", arg[0] if arg else 0))
        elif 26 <= op <= 29:
            stack.append(("local", op - 26))
        elif op == 25:
            stack.append(("local", arg[0] if arg else 0))
        elif 42 <= op <= 45:
            stack.append("this" if op == 42 else ("local", op - 42))
        elif op == 87 and stack:
            stack.pop()
        elif op == 88:
            if stack:
                stack.pop()
            if stack:
                stack.pop()
        elif op == 89 and stack:
            stack.append(stack[-1])
        elif op == 96:
            right = stack.pop() if stack else 0
            left = stack.pop() if stack else 0
            if isinstance(left, int) and isinstance(right, int):
                stack.append(left + right)
            else:
                stack.append(("add", left, right))
        elif op == 100:
            right = stack.pop() if stack else 0
            left = stack.pop() if stack else 0
            if isinstance(left, int) and isinstance(right, int):
                stack.append(left - right)
            else:
                stack.append(("sub", left, right))
        elif op == 104:
            right = stack.pop() if stack else 0
            left = stack.pop() if stack else 0
            if isinstance(left, int) and isinstance(right, int):
                stack.append(left * right)
            else:
                stack.append(("mul", left, right))
        elif op == 178:
            owner, name, desc = cls.fieldref(u2_from(arg))
            if "$" in owner and desc.startswith("L"):
                stack.append(("enum", owner.rsplit("$", 1)[-1], name))
            else:
                stack.append(("static", owner, name))
        elif op == 180:
            if stack:
                stack.pop()
            _owner, name, _desc = cls.fieldref(u2_from(arg))
            stack.append(("field", name))
        elif op == 181:
            _owner, name, _desc = cls.fieldref(u2_from(arg))
            value = stack.pop() if stack else None
            if stack:
                stack.pop()
            puts.append((name, value))
        elif op == 187:
            news.append(cls.class_name(u2_from(arg)))
            stack.append(("new", news[-1]))
        elif op == 192:
            continue
        elif 153 <= op <= 158 or op in {198, 199}:
            if stack:
                stack.pop()
        elif 159 <= op <= 166:
            if stack:
                stack.pop()
            if stack:
                stack.pop()
        elif op in {182, 183, 184, 185}:
            owner, name, desc = cls.methodref(u2_from(arg))
            argc = descriptor_arg_count(desc)
            extra = 0 if op == 184 else 1
            raw: list[Any] = []
            for _ in range(argc + extra):
                raw.insert(0, stack.pop() if stack else None)
            receiver = raw[0] if extra and raw else None
            args = raw[extra:]
            result_value: Any | None = None
            if owner.endswith("graphics.Color") and name == "<init>" and op == 183:
                if len(args) == 1 and isinstance(args[0], int) and stack:
                    stack[-1] = ("rgba8888", args[0])
            elif owner.endswith("graphics.Color") and name == "valueOf" and args and isinstance(args[0], str):
                result_value = ("rgba", gdx_value_of(args[0]))
            elif owner.endswith("graphics.Color") and name == "cpy":
                result_value = receiver
            elif not desc.endswith(")V"):
                result_value = ("call", name)
            if result_value is not None:
                stack.append(result_value)
            if op == 183:
                supers.append((owner, name, args))
            elif op == 184:
                static_calls.append((owner, name, args))
            else:
                virtuals.append((owner, name, args))
        elif op == 172:
            return {
                "puts": puts,
                "supers": supers,
                "static_calls": static_calls,
                "virtuals": virtuals,
                "news": news,
                "return": stack[-1] if stack else None,
            }
        elif op == 177:
            break

    return {
        "puts": puts,
        "supers": supers,
        "static_calls": static_calls,
        "virtuals": virtuals,
        "news": news,
        "return": None,
    }


def collect_new_classes(cls: JavaClass, method_names: tuple[str, ...], prefix: str) -> list[str]:
    found: list[str] = []
    for method_name in method_names:
        method = cls.method(method_name)
        if not method or not method.code:
            continue
        for _start, op, arg in iter_opcodes(method.code):
            if op != 187:
                continue
            name = cls.class_name(u2_from(arg))
            if name.startswith(prefix) and "$" not in name:
                found.append(name)
    seen: set[str] = set()
    ordered: list[str] = []
    for name in found:
        if name in seen:
            continue
        seen.add(name)
        ordered.append(name)
    return ordered


def add_delta(upgrade: dict[str, Any], key: str, value: Any) -> None:
    if isinstance(value, int):
        upgrade[key] = value
        return
    if isinstance(value, tuple) and value and value[0] == "add":
        ints = [part for part in value[1:] if isinstance(part, int)]
        fields = [part[1] for part in value[1:] if isinstance(part, tuple) and part[0] == "field"]
        if ints:
            upgrade[key] = ints[0]
        if "timesUpgraded" in fields:
            upgrade["damageScalesWithTimesUpgraded"] = True


def parse_card(jar, class_name: str) -> dict[str, Any] | None:
    cls = parse_jar_class(jar, class_name)
    if cls.super_name != "com.megacrit.cardcrawl.cards.AbstractCard":
        return None

    ctors = [method for method in cls.methods if method.name == "<init>" and method.code]
    ctors.sort(key=lambda method: descriptor_arg_count(method.descriptor), reverse=True)
    chosen = None
    for ctor in ctors:
        result = walk_code(cls, ctor.code)
        for owner, name, args in result["supers"]:
            if owner.endswith("AbstractCard") and name == "<init>" and len(args) >= 9:
                chosen = (result, args)
                break
        if chosen:
            break
    if not chosen:
        return None

    result, args = chosen
    card_id = args[0] if isinstance(args[0], str) else None
    img = args[2] if isinstance(args[2], str) else None
    cost = args[3] if isinstance(args[3], int) else 0
    card_type = enum_name(args[5]) or "SKILL"
    color = enum_name(args[6]) or "COLORLESS"
    rarity = enum_name(args[7]) or "COMMON"

    fields = {name: value for name, value in result["puts"]}
    can_upgrade = cls.method("canUpgrade", "()Z")
    unlimited = False
    if can_upgrade and can_upgrade.code:
        can_result = walk_code(cls, can_upgrade.code)
        unlimited = can_result.get("return") in {1, True}

    upgrade: dict[str, Any] = {}
    upgrade_method = cls.method("upgrade", "()V")
    if upgrade_method and upgrade_method.code:
        up = walk_code(cls, upgrade_method.code)
        for _owner, name, call_args in up["virtuals"]:
            if not call_args:
                continue
            if name == "upgradeDamage":
                add_delta(upgrade, "damage", call_args[0])
            elif name == "upgradeBlock":
                add_delta(upgrade, "block", call_args[0])
            elif name == "upgradeMagicNumber":
                add_delta(upgrade, "magic", call_args[0])
            elif name == "upgradeBaseCost" and isinstance(call_args[0], int):
                upgrade["cost"] = call_args[0]
        for name, value in up["puts"]:
            if name == "exhaust" and value in {1, True}:
                upgrade["exhaust"] = True
            elif name == "isInnate" and value in {1, True}:
                upgrade["innate"] = True
            elif name == "isEthereal" and value in {1, True}:
                upgrade["ethereal"] = True
            elif name == "selfRetain" and value in {1, True}:
                upgrade["retain"] = True

    pool = COLOR_TO_POOL.get(color, "colorless")
    slug = slugify(str(card_id or class_name.rsplit(".", 1)[-1]))
    return {
        "id": card_id or class_name.rsplit(".", 1)[-1],
        "slug": slug,
        "className": class_name,
        "color": pool,
        "cardColor": color.lower(),
        "type": card_type.lower(),
        "rarity": rarity.lower(),
        "cost": cost,
        "damage": fields.get("baseDamage") if isinstance(fields.get("baseDamage"), int) else None,
        "block": fields.get("baseBlock") if isinstance(fields.get("baseBlock"), int) else None,
        "magic": fields.get("baseMagicNumber") if isinstance(fields.get("baseMagicNumber"), int) else None,
        "exhaust": fields.get("exhaust") in {True, 1},
        "ethereal": fields.get("isEthereal") in {True, 1},
        "innate": fields.get("isInnate") in {True, 1},
        "retain": fields.get("selfRetain") in {True, 1},
        "portrait": img,
        "upgrade": upgrade or None,
        "unlimitedUpgrade": unlimited,
        "hasBetaArt": False,
        "legacySlugs": [slug],
    }


def parse_relic(jar, class_name: str, pool: str) -> dict[str, Any] | None:
    cls = parse_jar_class(jar, class_name)
    ctor = cls.method("<init>")
    if not ctor or not ctor.code:
        return None
    result = walk_code(cls, ctor.code)
    relic_id = None
    img = None
    tier = "COMMON"
    for owner, name, args in result["supers"]:
        if owner.endswith("AbstractRelic") and name == "<init>" and len(args) >= 3:
            relic_id = args[0] if isinstance(args[0], str) else None
            img = args[1] if isinstance(args[1], str) else None
            tier = enum_name(args[2]) or "COMMON"
            break
    if not relic_id:
        return None
    slug = slugify(relic_id)
    img_stem = Path(str(img or slug)).stem
    return {
        "id": relic_id,
        "slug": slug,
        "className": class_name,
        "tier": tier.lower(),
        "pool": pool,
        "image": img_stem,
        "legacySlugs": [slug],
    }


def parse_constant_return(cls: JavaClass, method_name: str, descriptor: str | None = None) -> int | None:
    method = cls.method(method_name, descriptor)
    if not method or not method.code:
        return None
    result = walk_code(cls, method.code)
    value = result.get("return")
    return value if isinstance(value, int) else None


def parse_potion(jar, class_name: str) -> dict[str, Any] | None:
    cls = parse_jar_class(jar, class_name)
    if cls.super_name != "com.megacrit.cardcrawl.potions.AbstractPotion":
        return None
    ctor = next((method for method in cls.methods if method.name == "<init>" and method.code), None)
    if not ctor:
        return None
    result = walk_code(cls, ctor.code)
    potion_id = None
    rarity = "COMMON"
    size = "M"
    color = "NONE"
    potion_effect: str | None = None
    layers: dict[str, tuple[int, int, int, int]] = {}
    extra_colors = settings_colors(jar)
    for owner, name, args in result["supers"]:
        if not owner.endswith("AbstractPotion") or name != "<init>":
            continue
        if len(args) >= 8:
            potion_id = args[1] if isinstance(args[1], str) else None
            rarity = enum_name(args[2]) or "COMMON"
            size = enum_name(args[3]) or "M"
            potion_effect = enum_name(args[4])
            color = potion_effect or "NONE"
            for key, value in zip(("liquid", "hybrid", "spots"), args[5:8]):
                rgba = resolve_color_value(value, extra_colors)
                if rgba:
                    layers[key] = rgba
            break
        if len(args) >= 5:
            potion_id = args[1] if isinstance(args[1], str) else None
            rarity = enum_name(args[2]) or "COMMON"
            size = enum_name(args[3]) or "M"
            color = enum_name(args[4]) or "NONE"
            break
    fields = {name: value for name, value in result["puts"]}
    if not potion_id:
        return None
    lab_outline = "HALF_TRANSPARENT_BLACK_COLOR"
    for name, value in result["puts"]:
        if name != "labOutlineColor":
            continue
        if isinstance(value, tuple) and len(value) >= 3 and value[0] == "static":
            lab_outline = str(value[2])
            break
    slug = slugify(potion_id)
    potency = parse_constant_return(cls, "getPotency", "(I)I")
    if potency is None:
        potency = parse_constant_return(cls, "getPotency", "()I")
    parsed: dict[str, Any] = {
        "id": potion_id,
        "slug": slug,
        "className": class_name,
        "rarity": rarity.lower(),
        "size": size.lower(),
        "potionColor": color.lower(),
        "labOutline": lab_outline,
        "potency": potency,
        "thrown": fields.get("isThrown") in {True, 1},
        "legacySlugs": [slug],
    }
    if potion_effect:
        parsed["_potionEffect"] = potion_effect.lower()
    if layers:
        parsed["_layers"] = layers
    return parsed


def load_visible_potions(jar) -> list[dict[str, Any]]:
    potion_classes = [
        name.replace("/", ".").removesuffix(".class")
        for name in jar.namelist()
        if name.startswith("com/megacrit/cardcrawl/potions/")
        and name.endswith(".class")
        and "$" not in name
        and not name.endswith("AbstractPotion.class")
    ]
    potions: list[dict[str, Any]] = []
    for class_name in potion_classes:
        try:
            potion = parse_potion(jar, class_name)
        except Exception as error:  # noqa: BLE001
            print(f"skip potion {class_name}: {error}")
            continue
        if potion:
            potions.append(potion)
    id_to_pool = {
        potion_id: pool
        for pool, ids in CHARACTER_POTION_IDS.items()
        for potion_id in ids
    }
    visible: list[dict[str, Any]] = []
    for potion in potions:
        if potion["rarity"] == "placeholder":
            continue
        potion["pool"] = id_to_pool.get(potion["id"], "shared")
        visible.append(potion)
    return visible


def strip_potion_extract_fields(potion: dict[str, Any]) -> dict[str, Any]:
    potion.pop("_layers", None)
    potion.pop("_potionEffect", None)
    return potion


def load_loc_table(jar, locale: str, filename: str) -> dict[str, Any]:
    path = f"localization/{locale}/{filename}"
    try:
        return json.loads(jar.read(path))
    except KeyError:
        return {}


def loc_card(entry: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": entry.get("NAME") or "",
        "description": entry.get("DESCRIPTION") or "",
        "upgradeDescription": entry.get("UPGRADE_DESCRIPTION") or "",
        "extendedDescription": entry.get("EXTENDED_DESCRIPTION") or [],
    }


def loc_relic(entry: dict[str, Any]) -> dict[str, Any]:
    descriptions = entry.get("DESCRIPTIONS") or []
    return {
        "name": entry.get("NAME") or "",
        "flavor": entry.get("FLAVOR") or "",
        "description": descriptions[0] if descriptions else "",
        "descriptions": descriptions,
    }


def loc_potion(entry: dict[str, Any], potency: int | None) -> dict[str, Any]:
    descriptions = [str(part) for part in (entry.get("DESCRIPTIONS") or [])]
    rendered = ""
    if descriptions:
        if potency is not None and len(descriptions) >= 2:
            rendered = f"{descriptions[0]}{potency}{descriptions[1]}"
            if len(descriptions) > 2:
                rendered += "".join(descriptions[2:])
        else:
            rendered = "".join(descriptions)
    return {
        "name": entry.get("NAME") or "",
        "description": rendered,
        "descriptions": descriptions,
    }


def parse_atlas(text: str) -> dict[str, dict[str, Any]]:
    pages: dict[str, dict[str, Any]] = {}
    current_page = None
    current_region = None
    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        if not line:
            current_region = None
            continue
        if not line.startswith(" ") and ":" not in line:
            if line.endswith(".png") or line.endswith(".jpg"):
                current_page = line
                pages.setdefault(current_page, {"regions": {}})
                current_region = None
            else:
                current_region = line
                if current_page:
                    pages[current_page]["regions"][current_region] = {}
            continue
        if ":" not in line or current_page is None:
            continue
        key, value = [part.strip() for part in line.split(":", 1)]
        target = pages[current_page] if current_region is None else pages[current_page]["regions"][current_region]
        if "," in value and key in {"size", "xy", "orig", "offset"}:
            target[key] = [int(part.strip()) for part in value.split(",")]
        elif value in {"true", "false"}:
            target[key] = value == "true"
        else:
            target[key] = value
    return pages


def parse_switch_map(jar, enum_simple: str) -> dict[str, int]:
    cls = parse_jar_class(jar, "com.megacrit.cardcrawl.potions.AbstractPotion$1")
    mapping: dict[str, int] = {}
    current = None
    clinit = cls.method("<clinit>")
    if not clinit or not clinit.code:
        return mapping
    for _start, op, arg in iter_opcodes(clinit.code):
        if op == 178:
            owner, name, _desc = cls.fieldref(u2_from(arg))
            if owner.endswith(enum_simple):
                current = name
        elif current and 2 <= op <= 8:
            mapping[current] = op - 3
            current = None
        elif current and op == 16:
            mapping[current] = s1_from(arg)
            current = None
    return mapping


def parse_tableswitch_cases(code: bytes) -> list[tuple[int, int, int]] | None:
    i = 0
    while i < len(code):
        op = code[i]
        if op == 170:
            start = i
            i += 1
            i += (4 - (i % 4)) % 4
            _default, low, high = struct.unpack_from(">iii", code, i)
            i += 12
            cases: list[tuple[int, int, int]] = []
            for value in range(low, high + 1):
                offset = struct.unpack_from(">i", code, i)[0]
                cases.append((value, start + offset, 0))
                i += 4
            ends = [case[1] for case in cases[1:]] + [start + _default]
            return [(value, begin, end) for (value, begin, _unused), end in zip(cases, ends)]
        # skip using the same widths as iter_opcodes would
        if op in {16, 18, 188}:
            i += 2
        elif op in {17, 19, 20, 178, 179, 180, 181, 182, 183, 184, 187, 189, 192, 193}:
            i += 3
        elif op == 185:
            i += 5
        elif op == 132:
            i += 3
        elif op == 196:
            i += 4 if code[i + 1] == 132 else 3
        else:
            i += 1
    return None


def parse_potion_color_layers(jar) -> dict[str, dict[str, tuple[int, int, int, int]]]:
    switch_map = parse_switch_map(jar, "AbstractPotion$PotionColor")
    extra_colors = settings_colors(jar)
    ap = parse_jar_class(jar, "com.megacrit.cardcrawl.potions.AbstractPotion")
    initialize = ap.method("initializeColor")
    colors: dict[str, dict[str, tuple[int, int, int, int]]] = {}
    if not initialize or not initialize.code:
        return colors
    cases = parse_tableswitch_cases(initialize.code)
    if not cases:
        return colors
    case_to_enum = {index: name for name, index in switch_map.items()}
    for value, begin, end in cases:
        enum_name_value = case_to_enum.get(value)
        if not enum_name_value:
            continue
        layers: dict[str, tuple[int, int, int, int]] = {}
        last: Any = None
        pending_hex: str | None = None
        for start, op, arg in iter_opcodes(initialize.code):
            if start < begin or start >= end:
                continue
            if op == 18:
                loaded = ap.ldc_value(arg[0])
                if isinstance(loaded, str):
                    pending_hex = loaded
            elif op in {19, 20}:
                loaded = ap.ldc_value(u2_from(arg))
                if isinstance(loaded, str):
                    pending_hex = loaded
            elif op == 178:
                owner, name, _desc = ap.fieldref(u2_from(arg))
                if owner.endswith("graphics.Color") or owner.endswith("core.Settings"):
                    last = name
            elif op == 184:
                owner, name, _desc = ap.methodref(u2_from(arg))
                if name == "valueOf" and owner.endswith("graphics.Color") and pending_hex:
                    last = gdx_value_of(pending_hex)
                    pending_hex = None
            elif op == 181 and last is not None:
                _owner, field, _desc = ap.fieldref(u2_from(arg))
                rgba = last if isinstance(last, tuple) else color_from_name(str(last), extra_colors)
                if rgba and field in {"liquidColor", "hybridColor", "spotsColor"}:
                    key = field.replace("Color", "")
                    layers[key] = rgba
        colors[enum_name_value.lower()] = layers
    return colors


def save_webp(image: Any, dest: Path, quality: int = 80, *, lossless: bool = False) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if lossless:
        image.save(dest, "WEBP", lossless=True, method=4)
    else:
        image.save(dest, "WEBP", quality=quality, method=4)


def clear_transparent_rgb(image: Any, alpha_cutoff: int = 8):
    """Drop dirty atlas alpha (and white RGB on a=0) so scaled layers do not fringe."""
    image.putdata([
        (0, 0, 0, 0) if pixel[3] < alpha_cutoff else pixel
        for pixel in image.getdata()
    ])
    return image


def extract_png(jar, entry: str):
    from PIL import Image

    return Image.open(BytesIO(jar.read(entry))).convert("RGBA")


def extract_atlas_region(sheet: Any, region: dict[str, Any]):
    from PIL import Image

    x, y = region["xy"]
    w, h = region["size"]
    crop = sheet.crop((x, y, x + w, y + h))
    orig = region.get("orig") or [w, h]
    offset = region.get("offset") or [0, 0]
    canvas = Image.new("RGBA", (orig[0], orig[1]), (0, 0, 0, 0))
    ox, oy = offset
    paste_y = orig[1] - oy - h
    canvas.paste(crop, (ox, paste_y), crop)
    return clear_transparent_rgb(canvas)


def tint_layer(image: Any, rgba: tuple[int, int, int, int]):
    from PIL import Image

    r, g, b, a = rgba
    if a == 0:
        return None
    channels = image.split()
    tinted = Image.merge(
        "RGBA",
        (
            channels[0].point(lambda value, channel=r: value * channel // 255),
            channels[1].point(lambda value, channel=g: value * channel // 255),
            channels[2].point(lambda value, channel=b: value * channel // 255),
            channels[3].point(lambda value, channel=a: value * channel // 255),
        ),
    )
    return tinted


def potion_layer_paths(size: str) -> dict[str, str]:
    if size in LETTER_POTION_SIZES:
        prefix = f"images/potion/potion_{size}_"
        return {
            "outline": prefix + "outline.png",
            "liquid": prefix + "liquid.png",
            "hybrid": prefix + "hybrid.png",
            "spots": prefix + "spots.png",
            "body": prefix + "glass.png",
        }
    folder = FOLDER_POTION_SIZES.get(size, size)
    prefix = f"images/potion/{folder}/"
    return {
        "outline": prefix + "outline.png",
        "liquid": prefix + "liquid.png",
        "hybrid": prefix + "hybrid.png",
        "spots": prefix + "spots.png",
        "body": prefix + "body.png",
    }


def compose_potion(jar, potion: dict[str, Any], color_layers: dict[str, dict[str, tuple[int, int, int, int]]]):
    from PIL import Image

    paths = potion_layer_paths(potion["size"])
    names = jar.namelist()
    colors = dict(potion.get("_layers") or {})
    if not colors:
        colors = dict(color_layers.get(potion["potionColor"], {}))
    effect = potion.get("_potionEffect") or potion.get("potionColor")
    if effect == "rainbow":
        colors["liquid"] = rainbow_liquid_rgba()
    outline_rgba = settings_colors(jar).get(
        potion.get("labOutline") or "HALF_TRANSPARENT_BLACK_COLOR",
        SETTINGS_COLORS["HALF_TRANSPARENT_BLACK_COLOR"],
    )
    canvas = None
    for part in ("outline", "liquid", "hybrid", "spots", "body"):
        path = paths.get(part)
        if not path or path not in names:
            continue
        layer = extract_png(jar, path)
        if part == "outline":
            tinted = tint_layer(layer, outline_rgba)
            if tinted is None:
                continue
            layer = tinted
        elif part in {"liquid", "hybrid", "spots"}:
            rgba = colors.get(part)
            if not rgba:
                continue
            tinted = tint_layer(layer, rgba)
            if tinted is None:
                continue
            layer = tinted
        if canvas is None:
            canvas = layer
        else:
            if layer.size != canvas.size:
                layer = layer.resize(canvas.size)
            canvas = Image.alpha_composite(canvas, layer)
    return canvas


def extract_card_ui(jar, prefixes: tuple[str, ...] = ("1024", "512")) -> None:
    out = ROOT / "public" / "images" / "sts1"
    dest = {"1024": out / "card-ui", "512": out / "card-ui-512"}
    atlas_text = jar.read("cardui/cardui.atlas").decode("utf-8", "replace")
    atlas = parse_atlas(atlas_text)
    for page_name, page in atlas.items():
        sheet = extract_png(jar, f"cardui/{page_name}")
        for region_name, region in page["regions"].items():
            prefix, _, rest = region_name.partition("/")
            if prefix not in prefixes:
                continue
            image = extract_atlas_region(sheet, region)
            save_webp(image, dest[prefix] / f"{rest}.webp", lossless=True)


def extract_ui_extras(jar, out: Path, names: set[str] | None = None) -> int:
    """Extract run-mod icons, PowerTip 9-slice, and leftover card-library chrome."""
    names = names if names is not None else set(jar.namelist())
    written = 0
    for jar_prefix, dest_folder in STS1_UI_EXTRA_FOLDERS:
        for path in sorted(name for name in names if name.startswith(jar_prefix) and name.endswith(".png")):
            save_webp(extract_png(jar, path), out / dest_folder / f"{Path(path).stem}.webp")
            written += 1
    library_prefix = "images/ui/cardlibrary/"
    for path in sorted(name for name in names if name.startswith(library_prefix) and name.endswith(".png")):
        save_webp(extract_png(jar, path), out / "card-library" / f"{Path(path).stem}.webp")
        written += 1
    return written


def extract_images(jar, cards: list[dict[str, Any]], relics: list[dict[str, Any]], potions: list[dict[str, Any]]) -> None:
    out = ROOT / "public" / "images" / "sts1"
    names = set(jar.namelist())

    extract_card_ui(jar)

    for card in cards:
        portrait = card.get("portrait")
        if not portrait:
            continue
        official = f"images/1024Portraits/{portrait}.png"
        beta = f"images/1024PortraitsBeta/{portrait}.png"
        if official in names:
            save_webp(extract_png(jar, official), out / "cards" / f"{card['slug']}.webp")
        if beta in names:
            save_webp(extract_png(jar, beta), out / "cards-beta" / f"{card['slug']}.webp")
            card["hasBetaArt"] = True
        else:
            card["hasBetaArt"] = False

    for relic in relics:
        small = f"images/relics/{relic['image']}.png"
        large = f"images/largeRelics/{relic['image']}.png"
        if small in names:
            save_webp(extract_png(jar, small), out / "relics" / f"{relic['slug']}.webp")
        if large in names:
            save_webp(extract_png(jar, large), out / "relics-large" / f"{relic['slug']}.webp")

    for key, path in CHAR_SELECT_ICONS.items():
        if path in names:
            save_webp(extract_png(jar, path), out / "characters" / f"{key}.webp")

    extract_ui_extras(jar, out, names)

    color_layers = parse_potion_color_layers(jar)
    extract_potion_images(jar, potions, color_layers, out)


def extract_potion_images(
    jar,
    potions: list[dict[str, Any]],
    color_layers: dict[str, dict[str, tuple[int, int, int, int]]],
    out: Path,
) -> int:
    written = 0
    dest = out / "potions"
    for potion in potions:
        composed = compose_potion(jar, potion, color_layers)
        if composed is not None:
            save_webp(composed, dest / f"{potion['slug']}.webp")
            written += 1
    return written


def attach_legacy_slugs(rows: list[dict[str, Any]], loc: dict[str, Any], kind: str) -> None:
    for row in rows:
        english = (loc.get(row["id"]) or {}).get("name") or row["id"]
        class_hint = row.get("color") if kind == "card" and row.get("color") in {"ironclad", "silent", "defect", "watcher"} else None
        row["legacySlugs"] = unique_slugs(
            [
                row["slug"],
                legacy_slug(row["id"], class_hint),
                legacy_slug(english, class_hint),
            ]
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--jar", default=default_sts1_jar_path())
    parser.add_argument("--skip-images", action="store_true")
    parser.add_argument(
        "--card-ui-512-only",
        action="store_true",
        help="Re-extract combat 512 cardui layers without rewriting JSON or portraits.",
    )
    parser.add_argument(
        "--ui-extras-only",
        action="store_true",
        help="Extract run-mod icons, PowerTip chrome, and card-library UI without rewriting JSON or portraits.",
    )
    parser.add_argument(
        "--bitmap-fonts-only",
        action="store_true",
        help="Bake STS1 card BitmapFonts from jar TTF/OTF without rewriting JSON or portraits.",
    )
    parser.add_argument(
        "--potions-images-only",
        action="store_true",
        help="Re-compose STS1 potion lab sprites without rewriting JSON or portraits.",
    )
    args = parser.parse_args()

    if args.card_ui_512_only:
        with open_sts1_jar(args.jar) as jar:
            extract_card_ui(jar, prefixes=("512",))
        print("extracted card-ui-512")
        return

    if args.ui_extras_only:
        with open_sts1_jar(args.jar) as jar:
            written = extract_ui_extras(jar, ROOT / "public" / "images" / "sts1")
        print(f"extracted ui-extras={written}")
        return

    if args.bitmap_fonts_only:
        from subprocess import check_call

        check_call(
            [sys.executable, str(ROOT / "scripts" / "extract-sts1-bitmap-fonts.py"), "--jar", args.jar],
        )
        return

    if args.potions_images_only:
        with open_sts1_jar(args.jar) as jar:
            visible_potions = load_visible_potions(jar)
            written = extract_potion_images(
                jar,
                visible_potions,
                parse_potion_color_layers(jar),
                ROOT / "public" / "images" / "sts1",
            )
        print(f"extracted potion-images={written}")
        return

    with open_sts1_jar(args.jar) as jar:
        card_library = parse_jar_class(jar, "com.megacrit.cardcrawl.helpers.CardLibrary")
        card_classes = collect_new_classes(card_library, CARD_ADD_METHODS, "com.megacrit.cardcrawl.cards.")
        cards: list[dict[str, Any]] = []
        for class_name in card_classes:
            try:
                card = parse_card(jar, class_name)
            except Exception as error:  # noqa: BLE001
                print(f"skip card {class_name}: {error}")
                continue
            if card:
                cards.append(card)

        relic_library = parse_jar_class(jar, "com.megacrit.cardcrawl.helpers.RelicLibrary")
        relics: list[dict[str, Any]] = []
        initialize = relic_library.method("initialize", "()V")
        if initialize and initialize.code:
            pending_class = None
            for _start, op, arg in iter_opcodes(initialize.code):
                if op == 187:
                    pending_class = relic_library.class_name(u2_from(arg))
                elif op == 184 and pending_class:
                    _owner, name, _desc = relic_library.methodref(u2_from(arg))
                    pool = RELIC_ADD_TO_POOL.get(name)
                    if pool:
                        try:
                            relic = parse_relic(jar, pending_class, pool)
                        except Exception as error:  # noqa: BLE001
                            print(f"skip relic {pending_class}: {error}")
                            relic = None
                        if relic:
                            relics.append(relic)
                    pending_class = None

        visible_potions = load_visible_potions(jar)

        eng_cards = load_loc_table(jar, "eng", "cards.json")
        eng_relics = load_loc_table(jar, "eng", "relics.json")
        eng_potions = load_loc_table(jar, "eng", "potions.json")
        attach_legacy_slugs(
            cards,
            {key: loc_card(value) for key, value in eng_cards.items()},
            "card",
        )
        attach_legacy_slugs(
            relics,
            {key: loc_relic(value) for key, value in eng_relics.items()},
            "relic",
        )
        attach_legacy_slugs(
            visible_potions,
            {key: loc_potion(value, None) for key, value in eng_potions.items()},
            "potion",
        )

        if not args.skip_images:
            extract_images(jar, cards, relics, visible_potions)
        else:
            beta_dir = ROOT / "public" / "images" / "sts1" / "cards-beta"
            for card in cards:
                card["hasBetaArt"] = (beta_dir / f"{card['slug']}.webp").exists()

        for potion in visible_potions:
            strip_potion_extract_fields(potion)

        data_root = ROOT / "data" / "sts1"
        write_json(data_root / "cards.json", cards)
        write_json(data_root / "relics.json", relics)
        write_json(data_root / "potions.json", visible_potions)

        for locale in STS1_LOCALES:
            card_loc = load_loc_table(jar, locale, "cards.json")
            relic_loc = load_loc_table(jar, locale, "relics.json")
            potion_loc = load_loc_table(jar, locale, "potions.json")
            ui_loc = load_loc_table(jar, locale, "ui.json")
            keyword_loc = load_loc_table(jar, locale, "keywords.json")
            char_loc = load_loc_table(jar, locale, "characters.json")
            write_json(
                data_root / "localization" / locale / "cards.json",
                {card["id"]: loc_card(card_loc.get(card["id"], {})) for card in cards},
            )
            write_json(
                data_root / "localization" / locale / "relics.json",
                {relic["id"]: loc_relic(relic_loc.get(relic["id"], {})) for relic in relics},
            )
            write_json(
                data_root / "localization" / locale / "potions.json",
                {
                    potion["id"]: loc_potion(potion_loc.get(potion["id"], {}), potion.get("potency"))
                    for potion in visible_potions
                },
            )
            write_json(data_root / "localization" / locale / "keywords.json", keyword_loc)
            write_json(
                data_root / "localization" / locale / "characters.json",
                {
                    "ironclad": ((char_loc.get("Ironclad") or {}).get("NAMES") or [""])[0],
                    "silent": ((char_loc.get("Silent") or {}).get("NAMES") or [""])[0],
                    "defect": ((char_loc.get("Defect") or {}).get("NAMES") or [""])[0],
                    "watcher": ((char_loc.get("Watcher") or {}).get("NAMES") or [""])[0],
                },
            )
            write_json(
                data_root / "localization" / locale / "ui.json",
                {
                    "CardLibraryScreen": ui_loc.get("CardLibraryScreen"),
                    "CardLibSortHeader": ui_loc.get("CardLibSortHeader"),
                    "RelicViewScreen": ui_loc.get("RelicViewScreen"),
                    "PotionViewScreen": ui_loc.get("PotionViewScreen"),
                    "SingleCardViewPopup": ui_loc.get("SingleCardViewPopup"),
                    "MenuButton": ui_loc.get("MenuButton"),
                    "MenuPanels": ui_loc.get("MenuPanels"),
                    "SingleRelicViewPopup": ui_loc.get("SingleRelicViewPopup"),
                    "SingleViewRelicPopup": ui_loc.get("SingleViewRelicPopup"),
                },
            )

        print(f"cards={len(cards)} relics={len(relics)} potions={len(visible_potions)}")


if __name__ == "__main__":
    main()
