#!/usr/bin/env python3
"""Snapshot the slseoun-shorts beta art catalog into data/sts2-beta-art.json.

Each pair keeps its series order, the earliest patch that added its official art
(null when it predates the 0.98 Early Access launch), and the Shorts episode it
appeared in (`beta-art-N`) with its order there. Beta-only arts are kept as they are.

Usage: python3 scripts/sync-beta-art-snapshot.py [--catalog ~/P/slseoun-shorts/catalog/beta-art.json]
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

SNAPSHOT = Path("data/sts2-beta-art.json")
DEFAULT_CATALOG = Path.home() / "P" / "slseoun-shorts" / "catalog" / "beta-art.json"
EPISODE_RE = re.compile(r"^beta-art-(\d+)$")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", type=Path, default=DEFAULT_CATALOG)
    args = parser.parse_args()

    catalog = json.loads(args.catalog.read_text())
    snapshot = json.loads(SNAPSHOT.read_text())
    pairs = []
    for row in sorted(catalog["rows"], key=lambda item: item["series_order"]):
        episodes = [
            (int(match.group(1)), use["order"])
            for use in row["used_in"]
            if (match := EPISODE_RE.match(use["video"]))
        ]
        episode, episode_order = min(episodes) if episodes else (None, None)
        pairs.append({
            "key": row["key"],
            "order": row["series_order"],
            "officialArtVersion": row["official_art_version"],
            "episode": episode,
            "episodeOrder": episode_order,
        })
    snapshot["pairs"] = pairs
    SNAPSHOT.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n")
    episodes = {pair["episode"] for pair in pairs if pair["episode"] is not None}
    print(f"{SNAPSHOT}: {len(pairs)} pairs in {len(episodes)} episodes")


if __name__ == "__main__":
    main()
