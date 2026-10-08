"""STS1 character select data: loadouts, select effects, and select-screen strings."""

from __future__ import annotations

from typing import Any

from scripts.lib.java_classfile import JavaClass, iter_opcodes, parse_class_file, s1_from, s2_from, u2_from

# CharacterSelectScreen.initialize() adds options in PlayerClass order.
CHARACTER_CLASSES: tuple[tuple[str, str, str], ...] = (
    ("ironclad", "IRONCLAD", "com.megacrit.cardcrawl.characters.Ironclad"),
    ("silent", "THE_SILENT", "com.megacrit.cardcrawl.characters.TheSilent"),
    ("defect", "DEFECT", "com.megacrit.cardcrawl.characters.Defect"),
    ("watcher", "WATCHER", "com.megacrit.cardcrawl.characters.Watcher"),
)

# CharacterSelectScreen.TEXT indices used as CharacterOption names
# (initialize() for the first three, Watcher.getCharacterSelectOption() for TEXT[14]).
CHARACTER_SELECT_NAME_INDEX = {"ironclad": 2, "silent": 3, "defect": 4, "watcher": 14}

CHAR_SELECT_DIR = "images/ui/charSelect/"

# CharacterOption.updateHitbox() hover/click feedback.
UI_SOUND_KEYS = ("UI_HOVER", "UI_CLICK_1")


def _cls(jar, class_name: str) -> JavaClass:
    return parse_class_file(jar.read(class_name.replace(".", "/") + ".class"))


def _ldc(cls: JavaClass, op: int, arg: bytes) -> Any:
    if op == 18:
        return cls.ldc_value(arg[0])
    return cls.ldc_value(u2_from(arg))


def _strings(cls: JavaClass, method_name: str) -> list[str]:
    method = cls.method(method_name)
    if not method or not method.code:
        return []
    found: list[str] = []
    for _start, op, arg in iter_opcodes(method.code):
        if op in {18, 19}:
            value = _ldc(cls, op, arg)
            if isinstance(value, str):
                found.append(value)
    return found


def _list_adds(cls: JavaClass, method_name: str) -> list[str]:
    """Strings passed to ArrayList.add(); skips UnlockTracker.markRelicAsSeen(...) and friends."""
    method = cls.method(method_name)
    if not method or not method.code:
        return []
    added: list[str] = []
    last: str | None = None
    for _start, op, arg in iter_opcodes(method.code):
        if op in {18, 19}:
            value = _ldc(cls, op, arg)
            last = value if isinstance(value, str) else None
        elif op in {182, 185}:
            owner, name, _desc = cls.methodref(u2_from(arg))
            if name == "add" and owner.endswith("ArrayList") and last is not None:
                added.append(last)
            last = None
        elif op == 184:
            last = None
    return added


def _loadout_ints(cls: JavaClass) -> list[int]:
    method = cls.method("getLoadout")
    if not method or not method.code:
        return []
    ints: list[int] = []
    for _start, op, arg in iter_opcodes(method.code):
        if 2 <= op <= 8:
            ints.append(op - 3)
        elif op == 16:
            ints.append(s1_from(arg))
        elif op == 17:
            ints.append(s2_from(arg))
        elif op == 50 and ints:  # NAMES[0] / TEXT[0] indices are not loadout values
            ints.pop()
        elif op == 183:
            owner, name, _desc = cls.methodref(u2_from(arg))
            if owner.endswith("CharSelectInfo") and name == "<init>":
                break
    return ints


def _select_effect(cls: JavaClass) -> dict[str, Any]:
    method = cls.method("doCharSelectScreenSelectEffect")
    effect: dict[str, Any] = {}
    if not method or not method.code:
        return effect
    floats: list[float] = []
    last_bool: int | None = None
    for _start, op, arg in iter_opcodes(method.code):
        if op in {18, 19}:
            value = _ldc(cls, op, arg)
            if isinstance(value, str) and "sound" not in effect:
                effect["sound"] = value
            elif isinstance(value, float):
                floats.append(round(value, 4))
        elif op in {11, 12, 13}:
            floats.append(float(op - 11))
        elif op in {3, 4}:
            last_bool = op - 3
        elif op == 178:
            owner, name, _desc = cls.fieldref(u2_from(arg))
            if owner.endswith("ScreenShake$ShakeIntensity"):
                effect["shakeIntensity"] = name
            elif owner.endswith("ScreenShake$ShakeDur"):
                effect["shakeDuration"] = name
        elif op == 182:
            _owner, name, _desc = cls.methodref(u2_from(arg))
            if name == "shake":
                effect["shakeVertical"] = bool(last_bool)
    if len(floats) >= 2:
        effect["pitchMin"], effect["pitchMax"] = floats[0], floats[1]
    return effect


