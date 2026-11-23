"""Write AbstractMonster's tip strings (the intent PowerTip header/body pieces) per locale.

`AbstractMonster.updateIntentTip` builds each intent tip from `uiStrings("AbstractMonster").TEXT`;
the index order is decoded in src/lib/sts1/intents.ts. Output: data/sts1/localization/<locale>/intent-tips.json.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.sts1_jar import default_sts1_jar_path, open_sts1_jar  # noqa: E402

LOCALES = ["kor", "eng", "zhs", "jpn", "deu", "fra", "ita", "spa", "ptb", "rus", "pol", "tha", "tur"]


def main() -> None:
    with open_sts1_jar(default_sts1_jar_path()) as jar:
        eng = json.loads(jar.read("localization/eng/ui.json").decode("utf-8"))["AbstractMonster"]["TEXT"]
        for locale in LOCALES:
            try:
                table = json.loads(jar.read(f"localization/{locale}/ui.json").decode("utf-8"))["AbstractMonster"]["TEXT"]
            except KeyError:
                table = eng
            out = ROOT / "data" / "sts1" / "localization" / locale / "intent-tips.json"
            out.write_text(json.dumps({"TEXT": table}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"intent tips={len(LOCALES)} locales")


if __name__ == "__main__":
    main()
