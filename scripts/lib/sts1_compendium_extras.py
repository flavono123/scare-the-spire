"""STS1 Compendium extras: events, keywords (orbs, stances), ascension, run mods,
blights, Neow, achievements and score bonuses.

Writes per-locale localization tables and the art those pages draw. Event scene
graphs (data/sts1/events/*.json) and the metadata files read here are transcribed
from bytecode by hand; this module only copies text and images out of the jar.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable

ROOT = Path(__file__).resolve().parents[2]

# Localization files copied whole, per locale: jar name -> data name.
LOCALIZATION_FILES = {
    "events.json": "events.json",
    "orbs.json": "orbs.json",
    "stances.json": "stances.json",
    "blights.json": "blights.json",
    "run_mods.json": "run-mods.json",
    "achievements.json": "achievements.json",
    "score_bonuses.json": "score-bonuses.json",
}

# ui.json tables these pages read (labels, ascension text, score screen lines).
UI_TABLES = (
    "AbstractDungeon",
    "AscensionModeDescriptions",
    "BossRelicSelectScreen",
    "CustomModeScreen",
    "DailyScreen",
    "DeathScreen",
    "VictoryScreen",
    "RunHistoryScreen",
    "DungeonTransitionScreen",
    "MenuPanels",
    "CharacterSelectScreen",
)

EVENT_UI_IMAGES = ("enabledButton", "disabledButton", "panel", "imgFrame", "roomTextPanel")

# Layers each orb's render() draws, bottom first (Frost.render, EmptyOrbSlot.render).
ORB_LAYERS = {
    "lightning": ("lightning",),
    "frost": ("frostRight", "frostLeft", "frostMid"),
    "dark": ("dark",),
    "plasma": ("plasma",),
    "empty": ("empty2", "empty1"),
}

NPC_ART = {
    "neow": {
        "atlas": "images/npcs/neow/skeleton.atlas",
        "skeleton": "images/npcs/neow/skeleton.json",
        "animation": "idle",
    },
}


def _load(jar, locale: str, name: str) -> dict[str, Any]:
    try:
        return json.loads(jar.read(f"localization/{locale}/{name}").decode("utf-8"))
    except KeyError:
        return json.loads(jar.read(f"localization/eng/{name}").decode("utf-8"))


def write_extras_localization(jar, locales: list[str], write_json: Callable[[Path, Any], None]) -> None:
    data_root = ROOT / "data" / "sts1" / "localization"
    for locale in locales:
        for source, dest in LOCALIZATION_FILES.items():
            write_json(data_root / locale / dest, _load(jar, locale, source))
        ui = _load(jar, locale, "ui.json")
        write_json(data_root / locale / "ui-extras.json", {name: ui.get(name) for name in UI_TABLES})
        characters = _load(jar, locale, "characters.json")
        write_json(
            data_root / locale / "neow.json",
            {"event": characters.get("Neow Event"), "reward": characters.get("Neow Reward")},
        )


def write_extras_nav_labels(jar, locales: list[str], write_json: Callable[[Path, Any], None]) -> None:
    """List titles the game itself names (client-safe, read by src/lib/sts1/nav-labels.ts)."""
    labels: dict[str, dict[str, str]] = {}
    for locale in locales:
        ui = _load(jar, locale, "ui.json")
        neow = _load(jar, locale, "characters.json").get("Neow Event") or {}
        text = lambda table, index: ((ui.get(table) or {}).get("TEXT") or [""] * (index + 1))[index].strip()
        labels[locale] = {
            "ascensions": text("MenuPanels", 6),
            "modifiers": text("CustomModeScreen", 6),
            "blights": text("AbstractDungeon", 1).rstrip(":：").strip(),
            "neow": (neow.get("NAMES") or [""])[0],
            "score-bonuses": text("DeathScreen", 6),
        }
    write_json(ROOT / "src" / "lib" / "sts1" / "nav-labels-game.json", labels)


def extract_extras_images(jar, *, extract_png, save_webp, parse_atlas, extract_atlas_region) -> int:
    from PIL import Image

    out = ROOT / "public" / "images" / "sts1"
    names = jar.namelist()
    written = 0
    for path in sorted(n for n in names if n.startswith("images/events/") and n.endswith((".jpg", ".png"))):
        image = extract_png(jar, path)
        lossless = path.endswith(".png")
        save_webp(image, out / "events" / f"{Path(path).stem}.webp", quality=85, lossless=lossless)
        written += 1
    # Room events draw their scene, not a framed picture: Dead Adventurer's body, the Mushrooms layers.
    save_webp(extract_png(jar, "images/npcs/nopants.png"), out / "events" / "nopants.webp", lossless=True)
    shrooms = Image.alpha_composite(
        extract_png(jar, "images/events/bgShrooms.png"),
        extract_png(jar, "images/events/fgShrooms.png"),
    )
    # Both layers sit on the room floor of a 1920x1080 screen; keep the part they cover.
    left, top, right, bottom = shrooms.getbbox()
    side = int((bottom - top) * 1.6)
    cx, cy = (left + right) // 2, (top + bottom) // 2
    shrooms = shrooms.crop((cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2))
    save_webp(shrooms, out / "events" / "shrooms.webp", quality=85)
    written += 2
    for stem in EVENT_UI_IMAGES:
        save_webp(extract_png(jar, f"images/ui/event/{stem}.png"), out / "event-ui" / f"{stem}.webp", lossless=True)
        written += 1
    for path in sorted(n for n in names if n.startswith("images/blights/") and n.count("/") == 2 and n.endswith(".png")):
        if Path(path).stem == "test":
            continue
        save_webp(extract_png(jar, path), out / "blights" / f"{Path(path).stem}.webp", lossless=True)
        written += 1
    for name, layers in ORB_LAYERS.items():
        canvas = None
        for layer in layers:
            image = extract_png(jar, f"images/orbs/{layer}.png").convert("RGBA")
            canvas = image if canvas is None else Image.alpha_composite(canvas, image)
        save_webp(canvas, out / "orbs" / f"{name}.webp", lossless=True)
        written += 1
    for page_name, page in parse_atlas(jar.read("achievements/achievements.atlas").decode("utf-8")).items():
        sheet = extract_png(jar, f"achievements/{page_name}")
        for region_name, region in page["regions"].items():
            if not region_name.startswith("unlocked/"):
                continue
            stem = region_name.split("/", 1)[1]
            save_webp(extract_atlas_region(sheet, region), out / "achievements" / f"{stem}.webp", quality=85)
            written += 1
    save_webp(extract_png(jar, "images/ui/leaderboards/score.png"), out / "ui" / "score.webp", lossless=True)
    # The run history map's "?" room: the event list's nav icon.
    save_webp(extract_png(jar, "images/ui/runHistory/mapIcons/unknown.png"), out / "nav" / "run-history-event.webp", lossless=True)
    written += 2
    return written


def write_npc_art_sources(write_json: Callable[[Path, Any], None]) -> None:
    """Spine sources for scripts/render-sts1-monsters.mjs --npcs."""
    write_json(ROOT / "data" / "sts1" / "npc-art.json", NPC_ART)