def _character_strings_key(cls: JavaClass) -> str | None:
    clinit = cls.method("<clinit>")
    if not clinit or not clinit.code:
        return None
    last: Any = None
    for _start, op, arg in iter_opcodes(clinit.code):
        if op in {18, 19}:
            last = _ldc(cls, op, arg)
        elif op == 182:
            _owner, name, _desc = cls.methodref(u2_from(arg))
            if name == "getCharacterString" and isinstance(last, str):
                return last
    return None


def sound_files(jar) -> dict[str, str]:
    """SoundMaster.<init>: map.put(KEY, load("file.ogg")) -> {KEY: audio/sound/file}."""
    cls = _cls(jar, "com.megacrit.cardcrawl.audio.SoundMaster")
    init = cls.method("<init>")
    files: dict[str, str] = {}
    if not init or not init.code:
        return files
    pending: list[str] = []
    for _start, op, arg in iter_opcodes(init.code):
        if op in {18, 19}:
            value = _ldc(cls, op, arg)
            if isinstance(value, str):
                pending.append(value)
        elif op == 182:
            _owner, name, _desc = cls.methodref(u2_from(arg))
            if name == "put" and len(pending) >= 2:
                files[pending[-2]] = f"audio/sound/{pending[-1]}"
                pending = []
    return files


def load_characters(jar) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for slug, player_class, class_name in CHARACTER_CLASSES:
        cls = _cls(jar, class_name)
        ints = _loadout_ints(cls)
        hp, max_hp, max_orbs, gold, card_draw = (ints + [0] * 5)[:5]
        portrait = next(iter(_strings(cls, "getPortraitImageName")), None)
        rows.append({
            "id": slug,
            "slug": slug,
            "className": class_name,
            "playerClass": player_class,
            "locKey": _character_strings_key(cls),
            "hp": hp,
            "maxHp": max_hp,
            "maxOrbs": max_orbs,
            "gold": gold,
            "cardDraw": card_draw,
            "startingRelicIds": _list_adds(cls, "getStartingRelics"),
            "startingDeckIds": _list_adds(cls, "getStartingDeck"),
            "portrait": f"{CHAR_SELECT_DIR}{portrait}" if portrait else None,
            "selectEffect": _select_effect(cls),
            "legacySlugs": [slug],
        })
    return rows


def localize_characters(
    characters: list[dict[str, Any]],
    char_loc: dict[str, Any],
    ui_loc: dict[str, Any],
) -> dict[str, Any]:
    select_text = (ui_loc.get("CharacterSelectScreen") or {}).get("TEXT") or []
    option_text = (ui_loc.get("CharacterOption") or {}).get("TEXT") or []
    entries: dict[str, Any] = {}
    for character in characters:
        entry = char_loc.get(character["locKey"] or "") or {}
        index = CHARACTER_SELECT_NAME_INDEX[character["id"]]
        entries[character["id"]] = {
            "name": select_text[index] if index < len(select_text) else "",
            "title": (entry.get("NAMES") or [""])[0],
            "flavor": (entry.get("TEXT") or [""])[0],
        }

    def text(table: list[str], index: int) -> str:
        return table[index] if index < len(table) else ""

    return {
        "characters": entries,
        "ui": {
            "choose": text(select_text, 0),
            "embark": text(select_text, 1),
            "back": text(select_text, 5),
            "hp": text(option_text, 4),
            "gold": text(option_text, 5),
        },
    }


def public_character_row(character: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in character.items() if key not in {"locKey", "portrait"}}
